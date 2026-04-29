// One activity event row. Used by ActivityDrawer (per-item) and
// WorkspaceActivityPanel (workspace-wide).

import React from 'react';
import {
  Circle,
  PlayCircle,
  Eye,
  AlertCircle,
  CheckCircle2,
  Plus,
  UserPlus,
  Calendar,
  Edit3,
  Trash2,
  RotateCcw,
  Archive,
  MessageSquare,
  Vote,
  CheckCircle,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { describeEvent, formatRelative } from './describeEvent';
import type { ActivityEvent } from '../../../services/decisionActivityService';
import type { User } from '../../../types';

interface ActivityEventRowProps {
  event: ActivityEvent;
  members: User[];
  /** When provided, the row becomes clickable and fires the handler. */
  onClick?: () => void;
}

function iconFor(action: string): LucideIcon {
  switch (action) {
    case 'created':
      return Plus;
    case 'status_changed':
      return PlayCircle;
    case 'assignee_changed':
      return UserPlus;
    case 'deadline_changed':
      return Calendar;
    case 'priority_changed':
    case 'title_changed':
    case 'description_changed':
      return Edit3;
    case 'deleted':
      return Trash2;
    case 'reopened':
      return RotateCcw;
    case 'archived':
      return Archive;
    case 'comment_added':
      return MessageSquare;
    case 'vote_cast':
      return Vote;
    case 'decided':
      return CheckCircle;
    case 'outcome_recorded':
      return Sparkles;
    default:
      return Circle;
  }
}

function colorFor(action: string): string {
  switch (action) {
    case 'created':
      return 'var(--dt-status-proposed)';
    case 'status_changed':
      return 'var(--dt-status-in-progress)';
    case 'decided':
      return 'var(--dt-status-decided)';
    case 'deleted':
      return 'var(--dt-status-overdue)';
    case 'archived':
      return 'var(--dt-status-cancelled)';
    case 'comment_added':
      return 'var(--dt-accent)';
    case 'vote_cast':
      return 'var(--dt-status-voting)';
    case 'outcome_recorded':
      return 'var(--dt-accent)';
    default:
      return 'var(--dt-text-muted)';
  }
}

export const ActivityEventRow: React.FC<ActivityEventRowProps> = ({ event, members, onClick }) => {
  const Icon = iconFor(event.action);
  const color = colorFor(event.action);

  const inner = (
    <>
      <span className="da-row-icon" style={{ color }} aria-hidden="true">
        <Icon size={14} />
      </span>
      <div className="da-row-body">
        <p className="da-row-text">{describeEvent(event, members)}</p>
        <span className="da-row-time dt-label">{formatRelative(event.createdAt)}</span>
      </div>
    </>
  );

  if (onClick) {
    return (
      <li className="da-row da-row-clickable">
        <button type="button" className="da-row-button" onClick={onClick}>
          {inner}
        </button>
      </li>
    );
  }

  return <li className="da-row">{inner}</li>;
};
