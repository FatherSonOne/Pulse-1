/**
 * bookingPageService.ts
 *
 * Manages booking pages (Calendly-style public scheduling).
 * Public functions (getBookingPage, getAvailableSlots, confirmBooking)
 * work without auth so they can be called from the public /book/:slug route.
 */

import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AvailabilityWindow {
  day: number;    // 0 = Sunday … 6 = Saturday
  start: string;  // 'HH:MM'
  end: string;    // 'HH:MM'
}

export interface BookingPage {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  buffer_before: number;
  buffer_after: number;
  availability_windows: AvailabilityWindow[];
  timezone: string;
  video_type: 'pulse' | 'zoom' | 'meet' | 'teams' | 'none';
  is_active: boolean;
  created_at: string;
}

export interface BookingPageConfig {
  slug: string;
  title: string;
  description?: string;
  duration_minutes?: number;
  buffer_before?: number;
  buffer_after?: number;
  availability_windows?: AvailabilityWindow[];
  timezone?: string;
  video_type?: BookingPage['video_type'];
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface BookerInfo {
  name: string;
  email: string;
  notes?: string;
}

export interface BookingRequest {
  id: string;
  page_id: string;
  booker_name: string;
  booker_email: string;
  booker_notes: string | null;
  proposed_start: string;
  proposed_end: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  event_id: string | null;
  created_at: string;
}

// ── Default availability ──────────────────────────────────────────────────────

const DEFAULT_WINDOWS: AvailabilityWindow[] = [
  { day: 1, start: '09:00', end: '17:00' },
  { day: 2, start: '09:00', end: '17:00' },
  { day: 3, start: '09:00', end: '17:00' },
  { day: 4, start: '09:00', end: '17:00' },
  { day: 5, start: '09:00', end: '17:00' },
];

// ── CRUD ─────────────────────────────────────────────────────────────────────

function sanitizeSlug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export async function createBookingPage(config: BookingPageConfig): Promise<BookingPage> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const slug = sanitizeSlug(config.slug);
  if (slug.length < 3) throw new Error('Slug must be at least 3 characters (letters, numbers, hyphens only).');

