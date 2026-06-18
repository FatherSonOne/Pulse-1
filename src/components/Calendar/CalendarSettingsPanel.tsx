import React from 'react';
import { AlertTriangle, CheckCircle, Grid3X3, Settings, Unplug, X } from 'lucide-react';
import { EVENT_COLORS, ViewMode, ReminderTime } from './calendarTypes';
import { BookingPageManager } from './BookingPageManager';

interface CalendarSettingsPanelProps {
  showCalendarSettings: boolean;
  setShowCalendarSettings: (v: boolean) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  weekStartsOn: 'sunday' | 'monday';
  setWeekStartsOn: (v: 'sunday' | 'monday') => void;
  showWeekNumbers: boolean;
  setShowWeekNumbers: (v: boolean) => void;
  googleConnected: boolean;
  syncGoogleCalendar: () => void;
  syncingGoogle: boolean;
  lastSynced: Date | null;
  onNavigateToIntegrations?: () => void;
  outlookConnected: boolean;
  outlookUserEmail: string;
  outlookError: string | null;
  syncOutlookCalendar: () => void;
  syncingOutlook: boolean;
  disconnectOutlook: () => void;
  connectOutlook: () => void;
  newEventReminder: ReminderTime;
  setAndPersistReminder: (v: ReminderTime) => void;
  newEventColor: string;
  setNewEventColor: (v: string) => void;
}

