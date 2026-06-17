/**
 * CockpitMasthead — top bar for the Decisions & Tasks Triage Cockpit.
 *
 * Phase 1: title badge · ⌘K command-bar trigger · bell / activity / AI
 * actions · New ▾ · underline Triage|Archive scene-tabs. The bell/activity/AI
 * buttons + New overlay are wired to real panels in Phases 10–11; here they
 * accept optional handlers so the chrome is complete and keyboard-reachable.
 *
 * Coral budget (CLAUDE.md §4): all chrome → rose / neutral tokens only.
 */
import { useState } from 'react';
import { CheckSquare, Search, Bell, Activity, Bot, Plus, ChevronDown, Inbox, Archive, Scale, Sparkles, LayoutTemplate } from 'lucide-react';

export type CockpitTab = 'triage' | 'archive';

const TABS: { id: CockpitTab; label: string; icon: React.ReactNode }[] = [
  { id: 'triage', label: 'Triage', icon: <Inbox size={14} /> },
  { id: 'archive', label: 'Archive', icon: <Archive size={14} /> },
];

interface CockpitMastheadProps {
  tab: CockpitTab;
  setTab: (tab: CockpitTab) => void;
  onOpenCommand: () => void;
  onNewDecision?: () => void;
  onNewTask?: () => void;
  onNewTemplate?: () => void;
  onAskAI?: () => void;
  onAlerts?: () => void;
  onActivity?: () => void;
  onAssistant?: () => void;
  /** Mono micro-label after the title (e.g. "3 / 7 · ~12m to clear"). */
  subtitle?: string;
  /** Alerts badge count; hidden when 0/undefined. */
  alertCount?: number;
}

export function CockpitMasthead({
  tab,
  setTab,
  onOpenCommand,
  onNewDecision,
  onNewTask,
  onNewTemplate,
  onAskAI,
  onAlerts,
  onActivity,
  onAssistant,
  subtitle,
  alertCount,
}: CockpitMastheadProps) {
  const [newOpen, setNewOpen] = useState(false);
  const pick = (fn?: () => void) => { setNewOpen(false); fn?.(); };
  return (
    <header className="ck-masthead">
      <div className="ck-masthead-row">
        <div className="ck-title-group">
          <span className="ck-title-badge"><CheckSquare size={15} /></span>
          <h1 className="ck-title">Decisions &amp; Tasks</h1>
          {subtitle && <span className="ck-subtitle">{subtitle}</span>}
        </div>

        <div className="ck-actions">
          <button className="ck-kbar" onClick={onOpenCommand} aria-label="Open command palette" aria-keyshortcuts="Meta+K Control+K">
            <span className="ck-kbar-label"><Search size={14} aria-hidden /> Search or run a command…</span>
            <span className="ck-keycap" aria-hidden>⌘K</span>
          </button>

          <button className="ck-hbtn" onClick={onAlerts} aria-label={alertCount ? `Alerts (${alertCount})` : 'Alerts'}>
            <Bell size={17} />
            {!!alertCount && alertCount > 0 && (
              <span className="ck-hbtn-badge" aria-hidden>{alertCount > 99 ? '99+' : alertCount}</span>
            )}
          </button>
          <button className="ck-hbtn" onClick={onActivity} aria-label="Activity"><Activity size={17} /></button>
          <button className="ck-hbtn" onClick={onAssistant} aria-label="AI Assistant"><Bot size={17} /></button>

          <div className="ck-sv">
            <button className="ck-new" onClick={() => setNewOpen((o) => !o)} aria-label="Create new" aria-haspopup="menu" aria-expanded={newOpen}>
              <Plus size={16} /> New <ChevronDown size={13} aria-hidden />
            </button>
            {newOpen && (
              <>
                <div className="ck-menu-backdrop" onClick={() => setNewOpen(false)} aria-hidden />
                <div className="ck-menu" role="menu" style={{ left: 'auto', right: 0, minWidth: 180 }}>
                  <button className="ck-menu-item" role="menuitem" onClick={() => pick(onNewDecision)}><Scale size={15} /> New decision</button>
                  <button className="ck-menu-item" role="menuitem" onClick={() => pick(onNewTask)}><Plus size={15} /> Quick task</button>
                  {onNewTemplate && (
                    <button className="ck-menu-item" role="menuitem" onClick={() => pick(onNewTemplate)}><LayoutTemplate size={15} /> New from template</button>
                  )}
                  <button className="ck-menu-item" role="menuitem" onClick={() => pick(onAskAI)}><Sparkles size={15} /> Ask Pulse AI</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <nav className="ck-tabs" aria-label="Decisions and tasks views">
        {TABS.map((t) => (
          <button
            key={t.id}
            className="ck-tab"
            data-on={tab === t.id}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
