/**
 * useBreakoutChannel.ts
 * Cross-room transport for breakout signaling.
 *
 * WHY NOT Daily app-messages: Daily app-messages are ROOM-SCOPED — once
 * participants move into sub-rooms, a host message sent in the main room never
 * reaches them (handoff R3). Breakout *start* happens while everyone is still
 * together, but *recall* and *broadcast* must reach clients scattered across
 * sub-rooms. A Supabase Realtime broadcast channel keyed on the meeting's main
 * room name is independent of the Daily room each client is in, so it crosses
 * rooms. The wire payload is the same transport-agnostic BreakoutMsg.
 *
 * Ephemeral pub/sub (Realtime broadcast) — no DB row, no RLS. `self: false` so
 * the host never receives its own messages (it tracks its session locally).
 */

import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../services/supabaseClient';
import { isBreakoutMsg, type BreakoutMsg } from './breakoutProtocol';

const BROADCAST_EVENT = 'breakout';

/**
 * Subscribe to the breakout channel for a meeting and get a sender.
 * @param mainRoomName Daily room name of the main meeting (the channel key).
 * @param onMessage    called with each validated inbound BreakoutMsg.
 */
export function useBreakoutChannel(
  mainRoomName: string | null | undefined,
  onMessage: (msg: BreakoutMsg) => void,
): (msg: BreakoutMsg) => void {
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Keep the latest handler in a ref so the subscription doesn't churn when the
  // caller passes a fresh closure each render.
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!mainRoomName) return;
    const channel = supabase.channel(`breakout-${mainRoomName}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    channel.on('broadcast', { event: BROADCAST_EVENT }, ({ payload }) => {
      if (isBreakoutMsg(payload)) handlerRef.current(payload);
    });
    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [mainRoomName]);

  return useCallback((msg: BreakoutMsg) => {
    channelRef.current?.send({ type: 'broadcast', event: BROADCAST_EVENT, payload: msg });
  }, []);
}