export const CalendarSettingsPanel: React.FC<CalendarSettingsPanelProps> = ({
  showCalendarSettings, setShowCalendarSettings,
  viewMode, setViewMode,
  weekStartsOn, setWeekStartsOn,
  showWeekNumbers, setShowWeekNumbers,
  googleConnected, syncGoogleCalendar, syncingGoogle, lastSynced, onNavigateToIntegrations,
  outlookConnected, outlookUserEmail, outlookError, syncOutlookCalendar, syncingOutlook, disconnectOutlook, connectOutlook,
  newEventReminder, setAndPersistReminder,
  newEventColor, setNewEventColor,
}) => {
  if (!showCalendarSettings) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-[var(--pulse-surface)] dark:bg-[var(--pulse-canvas)] border-l border-[var(--pulse-border)] shadow-2xl z-50 animate-slide-in-right flex flex-col">
      <div className="p-6 border-b border-[var(--pulse-border)] flex items-center justify-between">
        <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
          <Settings className="text-zinc-400" />
          Calendar Settings
        </h3>
        <button onClick={() => setShowCalendarSettings(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white">
          <X />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* View Preferences */}
        <div>
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">View Preferences</h4>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[var(--pulse-ink-2)] mb-2 block">Default View</label>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as ViewMode)}
                className="w-full bg-[var(--pulse-canvas-soft)] dark:bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-[var(--pulse-ink-2)] mb-2 block">Week Starts On</label>
              <select
                value={weekStartsOn}
                onChange={(e) => setWeekStartsOn(e.target.value as 'sunday' | 'monday')}
                className="w-full bg-[var(--pulse-canvas-soft)] dark:bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value="sunday">Sunday</option>
                <option value="monday">Monday</option>
              </select>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showWeekNumbers}
                onChange={(e) => setShowWeekNumbers(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-[var(--pulse-ink-2)]">Show Week Numbers</span>
            </label>
          </div>
        </div>

        {/* Google Calendar */}
        <div>
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Google Calendar</h4>
          <div className="space-y-3">
            {googleConnected ? (
              <>
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle />
                  Connected
                </div>
                <button
                  onClick={syncGoogleCalendar}
                  disabled={syncingGoogle}
                  className="w-full flex items-center justify-center gap-2 bg-[var(--pulse-surface-raised)] dark:bg-[var(--pulse-surface-raised)] rounded-lg px-4 py-3 text-sm font-medium hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-[var(--pulse-surface-raised)] transition"
                >
                  <i className={`fa-solid fa-sync ${syncingGoogle ? 'animate-spin' : ''}`}></i>
                  {syncingGoogle ? 'Syncing...' : 'Sync Now'}
                </button>
                {lastSynced && (
                  <p className="text-xs text-zinc-500 text-center">
                    Last synced: {lastSynced.toLocaleString()}
                  </p>
                )}
              </>
            ) : (
              <button
                onClick={() => {
                  setShowCalendarSettings(false);
                  if (onNavigateToIntegrations) onNavigateToIntegrations();
                }}
                className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-blue-600 transition"
              >
                Connect Google Calendar
              </button>
            )}
          </div>
        </div>

        {/* Outlook Calendar */}
        <div>
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">
            <Grid3X3 className="mr-1.5 text-[#0078d4]" />
            Outlook Calendar
          </h4>
          <div className="space-y-3">
            {outlookConnected ? (
              <>
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle />
                  Connected{outlookUserEmail ? `: ${outlookUserEmail}` : ''}
                </div>
                <button
                  onClick={syncOutlookCalendar}
                  disabled={syncingOutlook}
                  className="w-full flex items-center justify-center gap-2 bg-[var(--pulse-surface-raised)] dark:bg-[var(--pulse-surface-raised)] rounded-lg px-4 py-3 text-sm font-medium hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-[var(--pulse-surface-raised)] transition"
                >
                  <i className={`fa-solid fa-sync ${syncingOutlook ? 'animate-spin' : ''}`}></i>
                  {syncingOutlook ? 'Syncing...' : 'Sync Now'}
                </button>
                <button
                  onClick={disconnectOutlook}
                  className="w-full flex items-center justify-center gap-2 border border-red-200 dark:border-red-900 text-red-500 rounded-lg px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-950 transition"
                >
                  <Unplug />
                  Disconnect Outlook
                </button>
                {outlookError && <p className="text-xs text-red-500">{outlookError}</p>}
              </>
            ) : (
              <>
                <p className="text-xs text-[var(--pulse-ink-3)]">
                  Sync events from your Microsoft 365 or Outlook.com calendar.
                  {!import.meta.env.VITE_MICROSOFT_CLIENT_ID && (
                    <span className="block mt-1 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="mr-1" />
                      Set VITE_MICROSOFT_CLIENT_ID to enable.
                    </span>
                  )}
                </p>
                <button
                  onClick={connectOutlook}
                  disabled={!import.meta.env.VITE_MICROSOFT_CLIENT_ID}
                  className="w-full flex items-center justify-center gap-2 bg-[#0078d4] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[#106ebe] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Grid3X3 />
                  Sign in with Microsoft
                </button>
                {outlookError && <p className="text-xs text-red-500">{outlookError}</p>}
              </>
            )}
          </div>
        </div>

        {/* Booking Pages */}
        <div>
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Booking Pages</h4>
          <BookingPageManager />
        </div>

        {/* Event Defaults */}
        <div>
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Event Defaults</h4>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[var(--pulse-ink-2)] mb-2 block">Default Reminder</label>
              <select
                value={newEventReminder}
                onChange={(e) => setAndPersistReminder(e.target.value as ReminderTime)}
                className="w-full bg-[var(--pulse-canvas-soft)] dark:bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value="none">No reminder</option>
                <option value="5min">5 minutes before</option>
                <option value="15min">15 minutes before</option>
                <option value="30min">30 minutes before</option>
                <option value="1hour">1 hour before</option>
                <option value="1day">1 day before</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-[var(--pulse-ink-2)] mb-2 block">Default Event Color</label>
              <div className="flex gap-2 flex-wrap">
                {EVENT_COLORS.map(color => (
                  <button
                    key={color.id}
                    onClick={() => setNewEventColor(color.class)}
                    className={`w-8 h-8 rounded-full ${color.class} transition ring-2 ring-offset-2 ${newEventColor === color.class ? 'ring-blue-500' : 'ring-transparent'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
