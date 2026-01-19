import { useState } from 'react';
import UnifiedInbox from './UnifiedInbox';
import VoiceRecorderGemini from './VoiceRecorderGemini';
import ChannelExporter from './ChannelExporter';
import './MultiModalDemo.css';

/**
 * Multi-Modal Intelligence Demo Page
 * Showcases all three features in tabbed interface
 */

type TabType = 'inbox' | 'voice' | 'export';

interface MultiModalDemoProps {
  apiKey: string;
}

export default function MultiModalDemo({ apiKey }: MultiModalDemoProps) {
  const [activeTab, setActiveTab] = useState<TabType>('inbox');

  return (
    <div className="multi-modal-demo">
      {/* Hero Section */}
      <div className="hero-section">
        <h1 className="hero-title">🚀 Multi-Modal Intelligence</h1>
        <p className="hero-subtitle">
          Unified inbox, voice transcription, and channel exports — all in one place
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'inbox' ? 'active' : ''}`}
          onClick={() => setActiveTab('inbox')}
        >
          <span className="tab-icon">📬</span>
          <div className="tab-content">
            <div className="tab-title">Unified Inbox</div>
            <div className="tab-desc">Aggregate messages from all platforms</div>
          </div>
        </button>

        <button
          className={`tab-btn ${activeTab === 'voice' ? 'active' : ''}`}
          onClick={() => setActiveTab('voice')}
        >
          <span className="tab-icon">🎙️</span>
          <div className="tab-content">
            <div className="tab-title">Voice Intelligence</div>
            <div className="tab-desc">Record, transcribe, and extract insights</div>
          </div>
        </button>

        <button
          className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          <span className="tab-icon">📤</span>
          <div className="tab-content">
            <div className="tab-title">Channel Exporter</div>
            <div className="tab-desc">Transform channels into living specs</div>
          </div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content-area">
        {activeTab === 'inbox' && <UnifiedInbox />}
        {activeTab === 'voice' && <VoiceRecorderGemini apiKey={apiKey} />}
        {activeTab === 'export' && <ChannelExporter />}
      </div>

      {/* Footer */}
      <div className="demo-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>✨ Features</h4>
            <ul>
              <li>Cross-platform message aggregation</li>
              <li>Intelligent deduplication</li>
              <li>Voice-to-text transcription</li>
              <li>AI-powered task/decision extraction</li>
              <li>Export to Markdown, HTML, Google Docs</li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>🔌 Integrations</h4>
            <ul>
              <li>Slack</li>
              <li>Email (Gmail)</li>
              <li>SMS (Twilio)</li>
              <li>Discord</li>
              <li>Microsoft Teams</li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>🤖 AI Powered</h4>
            <ul>
              <li>Google Gemini for transcription</li>
              <li>Task extraction from voice</li>
              <li>Decision tracking</li>
              <li>Sentiment analysis</li>
              <li>Topic classification</li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>
            Built with React 19, TypeScript, Vite, and Google Gemini
          </p>
          <p className="footer-note">
            💡 Tip: Use the "Add Test Messages" button to see the features in action
          </p>
        </div>
      </div>
    </div>
  );
}
