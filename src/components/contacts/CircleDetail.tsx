// ============================================
// CIRCLE DETAIL
// Drill-down panel for a single contact circle.
// Shows members, health score, bulk actions, and AI suggestions.
// ============================================

import React, { useState } from 'react';
import { ContactCircle, CIRCLE_COLOR_PALETTE } from '../../types/contactCircleTypes';
import { Contact } from '../../types';
import { RelationshipProfile, getRelationshipHealthColor } from '../../types/relationshipTypes';
import {
  updateCircle,
  deleteCircle,
  removeMember,
} from '../../services/contactCircleService';

// ==================== TYPES ====================

interface CircleDetailProps {
  circle: ContactCircle;
  contacts: Contact[];            // all app contacts (for member lookup)
  profiles: RelationshipProfile[];
  onClose: () => void;
  onCircleUpdated: (updated: ContactCircle) => void;
  onCircleDeleted: (circleId: string) => void;
  onContactClick: (contact: Contact) => void;
  onBulkMessage: (circle: ContactCircle) => void;
}

// ==================== HELPERS ====================

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function getHealthLabel(score?: number): string {
  if (score === undefined) return 'No data';
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Healthy';
  if (score >= 40) return 'Fair';
  return 'Needs attention';
}

// ==================== MEMBER CARD ====================

interface MemberCardProps {
  contact: Contact;
  profile?: RelationshipProfile;
  onRemove: () => void;
  onClick: () => void;
}

const MemberCard: React.FC<MemberCardProps> = ({ contact, profile, onRemove, onClick }) => {
  const score = profile?.relationshipScore;
  const ringColor = score !== undefined ? getRelationshipHealthColor(score) : '#6b7280';

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 group hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors">
      {/* Avatar */}
      <button onClick={onClick} className="flex-shrink-0">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{
            backgroundColor: contact.avatarColor || '#6366f1',
            boxShadow: `0 0 0 2px ${ringColor}`,
          }}
        >
          {contact.name.charAt(0)}
        </div>
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0" onClick={onClick}>
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400">
          {contact.name}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
          {contact.role}{contact.company ? ` · ${contact.company}` : ''}
        </p>
      </div>

      {/* Score */}
      {score !== undefined && (
        <span className={`text-xs font-semibold flex-shrink-0 ${getScoreColor(score)}`}>
          {score}
        </span>
      )}

      {/* Remove button (shown on hover) */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-full text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
        title="Remove from circle"
      >
        <i className="fa-solid fa-xmark text-xs" />
      </button>
    </div>
  );
};

// ==================== MAIN COMPONENT ====================

