import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, RotateCcw, Save, Share2, Trash2, X } from 'lucide-react';

interface BulkActionToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onShare: () => void;
  onArchive: () => void;
  onUnarchive?: () => void;
  onDelete: () => void;
  onSaveAsFilter: () => void;
  canShare: boolean;
  canDelete: boolean;
  isInArchivedView: boolean;
  affectsCircle?: string | null;
}

const buttonBase: React.CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  borderRadius: 10,
  border: '1px solid var(--pulse-border)',
};

export const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({
  selectedCount,
  onClearSelection,
  onShare,
  onArchive,
  onUnarchive,
  onDelete,
  onSaveAsFilter,
  canShare,
  canDelete,
  isInArchivedView,
  affectsCircle,
}) => {
  const { t } = useTranslation();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const actions = useMemo(() => {
    const items: Array<{ key: string; label: string; run: () => void; primary?: boolean; danger?: boolean; icon: React.ReactNode }> = [];
    if (canShare) {
      items.push({
        key: 'share',
        label: t('contacts.bulkToolbar.share_cta'),
        run: onShare,
        primary: true,
        icon: <Share2 size={16} aria-hidden="true" />,
      });
    }
    items.push({
      key: 'archive',
      label: isInArchivedView ? t('contacts.bulkToolbar.unarchive_cta') : t('contacts.bulkToolbar.archive_cta'),
      run: isInArchivedView && onUnarchive ? onUnarchive : onArchive,
      icon: isInArchivedView ? <RotateCcw size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />,
    });
    items.push({
      key: 'save-filter',
      label: t('contacts.bulkToolbar.save_filter_cta'),
      run: onSaveAsFilter,
      icon: <Save size={16} aria-hidden="true" />,
    });
    if (canDelete) {
      items.push({
        key: 'delete',
        label: t('contacts.bulkToolbar.delete_cta'),
        run: () => {
          if (selectedCount > 50) {
            const confirmed = window.confirm(
              `${t('contacts.bulkToolbar.delete_skip_confirm_title', { count: selectedCount })}\n\n${t('contacts.bulkToolbar.delete_skip_confirm_body')}`,
            );
            if (!confirmed) return;
          }
          onDelete();
        },
        danger: true,
        icon: <Trash2 size={16} aria-hidden="true" />,
      });
    }
    return items;
  }, [canDelete, canShare, isInArchivedView, onArchive, onDelete, onSaveAsFilter, onShare, onUnarchive, selectedCount, t]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.setTimeout(() => {
      const first = toolbarRef.current?.querySelector<HTMLButtonElement>('button[data-action]');
      first?.focus();
    }, 0);
    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClearSelection();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(toolbarRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    if (buttons.length === 0) return;
    const current = document.activeElement;
    const currentIndex = buttons.findIndex(button => button === current);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1)
      : (currentIndex === buttons.length - 1 ? 0 : currentIndex + 1);
    event.preventDefault();
    buttons[nextIndex]?.focus();
  };

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={t('contacts.bulkToolbar.toolbar_label')}
      onKeyDown={handleKeyDown}
      className="contacts-bulk-toolbar"
      style={{
        background: 'var(--pulse-surface-raised)',
        borderBottom: '1px solid var(--pulse-border)',
        boxShadow: 'var(--pulse-shadow-sm)',
      }}
    >
      <div className="contacts-bulk-toolbar__top">
        <span aria-live="polite" className="contacts-bulk-toolbar__count">
          {t('contacts.bulkToolbar.selected_count', { count: selectedCount })}
        </span>
        <span className="sr-only" aria-live="polite">
          {t('contacts.bulkToolbar.selected_count_aria', { count: selectedCount })}
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          title={t('contacts.bulkToolbar.clear_selection')}
          aria-label={t('contacts.bulkToolbar.clear_selection')}
          className="contacts-bulk-toolbar__icon-btn"
          style={buttonBase}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {affectsCircle && !isInArchivedView && (
        <div
          className="contacts-bulk-toolbar__note"
          role="alert"
          style={{
            background: 'var(--pulse-tone-info-soft)',
            color: 'var(--pulse-tone-info)',
            border: '1px solid var(--pulse-border)',
          }}
        >
          <span>{t('contacts.bulkToolbar.archive_circle_warning', { circle: affectsCircle })}</span>
          <button type="button" onClick={onArchive} style={buttonBase}>
            {t('contacts.bulkToolbar.continue_cta')}
          </button>
          <button type="button" onClick={onClearSelection} style={buttonBase}>
            {t('contacts.bulkToolbar.cancel_cta')}
          </button>
        </div>
      )}

      <div className="contacts-bulk-toolbar__actions">
        {actions.map(action => (
          <button
            key={action.key}
            type="button"
            data-action={action.key}
            onClick={action.run}
            className="contacts-bulk-toolbar__button"
            style={{
              ...buttonBase,
              background: action.primary
                ? 'var(--pulse-rose)'
                : action.danger
                ? 'var(--pulse-tone-overdue-soft)'
                : 'var(--pulse-surface)',
              color: action.primary
                ? 'var(--pulse-surface)'
                : action.danger
                ? 'var(--pulse-tone-overdue)'
                : 'var(--pulse-ink)',
            }}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BulkActionToolbar;
