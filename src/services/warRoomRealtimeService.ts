import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import type { PresenceUser } from '../store/warRoomStore';

class WarRoomRealtimeService {
  private channel: RealtimeChannel | null = null;

  async joinSession(
    sessionId: string,
    user: PresenceUser,
    callbacks: {
      onPresenceSync: (users: Map<string, PresenceUser>) => void;
      onNewMessage: (msg: any) => void;
    }
  ): Promise<void> {
    this.leaveSession();

    this.channel = supabase.channel(`war-room:${sessionId}`, {
      config: { presence: { key: user.userId } },
    });

    this.channel.on('presence', { event: 'sync' }, () => {
      const state = this.channel!.presenceState();
      const users = new Map<string, PresenceUser>();
      Object.entries(state).forEach(([key, presences]) => {
        if (presences[0]) {
          users.set(key, presences[0] as unknown as PresenceUser);
        }
      });
      callbacks.onPresenceSync(users);
    });

    this.channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ai_messages',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        callbacks.onNewMessage(payload.new);
      }
    );

    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.channel!.track(user);
      }
    });
  }

  // ── Artifact Collaboration ────────────────────────────────────────────────

  /** Broadcast an artifact event to all collaborators */
  broadcastArtifact(event: 'pin' | 'edit' | 'delete' | 'vote', payload: {
    artifactId?: string;
    content: string;
    type: string;
    userId: string;
    userName?: string;
  }): void {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: `artifact:${event}`,
      payload,
    });
  }

  /** Subscribe to artifact events from collaborators */
  onArtifactEvent(
    callback: (event: string, payload: any) => void
  ): void {
    if (!this.channel) return;

    for (const evt of ['pin', 'edit', 'delete', 'vote'] as const) {
      this.channel.on('broadcast', { event: `artifact:${evt}` }, ({ payload }) => {
        callback(evt, payload);
      });
    }
  }

  /** Broadcast a cursor/selection indicator (lightweight presence extension) */
  broadcastCursor(artifactId: string, userId: string, action: 'editing' | 'viewing' | 'left'): void {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'artifact:cursor',
      payload: { artifactId, userId, action, timestamp: Date.now() },
    });
  }

  /** Subscribe to cursor events */
  onCursorEvent(callback: (payload: { artifactId: string; userId: string; action: string }) => void): void {
    if (!this.channel) return;
    this.channel.on('broadcast', { event: 'artifact:cursor' }, ({ payload }) => {
      callback(payload);
    });
  }

  leaveSession(): void {
    if (this.channel) {
      this.channel.untrack();
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}

export const warRoomRealtimeService = new WarRoomRealtimeService();
