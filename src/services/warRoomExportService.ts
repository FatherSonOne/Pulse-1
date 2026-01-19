/**
 * War Room Export Service
 * Handles exporting war room sessions as presentable documents to Archives
 */

import { archiveService } from './archiveService';
import { AIMessage, AISession, AIProject } from './ragService';
import type { ArchiveItem } from '../types';

// ============================================
// Types
// ============================================

export interface WarRoomExportData {
  session: AISession;
  project?: AIProject;
  messages: AIMessage[];
  mode: string;
  mission?: string;
  documents?: { id: string; name: string; type: string }[];
  duration?: number; // in minutes
  exportedAt: Date;
}

export interface ExportFormat {
  type: 'markdown' | 'html' | 'json' | 'pdf';
  includeTimestamps: boolean;
  includeMetadata: boolean;
  includeDocumentRefs: boolean;
}

export interface ExportResult {
  success: boolean;
  archiveId?: string;
  content?: string;
  error?: string;
}

// ============================================
// Helper Functions
// ============================================

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getModeDisplayName(mode: string): string {
  const modeNames: Record<string, string> = {
    tactical: 'Tactical Operations',
    focus: 'Deep Focus',
    analyst: 'Data Analyst',
    strategist: 'Strategist',
    brainstorm: 'Brainstorm',
    debrief: 'Debrief',
    'elegant-interface': 'Conversation',
    neural: 'Neural Terminal',
    sentient: 'Sentient Interface',
    xray: 'X-Ray Mode',
    command: 'Command Center',
  };
  return modeNames[mode] || mode.charAt(0).toUpperCase() + mode.slice(1);
}

function getMissionDisplayName(mission: string): string {
  const missionNames: Record<string, string> = {
    research: 'Research Mission',
    decision: 'Decision Making',
    brainstorm: 'Brainstorm',
    plan: 'Planning',
    analyze: 'Analysis',
    create: 'Content Creation',
  };
  return missionNames[mission] || mission.charAt(0).toUpperCase() + mission.slice(1);
}

// ============================================
// Export Formatters
// ============================================

function exportToMarkdown(data: WarRoomExportData, options: ExportFormat): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${data.session.title || 'War Room Session'}`);
  lines.push('');

  // Metadata block
  if (options.includeMetadata) {
    lines.push('---');
    lines.push(`**Mode:** ${getModeDisplayName(data.mode)}`);
    if (data.mission) {
      lines.push(`**Mission:** ${getMissionDisplayName(data.mission)}`);
    }
    if (data.project) {
      lines.push(`**War Room:** ${data.project.name}`);
    }
    lines.push(`**Date:** ${formatTimestamp(data.exportedAt)}`);
    if (data.duration) {
      lines.push(`**Duration:** ${formatDuration(data.duration)}`);
    }
    lines.push(`**Messages:** ${data.messages.length}`);
    lines.push('---');
    lines.push('');
  }

  // Context Documents
  if (options.includeDocumentRefs && data.documents && data.documents.length > 0) {
    lines.push('## Context Documents');
    lines.push('');
    data.documents.forEach(doc => {
      lines.push(`- **${doc.name}** _(${doc.type})_`);
    });
    lines.push('');
  }

  // Conversation
  lines.push('## Conversation');
  lines.push('');

  data.messages.forEach((msg) => {
    const role = msg.role === 'user' ? 'You' : 'AI';
    const icon = msg.role === 'user' ? '**You:**' : '**AI:**';

    if (options.includeTimestamps && msg.timestamp) {
      lines.push(`### ${icon} _${formatTimestamp(new Date(msg.timestamp))}_`);
    } else {
      lines.push(`### ${icon}`);
    }
    lines.push('');
    lines.push(msg.content);
    lines.push('');
  });

  // Footer
  lines.push('---');
  lines.push(`_Exported from Pulse War Room on ${formatTimestamp(new Date())}_`);

  return lines.join('\n');
}

