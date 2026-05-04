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
  iconColor,
  isExpanded,
  onToggle,
  headerAction,
  children,
  className = '',
}) => (
  <div
    className={`bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-xl overflow-hidden transition-colors duration-150 ${className}`}
  >
    <div
      className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors duration-150"
      onClick={() => onToggle(id)}
    >
      <div className="flex items-center gap-3">
        <i className={`fa-solid ${icon} text-zinc-400 dark:text-zinc-500 w-4 text-center ${iconColor || ''}`}></i>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
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
            className={`fa-solid fa-chevron-down text-xs text-zinc-400 dark:text-zinc-500 transition-transform duration-200 widget-spring ${
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
        <div className="p-4 pt-0 border-t border-zinc-100 dark:border-white/[0.06]">
          {children}
        </div>
      </div>
    </div>
  </div>
);

export default CollapsibleWidget;
