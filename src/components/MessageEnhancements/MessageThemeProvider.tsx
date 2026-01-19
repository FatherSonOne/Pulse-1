// Message Theme Provider - Enhanced theming for message bubbles and UI
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { MessageTheme } from '../../types/messageEnhancements';

// Color pair themes - each has a user color and other person color
export interface ColorPairTheme {
  id: string;
  name: string;
  userColor: string;
  userGradient?: string;
  otherColor: string;
  otherGradient?: string;
  userTextColor: string;
  otherTextColor: string;
  borderRadius: string;
}

export const COLOR_PAIR_THEMES: ColorPairTheme[] = [
  {
    id: 'pulse-default',
    name: 'Pulse Classic',
    userColor: '#10b981', // emerald-500
    userGradient: 'linear-gradient(135deg, #10b981, #14b8a6)',
    otherColor: '#f4f4f5', // zinc-100
    userTextColor: '#ffffff',
    otherTextColor: '#18181b',
    borderRadius: '1.25rem'
  },
  {
    id: 'ocean-depths',
    name: 'Ocean Depths',
    userColor: '#0ea5e9', // sky-500
    userGradient: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
    otherColor: '#164e63', // cyan-900
    otherGradient: 'linear-gradient(135deg, #164e63, #1e3a5f)',
    userTextColor: '#ffffff',
    otherTextColor: '#e0f2fe',
    borderRadius: '1rem'
  },
  {
    id: 'sunset-glow',
    name: 'Sunset Glow',
    userColor: '#f97316', // orange-500
    userGradient: 'linear-gradient(135deg, #f97316, #f59e0b)',
    otherColor: '#fef3c7', // amber-100
    userTextColor: '#ffffff',
    otherTextColor: '#78350f',
    borderRadius: '1rem'
  },
  {
    id: 'lavender-dreams',
    name: 'Lavender Dreams',
    userColor: '#a855f7', // purple-500
    userGradient: 'linear-gradient(135deg, #a855f7, #ec4899)',
    otherColor: '#fae8ff', // fuchsia-100
    userTextColor: '#ffffff',
    otherTextColor: '#701a75',
    borderRadius: '1.5rem'
  },
  {
    id: 'forest-night',
    name: 'Forest Night',
    userColor: '#22c55e', // green-500
    userGradient: 'linear-gradient(135deg, #22c55e, #10b981)',
    otherColor: '#14532d', // green-900
    otherGradient: 'linear-gradient(135deg, #14532d, #1e3a2f)',
    userTextColor: '#ffffff',
    otherTextColor: '#bbf7d0',
    borderRadius: '0.75rem'
  },
  {
    id: 'berry-bliss',
    name: 'Berry Bliss',
    userColor: '#e11d48', // rose-600
    userGradient: 'linear-gradient(135deg, #e11d48, #be185d)',
    otherColor: '#831843', // pink-900
    otherGradient: 'linear-gradient(135deg, #831843, #4c1d24)',
    userTextColor: '#ffffff',
    otherTextColor: '#fce7f3',
    borderRadius: '1.25rem'
  },
  {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    userColor: '#3b82f6', // blue-500
    userGradient: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    otherColor: '#1e1b4b', // indigo-950
    otherGradient: 'linear-gradient(135deg, #1e1b4b, #312e81)',
    userTextColor: '#ffffff',
    otherTextColor: '#c7d2fe',
    borderRadius: '1rem'
  },
  {
    id: 'warm-neutral',
    name: 'Warm Neutral',
    userColor: '#78716c', // stone-500
    userGradient: 'linear-gradient(135deg, #78716c, #57534e)',
    otherColor: '#f5f5f4', // stone-100
    userTextColor: '#ffffff',
    otherTextColor: '#44403c',
    borderRadius: '0.5rem'
  }
];

