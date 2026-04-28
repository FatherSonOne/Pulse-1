// Step 4: Rhythm.
//
// Set the dates and cadences that drive the resulting decision and tasks:
// when does this need to be decided by, when does the work need to ship,
// how often should the operator check in, and when (if ever) should Pulse
// prompt for a retrospective on the outcome.

import React from 'react';
import { DatePicker } from './primitives/DatePicker';
import { RadioGroup } from './primitives/RadioGroup';
import type { Step4Output } from './types';

interface Step4RhythmProps {
  value: Step4Output;
  onChange: (next: Step4Output) => void;
}

const CADENCE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'twice_weekly', label: 'Twice weekly' },
  { value: 'daily', label: 'Daily' },
] as const;

const REMIND_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '1', label: '1 day' },
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
] as const;

const RETRO_OPTIONS = [
  { value: '0', label: 'Skip' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
] as const;

export const Step4Rhythm: React.FC<Step4RhythmProps> = ({ value, onChange }) => {
  return (
    <div className="dw-step4">
      <header className="dw-step4-header">
        <h3 className="dw-step4-title">Set the rhythm</h3>
        <p className="dw-step4-sub">
          When does this need to land, and how often should Pulse nudge you.
        </p>
      </header>

      <div className="dw-step4-grid">
        <DatePicker
          label="Decide by"
          value={value.decideByDate}
          onChange={(d) => onChange({ ...value, decideByDate: d })}
          required
          hint="The day a decision must be made by."
        />
        <DatePicker
          label="Ship by"
          value={value.shipByDate}
          onChange={(d) => onChange({ ...value, shipByDate: d })}
          hint="Optional. When the work needs to be done."
        />
      </div>

      <RadioGroup
        label="Check-in cadence"
        value={value.checkInCadence}
        onChange={(v) => onChange({ ...value, checkInCadence: v as Step4Output['checkInCadence'] })}
        options={[...CADENCE_OPTIONS]}
        hint="Pulse surfaces a check-in at this interval until the decision is made."
      />

      <RadioGroup
        label="Remind before decide-by"
        value={String(value.remindBeforeDays)}
        onChange={(v) => onChange({ ...value, remindBeforeDays: Number(v) as Step4Output['remindBeforeDays'] })}
        options={[...REMIND_OPTIONS]}
      />

      <RadioGroup
        label="Look back on this in"
        value={String(value.retrospectiveDays)}
        onChange={(v) => onChange({ ...value, retrospectiveDays: Number(v) as Step4Output['retrospectiveDays'] })}
        options={[...RETRO_OPTIONS]}
        hint="Pulse asks how the decision turned out, this many days after it lands."
      />
    </div>
  );
};
