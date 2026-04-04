/**
 * useMissionPhases — Hook for multi-phase guided mission workflows.
 * Used by DecisionMission to track progression through define→options→criteria→evaluate→decide.
 */

import { useState, useRef } from 'react';

export interface MissionPhaseConfig {
  id: string;
  label: string;
  icon: string;
  description: string;
}

interface UseMissionPhasesOptions {
  phases: MissionPhaseConfig[];
  initialPhase: string;
  onSendMessage: (message: string) => void;
  missionLabel: string;
}

export function useMissionPhases({ phases, initialPhase, onSendMessage, missionLabel }: UseMissionPhasesOptions) {
  const [currentPhase, setCurrentPhase] = useState(initialPhase);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentPhaseIndex = phases.findIndex(p => p.id === currentPhase);
  const currentPhaseConfig = phases.find(p => p.id === currentPhase);
  const isFirstPhase = currentPhaseIndex === 0;
  const isLastPhase = currentPhaseIndex === phases.length - 1;

  const goNext = () => {
    if (!isLastPhase) {
      setCurrentPhase(phases[currentPhaseIndex + 1].id);
    }
  };

  const goPrev = () => {
    if (!isFirstPhase) {
      setCurrentPhase(phases[currentPhaseIndex - 1].id);
    }
  };

  return {
    currentPhase,
    setCurrentPhase,
    currentPhaseIndex,
    currentPhaseConfig,
    isFirstPhase,
    isLastPhase,
    goNext,
    goPrev,
    phases,
    missionLabel,
    messagesEndRef,
    onSendMessage,
  };
}
