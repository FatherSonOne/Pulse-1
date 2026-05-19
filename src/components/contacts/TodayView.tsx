// ============================================
// TODAY VIEW
// The AI-curated daily relationship briefing feed.
// Shows prioritized action items derived from relationship intelligence.
// ============================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import {
  generateTodayFeed,
  completeFeedItem,
  snoozeFeedItem,
  dismissFeedItem,
  enrichFeedItemsWithAIDrafts,
  buildAutopilotFeedItems,
} from '../../services/todayFeedService';
import {
  TodayFeedItem,
  TodayFeedItemType,
  TodayFeedSuggestedAction,
} from '../../types/todayFeedTypes';
import { Contact } from '../../types';
import { getUpcomingActions } from '../../services/contactGoalService';
import { TodayFeedCard } from './TodayFeedCard';
import { TodayEmptyState } from './TodayEmptyState';
import { AnimatedIcon } from '../ui/AnimatedIcon';
// TodayRouteStrip lives under map/sub/ — it's a maps-stack consumer, not a
// contact-relationship feature. Phase 3 IA cleanup.
import TodayRouteStrip from '../map/sub/TodayRouteStrip';
import { getCurrentUserLocation } from '../../services/locationService';
import {
  clusterFeedItems,
  enrichClusterLabels,
  loadPlaceCoordsForItems,
  formatClusterDistance,
  FeedCluster,
} from '../../services/todayClusterService';

import { AlertCircle, Check, Clock, Clock3, MapPin } from 'lucide-react';

// ==================== TYPES ====================

interface TodayViewProps {
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  contacts?: Contact[];
}

type FilterChip = 'all' | TodayFeedItemType;

const FILTER_CHIPS: { id: FilterChip; label: string; icon: string }[] = [
  { id: 'all',              label: 'All',         icon: 'clipboard' },
  { id: 'follow_up',        label: 'Follow-ups',  icon: 'bell' },
  { id: 'hot_lead',         label: 'Hot Leads',   icon: 'fire' },
  { id: 'birthday',         label: 'Birthdays',   icon: 'star' },
  { id: 'cooling',          label: 'Cooling',     icon: 'signal' },
  { id: 'awaiting_response',label: 'Awaiting',    icon: 'email' },
];

const ITEMS_PER_PAGE = 7;

// Map TodayFeed action to the app's contact action type
function mapToContactAction(action: TodayFeedSuggestedAction): 'message' | 'vox' | 'meet' {
  if (action === 'vox') return 'vox';
  if (action === 'meeting') return 'meet';
  return 'message'; // message, call, email, review all route to messages
}

// ==================== COMPONENT ====================

type ViewMode = 'time' | 'route';

