// ─────────────────────────────────────────────────────────────────────────────
// useBroadcastControl — Direction D (Horizon, P8) single source of truth for the
// live-location broadcast state machine.
//
// Extracted VERBATIM from MapFilterControls (MapFilterBar.tsx:64-152) so the
// filter-bar Broadcast pill (OFF path) and the new LiveTeamDrawer (Horizon path)
// drive ONE broadcast — same liveOn, same recipient set, same GPS watch. The
// hook is instantiated ONCE by PulseMapView (always mounted, so the broadcast
// persists while panels open/close); both surfaces consume the returned control
// via props. Instantiating it in two components would double the keyboard
// listener + the start/stop effect against the module-global watch, so DON'T —
// there is exactly one owner.
//
// Behaviour is identical to the pre-P8 inline copy: OFF→ON opens the recipient
// picker (the operator declares an audience before broadcasting); ON→OFF revokes
// this session's consents and stops the watch; the `b` key toggles; the choice
// is cached in localStorage so a reload resumes a running broadcast.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  startLocationBroadcast,
  stopLocationBroadcast,
  setBroadcastRecipients,
  endBroadcastRecipients,
  getActiveBroadcastRecipientIds,
} from '../../../services/locationService';

// Cached so the broadcast resumes on reload if the user had it enabled.
const LIVE_LOCATION_LS_KEY = 'pulse:map:live-location-on';

export interface BroadcastControl {
  liveOn: boolean;
  viewerCount: number;
  showRecipientPicker: boolean;
  setShowRecipientPicker: (show: boolean) => void;
  handleToggleLive: () => void;
  handleRecipientConfirm: (recipientUserIds: string[]) => Promise<void>;
}

export function useBroadcastControl(userId: string): BroadcastControl {
  const [liveOn, setLiveOn] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(LIVE_LOCATION_LS_KEY) === '1';
  });

  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [viewerCount, setViewerCount] = useState<number>(() => getActiveBroadcastRecipientIds().length);

  useEffect(() => {
    if (!userId) return;
    if (liveOn) {
      startLocationBroadcast(userId, err => {
        if (err.code === err.PERMISSION_DENIED) {
          toast.error('Location permission denied. Enable it to broadcast.');
          setLiveOn(false);
        }
      });
    } else {
      stopLocationBroadcast();
    }
    return () => { stopLocationBroadcast(); };
  }, [liveOn, userId]);

  const handleToggleLive = () => {
    if (!liveOn) {
      setShowRecipientPicker(true);
      return;
    }
    void endBroadcastRecipients(userId).catch(() => { /* best effort */ });
    setViewerCount(0);
    setLiveOn(false);
    try { localStorage.setItem(LIVE_LOCATION_LS_KEY, '0'); } catch { /* ignore */ }
    toast('Broadcast off', { icon: '⏸', duration: 2000 });
  };

  const handleRecipientConfirm = async (recipientUserIds: string[]) => {
    setShowRecipientPicker(false);
    try {
      await setBroadcastRecipients(userId, recipientUserIds);
    } catch (e) {
      toast.error('Could not grant viewer access. Try again.');
      return;
    }
    setViewerCount(recipientUserIds.length);
    setLiveOn(true);
    try { localStorage.setItem(LIVE_LOCATION_LS_KEY, '1'); } catch { /* ignore */ }
    toast(`Broadcasting to ${recipientUserIds.length}`, { icon: '📡', duration: 3000 });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if (inField) return;
      if (e.key === 'b' || e.key === 'B') {
        handleToggleLive();
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveOn]);

  return {
    liveOn,
    viewerCount,
    showRecipientPicker,
    setShowRecipientPicker,
    handleToggleLive,
    handleRecipientConfirm,
  };
}