export const CircleDetail: React.FC<CircleDetailProps> = ({
  circle,
  contacts,
  profiles,
  onClose,
  onCircleUpdated,
  onCircleDeleted,
  onContactClick,
  onBulkMessage,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(circle.name);
  const [selectedColor, setSelectedColor] = useState(circle.color);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localCircle, setLocalCircle] = useState(circle);

  // Build lookup maps
  const contactMap = new Map(contacts.map(c => [c.id, c]));
  const profileByEmail = new Map(profiles.map(p => [p.contactEmail.toLowerCase(), p]));

  const memberContacts = localCircle.memberContactIds
    .map(id => contactMap.get(id))
    .filter((c): c is Contact => c !== undefined);

  const avgScore = memberContacts.length > 0
    ? Math.round(
        memberContacts.reduce((sum, c) => {
          const p = profileByEmail.get(c.email?.toLowerCase() ?? '');
          return sum + (p?.relationshipScore ?? 50);
        }, 0) / memberContacts.length
      )
    : undefined;

  async function handleSaveName() {
    if (!editName.trim() || editName === localCircle.name) {
      setIsEditingName(false);
      return;
    }
    const updated = { ...localCircle, name: editName.trim(), color: selectedColor };
    setLocalCircle(updated);
    await updateCircle(circle.id, circle.userId, { name: editName.trim(), color: selectedColor });
    onCircleUpdated(updated);
    setIsEditingName(false);
  }

  async function handleColorChange(color: string) {
    setSelectedColor(color);
    const updated = { ...localCircle, color };
    setLocalCircle(updated);
    await updateCircle(circle.id, circle.userId, { color });
    onCircleUpdated(updated);
  }

  async function handleRemoveMember(contactId: string) {
    const updated = {
      ...localCircle,
      memberContactIds: localCircle.memberContactIds.filter(id => id !== contactId),
    };
    setLocalCircle(updated);
    await removeMember(circle.id, circle.userId, contactId);
    onCircleUpdated(updated);
  }

  async function handleDelete() {
    setIsDeleting(true);
    await deleteCircle(circle.id, circle.userId);
    onCircleDeleted(circle.id);
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[420px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 flex flex-col">

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition"
          >
            <i className="fa-solid fa-xmark" />
          </button>
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Circle Details</span>
        </div>
        {/* Source badge */}
        {localCircle.source === 'auto' && (
          <span className="text-xs px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full font-medium">
            ✨ AI detected
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Hero */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
          {/* Color picker + name */}
          <div className="flex items-start gap-4 mb-4">
            {/* Color dot */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-md flex-shrink-0"
              style={{ backgroundColor: `${selectedColor}22`, border: `2px solid ${selectedColor}` }}
            >
              {localCircle.icon ?? '◉'}
            </div>

            <div className="flex-1 min-w-0">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditingName(false); }}
                    className="flex-1 text-lg font-bold bg-transparent border-b-2 border-indigo-500 outline-none text-zinc-800 dark:text-zinc-100"
                  />
                  <button onClick={handleSaveName} className="text-indigo-500 text-sm font-medium">Save</button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="text-left group"
                >
                  <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {localCircle.name}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Click to rename</p>
                </button>
              )}
            </div>
          </div>

          {/* Color palette */}
          <div className="flex items-center gap-1.5 mb-4">
            <span className="text-xs text-zinc-400 mr-1">Color:</span>
            {CIRCLE_COLOR_PALETTE.map(color => (
              <button
                key={color}
                onClick={() => handleColorChange(color)}
                className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${selectedColor === color ? 'ring-2 ring-offset-1 ring-zinc-800 dark:ring-zinc-200 scale-110' : ''}`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 text-center border border-zinc-100 dark:border-zinc-800">
              <div className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{memberContacts.length}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Members</div>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 text-center border border-zinc-100 dark:border-zinc-800">
              <div className={`text-xl font-bold ${avgScore !== undefined ? getScoreColor(avgScore) : 'text-zinc-400'}`}>
                {avgScore ?? '—'}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Avg score</div>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 text-center border border-zinc-100 dark:border-zinc-800">
              <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {getHealthLabel(avgScore)}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Health</div>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center gap-2">
          <button
            onClick={() => onBulkMessage(localCircle)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
          >
            <i className="fa-solid fa-message text-xs" />
            Message all
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          >
            <i className="fa-solid fa-video text-xs" />
            Group meeting
          </button>
        </div>

        {/* Members list */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Members · {memberContacts.length}
            </span>
          </div>

          {memberContacts.length === 0 ? (
            <div className="py-8 text-center text-zinc-400">
              <i className="fa-solid fa-user-slash text-2xl mb-2" />
              <p className="text-sm">No members in this circle</p>
            </div>
          ) : (
            <div className="space-y-2">
              {memberContacts.map(contact => {
                const profile = profileByEmail.get(contact.email?.toLowerCase() ?? '');
                return (
                  <MemberCard
                    key={contact.id}
                    contact={contact}
                    profile={profile}
                    onClick={() => onContactClick(contact)}
                    onRemove={() => handleRemoveMember(contact.id)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="px-6 pb-6">
          <div className="border border-rose-200 dark:border-rose-900/40 rounded-xl p-4">
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2">Danger Zone</p>
            {isDeleting ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Are you sure?</span>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setIsDeleting(false)}
                  className="px-3 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsDeleting(true)}
                className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors"
              >
                <i className="fa-solid fa-trash-can" />
                Delete this circle
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CircleDetail;
