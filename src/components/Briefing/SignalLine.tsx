import React from 'react';
import {
  ArrowUpRight,
  AlertTriangle,
  Clock,
  Moon,
  Sparkles,
  TimerReset,
  UserMinus,
} from 'lucide-react';
import { BriefingSignal, SignalKind } from '../../services/weeklyBriefingService';

interface SignalLineProps {
  signal: BriefingSignal;
  onOpen: () => void;
}

const KIND_ICON: Record<SignalKind, React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>> = {
  cooling: UserMinus,
  at_risk: AlertTriangle,
  velocity_shift: TimerReset,
  conflict: AlertTriangle,
  win: Sparkles,
  burnout: Moon,
};

const KIND_TONE: Record<SignalKind, string> = {
  cooling: 'tone-warning',
  at_risk: 'tone-overdue',
  velocity_shift: 'tone-info',
  conflict: 'tone-overdue',
  win: 'tone-positive',
  burnout: 'tone-warning',
};

// Conflict shares the at-risk colour but needs a distinct icon at a glance.
const CONFLICT_OVERRIDE = Clock;

export const SignalLine: React.FC<SignalLineProps> = ({ signal, onOpen }) => {
  const Icon = signal.kind === 'conflict' ? CONFLICT_OVERRIDE : KIND_ICON[signal.kind];
  return (
    <li className={`briefing-signal ${KIND_TONE[signal.kind]}`}>
      <button
        type="button"
        className="briefing-signal-button"
        onClick={onOpen}
      >
        <span className="briefing-signal-glyph" aria-hidden="true">
          <Icon size={16} aria-hidden />
        </span>
        <span className="briefing-signal-text">{signal.text}</span>
        <span className="briefing-signal-open">
          Open <ArrowUpRight size={12} aria-hidden />
        </span>
      </button>
    </li>
  );
};

export default SignalLine;
