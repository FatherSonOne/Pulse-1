// Thread Linking & Cross-references Component
import React, { useState, useMemo } from 'react';

interface LinkedThread {
  id: string;
  contactName: string;
  subject?: string;
  lastMessage: string;
  lastMessageTime: string;
  linkType: 'related' | 'continued' | 'referenced' | 'child' | 'parent';
  messageCount: number;
  linkedAt: string;
  linkedBy: string;
}

interface CrossReference {
  id: string;
  sourceThreadId: string;
  sourceMessageId: string;
  targetThreadId: string;
  targetMessageId?: string;
  referenceType: 'quote' | 'mention' | 'link' | 'reply' | 'forward';
  context: string;
  createdAt: string;
}

interface ThreadLinkingProps {
  currentThreadId: string;
  linkedThreads: LinkedThread[];
  crossReferences: CrossReference[];
  onLinkThread?: (threadId: string, linkType: LinkedThread['linkType']) => void;
  onUnlinkThread?: (threadId: string) => void;
  onNavigateToThread?: (threadId: string, messageId?: string) => void;
  onCreateReference?: (targetThreadId: string, referenceType: CrossReference['referenceType'], context: string) => void;
  searchThreads?: (query: string) => Promise<Array<{ id: string; contactName: string; preview: string }>>;
  compact?: boolean;
}

