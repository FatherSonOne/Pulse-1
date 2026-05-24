import React from 'react';
import { ChevronLeft, LucideIcon } from 'lucide-react';

interface VoxModeHeaderProps {
  modeName: string;
  modeTagline: string;
  /** Mono eyebrow above the title — studio masthead pattern (e.g.
   *  "DIRECT VOICE"). When set, it sits above modeName; modeTagline only
   *  renders when non-empty. */
  eyebrow?: string;
  modeIcon: LucideIcon;
  onBack: () => void;
  isDarkMode?: boolean;
  actions?: React.ReactNode;
  /**
   * @deprecated Stage 4 brand sweep — VoxModeHeader is now coral-only. The
   * prop is retained on the type for callsite tolerance during the transition;
   * it is intentionally ignored.
   */
  modeColor?: string;
}

const VoxModeHeader: React.FC<VoxModeHeaderProps> = ({
  modeName,
  modeTagline,
  eyebrow,
  modeIcon: Icon,
  onBack,
  isDarkMode = false,
  actions,
}) => {
  const tc = {
    pageBg: isDarkMode ? 'bg-zinc-950' : 'bg-white',
    border: isDarkMode ? 'border-zinc-800' : 'border-zinc-200',
    text: isDarkMode ? 'text-zinc-100' : 'text-zinc-900',
    textSecondary: isDarkMode ? 'text-zinc-400' : 'text-zinc-600',
    btnGhost: isDarkMode
      ? 'hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100'
      : 'hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900',
  };

  return (
    <div className={`px-4 md:px-6 py-4 border-b ${tc.border} ${tc.pageBg}`}>
      <div className="flex items-center gap-3 md:gap-4">
        <button
          onClick={onBack}
          className={`p-2 rounded-xl ${tc.btnGhost} transition`}
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Mode icon — neutral studio chrome (coral reserved for active /
            record / AI / primary-CTA per the coral budget). */}
        <div
          className={`p-2.5 rounded-xl flex items-center ${
            isDarkMode ? 'bg-[rgba(255,255,255,0.055)] text-[#b4b4b8]' : 'bg-[#f2f2f2] text-[#52525b]'
          }`}
        >
          <Icon className="w-5 h-5 md:w-6 md:h-6" />
        </div>

        <div className="flex-1 min-w-0">
          {eyebrow && (
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] leading-none mb-0.5 truncate text-zinc-500 dark:text-zinc-400">
              {eyebrow}
            </p>
          )}
          <h1 className={`text-lg md:text-xl font-semibold ${tc.text}`}>{modeName}</h1>
          {modeTagline && (
            <p className={`text-xs md:text-sm font-mono uppercase tracking-[0.1em] ${tc.textSecondary} hidden sm:block`}>
              {modeTagline}
            </p>
          )}
        </div>

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};

export default React.memo(VoxModeHeader);
