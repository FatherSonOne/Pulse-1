// VoxMeetingNotes - AI-generated meeting notes from voice conversations
// Displays structured meeting notes with decisions, action items, and next steps

import React from 'react';
import {
  FileText,
  Calendar,
  Users,
  CheckSquare,
  TrendingUp,
  Lightbulb,
  Sparkles,
  Download,
  Copy,
} from 'lucide-react';
import { MeetingNotes } from '../../services/voxer/voxerAIService';

interface VoxMeetingNotesProps {
  notes: MeetingNotes;
  isDarkMode?: boolean;
  accentColor?: string;
  onClose?: () => void;
  onExport?: () => void;
  onCopy?: () => void;
}

export const VoxMeetingNotes: React.FC<VoxMeetingNotesProps> = ({
  notes,
  isDarkMode = false,
  accentColor = '#8B5CF6',
  onClose,
  onExport,
  onCopy,
}) => {
  const tc = {
    bg: isDarkMode ? 'bg-zinc-900' : 'bg-white',
    border: isDarkMode ? 'border-zinc-700' : 'border-zinc-200',
    text: isDarkMode ? 'text-white' : 'text-zinc-900',
    textSecondary: isDarkMode ? 'text-zinc-400' : 'text-zinc-600',
    textMuted: isDarkMode ? 'text-zinc-500' : 'text-zinc-400',
    cardBg: isDarkMode ? 'bg-zinc-800/50' : 'bg-zinc-50',
    hoverBg: isDarkMode ? 'hover:bg-zinc-700' : 'hover:bg-zinc-100',
  };

  return (
    <div className={`rounded-xl border ${tc.border} ${tc.bg} overflow-hidden shadow-lg max-w-2xl`}>
      {/* Header */}
      <div
        className="px-5 py-4 border-b"
        style={{
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}05)`,
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${accentColor}20` }}
            >
              <FileText className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${tc.text}`}>{notes.title}</h3>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1.5">
                  <Calendar className={`w-3.5 h-3.5 ${tc.textMuted}`} />
                  <span className={`text-xs ${tc.textMuted}`}>{notes.date}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className={`w-3.5 h-3.5 ${tc.textMuted}`} />
                  <span className={`text-xs ${tc.textMuted}`}>
                    {notes.participants.join(', ')}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onCopy && (
              <button
                onClick={onCopy}
                className={`p-2 rounded-lg transition-colors ${tc.hoverBg}`}
                title="Copy to clipboard"
              >
                <Copy className={`w-4 h-4 ${tc.textSecondary}`} />
              </button>
            )}
            {onExport && (
              <button
                onClick={onExport}
                className={`p-2 rounded-lg transition-colors ${tc.hoverBg}`}
                title="Export notes"
              >
                <Download className={`w-4 h-4 ${tc.textSecondary}`} />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" style={{ color: accentColor }} />
          <span className={`text-xs ${tc.textMuted}`}>AI-generated meeting notes</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-5">
        {/* Summary */}
        <div>
          <h4 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${tc.textMuted}`}>
            Summary
          </h4>
          <p className={`text-sm leading-relaxed ${tc.textSecondary}`}>
            {notes.summary}
          </p>
        </div>

        {/* Key Decisions */}
        {notes.keyDecisions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4" style={{ color: accentColor }} />
              <h4 className={`text-xs font-semibold uppercase tracking-wider ${tc.textMuted}`}>
                Key Decisions
              </h4>
            </div>
            <ul className="space-y-2.5">
              {notes.keyDecisions.map((decision, index) => (
                <li key={index} className={`flex items-start gap-3 p-3 rounded-lg ${tc.cardBg}`}>
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: `${accentColor}20`,
                      color: accentColor,
                    }}
                  >
                    {index + 1}
                  </div>
                  <span className={`text-sm ${tc.textSecondary} flex-1`}>{decision}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Items */}
        {notes.actionItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckSquare className="w-4 h-4" style={{ color: accentColor }} />
              <h4 className={`text-xs font-semibold uppercase tracking-wider ${tc.textMuted}`}>
                Action Items
              </h4>
            </div>
            <div className="space-y-2">
              {notes.actionItems.map((item, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${tc.border}`}
                  style={{
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ borderColor: accentColor }}
                    >
                      {/* Empty checkbox */}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${tc.text}`}>{item.task}</p>
                      {(item.assignee || item.dueDate) && (
                        <div className="flex items-center gap-3 mt-1.5">
                          {item.assignee && (
                            <span className={`text-xs ${tc.textMuted}`}>
                              👤 {item.assignee}
                            </span>
                          )}
                          {item.dueDate && (
                            <span className={`text-xs ${tc.textMuted}`}>
                              📅 {item.dueDate}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps */}
        {notes.nextSteps.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4" style={{ color: accentColor }} />
              <h4 className={`text-xs font-semibold uppercase tracking-wider ${tc.textMuted}`}>
                Next Steps
              </h4>
            </div>
            <ul className="space-y-2">
              {notes.nextSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: accentColor }}
                  />
                  <span className={`text-sm ${tc.textSecondary}`}>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoxMeetingNotes;
