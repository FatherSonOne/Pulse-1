// src/components/PulseComposer/useSmartCompose.ts
// PR 1 — Messages Tools Redesign · Surface 1 · Compose bar.
//
// Smart Compose ghost-text hook. PR 1 ships the wiring + a deterministic
// stub provider; a follow-up PR replaces the stub with the Gemini edge
// function. The hook owns:
//
//   • 600ms debounce after the user stops typing (spec §A11y — live regions)
//   • Provider abort on every keystroke (prevents stale completion races)
//   • Live-region announcement string (consumed by PulseComposer)
//   • Accept-full (Tab) and accept-word (→) primitives
//
// Failure is silent per spec: a thrown provider error logs and returns null.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geminiSmartComposeProvider } from './geminiSmartComposeProvider';
import type {
  SmartComposeProvider,
  SmartComposeSuggestion,
} from './types';

/** Debounce window per spec §A11y / Live regions for Smart Compose. */
const DEBOUNCE_MS = 600;

export interface UseSmartComposeResult {
  /** Current pending suggestion, or null when none is active. */
  suggestion: SmartComposeSuggestion | null;
  /** Live-region string for the polite aria-live announcer. */
  announcement: string;
  /** Accept the full suggestion — caller passes current text + setter. */
  acceptFull: (
    current: string,
    setValue: (next: string) => void,
  ) => string | null;
  /** Accept one word from the suggestion — useful for `→` at end-of-line. */
  acceptWord: (
    current: string,
    setValue: (next: string) => void,
  ) => string | null;
  /** Dismiss the current suggestion (Esc). */
  dismiss: () => void;
}

/**
 * useSmartCompose — owns debounce, abort, suggestion state, and accept
 * primitives. The textarea owns its own caret + value; this hook is
 * stateful only over the *suggestion* itself.
 */
export function useSmartCompose(
  value: string,
  provider: SmartComposeProvider | undefined,
  enabled: boolean,
): UseSmartComposeResult {
  const [suggestion, setSuggestion] = useState<SmartComposeSuggestion | null>(
    null,
  );
  // We re-key the announcer when a NEW suggestion arrives so polite
  // announcements actually fire (browsers ignore identical strings).
  const [announcement, setAnnouncement] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastValueRef = useRef<string>(value);

  const resolvedProvider = useMemo<SmartComposeProvider>(
    () => provider ?? geminiSmartComposeProvider,
    [provider],
  );

  // Cancel pending work whenever the value mutates.
  useEffect(() => {
    lastValueRef.current = value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (!enabled || !value) {
      setSuggestion(null);
      setAnnouncement('');
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const next = await resolvedProvider(value, controller.signal);
        if (controller.signal.aborted) return;
        // Drop stale suggestions whose anchor value has since changed.
        if (lastValueRef.current !== value) return;
        if (!next) {
          setSuggestion(null);
          setAnnouncement('');
          return;
        }
        setSuggestion(next);
        setAnnouncement(
          `Suggestion: ${next.completion.trim()}. Press Tab to accept.`,
        );
      } catch (err) {
        // Silent failure per spec.
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[useSmartCompose] provider error', err);
        }
        setSuggestion(null);
        setAnnouncement('');
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, enabled, resolvedProvider]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const dismiss = useCallback(() => {
    abortRef.current?.abort();
    setSuggestion(null);
    setAnnouncement('');
  }, []);

  const acceptFull = useCallback(
    (current: string, setValue: (next: string) => void): string | null => {
      if (!suggestion) return null;
      const next = current + suggestion.completion;
      setValue(next);
      setSuggestion(null);
      setAnnouncement('');
      return next;
    },
    [suggestion],
  );

  const acceptWord = useCallback(
    (current: string, setValue: (next: string) => void): string | null => {
      if (!suggestion) return null;
      // Take the first word (including its leading whitespace) so the
      // resulting text reads naturally — "I'll" → " I'll", " — I" → " —", etc.
      const match = suggestion.completion.match(/^\s*\S+/);
      if (!match) return null;
      const consumed = match[0];
      const remaining = suggestion.completion.slice(consumed.length);
      const next = current + consumed;
      setValue(next);
      if (remaining.trim().length === 0) {
        setSuggestion(null);
        setAnnouncement('');
      } else {
        const updated: SmartComposeSuggestion = {
          id: `${suggestion.id}-w${remaining.length}`,
          completion: remaining,
        };
        setSuggestion(updated);
        setAnnouncement(
          `Suggestion: ${updated.completion.trim()}. Press Tab to accept.`,
        );
      }
      return next;
    },
    [suggestion],
  );

  return { suggestion, announcement, acceptFull, acceptWord, dismiss };
}
