// EmailBody — shared body-render primitive consumed by every reader
// surface in the hybrid email tree (InlineReader, TriageCard, and by
// extension EmailReaderPanel which wraps InlineReader). Replaces 40+
// lines of identical DOMPurify + HTML-sniff + plain-text-fallback
// logic that was duplicated verbatim in two files before round 4 of
// the /impeccable critique consolidation.
//
// Renders, in order of preference:
//   1. email._raw.body_html, sanitized via DOMPurify
//   2. body / snippet IF it looks like raw HTML markup (some senders
//      ship HTML in the text track — booking confirmations, marketing
//      platforms — Gmail's text fallback just dumps the source).
//      Also routed through DOMPurify.
//   3. plain text with pre-wrap
//   4. empty-state placeholder pointing at the AI summary above
import React, { useMemo } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import type { EmailRow } from './data/emailRow';

interface EmailBodyProps {
  email: EmailRow;
}

function looksLikeHtml(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed.startsWith('<')) return false;
  return /<[a-z][^>]*>/i.test(trimmed) && /<\/[a-z]+>|\/>/i.test(trimmed);
}

export const EmailBody: React.FC<EmailBodyProps> = ({ email }) => {
  const rawHtml = email._raw?.body_html?.trim();
  const rawText = email.body || email._raw?.snippet || '';
  const htmlSource = rawHtml || (looksLikeHtml(rawText) ? rawText : '');

  // DOMPurify-sanitized HTML — every path that reaches the HTML render
  // branch below has been scrubbed of <script>, <style>, <iframe>, and
  // every inline event handler. Safe to inject.
  const sanitizedHtml = useMemo(() => {
    if (!htmlSource) return '';
    return DOMPurify.sanitize(htmlSource, {
      FORBID_TAGS: ['script', 'style', 'form', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus'],
    });
  }, [htmlSource]);

  if (sanitizedHtml) {
    return (
      <div
        className="email-body-html max-w-[760px]"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }
  if (rawText.trim()) {
    return <div className="email-body-text max-w-[760px]">{rawText}</div>;
  }
  return (
    <div className="text-[12.5px] pulse-ink-3-color italic py-3">
      This email has no body content beyond the subject and AI summary above.
    </div>
  );
};

export default EmailBody;
