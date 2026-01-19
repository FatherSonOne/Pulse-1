/**
 * ToolsPanel Integration Example
 * Demonstrates how to integrate the ToolsPanel into your application
 */

import React, { useState, useEffect } from 'react';
import { ToolsPanel } from './index';

/**
 * Example 1: Basic Integration
 */
export function BasicToolsPanelExample() {
  const handleToolSelect = (toolId: string) => {
    console.log('Tool selected:', toolId);
    alert(`You selected: ${toolId}`);
  };

  return (
    <div className="flex h-screen">
      {/* Main content area */}
      <div className="flex-1 p-8">
        <h1>Your Messages</h1>
        {/* Your messages component here */}
      </div>

      {/* Tools Panel */}
      <ToolsPanel onToolSelect={handleToolSelect} />
    </div>
  );
}

/**
 * Example 2: With Close Handler
 */
export function ToolsPanelWithCloseExample() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const handleToolSelect = (toolId: string) => {
    console.log('Tool selected:', toolId);
    // Handle tool activation here
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 p-8">
        <button
          onClick={() => setIsPanelOpen(true)}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg"
        >
          Open Tools Panel
        </button>
      </div>

      {isPanelOpen && (
        <ToolsPanel
          onToolSelect={handleToolSelect}
          onClose={() => setIsPanelOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Example 3: Mobile Responsive
 */
export function ResponsiveToolsPanelExample() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleToolSelect = (toolId: string) => {
    console.log('Tool selected:', toolId);
  };

  return (
    <ToolsPanel
      onToolSelect={handleToolSelect}
      isMobile={isMobile}
    />
  );
}

/**
 * Example 4: Integration with Existing Tools Component
 */
export function MigratedToolsPanelExample() {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  // Map new tool IDs to old tool IDs
  const toolIdMap: Record<string, string> = {
    'deep-reasoner': 'reason',
    'video-analyst': 'video',
    'video-studio': 'video_gen',
    'voice-recorder': 'transcribe',
    'code-studio': 'code',
    'vision-lab': 'vision',
    'image-editor': 'image_edit',
    'geo-intel': 'maps',
    'meeting-intel': 'meeting_intel',
    'voice-studio': 'voice_studio',
    'deep-search': 'deep_search',
    'route-planner': 'route_planner',
    'ai-assistant': 'ai_assistant'
  };

  const handleToolSelect = (toolId: string) => {
    // Map to old tool ID if exists
    const oldToolId = toolIdMap[toolId] || toolId;
    setSelectedTool(oldToolId);
    console.log('Activated tool:', oldToolId);
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1">
        {/* Your existing Tools component logic */}
        {selectedTool && (
          <div className="p-8">
            <h2>Active Tool: {selectedTool}</h2>
            {/* Render appropriate tool interface based on selectedTool */}
          </div>
        )}
      </div>

      <ToolsPanel onToolSelect={handleToolSelect} />
    </div>
  );
}

/**
 * Example 5: Using Individual Components
 */
export function CustomToolsLayoutExample() {
  const [activeCategory, setActiveCategory] = useState<'all' | 'ai' | 'content' | 'analysis' | 'utilities'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="p-8 space-y-6">
      <h1>Custom Tools Layout</h1>

      {/* Search Box */}
      <SearchBox
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search for tools..."
      />

      {/* Category Tabs */}
      <CategoryTabs
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      {/* Tool Grid - You would implement your own grid here */}
      <div className="grid grid-cols-3 gap-4">
        {/* Your tool cards */}
      </div>
    </div>
  );
}

/**
 * Example 6: Programmatic Tool Selection
 */
export function ProgrammaticToolsExample() {
  const [lastUsedTool, setLastUsedTool] = useState<string>('');
  const { trackToolUsage, getRecentTools } = useToolsStorage();

  const handleToolSelect = (toolId: string) => {
    trackToolUsage(toolId);
    setLastUsedTool(toolId);
    console.log('Recent tools:', getRecentTools());
  };

  // Automatically suggest a tool based on time
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 9 && hour < 12) {
      // Morning suggestion
      console.log('Suggested tool: Smart Compose');
    }
  }, []);

  return (
    <div>
      <p>Last used tool: {lastUsedTool}</p>
      <ToolsPanel onToolSelect={handleToolSelect} />
    </div>
  );
}

/**
 * Example 7: With Custom Styling
 */
export function StyledToolsPanelExample() {
  return (
    <ToolsPanel
      onToolSelect={(id) => console.log(id)}
      className="shadow-2xl border-l-4 border-purple-500"
    />
  );
}

// Import the hook for Example 6
import { useToolsStorage } from './useToolsStorage';
import { SearchBox } from './SearchBox';
import { CategoryTabs } from './CategoryTabs';
