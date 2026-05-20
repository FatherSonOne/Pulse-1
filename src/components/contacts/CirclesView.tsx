// ============================================
// CIRCLES VIEW
// The network visualization mode for Contacts Reimagined.
// Shows contact circles as interactive bubbles with health scores,
// supports auto-detection, custom circles, and bulk actions.
// ============================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatedIcon } from '../ui/AnimatedIcon';
import { Contact } from '../../types';
import { RelationshipProfile } from '../../types/relationshipTypes';
import {
  ContactCircle,
  getCircleColorForIndex,
} from '../../types/contactCircleTypes';
import {
  getCircles,
  createCircle,
  deleteCircle,
  autoDetectCircles,
  getOrphanContacts,
} from '../../services/contactCircleService';
import { relationshipIntelligenceService } from '../../services/relationshipIntelligenceService';
import { supabase } from '../../services/supabase';
import { CircleBubbleChart } from './CircleBubbleChart';
import { CircleDetail } from './CircleDetail';
import { NetworkAnalyticsCard } from './NetworkAnalyticsCard';

import { Loader2, Plus, Wand2 } from 'lucide-react';

// ==================== TYPES ====================

interface CirclesViewProps {
  contacts: Contact[];
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  onContactClick?: (contact: Contact) => void;
}

// ==================== NEW CIRCLE MODAL ====================

interface NewCircleModalProps {
  onSave: (name: string, color: string) => void;
  onClose: () => void;
}

const NewCircleModal: React.FC<NewCircleModalProps> = ({ onSave, onClose }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100 mb-4">New Circle</h3>

        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSave(name.trim(), color); }}
          placeholder="Circle name…"
          className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-rose-500 mb-4"
        />

        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs text-zinc-400">Color:</span>
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-offset-1 ring-zinc-700 dark:ring-zinc-200 scale-110' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => name.trim() && onSave(name.trim(), color)}
            disabled={!name.trim()}
            className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Create Circle
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== MAIN COMPONENT ====================

