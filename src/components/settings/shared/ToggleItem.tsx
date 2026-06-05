import React from 'react';

interface ToggleItemProps {
  label: string;
  desc: string;
  active: boolean;
  onToggle: () => void;
}

export const ToggleItem: React.FC<ToggleItemProps> = ({ label, desc, active, onToggle }) => {
  // The whole row is the switch: one tab stop, a >=48px touch/focus target, and
  // no fragile click-bubbling from an inner button. The pill is purely visual.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      role="switch"
      aria-checked={active}
      aria-label={`Toggle ${label}`}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      className="flex justify-between items-center gap-4 group cursor-pointer min-h-[48px] rounded-lg"
    >
      <div className="min-w-0">
        <div className="dark:text-white text-zinc-900 font-medium text-sm">{label}</div>
        {desc && <div className="text-zinc-500 text-xs">{desc}</div>}
      </div>
      <span
        aria-hidden="true"
        className={`shrink-0 block w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${
          active ? 'bg-zinc-800 dark:bg-zinc-200' : 'bg-zinc-300 dark:bg-zinc-700'
        }`}
      >
        <span
          className={`block w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
            active ? 'translate-x-6 bg-white dark:bg-zinc-900' : 'translate-x-0 bg-white'
          }`}
        />
      </span>
    </div>
  );
};
