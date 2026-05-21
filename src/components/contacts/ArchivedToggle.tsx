import React from 'react';
import { useTranslation } from 'react-i18next';
import { Archive } from 'lucide-react';

interface ArchivedToggleProps {
  showArchived: boolean;
  onToggle: (next: boolean) => void;
  archivedCount?: number;
}

export const ArchivedToggle: React.FC<ArchivedToggleProps> = ({
  showArchived,
  onToggle,
  archivedCount = 0,
}) => {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={showArchived}
      aria-label={t('contacts.archived.toggle_aria')}
      onClick={() => onToggle(!showArchived)}
      className="contacts-archived-toggle"
      style={{
        borderColor: 'var(--pulse-border)',
        color: 'var(--pulse-ink-2)',
      }}
    >
      <span className="contacts-archived-toggle__label">
        <Archive size={16} aria-hidden="true" />
        {t('contacts.archived.toggle_label')}
      </span>
      {archivedCount > 0 && (
        <span className="contacts-archived-toggle__badge">{archivedCount}</span>
      )}
      <span
        className="contacts-archived-toggle__track"
        style={{
          background: showArchived ? 'var(--pulse-rose-soft)' : 'var(--pulse-surface)',
          borderColor: 'var(--pulse-border)',
        }}
        aria-hidden="true"
      >
        <span
          className="contacts-archived-toggle__thumb"
          style={{ background: showArchived ? 'var(--pulse-rose)' : 'var(--pulse-ink-3)' }}
        />
      </span>
    </button>
  );
};

export default ArchivedToggle;
