import React, { useState, useEffect } from 'react';
import { settingsService } from '../../services/settingsService';
import { Accessibility } from 'lucide-react';
import { ToggleItem } from './shared/ToggleItem';
import { SettingsCard } from './shared/SettingsCard';
import { MonoLabel } from './shared/MonoLabel';

type ColorBlindMode = 'off' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';

const COLOR_BLIND_OPTIONS: { value: ColorBlindMode; label: string; hint: string }[] = [
  { value: 'off',           label: 'Off',           hint: 'No filter' },
  { value: 'protanopia',    label: 'Protanopia',    hint: 'Red-blind' },
  { value: 'deuteranopia',  label: 'Deuteranopia',  hint: 'Green-blind' },
  { value: 'tritanopia',    label: 'Tritanopia',    hint: 'Blue-blind' },
  { value: 'achromatopsia', label: 'Achromatopsia', hint: 'Monochrome' },
];

export const AccessibilitySettings: React.FC = () => {
  const [fontSize, setFontSize] = useState<'small' | 'default' | 'large'>('default');
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [colorBlindMode, setColorBlindMode] = useState<ColorBlindMode>('off');
  const [alwaysFocusRings, setAlwaysFocusRings] = useState(false);
  const [underlineLinks, setUnderlineLinks] = useState(false);
  const [largeTouchTargets, setLargeTouchTargets] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [fontSz, hc, rm, cbm, afr, ul, ltt] = await Promise.all([
        settingsService.get('messageFontSize'),
        settingsService.get('highContrast'),
        settingsService.get('reducedMotion'),
        settingsService.get('colorBlindMode'),
        settingsService.get('alwaysFocusRings'),
        settingsService.get('underlineLinks'),
        settingsService.get('largeTouchTargets'),
      ]);
      if (fontSz) {
        const mapped = fontSz === 'medium' ? 'default' : fontSz;
        setFontSize(mapped as 'small' | 'default' | 'large');
      }
      if (hc !== undefined) setHighContrast(hc);
      if (rm !== undefined) setReducedMotion(rm);
      if (cbm !== undefined) setColorBlindMode(cbm as ColorBlindMode);
      if (afr !== undefined) setAlwaysFocusRings(afr);
      if (ul !== undefined) setUnderlineLinks(ul);
      if (ltt !== undefined) setLargeTouchTargets(ltt);
    };
    load();
  }, []);

  // Apply data attributes whenever a flag changes — single source of truth
  // for the matching CSS rules in pulse-tokens.css.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-color-blind', colorBlindMode);
    root.setAttribute('data-always-focus-rings', String(alwaysFocusRings));
    root.setAttribute('data-underline-links', String(underlineLinks));
    root.setAttribute('data-large-touch-targets', String(largeTouchTargets));
  }, [colorBlindMode, alwaysFocusRings, underlineLinks, largeTouchTargets]);

  const handleFontSizeChange = (size: 'small' | 'default' | 'large') => {
    setFontSize(size);
    const mapped = size === 'default' ? 'medium' : size;
    settingsService.set('messageFontSize', mapped as 'small' | 'medium' | 'large');
    const sizeMap: Record<string, string> = { small: '13px', default: '15px', large: '18px' };
    document.documentElement.style.setProperty('--font-size-base', sizeMap[size]);
  };

  const handleHighContrastChange = (val: boolean) => {
    setHighContrast(val);
    settingsService.set('highContrast', val);
    document.documentElement.setAttribute('data-high-contrast', String(val));
  };

  const handleReducedMotionChange = (val: boolean) => {
    setReducedMotion(val);
    settingsService.set('reducedMotion', val);
    document.documentElement.setAttribute('data-reduced-motion', String(val));
  };

  const handleColorBlindChange = (mode: ColorBlindMode) => {
    setColorBlindMode(mode);
    settingsService.set('colorBlindMode', mode);
  };

  const handleAlwaysFocusChange = (val: boolean) => {
    setAlwaysFocusRings(val);
    settingsService.set('alwaysFocusRings', val);
  };

  const handleUnderlineLinksChange = (val: boolean) => {
    setUnderlineLinks(val);
    settingsService.set('underlineLinks', val);
  };

  const handleLargeTouchTargetsChange = (val: boolean) => {
    setLargeTouchTargets(val);
    settingsService.set('largeTouchTargets', val);
  };

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="section-header">
        <h3>
          <Accessibility /> Accessibility
        </h3>
        <p>
          Customize the interface to match your visual and motor preferences.
        </p>
      </div>

      {/* Vision */}
      <SettingsCard className="space-y-6">
        <MonoLabel>Vision</MonoLabel>

        <div>
          <MonoLabel as="label" className="mb-4 block">Font Size</MonoLabel>
          <div className="flex gap-4">
            {(['small', 'default', 'large'] as const).map((size) => (
              <button
                key={size}
                onClick={() => handleFontSizeChange(size)}
                className={`flex-1 py-3 border rounded-xl flex flex-col items-center justify-center gap-2 transition ${
                  fontSize === size
                    ? 'border-rose-500 bg-rose-500/5 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                <span className={size === 'small' ? 'text-xs' : size === 'large' ? 'text-xl' : 'text-base'}>A</span>
                <span className="text-xs capitalize">{size}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

        <div>
          <MonoLabel as="label" className="mb-1 block">Color blindness</MonoLabel>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Re-maps the palette so red, green, and blue distinctions stay legible.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {COLOR_BLIND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleColorBlindChange(opt.value)}
                className={`px-3 py-2 border rounded-lg text-xs font-medium transition text-left ${
                  colorBlindMode === opt.value
                    ? 'border-rose-500 bg-rose-500/5 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                <div>{opt.label}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">{opt.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

        <ToggleItem
          label="High Contrast Mode"
          desc="Increase contrast for better legibility"
          active={highContrast}
          onToggle={() => handleHighContrastChange(!highContrast)}
        />

        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

        <ToggleItem
          label="Underline links"
          desc="WCAG AAA: distinguishes links by more than color alone"
          active={underlineLinks}
          onToggle={() => handleUnderlineLinksChange(!underlineLinks)}
        />
      </SettingsCard>

      {/* Motor + interaction */}
      <SettingsCard className="space-y-6">
        <MonoLabel>Interaction</MonoLabel>

        <ToggleItem
          label="Reduced Motion"
          desc="Minimize animations and transitions"
          active={reducedMotion}
          onToggle={() => handleReducedMotionChange(!reducedMotion)}
        />

        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

        <ToggleItem
          label="Always show focus rings"
          desc="Keep keyboard focus outlines visible after click as well"
          active={alwaysFocusRings}
          onToggle={() => handleAlwaysFocusChange(!alwaysFocusRings)}
        />

        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

        <ToggleItem
          label="Larger touch targets"
          desc="Bumps every interactive element to a minimum of 48 px (helpful on Android)"
          active={largeTouchTargets}
          onToggle={() => handleLargeTouchTargetsChange(!largeTouchTargets)}
        />
      </SettingsCard>

      {/* SVG color blindness filters — registered globally via :root references */}
      <svg
        aria-hidden="true"
        focusable="false"
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      >
        <defs>
          {/* Brettel et al. 1997 dichromacy simulation matrices */}
          <filter id="pulse-cb-protanopia">
            <feColorMatrix type="matrix" values="
              0.567, 0.433, 0,     0, 0
              0.558, 0.442, 0,     0, 0
              0,     0.242, 0.758, 0, 0
              0,     0,     0,     1, 0" />
          </filter>
          <filter id="pulse-cb-deuteranopia">
            <feColorMatrix type="matrix" values="
              0.625, 0.375, 0,   0, 0
              0.7,   0.3,   0,   0, 0
              0,     0.3,   0.7, 0, 0
              0,     0,     0,   1, 0" />
          </filter>
          <filter id="pulse-cb-tritanopia">
            <feColorMatrix type="matrix" values="
              0.95,  0.05,  0,     0, 0
              0,     0.433, 0.567, 0, 0
              0,     0.475, 0.525, 0, 0
              0,     0,     0,     1, 0" />
          </filter>
          <filter id="pulse-cb-achromatopsia">
            <feColorMatrix type="matrix" values="
              0.299, 0.587, 0.114, 0, 0
              0.299, 0.587, 0.114, 0, 0
              0.299, 0.587, 0.114, 0, 0
              0,     0,     0,     1, 0" />
          </filter>
        </defs>
      </svg>
    </div>
  );
};
