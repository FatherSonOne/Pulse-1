// CommentComposer: textarea + mention detection + submit button.
//
// Detects the `@` typed by the operator and opens the MentionPicker. When
// the operator picks a member, the picker inserts `@<uuid> ` into the
// textarea (the comments service's extractMentions parses this format).
// The display layer (CommentRow) replaces the uuid with the member's name
// at render time.

import React, { useRef, useState } from 'react';
import { Send } from 'lucide-react';
import type { User } from '../../../types';
import { MentionPicker } from './MentionPicker';

interface CommentComposerProps {
  workspaceMembers: User[];
  /** Submit handler returns whether the submit succeeded. */
  onSubmit: (body: string) => Promise<boolean>;
  /** Replying to a comment id, surfaces a small "Replying to..." hint. */
  replyToLabel?: string | null;
  onCancelReply?: () => void;
  placeholder?: string;
}

interface MentionState {
  active: boolean;
  query: string;
  /** Position of the `@` character in the textarea value. */
  atIndex: number;
  anchor: { top: number; left: number } | null;
}

const INITIAL_MENTION: MentionState = {
  active: false,
  query: '',
  atIndex: -1,
  anchor: null,
};

export const CommentComposer: React.FC<CommentComposerProps> = ({
  workspaceMembers,
  onSubmit,
  replyToLabel,
  onCancelReply,
  placeholder = 'Add a comment',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mention, setMention] = useState<MentionState>(INITIAL_MENTION);

  /**
   * Watches caret movement to detect when the operator is typing inside
   * an `@` token, and surfaces the picker. Closes the picker when the
   * caret moves outside or when whitespace is typed after the query.
   */
  const updateMentionState = (value: string, caret: number) => {
    if (caret <= 0) {
      setMention(INITIAL_MENTION);
      return;
    }
    const before = value.slice(0, caret);
    const atIndex = before.lastIndexOf('@');
    if (atIndex === -1) {
      setMention(INITIAL_MENTION);
      return;
    }
    const between = value.slice(atIndex + 1, caret);
    if (/\s/.test(between)) {
      setMention(INITIAL_MENTION);
      return;
    }
    // Don't activate for an `@` already followed by a uuid (already-resolved
    // mention). Heuristic: if the `between` is exactly 36 chars and matches
    // a uuid shape, hide the picker.
    if (
      between.length === 36 &&
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(between)
    ) {
      setMention(INITIAL_MENTION);
      return;
    }

    // Compute anchor coordinates relative to the textarea. We use a coarse
    // approximation (caret at the bottom of the textarea); a future iteration
    // can compute exact line position.
    const ta = textareaRef.current;
    let anchor = { top: 32, left: 12 };
    if (ta) {
      anchor = { top: ta.offsetHeight + 4, left: 12 };
    }
    setMention({ active: true, query: between, atIndex, anchor });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    updateMentionState(e.target.value, e.target.selectionStart);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    updateMentionState(ta.value, ta.selectionStart);
  };

  const insertMention = (member: User) => {
    if (mention.atIndex === -1) return;
    const before = body.slice(0, mention.atIndex);
    const afterCaret = body.slice(mention.atIndex + 1 + mention.query.length);
    const next = `${before}@${member.id} ${afterCaret}`;
    setBody(next);
    setMention(INITIAL_MENTION);
    // Refocus and place caret after the inserted mention.
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      const caret = before.length + 1 + member.id.length + 1;
      ta.setSelectionRange(caret, caret);
    });
  };

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    const ok = await onSubmit(trimmed);
    setSubmitting(false);
    if (ok) {
      setBody('');
      setMention(INITIAL_MENTION);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't intercept Enter while the picker is open; MentionPicker handles it.
    if (mention.active) return;
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="dc-composer">
      {replyToLabel && (
        <div className="dc-composer-reply-hint">
          <span className="dt-label">Replying to</span>
          <span className="dc-composer-reply-target">{replyToLabel}</span>
          {onCancelReply && (
            <button
              type="button"
              className="dc-composer-reply-cancel dt-label"
              onClick={onCancelReply}
            >
              Cancel
            </button>
          )}
        </div>
      )}
      <div className="dc-composer-input-wrap">
        <textarea
          ref={textareaRef}
          className="dc-composer-input"
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          placeholder={placeholder}
          rows={2}
          aria-label="Comment body"
        />
        <MentionPicker
          anchor={mention.active ? mention.anchor : null}
          query={mention.query}
          members={workspaceMembers}
          onPick={insertMention}
          onClose={() => setMention(INITIAL_MENTION)}
        />
      </div>
      <div className="dc-composer-actions">
        <span className="dc-composer-hint dt-label">Type @ to mention &middot; &#8984;&#8629; to send</span>
        <button
          type="button"
          className="dc-composer-submit"
          onClick={handleSubmit}
          disabled={!body.trim() || submitting}
        >
          <Send size={14} aria-hidden="true" />
          {submitting ? 'Sending' : 'Send'}
        </button>
      </div>
    </div>
  );
};