export const CirclesView: React.FC<CirclesViewProps> = ({
  contacts,
  onAction,
  onContactClick,
}) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [circles, setCircles] = useState<ContactCircle[]>([]);
  const [profiles, setProfiles] = useState<RelationshipProfile[]>([]);
  const [orphans, setOrphans] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [selectedCircle, setSelectedCircle] = useState<ContactCircle | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [suggestions, setSuggestions] = useState<Omit<ContactCircle, 'id' | 'createdAt' | 'updatedAt'>[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 600, height: 440 });

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Measure container for chart sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setChartSize({ width: Math.max(300, width), height: Math.max(300, height - 60) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Load circles + profiles
  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [fetchedCircles, fetchedProfiles] = await Promise.all([
        getCircles(userId),
        relationshipIntelligenceService.getProfiles({ userId }),
      ]);
      setCircles(fetchedCircles);
      setProfiles(fetchedProfiles);
      const orphanContacts = await getOrphanContacts(userId, contacts);
      setOrphans(orphanContacts);
    } catch (err) {
      console.error('[CirclesView] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, contacts]);

  useEffect(() => {
    if (userId) loadData();
  }, [userId, loadData]);

  // Auto-detect circles
  const handleAutoDetect = useCallback(async () => {
    if (!userId || detecting) return;
    setDetecting(true);
    try {
      const detected = await autoDetectCircles(userId, contacts);
      if (detected.length === 0) {
        alert('No groups detected. Try adding company information to your contacts.');
      } else {
        setSuggestions(detected);
        setShowSuggestions(true);
      }
    } catch (err) {
      console.error('[CirclesView] autoDetect error:', err);
    } finally {
      setDetecting(false);
    }
  }, [userId, contacts, detecting]);

  // Accept a suggestion
  const handleAcceptSuggestion = useCallback(async (
    suggestion: Omit<ContactCircle, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!userId) return;
    const newCircle = await createCircle(suggestion);
    setCircles(prev => [...prev, newCircle]);
    setSuggestions(prev => prev.filter(s => s.name !== suggestion.name));
    const updatedOrphans = await getOrphanContacts(userId, contacts);
    setOrphans(updatedOrphans);
  }, [userId, contacts]);

  const handleAcceptAllSuggestions = useCallback(async () => {
    for (const s of suggestions) {
      await handleAcceptSuggestion(s);
    }
    setShowSuggestions(false);
  }, [suggestions, handleAcceptSuggestion]);

  // Create new circle
  const handleCreateCircle = useCallback(async (name: string, color: string) => {
    if (!userId) return;
    setShowNewModal(false);
    const newCircle = await createCircle({
      userId,
      name,
      color,
      source: 'manual',
      memberContactIds: [],
    });
    setCircles(prev => [...prev, newCircle]);
  }, [userId]);

  const handleCircleUpdated = (updated: ContactCircle) => {
    setCircles(prev => prev.map(c => c.id === updated.id ? updated : c));
    if (selectedCircle?.id === updated.id) setSelectedCircle(updated);
  };

  const handleCircleDeleted = async (circleId: string) => {
    setCircles(prev => prev.filter(c => c.id !== circleId));
    setSelectedCircle(null);
    if (userId) {
      const updatedOrphans = await getOrphanContacts(userId, contacts);
      setOrphans(updatedOrphans);
    }
  };

  const totalContacts = contacts.length;
  const organizedCount = totalContacts - orphans.length;

  // ==================== RENDER ====================

  return (
    <div className="flex flex-col h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">Circles</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {circles.length} circle{circles.length !== 1 ? 's' : ''} ·{' '}
              {organizedCount} / {totalContacts} contacts organised
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Auto-detect */}
            <button
              onClick={handleAutoDetect}
              disabled={detecting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 uppercase tracking-[0.1em]"
              style={{
                background: 'var(--pulse-rose-soft)',
                color: 'var(--pulse-rose-deep)',
                fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
              }}
            >
              {detecting ? (
                <Loader2 className="animate-spin text-xs" />
              ) : (
                <Wand2 className="text-xs" />
              )}
              {detecting ? 'Detecting…' : 'Auto-detect'}
            </button>
            {/* New circle */}
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg text-xs font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <Plus className="text-xs" />
              New Circle
            </button>
          </div>
        </div>

        {/* Sidebar circle list (chips) */}
        {circles.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {circles.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCircle(c)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  selectedCircle?.id === c.id
                    ? 'border-transparent text-white'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900'
                }`}
                style={selectedCircle?.id === c.id ? { backgroundColor: c.color } : undefined}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                {c.name}
                <span className={`ml-0.5 ${selectedCircle?.id === c.id ? 'text-white/70' : 'text-zinc-400'}`}>
                  {c.memberContactIds.length}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AI Suggestions Banner */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className="flex-shrink-0 mx-4 mt-3 p-3 rounded-xl border"
          style={{
            background: 'var(--pulse-rose-softer)',
            borderColor: 'var(--pulse-rose-soft)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.1em] flex items-center gap-1.5"
              style={{
                color: 'var(--pulse-rose-deep)',
                fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
              }}
            >
              <AnimatedIcon icon="sparkle" size={14} /> Pulse AI · {suggestions.length} circle{suggestions.length !== 1 ? 's' : ''} found
            </p>
            <button
              onClick={() => setShowSuggestions(false)}
              className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
            >
              Dismiss
            </button>
          </div>
          <div className="space-y-1.5 mb-2 max-h-36 overflow-y-auto">
            {suggestions.map(s => (
              <div key={s.name} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-sm text-zinc-800 dark:text-zinc-100 font-medium truncate">{s.name}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{s.memberContactIds.length} contacts</span>
                </div>
                <button
                  onClick={() => handleAcceptSuggestion(s)}
                  className="flex-shrink-0 text-xs text-rose-600 dark:text-rose-400 font-medium hover:underline"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={handleAcceptAllSuggestions}
            className="w-full py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Accept all {suggestions.length} circles
          </button>
        </div>
      )}

      {/* Network Analytics */}
      {!loading && circles.length > 0 && (
        <div className="flex-shrink-0 px-4 pt-3">
          <NetworkAnalyticsCard
            circles={circles}
            contacts={contacts}
            profiles={profiles}
            orphanCount={orphans.length}
          />
        </div>
      )}

      {/* Main area: bubble chart */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-zinc-500">Loading your network…</p>
            </div>
          </div>
        ) : (
          <CircleBubbleChart
            circles={circles}
            contacts={contacts}
            profiles={profiles}
            onCircleClick={setSelectedCircle}
            onContactClick={onContactClick}
            width={chartSize.width}
            height={chartSize.height}
          />
        )}

        {/* Orphan contacts banner */}
        {!loading && orphans.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {orphans.length} contact{orphans.length !== 1 ? 's' : ''} not in any circle
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Use Auto-detect to organise them automatically
              </p>
            </div>
            <button
              onClick={handleAutoDetect}
              disabled={detecting}
              className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ml-4"
            >
              Organise
            </button>
          </div>
        )}
      </div>

      {/* Circle Detail slideout */}
      {selectedCircle && (
        <CircleDetail
          circle={selectedCircle}
          contacts={contacts}
          profiles={profiles}
          onClose={() => setSelectedCircle(null)}
          onCircleUpdated={handleCircleUpdated}
          onCircleDeleted={handleCircleDeleted}
          onContactClick={contact => { onContactClick?.(contact); }}
          onBulkMessage={circle => {
            // Route to messages for first member as representative action
            if (circle.memberContactIds.length > 0) {
              onAction('message', circle.memberContactIds[0]);
            }
          }}
        />
      )}

      {/* New circle modal */}
      {showNewModal && (
        <NewCircleModal
          onSave={handleCreateCircle}
          onClose={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
};

export default CirclesView;
