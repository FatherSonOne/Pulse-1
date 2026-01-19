import { useState } from 'react';
import { useMultiModalIntelligence } from '../hooks/useMultiModalIntelligence';
import { UnifiedMessage, ChannelArtifact } from '../types';
import './ChannelExporter.css';

/**
 * Channel Exporter Component
 * Export channels to living specs (Google Docs, Markdown, HTML)
 */

type ExportFormat = 'markdown' | 'html' | 'google_docs';

export default function ChannelExporter() {
  const {
    unifiedMessages,
    artifacts,
    exportChannelToGoogleDocs,
    exportChannelToMarkdown,
    exportChannelToHtml,
    publishChannelArtifact,
    loading,
    error,
  } = useMultiModalIntelligence();

  const [channelName, setChannelName] = useState('Project Channel');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('markdown');
  const [previewContent, setPreviewContent] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<ChannelArtifact | null>(null);

  // Get unique channels from messages
  const channels = Array.from(
    new Set(unifiedMessages.map((msg) => msg.channelName))
  ).map((name) => ({
    name,
    messageCount: unifiedMessages.filter((msg) => msg.channelName === name).length,
  }));

  const handleExport = async () => {
    const channelMessages = unifiedMessages.filter(
      (msg) => msg.channelName === channelName
    );

    if (channelMessages.length === 0) {
      alert('No messages found for this channel');
      return;
    }

    try {
      if (selectedFormat === 'markdown') {
        const markdown = exportChannelToMarkdown(channelName, channelMessages);
        setPreviewContent(markdown);
        setShowPreview(true);
      } else if (selectedFormat === 'html') {
        const html = exportChannelToHtml(channelName, channelMessages);
        setPreviewContent(html);
        setShowPreview(true);
      } else if (selectedFormat === 'google_docs') {
        const artifact = await exportChannelToGoogleDocs(
          `channel-${Date.now()}`,
          channelName,
          channelMessages
        );
        setSelectedArtifact(artifact);
        alert(`Google Doc created! (Note: This is a placeholder - integrate with Google Docs API)`);
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([previewContent], {
      type: selectedFormat === 'html' ? 'text/html' : 'text/markdown',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${channelName.replace(/\s+/g, '-')}.${
      selectedFormat === 'html' ? 'html' : 'md'
    }`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePublish = (artifactId: string) => {
    publishChannelArtifact(artifactId);
    alert('Artifact published!');
  };

  return (
    <div className="channel-exporter">
      <div className="exporter-header">
        <h2>📤 Channel Exporter</h2>
        <p className="subtitle">Transform channels into living specifications</p>
      </div>

      {/* Export Configuration */}
      <div className="export-config">
        <div className="config-section">
          <label className="config-label">Channel Name</label>
          <select
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            className="config-select"
          >
            <option value="">Select a channel</option>
            {channels.length === 0 ? (
              <option disabled>No channels available</option>
            ) : (
              channels.map((channel) => (
                <option key={channel.name} value={channel.name}>
                  {channel.name} ({channel.messageCount} messages)
                </option>
              ))
            )}
          </select>
        </div>

        <div className="config-section">
          <label className="config-label">Export Format</label>
          <div className="format-options">
            <button
              className={`format-btn ${
                selectedFormat === 'markdown' ? 'active' : ''
              }`}
              onClick={() => setSelectedFormat('markdown')}
            >
              📝 Markdown
            </button>
            <button
              className={`format-btn ${selectedFormat === 'html' ? 'active' : ''}`}
              onClick={() => setSelectedFormat('html')}
            >
              🌐 HTML
            </button>
            <button
              className={`format-btn ${
                selectedFormat === 'google_docs' ? 'active' : ''
              }`}
              onClick={() => setSelectedFormat('google_docs')}
            >
              📄 Google Docs
            </button>
          </div>
        </div>

        <button onClick={handleExport} className="export-btn" disabled={loading}>
          {loading ? 'Exporting...' : '🚀 Export Channel'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="error-state">
          <p>❌ {error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="export-stats">
        <div className="stat-card-export">
          <div className="stat-value-export">{channels.length}</div>
          <div className="stat-label-export">Channels</div>
        </div>
        <div className="stat-card-export">
          <div className="stat-value-export">{unifiedMessages.length}</div>
          <div className="stat-label-export">Total Messages</div>
        </div>
        <div className="stat-card-export">
          <div className="stat-value-export">{artifacts.length}</div>
          <div className="stat-label-export">Artifacts</div>
        </div>
      </div>

      {/* Preview */}
      {showPreview && previewContent && (
        <div className="preview-section">
          <div className="preview-header">
            <h3>👁️ Preview</h3>
            <div className="preview-actions">
              <button onClick={handleDownload} className="download-btn">
                💾 Download
              </button>
              <button onClick={() => setShowPreview(false)} className="close-preview-btn">
                ✕ Close
              </button>
            </div>
          </div>

          <div className="preview-content">
            {selectedFormat === 'html' ? (
              <iframe
                srcDoc={previewContent}
                title="HTML Preview"
                className="html-preview"
              />
            ) : (
              <pre className="markdown-preview">{previewContent}</pre>
            )}
          </div>
        </div>
      )}

      {/* Artifacts List */}
      {artifacts.length > 0 && (
        <div className="artifacts-section">
          <h3>📦 Created Artifacts</h3>
          <div className="artifacts-list">
            {artifacts.map((artifact) => (
              <div key={artifact.id} className="artifact-card">
                <div className="artifact-header">
                  <span className="artifact-icon">
                    {artifact.exportFormat === 'google_docs' ? '📄' : '📝'}
                  </span>
                  <div className="artifact-info">
                    <div className="artifact-title">{artifact.title}</div>
                    <div className="artifact-meta">
                      <span>{artifact.exportFormat.replace('_', ' ')}</span>
                      <span>•</span>
                      <span className={`artifact-status status-${artifact.status}`}>
                        {artifact.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="artifact-dates">
                  <div>Created: {new Date(artifact.createdAt).toLocaleString()}</div>
                  <div>Updated: {new Date(artifact.updatedAt).toLocaleString()}</div>
                </div>

                <div className="artifact-actions">
                  {artifact.externalLink && (
                    <a
                      href={artifact.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="artifact-link-btn"
                    >
                      🔗 Open Link
                    </a>
                  )}
                  {artifact.status === 'draft' && (
                    <button
                      onClick={() => handlePublish(artifact.id)}
                      className="publish-btn"
                    >
                      ✅ Publish
                    </button>
                  )}
                  {artifact.status === 'published' && (
                    <span className="published-badge">✨ Published</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features Info */}
      <div className="features-info">
        <h3>✨ What gets exported?</h3>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📋</div>
            <div className="feature-title">Decisions</div>
            <div className="feature-desc">
              Key decisions made in the channel with context
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">✅</div>
            <div className="feature-title">Tasks</div>
            <div className="feature-desc">
              Actionable items with assignees and due dates
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <div className="feature-title">Milestones</div>
            <div className="feature-desc">
              Project milestones with completion status
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">👥</div>
            <div className="feature-title">Participants</div>
            <div className="feature-desc">Team members and their roles</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📅</div>
            <div className="feature-title">Timeline</div>
            <div className="feature-desc">Chronological event history</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔗</div>
            <div className="feature-title">Resources</div>
            <div className="feature-desc">Links to documents and references</div>
          </div>
        </div>
      </div>
    </div>
  );
}
