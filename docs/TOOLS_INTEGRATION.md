# Pulse Messages - Tools Integration Guide

**Version**: 1.0
**Last Updated**: 2026-01-19
**Status**: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Tools Architecture](#tools-architecture)
3. [Tool Categories](#tool-categories)
4. [Tool Registry](#tool-registry)
5. [ToolsPanel Component](#toolspanel-component)
6. [Tool Storage System](#tool-storage-system)
7. [Adding New Tools](#adding-new-tools)
8. [Tool Wiring Examples](#tool-wiring-examples)
9. [Backend Integration](#backend-integration)
10. [Testing Tools](#testing-tools)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The Pulse Messages Tools system provides 39 AI-powered and productivity tools organized into 4 categories. Tools are integrated through a centralized registry system with persistent storage and contextual suggestions.

### Key Features

- **39 Tools** across 4 categories
- **Fuzzy search** with keyword matching
- **Usage tracking** with recent/pinned tools
- **Contextual suggestions** based on time and usage
- **LocalStorage persistence** for preferences
- **Modular architecture** for easy extension

### Tool Statistics

| Category | Tool Count | Examples |
|----------|-----------|----------|
| **AI Tools** | 9 | AI Coach, Smart Compose, Sentiment Analysis |
| **Content Creation** | 11 | Templates, Voice Recorder, Formatting |
| **Analysis** | 10 | Engagement Scoring, Response Time, Analytics Export |
| **Utilities** | 9 | Search, Pinning, Keyboard Shortcuts |
| **Total** | **39** | |

---

## Tools Architecture

### Component Structure

```
ToolsPanel/
├── ToolsPanel.tsx              # Main container
├── CategoryTabs.tsx            # Category navigation
├── SearchBox.tsx               # Search functionality
├── ToolCard.tsx                # Individual tool card
├── QuickAccessBar.tsx          # Recent/pinned tools
├── ContextualSuggestions.tsx   # Time-based suggestions
├── toolsData.ts                # Tool registry (461 lines)
├── types.ts                    # TypeScript interfaces
├── useToolsStorage.ts          # Storage hook (169 lines)
├── example.tsx                 # Usage examples
└── index.ts                    # Exports
```

### Data Flow

```
User Action
    │
    ▼
ToolsPanel Component
    │
    ├─> CategoryTabs ────> Filter tools by category
    │
    ├─> SearchBox ───────> Search by name/description/keywords
    │
    ├─> QuickAccessBar ──> Show recent/pinned tools
    │
    └─> ToolCard[] ──────> Display tools
            │
            ├─> Click ──────> trackToolUsage()
            │                     │
            │                     ▼
            │                 useToolsStorage
            │                     │
            │                     ├─> Update localStorage
            │                     └─> Update recent tools
            │
            └─> onToolClick(toolId)
                    │
                    ▼
                Parent Component
                    │
                    ├─> Open tool overlay
                    ├─> Execute tool action
                    └─> Update UI state
```

---

## Tool Categories

### 1. AI Tools (Purple)

**Purpose**: Intelligent assistance and automation

**Tools** (9):
1. **AI Coach** - Personalized coaching and guidance
2. **AI Mediator** - Conflict resolution with neutral mediation
3. **Smart Compose** - AI-powered message suggestions
4. **Sentiment Analysis** - Analyze tone and emotional content
5. **Voice Context** - Voice-aware conversation intelligence
6. **Translation** - Real-time language translation
7. **Brainstorm Assistant** - Generate creative ideas and solutions
8. **Conversation Intelligence** - Extract insights from conversations
9. **Deep Reasoner** - Complex problem solving (requires Gemini API)

**Integration Point**: `BundleAI.tsx` components

### 2. Content Creation (Blue)

**Purpose**: Create and compose messages

**Tools** (11):
1. **Templates** - Pre-built message templates
2. **Quick Phrases** - Save and reuse common phrases
3. **Message Formatting** - Rich text formatting options
4. **Voice Recorder** - Record and transcribe voice messages
5. **Emoji & Reactions** - Express with emojis and reactions
6. **File Attachments** - Attach files and media
7. **Scheduled Messages** - Schedule messages for later
8. **Draft Manager** - Manage saved message drafts
9. **Code Studio** - Generate code and algorithms (requires Gemini)
10. **Vision Lab** - Create images with Imagen 3 (requires Gemini)
11. **Video Studio** - Generate videos with Veo AI (requires Veo API, Pro)

**Integration Point**: `BundleProductivity.tsx`, `BundleAutomation.tsx`

### 3. Analysis (Green)

**Purpose**: Insights and intelligence

**Tools** (10):
1. **Engagement Scoring** - Measure message engagement levels
2. **Response Time Tracker** - Track response time patterns
3. **Conversation Flow** - Visualize conversation patterns
4. **Sentiment Timeline** - Track sentiment changes over time
5. **Analytics Export** - Export analytics and reports
6. **Read Receipts** - Track message read status
7. **Message Impact** - Analyze message effectiveness
8. **Video Analyst** - Analyze and extract insights from video (requires Gemini)
9. **Meeting Intel** - Speaker diarization & sentiment (requires AssemblyAI, Pro)
10. **Deep Search** - Real-time web research (requires Perplexity, Pro)

**Integration Point**: `BundleAnalytics.tsx`, `BundleIntelligence.tsx`

### 4. Utilities (Amber)

**Purpose**: Helper tools and settings

**Tools** (9):
1. **Search & Filter** - Find messages quickly
2. **Message Pinning** - Pin important messages
3. **Thread Linking** - Link related conversations
4. **Knowledge Base** - Access saved information
5. **Keyboard Shortcuts** - View and customize shortcuts
6. **Backup & Sync** - Backup and sync your data
7. **Settings** - Configure tool preferences
8. **Voice Studio** - Text-to-speech synthesis (requires ElevenLabs, Pro)
9. **Route Planner** - Maps & navigation (requires Mapbox, Pro)
10. **AI Assistant** - Multi-model chat (requires Multi-AI)

**Integration Point**: `BundleCollaboration.tsx`, `BundleMultimedia.tsx`

---

## Tool Registry

### Tool Interface

```typescript
interface Tool {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  description: string;           // Short description
  icon: string;                  // FontAwesome icon class
  category: 'ai' | 'content' | 'analysis' | 'utilities';
  keywords?: string[];           // Search keywords
  requiresApiKey?: boolean;      // Requires external API
  apiKeyName?: string;           // API key name (e.g., 'Gemini')
  isPro?: boolean;               // Requires Pro subscription
}
```

### Category Interface

```typescript
interface CategoryConfig {
  id: string;                    // Category ID
  name: string;                  // Display name
  icon: string;                  // FontAwesome icon
  color: string;                 // Theme color
  description: string;           // Category description
}
```

### Tool Registry (toolsData.ts)

**Location**: `src/components/ToolsPanel/toolsData.ts`

**Exports**:
```typescript
export const CATEGORIES: CategoryConfig[];  // 4 categories
export const TOOLS: Tool[];                  // 39 tools

// Helper functions
export function getToolsByCategory(category: string): Tool[];
export function getToolById(id: string): Tool | undefined;
export function searchTools(query: string): Tool[];
export function getCategoryColor(category: string): { bg, text, border };
```

**Example**:
```typescript
import { TOOLS, getToolsByCategory, searchTools } from './toolsData';

// Get all AI tools
const aiTools = getToolsByCategory('ai');  // 9 tools

// Search for "voice" tools
const voiceTools = searchTools('voice');   // 3 tools

// Get specific tool
const smartCompose = getToolById('smart-compose');
```

---

## ToolsPanel Component

### Props Interface

```typescript
interface ToolsPanelProps {
  onToolClick: (toolId: string) => void;     // Tool click handler
  onClose?: () => void;                      // Close panel handler
  className?: string;                        // Additional CSS classes
  initialCategory?: string;                  // Default category ('all')
  showQuickAccess?: boolean;                 // Show quick access bar
  showSuggestions?: boolean;                 // Show contextual suggestions
}
```

### Usage Example

```typescript
import { ToolsPanel } from '@/components/ToolsPanel';

function MessagesComponent() {
  const handleToolClick = (toolId: string) => {
    console.log('Tool clicked:', toolId);

    // Open tool overlay or execute action
    switch (toolId) {
      case 'ai-coach':
        setShowAICoach(true);
        break;
      case 'smart-compose':
        setShowSmartCompose(true);
        break;
      case 'templates':
        setShowTemplates(true);
        break;
      default:
        console.warn('Unknown tool:', toolId);
    }
  };

  return (
    <ToolsPanel
      onToolClick={handleToolClick}
      onClose={() => setShowTools(false)}
      showQuickAccess={true}
      showSuggestions={true}
    />
  );
}
```

### Sub-Components

#### 1. CategoryTabs

**Purpose**: Category navigation

**Features**:
- 4 category tabs + "All" tab
- Active state highlighting
- Responsive design
- Keyboard navigation

**Usage**:
```typescript
<CategoryTabs
  categories={CATEGORIES}
  activeCategory={activeCategory}
  onCategoryChange={setActiveCategory}
/>
```

#### 2. SearchBox

**Purpose**: Search and filter tools

**Features**:
- Fuzzy search
- Keyword matching
- Clear button
- Keyboard shortcut (Ctrl+K)

**Usage**:
```typescript
<SearchBox
  value={searchQuery}
  onChange={setSearchQuery}
  onClear={() => setSearchQuery('')}
  placeholder="Search tools..."
/>
```

#### 3. ToolCard

**Purpose**: Display individual tool

**Features**:
- Icon display
- Name and description
- Category badge
- API key indicator
- Pro badge
- Click handler

**Usage**:
```typescript
<ToolCard
  tool={tool}
  onClick={() => handleToolClick(tool.id)}
  isPinned={pinnedTools.includes(tool.id)}
  onPin={() => togglePinTool(tool.id)}
/>
```

#### 4. QuickAccessBar

**Purpose**: Show recent and pinned tools

**Features**:
- Last 3 recent tools
- Pinned tools
- Horizontal scroll
- One-click access

**Usage**:
```typescript
<QuickAccessBar
  recentTools={recentTools}
  pinnedTools={pinnedTools}
  onToolClick={handleToolClick}
/>
```

#### 5. ContextualSuggestions

**Purpose**: Time-based tool suggestions

**Features**:
- Morning: Daily digest, email check
- Afternoon: Analytics, response time
- Evening: Summaries, catch-up
- Smart recommendations

**Usage**:
```typescript
<ContextualSuggestions
  currentTime={new Date()}
  onToolClick={handleToolClick}
/>
```

---

## Tool Storage System

### useToolsStorage Hook

**Location**: `src/components/ToolsPanel/useToolsStorage.ts`

**Purpose**: Persist tool usage data in LocalStorage

**Storage Key**: `pulse-tools-data`

**Data Structure**:
```typescript
interface ToolsStorageData {
  recent: string[];              // Last 3 tool IDs
  pinned: string[];              // Pinned tool IDs
  usage: {
    [toolId: string]: {
      count: number;             // Usage count
      lastUsed: string;          // ISO timestamp
    };
  };
}
```

### Hook API

```typescript
const {
  recentTools,           // string[] - Last 3 used tool IDs
  pinnedTools,           // string[] - Pinned tool IDs
  usageStats,            // Record<string, { count, lastUsed }>
  trackToolUsage,        // (toolId: string) => void
  togglePinTool,         // (toolId: string) => void
  clearUsageData,        // () => void
  getToolUsageCount,     // (toolId: string) => number
  isToolPinned          // (toolId: string) => boolean
} = useToolsStorage();
```

### Usage Example

```typescript
import { useToolsStorage } from '@/components/ToolsPanel/useToolsStorage';

function MyComponent() {
  const {
    recentTools,
    pinnedTools,
    trackToolUsage,
    togglePinTool
  } = useToolsStorage();

  const handleToolClick = (toolId: string) => {
    // Track usage (updates recent tools and usage stats)
    trackToolUsage(toolId);

    // Execute tool action
    executeTool(toolId);
  };

  const handlePinClick = (toolId: string) => {
    togglePinTool(toolId);
  };

  return (
    <div>
      <h2>Recent Tools</h2>
      {recentTools.map(toolId => {
        const tool = getToolById(toolId);
        return <ToolCard key={toolId} tool={tool} />;
      })}

      <h2>Pinned Tools</h2>
      {pinnedTools.map(toolId => {
        const tool = getToolById(toolId);
        return <ToolCard key={toolId} tool={tool} isPinned />;
      })}
    </div>
  );
}
```

---

## Adding New Tools

### Step 1: Define Tool in Registry

**File**: `src/components/ToolsPanel/toolsData.ts`

```typescript
export const TOOLS: Tool[] = [
  // ... existing tools

  // Add your new tool
  {
    id: 'my-new-tool',
    name: 'My New Tool',
    description: 'Description of what the tool does',
    icon: 'fa-star',  // FontAwesome icon
    category: 'ai',   // or 'content', 'analysis', 'utilities'
    keywords: ['new', 'tool', 'feature'],
    requiresApiKey: false,  // Optional
    isPro: false            // Optional
  }
];
```

### Step 2: Create Tool Component

**File**: `src/components/MessageEnhancements/MyNewTool.tsx`

```typescript
import React, { useState } from 'react';

interface MyNewToolProps {
  onClose: () => void;
  messageId?: string;
  channelId?: string;
}

export const MyNewTool: React.FC<MyNewToolProps> = ({
  onClose,
  messageId,
  channelId
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleExecute = async () => {
    setIsLoading(true);
    try {
      // Tool logic here
      const response = await executeToolAction(messageId);
      setResult(response);
    } catch (error) {
      console.error('Tool execution failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="my-new-tool">
      <div className="header">
        <h2>My New Tool</h2>
        <button onClick={onClose}>×</button>
      </div>

      <div className="content">
        {isLoading && <Spinner />}
        {result && <div>{result}</div>}
      </div>

      <div className="actions">
        <button onClick={handleExecute}>Execute</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};
```

### Step 3: Wire Tool to Parent Component

**File**: `src/components/Messages.tsx` or `MessagesSplitView.tsx`

```typescript
import { MyNewTool } from './MessageEnhancements/MyNewTool';

function Messages() {
  const [activeToolOverlay, setActiveToolOverlay] = useState<string | null>(null);

  const handleToolClick = (toolId: string) => {
    setActiveToolOverlay(toolId);
  };

  return (
    <>
      <ToolsPanel onToolClick={handleToolClick} />

      {/* Tool Overlays */}
      {activeToolOverlay === 'my-new-tool' && (
        <MyNewTool
          onClose={() => setActiveToolOverlay(null)}
          messageId={selectedMessageId}
          channelId={selectedChannelId}
        />
      )}
    </>
  );
}
```

### Step 4: Add Tool Export (Optional)

**File**: `src/components/MessageEnhancements/index.ts`

```typescript
export { MyNewTool } from './MyNewTool';
```

---

## Tool Wiring Examples

### Example 1: AI Coach Tool

**Tool Definition**:
```typescript
{
  id: 'ai-coach',
  name: 'AI Coach',
  description: 'Get personalized coaching and guidance',
  icon: 'fa-user-graduate',
  category: 'ai',
  keywords: ['coach', 'guidance', 'advice', 'mentor']
}
```

**Component Wiring**:
```typescript
import { AICoach } from './MessageEnhancements/BundleAI';

function Messages() {
  const { showAICoach, setShowAICoach } = useTools();

  const handleToolClick = (toolId: string) => {
    if (toolId === 'ai-coach') {
      setShowAICoach(true);
    }
  };

  return (
    <>
      <ToolsPanel onToolClick={handleToolClick} />

      {showAICoach && (
        <AICoach
          onClose={() => setShowAICoach(false)}
          messageContext={selectedMessage}
        />
      )}
    </>
  );
}
```

### Example 2: Templates Tool

**Tool Definition**:
```typescript
{
  id: 'templates',
  name: 'Templates',
  description: 'Pre-built message templates',
  icon: 'fa-file-lines',
  category: 'content',
  keywords: ['template', 'preset', 'format']
}
```

**Component Wiring**:
```typescript
import { TemplatePicker } from './MessageEnhancements/BundleProductivity';

function MessageComposer() {
  const [showTemplates, setShowTemplates] = useState(false);
  const { userTemplates } = useMessagesState();

  const handleTemplateSelect = (template: Template) => {
    setMessageContent(template.content);
    setShowTemplates(false);
  };

  return (
    <>
      <button onClick={() => setShowTemplates(true)}>
        <i className="fa fa-file-lines" /> Templates
      </button>

      {showTemplates && (
        <TemplatePicker
          templates={userTemplates}
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </>
  );
}
```

### Example 3: Engagement Scoring Tool

**Tool Definition**:
```typescript
{
  id: 'engagement-scoring',
  name: 'Engagement Scoring',
  description: 'Measure message engagement levels',
  icon: 'fa-chart-simple',
  category: 'analysis',
  keywords: ['engagement', 'score', 'metric', 'performance']
}
```

**Component Wiring**:
```typescript
import { EngagementScore } from './MessageEnhancements/BundleAnalytics';

function AnalyticsPanel() {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  const handleToolClick = (toolId: string) => {
    if (toolId === 'engagement-scoring') {
      // Tool integrated directly into analytics panel
      return;
    }
  };

  return (
    <div className="analytics-panel">
      {selectedChannelId && (
        <EngagementScore
          channelId={selectedChannelId}
          timeRange="7d"
        />
      )}
    </div>
  );
}
```

---

## Backend Integration

### Tool Action Flow

```
1. User Clicks Tool
   └─> ToolsPanel.onToolClick(toolId)

2. Parent Component
   └─> handleToolClick(toolId)
   └─> setState to show tool overlay

3. Tool Component Mounts
   └─> useEffect to load initial data
   └─> Call backend service

4. Backend Service
   └─> API call to Supabase/Gemini/CRM
   └─> Process response

5. Update UI
   └─> Display results
   └─> Track usage with useToolsStorage
```

### Backend Services Mapping

| Tool | Backend Service | API |
|------|----------------|-----|
| **AI Coach** | `geminiService.ts` | Google Gemini |
| **Smart Compose** | `geminiService.generateSmartReplies()` | Google Gemini |
| **Sentiment Analysis** | `conversationIntelligenceService.ts` | Google Gemini |
| **Translation** | `geminiService.translateText()` | Google Gemini |
| **Engagement Scoring** | `analyticsService.ts` | Supabase |
| **Response Time** | `analyticsService.getResponseTime()` | Supabase |
| **Templates** | `localStorage + Supabase` | Supabase |
| **Search & Filter** | `messageChannelService.searchMessages()` | Supabase |

### Example: Sentiment Analysis Tool Integration

```typescript
// Tool Component
import { analyzeSentiment } from '@/services/conversationIntelligenceService';

export const SentimentAnalysis: React.FC = ({ channelId }) => {
  const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadSentiment = async () => {
      setIsLoading(true);
      try {
        const result = await analyzeSentiment(channelId);
        setSentiment(result);
      } catch (error) {
        console.error('Failed to analyze sentiment:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSentiment();
  }, [channelId]);

  return (
    <div>
      {isLoading && <Spinner />}
      {sentiment && (
        <div>
          <h3>Overall Sentiment: {sentiment.overall}</h3>
          <div>Score: {sentiment.score}</div>
        </div>
      )}
    </div>
  );
};
```

---

## Testing Tools

### Unit Tests

**File**: `src/components/ToolsPanel/__tests__/toolsData.test.ts`

```typescript
import { getToolsByCategory, searchTools, getToolById } from '../toolsData';

describe('toolsData', () => {
  it('should get tools by category', () => {
    const aiTools = getToolsByCategory('ai');
    expect(aiTools.length).toBe(9);
    expect(aiTools[0].category).toBe('ai');
  });

  it('should search tools by name', () => {
    const results = searchTools('coach');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain('Coach');
  });

  it('should get tool by ID', () => {
    const tool = getToolById('ai-coach');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('AI Coach');
  });
});
```

### Integration Tests

**File**: `src/components/ToolsPanel/__tests__/ToolsPanel.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolsPanel } from '../ToolsPanel';

describe('ToolsPanel', () => {
  it('should render all categories', () => {
    render(<ToolsPanel onToolClick={jest.fn()} />);

    expect(screen.getByText('AI Tools')).toBeInTheDocument();
    expect(screen.getByText('Content Creation')).toBeInTheDocument();
    expect(screen.getByText('Analysis')).toBeInTheDocument();
    expect(screen.getByText('Utilities')).toBeInTheDocument();
  });

  it('should filter tools by category', () => {
    render(<ToolsPanel onToolClick={jest.fn()} />);

    fireEvent.click(screen.getByText('AI Tools'));

    const toolCards = screen.getAllByRole('button');
    expect(toolCards.length).toBe(9); // 9 AI tools
  });

  it('should call onToolClick when tool is clicked', () => {
    const onToolClick = jest.fn();
    render(<ToolsPanel onToolClick={onToolClick} />);

    fireEvent.click(screen.getByText('AI Coach'));

    expect(onToolClick).toHaveBeenCalledWith('ai-coach');
  });
});
```

---

## Troubleshooting

### Common Issues

#### 1. Tool Not Appearing in Panel

**Problem**: Added tool to registry but not showing

**Solution**:
- Check tool object has all required fields
- Verify category is valid ('ai', 'content', 'analysis', 'utilities')
- Ensure toolsData.ts exports TOOLS array
- Clear browser cache and reload

#### 2. Tool Click Not Working

**Problem**: Clicking tool has no effect

**Solution**:
- Verify onToolClick prop is passed to ToolsPanel
- Check handleToolClick function is implemented
- Ensure tool ID matches in registry and handler
- Check console for JavaScript errors

#### 3. Recent Tools Not Persisting

**Problem**: Recent tools reset on page refresh

**Solution**:
- Check localStorage is enabled in browser
- Verify useToolsStorage hook is used correctly
- Check localStorage key: `pulse-tools-data`
- Clear localStorage and test again

#### 4. Search Not Finding Tools

**Problem**: Search returns no results for valid keywords

**Solution**:
- Verify keywords array is defined in tool object
- Check search query spelling
- Ensure searchTools() function is called correctly
- Test with tool name instead of keyword

#### 5. API Key Required Tools Not Working

**Problem**: Tool requires API key but not prompting

**Solution**:
- Verify requiresApiKey: true in tool definition
- Check apiKeyName is correct
- Implement API key prompt in parent component
- Verify API key is stored correctly

---

## Appendix

### Complete Tool List

#### AI Tools (9)
1. ai-coach
2. ai-mediator
3. smart-compose
4. sentiment-analysis
5. voice-context
6. translation
7. brainstorm-assistant
8. conversation-intelligence
9. deep-reasoner

#### Content Creation (11)
10. templates
11. quick-phrases
12. message-formatting
13. voice-recorder
14. emoji-reactions
15. file-attachments
16. scheduled-messages
17. draft-manager
18. code-studio
19. vision-lab
20. video-studio

#### Analysis (10)
21. engagement-scoring
22. response-time-tracker
23. conversation-flow
24. sentiment-timeline
25. analytics-export
26. read-receipts
27. message-impact
28. video-analyst
29. meeting-intel
30. deep-search

#### Utilities (9)
31. search-filter
32. message-pinning
33. thread-linking
34. knowledge-base
35. keyboard-shortcuts
36. backup-sync
37. settings
38. voice-studio
39. route-planner
40. ai-assistant (Multi-model)

### Related Documentation

- [Messages Architecture](./MESSAGES_ARCHITECTURE.md) - System design
- [Component API](./COMPONENT_API.md) - Component props
- [API Reference](./API_REFERENCE.md) - Backend APIs
- [User Guide](./USER_GUIDE.md) - User documentation

---

**Document Version**: 1.0
**Last Updated**: 2026-01-19
**Maintained By**: Pulse Engineering Team
**License**: Proprietary