// Legacy single-color themes for backwards compatibility
export const MESSAGE_THEMES: MessageTheme[] = [
  {
    id: 'default',
    name: 'Classic',
    bubbleColor: '#18181b', // zinc-900
    textColor: '#ffffff',
    backgroundColor: '#ffffff',
    accentColor: '#3b82f6', // blue-500
    borderRadius: '1rem',
    isDefault: true
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    bubbleColor: '#0ea5e9', // sky-500
    bubbleGradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
    textColor: '#ffffff',
    backgroundColor: '#f0f9ff',
    accentColor: '#0284c7',
    borderRadius: '1.25rem'
  },
  {
    id: 'sunset',
    name: 'Sunset',
    bubbleColor: '#f97316', // orange-500
    bubbleGradient: 'linear-gradient(135deg, #f97316, #ea580c)',
    textColor: '#ffffff',
    backgroundColor: '#fff7ed',
    accentColor: '#ea580c',
    borderRadius: '1rem'
  },
  {
    id: 'forest',
    name: 'Forest',
    bubbleColor: '#22c55e', // green-500
    bubbleGradient: 'linear-gradient(135deg, #22c55e, #16a34a)',
    textColor: '#ffffff',
    backgroundColor: '#f0fdf4',
    accentColor: '#16a34a',
    borderRadius: '1rem'
  },
  {
    id: 'lavender',
    name: 'Lavender',
    bubbleColor: '#a855f7', // purple-500
    bubbleGradient: 'linear-gradient(135deg, #a855f7, #9333ea)',
    textColor: '#ffffff',
    backgroundColor: '#faf5ff',
    accentColor: '#9333ea',
    borderRadius: '1.5rem'
  },
  {
    id: 'midnight',
    name: 'Midnight',
    bubbleColor: '#1e293b', // slate-800
    bubbleGradient: 'linear-gradient(135deg, #1e293b, #0f172a)',
    textColor: '#e2e8f0',
    backgroundColor: '#0f172a',
    accentColor: '#60a5fa',
    borderRadius: '0.75rem'
  },
  {
    id: 'rose',
    name: 'Rose Gold',
    bubbleColor: '#f43f5e', // rose-500
    bubbleGradient: 'linear-gradient(135deg, #f43f5e, #e11d48)',
    textColor: '#ffffff',
    backgroundColor: '#fff1f2',
    accentColor: '#e11d48',
    borderRadius: '1.25rem'
  },
  {
    id: 'minimal',
    name: 'Minimal',
    bubbleColor: '#f4f4f5', // zinc-100
    textColor: '#18181b',
    backgroundColor: '#ffffff',
    accentColor: '#71717a',
    borderRadius: '0.5rem'
  }
];

interface ThemeContextValue {
  currentTheme: MessageTheme;
  currentColorPair: ColorPairTheme;
  setTheme: (themeId: string) => void;
  setColorPair: (pairId: string) => void;
  themes: MessageTheme[];
  colorPairs: ColorPairTheme[];
  getBubbleStyle: (isMe: boolean) => React.CSSProperties;
  getAccentStyle: () => React.CSSProperties;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const useMessageTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useMessageTheme must be used within MessageThemeProvider');
  }
  return context;
};

interface MessageThemeProviderProps {
  children: React.ReactNode;
  initialThemeId?: string;
  initialColorPairId?: string;
  onThemeChange?: (theme: MessageTheme) => void;
  onColorPairChange?: (pair: ColorPairTheme) => void;
}

