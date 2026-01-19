/**
 * Organization Sidebar Component
 * Combines all organization tools in a tabbed interface
 */

import React, { useState } from 'react';
import { TagManager } from './TagManager';
import { CollectionManager } from './CollectionManager';
import { FavoritesPanel } from './FavoritesPanel';
import { RecentViews } from './RecentViews';
import { DocumentTag, DocumentCollection } from '../../../types/organization';

interface OrganizationSidebarProps {
  userId: string;
  documents: Array<{ id: string; title: string; file_type: string }>;
  selectedDocId?: string;
  onDocumentClick?: (docId: string) => void;
  onTagsChange?: (tags: DocumentTag[]) => void;
  onCollectionsChange?: (collections: DocumentCollection[]) => void;
  onClose?: () => void;
}

type TabType = 'favorites' | 'recent' | 'tags' | 'collections';

export const OrganizationSidebar: React.FC<OrganizationSidebarProps> = ({
  userId,
  documents,
  selectedDocId,
  onDocumentClick,
  onTagsChange,
  onCollectionsChange,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('favorites');

  const tabs: { id: TabType; icon: string; label: string; color: string }[] = [
    { id: 'favorites', icon: 'fa-star', label: 'Favorites', color: 'text-amber-500' },
    { id: 'recent', icon: 'fa-clock-o', label: 'Recent', color: 'text-blue-500' },
    { id: 'tags', icon: 'fa-tags', label: 'Tags', color: 'text-rose-500' },
    { id: 'collections', icon: 'fa-folder-open', label: 'Collections', color: 'text-indigo-500' },
  ];

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            <i className="fa fa-th-large mr-2 text-rose-500"></i>
            Organize
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <i className="fa fa-times"></i>
            </button>
          )}
        </div>

        {/* Tab navigation */}
        <div className="flex mt-3 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-700 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title={tab.label}
            >
              <i className={`fa ${tab.icon} ${activeTab === tab.id ? tab.color : ''}`}></i>
              <span className="hidden xl:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected document indicator */}
      {selectedDocId && (
        <div className="px-3 py-2 bg-rose-50 dark:bg-rose-900/20 border-b border-rose-100 dark:border-rose-800/30">
          <div className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <i className="fa fa-file-text-o"></i>
            <span className="truncate">
              Organizing: {documents.find(d => d.id === selectedDocId)?.title || 'Selected document'}
            </span>
          </div>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === 'favorites' && (
          <FavoritesPanel
            userId={userId}
            documents={documents}
            onDocumentClick={onDocumentClick}
          />
        )}

        {activeTab === 'recent' && (
          <RecentViews
            userId={userId}
            documents={documents}
            onDocumentClick={onDocumentClick}
          />
        )}

        {activeTab === 'tags' && (
          <TagManager
            userId={userId}
            docId={selectedDocId}
            onTagsChange={onTagsChange}
          />
        )}

        {activeTab === 'collections' && (
          <CollectionManager
            userId={userId}
            docId={selectedDocId}
            onCollectionsChange={onCollectionsChange}
          />
        )}
      </div>

      {/* Quick tips */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="text-[10px] text-gray-400 space-y-1">
          {activeTab === 'favorites' && (
            <p><i className="fa fa-lightbulb-o mr-1"></i> Click the star icon on any document to favorite it</p>
          )}
          {activeTab === 'recent' && (
            <p><i className="fa fa-lightbulb-o mr-1"></i> Documents you view appear here automatically</p>
          )}
          {activeTab === 'tags' && (
            <p><i className="fa fa-lightbulb-o mr-1"></i> {selectedDocId ? 'Check tags to apply them to this document' : 'Select a document to assign tags'}</p>
          )}
          {activeTab === 'collections' && (
            <p><i className="fa fa-lightbulb-o mr-1"></i> {selectedDocId ? 'Add document to collections' : 'Create manual or smart collections'}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrganizationSidebar;
