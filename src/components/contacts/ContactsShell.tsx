// ============================================
// CONTACTS SHELL
// Top-level container for the reimagined Contacts section.
// Provides two modes: Today (default) and People.
// Circles were demoted from a top-level tab to a sidebar facet on People
// in Phase D (the bubble-chart visualization was decoration, not a tool).
// ============================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatedIcon } from '../ui/AnimatedIcon';
import { AppView, Contact } from '../../types';
import { ContactsRedesigned } from './ContactsRedesigned';
import { TodayView } from './TodayView';
import { ContactsOnboarding, shouldShowContactsTour } from './ContactsOnboarding';
import { useContactsKeyboard } from './useContactsKeyboard';
import { ContactsEmptyState } from './ContactsEmptyState';
import { ConnectContactsModal } from './ConnectContactsModal';
import { TrimWizard } from './TrimWizard';
import { AddContactModal } from './AddContactModal';
import { ReconnectGoogleModal } from '../Auth/ReconnectGoogleModal';
import { useWorkspaceData } from '../../contexts/WorkspaceContext';
import { useTranslation } from 'react-i18next';

import { MapPin, Search } from 'lucide-react';

// ==================== TYPES ====================

// Map is no longer a tab here — it was promoted to a top-level Sidebar
// section (AppView.MAP). The 'View on Map' chip in the tab bar deep-links
// users who built muscle memory for Contacts → Map.
type ContactsMode = 'today' | 'people';

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
];

// ==================== MAIN COMPONENT ====================

