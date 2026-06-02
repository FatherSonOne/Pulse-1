import React, { useState, useCallback, useMemo } from 'react';
import { KnowledgeDoc } from '../../../services/ragService';
import { processWithModel } from '../../../services/geminiService';
import { ProvenanceTag } from '../ProvenanceTag';
import toast from 'react-hot-toast';

import { Activity, CalendarDays, CircleDot, Download, FileText, Filter, GripHorizontal, GripVertical, Loader2, RefreshCw, Sparkles, Trophy, X } from 'lucide-react';

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

// Coral Cockpit tokens. WB-3 of docs/WAR_ROOM_STUDIO_RESKIN_HANDOFF_2026-06-02.md.
const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--pulse-font-mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const fieldStyle: React.CSSProperties = {
  background: 'var(--pulse-surface-raised)',
  color: 'var(--pulse-ink)',
  border: '1px solid var(--pulse-border)',
};

// Event type → Lucide (replaces the broken FontAwesome `<i>` glyphs).
const TypeIcon: React.FC<{ type: string; size?: number }> = ({ type, size = 14 }) => {
  if (type === 'milestone') return <Trophy size={size} />;
  if (type === 'period') return <CalendarDays size={size} />;
  return <CircleDot size={size} />;
};

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

      const response = await processWithModel(prompt);
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
      markdown += `## ${event.date} - ${event.title} [${event.importance.toUpperCase()} · ${event.type.toUpperCase()}]\n\n`;
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

  // Importance is a semantic scale; keep status tints (high red / med amber / low green).
  const getImportanceStyle = (importance: string): { dot: string; badge: React.CSSProperties } => {
    switch (importance) {
      case 'high':
        return { dot: '#ef4444', badge: { background: 'rgba(239,68,68,0.12)', color: '#ef4444' } };
      case 'medium':
        return { dot: '#f59e0b', badge: { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' } };
      default:
        return { dot: '#10b981', badge: { background: 'rgba(16,185,129,0.15)', color: '#10b981' } };
    }
  };

  const viewToggle = (active: boolean): React.CSSProperties =>
    active
      ? { background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }
      : { color: 'var(--pulse-ink-3)' };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div
        className="w-full max-w-4xl mx-4 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: 'var(--pulse-surface-modal)', border: '1px solid var(--pulse-border)' }}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--pulse-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }}>
              <Activity size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold" style={{ color: 'var(--pulse-ink)' }}>Timeline Generator</h3>
                {timeline && <ProvenanceTag model="GEMINI" kind="TIMELINE" />}
              </div>
              <p className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                {docsToUse.length} document{docsToUse.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--pulse-ink-3)' }} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!timeline ? (
            <div className="text-center py-8">
              {isGenerating ? (
                <div>
                  <Loader2 size={36} className="animate-spin mb-4 mx-auto" style={{ color: 'var(--pulse-coral-fg)' }} />
                  <p className="text-sm mb-4" style={{ color: 'var(--pulse-ink-3)' }}>
                    Generating timeline...
                  </p>
                  <div className="w-48 h-1.5 mx-auto rounded-full overflow-hidden" style={{ background: 'var(--pulse-surface-raised)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--pulse-rose)' }} />
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--pulse-ink-3)' }}>
                    {progress < 30 && 'Scanning documents for dates...'}
                    {progress >= 30 && progress < 80 && 'Extracting chronological events...'}
                    {progress >= 80 && 'Organizing timeline...'}
                  </p>
                </div>
              ) : (
                <div>
                  <Activity size={36} className="mb-4 mx-auto" style={{ color: 'var(--pulse-coral-fg)' }} />
                  <p className="text-lg font-medium mb-2" style={{ color: 'var(--pulse-ink)' }}>Generate Timeline</p>
                  <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--pulse-ink-3)' }}>
                    Extract dates and events from your documents to create a visual chronological timeline.
                  </p>
                  <div className="mb-6">
                    <p className="text-xs mb-2" style={{ ...monoLabel, color: 'var(--pulse-ink-3)' }}>Documents to analyze</p>
                    <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                      {docsToUse.slice(0, 5).map(doc => (
                        <span key={doc.id} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-2)' }}>
                          {doc.title}
                        </span>
                      ))}
                      {docsToUse.length > 5 && (
                        <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-2)' }}>
                          +{docsToUse.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={generateTimeline}
                    disabled={docsToUse.length === 0}
                    className="war-room-btn-primary px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center"
                  >
                    <Sparkles size={14} className="mr-2" />
                    Generate Timeline
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Header info */}
              <div className="p-4 mb-4 rounded-lg" style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}>
                <h4 className="font-bold text-lg mb-1" style={{ color: 'var(--pulse-ink)' }}>{timeline.title}</h4>
                <p className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>{timeline.description}</p>
                <p className="text-xs mt-2" style={{ color: 'var(--pulse-ink-3)' }}>
                  {timeline.events.length} events extracted
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {/* View mode */}
                <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--pulse-surface-raised)' }}>
                  <button
                    onClick={() => setViewMode('vertical')}
                    className="px-3 py-1 rounded text-xs transition-all inline-flex items-center"
                    style={viewToggle(viewMode === 'vertical')}
                  >
                    <GripVertical size={12} className="mr-1" />
                    Vertical
                  </button>
                  <button
                    onClick={() => setViewMode('horizontal')}
                    className="px-3 py-1 rounded text-xs transition-all inline-flex items-center"
                    style={viewToggle(viewMode === 'horizontal')}
                  >
                    <GripHorizontal size={12} className="mr-1" />
                    Horizontal
                  </button>
                </div>

                {/* Importance filter */}
                <select
                  value={filterImportance}
                  onChange={(e) => setFilterImportance(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={fieldStyle}
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
                  className="px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={fieldStyle}
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
                  <div className="absolute left-4 top-0 bottom-0 w-0.5" style={{ background: 'var(--pulse-border-strong)' }}></div>

                  <div className="space-y-4">
                    {filteredEvents.map((event, i) => {
                      const style = getImportanceStyle(event.importance);
                      return (
                        <div key={i} className="relative pl-10">
                          {/* Dot */}
                          <div className="absolute left-2.5 top-2 w-3 h-3 rounded-full" style={{ background: style.dot, boxShadow: '0 0 0 4px var(--pulse-surface)' }}></div>

                          <div className="p-4 rounded-lg" style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}>
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div>
                                <p className="text-xs mb-1" style={{ ...monoLabel, color: 'var(--pulse-coral-fg)' }}>{event.date}</p>
                                <p className="font-medium flex items-center gap-2" style={{ color: 'var(--pulse-ink)' }}>
                                  <span style={{ color: 'var(--pulse-ink-3)' }}><TypeIcon type={event.type} /></span>
                                  {event.title}
                                </p>
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded" style={style.badge}>
                                {event.importance}
                              </span>
                            </div>
                            <p className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>{event.description}</p>
                            {event.sources.length > 0 && (
                              <p className="text-xs mt-2 inline-flex items-center" style={{ color: 'var(--pulse-ink-3)' }}>
                                <FileText size={11} className="mr-1" />
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
                            <div className="absolute top-5 left-full w-4 h-0.5" style={{ background: 'var(--pulse-border-strong)' }}></div>
                          )}

                          <div className="p-4 w-64 rounded-lg" style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}>
                            {/* Dot */}
                            <div className="w-3 h-3 rounded-full mx-auto mb-3" style={{ background: style.dot }}></div>

                            <p className="text-xs text-center mb-1" style={{ ...monoLabel, color: 'var(--pulse-coral-fg)' }}>{event.date}</p>
                            <p className="font-medium text-center text-sm mb-2 flex items-center justify-center gap-2" style={{ color: 'var(--pulse-ink)' }}>
                              <span style={{ color: 'var(--pulse-ink-3)' }}><TypeIcon type={event.type} size={12} /></span>
                              {event.title}
                            </p>
                            <p className="text-xs text-center line-clamp-3" style={{ color: 'var(--pulse-ink-2)' }}>
                              {event.description}
                            </p>
                            <div className="flex justify-center mt-2">
                              <span className="text-xs px-2 py-0.5 rounded" style={style.badge}>
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
                <div className="text-center py-8" style={{ color: 'var(--pulse-ink-3)' }}>
                  <Filter size={22} className="mb-2 mx-auto" />
                  <p>No events match your filters</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 flex items-center justify-between shrink-0" style={{ borderTop: '1px solid var(--pulse-border)' }}>
          <div className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
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
                  className="px-3 py-2 rounded-lg text-sm inline-flex items-center transition-colors"
                  style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink)' }}
                >
                  <RefreshCw size={14} className="mr-2" />
                  Regenerate
                </button>
                <button
                  onClick={exportTimeline}
                  className="war-room-btn-primary px-3 py-2 rounded-lg text-sm inline-flex items-center"
                >
                  <Download size={14} className="mr-2" />
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
