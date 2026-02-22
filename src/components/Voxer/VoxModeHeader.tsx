import React from 'react';
import { ChevronLeft, LucideIcon } from 'lucide-react';

interface VoxModeHeaderProps {
  modeName: string;
  modeTagline: string;
  modeColor: string;
  modeIcon: LucideIcon;
  onBack: () => void;
  isDarkMode?: boolean;
  actions?: React.ReactNode; // Optional action buttons on the right
}

/**
 * VoxModeHeader - Unified header component for all Voxer modes
 *
 * Features:
 * - Mode-specific theming with gradient backgrounds
 * - Consistent layout and spacing
 * - Optional action buttons
 * - Responsive design
 */
const VoxModeHeader: React.FC<VoxModeHeaderProps> = ({
  modeName,
  modeTagline,
  modeColor,
  modeIcon: Icon,
  onBack,
  isDarkMode = false,
  actions,
}) => {
  // Theme classes
  const tc = {
    pageBg: isDarkMode
      ? 'bg-gray-900/60 backdrop-blur-xl'
      : 'bg-white/80 backdrop-blur-xl',
    border: isDarkMode ? 'border-gray-800/60' : 'border-gray-200/60',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    btnGhost: isDarkMode
      ? 'hover:bg-gray-800/60 text-gray-400 hover:text-white'
      : 'hover:bg-gray-100/80 text-gray-600 hover:text-gray-900',
  };

  // Convert hex color to RGB for opacity
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 99, g: 102, b: 241 }; // Fallback to primary color
  };

  const rgb = hexToRgb(modeColor);
  const gradientBg = isDarkMode
    ? `linear-gradient(135deg, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15) 0%, transparent 50%)`
    : `linear-gradient(135deg, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1) 0%, transparent 50%)`;

  return (
    <div
      className={`px-4 md:px-6 py-4 border-b ${tc.border} ${tc.pageBg}`}
      style={{ background: gradientBg }}
    >
      <div className="flex items-center gap-3 md:gap-4">
        {/* Back Button */}
        <button
          onClick={onBack}
          className={`p-2 rounded-xl ${tc.btnGhost} transition-all duration-200`}
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Mode Icon */}
        <div
          className="p-2.5 rounded-xl shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${modeColor} 0%, ${adjustBrightness(modeColor, 20)} 100%)`,
            boxShadow: `0 8px 24px ${modeColor}40`,
          }}
        >
          <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
        </div>

        {/* Mode Title & Tagline */}
        <div className="flex-1 min-w-0">
          <h1 className={`text-lg md:text-xl font-bold ${tc.text}`}>{modeName}</h1>
          <p className={`text-xs md:text-sm ${tc.textSecondary} hidden sm:block`}>
            {modeTagline}
          </p>
        </div>

        {/* Optional Actions */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};

/**
 * Helper: Adjust hex color brightness
 */
function adjustBrightness(hex: string, percent: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;

  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);

  r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
  g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
  b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export default VoxModeHeader;
