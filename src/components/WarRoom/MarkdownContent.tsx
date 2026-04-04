/**
 * MarkdownContent — Lightweight markdown renderer for AI responses.
 *
 * Converts common markdown patterns to formatted React elements:
 *  - **bold**, *italic*
 *  - ## Headings (h2-h4)
 *  - Bullet lists (- or *)
 *  - Numbered lists (1. 2. 3.)
 *  - `inline code` and ```code blocks```
 *  - Line breaks (double newline → paragraph break)
 *  - [bracket] citations styled as tags
 *
 * Security: All text is HTML-escaped via esc() before any transforms.
 * The only inputs are AI-generated responses from our own LLM backend,
 * not arbitrary user HTML. The esc() function neutralizes any < > & chars.
 */

import React from 'react';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/** Escape HTML entities to prevent injection */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Convert inline markdown (on already-escaped text) to styled spans */
function renderInline(text: string): React.ReactNode[] {
  const escaped = esc(text);
  // Split by patterns and build React nodes instead of raw HTML
  const parts: React.ReactNode[] = [];
  let remaining = escaped;
  let key = 0;

  // Process inline patterns iteratively
  const patterns: [RegExp, (match: RegExpMatchArray) => React.ReactNode][] = [
    [/`([^`]+)`/, (m) => <code key={key++} className="ps-md-code">{m[1]}</code>],
    [/\*\*\*(.+?)\*\*\*/, (m) => <strong key={key++}><em>{m[1]}</em></strong>],
    [/\*\*(.+?)\*\*/, (m) => <strong key={key++}>{m[1]}</strong>],
    [/\*(.+?)\*/, (m) => <em key={key++}>{m[1]}</em>],
    [/\[(\d+)\]/, (m) => <span key={key++} className="ps-md-cite">[{m[1]}]</span>],
  ];

  function processText(input: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    let text = input;

    while (text.length > 0) {
      let earliest: { idx: number; match: RegExpMatchArray; handler: (m: RegExpMatchArray) => React.ReactNode } | null = null;

      for (const [re, handler] of patterns) {
        const m = text.match(re);
        if (m && m.index !== undefined) {
          if (!earliest || m.index < earliest.idx) {
            earliest = { idx: m.index, match: m, handler };
          }
        }
      }

      if (!earliest) {
        nodes.push(text);
        break;
      }

      if (earliest.idx > 0) {
        nodes.push(text.slice(0, earliest.idx));
      }
      nodes.push(earliest.handler(earliest.match));
      text = text.slice(earliest.idx + earliest.match[0].length);
    }

    return nodes;
  }

  return processText(remaining);
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let elKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block (```)
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={elKey++} className="ps-md-pre">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Headings
    const h4 = line.match(/^####\s+(.+)/);
    if (h4) { elements.push(<h4 key={elKey++} className="ps-md-h4">{renderInline(h4[1])}</h4>); i++; continue; }

    const h3 = line.match(/^###\s+(.+)/);
    if (h3) { elements.push(<h3 key={elKey++} className="ps-md-h3">{renderInline(h3[1])}</h3>); i++; continue; }

    const h2 = line.match(/^##\s+(.+)/);
    if (h2) { elements.push(<h2 key={elKey++} className="ps-md-h2">{renderInline(h2[1])}</h2>); i++; continue; }

    // Horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      elements.push(<hr key={elKey++} className="ps-md-hr" />);
      i++;
      continue;
    }

    // Unordered list
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={elKey++} className="ps-md-ul">
          {items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i++;
      }
      elements.push(
        <ol key={elKey++} className="ps-md-ol">
          {items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </ol>
      );
      continue;
    }

    // Empty line → skip
    if (line.trim() === '') { i++; continue; }

    // Paragraph — collect consecutive text lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{2,4}\s+/.test(lines[i]) &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith('```') &&
      !/^---+$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(
        <p key={elKey++} className="ps-md-p">{renderInline(paraLines.join(' '))}</p>
      );
    }
  }

  return <div className={`ps-md ${className || ''}`}>{elements}</div>;
};

export default MarkdownContent;
