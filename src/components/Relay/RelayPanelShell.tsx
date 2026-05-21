import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ThemeClasses {
  modalOverlay: string;
  modalBg: string;
  text: string;
  textSecondary: string;
  btnGhost: string;
  border: string;
}

interface RelayPanelShellProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md';
  tc: ThemeClasses;
}

/**
 * Shared chrome for centered Relay panels (member picker, notification settings,
 * channel settings, mention picker). Same z, scrim, border, padding, mono-labeled
 * header, X close, optional footer area. The internals of each panel stay; only
 * the chrome unifies. See impeccable Phase 3 critique.
 */
export const RelayPanelShell: React.FC<RelayPanelShellProps> = ({
  open,
  onClose,
  label,
  children,
  footer,
  maxWidth = 'md',
  tc,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widthClass = maxWidth === 'sm' ? 'max-w-sm' : 'max-w-md';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={label}>
      <div className={tc.modalOverlay} onClick={onClose} />
      <div className={`relative w-full ${widthClass} rounded-2xl border ${tc.modalBg} p-5 flex flex-col`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-[11px] font-mono uppercase tracking-[0.1em] ${tc.textSecondary}`}>
            {label}
          </h3>
          <button
            onClick={onClose}
            className={`p-1 rounded-md ${tc.btnGhost}`}
            type="button"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="min-w-0">{children}</div>

        {footer && (
          <div className={`mt-5 pt-4 border-t ${tc.border}`}>{footer}</div>
        )}
      </div>
    </div>
  );
};

export default RelayPanelShell;
