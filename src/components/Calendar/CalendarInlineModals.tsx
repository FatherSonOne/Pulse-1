import React from 'react';
import { ExternalLink, Loader2, Plus, Send, X } from 'lucide-react';
import { Contact } from '../../types';
import { EVENT_COLORS, Team } from './calendarTypes';

interface CalendarInlineModalsProps {
  // Team modal
  showTeamModal: boolean;
  setShowTeamModal: (v: boolean) => void;
  editingTeam: Team | null;
  resetTeamForm: () => void;
  newTeamName: string;
  setNewTeamName: (v: string) => void;
  newTeamColor: string;
  setNewTeamColor: (v: string) => void;
  contacts: Contact[];
  newTeamMembers: string[];
  setNewTeamMembers: React.Dispatch<React.SetStateAction<string[]>>;
  teams: Team[];
  handleDeleteTeam: (id: string) => void;
  handleUpdateTeam: () => void;
  handleCreateTeam: () => void;

  // Invite modal
  showInviteModal: boolean;
  setShowInviteModal: (v: boolean) => void;
  inviteContact: Contact | null;
  setInviteContact: (v: Contact | null) => void;
  handleSendInvite: (contact: Contact, details: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    description: string;
  }) => void;

  // Create Google Calendar modal
  showCreateCalendarModal: boolean;
  setShowCreateCalendarModal: (v: boolean) => void;
  newCalendarName: string;
  setNewCalendarName: (v: string) => void;
  newCalendarDescription: string;
  setNewCalendarDescription: (v: string) => void;
  handleCreateGoogleCalendar: () => void;
  creatingCalendar: boolean;
}

