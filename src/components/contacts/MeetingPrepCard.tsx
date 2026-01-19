// ============================================
// MEETING PREP CARD COMPONENT
// Pre-meeting context and preparation card
// ============================================

import React, { useState } from 'react';
import {
  MeetingPrepCard as MeetingPrepCardType,
  AttendeeProfile,
  getRelationshipHealthColor,
  formatLastInteraction,
} from '../../types/relationshipTypes';

interface MeetingPrepCardProps {
  card: MeetingPrepCardType;
  onViewProfile?: (email: string) => void;
  onDismiss?: () => void;
  compact?: boolean;
}

export const MeetingPrepCardComponent: React.FC<MeetingPrepCardProps> = ({
  card,
  onViewProfile,
  onDismiss,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact);

  const timeUntil = getTimeUntilMeeting(card.eventStart);
  const isUrgent = new Date(card.eventStart).getTime() - Date.now() < 60 * 60 * 1000; // Less than 1 hour

  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-md transition ${
          isUrgent
            ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-900/30'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isUrgent
              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
          }`}
        >
          <i className="fa-solid fa-calendar-check"></i>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
            {card.eventTitle}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {timeUntil} · {card.attendeeCount} attendee{card.attendeeCount !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
            View Prep
          </span>
          <i className="fa-solid fa-chevron-right text-xs text-zinc-400"></i>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isUrgent
          ? 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 border-orange-200 dark:border-orange-900/30'
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isUrgent
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
              }`}
            >
              <i className="fa-solid fa-calendar-check text-xl"></i>
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white">
                {card.eventTitle}
              </h3>
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                <span>{formatMeetingTime(card.eventStart)}</span>
                <span>·</span>
                <span
                  className={`font-medium ${
                    isUrgent ? 'text-orange-600 dark:text-orange-400' : ''
                  }`}
                >
                  {timeUntil}
                </span>
              </div>
            </div>
          </div>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>
      </div>

      {/* Attendees */}
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
          Attendees ({card.attendeeCount})
        </h4>
        <div className="space-y-2">
          {card.attendeeProfiles.slice(0, 5).map((attendee, idx) => (
            <AttendeeRow
              key={idx}
              attendee={attendee}
              onClick={onViewProfile}
            />
          ))}
          {card.attendeeCount > 5 && (
            <div className="text-xs text-zinc-500 text-center py-1">
              +{card.attendeeCount - 5} more
            </div>
          )}
        </div>
      </div>

      {/* AI Content */}
      <div className="p-4 space-y-4">
        {/* Summary */}
        {card.aiSummary && (
          <div>
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Context
            </h4>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {card.aiSummary}
            </p>
          </div>
        )}

        {/* Talking Points */}
        {card.aiTalkingPoints.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Talking Points
            </h4>
            <ul className="space-y-1.5">
              {card.aiTalkingPoints.map((point, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                >
                  <i className="fa-solid fa-circle text-[4px] text-purple-500 mt-2"></i>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Questions to Ask */}
        {card.aiQuestionsToAsk.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Questions to Ask
            </h4>
            <ul className="space-y-1.5">
              {card.aiQuestionsToAsk.map((question, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                >
                  <i className="fa-solid fa-circle-question text-blue-500 text-xs mt-0.5"></i>
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recent Emails */}
        {card.recentEmails.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Recent Emails
            </h4>
            <div className="space-y-1">
              {card.recentEmails.slice(0, 3).map((email, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm"
                >
                  <i className="fa-solid fa-envelope text-zinc-400 text-xs"></i>
                  <span className="text-zinc-700 dark:text-zinc-300 truncate">
                    {email.subject}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User Notes */}
      <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
          Your Notes
        </h4>
        {card.userNotes ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {card.userNotes}
          </p>
        ) : (
          <p className="text-sm text-zinc-400 italic">
            Add your notes for this meeting...
          </p>
        )}
      </div>
    </div>
  );
};

// Attendee row component
interface AttendeeRowProps {
  attendee: AttendeeProfile;
  onClick?: (email: string) => void;
}

const AttendeeRow: React.FC<AttendeeRowProps> = ({ attendee, onClick }) => {
  const healthColor = attendee.relationshipScore
    ? getRelationshipHealthColor(attendee.relationshipScore)
    : '#9ca3af';

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg ${
        onClick ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer' : ''
      } transition`}
      onClick={() => onClick?.(attendee.email)}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
        style={{ backgroundColor: healthColor }}
      >
        {attendee.name?.[0] || attendee.email[0].toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-zinc-900 dark:text-white truncate">
          {attendee.name || attendee.email}
        </div>
        {attendee.company && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {attendee.title ? `${attendee.title} at ` : ''}{attendee.company}
          </div>
        )}
      </div>

      {attendee.relationshipScore !== undefined && (
        <div
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `${healthColor}15`,
            color: healthColor,
          }}
        >
          {attendee.relationshipScore}
        </div>
      )}
    </div>
  );
};

// Helper functions
function getTimeUntilMeeting(eventStart: Date): string {
  const now = new Date();
  const start = new Date(eventStart);
  const diff = start.getTime() - now.getTime();

  if (diff < 0) return 'Started';

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `in ${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `in ${minutes} min`;
  return 'Starting now';
}

function formatMeetingTime(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Banner for upcoming meetings
interface MeetingPrepBannerProps {
  cards: MeetingPrepCardType[];
  onViewCard: (card: MeetingPrepCardType) => void;
}

export const MeetingPrepBanner: React.FC<MeetingPrepBannerProps> = ({
  cards,
  onViewCard,
}) => {
  if (cards.length === 0) return null;

  const nextMeeting = cards[0];
  const isUrgent = new Date(nextMeeting.eventStart).getTime() - Date.now() < 60 * 60 * 1000;

  return (
    <div
      className={`p-3 rounded-lg flex items-center gap-3 cursor-pointer transition ${
        isUrgent
          ? 'bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/20 dark:to-amber-900/20 hover:from-orange-200 hover:to-amber-200'
          : 'bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/20 dark:to-indigo-900/20 hover:from-purple-200 hover:to-indigo-200'
      }`}
      onClick={() => onViewCard(nextMeeting)}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          isUrgent
            ? 'bg-orange-200 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
            : 'bg-purple-200 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
        }`}
      >
        <i className="fa-solid fa-calendar-check"></i>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-zinc-900 dark:text-white truncate">
          {nextMeeting.eventTitle}
        </div>
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          {getTimeUntilMeeting(nextMeeting.eventStart)} · {nextMeeting.knownAttendees} known attendee{nextMeeting.knownAttendees !== 1 ? 's' : ''}
        </div>
      </div>

      <span className={`text-xs font-medium ${isUrgent ? 'text-orange-600 dark:text-orange-400' : 'text-purple-600 dark:text-purple-400'}`}>
        Prep Now
      </span>
      <i className={`fa-solid fa-chevron-right text-xs ${isUrgent ? 'text-orange-400' : 'text-purple-400'}`}></i>
    </div>
  );
};

export default MeetingPrepCardComponent;
