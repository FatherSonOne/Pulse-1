import React from 'react';
import { AlertTriangle, CalendarPlus, Clock, ExternalLink, Pen, Plus, Settings, Star, Users, Wand2 } from 'lucide-react';
import { Contact } from '../../types';
import { GoogleCalendar } from '../../services/googleCalendarService';
import { ViewMode, Team } from './calendarTypes';
import { SharedCalendarPanel } from './SharedCalendarPanel';

interface FreeTimeSlot {
  start: Date;
  end: Date;
  dayLabel: string;
}

interface CalendarSidebarProps {
  sidebarRef: React.RefObject<HTMLDivElement>;
  sidebarWidth: number;
  handleMouseDown: (e: React.MouseEvent) => void;
  isResizing: boolean;

  // Calendar visibility
  visibleCalendars: Set<string>;
  toggleCalendarVisibility: (id: string) => void;

  // Google calendars
  googleConnected: boolean;
  googleCalendars: GoogleCalendar[];
  calendarColors: Record<string, string>;
  colorPickerOpenFor: string | null;
  setColorPickerOpenFor: (id: string | null) => void;
  setCalendarColor: (id: string, color: string) => void;
  lastSynced: Date | null;
  syncError: string | null;
  setShowCreateCalendarModal: (v: boolean) => void;

  // Navigation
  onNavigateToIntegrations?: () => void;

  // Team
  teams: Team[];
  selectedTeam: Team | null;
  selectedTeamId: string;
  setSelectedTeamId: (v: string) => void;
  teamMembers: Contact[];
  setShowTeamModal: (v: boolean) => void;
  openEditTeam: (team: Team) => void;

  // Overlay
  viewMode: ViewMode;
  overlayMemberIds: Set<string>;
  setOverlayMemberIds: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Invite
  setInviteContact: (v: Contact) => void;
  setShowInviteModal: (v: boolean) => void;

  // Free time
  showFreeTimeFinder: boolean;
  setShowFreeTimeFinder: React.Dispatch<React.SetStateAction<boolean>>;
  freeTimeSlots: FreeTimeSlot[];
  setNewEventDate: (v: string) => void;
  setNewEventTime: (v: string) => void;
  setShowEventModal: (v: boolean) => void;
}

