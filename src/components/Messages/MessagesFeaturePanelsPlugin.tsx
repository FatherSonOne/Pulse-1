/**
 * MessagesFeaturePanelsPlugin
 *
 * Phase 5d.6 — the right-drawer plugin layer for `MessagesSplitView`.
 *
 * Migration target for the legacy `MessagesFeaturePanels.tsx` (1321 LOC)
 * which mounts the Phase 3-11 enhancement panels as inline panels in
 * the chat column. Those panels are organized into nine categories
 * (analytics, collaboration, productivity, intelligence, proactive,
 * communication, automation, security, multimedia), each with its own
 * tab state.
 *
 * Architecture decision — *decoupled host*:
 *   The legacy file is a giant switch statement that imports every
 *   lazy bundle directly. Migrating it as one piece would mean
 *   importing the same bundles in this plugin too — pure relocation
 *   with no architectural win.
 *
 *   Instead this plugin owns *only* state + layout. Consumers wire up
 *   the actual panel content by passing a `panels` map of render
 *   functions to `MessagesFeaturePanelHost`. That way:
 *     - The plugin's bundle stays small (no lazy-bundle imports here).
 *     - Each lazy bundle stays in its own file, code-split correctly.
 *     - Future panel additions don't require editing this plugin.
 *
 * Three exports:
 *   - `MessagesFeaturePanelsProvider` — owns visibility + tab state.
 *   - `useMessagesFeaturePanels()` — descendants open/close panels.
 *   - `MessagesFeaturePanelHost` — renders the active panel inside an
 *     animated right drawer. Mounts via `renderRightDrawer` slot.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

// ──────────────────────────────────────────────────────────────
// Panel keys + default tabs
// ──────────────────────────────────────────────────────────────

export type FeaturePanelKey =
  | 'analytics'
  | 'collaboration'
  | 'productivity'
  | 'intelligence'
  | 'proactive'
  | 'communication'
  | 'automation'
  | 'security'
  | 'multimedia';

const DEFAULT_TABS: Record<FeaturePanelKey, string> = {
  analytics: 'overview',
  collaboration: 'collab',
  productivity: 'templates',
  intelligence: 'insights',
  proactive: 'reminders',
  communication: 'voice',
  automation: 'rules',
  security: 'encryption',
  multimedia: 'attachments',
};

const PANEL_TITLES: Record<FeaturePanelKey, string> = {
  analytics: 'Analytics',
  collaboration: 'Collaboration',
  productivity: 'Productivity',
  intelligence: 'Intelligence',
  proactive: 'Proactive',
  communication: 'Communication',
  automation: 'Automation',
  security: 'Security',
  multimedia: 'Multimedia',
};

// ──────────────────────────────────────────────────────────────
// Context shape
// ──────────────────────────────────────────────────────────────

interface FeaturePanelsApi {
  /** The panel currently open in the drawer, or null when closed. */
  activePanel: FeaturePanelKey | null;
  /** Open a panel (and optionally jump to a specific tab). Re-opening
   *  the same panel just brings it forward; re-opening with a new tab
   *  switches the active tab. */
  openPanel: (panel: FeaturePanelKey, tab?: string) => void;
  /** Close the drawer entirely. */
  closePanel: () => void;
  /** Toggle a panel — open if closed, close if it was the active one. */
  togglePanel: (panel: FeaturePanelKey) => void;
  /** Get the current tab for a panel. Returns the panel default if no
   *  tab has been set yet. */
  getTab: (panel: FeaturePanelKey) => string;
  /** Set the active tab for a panel. */
  setTab: (panel: FeaturePanelKey, tab: string) => void;
}

const FeaturePanelsContext = createContext<FeaturePanelsApi | null>(null);

export function useMessagesFeaturePanels(): FeaturePanelsApi {
  const ctx = useContext(FeaturePanelsContext);
  if (!ctx) {
    throw new Error(
      'useMessagesFeaturePanels must be used inside <MessagesFeaturePanelsProvider>',
    );
  }
  return ctx;
}