export const TodayView: React.FC<TodayViewProps> = ({ onAction, contacts = [] }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<TodayFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterChip>('all');
  const [showAll, setShowAll] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof localStorage === 'undefined') return 'time';
    return (localStorage.getItem('pulse:today:view-mode') as ViewMode) || 'time';
  });
  const [clusters, setClusters] = useState<FeedCluster[]>([]);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);

  // Resolve userId from Supabase auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // Load feed items, inject autopilot items, then enrich with AI drafts
  const loadFeed = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      // Phase 1: fast load with template drafts
      const feedItems = await generateTodayFeed(userId);

      // Phase 1b: inject autopilot items from due goals
      let allItems = feedItems;
      if (contacts.length > 0) {
        try {
          const dueGoals = await getUpcomingActions(userId);
          // Dedup by the source goal id stored in metadata (row `id` is now a random UUID).
          const existingSourceGoalIds = new Set(
            feedItems
              .map(i => i.metadata?.sourceGoalId as string | undefined)
              .filter((x): x is string => !!x),
          );
          const autopilotItems = buildAutopilotFeedItems(dueGoals, contacts, existingSourceGoalIds);
          if (autopilotItems.length > 0) {
            allItems = [...autopilotItems, ...feedItems].sort((a, b) => a.priority - b.priority);
          }
        } catch {
          // Goals unavailable — proceed without autopilot items
        }
      }

      setItems(allItems);
      setLoading(false);

      // Phase 2: upgrade drafts with AI in background (non-blocking)
      if (allItems.length > 0) {
        try {
          const enriched = await enrichFeedItemsWithAIDrafts(allItems);
          setItems(enriched);
        } catch {
          // AI enrichment failed — keep template drafts, no user-visible error
        }
      }
    } catch (err) {
      console.error('[TodayView] Failed to load feed:', err);
      setError('Could not load your feed. Please try again.');
      setLoading(false);
    }
  }, [userId, contacts]);

  useEffect(() => {
    if (userId) {
      loadFeed();
    }
  }, [userId, loadFeed, refreshKey]);

  // Handlers
  const handleAction = useCallback((action: TodayFeedSuggestedAction, contactId: string) => {
    onAction(mapToContactAction(action), contactId);
  }, [onAction]);

  const handleComplete = useCallback(async (itemId: string) => {
    if (!userId) return;
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'completed' as const } : i));
    await completeFeedItem(itemId, userId);
  }, [userId]);

  const handleSnooze = useCallback(async (itemId: string, until: Date) => {
    if (!userId) return;
    setItems(prev => prev.map(i =>
      i.id === itemId
        ? { ...i, status: 'snoozed' as const, snoozedUntil: until.toISOString() }
        : i
    ));
    await snoozeFeedItem(itemId, userId, until);
  }, [userId]);

  const handleDismiss = useCallback(async (itemId: string) => {
    if (!userId) return;
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'dismissed' as const } : i));
    await dismissFeedItem(itemId, userId);
  }, [userId]);

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const handleSetViewMode = useCallback((m: ViewMode) => {
    setViewMode(m);
    try { localStorage.setItem('pulse:today:view-mode', m); } catch { /* ignore */ }
  }, []);

  // Computed values — memoized so downstream useMemo/useEffect deps stay
  // referentially stable. Without this, `baseClusters` recomputes every
  // render and the route-mode effect below thrashes setClusters in a loop.
  const activeItems = useMemo(
    () => items.filter(i => i.status === 'active'),
    [items],
  );
  const completedCount = useMemo(
    () => items.filter(i => i.status === 'completed').length,
    [items],
  );
  const snoozedCount = useMemo(
    () => items.filter(i => i.status === 'snoozed').length,
    [items],
  );

  const filteredItems = useMemo(
    () => (filter === 'all' ? activeItems : activeItems.filter(i => i.itemType === filter)),
    [activeItems, filter],
  );

  const visibleItems = showAll ? filteredItems : filteredItems.slice(0, ITEMS_PER_PAGE);
  const hasMore = filteredItems.length > ITEMS_PER_PAGE && !showAll;

  // Lazy fetch user position once route view is requested — we don't ask
  // for geolocation permission unless the user actually opens route mode.
  useEffect(() => {
    if (viewMode !== 'route') return;
    if (userPosition) return;
    getCurrentUserLocation()
      .then(setUserPosition)
      .catch(() => { /* permission denied — clusters fall back to size sort */ });
  }, [viewMode, userPosition]);

  // Recompute clusters whenever the inputs change and route mode is active.
  // Labels load async; the structure renders immediately with `null` labels.
  const baseClusters = useMemo(
    () => clusterFeedItems(filteredItems, contacts, new Map(), userPosition),
    [filteredItems, contacts, userPosition],
  );

  useEffect(() => {
    if (viewMode !== 'route') return;
    let cancelled = false;
    setClusters(baseClusters);

    (async () => {
      // Resolve metadata.placeId references in one round-trip, rebuild
      // clusters with that richer location info, then enrich labels.
      const placeCoords = await loadPlaceCoordsForItems(filteredItems);
      if (cancelled) return;
      const richer = clusterFeedItems(filteredItems, contacts, placeCoords, userPosition);
      setClusters(richer);
      const labelled = await enrichClusterLabels(richer);
      if (!cancelled) setClusters([...labelled]);
    })();

    return () => { cancelled = true; };
  }, [viewMode, baseClusters, filteredItems, contacts, userPosition]);

  // ==================== RENDER ====================

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Your Day</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Relationships that need your attention
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Time / Route view mode toggle. Persisted to localStorage so
                returning users land back in their preferred view. */}
            <div className="flex rounded-lg overflow-hidden text-xs bg-zinc-100 dark:bg-zinc-800">
              <button
                onClick={() => handleSetViewMode('time')}
                aria-pressed={viewMode === 'time'}
                title="Sort by priority"
                className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${
                  viewMode === 'time'
                    ? 'bg-indigo-500 text-white'
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <Clock3 size={12} />
                Time
              </button>
              <button
                onClick={() => handleSetViewMode('route')}
                aria-pressed={viewMode === 'route'}
                title="Group by location"
                className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${
                  viewMode === 'route'
                    ? 'bg-indigo-500 text-white'
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <MapPin size={12} />
                Route
              </button>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
              title="Refresh feed"
            >
              <i className={`fa-solid fa-rotate-right text-sm ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Summary stats */}
        {!loading && (
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{activeItems.length}</span>
              {' '}action{activeItems.length !== 1 ? 's' : ''} today
            </span>
            {completedCount > 0 && (
              <>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  <Check className="mr-1" />{completedCount} done
                </span>
              </>
            )}
            {snoozedCount > 0 && (
              <>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  <Clock className="mr-1" />{snoozedCount} snoozed
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Filter chips */}
      {!loading && activeItems.length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto border-b border-zinc-100 dark:border-zinc-800">
          {FILTER_CHIPS.map(chip => {
            const count = chip.id === 'all'
              ? activeItems.length
              : activeItems.filter(i => i.itemType === chip.id).length;
            if (count === 0 && chip.id !== 'all') return null;
            return (
              <button
                key={chip.id}
                onClick={() => { setFilter(chip.id); setShowAll(false); }}
                className={`
                  flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors
                  ${filter === chip.id
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }
                `}
              >
                <AnimatedIcon icon={chip.icon} size={14} />
                <span>{chip.label}</span>
                {count > 0 && (
                  <span className={`
                    px-1 rounded-full text-xs
                    ${filter === chip.id
                      ? 'bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300'
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
                    }
                  `}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Feed content */}
      <div className="flex-1 overflow-y-auto">

        {/* B2: Today's geographic arc — events with locations + travel-time
            hints between consecutive stops. Renders nothing when no events
            with locations exist today, so it's invisible to operators who
            don't keep calendar events with addresses. */}
        <div className="px-4 pt-4">
          <TodayRouteStrip
            isDarkMode={typeof document !== 'undefined' && document.documentElement.classList.contains('dark')}
          />
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(n => (
              <div key={n} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-zinc-200 dark:bg-zinc-700 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/4" />
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4" />
                    <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2" />
                  </div>
                  <div className="w-24 h-7 bg-zinc-200 dark:bg-zinc-700 rounded-lg flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="p-4">
            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="text-rose-500" />
              <div className="flex-1">
                <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
              </div>
              <button
                onClick={handleRefresh}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredItems.length === 0 && (
          <TodayEmptyState onRefresh={handleRefresh} />
        )}

        {/* Feed items — Time view (default) */}
        {!loading && !error && viewMode === 'time' && visibleItems.length > 0 && (
          <div className="p-4 space-y-3">
            {visibleItems.map(item => (
              <TodayFeedCard
                key={item.id}
                item={item}
                onAction={handleAction}
                onSnooze={handleSnooze}
                onDismiss={handleDismiss}
                onComplete={handleComplete}
              />
            ))}

            {/* Show more button */}
            {hasMore && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full py-3 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-600"
              >
                Show {filteredItems.length - ITEMS_PER_PAGE} more
              </button>
            )}

            {/* Completed/snoozed note */}
            {(completedCount > 0 || snoozedCount > 0) && !showAll && (
              <p className="text-center text-xs text-zinc-400 dark:text-zinc-600 pt-2">
                {completedCount > 0 && `${completedCount} completed`}
                {completedCount > 0 && snoozedCount > 0 && ' · '}
                {snoozedCount > 0 && `${snoozedCount} snoozed`}
                {' '}this session
              </p>
            )}
          </div>
        )}

        {/* Feed items — Route view: items grouped by geographic cluster */}
        {!loading && !error && viewMode === 'route' && filteredItems.length > 0 && (
          <div className="p-4 space-y-5">
            {clusters.map(c => (
              <div key={c.id} className="space-y-2">
                <div className="flex items-baseline justify-between gap-2 px-1">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                    <MapPin size={12} className="text-indigo-500" />
                    {c.label === null
                      ? <span className="inline-block w-24 h-3 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
                      : c.label}
                    <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">
                      · {c.items.length}
                    </span>
                  </h3>
                  {c.distanceM != null && (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {formatClusterDistance(c.distanceM)}
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {c.items.map(item => (
                    <TodayFeedCard
                      key={item.id}
                      item={item}
                      onAction={handleAction}
                      onSnooze={handleSnooze}
                      onDismiss={handleDismiss}
                      onComplete={handleComplete}
                    />
                  ))}
                </div>
              </div>
            ))}

            {(completedCount > 0 || snoozedCount > 0) && (
              <p className="text-center text-xs text-zinc-400 dark:text-zinc-600 pt-2">
                {completedCount > 0 && `${completedCount} completed`}
                {completedCount > 0 && snoozedCount > 0 && ' · '}
                {snoozedCount > 0 && `${snoozedCount} snoozed`}
                {' '}this session
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TodayView;
