// GlimpseReplyDraftPanel — single longer-form AI reply draft for Glimpse.
// Distinct from VoxSmartReplies: one editable draft instead of three quick
// options. Result lands in an editable textarea so the user can refine it
// before copying or carrying into a Glimpse reply as the caption.

import React, { useEffect, useRef, useState } from 'react';
import { Copy, Video, X, Check } from 'lucide-react';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';
import type { ReplyDraft } from '../../services/relay/relayAIService';

interface GlimpseReplyDraftPanelProps {
  draft: ReplyDraft;
  isDarkMode?: boolean;
  /** Carry the draft into the recorder as the caption for a Glimpse reply. */
  onUseAsCaption?: (text: string) => void;
  onDismiss: () => void;
}

export const GlimpseReplyDraftPanel: React.FC<GlimpseReplyDraftPanelProps> = ({
  draft,
  isDarkMode = false,
  onUseAsCaption,
  onDismiss,
}) => {
  const [text, setText] = useState(draft.text);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset local edits if a new draft arrives.
  useEffect(() => {
    setText(draft.text);
    setCopied(false);
  }, [draft.text]);

  // Auto-grow the textarea to fit the content on first render.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore; the textarea remains selectable for manual copy.
    }
  };

  const tc = {
    bg: isDarkMode ? 'bg-zinc-900' : 'bg-white',
    border: isDarkMode ? 'border-zinc-700' : 'border-zinc-200',
    text: isDarkMode ? 'text-white' : 'text-zinc-900',
    textMuted: isDarkMode ? 'text-zinc-400' : 'text-zinc-600',
    textareaBg: isDarkMode ? 'bg-zinc-950/40' : 'bg-zinc-50',
    secondaryBtn: isDarkMode
      ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
      : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50',
  };

  return (
    <div
      className={`p-4 rounded-xl border ${tc.border} ${tc.bg} flex flex-col gap-3`}
      role="region"
      aria-label="AI reply draft"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AIProvenanceChip vendor="PULSE AI" type="DRAFT" fresh />
          <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${tc.textMuted} truncate`}>
            tone · {draft.tone}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className={`p-1.5 rounded-md ${tc.secondaryBtn}`}
          title="Dismiss draft"
          aria-label="Dismiss draft"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={`w-full resize-none rounded-lg border ${tc.border} ${tc.textareaBg} ${tc.text} p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-500/40`}
        rows={4}
        aria-label="Editable draft text"
      />

      {draft.suggestedAction && (
        <p className={`text-xs ${tc.textMuted}`}>
          <span className="font-mono uppercase tracking-[0.1em] text-rose-500 mr-1.5">next</span>
          {draft.suggestedAction}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm ${tc.secondaryBtn}`}
          title="Copy draft to clipboard"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
        {onUseAsCaption && (
          <button
            type="button"
            onClick={() => onUseAsCaption(text)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 transition-colors"
            title="Open the recorder with this draft as the caption"
          >
            <Video className="w-4 h-4" />
            <span>Use as caption</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default GlimpseReplyDraftPanel;
