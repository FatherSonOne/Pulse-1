import React from 'react';

export interface CollapsibleWidgetProps {
  id: string;
  title: string;
  icon: string;
  iconColor?: string;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * CollapsibleWidget — Standard collapsible glass-surface widget shell.
 *
 * Applies dashboard-widget-surface, backdrop-blur-xl, card-elevated,
 * rose border hover, and spring-easing collapse animation.
 *
 * Usage:
 *   <CollapsibleWidget id="widget-id" title="Widget" icon="fa-star"
 *     isExpanded={expandedWidgets.has('widget-id')} onToggle={toggleWidget}>
 *     {children}
 *   </CollapsibleWidget>
 */
const CollapsibleWidget: React.FC<CollapsibleWidgetProps> = ({
  id,
  title,
  icon,
  iconColor = 'text-rose-500',
  isExpanded,
  onToggle,
  headerAction,
  children,
  className = '',
}) => (
  <div
    className={`dashboard-widget-surface backdrop-blur-xl border border-zinc-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden transition-all duration-150 hover:border-rose-500/40 dark:hover:border-rose-500/30 card-elevated card-hover-lift ${className}`}
  >
    <div
      className="flex items-center justify-between p-4 cursor-pointer hover:bg-rose-50/50 dark:hover:bg-rose-950/30 transition-all duration-150"
      onClick={() => onToggle(id)}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center border border-rose-500/20 shadow-sm">
          <i className={`fa-solid ${icon} ${iconColor}`}></i>
        </div>
        <h3 className="font-semibold text-zinc-900 dark:text-white">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {headerAction && <div onClick={(e) => e.stopPropagation()}>{headerAction}</div>}
        <button
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title}`}
          className="w-6 h-6 flex items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-rose-500/40"
          tabIndex={-1}
        >
          <i
            className={`fa-solid fa-chevron-down text-zinc-400 transition-transform duration-200 widget-spring ${
              isExpanded ? 'rotate-180' : ''
            }`}
          ></i>
        </button>
      </div>
    </div>

    {/* Spring-easing collapse via grid-template-rows */}
    <div
      className="widget-collapse-grid"
      style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
    >
      <div className="overflow-hidden">
        <div className="p-4 pt-0 border-t border-zinc-100 dark:border-zinc-800/50">
          {children}
        </div>
      </div>
    </div>
  </div>
);

export default CollapsibleWidget;
