import React from 'react';
import './AILabProgress.css';

interface AILabProgressProps {
  label?: string;
  percent?: number;
  subLabel?: string;
  accentColor?: string;
  accentRgb?: string;
  size?: 'sm' | 'md' | 'lg';
}

const AILabProgress: React.FC<AILabProgressProps> = ({
  label = 'Processing with AI...',
  percent,
  subLabel,
  accentColor = '#818cf8',
  accentRgb = '129, 140, 248',
  size = 'md',
}) => {
  const isDeterminate = percent !== undefined;

  return (
    <div
      className={`ailab-progress ailab-progress-${size}`}
      style={{ '--accent-color': accentColor, '--accent-rgb': accentRgb } as React.CSSProperties}
    >
      {isDeterminate ? (
        <div className="ailab-progress-bar-wrap">
          <div className="ailab-progress-bar-track">
            <div
              className="ailab-progress-bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, percent!))}%` }}
            />
          </div>
          <span className="ailab-progress-percent">{Math.round(percent!)}%</span>
        </div>
      ) : (
        <div className="ailab-progress-ring-wrap">
          <div className="ailab-progress-ring" />
        </div>
      )}
      <div className="ailab-progress-labels">
        {label && <span className="ailab-progress-label">{label}</span>}
        {subLabel && <span className="ailab-progress-sublabel">{subLabel}</span>}
      </div>
    </div>
  );
};

export default React.memo(AILabProgress);
