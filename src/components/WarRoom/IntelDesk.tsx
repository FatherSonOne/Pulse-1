/**
 * IntelDesk — Phase 2: Source Library Panel
 *
 * The left panel of WarRoomLayout. Shows all ingested documents as "Intel Assets"
 * with toggle switches to control which sources are active in the AI context.
 *
 * Features:
 *  - Source cards: type icon, title, status beacon, toggle, summary
 *  - In-progress upload progress bars
 *  - Filter/search bar
 *  - Add-all / clear-all context shortcuts
 *  - Notebook Guide section (AI question generation — Phase 4)
 */

import React, { useState, useRef } from 'react';
import { KnowledgeDoc } from '../../services/ragService';
import { WarRoomMode } from './ModeSwitcher';

import { Database, Eye, Plus, Satellite, Trash2, Upload } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntelDeskProps {
  documents: KnowledgeDoc[];
  activeContextDocs: Set<string>;
  uploadingFiles: Set<string>;
  uploadProgress: Map<string, number>;
  onToggleDoc: (id: string) => void;
  onDeleteDoc: (id: string) => void;
  onViewDoc: (id: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddAllDocs: () => void;
  onClearAllDocs: () => void;
  /** Phase 10: mode-aware status banner */
  currentMode?: WarRoomMode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFileIcon(fileType: string): { icon: string; color: string } {
  const t = (fileType || '').toLowerCase();
  if (t.includes('pdf'))  return { icon: 'fa-file-pdf',   color: '#ef4444' };
  if (t.includes('doc'))  return { icon: 'fa-file-word',  color: '#3b82f6' };
  if (t.includes('xls'))  return { icon: 'fa-file-excel', color: '#10b981' };
  if (t.includes('png') || t.includes('jpg') || t.includes('jpeg') || t.includes('gif') || t.includes('image'))
                           return { icon: 'fa-file-image', color: '#8b5cf6' };
  if (t.includes('url') || t.includes('http'))
                           return { icon: 'fa-link',       color: '#06b6d4' };
  if (t.includes('txt') || t.includes('text'))
                           return { icon: 'fa-file-lines', color: '#71717a' };
  return { icon: 'fa-file', color: '#71717a' };
}

function statusInfo(status?: string): { label: string; color: string; pulse: boolean } {
  switch (status) {
    case 'completed':  return { label: 'Ready',      color: '#10b981', pulse: false };
    case 'processing': return { label: 'Processing', color: '#f59e0b', pulse: true  };
    case 'failed':     return { label: 'Failed',     color: '#ef4444', pulse: false };
    default:           return { label: 'Pending',    color: '#71717a', pulse: false };
  }
}

// ─── SourceCard ───────────────────────────────────────────────────────────────

const SourceCard: React.FC<{
  doc: KnowledgeDoc;
  isActive: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onView: () => void;
}> = ({ doc, isActive, onToggle, onDelete, onView }) => {
  const [expanded, setExpanded] = useState(false);
  const { icon, color } = getFileIcon(doc.file_type);
  const { label, color: sColor, pulse } = statusInfo(doc.processing_status);
  const isReady = doc.processing_status === 'completed';
  const summary = doc.ai_summary || doc.summary;

  return (
    <div
      style={{
        padding: '9px 12px',
        borderBottom: '1px solid var(--wr-border)',
        backgroundColor: isActive ? 'rgba(6,182,212,0.05)' : 'transparent',
        transition: 'background var(--wr-transition-fast)',
      }}
    >
      {/* Row 1: icon · title · actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <i
          className={`fa ${icon}`}
          style={{ fontSize: 13, color, flexShrink: 0, width: 14, textAlign: 'center' }}
        />

        {/* Title + status */}
        <div
          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
          onClick={() => setExpanded((v) => !v)}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--wr-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {doc.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            {/* Status beacon */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontFamily: 'var(--wr-font-mono)',
                fontSize: 9,
                color: sColor,
                letterSpacing: '0.06em',
              }}
            >
              <span
                className={pulse ? 'wr-data-pulse' : ''}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  backgroundColor: sColor,
                  display: 'inline-block',
                  boxShadow: isReady ? `0 0 4px ${sColor}` : 'none',
                }}
              />
              {label}
            </span>
            {/* Keywords */}
            {doc.ai_keywords && doc.ai_keywords.length > 0 && (
              <span
                style={{
                  fontSize: 9,
                  color: 'var(--wr-text-muted)',
                  fontFamily: 'var(--wr-font-mono)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 80,
                }}
              >
                {doc.ai_keywords.slice(0, 2).join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Toggle switch */}
        <button
          onClick={onToggle}
          disabled={!isReady}
          title={isActive ? 'Remove from context' : 'Add to context'}
          aria-label={isActive ? 'Remove from context' : 'Add to context'}
          style={{
            width: 28,
            height: 16,
            borderRadius: 8,
            backgroundColor: isActive ? 'var(--wr-accent-secondary)' : 'var(--wr-bg-surface)',
            border: `1px solid ${isActive ? 'var(--wr-accent-secondary)' : 'var(--wr-border-active)'}`,
            cursor: isReady ? 'pointer' : 'not-allowed',
            position: 'relative',
            transition: 'all var(--wr-transition-fast)',
            flexShrink: 0,
            opacity: isReady ? 1 : 0.4,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: isActive ? 12 : 2,
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: 'white',
              transition: 'left var(--wr-transition-fast)',
            }}
          />
        </button>

        {/* View */}
        {isReady && (
          <button
            onClick={onView}
            title="View source"
            aria-label="View source"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 3px',
              color: 'var(--wr-text-muted)',
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            <Eye className="fa" />
          </button>
        )}

        {/* Delete */}
        <button
          onClick={onDelete}
          title="Remove source"
          aria-label="Remove source"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 3px',
            color: 'var(--wr-text-muted)',
            fontSize: 11,
            flexShrink: 0,
          }}
        >
          <Trash2 className="fa" />
        </button>
      </div>

      {/* Expandable summary */}
      {expanded && summary && (
        <div
          style={{
            marginTop: 8,
            padding: '7px 9px',
            backgroundColor: 'var(--wr-bg-elevated)',
            borderRadius: 'var(--wr-radius-sm)',
            border: '1px solid var(--wr-border)',
            fontSize: 11,
            color: 'var(--wr-text-secondary)',
            lineHeight: 1.65,
          }}
        >
          <MarkdownContent content={summary} />
        </div>
      )}
    </div>
  );
};

