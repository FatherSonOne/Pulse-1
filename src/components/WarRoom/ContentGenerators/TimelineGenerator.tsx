import React, { useState, useCallback, useMemo } from 'react';
import { KnowledgeDoc } from '../../../services/ragService';
import { processWithModel } from '../../../services/geminiService';
import toast from 'react-hot-toast';

interface TimelineEvent {
  date: string;
  title: string;
  description: string;
  type: 'event' | 'milestone' | 'period';
  importance: 'low' | 'medium' | 'high';
  sources: string[];
}

interface Timeline {
  title: string;
  description: string;
  events: TimelineEvent[];
  generatedAt: Date;
}

interface TimelineGeneratorProps {
  documents: KnowledgeDoc[];
  activeContextIds: Set<string>;
  apiKey: string;
  onClose: () => void;
}

export const TimelineGenerator: React.FC<TimelineGeneratorProps> = ({
  documents,
  activeContextIds,
  apiKey,
  onClose
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [filterImportance, setFilterImportance] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'vertical' | 'horizontal'>('vertical');

  // Get documents to use
  const docsToUse = activeContextIds.size > 0
    ? documents.filter(d => activeContextIds.has(d.id) && d.processing_status === 'completed')
    : documents.filter(d => d.processing_status === 'completed');

  const generateTimeline = useCallback(async () => {
    if (docsToUse.length === 0) {
      toast.error('No documents available to generate timeline');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      // Combine document content
      const combinedContent = docsToUse
        .map(d => `## Source: ${d.title}\n\n${d.text_content || d.ai_summary || ''}`)
        .join('\n\n---\n\n')
        .substring(0, 50000);

      setProgress(10);

      const prompt = `You are an expert at extracting chronological information from documents. Analyze the following documents and extract all dates, events, and time-related information to create a comprehensive timeline.

DOCUMENTS:
${combinedContent}

Generate a timeline in the following JSON format (respond ONLY with valid JSON, no markdown):
{
  "title": "Timeline: [Topic]",
  "description": "A brief description of what this timeline covers",
  "events": [
    {
      "date": "2024-01-15",
      "title": "Event Title",
      "description": "Detailed description of what happened (1-2 sentences)",
      "type": "event",
      "importance": "high",
      "sources": ["Document title"]
    },
    {
      "date": "2023",
      "title": "Period or Era",
      "description": "Description of this period",
      "type": "period",
      "importance": "medium",
      "sources": ["Document title"]
    }
  ]
}

Requirements:
- Extract ALL dates and time references found in the documents
- Dates can be specific (2024-01-15) or general (2024, "1990s", "Q1 2024")
- Event types: "event" (single occurrence), "milestone" (important achievement), "period" (time span)
- Importance levels: "high" (critical events), "medium" (significant), "low" (minor)
- Sort events chronologically
- Include the source document for each event
- If no dates are found, extract any sequential or ordered events
- Aim for 10-30 events depending on content`;

      setProgress(30);

      const response = await processWithModel(apiKey, prompt);
      setProgress(80);

      if (!response) {
        throw new Error('No response from AI');
      }

      // Parse the JSON response
      let parsed: Timeline;
      try {
        let cleanResponse = response.trim();
        if (cleanResponse.startsWith('```json')) {
          cleanResponse = cleanResponse.slice(7);
        }
        if (cleanResponse.startsWith('```')) {
          cleanResponse = cleanResponse.slice(3);
        }
        if (cleanResponse.endsWith('```')) {
          cleanResponse = cleanResponse.slice(0, -3);
        }

        parsed = JSON.parse(cleanResponse.trim());
        parsed.generatedAt = new Date();
      } catch (parseError) {
        console.error('Failed to parse timeline:', parseError);
        throw new Error('Failed to parse AI response');
      }

      setProgress(100);
      setTimeline(parsed);
      toast.success('Timeline generated!');

    } catch (error) {
      console.error('Timeline generation failed:', error);
      toast.error('Failed to generate timeline');
    } finally {
      setIsGenerating(false);
    }
  }, [docsToUse, apiKey]);

  const filteredEvents = useMemo(() => {
    if (!timeline) return [];

    return timeline.events.filter(event => {
      const matchesImportance = filterImportance === 'all' || event.importance === filterImportance;
      const matchesType = filterType === 'all' || event.type === filterType;
      return matchesImportance && matchesType;
    });
  }, [timeline, filterImportance, filterType]);

  const exportTimeline = useCallback(() => {
    if (!timeline) return;

    let markdown = `# ${timeline.title}\n\n`;
    markdown += `*Generated: ${timeline.generatedAt.toLocaleString()}*\n\n`;
    markdown += `${timeline.description}\n\n`;
    markdown += `---\n\n`;

    timeline.events.forEach(event => {
      const importanceEmoji = event.importance === 'high' ? '🔴' :
                              event.importance === 'medium' ? '🟡' : '🟢';
      const typeEmoji = event.type === 'milestone' ? '🏆' :
                        event.type === 'period' ? '📅' : '📌';

      markdown += `## ${event.date} - ${event.title} ${importanceEmoji}${typeEmoji}\n\n`;
      markdown += `${event.description}\n\n`;
      if (event.sources.length > 0) {
        markdown += `*Sources: ${event.sources.join(', ')}*\n\n`;
      }
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Timeline exported!');
  }, [timeline]);

  const getImportanceStyle = (importance: string) => {
    switch (importance) {
      case 'high':
        return {
          dot: 'bg-red-500',
          line: 'border-red-500/50',
          badge: 'bg-red-500/20 text-red-400 border-red-500/30'
        };
      case 'medium':
        return {
          dot: 'bg-yellow-500',
          line: 'border-yellow-500/50',
          badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
        };
      default:
        return {
          dot: 'bg-emerald-500',
          line: 'border-emerald-500/50',
          badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'milestone': return 'fa-trophy';
      case 'period': return 'fa-calendar-days';
      default: return 'fa-circle-dot';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="war-room-modal w-full max-w-4xl mx-4 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <i className="fa fa-timeline text-purple-400"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold">Timeline Generator</h3>
              <p className="text-xs war-room-text-secondary">
                {docsToUse.length} document{docsToUse.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <button onClick={onClose} className="war-room-btn war-room-btn-icon-sm">
            <i className="fa fa-times"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 war-room-scrollbar">
          {!timeline ? (
            <div className="text-center py-8">
              {isGenerating ? (
                <div>
                  <i className="fa fa-spinner fa-spin text-4xl text-purple-400 mb-4"></i>
                  <p className="text-sm war-room-text-secondary mb-4">
                    Generating timeline...
                  </p>
                  <div className="w-48 mx-auto war-room-progress">
                    <div
                      className="war-room-progress-bar bg-gradient-to-r from-purple-500 to-pink-500"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs war-room-text-muted mt-2">
                    {progress < 30 && 'Scanning documents for dates...'}
                    {progress >= 30 && progress < 80 && 'Extracting chronological events...'}
                    {progress >= 80 && 'Organizing timeline...'}
                  </p>
                </div>
              ) : (
                <div>
                  <i className="fa fa-timeline text-4xl text-purple-400 mb-4"></i>
                  <p className="text-lg font-medium mb-2">Generate Timeline</p>
                  <p className="text-sm war-room-text-secondary mb-6 max-w-md mx-auto">
                    Extract dates and events from your documents to create a visual chronological timeline.
                  </p>
                  <div className="mb-6">
                    <p className="text-xs war-room-text-secondary mb-2">Documents to analyze:</p>
                    <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                      {docsToUse.slice(0, 5).map(doc => (
                        <span key={doc.id} className="war-room-badge text-xs">
                          {doc.title}
                        </span>
                      ))}
                      {docsToUse.length > 5 && (
                        <span className="war-room-badge text-xs">
                          +{docsToUse.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={generateTimeline}
                    disabled={docsToUse.length === 0}
                    className="war-room-btn war-room-btn-primary"
                  >
                    <i className="fa fa-sparkles mr-2"></i>
                    Generate Timeline
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Header info */}
              <div className="war-room-panel p-4 mb-4">
                <h4 className="font-bold text-lg mb-1">{timeline.title}</h4>
                <p className="text-sm war-room-text-secondary">{timeline.description}</p>
                <p className="text-xs war-room-text-muted mt-2">
                  {timeline.events.length} events extracted
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {/* View mode */}
                <div className="flex gap-1 war-room-panel-inset p-1 rounded-lg">
                  <button
                    onClick={() => setViewMode('vertical')}
                    className={`px-3 py-1 rounded text-xs transition-all ${
                      viewMode === 'vertical'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'war-room-text-secondary hover:text-purple-400'
                    }`}
                  >
                    <i className="fa fa-grip-lines-vertical mr-1"></i>
                    Vertical
                  </button>
                  <button
                    onClick={() => setViewMode('horizontal')}
                    className={`px-3 py-1 rounded text-xs transition-all ${
                      viewMode === 'horizontal'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'war-room-text-secondary hover:text-purple-400'
                    }`}
                  >
                    <i className="fa fa-grip-lines mr-1"></i>
                    Horizontal
                  </button>
                </div>

                {/* Importance filter */}
                <select
                  value={filterImportance}
                  onChange={(e) => setFilterImportance(e.target.value)}
                  className="war-room-select text-sm"
                >
                  <option value="all">All Importance</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                {/* Type filter */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="war-room-select text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="event">Events</option>
                  <option value="milestone">Milestones</option>
                  <option value="period">Periods</option>
                </select>
              </div>

              {/* Timeline */}
              {viewMode === 'vertical' ? (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500/50 via-pink-500/50 to-purple-500/50"></div>

                  <div className="space-y-4">
                    {filteredEvents.map((event, i) => {
                      const style = getImportanceStyle(event.importance);
                      return (
                        <div key={i} className="relative pl-10">
                          {/* Dot */}
                          <div className={`absolute left-2.5 top-2 w-3 h-3 rounded-full ${style.dot} ring-4 ring-gray-900`}></div>

                          <div className="war-room-panel-inset p-4">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div>
                                <p className="text-xs text-purple-400 font-mono mb-1">{event.date}</p>
                                <p className="font-medium flex items-center gap-2">
                                  <i className={`fa ${getTypeIcon(event.type)} text-sm war-room-text-secondary`}></i>
                                  {event.title}
                                </p>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded border ${style.badge}`}>
                                {event.importance}
                              </span>
                            </div>
                            <p className="text-sm war-room-text-secondary">{event.description}</p>
                            {event.sources.length > 0 && (
                              <p className="text-xs war-room-text-muted mt-2">
                                <i className="fa fa-file-lines mr-1"></i>
                                {event.sources.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto pb-4">
                  <div className="flex gap-4 min-w-max">
                    {filteredEvents.map((event, i) => {
                      const style = getImportanceStyle(event.importance);
                      return (
                        <div key={i} className="relative">
                          {/* Connecting line */}
                          {i < filteredEvents.length - 1 && (
                            <div className="absolute top-5 left-full w-4 h-0.5 bg-gradient-to-r from-purple-500/50 to-pink-500/50"></div>
                          )}

                          <div className="war-room-panel-inset p-4 w-64">
                            {/* Dot */}
                            <div className={`w-3 h-3 rounded-full ${style.dot} mx-auto mb-3`}></div>

                            <p className="text-xs text-purple-400 font-mono text-center mb-1">{event.date}</p>
                            <p className="font-medium text-center text-sm mb-2 flex items-center justify-center gap-2">
                              <i className={`fa ${getTypeIcon(event.type)} text-xs war-room-text-secondary`}></i>
                              {event.title}
                            </p>
                            <p className="text-xs war-room-text-secondary text-center line-clamp-3">
                              {event.description}
                            </p>
                            <div className="flex justify-center mt-2">
                              <span className={`text-xs px-2 py-0.5 rounded border ${style.badge}`}>
                                {event.importance}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredEvents.length === 0 && (
                <div className="text-center py-8 war-room-text-secondary">
                  <i className="fa fa-filter text-2xl mb-2"></i>
                  <p>No events match your filters</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between shrink-0">
          <div className="text-xs war-room-text-secondary">
            {timeline && (
              <span>
                Showing {filteredEvents.length} of {timeline.events.length} events
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {timeline && (
              <>
                <button
                  onClick={() => setTimeline(null)}
                  className="war-room-btn text-sm"
                >
                  <i className="fa fa-refresh mr-2"></i>
                  Regenerate
                </button>
                <button
                  onClick={exportTimeline}
                  className="war-room-btn war-room-btn-primary text-sm"
                >
                  <i className="fa fa-download mr-2"></i>
                  Export
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineGenerator;