// ──────────────────────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────────────────────

export const MessagesFeaturePanelsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activePanel, setActivePanel] = useState<FeaturePanelKey | null>(null);
  const [panelTabs, setPanelTabs] = useState<Record<FeaturePanelKey, string>>(
    () => ({ ...DEFAULT_TABS }),
  );

  const openPanel = useCallback((panel: FeaturePanelKey, tab?: string) => {
    setActivePanel(panel);
    if (tab !== undefined) {
      setPanelTabs((prev) => ({ ...prev, [panel]: tab }));
    }
  }, []);

  const closePanel = useCallback(() => setActivePanel(null), []);

  const togglePanel = useCallback((panel: FeaturePanelKey) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  const getTab = useCallback(
    (panel: FeaturePanelKey) => panelTabs[panel] ?? DEFAULT_TABS[panel],
    [panelTabs],
  );

  const setTab = useCallback((panel: FeaturePanelKey, tab: string) => {
    setPanelTabs((prev) => ({ ...prev, [panel]: tab }));
  }, []);

  const value = useMemo<FeaturePanelsApi>(
    () => ({ activePanel, openPanel, closePanel, togglePanel, getTab, setTab }),
    [activePanel, openPanel, closePanel, togglePanel, getTab, setTab],
  );

  return (
    <FeaturePanelsContext.Provider value={value}>
      {children}
    </FeaturePanelsContext.Provider>
  );
};

// ──────────────────────────────────────────────────────────────
// Host — the rendering surface, mounted via renderRightDrawer slot
// ──────────────────────────────────────────────────────────────

export interface FeaturePanelRenderArgs {
  /** Currently active tab within this panel. */
  activeTab: string;
  /** Switch tabs. */
  setTab: (tab: string) => void;
  /** Close the drawer. */
  close: () => void;
}

export type FeaturePanelRenderFn = (args: FeaturePanelRenderArgs) => React.ReactNode;

interface MessagesFeaturePanelHostProps {
  /** Map of panel key → render function. Consumers wire up their lazy
   *  bundles here. Missing entries simply don't open (the openPanel
   *  call still succeeds, but the host renders an empty drawer). */
  panels: Partial<Record<FeaturePanelKey, FeaturePanelRenderFn>>;
  /** Drawer width on desktop. Default 380px. */
  width?: number | string;
  /** Optional class on the drawer container. */
  className?: string;
}

export const MessagesFeaturePanelHost: React.FC<MessagesFeaturePanelHostProps> = ({
  panels,
  width = 380,
  className = '',
}) => {
  const { activePanel, closePanel, getTab, setTab } = useMessagesFeaturePanels();

  const renderFn = activePanel ? panels[activePanel] : undefined;
  const activeTab = activePanel ? getTab(activePanel) : '';

  return (
    <AnimatePresence>
      {activePanel && (
        <motion.aside
          key={activePanel}
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className={`absolute top-0 right-0 bottom-0 z-30 bg-white dark:bg-[rgba(255,255,255,0.03)] border-l border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] shadow-2xl flex flex-col ${className}`}
          style={{ width }}
          role="complementary"
          aria-label={`${PANEL_TITLES[activePanel]} panel`}
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              {PANEL_TITLES[activePanel]}
            </h2>
            <button
              type="button"
              onClick={closePanel}
              className="p-1.5 rounded-md hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)] text-zinc-500 dark:text-zinc-400 transition"
              aria-label="Close panel"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {renderFn ? (
              renderFn({
                activeTab,
                setTab: (tab) => setTab(activePanel, tab),
                close: closePanel,
              })
            ) : (
              <div className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                <p>No content registered for the {PANEL_TITLES[activePanel]} panel.</p>
                <p className="text-xs mt-1 opacity-70">
                  Pass a render function via the <code>panels</code> prop.
                </p>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

export default MessagesFeaturePanelHost;
