/**
 * Markdown Renderer Component
 * Renders AI responses with Claude Code-style formatting
 * Includes support for markdown elements, code blocks, lists, etc.
 */

import React, { useMemo } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Simple markdown parser for AI responses
const parseMarkdown = (text: string): React.ReactNode[] => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let codeBlock: { lang: string; lines: string[] } | null = null;
  let blockquoteLines: string[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      const content = paragraphLines.join(' ').trim();
      if (content) {
        elements.push(
          <p key={`p-${elements.length}`}>
            {parseInlineMarkdown(content)}
          </p>
        );
      }
      paragraphLines = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      const ListTag = currentList.type === 'ul' ? 'ul' : 'ol';
      elements.push(
        <ListTag key={`list-${elements.length}`}>
          {currentList.items.map((item, idx) => (
            <li key={idx}>{parseInlineMarkdown(item)}</li>
          ))}
        </ListTag>
      );
      currentList = null;
    }
  };

  const flushBlockquote = () => {
    if (blockquoteLines.length > 0) {
      elements.push(
        <blockquote key={`bq-${elements.length}`}>
          {blockquoteLines.map((line, idx) => (
            <React.Fragment key={idx}>
              {parseInlineMarkdown(line)}
              {idx < blockquoteLines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </blockquote>
      );
      blockquoteLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Code block start/end
    if (trimmedLine.startsWith('```')) {
      if (codeBlock) {
        // End code block
        flushParagraph();
        flushList();
        flushBlockquote();
        elements.push(
          <pre key={`code-${elements.length}`} data-lang={codeBlock.lang}>
            <code>{codeBlock.lines.join('\n')}</code>
          </pre>
        );
        codeBlock = null;
      } else {
        // Start code block
        flushParagraph();
        flushList();
        flushBlockquote();
        codeBlock = {
          lang: trimmedLine.slice(3).trim() || 'text',
          lines: [],
        };
      }
      continue;
    }

    // Inside code block
    if (codeBlock) {
      codeBlock.lines.push(line);
      continue;
    }

    // Empty line
    if (trimmedLine === '') {
      flushParagraph();
      flushList();
      flushBlockquote();
      continue;
    }

    // Headings
    const headingMatch = trimmedLine.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushBlockquote();
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      elements.push(
        <HeadingTag key={`h${level}-${elements.length}`}>
          {parseInlineMarkdown(content)}
        </HeadingTag>
      );
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmedLine)) {
      flushParagraph();
      flushList();
      flushBlockquote();
      elements.push(<hr key={`hr-${elements.length}`} />);
      continue;
    }

    // Blockquote
    if (trimmedLine.startsWith('>')) {
      flushParagraph();
      flushList();
      blockquoteLines.push(trimmedLine.slice(1).trim());
      continue;
    }

    // Unordered list
    const ulMatch = trimmedLine.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      flushBlockquote();
      if (currentList?.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(ulMatch[1]);
      continue;
    }

    // Ordered list
    const olMatch = trimmedLine.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      flushBlockquote();
      if (currentList?.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(olMatch[1]);
      continue;
    }

    // Regular paragraph text
    flushList();
    flushBlockquote();
    paragraphLines.push(trimmedLine);
  }

  // Flush remaining content
  flushParagraph();
  flushList();
  flushBlockquote();

  // Handle unclosed code block
  if (codeBlock) {
    elements.push(
      <pre key={`code-${elements.length}`} data-lang={codeBlock.lang}>
        <code>{codeBlock.lines.join('\n')}</code>
      </pre>
    );
  }

  return elements;
};

// Parse inline markdown (bold, italic, code, links)
const parseInlineMarkdown = (text: string): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold (**text** or __text__)
    const boldMatch = remaining.match(/^(.*?)(\*\*|__)(.+?)\2/);
    if (boldMatch) {
      if (boldMatch[1]) {
        parts.push(parseRemainingInline(boldMatch[1], `before-${key}`));
      }
      parts.push(<strong key={`bold-${key}`}>{parseInlineMarkdown(boldMatch[3])}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      key++;
      continue;
    }

    // Italic (*text* or _text_)
    const italicMatch = remaining.match(/^(.*?)(\*|_)([^*_]+?)\2/);
    if (italicMatch) {
      if (italicMatch[1]) {
        parts.push(parseRemainingInline(italicMatch[1], `before-${key}`));
      }
      parts.push(<em key={`italic-${key}`}>{parseInlineMarkdown(italicMatch[3])}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      key++;
      continue;
    }

    // Inline code (`code`)
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`/);
    if (codeMatch) {
      if (codeMatch[1]) {
        parts.push(parseRemainingInline(codeMatch[1], `before-${key}`));
      }
      parts.push(<code key={`code-${key}`}>{codeMatch[2]}</code>);
      remaining = remaining.slice(codeMatch[0].length);
      key++;
      continue;
    }

    // Links [text](url)
    const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      if (linkMatch[1]) {
        parts.push(parseRemainingInline(linkMatch[1], `before-${key}`));
      }
      parts.push(
        <a key={`link-${key}`} href={linkMatch[3]} target="_blank" rel="noopener noreferrer">
          {linkMatch[2]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      key++;
      continue;
    }

    // No more matches, add remaining text
    parts.push(remaining);
    break;
  }

  return parts.length === 1 ? parts[0] : parts;
};

// Helper to avoid double-parsing
const parseRemainingInline = (text: string, key: string): React.ReactNode => {
  return <React.Fragment key={key}>{text}</React.Fragment>;
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
}) => {
  const rendered = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className={`pulse-ai-response ${className}`}>
      {rendered}
    </div>
  );
};

export default MarkdownRenderer;
