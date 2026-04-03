import { useState, useEffect } from 'react';
import { Task } from '../services/taskService';
import { DecisionWithVotes } from '../services/decisionService';
import { AIMessage, ThinkingStep } from '../services/ragService';

export function useDecisionTaskModals() {
  // Decision Mission modal
  const [showDecisionMission, setShowDecisionMission] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<DecisionWithVotes | null>(null);
  const [missionMessages, setMissionMessages] = useState<AIMessage[]>([]);
  const [missionLoading, setMissionLoading] = useState(false);
  const [missionThinkingLogs, setMissionThinkingLogs] = useState<Map<string, ThinkingStep[]>>(new Map());

  // Sprint 6: Reassign + Extend modals
  const [taskToReassign, setTaskToReassign] = useState<Task | null>(null);
  const [taskToExtend, setTaskToExtend] = useState<Task | null>(null);

  // Task CRUD modals
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);

  // Decision decomposition
  const [decisionToDecompose, setDecisionToDecompose] = useState<DecisionWithVotes | null>(null);

  // Templates
  const [showTemplates, setShowTemplates] = useState(false);

  // AI features
  const [showPrioritizer, setShowPrioritizer] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showNudges, setShowNudges] = useState(false);

  // Escape key handling
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showDecisionMission) {
          setShowDecisionMission(false);
        } else if (showAssistant) {
          setShowAssistant(false);
        } else if (showPrioritizer) {
          setShowPrioritizer(false);
        } else if (taskToReassign) {
          setTaskToReassign(null);
        } else if (taskToExtend) {
          setTaskToExtend(null);
        }
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [showDecisionMission, showAssistant, showPrioritizer, taskToReassign, taskToExtend]);

  // Prevent background scroll
  useEffect(() => {
    const hasAnyOverlay = showDecisionMission || showAssistant || showPrioritizer || taskToReassign !== null || taskToExtend !== null;
    document.body.style.overflow = hasAnyOverlay ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showDecisionMission, showAssistant, showPrioritizer, taskToReassign, taskToExtend]);

  // Focus trap for modals
  useEffect(() => {
    const hasModalOpen = showDecisionMission || showAssistant || taskToReassign !== null || taskToExtend !== null;
    if (!hasModalOpen) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const modalElement = document.querySelector(
        showDecisionMission ? '.decision-mission-modal' :
        showAssistant ? '.conversational-assistant' :
        taskToReassign ? '.reassign-modal-overlay' :
        '.extend-deadline-overlay'
      );

      if (!modalElement) return;

      const focusableElements = modalElement.querySelectorAll(focusableSelectors);
      const firstFocusable = focusableElements[0] as HTMLElement;
      const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      } else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [showDecisionMission, showAssistant, taskToReassign, taskToExtend]);

  return {
    // Decision Mission
    showDecisionMission, setShowDecisionMission,
    selectedDecision, setSelectedDecision,
    missionMessages, setMissionMessages,
    missionLoading, setMissionLoading,
    missionThinkingLogs, setMissionThinkingLogs,

    // Reassign + Extend
    taskToReassign, setTaskToReassign,
    taskToExtend, setTaskToExtend,

    // Task CRUD
    taskToEdit, setTaskToEdit,
    showCreateTask, setShowCreateTask,

    // Decision decomposition
    decisionToDecompose, setDecisionToDecompose,

    // Templates
    showTemplates, setShowTemplates,

    // AI features
    showPrioritizer, setShowPrioritizer,
    showAssistant, setShowAssistant,
    showNudges, setShowNudges,
  };
}
