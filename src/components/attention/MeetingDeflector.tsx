import { useState, useEffect } from 'react';
import {
  Calendar,
  Video,
  FileText,
  MessageSquare,
  Clock,
  Users,
  CheckCircle,
  X,
  Lightbulb,
  BarChart2,
  Send,
  ChevronRight,
  Zap
} from 'lucide-react';
import { detectMeetingIntent, AsyncSuggestion } from '../../services/geminiService';
import './MeetingDeflector.css';

interface MeetingDeflectorProps {
  messageText: string;
  apiKey: string;
  onAcceptSuggestion?: (type: AsyncSuggestion['type'], template: string) => void;
  onDismiss?: () => void;
  isMinimized?: boolean;
}

interface AsyncAlternative {
  type: 'poll' | 'video' | 'doc' | 'message';
  title: string;
  description: string;
  icon: React.ReactNode;
  template: string;
  timesSaved: string;
}

export const MeetingDeflector: React.FC<MeetingDeflectorProps> = ({
  messageText,
  apiKey,
  onAcceptSuggestion,
  onDismiss,
  isMinimized = false
}) => {
  const [suggestion, setSuggestion] = useState<AsyncSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [selectedAlternative, setSelectedAlternative] = useState<AsyncAlternative | null>(null);

  const alternatives: AsyncAlternative[] = [
    {
      type: 'poll',
      title: 'Quick Poll',
      description: 'Get team input with a simple vote',
      icon: <BarChart2 size={20} />,
      template: `Let's gather input quickly with a poll:\n\n📊 [Your Question Here]\n\nOptions:\n1. Option A\n2. Option B\n3. Option C\n\nPlease vote by replying with your choice number!`,
      timesSaved: '~30 min'
    },
    {
      type: 'video',
      title: 'Async Video',
      description: 'Record a quick Loom or video update',
      icon: <Video size={20} />,
      template: `I'll record a quick video update instead of scheduling a meeting.\n\n🎥 Video will cover:\n• Key points\n• Any decisions needed\n• Next steps\n\nI'll share the link here once recorded. Please watch when convenient and reply with any questions!`,
      timesSaved: '~45 min'
    },
    {
      type: 'doc',
      title: 'Shared Document',
      description: 'Collaborate async in a shared doc',
      icon: <FileText size={20} />,
      template: `Let's work through this asynchronously in a shared doc:\n\n📝 Document: [Link]\n\nPlease:\n1. Review the current content\n2. Add your comments/suggestions\n3. Tag me when you're done\n\nDeadline for input: [Date]`,
      timesSaved: '~1 hour'
    },
    {
      type: 'message',
      title: 'Threaded Discussion',
      description: 'Start an organized async thread',
      icon: <MessageSquare size={20} />,
      template: `Let's discuss this asynchronously in this thread:\n\n💬 Topic: [Topic Name]\n\n**Background:**\n[Brief context]\n\n**Questions to address:**\n1. [Question 1]\n2. [Question 2]\n\n**Decision needed by:** [Date]\n\nPlease share your thoughts below!`,
      timesSaved: '~30 min'
    }
  ];

  useEffect(() => {
    if (messageText && messageText.length > 10 && apiKey) {
      checkForMeetingIntent();
    } else {
      setSuggestion(null);
    }
  }, [messageText, apiKey]);

  const checkForMeetingIntent = async () => {
    setLoading(true);
    try {
      const result = await detectMeetingIntent(apiKey, messageText);
      if (result && result.detected) {
        setSuggestion(result);
        setDismissed(false);
      } else {
        setSuggestion(null);
      }
    } catch (error) {
      console.error('Error detecting meeting intent:', error);
      setSuggestion(null);
    }
    setLoading(false);
  };

  const handleAcceptSuggestion = (alt: AsyncAlternative) => {
    setSelectedAlternative(alt);
    onAcceptSuggestion?.(alt.type as AsyncSuggestion['type'], alt.template);
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed || !suggestion) {
    return null;
  }

  if (loading) {
    return (
      <div className="meeting-deflector loading">
        <div className="loading-indicator">
          <Zap className="zap-icon" />
          <span>Analyzing message...</span>
        </div>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <button
        className="meeting-deflector-minimized"
        onClick={() => setShowAlternatives(true)}
      >
        <Lightbulb size={16} />
        <span>Async alternative available</span>
        <ChevronRight size={14} />
      </button>
    );
  }

  return (
    <div className="meeting-deflector">
      <div className="deflector-header">
        <div className="deflector-icon">
          <Lightbulb size={20} />
        </div>
        <div className="deflector-title">
          <h4>Consider an Async Alternative</h4>
          <p>{suggestion.reason}</p>
        </div>
        <button className="btn-dismiss" onClick={handleDismiss}>
          <X size={16} />
        </button>
      </div>

      {!showAlternatives ? (
        <div className="primary-suggestion">
          <div className="suggestion-card" onClick={() => setShowAlternatives(true)}>
            <div className="suggestion-icon">
              {suggestion.type === 'poll' && <BarChart2 size={24} />}
              {suggestion.type === 'video' && <Video size={24} />}
              {suggestion.type === 'doc' && <FileText size={24} />}
            </div>
            <div className="suggestion-content">
              <h5>
                {suggestion.type === 'poll' && 'Create a Quick Poll'}
                {suggestion.type === 'video' && 'Send an Async Video'}
                {suggestion.type === 'doc' && 'Use a Shared Document'}
              </h5>
              <p>Click to see this and other async options</p>
            </div>
            <ChevronRight size={20} />
          </div>

          <div className="time-saved-badge">
            <Clock size={14} />
            <span>Save everyone ~30-60 min</span>
          </div>
        </div>
      ) : (
        <div className="alternatives-panel">
          <h5>Choose an Async Alternative</h5>
          <div className="alternatives-grid">
            {alternatives.map((alt) => (
              <div
                key={alt.type}
                className={`alternative-card ${selectedAlternative?.type === alt.type ? 'selected' : ''}`}
                onClick={() => handleAcceptSuggestion(alt)}
              >
                <div className="alt-header">
                  <div className="alt-icon">{alt.icon}</div>
                  <div className="time-badge">{alt.timesSaved}</div>
                </div>
                <h6>{alt.title}</h6>
                <p>{alt.description}</p>
                {selectedAlternative?.type === alt.type && (
                  <CheckCircle className="selected-icon" size={20} />
                )}
              </div>
            ))}
          </div>

          {selectedAlternative && (
            <div className="template-preview">
              <h5>Template Preview</h5>
              <div className="template-content">
                <pre>{selectedAlternative.template}</pre>
              </div>
              <div className="template-actions">
                <button
                  className="btn-use-template"
                  onClick={() => onAcceptSuggestion?.(
                    selectedAlternative.type as AsyncSuggestion['type'],
                    selectedAlternative.template
                  )}
                >
                  <Send size={16} />
                  Use This Template
                </button>
              </div>
            </div>
          )}

          <button
            className="btn-show-less"
            onClick={() => setShowAlternatives(false)}
          >
            Show Less
          </button>
        </div>
      )}

      <div className="deflector-footer">
        <div className="stats">
          <Users size={14} />
          <span>Async-first teams save 5+ hours/week</span>
        </div>
      </div>
    </div>
  );
};

// Inline suggestion for message composer
export const InlineMeetingDeflector: React.FC<{
  detected: boolean;
  type: AsyncSuggestion['type'];
  onApply: () => void;
}> = ({ detected, type, onApply }) => {
  if (!detected) return null;

  return (
    <div className="inline-meeting-deflector">
      <Lightbulb size={14} />
      <span>
        This looks like a meeting request.
        Consider using {type === 'poll' ? 'a poll' : type === 'video' ? 'async video' : 'a shared doc'} instead?
      </span>
      <button onClick={onApply}>Apply</button>
    </div>
  );
};
