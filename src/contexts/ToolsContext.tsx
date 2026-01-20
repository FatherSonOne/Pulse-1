import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Tool Types
export type ToolCategory = 'ai' | 'content' | 'analysis' | 'utilities';

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: string;
  usageCount?: number;
  lastUsed?: Date;
}

// Active Tool Panel Types
export type ToolPanelType =
  | 'analytics'
  | 'collaboration'
  | 'productivity'
  | 'intelligence'
  | 'proactive'
  | 'communication'
  | 'personalization'
  | 'security'
  | 'mediaHub'
  | null;

// Tab Types for Each Panel
export type AnalyticsTab = 'response' | 'engagement' | 'flow' | 'insights';
export type CollaborationTab = 'collab' | 'links' | 'kb' | 'search' | 'pins' | 'annotations';
export type ProductivityTab = 'templates' | 'schedule' | 'summary' | 'export' | 'shortcuts' | 'notifications';
export type IntelligenceTab = 'insights' | 'reactions' | 'bookmarks' | 'tags' | 'delivery';
export type ProactiveTab = 'reminders' | 'threading' | 'sentiment' | 'groups' | 'search' | 'highlights';
export type CommunicationTab = 'voice' | 'reactions' | 'inbox' | 'archive' | 'replies' | 'status';
export type PersonalizationTab = 'rules' | 'formatting' | 'notes' | 'modes' | 'sounds' | 'drafts';
export type SecurityTab = 'encryption' | 'readtime' | 'versions' | 'folders' | 'insights' | 'focus';
export type MediaHubTab = 'translation' | 'export' | 'templates' | 'attachments' | 'backup' | 'suggestions';

// Tools Context State Interface
export interface ToolsContextState {
  // Active tool panel
  activeToolOverlay: ToolPanelType;
  setActiveToolOverlay: (tool: ToolPanelType) => void;

  // Analytics panel
  showAnalyticsPanel: boolean;
  setShowAnalyticsPanel: (show: boolean) => void;
  analyticsView: AnalyticsTab;
  setAnalyticsView: (view: AnalyticsTab) => void;

  // Collaboration panel
  showCollaborationPanel: boolean;
  setShowCollaborationPanel: (show: boolean) => void;
  collaborationTab: CollaborationTab;
  setCollaborationTab: (tab: CollaborationTab) => void;

  // Productivity panel
  showProductivityPanel: boolean;
  setShowProductivityPanel: (show: boolean) => void;
  productivityTab: ProductivityTab;
  setProductivityTab: (tab: ProductivityTab) => void;

  // Intelligence panel
  showIntelligencePanel: boolean;
  setShowIntelligencePanel: (show: boolean) => void;
  intelligenceTab: IntelligenceTab;
  setIntelligenceTab: (tab: IntelligenceTab) => void;

  // Proactive panel
  showProactivePanel: boolean;
  setShowProactivePanel: (show: boolean) => void;
  proactiveTab: ProactiveTab;
  setProactiveTab: (tab: ProactiveTab) => void;

  // Communication panel
  showCommunicationPanel: boolean;
  setShowCommunicationPanel: (show: boolean) => void;
  communicationTab: CommunicationTab;
  setCommunicationTab: (tab: CommunicationTab) => void;

  // Personalization panel
  showPersonalizationPanel: boolean;
  setShowPersonalizationPanel: (show: boolean) => void;
  personalizationTab: PersonalizationTab;
  setPersonalizationTab: (tab: PersonalizationTab) => void;

  // Security panel
  showSecurityPanel: boolean;
  setShowSecurityPanel: (show: boolean) => void;
  securityTab: SecurityTab;
  setSecurityTab: (tab: SecurityTab) => void;

  // Media Hub panel
  showMediaHubPanel: boolean;
  setShowMediaHubPanel: (show: boolean) => void;
  mediaHubTab: MediaHubTab;
  setMediaHubTab: (tab: MediaHubTab) => void;

  // Stats panel
  showStatsPanel: boolean;
  setShowStatsPanel: (show: boolean) => void;

  // Command palette
  showCommandPalette: boolean;
  setShowCommandPalette: (show: boolean) => void;

