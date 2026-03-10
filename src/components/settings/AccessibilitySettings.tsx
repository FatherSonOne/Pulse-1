import React, { useState, useEffect } from 'react';
import { settingsService } from '../../services/settingsService';
import { Accessibility } from 'lucide-react';

const ToggleItem = ({ label, desc, active, onToggle }: { label: string; desc: string; active: boolean; onToggle: () => void }) => (
  <div className="flex justify-between items-center group cursor-pointer" onClick={onToggle}>
    <div>
      <div className="dark:text-white text-zinc-900 font-medium text-sm">{label}</div>
      <div className="text-zinc-500 text-xs">{desc}</div>
    </div>
    <button
      className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${active ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${active ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  </div>
);

export const AccessibilitySettings: React.FC = () => {
  const [accentColor, setAccentColor] = useState('rose');
  const [customColor, setCustomColor] = useState('#f43f5e');
  const [fontSize, setFontSize] = useState<'small' | 'default' | 'large'>('default');
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Color palette presets - Pulse Brand Colors
  const colorPresets = {
    rose: { hex: '#f43f5e', name: 'Pulse Rose' },
    pink: { hex: '#ec4899', name: 'Pulse Pink' },
    coral: { hex: '#fb7185', name: 'Heartbeat Coral' },
    purple: { hex: '#8B5CF6', name: 'Vision Purple' },
    teal: { hex: '#14B8A6', name: 'Entomate Teal' },
    blue: { hex: '#3B82F6', name: 'Ocean Blue' },
    amber: { hex: '#F59E0B', name: 'Warm Amber' },
  };

  // Apply accent color to CSS custom properties
  useEffect(() => {
    const applyColor = (hex: string) => {
      // Convert hex to RGB
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);

      document.documentElement.style.setProperty('--accent-primary', hex);
      document.documentElement.style.setProperty('--accent-primary-rgb', `${r}, ${g}, ${b}`);

      // Save to localStorage
      localStorage.setItem('accentColor', accentColor);
      localStorage.setItem('customColor', hex);
    };

    if (accentColor === 'custom') {
      applyColor(customColor);
    } else if (colorPresets[accentColor as keyof typeof colorPresets]) {
      applyColor(colorPresets[accentColor as keyof typeof colorPresets].hex);
    }
  }, [accentColor, customColor]);

  // Load saved color on mount
  useEffect(() => {
    const savedAccent = localStorage.getItem('accentColor');
    const savedCustom = localStorage.getItem('customColor');

    if (savedAccent) setAccentColor(savedAccent);
    if (savedCustom) setCustomColor(savedCustom);
  }, []);

  // Load fontSize, highContrast, reducedMotion from settingsService on mount
  useEffect(() => {
    const load = async () => {
      const [accent, custom, fontSz, hc, rm] = await Promise.all([
        settingsService.get('accentColor'),
        settingsService.get('customColor'),
        settingsService.get('messageFontSize'),
        settingsService.get('highContrast'),
        settingsService.get('reducedMotion'),
      ]);
      if (accent) setAccentColor(accent);
      if (custom) setCustomColor(custom);
      if (fontSz) {
        const mapped = fontSz === 'medium' ? 'default' : fontSz;
        setFontSize(mapped as 'small' | 'default' | 'large');
      }
      if (hc !== undefined) setHighContrast(hc);
      if (rm !== undefined) setReducedMotion(rm);
    };
    load();
  }, []);

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

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-6">
        <div>
          <label className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4 block">Font Size</label>
          <div className="flex gap-4">
            {(['small', 'default', 'large'] as const).map((size) => (
              <button
                key={size}
                onClick={() => handleFontSizeChange(size)}
                className={`flex-1 py-3 border rounded-xl flex flex-col items-center justify-center gap-2 transition ${
                  fontSize === size
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
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

        <ToggleItem
          label="High Contrast Mode"
          desc="Increase contrast for better legibility"
          active={highContrast}
          onToggle={() => handleHighContrastChange(!highContrast)}
        />

        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

        <ToggleItem
          label="Reduced Motion"
          desc="Minimize animations and transitions"
          active={reducedMotion}
          onToggle={() => handleReducedMotionChange(!reducedMotion)}
        />
      </div>
    </div>
  );
};
