/**
 * LinkPreviewCard
 *
 * Phase 7b — renders an Open Graph preview card for a single URL.
 * Fetches lazily via `linkPreviewService` (which has a two-layer
 * cache, so subsequent renders are free).
 *
 * Renders nothing on `fetch_failed` or `parse_failed` — the goal is
 * a graceful enhancement, not a "this URL didn't work" error.
 */

import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { extractUrls, linkPreviewService, type LinkPreview } from '../../services/linkPreviewService';

interface LinkPreviewCardProps {
  url: string;
  /** Compact = smaller layout, no image; useful for dense bubbles. */
  compact?: boolean;
  className?: string;
}

export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({
  url,
  compact = false,
  className = '',
}) => {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void linkPreviewService.getPreview(url).then((result) => {
      if (cancelled) return;
      setPreview(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Loading skeleton — only show after a brief delay would be nicer
  // but for now show immediately; cached previews resolve sync-ish.
  if (loading) {
    return (
      <div
        className={`rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.10)] bg-[#f8f8f8] dark:bg-[rgba(255,255,255,0.055)]/50 p-3 animate-pulse ${className}`}
      >
        <div className="h-3 w-3/4 bg-zinc-200 dark:bg-zinc-700 rounded mb-2" />
        <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-700 rounded mb-1" />
        <div className="h-2 w-2/3 bg-zinc-200 dark:bg-zinc-700 rounded" />
      </div>
    );
  }

  // Hide on failure — the URL itself still renders inside the message
  // body via `renderTextWithLinks`, so the user can click through.
  if (!preview || preview.status !== 'ok') return null;

  const hasImage = !!preview.image_url && !compact;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.10)] bg-white dark:bg-[rgba(255,255,255,0.03)] hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-sm transition overflow-hidden ${className}`}
      title={preview.url}
    >
      {hasImage && (
        <div className="aspect-video bg-[var(--pulse-surface-raised)] overflow-hidden">
          <img
            src={preview.image_url}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide broken image; card still renders title + description.
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      <div className="p-3">
        {preview.site_name && (
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
            <ExternalLink className="w-2.5 h-2.5" />
            <span className="truncate">{preview.site_name}</span>
          </div>
        )}
        {preview.title && (
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 mb-1">
            {preview.title}
          </div>
        )}
        {preview.description && !compact && (
          <div className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
            {preview.description}
          </div>
        )}
      </div>
    </a>
  );
};

/**
 * MessageLinkPreviews — extracts URLs from a message body and renders
 * up to N preview cards. Drop-in component for any message bubble that
 * wants OG preview enrichment.
 *
 * Usage in a bubble renderer:
 *
 *     {msg.text && <p>{renderTextWithLinks(msg.text)}</p>}
 *     <MessageLinkPreviews text={msg.text} max={3} />
 *
 * If the text has no URLs, renders nothing.
 */
interface MessageLinkPreviewsProps {
  text: string | null | undefined;
  max?: number;
  compact?: boolean;
  className?: string;
}

export const MessageLinkPreviews: React.FC<MessageLinkPreviewsProps> = ({
  text,
  max = 2,
  compact = false,
  className = '',
}) => {
  if (!text) return null;
  const urls = extractUrls(text, max);
  if (urls.length === 0) return null;

  return (
    <div className={`mt-2 space-y-2 ${className}`}>
      {urls.map((url) => (
        <LinkPreviewCard key={url} url={url} compact={compact} />
      ))}
    </div>
  );
};

// Reference to keep linker happy — used only for the `extractUrls` import side-effect.
void linkPreviewService;

export default LinkPreviewCard;
