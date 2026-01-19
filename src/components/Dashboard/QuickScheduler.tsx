import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Contact, CalendarEvent } from '../../types';
import { dataService } from '../../services/dataService';
import { createGoogleCalendarEvent, getSessionUserSync } from '../../services/authService';
import { googleCalendarService } from '../../services/googleCalendarService';

interface ScheduledEvent {
  id: string;
  title: string;
  date: Date;
  time: string;
  duration: number;
  attendees: Contact[];
  synced?: 'google' | 'microsoft' | 'local';
  meetLink?: string;
}

interface QuickSchedulerProps {
  onEventCreated?: (event: ScheduledEvent) => void;
}

const QuickScheduler: React.FC<QuickSchedulerProps> = ({ onEventCreated }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Google Calendar events state
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [loadingGoogleEvents, setLoadingGoogleEvents] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  // Attendee search state
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<Contact[]>([]);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const attendeeInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    duration: 30,
  });

  // Load contacts from Supabase
  const loadContacts = useCallback(async () => {
    try {
      const dbContacts = await dataService.getContacts();
      setContacts(dbContacts);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Load Google Calendar events for current month
  const loadGoogleEvents = useCallback(async () => {
    const user = getSessionUserSync();
    if (!user?.connectedProviders?.google) return;

    setLoadingGoogleEvents(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      const events = await googleCalendarService.getAllEvents({
        timeMin: startOfMonth,
        timeMax: endOfMonth,
      });
      setGoogleEvents(events);
    } catch (error) {
      console.error('Failed to load Google Calendar events:', error);
    } finally {
      setLoadingGoogleEvents(false);
    }
  }, [currentDate]);

  useEffect(() => {
    loadGoogleEvents();
  }, [loadGoogleEvents]);

  // Get Google events count for a specific day
  const getGoogleEventsForDay = useCallback((day: number): CalendarEvent[] => {
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return googleEvents.filter(e => {
      const eventDate = new Date(e.start);
      return eventDate.toDateString() === dayDate.toDateString();
    });
  }, [currentDate, googleEvents]);

  // Get events for selected day (combines local and Google)
  const selectedDayEvents = useMemo(() => {
    if (selectedDay === null) {
      // If no day selected, show today's events
      const today = new Date();
      if (today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear()) {
        return getGoogleEventsForDay(today.getDate());
      }
      return [];
    }
    return getGoogleEventsForDay(selectedDay);
  }, [selectedDay, currentDate, getGoogleEventsForDay]);

  // Filter contacts based on search
  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(attendeeSearch.toLowerCase()) ||
    contact.email?.toLowerCase().includes(attendeeSearch.toLowerCase())
  ).filter(contact =>
    !selectedAttendees.find(a => a.id === contact.id)
  ).slice(0, 5);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          attendeeInputRef.current && !attendeeInputRef.current.contains(event.target as Node)) {
        setShowContactDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle clicking on a day
  const handleDayClick = (day: number) => {
    const selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = selectedDate.toISOString().split('T')[0];
    setSelectedDay(day);
    setFormData(prev => ({ ...prev, date: dateStr }));
    setShowForm(true);
  };

  // Get days in month
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  // Get first day of month (0 = Sunday)
  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Handle previous month
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  // Handle next month
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  // Add attendee from search
  const handleAddAttendee = (contact: Contact) => {
    setSelectedAttendees(prev => [...prev, contact]);
    setAttendeeSearch('');
    setShowContactDropdown(false);
    attendeeInputRef.current?.focus();
  };

  // Remove attendee
  const handleRemoveAttendee = (contactId: string) => {
    setSelectedAttendees(prev => prev.filter(a => a.id !== contactId));
  };

  // Add event with calendar sync
  const handleAddEvent = async () => {
    if (!formData.title) {
      alert('Please enter event title');
      return;
    }

    setIsSyncing(true);
    const user = getSessionUserSync();

    let meetLink: string | undefined;
    let syncedTo: 'google' | 'microsoft' | 'local' = 'local';

    // Check if user has Google connected and sync
    if (user?.connectedProviders?.google) {
      try {
        meetLink = await createGoogleCalendarEvent(
          formData.title,
          selectedAttendees.map(a => a.email || a.name)
        );
        syncedTo = 'google';
        setSyncSuccess('google');
      } catch (error) {
        console.error('Failed to sync with Google Calendar:', error);
      }
    } else if (user?.connectedProviders?.microsoft) {
      // Future: Add Microsoft/Outlook sync
      syncedTo = 'microsoft';
      setSyncSuccess('microsoft');
    }

    const newEvent: ScheduledEvent = {
      id: Date.now().toString(),
      title: formData.title,
      date: new Date(formData.date),
      time: formData.time,
      duration: formData.duration,
      attendees: selectedAttendees,
      synced: syncedTo,
      meetLink,
    };

    setEvents([...events, newEvent]);
    onEventCreated?.(newEvent);

    // Reset form
    setFormData({
      title: '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      duration: 30,
    });
    setSelectedAttendees([]);
    setShowForm(false);
    setSelectedDay(null);
    setIsSyncing(false);

    // Clear success message after delay
    setTimeout(() => setSyncSuccess(null), 3000);
  };

  // Get events for specific day
  const getEventsForDay = (day: number) => {
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return events.filter(e =>
      e.date.toDateString() === dayDate.toDateString()
    );
  };

  // Check if day is today
  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  // Delete event
  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  // Format selected date for display
  const formatSelectedDate = () => {
    const date = new Date(formData.date + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  const user = getSessionUserSync();
  const hasCalendarSync = user?.connectedProviders?.google || user?.connectedProviders?.microsoft;

  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 animate-slideInUp flex flex-col">
      {/* Success Toast */}
      {syncSuccess && (
        <div className="absolute top-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 animate-fadeIn z-50 shadow-lg">
          <i className={`fa-brands fa-${syncSuccess === 'google' ? 'google' : 'microsoft'}`}></i>
          Synced to {syncSuccess === 'google' ? 'Google' : 'Outlook'} Calendar
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-900">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-calendar-plus text-blue-500"></i>
          <h3 className="font-medium text-lg dark:text-white text-zinc-900">Quick Scheduler</h3>
          {hasCalendarSync && (
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded font-semibold">
              SYNCED
            </span>
          )}
        </div>
        <button
          className="px-3 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-bold uppercase tracking-wider hover:opacity-90 transition"
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) {
              setSelectedDay(null);
              setSelectedAttendees([]);
              setAttendeeSearch('');
            }
          }}
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add Event Form */}
      {showForm && (
        <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border-l-4 border-blue-500 shadow-lg relative z-10">
          {/* Selected Date Header */}
          <div className="mb-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <i className="fa-solid fa-calendar-check"></i>
              <span className="text-sm font-semibold">{formatSelectedDate()}</span>
            </div>
          </div>

          <div className="space-y-3">
            {/* Event Title */}
            <input
              type="text"
              placeholder="Event Title"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              autoFocus
              className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
            />

            {/* Time and Duration Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Time</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm dark:text-white focus:border-blue-500 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Duration</label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm dark:text-white focus:border-blue-500 outline-none transition"
                >
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
            </div>

            {/* Attendees with Autocomplete */}
            <div className="relative">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Attendees</label>

              {/* Selected Attendees Tags */}
              {selectedAttendees.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {selectedAttendees.map(attendee => (
                    <span
                      key={attendee.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs"
                    >
                      <span className={`w-4 h-4 rounded-full ${attendee.avatarColor} flex items-center justify-center text-white text-[8px] font-bold`}>
                        {attendee.name.charAt(0)}
                      </span>
                      {attendee.name.split(' ')[0]}
                      <button
                        onClick={() => handleRemoveAttendee(attendee.id)}
                        className="hover:text-red-500 transition"
                      >
                        <i className="fa-solid fa-times text-[10px]"></i>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search Input */}
              <div className="relative">
                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs"></i>
                <input
                  ref={attendeeInputRef}
                  type="text"
                  placeholder="Search contacts..."
                  value={attendeeSearch}
                  onChange={(e) => {
                    setAttendeeSearch(e.target.value);
                    setShowContactDropdown(true);
                  }}
                  onFocus={() => setShowContactDropdown(true)}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm dark:text-white focus:border-blue-500 outline-none transition"
                />
              </div>

              {/* Contact Dropdown */}
              {showContactDropdown && (attendeeSearch || filteredContacts.length > 0) && (
                <div
                  ref={dropdownRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto"
                >
                  {filteredContacts.length > 0 ? (
                    filteredContacts.map(contact => (
                      <button
                        key={contact.id}
                        onClick={() => handleAddAttendee(contact)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-left"
                      >
                        <div className={`w-8 h-8 rounded-full ${contact.avatarColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                          {contact.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium dark:text-white truncate">{contact.name}</div>
                          <div className="text-xs text-zinc-500 truncate">{contact.email || contact.role}</div>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${
                          contact.status === 'online' ? 'bg-emerald-500' :
                          contact.status === 'busy' ? 'bg-red-500' : 'bg-zinc-400'
                        }`}></div>
                      </button>
                    ))
                  ) : attendeeSearch ? (
                    <div className="px-3 py-4 text-center text-zinc-500 text-sm">
                      No contacts found
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Calendar Sync Indicator */}
            {hasCalendarSync && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-xs">
                <i className={`fa-brands fa-${user?.connectedProviders?.google ? 'google' : 'microsoft'} text-emerald-600 dark:text-emerald-400`}></i>
                <span className="text-emerald-700 dark:text-emerald-300">
                  Will sync to {user?.connectedProviders?.google ? 'Google' : 'Outlook'} Calendar
                </span>
              </div>
            )}

            {/* Submit Button */}
            <button
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              onClick={handleAddEvent}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  Syncing...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-plus"></i>
                  Schedule Event
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Mini Calendar */}
      <div className="mb-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4 px-1">
          <button
            className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition flex items-center justify-center"
            onClick={handlePrevMonth}
          >
            <i className="fa-solid fa-chevron-left text-xs"></i>
          </button>
          <h4 className="text-sm font-semibold dark:text-white text-zinc-900">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h4>
          <button
            className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition flex items-center justify-center"
            onClick={handleNextMonth}
          >
            <i className="fa-solid fa-chevron-right text-xs"></i>
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Weekday headers */}
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-zinc-400 uppercase py-2">{day}</div>
          ))}

          {/* Empty cells for days before month starts */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square"></div>
          ))}

          {/* Days of month */}
          {days.map(day => {
            const dayEvents = getEventsForDay(day);
            const googleDayEvents = getGoogleEventsForDay(day);
            const totalEvents = dayEvents.length + googleDayEvents.length;
            const isTodayDate = isToday(day);
            const isSelected = selectedDay === day;
            const isHovered = hoveredDay === day;

            return (
              <div
                key={day}
                onClick={() => handleDayClick(day)}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs cursor-pointer transition relative group
                  ${isSelected
                    ? 'bg-blue-500 text-white font-bold ring-2 ring-blue-300 ring-offset-1'
                    : isTodayDate
                      ? 'bg-blue-600 text-white font-bold'
                      : totalEvents > 0
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400'}
                `}
              >
                <span>{day}</span>
                {/* Event dots indicator */}
                {totalEvents > 0 && !isTodayDate && !isSelected && (
                  <div className="absolute bottom-1 flex gap-0.5">
                    {Array.from({ length: Math.min(totalEvents, 3) }).map((_, i) => (
                      <div key={i} className={`w-1 h-1 rounded-full ${googleDayEvents.length > i ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                    ))}
                  </div>
                )}
                {/* Event count badge for today */}
                {totalEvents > 0 && isTodayDate && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[8px] flex items-center justify-center text-white font-bold">
                    {totalEvents}
                  </div>
                )}
                {/* Hover tooltip */}
                {isHovered && totalEvents > 0 && !isSelected && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                    {totalEvents} event{totalEvents > 1 ? 's' : ''}
                    {googleDayEvents.length > 0 && <span className="text-emerald-400 dark:text-emerald-600 ml-1">({googleDayEvents.length} synced)</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Events */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            {selectedDay !== null
              ? new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              : 'Today\'s Schedule'
            }
          </h4>
          <span className="text-[10px] text-zinc-500">
            {selectedDayEvents.length + getEventsForDay(selectedDay || new Date().getDate()).length} events
            {loadingGoogleEvents && <i className="fa-solid fa-circle-notch fa-spin ml-1"></i>}
          </span>
        </div>

        {selectedDayEvents.length === 0 && getEventsForDay(selectedDay || new Date().getDate()).length === 0 ? (
          <div className="text-center py-6 text-zinc-400 text-sm">
            <i className="fa-regular fa-calendar-check mb-2 text-xl"></i>
            <p className="font-light text-xs">No events scheduled</p>
            <p className="text-[10px] text-zinc-500 mt-1">Click a day to view events</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
            {/* Google Calendar Events */}
            {selectedDayEvents
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
              .map(event => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border-l-3 border-l-emerald-500 group hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  <div className="flex-shrink-0 w-10 text-center">
                    <div className="text-[10px] font-bold text-emerald-500 uppercase">
                      <i className="fa-brands fa-google"></i>
                    </div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-white">
                      {new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{event.title}</h5>
                    {event.location && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500">
                        <i className="fa-solid fa-location-dot text-[10px]"></i>
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                    {event.meetLink && (
                      <a
                        href={event.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-[10px] text-blue-500 hover:text-blue-600 transition"
                      >
                        <i className="fa-solid fa-video"></i>
                        Join Meet
                      </a>
                    )}
                    {(event.attendees?.length ?? 0) > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-400">
                        <i className="fa-solid fa-users"></i>
                        <span>{event.attendees?.length} attendee{(event.attendees?.length ?? 0) > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

            {/* Local Events */}
            {getEventsForDay(selectedDay || new Date().getDate())
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .map(event => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border-l-3 border-l-blue-500 group hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  <div className="flex-shrink-0 w-10 text-center">
                    <div className="text-[10px] font-bold text-blue-500 uppercase">
                      {event.synced === 'google' ? <i className="fa-brands fa-google"></i> : 'New'}
                    </div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-white">
                      {event.time}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{event.title}</h5>
                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                      <span>{event.duration} min</span>
                    </div>
                    {event.meetLink && (
                      <a
                        href={event.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-[10px] text-blue-500 hover:text-blue-600 transition"
                      >
                        <i className="fa-solid fa-video"></i>
                        Join Meet
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  >
                    <i className="fa-solid fa-trash text-xs"></i>
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickScheduler;
