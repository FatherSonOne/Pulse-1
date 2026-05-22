import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Lock, UserPlus, UsersRound, WifiOff, X } from 'lucide-react';
import {
  discoverPulseUsers,
  DiscoveredPulseUser,
  PulseUserDiscoveryError,
} from '../../services/pulseUserDiscoveryService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onAdd: (user: DiscoveredPulseUser) => Promise<void> | void;
}

type SheetState =
  | { kind: 'loading' }
  | { kind: 'results'; users: DiscoveredPulseUser[] }
  | { kind: 'empty' }
  | { kind: 'error'; code: 'forbidden' | 'network' | 'unexpected' };

const SKELETON_COUNT = 3;

function AvatarFallback({ name }: { name: string | null | undefined }) {
  const initials = (name ?? '')
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
      style={{ background: 'var(--pulse-tone-info-soft)', color: 'var(--pulse-tone-info)' }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export function FindTeammatesSheet({ isOpen, onClose, workspaceId, onAdd }: Props) {
  const [state, setState] = useState<SheetState>({ kind: 'loading' });
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) {
      setState({ kind: 'error', code: 'forbidden' });
      return;
    }
    setState({ kind: 'loading' });
    try {
      const { users } = await discoverPulseUsers({ workspaceId });
      setState(users.length === 0 ? { kind: 'empty' } : { kind: 'results', users });
    } catch (err) {
      if (err instanceof PulseUserDiscoveryError) {
        const code = err.code === 'forbidden' ? 'forbidden' : err.code === 'unauthenticated' ? 'forbidden' : 'network';
        setState({ kind: 'error', code });
      } else {
        setState({ kind: 'error', code: 'unexpected' });
      }
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!isOpen) return;
    triggerRef.current = document.activeElement as HTMLElement;
    load();
  }, [isOpen, load]);

  // focus close button on open
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => closeButtonRef.current?.focus(), 50);
      return () => clearTimeout(t);
    } else {
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  // trap focus inside sheet
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleAdd = async (user: DiscoveredPulseUser) => {
    if (addingId || addedIds.has(user.user_id)) return;
    setAddingId(user.user_id);
    try {
      await onAdd(user);
      setAddedIds((prev) => new Set(prev).add(user.user_id));
    } finally {
      setAddingId(null);
    }
  };

  if (!isOpen) return null;

  const sheetStyle: React.CSSProperties = {
    background: 'var(--pulse-surface)',
    border: '1px solid var(--pulse-border)',
    boxShadow: 'var(--pulse-shadow-md)',
    color: 'var(--pulse-ink)',
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="find-teammates-title"
        className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col"
        style={{ ...sheetStyle, maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--pulse-border)' }}>
          <div>
            <h2 id="find-teammates-title" className="text-lg font-semibold">Teammates on Pulse</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--pulse-ink-3)' }}>In this workspace</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--pulse-ink-3)' }}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {state.kind === 'loading' && (
            <ul aria-busy="true" aria-label="Loading teammates" className="p-3 space-y-1">
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 p-3 rounded-xl min-h-[48px]">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 animate-pulse" style={{ background: 'var(--pulse-tone-neutral-soft)' }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded w-2/3 animate-pulse" style={{ background: 'var(--pulse-tone-neutral-soft)' }} />
                    <div className="h-2.5 rounded w-1/3 animate-pulse" style={{ background: 'var(--pulse-tone-neutral-soft)' }} />
                  </div>
                  <div className="h-7 w-12 rounded-lg animate-pulse flex-shrink-0" style={{ background: 'var(--pulse-tone-neutral-soft)' }} />
                </li>
              ))}
            </ul>
          )}

          {state.kind === 'results' && (
            <ul className="p-3 space-y-1">
              {state.users.map((user) => {
                const isAdded = addedIds.has(user.user_id) || user.already_in_contacts;
                const isAdding = addingId === user.user_id;
                return (
                  <li key={user.user_id} className="flex items-center gap-3 p-3 rounded-xl min-h-[48px]">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" aria-hidden="true" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <AvatarFallback name={user.display_name} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: 'var(--pulse-ink)' }}>{user.display_name ?? 'Pulse User'}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {user.handle && (
                          <span className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>@{user.handle}</span>
                        )}
                        <span
                          className="text-xs rounded-full px-1.5 py-0 leading-5"
                          style={{ background: 'var(--pulse-tone-neutral-soft)', color: 'var(--pulse-tone-neutral)' }}
                        >
                          {user.shared_workspace_role}
                        </span>
                      </div>
                    </div>
                    {isAdded ? (
                      <span className="text-xs px-2" style={{ color: 'var(--pulse-ink-3)' }} aria-label={`Already added: ${user.display_name}`} aria-disabled="true">Added</span>
                    ) : (
                      <button
                        type="button"
                        disabled={isAdding}
                        onClick={() => handleAdd(user)}
                        aria-label={`Add ${user.display_name} to contacts`}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-opacity min-h-[32px]"
                        style={{ background: 'var(--pulse-tone-info-soft)', color: 'var(--pulse-ink)', opacity: isAdding ? 0.6 : 1 }}
                      >
                        <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                        {isAdding ? '…' : 'Add'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {state.kind === 'empty' && (
            <div role="status" className="flex flex-col items-center text-center p-8 gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--pulse-tone-info-soft)' }}>
                <UsersRound className="w-6 h-6" style={{ color: 'var(--pulse-tone-info)' }} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--pulse-ink)' }}>Your workspace is just you, for now.</p>
                <p className="text-xs mt-1" style={{ color: 'var(--pulse-ink-2)' }}>Nobody else has joined yet. Invite someone and they'll show up here.</p>
              </div>
              <button
                type="button"
                className="px-4 py-2.5 rounded-xl text-sm font-medium border min-h-[44px]"
                style={{ borderColor: 'var(--pulse-tone-info)', color: 'var(--pulse-ink)' }}
                onClick={() => window.dispatchEvent(new CustomEvent('pulse:workspace:invite'))}
              >
                Invite a teammate
              </button>
            </div>
          )}

          {state.kind === 'error' && state.code === 'forbidden' && (
            <div className="flex flex-col items-center text-center p-8 gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--pulse-tone-neutral-soft)' }}>
                <Lock className="w-6 h-6" style={{ color: 'var(--pulse-tone-neutral)' }} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--pulse-ink)' }}>You can't see this workspace's members.</p>
                <p className="text-xs mt-1" style={{ color: 'var(--pulse-ink-2)' }}>Contact your workspace admin.</p>
              </div>
            </div>
          )}

          {state.kind === 'error' && state.code === 'network' && (
            <div className="flex flex-col items-center text-center p-8 gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--pulse-tone-neutral-soft)' }}>
                <WifiOff className="w-6 h-6" style={{ color: 'var(--pulse-tone-neutral)' }} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--pulse-ink)' }}>Could not reach Pulse.</p>
                <p className="text-xs mt-1" style={{ color: 'var(--pulse-ink-2)' }}>Check your connection, then try again.</p>
              </div>
              <button type="button" onClick={load} className="px-4 py-2 rounded-xl text-sm font-medium min-h-[40px]" style={{ background: 'var(--pulse-tone-info-soft)', color: 'var(--pulse-ink)' }}>Try again</button>
            </div>
          )}

          {state.kind === 'error' && state.code === 'unexpected' && (
            <div className="flex flex-col items-center text-center p-8 gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--pulse-tone-warning-soft)' }}>
                <AlertCircle className="w-6 h-6" style={{ color: 'var(--pulse-tone-warning)' }} aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--pulse-ink)' }}>Something went wrong on our end.</p>
              <div className="flex gap-2">
                <button type="button" onClick={load} className="px-4 py-2 rounded-xl text-sm font-medium min-h-[40px]" style={{ background: 'var(--pulse-tone-info-soft)', color: 'var(--pulse-ink)' }}>Try again</button>
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium min-h-[40px]" style={{ color: 'var(--pulse-ink-2)' }}>Close</button>
              </div>
            </div>
          )}
        </div>

        {/* Phase 2 stub */}
        <div className="border-t flex-shrink-0" style={{ borderColor: 'var(--pulse-border)' }}>
          <div className="px-4 py-2 flex items-center gap-1.5">
            <div className="flex-1 h-px" style={{ background: 'var(--pulse-border)' }} />
            <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--pulse-ink-3)' }}>Coming later</span>
            <div className="flex-1 h-px" style={{ background: 'var(--pulse-border)' }} />
          </div>
          <div className="px-3 pb-3">
            <input
              disabled
              aria-disabled="true"
              aria-label="Cross-org handle search — not yet available"
              placeholder="Search by @handle"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none', borderColor: 'var(--pulse-border)', background: 'var(--pulse-canvas)', color: 'var(--pulse-ink-3)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
