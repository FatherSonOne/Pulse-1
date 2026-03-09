import React, { useState, useMemo } from 'react';
import './AILabOutput.css';

import { Share2, Sparkles } from 'lucide-react';

interface AILabOutputProps {
  content: string;
  accentColor?: string;
  accentRgb?: string;
  label?: string;
  onShare?: () => void;
  isLoading?: boolean;
}

// Minimal inline markdown renderer
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre key={`pre-${i}`}><code>{codeLines.join('\n')}</code></pre>
      );
      i++;
      continue;
    }

    // Heading
    const h4 = line.match(/^####\s+(.*)/);
    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    if (h4) { nodes.push(<h4 key={i}>{inlineMarkdown(h4[1])}</h4>); i++; continue; }
    if (h3) { nodes.push(<h3 key={i}>{inlineMarkdown(h3[1])}</h3>); i++; continue; }
    if (h2) { nodes.push(<h2 key={i}>{inlineMarkdown(h2[1])}</h2>); i++; continue; }
    if (h1) { nodes.push(<h1 key={i}>{inlineMarkdown(h1[1])}</h1>); i++; continue; }

    // HR
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} />);
      i++;
      continue;
    }

    // Unordered list
    if (/^[-*•]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*•]\s/, ''));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`}>
          {items.map((item, idx) => <li key={idx}>{inlineMarkdown(item)}</li>)}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`}>
          {items.map((item, idx) => <li key={idx}>{inlineMarkdown(item)}</li>)}
        </ol>
      );
      continue;
    }

    // Table (basic: | col | col |)
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^[\s|:-]+$/.test(lines[i])) {
          rows.push(lines[i].split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim()));
        }
        i++;
      }
      if (rows.length > 0) {
        const [header, ...body] = rows;
        nodes.push(
          <table key={`tbl-${i}`}>
            <thead><tr>{header.map((h, idx) => <th key={idx}>{inlineMarkdown(h)}</th>)}</tr></thead>
            <tbody>
              {body.map((row, ridx) => (
                <tr key={ridx}>{row.map((cell, cidx) => <td key={cidx}>{inlineMarkdown(cell)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        );
      }
      continue;
    }

    // Empty line → paragraph break
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('|') && !lines[i].startsWith('```') && !/^[-*•]\s/.test(lines[i]) && !/^\d+\.\s/.test(lines[i]) && !/^---+$/.test(lines[i].trim())) {
      paraLines.push(lines[i]);
      i++;
    }
    nodes.push(<p key={`p-${i}`}>{inlineMarkdown(paraLines.join(' '))}</p>);
  }

  return nodes;
}

// Inline formatting: bold, italic, code
function inlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold **text** or __text__
    const boldMatch = remaining.match(/^(.*?)\*\*(.*?)\*\*(.*)/s);
    // Italic *text* or _text_
    const italicMatch = remaining.match(/^(.*?)(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)(.*)/s);
    // Inline code `code`
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)/s);

    const boldIdx = boldMatch ? boldMatch[1].length : Infinity;
    const italicIdx = italicMatch ? italicMatch[1].length : Infinity;
    const codeIdx = codeMatch ? codeMatch[1].length : Infinity;

    const minIdx = Math.min(boldIdx, italicIdx, codeIdx);
    if (minIdx === Infinity) break;

    if (boldIdx <= italicIdx && boldIdx <= codeIdx && boldMatch) {
      if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
      parts.push(<strong key={key++}>{boldMatch[2]}</strong>);
      remaining = boldMatch[3];
    } else if (codeIdx <= italicIdx && codeMatch) {
      if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>);
      parts.push(<code key={key++}>{codeMatch[2]}</code>);
      remaining = codeMatch[3];
    } else if (italicMatch) {
      if (italicMatch[1]) parts.push(<span key={key++}>{italicMatch[1]}</span>);
      parts.push(<em key={key++}>{italicMatch[2]}</em>);
      remaining = italicMatch[3];
    } else {
      break;
    }
  }

  if (remaining) parts.push(<span key={key++}>{remaining}</span>);
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

const AILabOutput: React.FC<AILabOutputProps> = ({
  content,
  accentColor = '#818cf8',
  accentRgb = '129, 140, 248',
  label,
  onShare,
  isLoading = false,
}) => {
  const [copied, setCopied] = useState(false);

  const wordCount = useMemo(
    () => content.split(/\s+/).filter(Boolean).length,
    [content]
  );

  const rendered = useMemo(() => renderMarkdown(content), [content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="ailab-output"
      style={{ '--accent-color': accentColor, '--accent-rgb': accentRgb } as React.CSSProperties}
    >
      <div className="ailab-output-header">
        <div className="ailab-output-label">
          <Sparkles />
          {label ? `Output · ${label}` : 'AI Output'}
        </div>
        {!isLoading && content && (
          <div className="ailab-output-actions">
            <button
              type="button"
              className={`ailab-output-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              title="Copy to clipboard"
            >
              <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
            {onShare && (
              <button
                type="button"
                className="ailab-output-btn ailab-output-btn-share"
                onClick={onShare}
                title="Share to channel"
              >
                <Share2 />
                Share
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="ailab-output-skeleton">
          <div className="ailab-skeleton-line" />
          <div className="ailab-skeleton-line" />
          <div className="ailab-skeleton-line" />
          <div className="ailab-skeleton-line" />
        </div>
      ) : (
        <>
          <div className="ailab-output-body">
            <div className="ailab-output-content">{rendered}</div>
          </div>
          {content && (
            <div className="ailab-output-footer">
              <span className="ailab-output-wordcount">{wordCount} words</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AILabOutput;
