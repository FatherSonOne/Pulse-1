import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WorkspaceType, DataSource, CanvasNode, MissionPanel, AIAgent } from './types';
import { teamService, TeamWithMembers } from '../../../services/teamService';
import { messageChannelService } from '../../../services/messageChannelService';
import { MessageChannel } from '../../../types/messages';
import { supabase } from '../../../services/supabase';

interface CurrentUser {
  id: string;
  email?: string;
}

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

  // API Keys (from localStorage/env)
  apiKeys: {
    gemini: string;
    openai: string;
    claude: string;
    assembly: string;
    elevenlabs: string;
    mapbox: string;
  };

  // Team data bridge
  currentUser: CurrentUser | null;
  teams: TeamWithMembers[];
  teamChannels: MessageChannel[];
  isLoadingTeamData: boolean;
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

  // Team data bridge state
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [teamChannels, setTeamChannels] = useState<MessageChannel[]>([]);
  const [isLoadingTeamData, setIsLoadingTeamData] = useState(false);

  // Load API keys from localStorage/env
  // gemini: router handles key server-side, callers just receive '' and pass through
  const apiKeys = {
    gemini: '',
    openai: localStorage.getItem('openai_api_key') || '',
    claude: localStorage.getItem('claude_api_key') || '',
    assembly: localStorage.getItem('assemblyai_api_key') || '',
    elevenlabs: localStorage.getItem('elevenlabs_api_key') || '',
    mapbox: localStorage.getItem('mapbox_api_key') || '',
  };

  // Load team context on mount
  useEffect(() => {
    const loadTeamContext = async () => {
      setIsLoadingTeamData(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser({ id: user.id, email: user.email });
        }

        const [userTeams, { data: workspaceData }] = await Promise.all([
          teamService.getTeams(),
          supabase.from('workspaces').select('id').limit(1).single(),
        ]);

        setTeams(userTeams);

        if (workspaceData?.id) {
          const channels = await messageChannelService.getChannels(workspaceData.id);
          setTeamChannels(channels);
        }
      } catch {
        // Non-blocking — AI Lab still works without team data
      } finally {
        setIsLoadingTeamData(false);
      }
    };

    loadTeamContext();
  }, []);

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
      currentUser,
      teams,
      teamChannels,
      isLoadingTeamData,
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
