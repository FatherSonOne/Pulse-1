// AI Lab Workspace Types

export type WorkspaceType = 
  | 'canvas'      // AI Canvas - Node-based workflows
  | 'mission'     // Mission Control - Multi-panel dashboard
  | 'studio'      // AI Studio - Presentation pipeline
  | 'hub'         // Intelligence Hub - Autonomous agents
  | 'actions'     // Quick Actions - Context toolbar
  | 'proposal';   // Proposal Builder - Guided wizard

export interface WorkspaceConfig {
  id: WorkspaceType;
  name: string;
  description: string;
  icon: string;
  gradient: string;
  features: string[];
  comingSoon?: boolean;
}

export const WORKSPACES: WorkspaceConfig[] = [
  {
    id: 'canvas',
    name: 'AI Canvas',
    description: 'Visual workflow builder with drag-and-drop nodes',
    icon: 'fa-diagram-project',
    gradient: 'from-violet-600 via-purple-600 to-indigo-600',
    features: ['Node-based workflows', 'Connect tool outputs', 'Save & reuse recipes', 'Real-time preview']
  },
  {
    id: 'mission',
    name: 'Mission Control',
    description: 'Multi-panel command center for complex operations',
    icon: 'fa-grid-2-plus',
    gradient: 'from-slate-700 via-zinc-800 to-neutral-900',
    features: ['Customizable grid layout', 'Live data panels', 'Cross-tool communication', 'Export briefings']
  },
  {
    id: 'studio',
    name: 'AI Studio',
    description: 'Create stunning presentations and dashboards',
    icon: 'fa-clapperboard',
    gradient: 'from-rose-500 via-pink-500 to-fuchsia-500',
    features: ['Pull data from Pulse', 'AI-composed narratives', 'Interactive HTML export', 'Multiple formats']
  },
  {
    id: 'hub',
    name: 'Intelligence Hub',
    description: 'Deploy AI agents that research in parallel',
    icon: 'fa-brain',
    gradient: 'from-cyan-500 via-teal-500 to-emerald-500',
    features: ['Autonomous agents', 'Parallel processing', 'Live progress tracking', 'Auto-compile results']
  },
  {
    id: 'actions',
    name: 'Quick Actions',
    description: 'Context-aware AI that appears when you need it',
    icon: 'fa-bolt',
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    features: ['Smart suggestions', 'One-click actions', 'Works everywhere', 'Keyboard shortcuts']
  },
  {
    id: 'proposal',
    name: 'Proposal Builder',
    description: 'Guided wizard for professional proposals',
    icon: 'fa-file-contract',
    gradient: 'from-blue-600 via-indigo-600 to-violet-600',
    features: ['Step-by-step wizard', 'Template library', 'Import from contacts', 'AI-powered drafts']
  }
];

// Data source types for importing into workspaces
export interface DataSource {
  id: string;
  type: 'archive' | 'warroom' | 'contact' | 'email' | 'calendar' | 'project' | 'task';
  name: string;
  description?: string;
  data?: any;
  timestamp?: Date;
}

// Canvas node types
export interface CanvasNode {
  id: string;
  type: 'tool' | 'input' | 'output' | 'transform';
  toolId?: string;
  position: { x: number; y: number };
  data: any;
  connections: string[];
}

// Mission Control panel types
export interface MissionPanel {
  id: string;
  toolId: string;
  title: string;
  position: { x: number; y: number; w: number; h: number };
  state: any;
}

// Intelligence Hub agent types
export interface AIAgent {
  id: string;
  name: string;
  type: 'research' | 'writer' | 'analyst' | 'designer';
  status: 'idle' | 'working' | 'complete' | 'error';
  progress: number;
  output?: any;
}

// Proposal Builder types
export interface ProposalTemplate {
  id: string;
  name: string;
  icon: string;
  sections: string[];
}

export interface ProposalStep {
  id: number;
  title: string;
  description: string;
  complete: boolean;
}
