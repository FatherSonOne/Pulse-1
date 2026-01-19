/**
 * Export Search Results and Clipboard
 */

import { SearchResult } from './unifiedSearchService';
import { ClipboardItem } from './searchClipboardService';

export class SearchExport {
  /**
   * Export search results as CSV
   */
  exportToCSV(results: SearchResult[], filename: string = 'search-results'): void {
    const headers = ['Type', 'Title', 'Content', 'Timestamp', 'Sender', 'Source'];
    const rows = results.map(r => [
      r.type,
      r.title.replace(/"/g, '""'),
      r.content.substring(0, 500).replace(/"/g, '""'),
      r.timestamp.toISOString(),
      r.sender || '',
      r.source || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    this.downloadFile(csv, `${filename}.csv`, 'text/csv');
  }

  /**
   * Export clipboard as markdown document
   */
  exportClipboardToMarkdown(items: ClipboardItem[], filename: string = 'clipboard'): void {
    const sections = items.map(item => {
      const pinned = item.pinned ? ' 📌' : '';
      const tags = item.tags.length > 0 ? `\n**Tags:** ${item.tags.join(', ')}` : '';
      const category = item.category ? `\n**Category:** ${item.category}` : '';
      const date = `\n**Date:** ${item.updatedAt.toLocaleDateString()}`;

      return `## ${item.title}${pinned}${category}${tags}${date}\n\n${item.content}\n\n---\n`;
    });

    const markdown = `# Clipboard Export\n\n*Exported on ${new Date().toLocaleString()}*\n\n${sections.join('\n')}`;
    this.downloadFile(markdown, `${filename}.md`, 'text/markdown');
  }

  /**
   * Export search results as PDF (using print)
   */
  exportToPDF(results: SearchResult[], title: string = 'Search Results'): void {
    const html = this.generateHTML(results, title);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  }

  /**
   * Generate HTML for PDF export
   */
  private generateHTML(results: SearchResult[], title: string): string {
    const rows = results.map(r => `
      <tr>
        <td>${r.type}</td>
        <td><strong>${this.escapeHtml(r.title)}</strong></td>
        <td>${this.escapeHtml(r.content.substring(0, 200))}...</td>
        <td>${r.timestamp.toLocaleString()}</td>
        <td>${this.escapeHtml(r.sender || '')}</td>
        <td>${this.escapeHtml(r.source || '')}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p>Exported on ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Content</th>
                <th>Timestamp</th>
                <th>Sender</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;
  }

  /**
   * Download file helper
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
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
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export const searchExport = new SearchExport();