export const CalendarSidebar: React.FC<CalendarSidebarProps> = ({
  sidebarRef, sidebarWidth, handleMouseDown, isResizing,
  visibleCalendars, toggleCalendarVisibility,
  googleConnected, googleCalendars, calendarColors, colorPickerOpenFor, setColorPickerOpenFor, setCalendarColor,
  lastSynced, syncError, setShowCreateCalendarModal,
  onNavigateToIntegrations,
  teams, selectedTeam, selectedTeamId, setSelectedTeamId, teamMembers, setShowTeamModal, openEditTeam,
  viewMode, overlayMemberIds, setOverlayMemberIds,
  setInviteContact, setShowInviteModal,
  showFreeTimeFinder, setShowFreeTimeFinder, freeTimeSlots,
  setNewEventDate, setNewEventTime, setShowEventModal,
}) => {
  const CAL_PALETTE = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
    '#6b7280', '#0ea5e9', '#10b981', '#f43f5e',
  ];

  return (
    <div
      ref={sidebarRef}
      style={{ width: `${sidebarWidth}px`, minWidth: '160px', maxWidth: '400px' }}
      className="bg-zinc-50 dark:bg-zinc-900/30 border-r border-zinc-200 dark:border-zinc-800 p-3 lg:p-4 overflow-y-auto hidden lg:flex flex-col relative flex-shrink-0"
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize transition ${isResizing ? 'bg-rose-400/50' : 'bg-transparent hover:bg-rose-400/30'}`}
      />

      {/* My Calendars */}
      <div className="mb-4 lg:mb-6">
        <h3 className="text-[10px] lg:text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 lg:mb-3">My Calendars</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs lg:text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer group">
            <input
              type="checkbox"
              checked={visibleCalendars.has('user')}
              onChange={() => toggleCalendarVisibility('user')}
              className="w-3.5 h-3.5 lg:w-4 lg:h-4 rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 checked:bg-zinc-900 dark:checked:bg-white checked:border-transparent transition"
            />
            <span className="group-hover:text-zinc-900 dark:group-hover:text-white transition truncate">Local Events</span>
          </label>
        </div>
      </div>

      {/* Google Calendars */}
      {googleConnected && googleCalendars.length > 0 && (
        <div className="mb-4 lg:mb-6">
          <h3 className="text-[10px] lg:text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 lg:mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 truncate">
              <ExternalLink className="text-[8px] lg:text-[10px]" /> <span className="truncate">Google Calendars</span>
            </span>
            <button
              onClick={() => setShowCreateCalendarModal(true)}
              className="text-rose-400 hover:text-rose-500 transition flex-shrink-0"
              title="Create New Calendar"
            >
              <Plus className="text-[10px]" />
            </button>
          </h3>
          <div className="space-y-1">
            {googleCalendars.map(cal => {
              const dotColor = calendarColors[cal.id] || cal.backgroundColor || '#3b82f6';
              const isPickerOpen = colorPickerOpenFor === cal.id;
              return (
                <div key={cal.id} className="relative">
                  <div className="flex items-center gap-2 group">
                    <button
                      onClick={(e) => { e.stopPropagation(); setColorPickerOpenFor(isPickerOpen ? null : cal.id); }}
                      className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-transparent hover:ring-zinc-300 dark:hover:ring-zinc-600 transition focus:outline-none focus-visible:ring-rose-400"
                      style={{ backgroundColor: dotColor }}
                      aria-label={`Change color for ${cal.summary}`}
                      title="Change calendar color"
                    />
                    <label className="flex items-center gap-1.5 flex-1 min-w-0 text-xs lg:text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleCalendars.has(cal.id)}
                        onChange={() => toggleCalendarVisibility(cal.id)}
                        className="w-3.5 h-3.5 rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 checked:border-transparent transition flex-shrink-0"
                        style={{ accentColor: dotColor }}
                      />
                      <span className="group-hover:text-zinc-900 dark:group-hover:text-white transition truncate flex items-center gap-1">
                        {cal.primary && <Star className="text-amber-400 text-[8px] flex-shrink-0" />}
                        <span className="truncate">{cal.summary}</span>
                      </span>
                    </label>
                  </div>
                  {isPickerOpen && (
                    <div
                      className="absolute left-0 top-6 z-20 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl grid grid-cols-6 gap-1.5"
                      onMouseDown={e => e.stopPropagation()}
                    >
                      {CAL_PALETTE.map(hex => (
                        <button
                          key={hex}
                          onClick={() => setCalendarColor(cal.id, hex)}
                          className={`w-5 h-5 rounded-full transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-rose-400 ${dotColor === hex ? 'ring-2 ring-offset-1 ring-zinc-700 dark:ring-white' : ''}`}
                          style={{ backgroundColor: hex }}
                          aria-label={hex}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {lastSynced && (
            <p className="text-[9px] lg:text-[10px] text-zinc-400 mt-2 truncate">
              Last synced: {lastSynced.toLocaleTimeString()}
            </p>
          )}
          {syncError && (
            <p className="text-[9px] lg:text-[10px] text-red-500 mt-2 truncate">{syncError}</p>
          )}
        </div>
      )}

      {/* Google Calendar connect prompt */}
      {!googleConnected && (
        <div className="mb-8 p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2 mb-2">
            <ExternalLink className="text-blue-500" />
            <span className="text-sm font-medium dark:text-white">Google Calendar</span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Connect to sync your events and enable AI scheduling
          </p>
          <button
            onClick={() => { if (onNavigateToIntegrations) onNavigateToIntegrations(); }}
            className="w-full flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition shadow-sm"
          >
            <Settings className="text-sm" />
            Connect in Settings
          </button>
          {syncError && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
              <AlertTriangle />
              {syncError}
            </p>
          )}
        </div>
      )}

      {/* Team Calendars */}
      <SharedCalendarPanel
        visibleCalendars={visibleCalendars}
        toggleCalendarVisibility={toggleCalendarVisibility}
      />

      {/* Team Section */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Team</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTeamModal(true)}
              className="text-rose-400 hover:text-rose-500 transition"
              title="Create New Team"
            >
              <Plus className="text-[10px]" />
            </button>
            {selectedTeam && teams.length > 1 && (
              <button
                onClick={() => openEditTeam(selectedTeam)}
                className="text-zinc-400 hover:text-zinc-600 transition"
                title="Edit Team"
              >
                <Pen className="text-[10px]" />
              </button>
            )}
          </div>
        </div>

        {/* Team Selector Dropdown */}
        {teams.length > 1 && (
          <select
            aria-label="Select team"
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="w-full mb-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-400 focus:border-rose-400 transition"
          >
            {teams.map(team => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        )}

        <div className="space-y-2">
          {teamMembers.length === 0 ? (
            <div className="text-center py-4">
              <Users className="text-zinc-300 dark:text-zinc-600 text-2xl mb-2" />
              <p className="text-xs text-zinc-500">No team members yet</p>
              <button
                onClick={() => openEditTeam(selectedTeam!)}
                className="text-xs text-rose-400 hover:text-rose-500 mt-2"
              >
                Add members
              </button>
            </div>
          ) : (
            <>
              {teamMembers.map(contact => {
                const overlayOn = overlayMemberIds.has(contact.id);
                return (
                  <div key={contact.id} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 group p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-6 h-6 rounded-full ${contact.avatarColor} flex-shrink-0 flex items-center justify-center text-white text-xs font-bold`}>
                        {contact.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="group-hover:text-zinc-900 dark:group-hover:text-white truncate block transition">{contact.name}</span>
                        <span className="text-[10px] text-zinc-400 truncate block">{contact.email}</span>
                      </div>
                    </div>
                    {(viewMode === 'week' || viewMode === 'day') && (
                      <button
                        onClick={() => setOverlayMemberIds(prev => {
                          const next = new Set(prev);
                          if (next.has(contact.id)) next.delete(contact.id);
                          else next.add(contact.id);
                          return next;
                        })}
                        aria-label={overlayOn ? `Hide ${contact.name}'s schedule` : `Show ${contact.name}'s schedule`}
                        title={overlayOn ? `Hide ${contact.name}'s schedule` : `Show ${contact.name}'s schedule`}
                        className={`w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-md border transition ${
                          overlayOn
                            ? `${contact.avatarColor} border-transparent text-white`
                            : 'border-zinc-300 dark:border-zinc-600 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
                        }`}
                      >
                        <i className={`fa-solid ${overlayOn ? 'fa-eye' : 'fa-eye-slash'} text-[10px]`} aria-hidden="true" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setInviteContact(contact);
                        setShowInviteModal(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition flex-shrink-0"
                      title="Schedule meeting with this contact"
                    >
                      <CalendarPlus className="text-[10px]" />
                    </button>
                  </div>
                );
              })}

              {/* Free-time finder */}
              {teamMembers.length > 0 && (viewMode === 'week' || viewMode === 'day') && (
                <button
                  onClick={() => setShowFreeTimeFinder(f => !f)}
                  className={`mt-1 w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    showFreeTimeFinder
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-white'
                  }`}
                >
                  <Clock className="text-[10px]" />
                  Find free time
                </button>
              )}

              {showFreeTimeFinder && (viewMode === 'week' || viewMode === 'day') && (
                <div className="mt-2 border border-emerald-200 dark:border-emerald-800/60 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2">
                    <Wand2 className="text-emerald-500 text-[10px]" />
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                      Available slots
                    </span>
                  </div>
                  {freeTimeSlots.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-zinc-400 dark:text-zinc-500 text-center">
                      No free slots found this {viewMode === 'week' ? 'week' : 'day'}
                    </div>
                  ) : (
                    <div className="divide-y divide-emerald-100 dark:divide-emerald-900/40 max-h-40 overflow-y-auto">
                      {freeTimeSlots.map((slot, i) => {
                        const fmt = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                        const dur = Math.round((slot.end.getTime() - slot.start.getTime()) / 60000);
                        return (
                          <button
                            key={i}
                            className="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition group"
                            title="Click to create an event in this slot"
                            onClick={() => {
                              setNewEventDate(slot.start.toISOString().split('T')[0]);
                              setNewEventTime(slot.start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
                              setShowEventModal(true);
                            }}
                          >
                            <div className="text-[11px] font-medium text-zinc-700 dark:text-zinc-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition">
                              {fmt(slot.start)} – {fmt(slot.end)}
                            </div>
                            <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                              {slot.dayLabel} · {dur} min
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
