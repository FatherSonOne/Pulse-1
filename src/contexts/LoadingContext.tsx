// LoadingContext.tsx - Centralized Loading State Management
// Tracks loading stages and progress for enhanced loading screen

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface LoadingStage {
  id: string;
  label: string;
  weight: number; // Percentage of total load time
  status: 'pending' | 'active' | 'complete';
}

export const DEFAULT_LOADING_STAGES: LoadingStage[] = [
  { id: 'auth', label: 'Authenticating...', weight: 20, status: 'pending' },
  { id: 'session', label: 'Restoring session...', weight: 15, status: 'pending' },
  { id: 'contacts', label: 'Loading contacts...', weight: 25, status: 'pending' },
  { id: 'sync', label: 'Syncing data...', weight: 25, status: 'pending' },
  { id: 'ready', label: 'Almost ready...', weight: 15, status: 'pending' }
];

interface LoadingContextType {
  isLoading: boolean;
  currentStage: string;
  currentStageLabel: string;
  progress: number; // 0-100
  stages: LoadingStage[];
  setLoading: (loading: boolean) => void;
  setStage: (stageId: string) => void;
  setProgress: (progress: number) => void;
  completeStage: (stageId: string) => void;
  resetLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
};

interface LoadingProviderProps {
  children: ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [stages, setStages] = useState<LoadingStage[]>(DEFAULT_LOADING_STAGES);
  const [currentStage, setCurrentStageId] = useState('auth');
  const [progress, setProgressValue] = useState(0);

  const setLoading = (loading: boolean) => {
    setIsLoading(loading);
    if (!loading) {
      // When loading completes, mark all stages as complete
      setStages(prev => prev.map(stage => ({ ...stage, status: 'complete' as const })));
      setProgressValue(100);
    }
  };

  const setStage = (stageId: string) => {
    setCurrentStageId(stageId);

    // Update stage statuses
    setStages(prev => prev.map(stage => {
      if (stage.id === stageId) {
        return { ...stage, status: 'active' as const };
      } else {
        const stageIndex = prev.findIndex(s => s.id === stage.id);
        const currentIndex = prev.findIndex(s => s.id === stageId);
        return {
          ...stage,
          status: stageIndex < currentIndex ? 'complete' as const : 'pending' as const
        };
      }
    }));

    // Calculate progress based on completed stages
    const currentIndex = stages.findIndex(s => s.id === stageId);
    let calculatedProgress = 0;
    for (let i = 0; i < currentIndex; i++) {
      calculatedProgress += stages[i].weight;
    }
    setProgressValue(calculatedProgress);
  };

  const setProgress = (value: number) => {
    setProgressValue(Math.min(100, Math.max(0, value)));
  };

  const completeStage = (stageId: string) => {
    setStages(prev => prev.map(stage =>
      stage.id === stageId ? { ...stage, status: 'complete' as const } : stage
    ));

    // Move to next stage
    const currentIndex = stages.findIndex(s => s.id === stageId);
    if (currentIndex < stages.length - 1) {
      const nextStage = stages[currentIndex + 1];
      setStage(nextStage.id);
    } else {
      // All stages complete
      setProgressValue(100);
    }
  };

  const resetLoading = () => {
    setIsLoading(true);
    setStages(DEFAULT_LOADING_STAGES);
    setCurrentStageId('auth');
    setProgressValue(0);
  };

  const currentStageObj = stages.find(s => s.id === currentStage);
  const currentStageLabel = currentStageObj?.label || 'Loading...';

  const value: LoadingContextType = {
    isLoading,
    currentStage,
    currentStageLabel,
    progress,
    stages,
    setLoading,
    setStage,
    setProgress,
    completeStage,
    resetLoading
  };

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
};