export const CalendarInlineModals: React.FC<CalendarInlineModalsProps> = ({
  showTeamModal, setShowTeamModal, editingTeam, resetTeamForm,
  newTeamName, setNewTeamName, newTeamColor, setNewTeamColor,
  contacts, newTeamMembers, setNewTeamMembers,
  teams, handleDeleteTeam, handleUpdateTeam, handleCreateTeam,
  showInviteModal, setShowInviteModal, inviteContact, setInviteContact, handleSendInvite,
  showCreateCalendarModal, setShowCreateCalendarModal,
  newCalendarName, setNewCalendarName, newCalendarDescription, setNewCalendarDescription,
  handleCreateGoogleCalendar, creatingCalendar,
}) => {
  return (
    <>
      {/* Team Management Modal */}
      {showTeamModal && (
        <div className="absolute inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-[var(--pulse-surface)] dark:bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-2xl w-full max-w-md shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-[var(--pulse-border)] flex items-center justify-between">
              <h3 className="text-lg font-bold dark:text-white">
                {editingTeam ? 'Edit Team' : 'Create New Team'}
              </h3>
              <button onClick={() => { setShowTeamModal(false); resetTeamForm(); }} className="text-zinc-400 hover:text-zinc-600">
                <X />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Team Name</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g., Marketing Team"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg p-3 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Team Color</label>
                <div className="flex gap-2 flex-wrap">
                  {EVENT_COLORS.map(color => (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setNewTeamColor(color.class)}
                      className={`w-8 h-8 rounded-full ${color.class} transition ring-2 ring-offset-2 ${newTeamColor === color.class ? 'ring-rose-500' : 'ring-transparent'}`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Team Members</label>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-[var(--pulse-border)] rounded-lg p-2">
                  {contacts.map(contact => (
                    <label key={contact.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTeamMembers.includes(contact.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewTeamMembers(prev => [...prev, contact.id]);
                          } else {
                            setNewTeamMembers(prev => prev.filter(id => id !== contact.id));
                          }
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <div className={`w-6 h-6 rounded-full ${contact.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                        {contact.name.charAt(0)}
                      </div>
                      <span className="text-sm dark:text-white">{contact.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-[var(--pulse-border)] flex justify-between">
              {editingTeam && teams.length > 1 && (
                <button
                  onClick={() => {
                    handleDeleteTeam(editingTeam.id);
                    setShowTeamModal(false);
                    resetTeamForm();
                  }}
                  className="px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                >
                  Delete Team
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button onClick={() => { setShowTeamModal(false); resetTeamForm(); }} className="px-4 py-2 text-zinc-500 hover:text-[var(--pulse-ink)] transition">
                  Cancel
                </button>
                <button
                  onClick={editingTeam ? handleUpdateTeam : handleCreateTeam}
                  className="px-5 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-bold hover:opacity-90 transition"
                >
                  {editingTeam ? 'Save Changes' : 'Create Team'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Invite Modal */}
      {showInviteModal && inviteContact && (
        <div className="absolute inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-[var(--pulse-surface)] dark:bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-2xl w-full max-w-md shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-[var(--pulse-border)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold dark:text-white">Schedule Meeting</h3>
                <button onClick={() => { setShowInviteModal(false); setInviteContact(null); }} className="text-zinc-400 hover:text-zinc-600">
                  <X />
                </button>
              </div>
              <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                <div className={`w-10 h-10 rounded-full ${inviteContact.avatarColor} flex items-center justify-center text-white font-bold`}>
                  {inviteContact.name.charAt(0)}
                </div>
                <div>
                  <div className="font-medium dark:text-white">{inviteContact.name}</div>
                  <div className="text-xs text-zinc-500">{inviteContact.email}</div>
                </div>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const formData = new FormData(form);
                handleSendInvite(inviteContact, {
                  title: formData.get('title') as string,
                  date: formData.get('date') as string,
                  startTime: formData.get('startTime') as string,
                  endTime: formData.get('endTime') as string,
                  description: formData.get('description') as string,
                });
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Meeting Title</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g., Project Discussion"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg p-3 dark:text-white outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Date</label>
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg p-3 dark:text-white outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Start</label>
                    <input
                      type="time"
                      name="startTime"
                      required
                      defaultValue="10:00"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg p-3 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">End</label>
                    <input
                      type="time"
                      name="endTime"
                      required
                      defaultValue="11:00"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg p-3 dark:text-white outline-none"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Description (Optional)</label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Add meeting details..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg p-3 dark:text-white outline-none resize-none"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => { setShowInviteModal(false); setInviteContact(null); }} className="px-4 py-2 text-zinc-500 hover:text-[var(--pulse-ink)] transition">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-rose-500 text-white rounded-lg text-sm font-bold hover:bg-rose-600 transition flex items-center gap-2">
                  <Send />
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Google Calendar Modal */}
      {showCreateCalendarModal && (
        <div className="absolute inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-[var(--pulse-surface)] dark:bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-2xl w-full max-w-md shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-[var(--pulse-border)] flex items-center justify-between">
              <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <ExternalLink className="text-blue-500" />
                Create New Calendar
              </h3>
              <button onClick={() => setShowCreateCalendarModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Calendar Name</label>
                <input
                  type="text"
                  value={newCalendarName}
                  onChange={(e) => setNewCalendarName(e.target.value)}
                  placeholder="e.g., Work Projects"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg p-3 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Description (Optional)</label>
                <textarea
                  value={newCalendarDescription}
                  onChange={(e) => setNewCalendarDescription(e.target.value)}
                  rows={3}
                  placeholder="What is this calendar for?"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg p-3 dark:text-white outline-none resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-[var(--pulse-border)] flex justify-end gap-3">
              <button onClick={() => setShowCreateCalendarModal(false)} className="px-4 py-2 text-zinc-500 hover:text-[var(--pulse-ink)] transition">
                Cancel
              </button>
              <button
                onClick={handleCreateGoogleCalendar}
                disabled={creatingCalendar || !newCalendarName.trim()}
                className="px-5 py-2 bg-rose-500 text-white rounded-lg text-sm font-bold hover:bg-rose-600 transition flex items-center gap-2 disabled:opacity-50"
              >
                {creatingCalendar ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus />
                    Create Calendar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