export const ThreadLinking: React.FC<ThreadLinkingProps> = ({
  currentThreadId,
  linkedThreads,
  crossReferences,
  onLinkThread,
  onUnlinkThread,
  onNavigateToThread,
  onCreateReference,
  searchThreads,
  compact = false
}) => {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; contactName: string; preview: string }>>([]);
  const [selectedLinkType, setSelectedLinkType] = useState<LinkedThread['linkType']>('related');
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'linked' | 'references'>('linked');

  // Group references by type
  const groupedReferences = useMemo(() => {
    if (!crossReferences || crossReferences.length === 0) return {} as Record<string, CrossReference[]>;
    return crossReferences.reduce((acc, ref) => {
      if (!acc[ref.referenceType]) acc[ref.referenceType] = [];
      acc[ref.referenceType].push(ref);
      return acc;
    }, {} as Record<string, CrossReference[]>);
  }, [crossReferences]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      if (searchThreads) {
        const results = await searchThreads(query);
        setSearchResults(results.filter(r => r.id !== currentThreadId));
      }
    } finally {
      setIsSearching(false);
    }
  };

  const getLinkTypeIcon = (type: LinkedThread['linkType']) => {
    switch (type) {
      case 'related': return 'fa-link';
      case 'continued': return 'fa-arrow-right';
      case 'referenced': return 'fa-quote-left';
      case 'child': return 'fa-sitemap';
      case 'parent': return 'fa-level-up-alt';
    }
  };

  const getLinkTypeLabel = (type: LinkedThread['linkType']) => {
    switch (type) {
      case 'related': return 'Related';
      case 'continued': return 'Continued in';
      case 'referenced': return 'Referenced';
      case 'child': return 'Sub-thread';
      case 'parent': return 'Parent thread';
    }
  };

  const getLinkTypeColor = (type: LinkedThread['linkType']) => {
    switch (type) {
      case 'related': return 'text-blue-500 bg-blue-100 dark:bg-blue-900/40';
      case 'continued': return 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/40';
      case 'referenced': return 'text-purple-500 bg-purple-100 dark:bg-purple-900/40';
      case 'child': return 'text-amber-500 bg-amber-100 dark:bg-amber-900/40';
      case 'parent': return 'text-indigo-500 bg-indigo-100 dark:bg-indigo-900/40';
    }
  };

  const getReferenceIcon = (type: CrossReference['referenceType']) => {
    switch (type) {
      case 'quote': return 'fa-quote-right';
      case 'mention': return 'fa-at';
      case 'link': return 'fa-external-link';
      case 'reply': return 'fa-reply';
      case 'forward': return 'fa-share';
    }
  };

  if (compact) {
    const totalLinks = (linkedThreads?.length || 0) + (crossReferences?.length || 0);
    if (totalLinks === 0) return null;

    return (
      <button
        onClick={() => setShowLinkModal(true)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition"
      >
        <i className="fa-solid fa-link" />
        <span>{totalLinks} linked</span>
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <i className="fa-solid fa-diagram-project text-indigo-500 text-sm" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Thread Links</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {linkedThreads?.length || 0} threads · {crossReferences?.length || 0} references
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLinkModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition"
          >
            <i className="fa-solid fa-plus" />
            Link
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700">
        <button
          onClick={() => setActiveTab('linked')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition ${
            activeTab === 'linked'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Linked Threads ({linkedThreads?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('references')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition ${
            activeTab === 'references'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          References ({crossReferences?.length || 0})
        </button>
      </div>

      {/* Content */}
      <div className="max-h-60 overflow-y-auto">
        {activeTab === 'linked' && (
          <div className="p-2">
            {!linkedThreads || linkedThreads.length === 0 ? (
              <div className="text-center py-6 text-zinc-400 dark:text-zinc-500">
                <i className="fa-solid fa-link-slash text-2xl mb-2" />
                <p className="text-xs">No linked threads yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {linkedThreads.map(thread => (
                  <div
                    key={thread.id}
                    className="p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getLinkTypeColor(thread.linkType)}`}>
                        <i className={`fa-solid ${getLinkTypeIcon(thread.linkType)} text-xs`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-zinc-800 dark:text-white truncate">
                            {thread.contactName}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getLinkTypeColor(thread.linkType)}`}>
                            {getLinkTypeLabel(thread.linkType)}
                          </span>
                        </div>
                        {thread.subject && (
                          <p className="text-xs text-zinc-600 dark:text-zinc-300 truncate mb-0.5">
                            {thread.subject}
                          </p>
                        )}
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                          {thread.lastMessage}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                          <span>{thread.messageCount} messages</span>
                          <span>·</span>
                          <span>{new Date(thread.lastMessageTime).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => onNavigateToThread?.(thread.id)}
                          className="p-1.5 rounded text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                          title="Go to thread"
                        >
                          <i className="fa-solid fa-arrow-right text-xs" />
                        </button>
                        <button
                          onClick={() => onUnlinkThread?.(thread.id)}
                          className="p-1.5 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Unlink"
                        >
                          <i className="fa-solid fa-unlink text-xs" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'references' && (
          <div className="p-2">
            {!crossReferences || crossReferences.length === 0 ? (
              <div className="text-center py-6 text-zinc-400 dark:text-zinc-500">
                <i className="fa-solid fa-quote-left text-2xl mb-2" />
                <p className="text-xs">No cross-references yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(groupedReferences).map(([type, refs]) => (
                  <div key={type}>
                    <div className="flex items-center gap-1.5 mb-2 px-2">
                      <i className={`fa-solid ${getReferenceIcon(type as CrossReference['referenceType'])} text-zinc-400 text-xs`} />
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        {type}s ({refs.length})
                      </span>
                    </div>
                    <div className="space-y-1">
                      {refs.map(ref => (
                        <button
                          key={ref.id}
                          onClick={() => onNavigateToThread?.(ref.targetThreadId, ref.targetMessageId)}
                          className="w-full p-2 rounded-lg text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition"
                        >
                          <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2">
                            "{ref.context}"
                          </p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                            {new Date(ref.createdAt).toLocaleDateString()}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowLinkModal(false)}>
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-zinc-800 dark:text-white">Link Thread</h3>
                <button onClick={() => setShowLinkModal(false)} className="text-zinc-400 hover:text-zinc-600">
                  <i className="fa-solid fa-times" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {/* Search */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Search Threads
                </label>
                <div className="relative">
                  <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder="Search by name or content..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                  {isSearching && (
                    <i className="fa-solid fa-circle-notch fa-spin absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  )}
                </div>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {searchResults.map(result => (
                    <button
                      key={result.id}
                      onClick={() => {
                        onLinkThread?.(result.id, selectedLinkType);
                        setShowLinkModal(false);
                      }}
                      className="w-full p-2 rounded-lg text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
                    >
                      <div className="text-sm font-medium text-zinc-800 dark:text-white">
                        {result.contactName}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {result.preview}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Link Type */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                  Link Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['related', 'continued', 'referenced', 'child'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setSelectedLinkType(type)}
                      className={`p-2 rounded-lg border-2 transition ${
                        selectedLinkType === type
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <i className={`fa-solid ${getLinkTypeIcon(type)} ${getLinkTypeColor(type).split(' ')[0]}`} />
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          {getLinkTypeLabel(type)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end">
              <button
                onClick={() => setShowLinkModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Inline thread reference badge
export const ThreadReferenceBadge: React.FC<{
  threadName: string;
  onClick?: () => void;
}> = ({ threadName, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition"
  >
    <i className="fa-solid fa-link" />
    {threadName}
  </button>
);

export default ThreadLinking;
