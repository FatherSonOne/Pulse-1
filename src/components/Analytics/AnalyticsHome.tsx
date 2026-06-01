/**
 * AnalyticsHome — single Intelligence > Analytics surface that hosts both the
 * weekly Briefing and Message Analytics under one nav entry, switched by a
 * neutral tab strip. Both child surfaces are rendered unchanged and stay wired
 * exactly as before (Briefing keeps its nav callbacks; MessageAnalytics keeps
 * its own data calls). Tabs are deliberately neutral chrome — coral is reserved
 * for AI-output surfaces, not navigation.
 */

import React, { useState } from 'react';
import { BarChart3, MailOpen } from 'lucide-react';
import { Briefing, BriefingNavCallbacks } from '../Briefing/Briefing';
import MessageAnalytics from '../MessageAnalytics';

export type AnalyticsTab = 'briefing' | 'messages';

interface AnalyticsHomeProps extends BriefingNavCallbacks {
  onClose?: () => void;
  initialTab?: AnalyticsTab;
}

const TABS: { id: AnalyticsTab; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'briefing', label: 'Briefing', icon: BarChart3 },
  { id: 'messages', label: 'Message Analytics', icon: MailOpen },
];

const AnalyticsHome: React.FC<AnalyticsHomeProps> = ({
  onClose,
  onOpenContact,
  onOpenMessages,
  onOpenCalendar,
  initialTab = 'briefing',
}) => {
  const [tab, setTab] = useState<AnalyticsTab>(initialTab);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        role="tablist"
        aria-label="Analytics views"
        className="sticky top-0 z-10 flex items-center gap-1 px-6 pt-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={`relative flex items-center gap-2 px-3 pb-3 text-sm font-medium transition-colors ${
                active
                  ? 'text-zinc-900 dark:text-white'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              <Icon size={16} aria-hidden={true} />
              {label}
              {active && (
                <span className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full bg-zinc-900 dark:bg-white" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'briefing' ? (
          <Briefing
            onClose={onClose}
            onOpenContact={onOpenContact}
            onOpenMessages={onOpenMessages}
            onOpenCalendar={onOpenCalendar}
          />
        ) : (
          <MessageAnalytics />
        )}
      </div>
    </div>
  );
};

export default AnalyticsHome;
