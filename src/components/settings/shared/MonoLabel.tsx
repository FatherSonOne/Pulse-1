import React from 'react';

type Element = 'div' | 'h3' | 'h4' | 'h5' | 'label' | 'span' | 'p';

interface MonoLabelProps {
  children: React.ReactNode;
  className?: string;
  as?: Element;
  htmlFor?: string;
}

/**
 * The Mono-Label Rule made into a component. Every uppercase tracked label in
 * Settings consumes JetBrains Mono via the canonical font-mono token. Inter
 * uppercase reads as Generic SaaS; Mono uppercase reads as instrument.
 */
export const MonoLabel: React.FC<MonoLabelProps> = ({
  children,
  className = '',
  as = 'div',
  htmlFor,
}) => {
  const Tag = as as React.ElementType;
  return (
    <Tag
      htmlFor={htmlFor}
      className={`text-[11px] font-medium uppercase text-zinc-500 dark:text-zinc-400 ${className}`}
      style={{
        fontFamily:
          'var(--pulse-font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)',
        letterSpacing: '0.1em',
      }}
    >
      {children}
    </Tag>
  );
};
