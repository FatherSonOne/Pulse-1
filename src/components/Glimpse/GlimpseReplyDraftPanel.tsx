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

  // Styles are token-based in Glimpse.css — theme context cascades from the
  // .video-vox-mode wrapper in Glimpse.tsx, so no wrapper needed here.
  // isDarkMode is accepted for API parity with the AI panels but unused now
  // that we consume tokens directly.
  void isDarkMode;

  return (
    <div className="gl-draft-panel" role="region" aria-label="AI reply draft">
      <div className="gl-draft-panel-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <AIProvenanceChip vendor="PULSE AI" type="DRAFT" fresh />
          <span className="gl-draft-panel-tone">tone · {draft.tone}</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="gl-floating-dismiss"
          title="Dismiss draft"
          aria-label="Dismiss draft"
          style={{ width: 28, height: 28, borderRadius: 8 }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="gl-draft-panel-textarea"
        rows={4}
        aria-label="Editable draft text"
      />

      {draft.suggestedAction && (
        <p className="gl-draft-panel-next">
          <span className="gl-draft-panel-next-tag">next</span>
          {draft.suggestedAction}
        </p>
      )}

      <div className="gl-draft-panel-actions">
        <button
          type="button"
          onClick={handleCopy}
          className="gl-action-pill"
          title="Copy draft to clipboard"
        >
          {copied ? <Check className="icon" /> : <Copy className="icon" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
        {onUseAsCaption && (
          <button
            type="button"
            onClick={() => onUseAsCaption(text)}
            className="gl-send-btn"
            title="Open the recorder with this draft as the caption"
            style={{ width: 'auto', padding: '10px 16px' }}
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
