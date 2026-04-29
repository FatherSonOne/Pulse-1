/**
 * TagPills + TagPicker
 *
 * Phase 7b — UI for the tags feature backed by `tagsService`
 * (Session 7a schema + this session's service).
 *
 *   <TagPills tags={tags} onRemove?={...} compact?={true} />
 *
 *     Renders an inline strip of colored tag pills. Optional remove
 *     button (X) on each pill if `onRemove` is provided. Compact mode
 *     drops to dot-only for dense rows like the thread list.
 *
 *   <TagPicker workspaceId conversationKind conversationId
 *              currentTags onChanged />
 *
 *     Popover-style picker. Lists workspace tags with checkboxes,
 *     supports search, supports inline "Create new tag" if the search
 *     doesn't match anything. Calls `onChanged()` after each change so
 *     the parent can refetch.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Search, Tag, X } from 'lucide-react';
import {
  tagsService,
  type ConversationKind,
  type TagDefinition,
} from '../../services/tagsService';

// ──────────────────────────────────────────────────────────────
// TagPills — inline display
// ──────────────────────────────────────────────────────────────

interface TagPillsProps {
  tags: TagDefinition[];
  /** If provided, each pill shows a remove (×) button. */
  onRemove?: (tagId: string) => void | Promise<void>;
  /** Compact = dot only with tooltip; useful for cramped rows. */
  compact?: boolean;
  /** Maximum pills to render before showing "+N more". 0 = no limit. */
  max?: number;
  className?: string;
}

export const TagPills: React.FC<TagPillsProps> = ({
  tags,
  onRemove,
  compact = false,
  max = 0,
  className = '',
}) => {
  if (tags.length === 0) return null;

  const visible = max > 0 ? tags.slice(0, max) : tags;
  const overflow = max > 0 && tags.length > max ? tags.length - max : 0;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {visible.map((t) => (
        <Pill
          key={t.id}
          tag={t}
          compact={compact}
          onRemove={onRemove ? () => onRemove(t.id) : undefined}
        />
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 px-1.5">
          +{overflow}
        </span>
      )}
    </div>
  );
};

const Pill: React.FC<{
  tag: TagDefinition;
  compact: boolean;
  onRemove?: () => void | Promise<void>;
}> = ({ tag, compact, onRemove }) => {
  if (compact) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: tag.color }}
        title={tag.name}
      />
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
      style={{
        backgroundColor: `${tag.color}20`, // ~12% opacity
        borderColor: `${tag.color}40`,
        color: tag.color,
      }}
      title={tag.description ?? tag.name}
    >
      <span>{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void onRemove();
          }}
          className="hover:opacity-70 transition-opacity"
          aria-label={`Remove tag ${tag.name}`}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
};

// ──────────────────────────────────────────────────────────────
// TagPicker — popover for adding/removing tags on a conversation
// ──────────────────────────────────────────────────────────────

interface TagPickerProps {
  workspaceId: string;
  conversationKind: ConversationKind;
  conversationId: string;
  /** Tags currently applied. Passed in so the picker can show
   *  checkmarks without re-fetching; the parent typically already has
   *  this data. */
  currentTags: TagDefinition[];
  /** Called after any apply/remove succeeds. */
  onChanged?: () => void;
  className?: string;
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#94a3b8', // slate (default)
];

export const TagPicker: React.FC<TagPickerProps> = ({
  workspaceId,
  conversationKind,
  conversationId,
  currentTags,
  onChanged,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [definitions, setDefinitions] = useState<TagDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [createColor, setCreateColor] = useState(PRESET_COLORS[0]);
  const [pendingTagId, setPendingTagId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentIds = useMemo(
    () => new Set(currentTags.map((t) => t.id)),
    [currentTags],
  );

  // Load workspace tag definitions when the popover opens.
  useEffect(() => {
    if (!open || !workspaceId) return;
    setLoading(true);
    void tagsService
      .listDefinitions(workspaceId)
      .then((rows) => setDefinitions(rows))
      .catch((err) => console.error('[TagPicker] list failed:', err))
      .finally(() => setLoading(false));
  }, [open, workspaceId]);

  // Focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    } else {
      setQuery('');
      setCreating(false);
    }
  }, [open]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const t = window.setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return definitions;
    const q = query.toLowerCase();
    return definitions.filter((d) => d.name.toLowerCase().includes(q));
  }, [definitions, query]);

  const exactMatch = useMemo(
    () => definitions.find((d) => d.name.toLowerCase() === query.trim().toLowerCase()),
    [definitions, query],
  );

  const handleToggle = async (tag: TagDefinition) => {
    if (pendingTagId) return;
    setPendingTagId(tag.id);
    try {
      if (currentIds.has(tag.id)) {
        await tagsService.removeTag(tag.id, conversationId);
      } else {
        await tagsService.applyTag({
          tagId: tag.id,
          conversationKind,
          conversationId,
        });
      }
      onChanged?.();
    } catch (err) {
      console.error('[TagPicker] toggle failed:', err);
    } finally {
      setPendingTagId(null);
    }
  };

  const handleCreate = async () => {
    const name = query.trim();
    if (!name) return;
    try {
      const newTag = await tagsService.createDefinition({
        workspaceId,
        name,
        color: createColor,
      });
      setDefinitions((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
      // Auto-apply the newly created tag
      await tagsService.applyTag({
        tagId: newTag.id,
        conversationKind,
        conversationId,
      });
      onChanged?.();
      setQuery('');
      setCreating(false);
    } catch (err) {
      console.error('[TagPicker] create failed:', err);
    }
  };

  const showCreateRow = query.trim() && !exactMatch && !loading;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-12 h-12 flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        title="Tag this conversation"
        aria-label="Tag this conversation"
        aria-expanded={open}
      >
        <Tag className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden"
          role="dialog"
        >
          {/* Search */}
          <div className="p-2 border-b border-zinc-200 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search or create tag…"
                className="w-full pl-7 pr-2 py-1.5 text-sm rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-rose-500/30"
              />
            </div>
          </div>

          {/* Tag list */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Loading…
              </div>
            ) : filtered.length === 0 && !showCreateRow ? (
              <div className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No tags yet. Type a name to create one.
              </div>
            ) : (
              <div className="py-1">
                {filtered.map((tag) => {
                  const applied = currentIds.has(tag.id);
                  const busy = pendingTagId === tag.id;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => void handleToggle(tag)}
                      disabled={!!pendingTagId}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50 disabled:cursor-wait"
                      role="menuitem"
                    >
                      <span
                        className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-left text-zinc-900 dark:text-zinc-100 truncate">
                        {tag.name}
                      </span>
                      {applied && !busy && (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                      {busy && (
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Create row */}
          {showCreateRow && !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 border-t border-zinc-200 dark:border-zinc-800 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create &ldquo;{query.trim()}&rdquo;</span>
            </button>
          )}

          {showCreateRow && creating && (
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Pick a color for &ldquo;{query.trim()}&rdquo;:
              </div>
              <div className="flex items-center gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCreateColor(c)}
                    className={`w-5 h-5 rounded-full transition ${
                      createColor === c ? 'ring-2 ring-offset-2 ring-zinc-900 dark:ring-zinc-100 dark:ring-offset-zinc-900' : ''
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  className="flex-1 px-3 py-1.5 text-xs rounded-md bg-rose-500 text-white hover:bg-rose-600 transition"
                >
                  Create &amp; apply
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="px-3 py-1.5 text-xs rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TagPills;
