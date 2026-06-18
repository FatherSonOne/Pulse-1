/**
 * BookingPage.tsx
 * Public-facing booking page. No auth required.
 * Route: /book/:slug
 */
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, Clock, CheckCircle, ChevronLeft } from 'lucide-react';
import {
  BookingPage as BookingPageData,
  TimeSlot,
  getBookingPage,
  getAvailableSlots,
  confirmBooking,
} from '../services/bookingPageService';

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

type Step = 'calendar' | 'time' | 'form' | 'confirmed';

export const BookingPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<BookingPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const [step, setStep] = useState<Step>('calendar');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (!slug) return;
    getBookingPage(slug).then(p => {
      if (!p) setNotFound(true);
      else setPage(p);
      setLoading(false);
    });
  }, [slug]);

  useEffect(() => {
    if (!selectedDate || !page) return;
    setSlotsLoading(true);
    getAvailableSlots(page.slug, selectedDate).then(s => {
      setSlots(s);
      setSlotsLoading(false);
      if (s.length > 0) setStep('time');
    });
  }, [selectedDate, page]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!page || !selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const { emailSent: sent } = await confirmBooking(page.id, selectedSlot, { name, email, notes });
      setEmailSent(sent);
      setStep('confirmed');
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'SLOT_TAKEN') {
        // Someone grabbed this slot first — bounce back to slot selection with fresh availability.
        setError('That time was just booked by someone else. Please pick another slot.');
        setStep('time');
        if (selectedDate) {
          getAvailableSlots(page.slug, selectedDate).then(setSlots).catch(() => { /* keep stale list */ });
        }
      } else {
        setError('Something went wrong confirming your booking. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-white mb-2">Page not found</h1>
        <p className="text-zinc-500">This booking page doesn't exist or has been deactivated.</p>
      </div>
    </div>
  );

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const monthName = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-500/30">
            <Calendar className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">{page!.title}</h1>
          {page!.description && <p className="text-zinc-500 dark:text-zinc-400 text-sm">{page!.description}</p>}
          <div className="flex items-center justify-center gap-1.5 mt-2 text-sm text-zinc-400">
            <Clock className="w-4 h-4" />
            <span>{page!.duration_minutes} minutes</span>
          </div>
        </div>

        {step === 'confirmed' ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 text-center shadow-xl">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">You're booked!</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-1">
              {selectedSlot && `${fmtTime(selectedSlot.start)} – ${fmtTime(selectedSlot.end)}`}
            </p>
            <p className="text-zinc-400 text-sm">{selectedDate}</p>
            <p className="mt-4 text-sm text-zinc-500">
              {emailSent
                ? `A confirmation has been sent to ${email}`
                : "You're all set — this time is now on the organizer's calendar."}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
            {step === 'form' && (
              <button type="button" onClick={() => setStep('time')} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-rose-500 transition m-4">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {(step === 'time' && selectedDate) && (
              <button type="button" onClick={() => { setStep('calendar'); setSelectedDate(null); }} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-rose-500 transition m-4">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}

            {/* Calendar */}
            {step === 'calendar' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <button type="button" onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }} className="p-2 text-zinc-400 hover:text-rose-500 transition rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{monthName}</span>
                  <button type="button" onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }} className="p-2 text-zinc-400 hover:text-rose-500 transition rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <ChevronLeft className="w-4 h-4 rotate-180" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-zinc-400 uppercase py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`blank-${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const isPast  = new Date(dateStr) < new Date(isoDate(today));
                    const isToday = dateStr === isoDate(today);
                    const isSel   = dateStr === selectedDate;
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={isPast}
                        onClick={() => setSelectedDate(dateStr)}
                        className={`aspect-square rounded-xl text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                          isSel   ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30' :
                          isToday ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 ring-1 ring-rose-300 dark:ring-rose-800' :
                          isPast  ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed' :
                          'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Time slots */}
            {step === 'time' && (
              <div className="p-6">
                <h2 className="font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
                  {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                </h2>
                {slotsLoading ? (
                  <div className="flex items-center justify-center py-8 text-zinc-400">
                    <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mr-2" />
                    Loading slots…
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-center py-8 text-zinc-400">No available slots on this day. Please pick another date.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {slots.map((slot, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setSelectedSlot(slot); setStep('form'); }}
                        className="py-3 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:border-rose-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        {fmtTime(slot.start)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Booking form */}
            {step === 'form' && selectedSlot && (
              <form onSubmit={handleBook} className="p-6 space-y-4">
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl mb-2">
                  <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                    {fmtTime(selectedSlot.start)} – {fmtTime(selectedSlot.end)}
                  </p>
                  <p className="text-xs text-rose-500 mt-0.5">{selectedDate}</p>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div>
                  <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Your name</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:border-rose-400 transition" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Email address</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:border-rose-400 transition" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Notes (optional)</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Anything you'd like to share beforehand…"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:border-rose-400 resize-none transition" />
                </div>
                <button type="submit" disabled={submitting} className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50 shadow-md shadow-rose-500/25">
                  {submitting ? 'Confirming…' : 'Confirm booking'}
                </button>
              </form>
            )}
          </div>
        )}

        <p className="text-center text-xs text-zinc-400 mt-6">Powered by Pulse</p>
      </div>
    </div>
  );
};

export default BookingPage;