// ─── UploadCard — shows in-progress upload ────────────────────────────────────

const UploadCard: React.FC<{ fileName: string; progress: number }> = ({ fileName, progress }) => (
  <div
    style={{
      padding: '9px 12px',
      borderBottom: '1px solid var(--wr-border)',
      backgroundColor: 'rgba(244,63,94,0.04)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <Upload className="fa wr-data-pulse" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--wr-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {fileName}
        </div>
        <div
          style={{
            marginTop: 4,
            height: 2,
            backgroundColor: 'var(--wr-bg-elevated)',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              backgroundColor: 'var(--wr-accent-primary)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>
      <span
        style={{
          fontFamily: 'var(--wr-font-mono)',
          fontSize: 9,
          color: 'var(--wr-accent-primary)',
          flexShrink: 0,
        }}
      >
        {progress}%
      </span>
    </div>
  </div>
);

// ─── IntelDesk (main export) ──────────────────────────────────────────────────

export const IntelDesk: React.FC<IntelDeskProps> = ({
  documents,
  activeContextDocs,
  uploadingFiles,
  uploadProgress,
  onToggleDoc,
  onDeleteDoc,
  onViewDoc,
  onUpload,
  onAddAllDocs,
  onClearAllDocs,
  currentMode,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');

  const completedDocs = documents.filter((d) => d.processing_status === 'completed');
  const activeCount = completedDocs.filter((d) => activeContextDocs.has(d.id)).length;
  const filteredDocs = search
    ? documents.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()))
    : documents;

  const uploadingArr = Array.from(uploadingFiles);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Toolbar ────────────────────────────────────────────── */}
      <div
        style={{
          padding: '7px 12px',
          borderBottom: '1px solid var(--wr-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--wr-font-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--wr-text-secondary)',
            flex: 1,
          }}
        >
          Assets
          {completedDocs.length > 0 && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 9,
                fontWeight: 400,
                color: 'var(--wr-accent-secondary)',
              }}
            >
              {activeCount}/{completedDocs.length} active
            </span>
          )}
        </span>

        <button
          onClick={() => fileInputRef.current?.click()}
          title="Ingest new source"
          aria-label="Ingest new source"
          style={{
            padding: '4px 9px',
            backgroundColor: 'var(--wr-accent-primary)',
            border: 'none',
            borderRadius: 'var(--wr-radius-sm)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <Plus className="fa" />
          <span
            style={{
              fontFamily: 'var(--wr-font-mono)',
              fontSize: 9,
              letterSpacing: '0.08em',
              fontWeight: 700,
            }}
          >
            INGEST
          </span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif"
          style={{ display: 'none' }}
          onChange={onUpload}
          aria-label="Upload source files"
        />
      </div>

      {/* ── Quick-action bar (only when docs exist) ────────────── */}
      {documents.length > 0 && (
        <div
          style={{
            padding: '5px 12px',
            borderBottom: '1px solid var(--wr-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onAddAllDocs}
            title="Add all to context"
            style={{
              fontSize: 9,
              padding: '2px 7px',
              borderRadius: 4,
              border: '1px solid var(--wr-border-active)',
              background: 'transparent',
              color: 'var(--wr-accent-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--wr-font-mono)',
              letterSpacing: '0.06em',
              fontWeight: 700,
            }}
          >
            ALL
          </button>
          <button
            onClick={onClearAllDocs}
            title="Clear context"
            style={{
              fontSize: 9,
              padding: '2px 7px',
              borderRadius: 4,
              border: '1px solid var(--wr-border)',
              background: 'transparent',
              color: 'var(--wr-text-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--wr-font-mono)',
              letterSpacing: '0.06em',
            }}
          >
            NONE
          </button>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter assets..."
            style={{
              flex: 1,
              fontSize: 10,
              padding: '3px 7px',
              borderRadius: 4,
              border: '1px solid var(--wr-border)',
              background: 'var(--wr-bg-surface)',
              color: 'var(--wr-text-primary)',
              fontFamily: 'var(--wr-font-mono)',
              outline: 'none',
              minWidth: 0,
            }}
          />
        </div>
      )}

      {/* ── Intel Mode status banner ───────────────────────────── */}
      {currentMode === 'intel' && (
        <div style={{
          margin: '8px',
          padding: '8px 12px',
          borderRadius: 'var(--wr-radius-sm)',
          backgroundColor: activeCount === 0
            ? 'rgba(239, 68, 68, 0.08)' : 'rgba(6, 182, 212, 0.08)',
          border: `1px solid ${activeCount === 0
            ? 'rgba(239, 68, 68, 0.25)' : 'rgba(6, 182, 212, 0.25)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}>
          <Satellite className="fa" />
          <span style={{
            fontFamily: 'var(--wr-font-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: activeCount === 0 ? '#ef4444' : '#06b6d4',
            lineHeight: 1.4,
          }}>
            {activeCount === 0
              ? 'INTEL MODE — Add at least 1 source to enable citations.'
              : `INTEL MODE — ${activeCount} source${activeCount !== 1 ? 's' : ''} active. Answers will be cited.`}
          </span>
        </div>
      )}

      {/* ── Source list ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {/* In-progress uploads */}
        {uploadingArr.map((fileName) => (
          <UploadCard
            key={fileName}
            fileName={fileName}
            progress={uploadProgress.get(fileName) ?? 0}
          />
        ))}

        {/* Ingested docs */}
        {filteredDocs.length === 0 && uploadingArr.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 140,
              gap: 10,
              padding: 24,
              textAlign: 'center',
            }}
          >
            <Database className="fa" />
            <div>
              <div
                style={{
                  fontFamily: 'var(--wr-font-mono)',
                  fontSize: 11,
                  color: 'var(--wr-text-secondary)',
                  marginBottom: 8,
                }}
              >
                No intel ingested yet
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  fontSize: 10,
                  padding: '4px 12px',
                  borderRadius: 4,
                  border: '1px solid var(--wr-accent-primary)',
                  background: 'transparent',
                  color: 'var(--wr-accent-primary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--wr-font-mono)',
                  letterSpacing: '0.06em',
                }}
              >
                + INGEST FIRST SOURCE
              </button>
            </div>
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <SourceCard
              key={doc.id}
              doc={doc}
              isActive={activeContextDocs.has(doc.id)}
              onToggle={() => onToggleDoc(doc.id)}
              onDelete={() => onDeleteDoc(doc.id)}
              onView={() => onViewDoc(doc.id)}
            />
          ))
        )}
      </div>

    </div>
  );
};

export default IntelDesk;