  // AI Features
  showAICoach: boolean;
  setShowAICoach: (show: boolean) => void;
  showAIMediator: boolean;
  setShowAIMediator: (show: boolean) => void;
  showVoiceExtractor: boolean;
  setShowVoiceExtractor: (show: boolean) => void;
  showQuickPhrases: boolean;
  setShowQuickPhrases: (show: boolean) => void;

  // Advanced features
  showMeetingDeflector: boolean;
  setShowMeetingDeflector: (show: boolean) => void;
  showTaskExtractor: boolean;
  setShowTaskExtractor: (show: boolean) => void;
  showChannelArtifactPanel: boolean;
  setShowChannelArtifactPanel: (show: boolean) => void;
  useIntentComposer: boolean;
  setUseIntentComposer: (use: boolean) => void;

  // Context panel
  showContextPanel: boolean;
  setShowContextPanel: (show: boolean) => void;

  // Actions
  closeAllPanels: () => void;
  togglePanel: (panel: string, currentValue: boolean) => void;
  openPanel: (panel: ToolPanelType) => void;
}

const ToolsContext = createContext<ToolsContextState | undefined>(undefined);

export const useTools = () => {
  const context = useContext(ToolsContext);
  if (!context) {
    throw new Error('useTools must be used within a ToolsProvider');
  }
  return context;
};

interface ToolsProviderProps {
  children: ReactNode;
}

