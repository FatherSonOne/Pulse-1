/**
 * User Color Coding System
 * Provides consistent color assignment for users based on their ID
 * Includes accessibility compliance with WCAG AA contrast ratios
 *
 * Version: 1.0
 * Date: 2026-02-08
 */

const USER_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#d946ef', // fuchsia
  '#ec4899', // pink
];

/**
 * Generate consistent color for user based on ID
 * @param userId - Unique user identifier
 * @returns Hex color string
 */
export function getUserColor(userId: string): string {
  if (!userId) return USER_COLORS[0];

  // Simple hash function for consistent color assignment
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % USER_COLORS.length;
  return USER_COLORS[index];
}

/**
 * Convert hex color to RGB
 * @param hex - Hex color string
 * @returns RGB object or null
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate relative luminance for a color
 * @param hex - Hex color string
 * @returns Relative luminance (0-1)
 */
function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 * @param color1 - First color (hex)
 * @param color2 - Second color (hex)
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getRelativeLuminance(color1);
  const lum2 = getRelativeLuminance(color2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if color meets WCAG AA contrast requirements
 * @param color - Color to check (hex)
 * @param background - Background color (hex)
 * @returns true if contrast ratio >= 4.5:1
 */
export function meetsContrastRequirement(
  color: string,
  background: string
): boolean {
  const contrast = getContrastRatio(color, background);
  return contrast >= 4.5; // WCAG AA for normal text
}

/**
 * Darken a color by a given amount
 * @param hex - Hex color string
 * @param amount - Amount to darken (0-1)
 * @returns Darkened hex color
 */
function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const darker = {
    r: Math.max(0, Math.floor(rgb.r * (1 - amount))),
    g: Math.max(0, Math.floor(rgb.g * (1 - amount))),
    b: Math.max(0, Math.floor(rgb.b * (1 - amount))),
  };

  return `#${((1 << 24) + (darker.r << 16) + (darker.g << 8) + darker.b)
    .toString(16)
    .slice(1)}`;
}

/**
 * Lighten a color by a given amount
 * @param hex - Hex color string
 * @param amount - Amount to lighten (0-1)
 * @returns Lightened hex color
 */
function lightenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const lighter = {
    r: Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * amount)),
    g: Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * amount)),
    b: Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * amount)),
  };

  return `#${((1 << 24) + (lighter.r << 16) + (lighter.g << 8) + lighter.b)
    .toString(16)
    .slice(1)}`;
}

/**
 * Adjust color to meet contrast requirements against background
 * @param color - Color to adjust (hex)
 * @param background - Background color (hex)
 * @returns Adjusted color that meets WCAG AA contrast
 */
export function ensureContrast(color: string, background: string): string {
  // Check if color already meets contrast requirements
  if (meetsContrastRequirement(color, background)) {
    return color;
  }

  const bgLuminance = getRelativeLuminance(background);
  const isLightBackground = bgLuminance > 0.5;

  let adjustedColor = color;
  let iterations = 0;
  const maxIterations = 10;

  // Iteratively adjust color until it meets contrast requirements
  while (!meetsContrastRequirement(adjustedColor, background) && iterations < maxIterations) {
    if (isLightBackground) {
      // Darken color for light backgrounds
      adjustedColor = darkenColor(adjustedColor, 0.1);
    } else {
      // Lighten color for dark backgrounds
      adjustedColor = lightenColor(adjustedColor, 0.1);
    }
    iterations++;
  }

  return adjustedColor;
}

/**
 * Get accessible user color for display on specific background
 * @param userId - User ID
 * @param background - Background color (hex) - default: '#ffffff' (white)
 * @param isDarkMode - Whether dark mode is active
 * @returns Accessible color (hex)
 */
export function getAccessibleUserColor(
  userId: string,
  isDarkMode: boolean = false
): string {
  const baseColor = getUserColor(userId);
  const background = isDarkMode ? '#18181b' : '#ffffff';

  return ensureContrast(baseColor, background);
}

/**
 * Get all available user colors
 * @returns Array of hex color strings
 */
export function getAllUserColors(): string[] {
  return [...USER_COLORS];
}

/**
 * Get user color with opacity
 * @param userId - User ID
 * @param opacity - Opacity (0-1)
 * @returns RGBA color string
 */
export function getUserColorWithOpacity(userId: string, opacity: number = 1): string {
  const hex = getUserColor(userId);
  const rgb = hexToRgb(hex);

  if (!rgb) return `rgba(244, 63, 94, ${opacity})`;

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}
