import React from 'react';

interface SettingsCardProps {
  children: React.ReactNode;
  className?: string;
  /** Set false for cards that contain their own padding (e.g. table rows). */
  padded?: boolean;
}

/**
 * Canonical Settings card surface. Consumes pulse-tokens.css — never redeclares
 * --pulse-surface or --pulse-border locally. The translucent dark variant is
 * carried by the token, not by zinc-900.
 */
export const SettingsCard: React.FC<SettingsCardProps> = ({
  children,
  className = '',
  padded = true,
}) => (
  <div
    className={`rounded-xl ${padded ? 'p-6' : ''} ${className}`}
    style={{
      backgroundColor: 'var(--pulse-surface)',
      border: '1px solid var(--pulse-border)',
    }}
  >
    {children}
  </div>
);
