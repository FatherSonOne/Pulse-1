import React, { useState } from 'react';
import { useWorkspace } from '../shared/WorkspaceContext';
import { messageSummarizationService, CatchUpSummary } from '../../../services/messageSummarizationService';
import ShareToChannelModal from '../shared/ShareToChannelModal';
import AILabProgress from '../shared/AILabProgress';
import AILabEmptyState from '../shared/AILabEmptyState';
import { useToast } from '../shared/AILabToast';
import './ChannelDigest.css';

import { AlertCircle, AlertTriangle, AlignLeft, ArrowLeft, Copy, Gavel, Inbox, ListChecks, MessageCircle, ScrollText, Send, Zap } from 'lucide-react';

function computeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const lower = text.toLowerCase();
  const pos = (lower.match(/resolved|shipped|completed|approved|launched|success|great|improved/g) || []).length;
  const neg = (lower.match(/blocked|failed|delayed|issue|problem|error|behind|critical/g) || []).length;
  if (pos > neg + 1) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

function getDigestMetrics(digest: CatchUpSummary) {
  return {
    actionItemsCount: digest.actionItems.length,
    decisionsCount: digest.decisonsMade.length,
    keyChangesCount: digest.keyChanges.length,
  };
}

interface ChannelDigestProps {
  onBack: () => void;
  apiKey: string;
}

const TIME_RANGES = [
  { label: 'Last 24 hours', hours: 24 },
  { label: 'Last 48 hours', hours: 48 },
  { label: 'Last week', hours: 168 },
];

