// ============================================
// CONTACTS SHELL
// Top-level container for the reimagined Contacts section.
// Provides three modes: Today (default), People, Circles.
// Phase 5: keyboard shortcuts + first-visit onboarding tour.
// ============================================

import React, { useState, useCallback } from 'react';
import { AnimatedIcon } from '../ui/AnimatedIcon';
import { AppView, Contact } from '../../types';
import { ContactsRedesigned } from './ContactsRedesigned';
import { TodayView } from './TodayView';
import { CirclesView } from './CirclesView';
import { ContactsOnboarding, shouldShowContactsTour } from './ContactsOnboarding';
import { useContactsKeyboard } from './useContactsKeyboard';

import { MapPin, Search } from 'lucide-react';

// ==================== TYPES ====================

// Map is no longer a tab here — it was promoted to a top-level Sidebar
// section (AppView.MAP). The 'View on Map' chip in the tab bar deep-links
// users who built muscle memory for Contacts → Map.
type ContactsMode = 'today' | 'people' | 'circles';

interface ContactsShellProps {
  contacts: Contact[];
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  onSyncComplete?: (newContacts: Contact[]) => void;
  onUpdateContact?: (updatedContact: Contact) => void;
  onAddContact?: (contact: Omit<Contact, 'id'>) => Promise<Contact | null>;
  onDeleteContact?: (contactId: string) => Promise<boolean>;
  openAddContact?: boolean;
  isDarkMode?: boolean;
  userId?: string;
  initialMode?: ContactsMode;
}

// ==================== TAB CONFIG ====================

interface ModeTab {
  id: ContactsMode;
  label: string;
  icon: string;
  description: string;
  shortcut: string;
}

const TABS: ModeTab[] = [
  {
    id: 'today',
    label: 'Today',
    icon: 'target',
    description: 'What to do right now',
    shortcut: '1',
  },
  {
    id: 'people',
    label: 'People',
    icon: 'people',
    description: 'Everyone you know',
    shortcut: '2',
  },
  {
    id: 'circles',
    label: 'Circles',
    icon: 'network',
    description: 'How your network connects',
    shortcut: '3',
  },
];

// ==================== MAIN COMPONENT ====================

export const ContactsShell: React.FC<ContactsShellProps> = (props) => {
  const [activeMode, setActiveMode] = useState<ContactsMode>(props.initialMode ?? 'today');
  const [showTour, setShowTour] = useState(() => shouldShowContactsTour());

  // Focus the People tab's search input (via data attribute selector)
  const handleSearchFocus = useCallback(() => {
    if (activeMode !== 'people') {
      setActiveMode('people');
      // Brief delay for the tab to mount before focusing
      setTimeout(() => {
        const el = document.querySelector<HTMLInputElement>('[data-contacts-search]');
        el?.focus();
      }, 100);
    } else {
      const el = document.querySelector<HTMLInputElement>('[data-contacts-search]');
      el?.focus();
    }
  }, [activeMode]);

  // Keyboard shortcuts
  useContactsKeyboard({
    activeMode,
    onModeChange: setActiveMode,
    onSearchFocus: handleSearchFocus,
    onEscape: () => {
      // Close any open detail panels by blurring focus
      (document.activeElement as HTMLElement)?.blur();
    },
  });

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden">

      {/* Tab bar */}
      <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-stretch px-2 pt-2 gap-0.5">
          {TABS.map(tab => {
            const isActive = activeMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMode(tab.id)}
                className={`
                  relative flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium
                  transition-colors duration-150
                  ${isActive
                    ? 'bg-zinc-50 dark:bg-zinc-950 text-rose-500 dark:text-rose-400 border border-b-0 border-zinc-200 dark:border-zinc-700'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }
                `}
                title={`${tab.description} (${tab.shortcut})`}
              >
                <AnimatedIcon icon={tab.icon} size={16} />
                <span>{tab.label}</span>
                {/* Keyboard shortcut hint */}
                {!isActive && (
                  <span className="hidden sm:inline-flex ml-0.5 w-4 h-4 items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-[9px] font-mono rounded">
                    {tab.shortcut}
                  </span>
                )}
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 dark:bg-rose-400 rounded-full" />
                )}
              </button>
            );
          })}

          {/* Right cluster — Map deep-link + ⌘K hint. Map moved to a top-
              level Sidebar section; this chip preserves the muscle memory of
              users who reached it via Contacts → Map. */}
          <div className="ml-auto flex items-center gap-1.5 pr-2 pb-1">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('pulse:navigate', { detail: { view: AppView.MAP } }))}
              className="hidden sm:flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400 rounded border border-zinc-200 dark:border-zinc-700 hover:border-rose-300 hover:text-rose-500 dark:hover:border-rose-400/40 dark:hover:text-rose-300 transition-colors"
              title="Open Map (top-level section)"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <MapPin className="w-3 h-3" />
              <span>View on Map</span>
            </button>
            <button
              onClick={handleSearchFocus}
              className="hidden sm:flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-400 dark:text-zinc-600 rounded border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
              title="Search contacts (⌘K)"
            >
              <Search className="text-[9px]" />
              <span>⌘K</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mode content */}
      <div className="flex-1 overflow-hidden">
        {activeMode === 'today' && (
          <TodayView onAction={props.onAction} contacts={props.contacts} />
        )}
        {activeMode === 'people' && (
          <ContactsRedesigned
            contacts={props.contacts}
            onAction={props.onAction}
            onSyncComplete={props.onSyncComplete}
            onUpdateContact={props.onUpdateContact}
            onAddContact={props.onAddContact}
            onDeleteContact={props.onDeleteContact}
            openAddContact={props.openAddContact}
          />
        )}
        {activeMode === 'circles' && (
          <CirclesView
            contacts={props.contacts}
            onAction={props.onAction}
          />
        )}
      </div>

      {/* First-visit onboarding tour */}
      {showTour && (
        <ContactsOnboarding onComplete={() => setShowTour(false)} />
      )}
    </div>
  );
};

export default ContactsShell;
