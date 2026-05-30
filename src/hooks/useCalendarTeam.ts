/**
 * useCalendarTeam — extracted from Calendar.tsx during the impeccable
 * critique action plan (Step 9: distill, second extraction).
 *
 * Owns team-management state: teams list (persisted to localStorage),
 * selected team, modal visibility, team-form scratch state, and CRUD
 * handlers. Does NOT own `overlayMemberIds` or `overlayEvents` — those
 * are render-coupled (depend on viewMode + currentDate + contacts) and
 * stay in Calendar.tsx.
 */
import { useState, useEffect, useCallback } from 'react';
import { Team } from '../components/Calendar/calendarTypes';

const DEFAULT_TEAM: Team = {
  id: 'default-team',
  name: 'My Team',
  color: 'bg-blue-500',
  memberIds: [],
};

export function useCalendarTeam() {
  // ─── Team list (persisted) ───────────────────────────────────────────
  const [teams, setTeams] = useState<Team[]>(() => {
    try {
      const stored = localStorage.getItem('cal_teams');
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return [DEFAULT_TEAM];
  });
  const [selectedTeamId, setSelectedTeamId] = useState<string>(DEFAULT_TEAM.id);

  // Persist on change
  useEffect(() => {
    localStorage.setItem('cal_teams', JSON.stringify(teams));
  }, [teams]);

  // ─── Modal + scratch form state ──────────────────────────────────────
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('bg-blue-500');
  const [newTeamMembers, setNewTeamMembers] = useState<string[]>([]);

  const resetTeamForm = useCallback(() => {
    setNewTeamName('');
    setNewTeamColor('bg-blue-500');
    setNewTeamMembers([]);
    setEditingTeam(null);
  }, []);

  // ─── CRUD handlers ───────────────────────────────────────────────────
  const handleCreateTeam = useCallback(() => {
    if (!newTeamName.trim()) return;
    const newTeam: Team = {
      id: `team-${crypto.randomUUID()}`,
      name: newTeamName.trim(),
      color: newTeamColor,
      memberIds: newTeamMembers,
    };
    setTeams(prev => [...prev, newTeam]);
    setSelectedTeamId(newTeam.id);
    setShowTeamModal(false);
    resetTeamForm();
  }, [newTeamName, newTeamColor, newTeamMembers, resetTeamForm]);

  const handleUpdateTeam = useCallback(() => {
    if (!editingTeam || !newTeamName.trim()) return;
    setTeams(prev => prev.map(t =>
      t.id === editingTeam.id
        ? { ...t, name: newTeamName.trim(), color: newTeamColor, memberIds: newTeamMembers }
        : t
    ));
    setShowTeamModal(false);
    resetTeamForm();
  }, [editingTeam, newTeamName, newTeamColor, newTeamMembers, resetTeamForm]);

  const handleDeleteTeam = useCallback((teamId: string) => {
    setTeams(prev => {
      if (prev.length <= 1) return prev; // Keep at least one team
      const next = prev.filter(t => t.id !== teamId);
      if (selectedTeamId === teamId && next.length > 0) {
        setSelectedTeamId(next[0].id);
      }
      return next;
    });
  }, [selectedTeamId]);

  const openEditTeam = useCallback((team: Team) => {
    setEditingTeam(team);
    setNewTeamName(team.name);
    setNewTeamColor(team.color);
    setNewTeamMembers(team.memberIds);
    setShowTeamModal(true);
  }, []);

  return {
    teams,
    selectedTeamId,
    setSelectedTeamId,
    showTeamModal,
    setShowTeamModal,
    editingTeam,
    newTeamName,
    setNewTeamName,
    newTeamColor,
    setNewTeamColor,
    newTeamMembers,
    setNewTeamMembers,
    handleCreateTeam,
    handleUpdateTeam,
    handleDeleteTeam,
    openEditTeam,
    resetTeamForm,
  };
}