  const { data, error } = await supabase
    .from('booking_pages')
    .insert({
      user_id:              user.id,
      slug,
      title:                config.title,
      description:          config.description ?? null,
      duration_minutes:     config.duration_minutes ?? 30,
      buffer_before:        config.buffer_before ?? 0,
      buffer_after:         config.buffer_after ?? 0,
      availability_windows: config.availability_windows ?? DEFAULT_WINDOWS,
      timezone:             config.timezone ?? 'local',
      video_type:           config.video_type ?? 'pulse',
      is_active:            true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as BookingPage;
}

export async function getMyBookingPages(): Promise<BookingPage[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('booking_pages')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as BookingPage[];
}

/** Public — no auth required */
export async function getBookingPage(slug: string): Promise<BookingPage | null> {
  const { data, error } = await supabase
    .from('booking_pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error) return null;
  return data as BookingPage;
}

export async function updateBookingPage(
  id: string,
  changes: Partial<BookingPageConfig & { is_active: boolean }>,
): Promise<void> {
  const { error } = await supabase
    .from('booking_pages')
    .update(changes)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteBookingPage(id: string): Promise<void> {
  const { error } = await supabase.from('booking_pages').delete().eq('id', id);
  if (error) throw error;
}

// ── Slot generation ───────────────────────────────────────────────────────────

/**
 * Returns available time slots for a booking page on a specific date.
 * Subtracts existing calendar events (busy time) from the availability windows.
 * Public — no auth required.
 */
export async function getAvailableSlots(slug: string, date: string): Promise<TimeSlot[]> {
  const page = await getBookingPage(slug);
  if (!page) return [];

  const targetDate = new Date(date + 'T00:00:00');
  const dayOfWeek  = targetDate.getDay();

  // Find windows for this day of week
  const windows = (page.availability_windows ?? DEFAULT_WINDOWS).filter(w => w.day === dayOfWeek);
  if (windows.length === 0) return [];

  // Fetch busy events for the organiser on this date
  const dayStart = new Date(date + 'T00:00:00').toISOString();
  const dayEnd   = new Date(date + 'T23:59:59').toISOString();

  const { data: busyEvents } = await supabase
    .from('calendar_events')
    .select('start_time, end_time')
    .eq('user_id', page.user_id)
    .gte('start_time', dayStart)
    .lte('end_time', dayEnd);

  const busy = (busyEvents ?? []).map(e => ({
    start: new Date(e.start_time).getTime(),
    end:   new Date(e.end_time).getTime(),
  }));

  const slots: TimeSlot[] = [];
  const durationMs   = page.duration_minutes * 60000;
  const bufferMs     = (page.buffer_before + page.buffer_after) * 60000;
  const slotStepMs   = durationMs + bufferMs;

  for (const window of windows) {
    const [wStartH, wStartM] = window.start.split(':').map(Number);
    const [wEndH,   wEndM  ] = window.end.split(':').map(Number);

    const windowStart = new Date(targetDate);
    windowStart.setHours(wStartH, wStartM, 0, 0);

    const windowEnd = new Date(targetDate);
    windowEnd.setHours(wEndH, wEndM, 0, 0);

    let cursor = windowStart.getTime();

    while (cursor + durationMs <= windowEnd.getTime()) {
      const slotEnd = cursor + durationMs;

      // Check overlap with busy events
      const overlaps = busy.some(b => cursor < b.end && slotEnd > b.start);
      if (!overlaps) {
        slots.push({ start: new Date(cursor), end: new Date(slotEnd) });
      }

      cursor += slotStepMs || durationMs; // prevent infinite loop
    }
  }

  return slots;
}

// ── Booking confirmation ──────────────────────────────────────────────────────

export interface BookingResult {
  request: BookingRequest;
  /** True when the server-side confirmation email was actually sent. */
  emailSent: boolean;
}

/** Pull the typed error code out of a FunctionsHttpError (non-2xx) response body. */
async function extractFnErrorCode(error: unknown): Promise<string | null> {
  try {
    const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } })?.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      return body?.error ?? null;
    }
  } catch { /* body already consumed or not JSON */ }
  return null;
}

/**
 * Confirms a booking via the public `book-slot` edge function. The function runs
 * entirely server-side: it atomically claims the slot (DB-level unique lock) and
 * creates the organiser's calendar event via the confirm_booking RPC, then sends
 * the booker a confirmation email. The anon client can no longer write the
 * organiser's calendar directly (that path was RLS-blocked and silently failing).
 *
 * Throws Error('SLOT_TAKEN') when the slot was already booked so the UI can
 * prompt for another time. (#131)
 */
export async function confirmBooking(
  pageId: string,
  slot: TimeSlot,
  booker: BookerInfo,
): Promise<BookingResult> {
  const { data, error } = await supabase.functions.invoke('book-slot', {
    body: {
      page_id: pageId,
      start:   slot.start.toISOString(),
      end:     slot.end.toISOString(),
      name:    booker.name,
      email:   booker.email,
      notes:   booker.notes ?? null,
    },
  });

  if (error) {
    const code = await extractFnErrorCode(error);
    if (code === 'slot_taken') throw new Error('SLOT_TAKEN');
    throw new Error(code || (error as Error).message || 'BOOKING_FAILED');
  }
  if (!data?.ok) {
    if (data?.error === 'slot_taken') throw new Error('SLOT_TAKEN');
    throw new Error(data?.error || 'BOOKING_FAILED');
  }

  return { request: data.request as BookingRequest, emailSent: !!data.emailSent };
}

export async function getBookingRequests(pageId: string): Promise<BookingRequest[]> {
  const { data, error } = await supabase
    .from('booking_requests')
    .select('*')
    .eq('page_id', pageId)
    .order('proposed_start', { ascending: true });

  if (error) throw error;
  return (data ?? []) as BookingRequest[];
}
