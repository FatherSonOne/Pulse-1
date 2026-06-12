// useEmailHybridShortcuts — global keyboard hook for the hybrid email surface.
//
// Owns the shortcuts that aren't naturally tied to one component:
//   c       compose
//   ?       open keyboard shortcuts help
//   /       focus search (Phase 8 stub — toasts for now)
//   Shift+N refresh / sync (wired via onSync)
//   Ctrl+Z  undo last send (wired via onUndo; toast when nothing pending)
//   g i / g s / g t / g d   switch folder (wired via onGoToFolder)
//
// Mode-specific keys live where they belong:
//   E / H / T / R / ⌘↵   in TriageView (gated on mode === 'triage')
//   j / k / o / Enter    in SignalSection (gated on mode === 'cockpit')
//   ⌘E + Esc             in EmailHybridClient (mode toggle / mode-aware Esc)
//
// All listeners skip text inputs + bail when an overlay (composer / modal)
// has its own Esc handling.
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { isOverlayOpen } from '../../../../lib/overlayStack';
import { useEmailUIStore } from '../../../../store/emailUIStore';
import { useEmailComposeStore } from '../../../../store/emailComposeStore';

interface Options {
  onCompose: () => void;
  onHelp: () => void;
  /** Optional sync callback for Shift+N. If omitted, the keypress shows a phase-stub toast. */
  onSync?: () => void;
  /** Optional snooze trigger for B. If omitted, the keypress shows a phase-stub toast. */
  onSnoozeFocused?: () => void;
  /** Optional undo-last-send for Ctrl+Z. If omitted, the keypress shows a phase-stub toast. */
  onUndo?: () => void;
  /** Optional folder navigation for g i/s/t/d. If omitted, the keypress shows a phase-stub toast. */
  onGoToFolder?: (folder: 'inbox' | 'starred' | 'sent' | 'drafts') => void;
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useEmailHybridShortcuts({ onCompose, onHelp, onSync, onSnoozeFocused, onUndo, onGoToFolder }: Options): void {
  const showKeyboardShortcuts = useEmailUIStore((s) => s.showKeyboardShortcuts);
  const showEmailSettings = useEmailUIStore((s) => s.showEmailSettings);
  const showReauthModal = useEmailUIStore((s) => s.showReauthModal);
  const showComposer = useEmailComposeStore((s) => s.showComposer);

  // Single-key handler.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      if (isTextInputTarget(e.target)) return;
      if (isOverlayOpen()) return;
      if (showComposer || showKeyboardShortcuts || showEmailSettings || showReauthModal) return;

      const hasCtrl = e.ctrlKey || e.metaKey;
      const hasShift = e.shiftKey;

      switch (e.key.toLowerCase()) {
        case 'c':
          if (!hasCtrl && !hasShift) {
            e.preventDefault();
            onCompose();
          }
          break;
        case '?':
          e.preventDefault();
          onHelp();
          break;
        case '/':
          if (!hasCtrl) {
            e.preventDefault();
            const node =
              (window as unknown as { __hybridSearchInput?: HTMLInputElement }).__hybridSearchInput;
            if (node) {
              node.focus();
              node.select();
            }
          }
          break;
        case 'b':
          if (!hasCtrl && !hasShift) {
            e.preventDefault();
            if (onSnoozeFocused) onSnoozeFocused();
            else toast('Open an email first to snooze it.');
          }
          break;
        case 'n':
          if (hasShift) {
            e.preventDefault();
            if (onSync) onSync();
            else toast('Manual sync not available right now.');
          }
          break;
        case 'z':
          if (hasCtrl) {
            e.preventDefault();
            if (onUndo) onUndo();
            else toast('Undo is only available right after sending.');
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    onCompose, onHelp, onSync, onSnoozeFocused, onUndo,
    showComposer, showKeyboardShortcuts, showEmailSettings, showReauthModal,
  ]);

  // g <letter> two-step shortcut for folder navigation.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let gArmed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const disarm = () => {
      gArmed = false;
      if (timer) clearTimeout(timer);
      timer = null;
    };

    const handler = (e: KeyboardEvent) => {
      if (isTextInputTarget(e.target)) return;
      if (isOverlayOpen()) return;
      if (showComposer || showKeyboardShortcuts || showEmailSettings || showReauthModal) return;
      const hasCtrl = e.ctrlKey || e.metaKey;
      if (hasCtrl) return;

      const key = e.key.toLowerCase();
      if (!gArmed && key === 'g') {
        gArmed = true;
        timer = setTimeout(disarm, 1000);
        return;
      }
      if (gArmed) {
        if (key === 'i' || key === 's' || key === 't' || key === 'd') {
          e.preventDefault();
          const folder =
            key === 'i' ? 'inbox' : key === 's' ? 'starred' : key === 't' ? 'sent' : 'drafts';
          if (onGoToFolder) onGoToFolder(folder);
          else toast(`Go to ${folder} lands in Phase 6.`);
        }
        disarm();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      disarm();
    };
  }, [onGoToFolder, showComposer, showKeyboardShortcuts, showEmailSettings, showReauthModal]);
}
