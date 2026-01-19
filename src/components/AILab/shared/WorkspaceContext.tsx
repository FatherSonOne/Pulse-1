import React, { createContext, useContext, useState, ReactNode } from 'react';
import { WorkspaceType, DataSource, CanvasNode, MissionPanel, AIAgent } from './types';

interface WorkspaceState {
  // Current workspace
  activeWorkspace: WorkspaceType | null;
  setActiveWorkspace: (ws: WorkspaceType | null) => void;
  
  // Data sources (imported from Pulse)
  dataSources: DataSource[];
  addDataSource: (source: DataSource) => void;
  removeDataSource: (id: string) => void;
  
  // Canvas state
  canvasNodes: CanvasNode[];
  setCanvasNodes: (nodes: CanvasNode[]) => void;
  
  // Mission Control state
  missionPanels: MissionPanel[];
  setMissionPanels: (panels: MissionPanel[]) => void;
  missionName: string;
  setMissionName: (name: string) => void;
  
  // Intelligence Hub state
  agents: AIAgent[];
  setAgents: (agents: AIAgent[]) => void;
  missionPrompt: string;
  setMissionPrompt: (prompt: string) => void;
  
  // Shared output
  generatedOutput: any;
  setGeneratedOutput: (output: any) => void;
  
  // API Keys (from localStorage)
  apiKeys: {
    gemini: string;
    openai: string;
    claude: string;
    assembly: string;
    elevenlabs: string;
    perplexity: string;
    mapbox: string;
  };
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceType | null>(null);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>([]);
  const [missionPanels, setMissionPanels] = useState<MissionPanel[]>([]);
  const [missionName, setMissionName] = useState('Untitled Mission');
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [missionPrompt, setMissionPrompt] = useState('');
  const [generatedOutput, setGeneratedOutput] = useState<any>(null);

  // Load API keys from localStorage
  const apiKeys = {
    gemini: import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '',
    openai: localStorage.getItem('openai_api_key') || '',
    claude: localStorage.getItem('claude_api_key') || '',
    assembly: localStorage.getItem('assemblyai_api_key') || '',
    elevenlabs: localStorage.getItem('elevenlabs_api_key') || '',
    perplexity: localStorage.getItem('perplexity_api_key') || '',
    mapbox: localStorage.getItem('mapbox_api_key') || '',
  };

  const addDataSource = (source: DataSource) => {
    setDataSources(prev => [...prev, source]);
  };

  const removeDataSource = (id: string) => {
    setDataSources(prev => prev.filter(s => s.id !== id));
  };

  return (
    <WorkspaceContext.Provider value={{
      activeWorkspace,
      setActiveWorkspace,
      dataSources,
      addDataSource,
      removeDataSource,
      canvasNodes,
      setCanvasNodes,
      missionPanels,
      setMissionPanels,
      missionName,
      setMissionName,
      agents,
      setAgents,
      missionPrompt,
      setMissionPrompt,
      generatedOutput,
      setGeneratedOutput,
      apiKeys,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return context;
};
