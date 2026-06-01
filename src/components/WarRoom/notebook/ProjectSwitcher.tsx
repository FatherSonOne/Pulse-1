/**
 * ProjectSwitcher — compact project + session selector folded into the top of
 * the Sources pane (replaces the separate WarRoomSidebar column on the Notebook
 * path, per user decision). Two dropdowns: Project and Session, each with
 * select · delete · "+ New …" (inline name entry). Wires to the existing
 * LiveDashboard handlers via the `nav` object — no new engine logic.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, FolderOpen, MessageSquarePlus, Plus, Trash2 } from 'lucide-react';

export interface ProjectNav {
  projects: { id: string; name: string; icon?: string; color?: string }[];
  sessions: { id: string; title: string; project_id?: string }[];
  selectedProjectId: string | null;
  selectedSessionId: string | null;
  onSelectProject: (id: string) => void;
  onSelectSession: (id: string) => void;
  onCreateProject: (name: string) => void;
  onCreateSession: (title: string, projectId?: string) => void;
  onDeleteProject?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
}

type MenuKind = 'project' | 'session' | null;

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  marginTop: 4,
  zIndex: 50,
  padding: 4,
  borderRadius: 10,
  maxHeight: 280,
  overflowY: 'auto',
  background: 'var(--pulse-surface)',
  border: '1px solid var(--pulse-border-strong)',
  boxShadow: 'var(--pulse-shadow-modal, 0 8px 24px rgba(0,0,0,0.25))',
};

export const ProjectSwitcher: React.FC<{ nav: ProjectNav }> = ({ nav }) => {
  const [menu, setMenu] = useState<MenuKind>(null);
  const [creating, setCreating] = useState<MenuKind>(null);
  const [draft, setDraft] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenu(null);
        setCreating(null);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menu]);

  const project = nav.projects.find((p) => p.id === nav.selectedProjectId);
  const session = nav.sessions.find((s) => s.id === nav.selectedSessionId);
  const projectSessions = nav.sessions.filter((s) => !nav.selectedProjectId || s.project_id === nav.selectedProjectId);

  const submitCreate = (kind: MenuKind) => {
    const name = draft.trim();
    if (!name) return;
    if (kind === 'project') nav.onCreateProject(name);
    else if (kind === 'session') nav.onCreateSession(name, nav.selectedProjectId || undefined);
    setDraft('');
    setCreating(null);
    setMenu(null);
  };

  const triggerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
    padding: '6px 9px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--pulse-ink)',
    border: '1px solid var(--pulse-border)',
    background: 'var(--pulse-surface-raised)',
    cursor: 'pointer',
  };

  const newRow = (kind: MenuKind, label: string, icon: React.ReactNode) =>
    creating === kind ? (
      <div style={{ display: 'flex', gap: 6, padding: '6px 8px' }}>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitCreate(kind);
            if (e.key === 'Escape') { setCreating(null); setDraft(''); }
          }}
          placeholder={kind === 'project' ? 'Project name…' : 'Session title…'}
          style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--pulse-border)', background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink)', outline: 'none' }}
        />
        <button
          onClick={() => submitCreate(kind)}
          style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: 'none', background: 'var(--pulse-rose)', color: 'white', cursor: 'pointer' }}
        >
          Add
        </button>
      </div>
    ) : (
      <button
        onClick={(e) => { e.stopPropagation(); setCreating(kind); setDraft(''); }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', border: 'none', borderTop: '1px solid var(--pulse-border)', borderRadius: 0, background: 'transparent', color: 'var(--pulse-coral-fg)', cursor: 'pointer', fontSize: 12.5, fontWeight: 500, textAlign: 'left' }}
      >
        {icon}
        {label}
      </button>
    );

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'flex', gap: 6, padding: '12px 14px 0' }}>
      {/* Project dropdown */}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <button style={triggerStyle} onClick={() => { setMenu(menu === 'project' ? null : 'project'); setCreating(null); }} title="Switch project">
          <FolderOpen size={14} style={{ color: project?.color || 'var(--pulse-ink-3)', flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project?.name || 'Select project'}
          </span>
          <ChevronDown size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
        </button>
        {menu === 'project' && (
          <div style={menuStyle}>
            {nav.projects.length === 0 && (
              <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--pulse-ink-3)' }}>No projects yet</div>
            )}
            {nav.projects.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => { nav.onSelectProject(p.id); setMenu(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '8px 10px', border: 'none', borderRadius: 7, background: p.id === nav.selectedProjectId ? 'var(--pulse-surface-raised)' : 'transparent', color: 'var(--pulse-ink)', cursor: 'pointer', fontSize: 12.5, textAlign: 'left' }}
                >
                  <i className={`fa ${p.icon || 'fa-rocket'}`} style={{ color: p.color || 'var(--pulse-ink-3)', width: 14, textAlign: 'center' }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                </button>
                {nav.onDeleteProject && (
                  <button onClick={(e) => { e.stopPropagation(); nav.onDeleteProject!(p.id); }} title="Delete project" style={{ padding: 6, border: 'none', background: 'transparent', color: 'var(--pulse-ink-3)', cursor: 'pointer' }}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
            {newRow('project', 'New project', <Plus size={14} />)}
          </div>
        )}
      </div>

      {/* Session dropdown */}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <button style={triggerStyle} onClick={() => { setMenu(menu === 'session' ? null : 'session'); setCreating(null); }} title="Switch session">
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: session ? 'var(--pulse-ink)' : 'var(--pulse-ink-3)' }}>
            {session?.title || 'No session'}
          </span>
          <ChevronDown size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
        </button>
        {menu === 'session' && (
          <div style={menuStyle}>
            {projectSessions.length === 0 && (
              <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--pulse-ink-3)' }}>No sessions yet</div>
            )}
            {projectSessions.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => { nav.onSelectSession(s.id); setMenu(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '8px 10px', border: 'none', borderRadius: 7, background: s.id === nav.selectedSessionId ? 'var(--pulse-surface-raised)' : 'transparent', color: 'var(--pulse-ink)', cursor: 'pointer', fontSize: 12.5, textAlign: 'left' }}
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                </button>
                {nav.onDeleteSession && (
                  <button onClick={(e) => { e.stopPropagation(); nav.onDeleteSession!(s.id); }} title="Delete session" style={{ padding: 6, border: 'none', background: 'transparent', color: 'var(--pulse-ink-3)', cursor: 'pointer' }}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
            {newRow('session', 'New session', <MessageSquarePlus size={14} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectSwitcher;
