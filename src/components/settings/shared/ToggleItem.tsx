import React from 'react';

interface ToggleItemProps {
  label: string;
  desc: string;
  active: boolean;
  onToggle: () => void;
}

export const ToggleItem: React.FC<ToggleItemProps> = ({ label, desc, active, onToggle }) => (
  <div className="flex justify-between items-center gap-4 group cursor-pointer" onClick={onToggle}>
    <div className="min-w-0">
      <div className="dark:text-white text-zinc-900 font-medium text-sm">{label}</div>
      {desc && <div className="text-zinc-500 text-xs">{desc}</div>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`Toggle ${label}`}
      className={`shrink-0 w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${
        active ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'
      }`}
    >
      <div
        className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
          active ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);