const ChannelDigest: React.FC<ChannelDigestProps> = ({ onBack, apiKey }) => {
  const { teamChannels, currentUser } = useWorkspace();
  const { showToast, ToastComponent } = useToast();
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedHours, setSelectedHours] = useState(24);
  const [isGenerating, setIsGenerating] = useState(false);
  const [digest, setDigest] = useState<CatchUpSummary | null>(null);
  const [error, setError] = useState('');
  const [showShare, setShowShare] = useState(false);

  const selectedChannel = teamChannels.find(c => c.id === selectedChannelId);

  const generateDigest = async () => {
    if (!selectedChannelId || !currentUser || !apiKey) return;

    setIsGenerating(true);
    setDigest(null);
    setError('');

    const sinceDate = new Date();
    sinceDate.setHours(sinceDate.getHours() - selectedHours);

    try {
      const result = await messageSummarizationService.generateCatchUpSummary(
        selectedChannelId,
        currentUser.id,
        sinceDate,
        apiKey
      );
      setDigest(result);
    } catch (err) {
      setError('Failed to generate digest. Check your API key and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getShareContent = () => {
    if (!digest || !selectedChannel) return '';
    const range = TIME_RANGES.find(r => r.hours === selectedHours);
    const lines = [
      `**#${selectedChannel.name} Digest** | ${range?.label}`,
      '',
      `**Summary:** ${digest.summary}`,
      '',
    ];
    if (digest.keyChanges.length > 0) {
      lines.push('**Key Changes:**');
      digest.keyChanges.forEach(c => lines.push(`• ${c}`));
      lines.push('');
    }
    if (digest.actionItems.length > 0) {
      lines.push('**Action Items:**');
      digest.actionItems.forEach(a => lines.push(`• ${a}`));
      lines.push('');
    }
    if (digest.decisonsMade.length > 0) {
      lines.push('**Decisions Made:**');
      digest.decisonsMade.forEach(d => lines.push(`• ${d}`));
    }
    return lines.join('\n');
  };

  return (
    <div className="channel-digest">
      {/* Header */}
      <div className="cd-header">
        <div className="cd-header-left">
          <button type="button" onClick={onBack} className="cd-back-btn" aria-label="Go back">
            <ArrowLeft />
          </button>
          <div className="cd-branding">
            <MessageCircle />
            <span>Channel Digest</span>
          </div>
          <span className="cd-subtitle">Catch-Up Summaries</span>
        </div>
        {digest && (
          <div className="cd-header-right">
            <button
              type="button"
              className="cd-btn cd-btn-secondary"
              onClick={() => { navigator.clipboard.writeText(getShareContent()); showToast('Digest copied!', 'success'); }}
              title="Copy digest"
            >
              <Copy />
              Copy
            </button>
            {teamChannels.length > 0 && currentUser && (
              <button
                type="button"
                className="cd-btn cd-btn-primary"
                onClick={() => setShowShare(true)}
              >
                <Send />
                Share to Channel
              </button>
            )}
          </div>
        )}
      </div>

      <div className="cd-body">
        {/* Setup Panel */}
        <div className="cd-setup">
          <div className="cd-setup-inner">
            <div className="cd-setup-icon">
              <MessageCircle />
            </div>
            <h2>Channel Catch-Up</h2>
            <p>Select a channel and time range to get an AI-powered summary of everything you missed.</p>

            <div className="cd-field">
              <label htmlFor="cd-channel">Channel</label>
              {teamChannels.length === 0 ? (
                <p className="cd-empty">No channels found. Channels appear here once your workspace is connected.</p>
              ) : (
                <select
                  id="cd-channel"
                  value={selectedChannelId}
                  onChange={e => setSelectedChannelId(e.target.value)}
                >
                  <option value="">— Choose a channel —</option>
                  {teamChannels.map(ch => (
                    <option key={ch.id} value={ch.id}>#{ch.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="cd-field">
              <label>Time Range</label>
              <div className="cd-time-options">
                {TIME_RANGES.map(range => (
                  <button
                    type="button"
                    key={range.hours}
                    className={`cd-time-btn ${selectedHours === range.hours ? 'active' : ''}`}
                    onClick={() => setSelectedHours(range.hours)}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="cd-btn cd-btn-primary cd-btn-generate"
              onClick={generateDigest}
              disabled={!selectedChannelId || isGenerating || !apiKey || !currentUser}
            >
              <i className={`fa-solid ${isGenerating ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
              {isGenerating ? 'Generating...' : 'Generate Digest'}
            </button>
            {isGenerating && (
              <AILabProgress
                label="Summarizing messages..."
                accentColor="#818cf8"
                accentRgb="129, 140, 248"
                size="sm"
              />
            )}

            {!apiKey && (
              <p className="cd-warning">
                <AlertTriangle />
                Gemini API key required. Add it in Settings.
              </p>
            )}
          </div>
        </div>

        {/* Results Panel */}
        {(digest || error) && (
          <div className="cd-results">
            {error ? (
              <div className="cd-error">
                <AlertCircle />
                <p>{error}</p>
              </div>
            ) : digest && (
              <>
                <div className="cd-results-header">
                  <h3>
                    <ScrollText />
                    #{selectedChannel?.name} — {TIME_RANGES.find(r => r.hours === selectedHours)?.label}
                  </h3>
                  <div className="cd-results-meta">
                    <span className="cd-message-count">{digest.messageCount} messages summarized</span>
                    {(() => {
                      const sentiment = computeSentiment(digest.summary);
                      const icons = { positive: 'fa-face-smile', neutral: 'fa-face-meh', negative: 'fa-face-frown' };
                      const labels = { positive: 'Positive', neutral: 'Neutral', negative: 'Concerns' };
                      return (
                        <span className={`cd-sentiment cd-sentiment-${sentiment}`}>
                          <i className={`fa-solid ${icons[sentiment]}`}></i>
                          {labels[sentiment]}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Metrics strip */}
                {(() => {
                  const m = getDigestMetrics(digest);
                  return (
                    <div className="cd-metrics-strip">
                      <div className="cd-metric-tile">
                        <ListChecks />
                        <span className="cd-metric-value">{m.actionItemsCount}</span>
                        <span className="cd-metric-label">Actions</span>
                      </div>
                      <div className="cd-metric-tile">
                        <Gavel />
                        <span className="cd-metric-value">{m.decisionsCount}</span>
                        <span className="cd-metric-label">Decisions</span>
                      </div>
                      <div className="cd-metric-tile">
                        <Zap />
                        <span className="cd-metric-value">{m.keyChangesCount}</span>
                        <span className="cd-metric-label">Key Changes</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="cd-summary-card">
                  <AlignLeft />
                  <p>{digest.summary}</p>
                </div>

                {digest.keyChanges.length > 0 && (
                  <div className="cd-section">
                    <h4><Zap /> Key Changes</h4>
                    <ul className="cd-list">
                      {digest.keyChanges.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {digest.actionItems.length > 0 && (
                  <div className="cd-section cd-section-actions">
                    <h4><ListChecks /> Action Items</h4>
                    <ul className="cd-list">
                      {digest.actionItems.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {digest.decisonsMade.length > 0 && (
                  <div className="cd-section cd-section-decisions">
                    <h4><Gavel /> Decisions Made</h4>
                    <ul className="cd-list">
                      {digest.decisonsMade.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {digest.messageCount === 0 && (
                  <div className="cd-no-messages">
                    <Inbox />
                    <p>No messages in this channel for the selected time range.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!digest && !error && !isGenerating && (
          <AILabEmptyState
            icon="fa-comment-dots"
            title="No digest yet"
            description="Select a channel and time range, then generate your digest."
            accentColor="#818cf8"
            accentRgb="129, 140, 248"
          />
        )}
      </div>

      {showShare && digest && (
        <ShareToChannelModal
          title={`#${selectedChannel?.name} Digest`}
          content={getShareContent()}
          onClose={() => setShowShare(false)}
        />
      )}
      {ToastComponent}
    </div>
  );
};

export default ChannelDigest;