export const MessageThemeProvider: React.FC<MessageThemeProviderProps> = ({
  children,
  initialThemeId = 'default',
  initialColorPairId = 'pulse-default',
  onThemeChange,
  onColorPairChange
}) => {
  const [currentThemeId, setCurrentThemeId] = useState(initialThemeId);
  const [currentColorPairId, setCurrentColorPairId] = useState(initialColorPairId);

  const currentTheme = useMemo(() =>
    MESSAGE_THEMES.find(t => t.id === currentThemeId) || MESSAGE_THEMES[0],
    [currentThemeId]
  );

  const currentColorPair = useMemo(() =>
    COLOR_PAIR_THEMES.find(p => p.id === currentColorPairId) || COLOR_PAIR_THEMES[0],
    [currentColorPairId]
  );

  const setTheme = useCallback((themeId: string) => {
    setCurrentThemeId(themeId);
    const theme = MESSAGE_THEMES.find(t => t.id === themeId);
    if (theme && onThemeChange) {
      onThemeChange(theme);
    }
  }, [onThemeChange]);

  const setColorPair = useCallback((pairId: string) => {
    setCurrentColorPairId(pairId);
    const pair = COLOR_PAIR_THEMES.find(p => p.id === pairId);
    if (pair && onColorPairChange) {
      onColorPairChange(pair);
    }
    // Persist to localStorage
    localStorage.setItem('pulse-color-pair', pairId);
  }, [onColorPairChange]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('pulse-color-pair');
    if (saved && COLOR_PAIR_THEMES.find(p => p.id === saved)) {
      setCurrentColorPairId(saved);
    }
  }, []);

  const getBubbleStyle = useCallback((isMe: boolean): React.CSSProperties => {
    if (isMe) {
      return {
        background: currentColorPair.userGradient || currentColorPair.userColor,
        color: currentColorPair.userTextColor,
        borderRadius: currentColorPair.borderRadius
      };
    }
    return {
      background: currentColorPair.otherGradient || currentColorPair.otherColor,
      color: currentColorPair.otherTextColor,
      borderRadius: currentColorPair.borderRadius
    };
  }, [currentColorPair]);

  const getAccentStyle = useCallback((): React.CSSProperties => ({
    color: currentTheme.accentColor
  }), [currentTheme]);

  const value = useMemo(() => ({
    currentTheme,
    currentColorPair,
    setTheme,
    setColorPair,
    themes: MESSAGE_THEMES,
    colorPairs: COLOR_PAIR_THEMES,
    getBubbleStyle,
    getAccentStyle
  }), [currentTheme, currentColorPair, setTheme, setColorPair, getBubbleStyle, getAccentStyle]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Theme Selector Component
interface ThemeSelectorProps {
  onSelect?: (theme: MessageTheme) => void;
  compact?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ onSelect, compact = false }) => {
  const { currentTheme, setTheme, themes } = useMessageTheme();

  const handleSelect = (theme: MessageTheme) => {
    setTheme(theme.id);
    onSelect?.(theme);
  };

  if (compact) {
    return (
      <div className="flex gap-2 flex-wrap">
        {themes.map(theme => (
          <button
            key={theme.id}
            onClick={() => handleSelect(theme)}
            className={`
              w-8 h-8 rounded-full transition-all
              ${currentTheme.id === theme.id
                ? 'ring-2 ring-offset-2 ring-blue-500 scale-110'
                : 'hover:scale-105'
              }
            `}
            style={{
              background: theme.bubbleGradient || theme.bubbleColor
            }}
            title={theme.name}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700">
      <h3 className="text-sm font-bold text-zinc-800 dark:text-white mb-3 flex items-center gap-2">
        <i className="fa-solid fa-palette text-purple-500" />
        Message Theme
      </h3>

      <div className="grid grid-cols-4 gap-3">
        {themes.map(theme => (
          <button
            key={theme.id}
            onClick={() => handleSelect(theme)}
            className={`
              flex flex-col items-center gap-2 p-3 rounded-lg transition-all
              ${currentTheme.id === theme.id
                ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }
            `}
          >
            {/* Preview bubble */}
            <div
              className="w-full h-8 rounded-lg shadow-sm"
              style={{
                background: theme.bubbleGradient || theme.bubbleColor,
                borderRadius: theme.borderRadius
              }}
            />
            <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
              {theme.name}
            </span>
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider font-bold">
          Preview
        </p>
        <div className="space-y-2">
          {/* Received message */}
          <div className="flex justify-start">
            <div
              className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-600"
              style={{ borderRadius: currentTheme.borderRadius }}
            >
              Hey, how's the project going?
            </div>
          </div>
          {/* Sent message */}
          <div className="flex justify-end">
            <div
              className="px-4 py-2 text-sm"
              style={{
                background: currentTheme.bubbleGradient || currentTheme.bubbleColor,
                color: currentTheme.textColor,
                borderRadius: currentTheme.borderRadius
              }}
            >
              Going great! Almost done 🚀
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Inline theme picker (compact dropdown version) - Requires MessageThemeProvider context
export const InlineThemePicker: React.FC<{
  onClose?: () => void;
}> = ({ onClose }) => {
  const { currentTheme, setTheme, themes } = useMessageTheme();

  return (
    <div className="absolute bottom-full right-0 mb-2 z-50 animate-scale-in">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 p-3 min-w-[200px]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
            Choose Theme
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <i className="fa-solid fa-times text-xs" />
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {themes.map(theme => (
            <button
              key={theme.id}
              onClick={() => {
                setTheme(theme.id);
                onClose?.();
              }}
              className={`
                w-10 h-10 rounded-lg transition-all group relative
                ${currentTheme.id === theme.id
                  ? 'ring-2 ring-offset-2 ring-blue-500 scale-105'
                  : 'hover:scale-105'
                }
              `}
              style={{
                background: theme.bubbleGradient || theme.bubbleColor,
                borderRadius: theme.borderRadius
              }}
            >
              {currentTheme.id === theme.id && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <i className="fa-solid fa-check text-white text-xs" />
                </div>
              )}
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                {theme.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Standalone Theme Picker with Color Pairs - Does not require context
export const StandaloneThemePicker: React.FC<{
  onClose?: () => void;
  onColorPairChange?: (pair: ColorPairTheme) => void;
  initialColorPairId?: string;
  buttonRef?: React.RefObject<HTMLButtonElement>;
}> = ({ onClose, onColorPairChange, initialColorPairId, buttonRef }) => {
  // Get from localStorage or use provided initial value
  const savedPairId = typeof window !== 'undefined' ? localStorage.getItem('pulse-color-pair') : null;
  const [selectedPairId, setSelectedPairId] = useState(savedPairId || initialColorPairId || 'pulse-default');
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  const selectedPair = COLOR_PAIR_THEMES.find(p => p.id === selectedPairId) || COLOR_PAIR_THEMES[0];

  // Calculate position on mount/update if buttonRef is provided
  useEffect(() => {
    if (buttonRef?.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      });
    }
  }, [buttonRef]);

  const handleSelect = (pair: ColorPairTheme) => {
    setSelectedPairId(pair.id);
    localStorage.setItem('pulse-color-pair', pair.id);
    onColorPairChange?.(pair);
    // Dispatch custom event for other components to listen to
    window.dispatchEvent(new CustomEvent('pulse-theme-change', { detail: pair }));
  };

  // Use fixed positioning if buttonRef is provided
  const pickerStyle = position ? {
    position: 'fixed' as const,
    top: `${position.top}px`,
    right: `${position.right}px`,
    zIndex: 150
  } : {
    position: 'absolute' as const,
    top: '100%',
    right: 0,
    marginTop: '8px',
    zIndex: 150
  };

  return (
    <div style={pickerStyle} className="animate-scale-in">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 p-4 w-[320px]">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
            <i className="fa-solid fa-palette text-emerald-500" />
            Message Theme
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1"
            >
              <i className="fa-solid fa-times text-sm" />
            </button>
          )}
        </div>

        {/* Color Pair Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {COLOR_PAIR_THEMES.map(pair => (
            <button
              key={pair.id}
              onClick={() => handleSelect(pair)}
              className={`
                p-3 rounded-xl transition-all text-left
                ${selectedPairId === pair.id
                  ? 'ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'
                }
              `}
            >
              <div className="flex gap-2 mb-2">
                {/* User color swatch */}
                <div
                  className="w-8 h-8 rounded-lg shadow-sm flex items-center justify-center text-[8px] font-bold"
                  style={{
                    background: pair.userGradient || pair.userColor,
                    color: pair.userTextColor,
                    borderRadius: pair.borderRadius
                  }}
                >
                  You
                </div>
                {/* Other person color swatch */}
                <div
                  className="w-8 h-8 rounded-lg shadow-sm flex items-center justify-center text-[8px] font-bold"
                  style={{
                    background: pair.otherGradient || pair.otherColor,
                    color: pair.otherTextColor,
                    borderRadius: pair.borderRadius
                  }}
                >
                  Them
                </div>
              </div>
              <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                {pair.name}
              </span>
              {selectedPairId === pair.id && (
                <i className="fa-solid fa-check text-emerald-500 text-xs ml-1" />
              )}
            </button>
          ))}
        </div>

        {/* Live Preview */}
        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider font-bold">
            Preview - {selectedPair.name}
          </p>
          <div className="space-y-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">
            {/* Other person's message */}
            <div className="flex justify-start">
              <div
                className="px-3 py-2 text-xs max-w-[70%]"
                style={{
                  background: selectedPair.otherGradient || selectedPair.otherColor,
                  color: selectedPair.otherTextColor,
                  borderRadius: selectedPair.borderRadius
                }}
              >
                Hey, how's it going?
              </div>
            </div>
            {/* User's message */}
            <div className="flex justify-end">
              <div
                className="px-3 py-2 text-xs max-w-[70%]"
                style={{
                  background: selectedPair.userGradient || selectedPair.userColor,
                  color: selectedPair.userTextColor,
                  borderRadius: selectedPair.borderRadius
                }}
              >
                Going great! Thanks for asking 🚀
              </div>
            </div>
            {/* Other person's message */}
            <div className="flex justify-start">
              <div
                className="px-3 py-2 text-xs max-w-[70%]"
                style={{
                  background: selectedPair.otherGradient || selectedPair.otherColor,
                  color: selectedPair.otherTextColor,
                  borderRadius: selectedPair.borderRadius
                }}
              >
                That's awesome!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageThemeProvider;