export const ToolsProvider: React.FC<ToolsProviderProps> = ({ children }) => {
  // Active tool overlay state
  const [activeToolOverlay, setActiveToolOverlay] = useState<ToolPanelType>(null);

  // Analytics panel
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(false);
  const [analyticsView, setAnalyticsView] = useState<AnalyticsTab>('response');

  // Collaboration panel
  const [showCollaborationPanel, setShowCollaborationPanel] = useState(false);
  const [collaborationTab, setCollaborationTab] = useState<CollaborationTab>('collab');

  // Productivity panel
  const [showProductivityPanel, setShowProductivityPanel] = useState(false);
  const [productivityTab, setProductivityTab] = useState<ProductivityTab>('templates');

  // Intelligence panel
  const [showIntelligencePanel, setShowIntelligencePanel] = useState(false);
  const [intelligenceTab, setIntelligenceTab] = useState<IntelligenceTab>('insights');

  // Proactive panel
  const [showProactivePanel, setShowProactivePanel] = useState(false);
  const [proactiveTab, setProactiveTab] = useState<ProactiveTab>('reminders');

  // Communication panel
  const [showCommunicationPanel, setShowCommunicationPanel] = useState(false);
  const [communicationTab, setCommunicationTab] = useState<CommunicationTab>('voice');

  // Personalization panel
  const [showPersonalizationPanel, setShowPersonalizationPanel] = useState(false);
  const [personalizationTab, setPersonalizationTab] = useState<PersonalizationTab>('rules');

  // Security panel
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);
  const [securityTab, setSecurityTab] = useState<SecurityTab>('encryption');

  // Media Hub panel
  const [showMediaHubPanel, setShowMediaHubPanel] = useState(false);
  const [mediaHubTab, setMediaHubTab] = useState<MediaHubTab>('translation');

  // Stats panel
  const [showStatsPanel, setShowStatsPanel] = useState(false);

  // Command palette
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // AI Features
  const [showAICoach, setShowAICoach] = useState(true);
  const [showAIMediator, setShowAIMediator] = useState(true);
  const [showVoiceExtractor, setShowVoiceExtractor] = useState(false);
  const [showQuickPhrases, setShowQuickPhrases] = useState(false);

  // Advanced features
  const [showMeetingDeflector, setShowMeetingDeflector] = useState(true);
  const [showTaskExtractor, setShowTaskExtractor] = useState(false);
  const [showChannelArtifactPanel, setShowChannelArtifactPanel] = useState(false);
  const [useIntentComposer, setUseIntentComposer] = useState(true);

  // Context panel
  const [showContextPanel, setShowContextPanel] = useState(false);

  // Close all tool panels
  const closeAllPanels = useCallback(() => {
    setActiveToolOverlay(null);
    setShowAnalyticsPanel(false);
    setShowCollaborationPanel(false);
    setShowProductivityPanel(false);
    setShowIntelligencePanel(false);
    setShowProactivePanel(false);
    setShowCommunicationPanel(false);
    setShowPersonalizationPanel(false);
    setShowSecurityPanel(false);
    setShowMediaHubPanel(false);
    setShowStatsPanel(false);
  }, []);

  // Toggle a tool panel
  const togglePanel = useCallback((panel: string, currentValue: boolean) => {
    if (currentValue || activeToolOverlay === panel) {
      // Close the tool
      setActiveToolOverlay(null);
      closeAllPanels();
    } else {
      // Open the tool as fullscreen overlay
      closeAllPanels();
      setActiveToolOverlay(panel as ToolPanelType);

      // Set the specific panel state
      switch (panel) {
        case 'analytics': setShowAnalyticsPanel(true); break;
        case 'collaboration': setShowCollaborationPanel(true); break;
        case 'productivity': setShowProductivityPanel(true); break;
        case 'intelligence': setShowIntelligencePanel(true); break;
        case 'proactive': setShowProactivePanel(true); break;
        case 'communication': setShowCommunicationPanel(true); break;
        case 'personalization': setShowPersonalizationPanel(true); break;
        case 'security': setShowSecurityPanel(true); break;
        case 'mediaHub': setShowMediaHubPanel(true); break;
      }
    }
  }, [activeToolOverlay, closeAllPanels]);

  // Open a specific panel
  const openPanel = useCallback((panel: ToolPanelType) => {
    if (!panel) {
      closeAllPanels();
      return;
    }

    closeAllPanels();
    setActiveToolOverlay(panel);

    switch (panel) {
      case 'analytics': setShowAnalyticsPanel(true); break;
      case 'collaboration': setShowCollaborationPanel(true); break;
      case 'productivity': setShowProductivityPanel(true); break;
      case 'intelligence': setShowIntelligencePanel(true); break;
      case 'proactive': setShowProactivePanel(true); break;
      case 'communication': setShowCommunicationPanel(true); break;
      case 'personalization': setShowPersonalizationPanel(true); break;
      case 'security': setShowSecurityPanel(true); break;
      case 'mediaHub': setShowMediaHubPanel(true); break;
    }
  }, [closeAllPanels]);

  const value: ToolsContextState = {
    activeToolOverlay,
    setActiveToolOverlay,
    showAnalyticsPanel,
    setShowAnalyticsPanel,
    analyticsView,
    setAnalyticsView,
    showCollaborationPanel,
    setShowCollaborationPanel,
    collaborationTab,
    setCollaborationTab,
    showProductivityPanel,
    setShowProductivityPanel,
    productivityTab,
    setProductivityTab,
    showIntelligencePanel,
    setShowIntelligencePanel,
    intelligenceTab,
    setIntelligenceTab,
    showProactivePanel,
    setShowProactivePanel,
    proactiveTab,
    setProactiveTab,
    showCommunicationPanel,
    setShowCommunicationPanel,
    communicationTab,
    setCommunicationTab,
    showPersonalizationPanel,
    setShowPersonalizationPanel,
    personalizationTab,
    setPersonalizationTab,
    showSecurityPanel,
    setShowSecurityPanel,
    securityTab,
    setSecurityTab,
    showMediaHubPanel,
    setShowMediaHubPanel,
    mediaHubTab,
    setMediaHubTab,
    showStatsPanel,
    setShowStatsPanel,
    showCommandPalette,
    setShowCommandPalette,
    showAICoach,
    setShowAICoach,
    showAIMediator,
    setShowAIMediator,
    showVoiceExtractor,
    setShowVoiceExtractor,
    showQuickPhrases,
    setShowQuickPhrases,
    showMeetingDeflector,
    setShowMeetingDeflector,
    showTaskExtractor,
    setShowTaskExtractor,
    showChannelArtifactPanel,
    setShowChannelArtifactPanel,
    useIntentComposer,
    setUseIntentComposer,
    showContextPanel,
    setShowContextPanel,
    closeAllPanels,
    togglePanel,
    openPanel,
  };

  return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>;
};