function exportToHTML(data: WarRoomExportData, options: ExportFormat): string {
  const modeColor = getModeColor(data.mode);

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.session.title || 'War Room Session'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0f;
      color: #f4f4f5;
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 900px; margin: 0 auto; }
    .header {
      border-bottom: 2px solid ${modeColor};
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }
    h1 { font-size: 2rem; font-weight: 600; margin-bottom: 1rem; }
    .meta { display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.875rem; color: #a1a1aa; }
    .meta-item { display: flex; align-items: center; gap: 0.5rem; }
    .badge {
      background: ${modeColor}20;
      color: ${modeColor};
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .documents {
      background: #18181f;
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 2rem;
    }
    .documents h2 { font-size: 0.875rem; color: #a1a1aa; margin-bottom: 0.75rem; }
    .doc-list { list-style: none; }
    .doc-list li { padding: 0.5rem 0; border-bottom: 1px solid #252530; }
    .doc-list li:last-child { border-bottom: none; }
    .conversation { display: flex; flex-direction: column; gap: 1.5rem; }
    .message {
      background: #121218;
      border-radius: 0.75rem;
      padding: 1rem 1.25rem;
      border-left: 3px solid transparent;
    }
    .message.user { border-left-color: #3b82f6; }
    .message.ai { border-left-color: ${modeColor}; }
    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .role { font-weight: 600; font-size: 0.875rem; }
    .message.user .role { color: #3b82f6; }
    .message.ai .role { color: ${modeColor}; }
    .timestamp { font-size: 0.75rem; color: #71717a; }
    .content { white-space: pre-wrap; }
    .footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid #252530;
      text-align: center;
      font-size: 0.75rem;
      color: #71717a;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(data.session.title || 'War Room Session')}</h1>
      <div class="meta">
        <span class="badge">${getModeDisplayName(data.mode)}</span>
        ${data.mission ? `<span class="badge">${getMissionDisplayName(data.mission)}</span>` : ''}
        ${data.project ? `<div class="meta-item"><strong>War Room:</strong> ${escapeHtml(data.project.name)}</div>` : ''}
        <div class="meta-item"><strong>Date:</strong> ${formatTimestamp(data.exportedAt)}</div>
        ${data.duration ? `<div class="meta-item"><strong>Duration:</strong> ${formatDuration(data.duration)}</div>` : ''}
        <div class="meta-item"><strong>Messages:</strong> ${data.messages.length}</div>
      </div>
    </div>`;

  if (options.includeDocumentRefs && data.documents && data.documents.length > 0) {
    html += `
    <div class="documents">
      <h2>Context Documents</h2>
      <ul class="doc-list">
        ${data.documents.map(doc => `<li><strong>${escapeHtml(doc.name)}</strong> <span style="color:#71717a">(${doc.type})</span></li>`).join('')}
      </ul>
    </div>`;
  }

  html += `
    <div class="conversation">`;

  data.messages.forEach(msg => {
    const roleClass = msg.role === 'user' ? 'user' : 'ai';
    const roleLabel = msg.role === 'user' ? 'You' : 'AI';
    const timestamp = options.includeTimestamps && msg.timestamp
      ? `<span class="timestamp">${formatTimestamp(new Date(msg.timestamp))}</span>`
      : '';

    html += `
      <div class="message ${roleClass}">
        <div class="message-header">
          <span class="role">${roleLabel}</span>
          ${timestamp}
        </div>
        <div class="content">${escapeHtml(msg.content)}</div>
      </div>`;
  });

  html += `
    </div>
    <div class="footer">
      Exported from Pulse War Room on ${formatTimestamp(new Date())}
    </div>
  </div>
</body>
</html>`;

  return html;
}

function exportToJSON(data: WarRoomExportData): string {
  return JSON.stringify({
    session: {
      id: data.session.id,
      title: data.session.title,
      createdAt: data.session.created_at,
    },
    project: data.project ? {
      id: data.project.id,
      name: data.project.name,
    } : null,
    mode: data.mode,
    mission: data.mission || null,
    documents: data.documents || [],
    messages: data.messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    })),
    exportedAt: data.exportedAt.toISOString(),
    duration: data.duration || null,
  }, null, 2);
}

function getModeColor(mode: string): string {
  const colors: Record<string, string> = {
    tactical: '#f43f5e',
    focus: '#8b5cf6',
    analyst: '#3b82f6',
    strategist: '#a855f7',
    brainstorm: '#f59e0b',
    debrief: '#10b981',
    'elegant-interface': '#ec4899',
    neural: '#06b6d4',
    sentient: '#84cc16',
    xray: '#ef4444',
    command: '#6366f1',
  };
  return colors[mode] || '#f43f5e';
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Main Export Class
// ============================================

class WarRoomExportService {
  /**
   * Export a war room session to the Archives
   */
  async exportToArchive(data: WarRoomExportData, format: ExportFormat = {
    type: 'markdown',
    includeTimestamps: true,
    includeMetadata: true,
    includeDocumentRefs: true,
  }): Promise<ExportResult> {
    try {
      let content: string;

      switch (format.type) {
        case 'html':
          content = exportToHTML(data, format);
          break;
        case 'json':
          content = exportToJSON(data);
          break;
        case 'markdown':
        default:
          content = exportToMarkdown(data, format);
          break;
      }

      // Create archive item
      const archiveData: Omit<ArchiveItem, 'id'> = {
        type: 'war_room_session',
        title: `${data.session.title || 'War Room Session'} - ${getModeDisplayName(data.mode)}`,
        content,
        date: data.exportedAt,
        tags: [
          'war-room',
          data.mode,
          data.mission || '',
          data.project?.name || '',
        ].filter(Boolean),
        aiTags: ['exported', format.type],
        aiSummary: `War Room session with ${data.messages.length} messages in ${getModeDisplayName(data.mode)} mode.`,
      };

      const result = await archiveService.createArchive(archiveData);

      if (result) {
        return {
          success: true,
          archiveId: result.id,
          content,
        };
      }

      return {
        success: false,
        error: 'Failed to save to archives',
      };
    } catch (error) {
      console.error('Export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate exportable content without saving to archives
   */
  generateContent(data: WarRoomExportData, format: ExportFormat): string {
    switch (format.type) {
      case 'html':
        return exportToHTML(data, format);
      case 'json':
        return exportToJSON(data);
      case 'markdown':
      default:
        return exportToMarkdown(data, format);
    }
  }

  /**
   * Download content as a file
   */
  downloadAsFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export and download as file
   */
  exportAndDownload(data: WarRoomExportData, format: ExportFormat): void {
    const content = this.generateContent(data, format);
    const timestamp = new Date().toISOString().split('T')[0];
    const sessionName = (data.session.title || 'war-room-session')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const extensions: Record<string, string> = {
      markdown: 'md',
      html: 'html',
      json: 'json',
      pdf: 'pdf',
    };

    const mimeTypes: Record<string, string> = {
      markdown: 'text/markdown',
      html: 'text/html',
      json: 'application/json',
      pdf: 'application/pdf',
    };

    const filename = `${sessionName}-${timestamp}.${extensions[format.type]}`;
    this.downloadAsFile(content, filename, mimeTypes[format.type]);
  }

  /**
   * Share content via Web Share API
   */
  async share(data: WarRoomExportData): Promise<boolean> {
    if (!navigator.share) {
      console.warn('Web Share API not supported');
      return false;
    }

    const content = this.generateContent(data, {
      type: 'markdown',
      includeTimestamps: true,
      includeMetadata: true,
      includeDocumentRefs: true,
    });

    try {
      await navigator.share({
        title: data.session.title || 'War Room Session',
        text: content.slice(0, 500) + '...',
      });
      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Share failed:', error);
      }
      return false;
    }
  }
}

export const warRoomExportService = new WarRoomExportService();
export default warRoomExportService;
