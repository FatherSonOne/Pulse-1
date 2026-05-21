import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export type ConfirmSeverity = 'warning' | 'destructive';

interface ConfirmActionDialogProps {
  isOpen: boolean;
  severity: ConfirmSeverity;
  title: string;
  /** Short body paragraph — the *why* and *what's affected*, not a re-statement of the title. */
  description: React.ReactNode;
  /** Optional small note shown below the body in a soft tinted box (e.g. "they lose access to N channels"). */
  detail?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable Yes/No confirmation dialog for destructive or cautionary actions.
 * Replaces native `confirm()` so we get role-aware copy, dark mode, focus
 * management, and a consistent visual language with the rest of the project.
 *
 * Modeled after DeleteWorkspaceDialog but without the type-name gate — that
 * gate is right for once-per-workspace deletion, overkill for everyday
 * actions like "remove a member" or "revoke a pending invite".
 *
 * Severity controls the colour theme:
 *   - 'warning'      → amber (data is recoverable / the affected party hadn't yet joined)
 *   - 'destructive'  → red (immediate loss of access, hard to reverse)
 */
export const ConfirmActionDialog: React.FC<ConfirmActionDialogProps> = ({
  isOpen,
  severity,
  title,
  description,
  detail,
  confirmLabel,
  cancelLabel = 'Cancel',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const isDestructive = severity === 'destructive';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm p-4"
      onClick={isLoading ? undefined : onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-action-title"
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full border border-zinc-200 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDestructive ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
            }`}>
              <AlertTriangle className={`w-5 h-5 ${
                isDestructive ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
              }`} />
            </div>
            <h3 id="confirm-action-title" className="text-lg font-bold text-zinc-900 dark:text-white">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
          {detail && (
            <div className={`rounded-lg p-3 border text-xs ${
              isDestructive
                ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-400'
                : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-400'
            }`}>
              {detail}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            autoFocus
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {isLoading ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
