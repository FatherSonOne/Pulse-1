import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Loader2, Users, X } from 'lucide-react';

interface WorkspaceShareModalProps {
  open: boolean;
  contactIds: string[];
  availableWorkspaces: Array<{ id: string; name: string }>;
  onShare: (workspaceId: string) => Promise<{ shared: number; failed: number }>;
  onCancel: () => void;
}

export const WorkspaceShareModal: React.FC<WorkspaceShareModalProps> = ({
  open,
  contactIds,
  availableWorkspaces,
  onShare,
  onCancel,
}) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [isSharing, setIsSharing] = useState(false);
  const titleId = 'workspace-share-title';
  const descriptionId = 'workspace-share-privacy';

  useEffect(() => {
    if (!open) return;
    setSelectedWorkspaceId(availableWorkspaces[0]?.id ?? '');
    window.setTimeout(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>('button, input, a');
      first?.focus();
    }, 0);
  }, [availableWorkspaces, open]);

  const selectedName = useMemo(
    () => availableWorkspaces.find(workspace => workspace.id === selectedWorkspaceId)?.name ?? '',
    [availableWorkspaces, selectedWorkspaceId],
  );

  const closeIfAllowed = () => {
    if (!isSharing) onCancel();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeIfAllowed();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') ?? [],
    );
    if (focusables.length === 0) return;
    const currentIndex = focusables.findIndex(el => el === document.activeElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1)
      : (currentIndex === focusables.length - 1 ? 0 : currentIndex + 1);
    event.preventDefault();
    focusables[nextIndex]?.focus();
  };

  const handleShare = async () => {
    if (!selectedWorkspaceId || isSharing) return;
    setIsSharing(true);
    try {
      await onShare(selectedWorkspaceId);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4"
          style={{ background: 'color-mix(in srgb, var(--pulse-ink) 70%, transparent)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={closeIfAllowed}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: 'var(--pulse-surface)' }}
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-start justify-between gap-4 p-5 border-b" style={{ borderColor: 'var(--pulse-border)' }}>
              <div>
                <h2 id={titleId} className="text-lg font-bold" style={{ color: 'var(--pulse-ink)' }}>
                  {t('contacts.workspaceShare.title')}
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
                  {t('contacts.workspaceShare.subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={closeIfAllowed}
                disabled={isSharing}
                className="inline-flex items-center justify-center rounded-lg"
                style={{ minWidth: 44, minHeight: 44, color: 'var(--pulse-ink-2)' }}
                aria-label={t('contacts.workspaceShare.cta_secondary')}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div
                id={descriptionId}
                className="rounded-lg border-l-4 p-3 text-sm"
                style={{
                  background: 'var(--pulse-tone-info-soft)',
                  borderLeftColor: 'var(--pulse-tone-info)',
                  color: 'var(--pulse-ink)',
                }}
              >
                {t('contacts.workspaceShare.privacy_disclaimer')}
              </div>

              {availableWorkspaces.length === 0 ? (
                <div className="rounded-lg p-4 text-sm" role="alert" style={{ background: 'var(--pulse-tone-warning-soft)', color: 'var(--pulse-ink)' }}>
                  <p>{t('contacts.workspaceShare.error_no_workspace')}</p>
                  <a href="#settings" className="mt-2 inline-flex underline" style={{ color: 'var(--pulse-rose)' }}>
                    {t('contacts.workspaceShare.settings_link')}
                  </a>
                </div>
              ) : (
                <>
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--pulse-ink-3)' }}>
                      {t('contacts.workspaceShare.picker_label')}
                    </div>
                    <div role="radiogroup" aria-label={t('contacts.workspaceShare.picker_label')} className="space-y-2">
                      {availableWorkspaces.map(workspace => (
                        <label
                          key={workspace.id}
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer"
                          style={{ minHeight: 44, borderColor: 'var(--pulse-border)' }}
                        >
                          <input
                            type="radio"
                            name="workspace-share"
                            checked={workspace.id === selectedWorkspaceId}
                            onChange={() => setSelectedWorkspaceId(workspace.id)}
                            className="h-5 w-5"
                          />
                          <span className="font-medium" style={{ color: 'var(--pulse-ink)' }}>{workspace.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
                    <Users size={16} aria-hidden="true" />
                    {t(contactIds.length === 1 ? 'contacts.workspaceShare.preview_label' : 'contacts.workspaceShare.preview_label_plural', {
                      count: contactIds.length,
                      workspace: selectedName,
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-5 border-t" style={{ borderColor: 'var(--pulse-border)' }}>
              <button
                type="button"
                onClick={closeIfAllowed}
                disabled={isSharing}
                className="px-4 rounded-lg font-semibold"
                style={{ minHeight: 44, color: 'var(--pulse-ink-2)' }}
              >
                {t('contacts.workspaceShare.cta_secondary')}
              </button>
              <button
                type="button"
                onClick={handleShare}
                disabled={!selectedWorkspaceId || isSharing}
                className="inline-flex items-center gap-2 px-4 rounded-lg font-semibold disabled:opacity-50"
                style={{ minHeight: 44, background: 'var(--pulse-rose)', color: 'var(--pulse-surface)' }}
              >
                {isSharing && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {t('contacts.workspaceShare.cta_primary', { count: contactIds.length })}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WorkspaceShareModal;
