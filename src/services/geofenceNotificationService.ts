// ============================================================
// Geofence Notification Service
//
// Subscribes to geofence transitions emitted by geofenceService and
// fans them out to three surfaces:
//
//   1. In-app toast (react-hot-toast) — for foreground arrivals.
//   2. Native local notification (Capacitor) / Web Notification —
//      reaches the user when the app is backgrounded.
//   3. today_feed_items row — survives restarts, lives in feed history,
//      lets the Today view render a "📍 Arrived at Acme HQ" card.
//
// Init is idempotent — multiple call sites can request initialization
// without producing duplicate listeners. Currently called from
// locationService.startLocationBroadcast() once the geofence module
// has loaded.
// ============================================================

import toast from 'react-hot-toast';
import { onGeofenceTransition, GeofenceTransition } from './geofenceService';
import mobileNotificationService from './mobileNotificationService';
import { supabase } from './supabase';

let initialized = false;
let unsubscribe: (() => void) | null = null;

export function initGeofenceNotifications(): void {
  if (initialized) return;
  initialized = true;
  unsubscribe = onGeofenceTransition(handleTransition);
}

export function teardownGeofenceNotifications(): void {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  initialized = false;
}

async function handleTransition(t: GeofenceTransition): Promise<void> {
  const copy = composeCopy(t);

  // 1. Toast — fire and forget; no await needed.
  toast(copy.toast, { icon: copy.icon, duration: 5000 });

  // 2. Native / web notification — only if user has granted permission.
  // Permission is requested elsewhere; here we just attempt to fire.
  mobileNotificationService
    .notify({
      title: copy.title,
      body: copy.body,
      id: `geofence:${t.place.id}:${t.eventType}`,
      actionUrl: copy.actionUrl,
    })
    .catch(err => console.warn('[geofenceNotificationService] notify failed:', err));

  // 3. Today feed row — best-effort; localStorage fallback isn't wired
  // here since the events table already has the durable record.
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return;

    await supabase.from('today_feed_items').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      contact_id: copy.contactId,
      contact_name: copy.contactName,
      item_type: copy.itemType,
      priority: copy.priority,
      title: copy.title,
      subtitle: copy.body,
      suggested_action: 'review',
      status: 'active',
      created_at: new Date().toISOString(),
      metadata: {
        sourceEventType: 'geofence',
        placeId: t.place.id,
        eventType: t.eventType,
        distanceM: Math.round(t.distanceM),
        entityType: t.place.entity?.type ?? null,
        entityId: t.place.entity?.id ?? null,
      },
    });
  } catch (err) {
    console.warn('[geofenceNotificationService] feed item insert failed:', err);
  }
}

interface GeofenceCopy {
  icon: string;
  itemType: 'geofence_arrival' | 'geofence_approach' | 'geofence_exit';
  priority: number;
  title: string;
  body: string;
  toast: string;
  contactId: string;
  contactName: string;
  actionUrl?: string;
}

function composeCopy(t: GeofenceTransition): GeofenceCopy {
  const placeLabel = t.place.name || t.place.address || 'a saved location';
  const isContact = t.place.entity?.type === 'contact';

  // contactId/contactName are required on TodayFeedItem rows. For non-
  // contact entities we fall back to the place itself as the subject.
  const contactId = isContact ? t.place.entity!.id : t.place.id;
  const contactName = isContact && t.place.entity ? placeLabel : placeLabel;

  switch (t.eventType) {
    case 'enter':
      return {
        icon: '📍',
        itemType: 'geofence_arrival',
        priority: 1,
        title: `Arrived at ${placeLabel}`,
        body: contextLine(t, 'arrival'),
        toast: `📍 Arrived at ${placeLabel}`,
        contactId,
        contactName,
        actionUrl: routeForEntity(t),
      };
    case 'approach':
      return {
        icon: '🧭',
        itemType: 'geofence_approach',
        priority: 3,
        title: `Approaching ${placeLabel}`,
        body: contextLine(t, 'approach'),
        toast: `🧭 Approaching ${placeLabel}`,
        contactId,
        contactName,
        actionUrl: routeForEntity(t),
      };
    case 'exit':
      return {
        icon: '🚪',
        itemType: 'geofence_exit',
        priority: 4,
        title: `Left ${placeLabel}`,
        body: contextLine(t, 'exit'),
        toast: `🚪 Left ${placeLabel}`,
        contactId,
        contactName,
        actionUrl: routeForEntity(t),
      };
  }
}

function contextLine(t: GeofenceTransition, kind: 'arrival' | 'approach' | 'exit'): string {
  const role = t.place.entity?.role;
  const distance = `${Math.round(t.distanceM)}m`;

  if (kind === 'approach') {
    return `You're about ${distance} away.`;
  }

  if (t.place.entity?.type === 'contact' && (role === 'home' || role === 'work')) {
    const roleLabel = role === 'home' ? 'home' : 'work';
    return kind === 'arrival'
      ? `This is a contact's ${roleLabel} address.`
      : `Wrap-up: anything to capture from this visit?`;
  }
  if (t.place.entity?.type === 'task') {
    return kind === 'arrival'
      ? `A task is geofenced here — ready to complete?`
      : `Leaving the task site.`;
  }
  return kind === 'arrival'
    ? `You crossed into the saved geofence.`
    : `You exited the saved geofence.`;
}

function routeForEntity(t: GeofenceTransition): string | undefined {
  const e = t.place.entity;
  if (!e) return undefined;
  switch (e.type) {
    case 'contact':  return `/contacts/${e.id}`;
    case 'task':     return `/tasks/${e.id}`;
    case 'decision': return `/decisions/${e.id}`;
    case 'event':    return `/calendar/${e.id}`;
    case 'meeting':  return `/meetings/${e.id}`;
  }
}