export const ContactsShell: React.FC<ContactsShellProps> = (props) => {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspaceData();
  const [activeMode, setActiveMode] = useState<ContactsMode>(props.initialMode ?? 'today');
  const [showTour, setShowTour] = useState(() => shouldShowContactsTour());
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [trimWizardOpen, setTrimWizardOpen] = useState(false);
  const [importedContactsForTrim, setImportedContactsForTrim] = useState<Contact[]>([]);
  const [reconnectModalOpen, setReconnectModalOpen] = useState(false);
  const [manualAddModalOpen, setManualAddModalOpen] = useState(false);
  // Defers the search-focus until after the People tab has actually rendered,
  // instead of the previous setTimeout(..., 100) race. Cleared once consumed.
  const pendingSearchFocusRef = useRef(false);
  const workspaceId = currentWorkspace?.id ?? '';
  const showEmptyState = props.contacts.length === 0;

  // Focus the People tab's search input (selector via data attribute).
  const handleSearchFocus = useCallback(() => {
    const el = document.querySelector<HTMLInputElement>('[data-contacts-search]');
    if (activeMode !== 'people') {
      // Tab not mounted yet; switch and let the post-render effect focus.
      pendingSearchFocusRef.current = true;
      setActiveMode('people');
    } else {
      el?.focus();
    }
  }, [activeMode]);

  // Honors a pending focus once People has actually mounted the input.
  useEffect(() => {
    if (activeMode !== 'people' || !pendingSearchFocusRef.current) return;
    const el = document.querySelector<HTMLInputElement>('[data-contacts-search]');
    if (el) {
      el.focus();
      pendingSearchFocusRef.current = false;
    }
  }, [activeMode]);

  useEffect(() => {
    const openHandler = () => setConnectModalOpen(true);
    const scopeMissingHandler = () => {
      import('../../services/toastFactory').then(module => {
        module.showScopeLossToast(() => setReconnectModalOpen(true));
      });
    };
    // Phase D step 23: direct open from the wizard's reconnect banner.
    // Skips the toast intermediary so the user goes from "click
    // Reconnect" -> "see OAuth modal" in one step.
    const openReconnectHandler = () => setReconnectModalOpen(true);
    // Phase D step 7: TodayEmptyState dispatches these when the operator
    // taps "See who's gone cold" or "Set a check-in goal". The shell
    // owns the routing because People is the surface the smart-list
    // filter applies to.
    const showSmartListHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ list: string }>).detail;
      if (!detail?.list) return;
      setActiveMode('people');
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('pulse:contacts:apply-smart-list', { detail })
        );
      }, 50);
    };
    const openCheckInGoalHandler = () => {
      setActiveMode('people');
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('pulse:contacts:open-check-in-goal-people'));
      }, 50);
    };
    // Palette "Open <person>" → switch to People, then relay a child-targeted
    // select once the list can mount (mirrors showSmartListHandler). Clears the
    // sessionStorage handoff so a warm-path open never leaves a stale key for
    // the next cold mount to mis-fire.
    const relayOpenContact = (id: string) => {
      if (!id) return;
      sessionStorage.removeItem('pulse_focus_contact');
      setActiveMode('people');
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('pulse:contacts:select-contact', { detail: { id } })
        );
      }, 50);
    };
    const openContactHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string }>).detail;
      if (detail?.id) relayOpenContact(detail.id);
    };

    window.addEventListener('pulse:contacts:open-connect-modal', openHandler);
    window.addEventListener('pulse:contacts:scope-missing', scopeMissingHandler);
    window.addEventListener('pulse:contacts:open-reconnect-modal', openReconnectHandler);
    window.addEventListener('pulse:contacts:show-smart-list', showSmartListHandler);
    window.addEventListener('pulse:contacts:open-check-in-goal', openCheckInGoalHandler);
    window.addEventListener('pulse:contacts:open-contact', openContactHandler);
    // Cold path: a palette open dispatched before this shell mounted deposits
    // the id in sessionStorage; drain it once on mount.
    const pendingFocusContact = sessionStorage.getItem('pulse_focus_contact');
    if (pendingFocusContact) relayOpenContact(pendingFocusContact);
    return () => {
      window.removeEventListener('pulse:contacts:open-connect-modal', openHandler);
      window.removeEventListener('pulse:contacts:scope-missing', scopeMissingHandler);
      window.removeEventListener('pulse:contacts:open-reconnect-modal', openReconnectHandler);
      window.removeEventListener('pulse:contacts:show-smart-list', showSmartListHandler);
      window.removeEventListener('pulse:contacts:open-check-in-goal', openCheckInGoalHandler);
      window.removeEventListener('pulse:contacts:open-contact', openContactHandler);
    };
  }, []);

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
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--pulse-canvas)' }}
    >

      {/* Tab bar */}
      <div className="flex-shrink-0 bg-white dark:bg-white/[0.03] border-b border-zinc-200 dark:border-white/[0.06]">
        <div className="flex items-stretch px-2 pt-2 gap-0.5">
          {TABS.map(tab => {
            const isActive = activeMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMode(tab.id)}
                className={`
                  relative flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium uppercase tracking-[0.06em]
                  transition-colors duration-150
                  ${isActive
                    ? 'bg-zinc-50 dark:bg-white/[0.055] text-rose-500 dark:text-rose-400 border border-b-0 border-zinc-200 dark:border-white/10'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-white/[0.04]'
                  }
                `}
                style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
                title={`${tab.description} (${tab.shortcut})`}
              >
                <AnimatedIcon icon={tab.icon} size={16} />
                <span>{tab.label}</span>
                {/* Keyboard shortcut hint */}
                {!isActive && (
                  <span className="hidden sm:inline-flex ml-0.5 w-4 h-4 items-center justify-center bg-zinc-100 dark:bg-white/[0.06] text-zinc-400 text-[9px] font-mono rounded">
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
              onClick={() => window.dispatchEvent(new CustomEvent('pulse:navigate', {
                detail: { view: AppView.MAP },
              }))}
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
        {showEmptyState ? (
          <ContactsEmptyState
            variant={activeMode}
            onConnectClick={() => setConnectModalOpen(true)}
            onAddManualClick={() => setManualAddModalOpen(true)}
          />
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* First-visit onboarding tour */}
      {showTour && (
        <ContactsOnboarding onComplete={() => setShowTour(false)} />
      )}

      <ConnectContactsModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        onImportComplete={(result) => {
          setConnectModalOpen(false);
          const importedContacts = result.keptContactsForTrim ?? [];
          setImportedContactsForTrim(importedContacts);
          if (result.imported > 0) {
            setTrimWizardOpen(true);
          }
          // Phase D step 20: import wrote rows directly via
          // importSelectedContacts(); App.tsx's contact state still
          // points at the pre-import snapshot, so the People view
          // stays in its empty state until a reload. Passing [] keeps
          // App.handleSyncContacts' dedup filter from re-creating
          // anything; the loadContacts() at the end is what we want.
          props.onSyncComplete?.([]);
        }}
        workspaceId={workspaceId}
        workspaceName={currentWorkspace?.name}
      />
      <TrimWizard
        isOpen={trimWizardOpen}
        importedContacts={importedContactsForTrim}
        workspaceId={workspaceId}
        onComplete={() => {
          setTrimWizardOpen(false);
          // Trim mutates contacts.archived_at on rows the user
          // skipped. Refresh so the People list reflects the trimmed
          // set instead of the post-import set.
          props.onSyncComplete?.([]);
        }}
        onClose={() => setTrimWizardOpen(false)}
      />
      <ReconnectGoogleModal
        isOpen={reconnectModalOpen}
        onClose={() => setReconnectModalOpen(false)}
        onSuccess={async () => {
          setReconnectModalOpen(false);
          // After a successful reconnect, the Supabase session has a
          // fresh provider_token. Nuke the in-memory cache so the next
          // wizard open / contact fetch picks it up immediately
          // instead of replaying the dead-token error.
          try {
            const { googleContactsService } = await import('../../services/googleContactsService');
            googleContactsService.invalidateTokenCache();
          } catch { /* defensive: never let a reconnect celebrate-toast crash */ }
        }}
        title={t('contacts.reconnectModal.title')}
        message={t('contacts.reconnectModal.message')}
        invalidGrantReason="revoked"
      />
      <AddContactModal
        isOpen={manualAddModalOpen}
        onClose={() => setManualAddModalOpen(false)}
        onAdd={async (contact) => {
          await props.onAddContact?.(contact);
        }}
      />
    </div>
  );
};

export default ContactsShell;
