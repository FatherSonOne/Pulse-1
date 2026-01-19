import { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  ExternalLink,
  RefreshCw,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Clock,
  Users,
  CheckCircle,
  Target,
  Calendar,
  Sparkles,
  Edit2,
  Save,
  X,
  BookOpen,
  Share2
} from 'lucide-react';
import { generateChannelArtifact } from '../../services/geminiService';
import { ChannelArtifact as ChannelArtifactType, Message } from '../../types';
import './ChannelArtifact.css';

interface ChannelArtifactProps {
  channelId: string;
  channelName: string;
  messages: Message[];
  apiKey: string;
  onExport?: (artifact: ChannelArtifactType, format: ChannelArtifactType['exportFormat']) => void;
}

export const ChannelArtifactComponent: React.FC<ChannelArtifactProps> = ({
  channelId,
  channelName,
  messages,
  apiKey,
  onExport
}) => {
  const [artifact, setArtifact] = useState<ChannelArtifactType | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview', 'spec', 'decisions', 'milestones'])
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');

  const generateArtifact = async () => {
    if (!apiKey || messages.length === 0) return;

    setLoading(true);
    try {
      const history = messages
        .map((m) => `[${m.sender}] ${new Date(m.timestamp).toLocaleString()}: ${m.text}`)
        .join('\n');

      const result = await generateChannelArtifact(apiKey, history, channelName);

      if (result) {
        const fullArtifact: ChannelArtifactType = {
          id: `artifact-${channelId}-${Date.now()}`,
          ...result,
          channelId,
          channelName,
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setArtifact(fullArtifact);
      }
    } catch (error) {
      console.error('Error generating artifact:', error);
    }
    setLoading(false);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const handleEdit = (section: string, value: string) => {
    setEditing(section);
    setEditValue(value);
  };

  const handleSaveEdit = () => {
    if (!artifact || !editing) return;

    const updatedArtifact = { ...artifact };
    switch (editing) {
      case 'title':
        updatedArtifact.title = editValue;
        break;
      case 'overview':
        updatedArtifact.overview = editValue;
        break;
      case 'spec':
        updatedArtifact.spec = editValue;
        break;
    }
    updatedArtifact.updatedAt = new Date();
    setArtifact(updatedArtifact);
    setEditing(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  const handleExport = async (format: ChannelArtifactType['exportFormat']) => {
    if (!artifact) return;

    setExportStatus('exporting');
    try {
      onExport?.(artifact, format);
      setArtifact({
        ...artifact,
        exportFormat: format,
        status: 'exported',
        updatedAt: new Date()
      });
      setExportStatus('success');
      setTimeout(() => {
        setExportStatus('idle');
        setShowExportMenu(false);
      }, 2000);
    } catch (error) {
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const copyToClipboard = async () => {
    if (!artifact) return;

    const content = `# ${artifact.title}

## Overview
${artifact.overview}

## Specification
${artifact.spec}

## Decisions
${artifact.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

## Milestones
${artifact.milestones.map((m, i) => `${i + 1}. ${m}`).join('\n')}

---
Generated from channel: ${artifact.channelName}
Date: ${artifact.updatedAt?.toLocaleString()}
`;

    await navigator.clipboard.writeText(content);
  };

  const exportFormats: { format: ChannelArtifactType['exportFormat']; label: string; icon: React.ReactNode }[] = [
    { format: 'markdown', label: 'Markdown (.md)', icon: <FileText size={16} /> },
    { format: 'html', label: 'HTML Document', icon: <FileText size={16} /> },
    { format: 'google_docs', label: 'Google Docs', icon: <ExternalLink size={16} /> },
    { format: 'notion', label: 'Notion Page', icon: <ExternalLink size={16} /> },
    { format: 'pdf', label: 'PDF Document', icon: <Download size={16} /> }
  ];

  if (!artifact && !loading) {
    return (
      <div className="channel-artifact empty">
        <div className="empty-content">
          <BookOpen size={48} />
          <h3>Create Living Document</h3>
          <p>Transform this channel's conversation into a structured, exportable document</p>
          <button className="btn-generate" onClick={generateArtifact}>
            <Sparkles size={18} />
            Generate Artifact
          </button>
        </div>
        <div className="feature-list">
          <div className="feature">
            <CheckCircle size={16} />
            <span>Extracts decisions and milestones</span>
          </div>
          <div className="feature">
            <FileText size={16} />
            <span>Creates structured specification</span>
          </div>
          <div className="feature">
            <Share2 size={16} />
            <span>Export to Docs, Notion, or PDF</span>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="channel-artifact loading">
        <RefreshCw size={32} className="spinning" />
        <h3>Generating Artifact...</h3>
        <p>Analyzing conversation and extracting key information</p>
      </div>
    );
  }

  return (
    <div className="channel-artifact">
      {/* Header */}
      <div className="artifact-header">
        <div className="header-title">
          {editing === 'title' ? (
            <div className="edit-inline">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
              />
              <button onClick={handleSaveEdit}><Check size={16} /></button>
              <button onClick={handleCancelEdit}><X size={16} /></button>
            </div>
          ) : (
            <>
              <h2>{artifact?.title}</h2>
              <button
                className="btn-edit"
                onClick={() => handleEdit('title', artifact?.title || '')}
              >
                <Edit2 size={14} />
              </button>
            </>
          )}
        </div>

        <div className="header-actions">
          <button className="btn-copy" onClick={copyToClipboard}>
            <Copy size={16} />
            Copy
          </button>
          <button className="btn-refresh" onClick={generateArtifact}>
            <RefreshCw size={16} />
            Regenerate
          </button>
          <div className="export-dropdown">
            <button
              className="btn-export"
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              <Download size={16} />
              Export
              <ChevronDown size={14} />
            </button>
            {showExportMenu && (
              <div className="export-menu">
                {exportFormats.map(({ format, label, icon }) => (
                  <button
                    key={format}
                    onClick={() => handleExport(format)}
                    disabled={exportStatus === 'exporting'}
                  >
                    {icon}
                    <span>{label}</span>
                    {artifact?.exportFormat === format && artifact?.status === 'exported' && (
                      <Check size={14} className="check-icon" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meta Info */}
      <div className="artifact-meta">
        <div className="meta-item">
          <Calendar size={14} />
          <span>Created {artifact?.createdAt?.toLocaleDateString()}</span>
        </div>
        <div className="meta-item">
          <Clock size={14} />
          <span>Updated {artifact?.updatedAt?.toLocaleTimeString()}</span>
        </div>
        <div className="meta-item">
          <Users size={14} />
          <span>{channelName}</span>
        </div>
        {artifact?.status && (
          <div className={`status-badge status-${artifact.status}`}>
            {artifact.status}
          </div>
        )}
      </div>

      {/* Content Sections */}
      <div className="artifact-content">
        {/* Overview Section */}
        <div className="artifact-section">
          <button
            className="section-header"
            onClick={() => toggleSection('overview')}
          >
            <Target size={18} />
            <span>Overview</span>
            {expandedSections.has('overview') ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </button>
          {expandedSections.has('overview') && (
            <div className="section-content">
              {editing === 'overview' ? (
                <div className="edit-block">
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={4}
                  />
                  <div className="edit-actions">
                    <button onClick={handleSaveEdit}><Save size={14} /> Save</button>
                    <button onClick={handleCancelEdit}><X size={14} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="editable-content">
                  <p>{artifact?.overview}</p>
                  <button
                    className="btn-edit-inline"
                    onClick={() => handleEdit('overview', artifact?.overview || '')}
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Specification Section */}
        <div className="artifact-section">
          <button
            className="section-header"
            onClick={() => toggleSection('spec')}
          >
            <FileText size={18} />
            <span>Specification</span>
            {expandedSections.has('spec') ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </button>
          {expandedSections.has('spec') && (
            <div className="section-content spec-content">
              {editing === 'spec' ? (
                <div className="edit-block">
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={10}
                  />
                  <div className="edit-actions">
                    <button onClick={handleSaveEdit}><Save size={14} /> Save</button>
                    <button onClick={handleCancelEdit}><X size={14} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="editable-content markdown-content">
                  <pre>{artifact?.spec}</pre>
                  <button
                    className="btn-edit-inline"
                    onClick={() => handleEdit('spec', artifact?.spec || '')}
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Decisions Section */}
        <div className="artifact-section">
          <button
            className="section-header"
            onClick={() => toggleSection('decisions')}
          >
            <CheckCircle size={18} />
            <span>Decisions ({artifact?.decisions.length})</span>
            {expandedSections.has('decisions') ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </button>
          {expandedSections.has('decisions') && (
            <div className="section-content">
              <ul className="decision-list">
                {artifact?.decisions.map((decision, i) => (
                  <li key={i}>
                    <CheckCircle size={14} className="decision-icon" />
                    <span>{decision}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Milestones Section */}
        <div className="artifact-section">
          <button
            className="section-header"
            onClick={() => toggleSection('milestones')}
          >
            <Target size={18} />
            <span>Milestones ({artifact?.milestones.length})</span>
            {expandedSections.has('milestones') ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </button>
          {expandedSections.has('milestones') && (
            <div className="section-content">
              <ul className="milestone-list">
                {artifact?.milestones.map((milestone, i) => (
                  <li key={i}>
                    <div className="milestone-marker">{i + 1}</div>
                    <span>{milestone}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Export Status Toast */}
      {exportStatus !== 'idle' && (
        <div className={`export-toast status-${exportStatus}`}>
          {exportStatus === 'exporting' && (
            <>
              <RefreshCw size={16} className="spinning" />
              <span>Exporting...</span>
            </>
          )}
          {exportStatus === 'success' && (
            <>
              <Check size={16} />
              <span>Exported successfully!</span>
            </>
          )}
          {exportStatus === 'error' && (
            <>
              <X size={16} />
              <span>Export failed</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
