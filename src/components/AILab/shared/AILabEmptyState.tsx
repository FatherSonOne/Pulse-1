import React from 'react';
import './AILabEmptyState.css';

interface AILabEmptyStateProps {
  icon: string;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  accentColor?: string;
  accentRgb?: string;
  size?: 'sm' | 'md';
}

const AILabEmptyState: React.FC<AILabEmptyStateProps> = ({
  icon,
  title,
  description,
  ctaLabel,
  onCta,
  accentColor = '#818cf8',
  accentRgb = '129, 140, 248',
  size = 'md',
}) => {
  return (
    <div
      className={`ailab-empty ailab-empty-${size}`}
      style={{ '--accent-color': accentColor, '--accent-rgb': accentRgb } as React.CSSProperties}
    >
      <div className="ailab-empty-icon">
        <i className={`fa-solid ${icon}`} />
      </div>
      <div className="ailab-empty-text">
        <p className="ailab-empty-title">{title}</p>
        <p className="ailab-empty-description">{description}</p>
      </div>
      {ctaLabel && onCta && (
        <button type="button" className="ailab-empty-cta" onClick={onCta}>
          {ctaLabel}
        </button>
      )}
    </div>
  );
};

export default AILabEmptyState;
