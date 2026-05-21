import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit2, Filter, Lock, MoreVertical, Trash2 } from 'lucide-react';
import type { SavedFilter } from '../../services/savedFiltersService';
import { useWorkspaceData } from '../../contexts/WorkspaceContext';
import { supabase } from '../../services/supabase';

interface SavedFiltersPanelProps {
  userFilters: SavedFilter[];
  workspaceFilters: SavedFilter[];
  activeFilterId: string | null;
  onSelectFilter: (id: string | null) => void;
  onSaveCurrent: (draft?: { name: string; scope: 'personal' | 'workspace' }) => void;
  onEditFilter: (id: string) => void;
  onDeleteFilter: (id: string) => void;
  canEditWorkspaceFilters: boolean;
  orphanedConditionsByFilterId: Record<string, number>;
}

export const SavedFiltersPanel: React.FC<SavedFiltersPanelProps> = ({
  userFilters,
  workspaceFilters,
  activeFilterId,
  onSelectFilter,
  onSaveCurrent,
  onEditFilter,
  onDeleteFilter,
  canEditWorkspaceFilters,
  orphanedConditionsByFilterId,
}) => {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspaceData();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'personal' | 'workspace'>('personal');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const sections = useMemo(() => [
    { key: 'mine', title: t('contacts.savedFilters.section_mine'), filters: userFilters },
    { key: 'workspace', title: t('contacts.savedFilters.section_workspace'), filters: workspaceFilters },
  ], [t, userFilters, workspaceFilters]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSaveCurrent({ name: name.trim(), scope });
    setSaveOpen(false);
    setName('');
    setScope('personal');
  };

  const renderFilter = (filter: SavedFilter, workspaceScoped: boolean) => {
    const orphanCount = orphanedConditionsByFilterId[filter.id] ?? 0;
    const readOnly = workspaceScoped && !canEditWorkspaceFilters && filter.user_id !== currentUserId;
    const deleteLabel = t('contacts.savedFilters.delete_confirm', { name: filter.name });

    return (
      <div key={filter.id} className="contacts-saved-filter-row">
        <button
          type="button"
          role="radio"
          aria-checked={activeFilterId === filter.id}
          onClick={() => onSelectFilter(activeFilterId === filter.id ? null : filter.id)}
          className={`contacts-saved-filter-row__select ${activeFilterId === filter.id ? 'active' : ''}`}
        >
          <Filter size={14} aria-hidden="true" />
          <span className="contacts-saved-filter-row__name">{filter.name}</span>
          {readOnly && (
            <Lock size={13} aria-label={t('contacts.savedFilters.read_only_hint')} />
          )}
          {orphanCount > 0 && (
            <span
              className="contacts-saved-filter-row__orphan"
              role="status"
              title={t('contacts.savedFilters.orphan_tooltip')}
              aria-label={t(orphanCount === 1 ? 'contacts.savedFilters.orphan_badge' : 'contacts.savedFilters.orphan_badge_plural', { count: orphanCount })}
              style={{ background: 'var(--pulse-tone-warning-soft)', color: 'var(--pulse-tone-warning)' }}
            >
              {t(orphanCount === 1 ? 'contacts.savedFilters.orphan_badge' : 'contacts.savedFilters.orphan_badge_plural', { count: orphanCount })}
            </span>
          )}
        </button>
        <div className="contacts-saved-filter-row__menu" aria-label={filter.name}>
          <MoreVertical size={14} aria-hidden="true" />
          <button
            type="button"
            onClick={() => onEditFilter(filter.id)}
            disabled={readOnly}
            aria-label={`${t('contacts.savedFilters.save_dialog_title')}: ${filter.name}`}
          >
            <Edit2 size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(deleteLabel)) onDeleteFilter(filter.id);
            }}
            disabled={readOnly}
            aria-label={deleteLabel}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <section
      role="region"
      aria-label={t('contacts.savedFilters.panel_label')}
      className="contacts-saved-filters"
      style={{ borderColor: 'var(--pulse-border)' }}
    >
      <div className="contacts-saved-filters__header">
        <span>{t('contacts.savedFilters.section_mine')}</span>
        <button type="button" onClick={() => setSaveOpen(true)}>
          {t('contacts.savedFilters.save_dialog_cta')}
        </button>
      </div>

      {saveOpen && (
        <form className="contacts-saved-filters__dialog" onSubmit={handleSubmit}>
          <label>
            <span>{t('contacts.savedFilters.save_dialog_name_label')}</span>
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder={t('contacts.savedFilters.save_dialog_name_placeholder')}
              autoFocus
            />
          </label>
          <div className="contacts-saved-filters__scope">
            <label>
              <input type="radio" checked={scope === 'personal'} onChange={() => setScope('personal')} />
              {t('contacts.savedFilters.save_dialog_scope_personal')}
            </label>
            <label aria-disabled={!currentWorkspace}>
              <input
                type="radio"
                checked={scope === 'workspace'}
                disabled={!currentWorkspace}
                onChange={() => setScope('workspace')}
              />
              {t('contacts.savedFilters.save_dialog_scope_workspace')}
            </label>
          </div>
          <div className="contacts-saved-filters__dialog-actions">
            <button type="button" onClick={() => setSaveOpen(false)}>
              {t('contacts.workspaceShare.cta_secondary')}
            </button>
            <button type="submit" disabled={!name.trim()}>
              {t('contacts.savedFilters.save_dialog_cta')}
            </button>
          </div>
        </form>
      )}

      <div role="radiogroup" aria-label={t('contacts.savedFilters.panel_label')} className="contacts-saved-filters__groups">
        {sections.map(section => (
          <div key={section.key} className="contacts-saved-filters__section">
            <div className="contacts-saved-filters__section-title">{section.title}</div>
            {section.filters.length === 0 ? (
              <p className="contacts-saved-filters__empty">{t('contacts.savedFilters.empty')}</p>
            ) : (
              section.filters.map(filter => renderFilter(filter, section.key === 'workspace'))
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default SavedFiltersPanel;
