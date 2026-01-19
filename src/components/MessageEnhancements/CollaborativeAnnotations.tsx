// Collaborative Annotations System
import React, { useState, useMemo } from 'react';

interface Annotation {
  id: string;
  messageId: string;
  type: 'comment' | 'question' | 'suggestion' | 'flag' | 'approval';
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt?: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  replies: AnnotationReply[];
  mentions: string[];
  reactions: Array<{
    emoji: string;
    users: string[];
  }>;
  position?: {
    startIndex: number;
    endIndex: number;
    selectedText: string;
  };
}

interface AnnotationReply {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  mentions: string[];
}

interface CollaborativeAnnotationsProps {
  annotations: Annotation[];
  currentUserId: string;
  onAddAnnotation?: (annotation: Omit<Annotation, 'id' | 'createdAt' | 'replies' | 'reactions' | 'resolved'>) => void;
  onReply?: (annotationId: string, reply: string, mentions: string[]) => void;
  onResolve?: (annotationId: string) => void;
  onReopen?: (annotationId: string) => void;
  onDelete?: (annotationId: string) => void;
  onReact?: (annotationId: string, emoji: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  participants?: Array<{ id: string; name: string; avatar?: string }>;
  compact?: boolean;
}

const annotationTypes = {
  comment: { icon: 'fa-comment', color: 'blue', label: 'Comment' },
  question: { icon: 'fa-question-circle', color: 'amber', label: 'Question' },
  suggestion: { icon: 'fa-lightbulb', color: 'green', label: 'Suggestion' },
  flag: { icon: 'fa-flag', color: 'red', label: 'Flag' },
  approval: { icon: 'fa-check-circle', color: 'emerald', label: 'Approval' }
};

const quickReactions = ['👍', '👎', '❤️', '🎉', '🤔', '👀'];

export const CollaborativeAnnotations: React.FC<CollaborativeAnnotationsProps> = ({
  annotations,
  currentUserId,
  onReply,
  onResolve,
  onReopen,
  onDelete,
  onReact,
  onJumpToMessage,
  compact = false
}) => {
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved' | 'mine'>('all');
  const [typeFilter, setTypeFilter] = useState<Annotation['type'] | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);

  // Filter annotations
  const filteredAnnotations = useMemo(() => {
    if (!annotations || annotations.length === 0) return [];
    return annotations.filter(ann => {
      if (filter === 'open' && ann.resolved) return false;
      if (filter === 'resolved' && !ann.resolved) return false;
      if (filter === 'mine' && ann.author.id !== currentUserId) return false;
      if (typeFilter !== 'all' && ann.type !== typeFilter) return false;
      return true;
    });
  }, [annotations, filter, typeFilter, currentUserId]);

  // Stats
  const stats = useMemo(() => ({
    total: annotations?.length || 0,
    open: annotations?.filter(a => !a.resolved).length || 0,
    resolved: annotations?.filter(a => a.resolved).length || 0,
    mine: annotations?.filter(a => a.author.id === currentUserId).length || 0
  }), [annotations, currentUserId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleSubmitReply = (annotationId: string) => {
    if (!replyText.trim()) return;

    // Extract mentions from reply text
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(replyText)) !== null) {
      mentions.push(match[1]);
    }

    onReply?.(annotationId, replyText.trim(), mentions);
    setReplyText('');
    setReplyingTo(null);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
          <i className="fa-solid fa-comments text-xs" />
          <span className="text-xs font-medium">{stats.open} open</span>
        </div>
        {stats.resolved > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400">
            <i className="fa-solid fa-check text-xs" />
            <span className="text-xs font-medium">{stats.resolved}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <i className="fa-solid fa-comments text-blue-500 text-sm" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Annotations</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {stats.open} open, {stats.resolved} resolved
              </p>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg p-1">
          {[
            { key: 'all', label: 'All', count: stats.total },
            { key: 'open', label: 'Open', count: stats.open },
            { key: 'resolved', label: 'Resolved', count: stats.resolved },
            { key: 'mine', label: 'Mine', count: stats.mine }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as typeof filter)}
              className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition ${
                filter === tab.key
                  ? 'bg-white dark:bg-zinc-600 text-zinc-800 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Type filter */}
      <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-700 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 flex-shrink-0">Type:</span>
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-2 py-1 rounded-full text-[10px] font-medium transition ${
            typeFilter === 'all'
              ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-800'
              : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600'
          }`}
        >
          All
        </button>
        {Object.entries(annotationTypes).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key as Annotation['type'])}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition ${
              typeFilter === key
                ? `bg-${config.color}-100 dark:bg-${config.color}-900/40 text-${config.color}-600 dark:text-${config.color}-400`
                : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600'
            }`}
          >
            <i className={`fa-solid ${config.icon}`} />
            {config.label}
          </button>
        ))}
      </div>

      {/* Annotations list */}
      <div className="max-h-96 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-700">
        {filteredAnnotations.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-3">
              <i className="fa-solid fa-comments text-zinc-400 text-lg" />
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No annotations found</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              Add annotations to collaborate on messages
            </p>
          </div>
        ) : (
          filteredAnnotations.map(annotation => {
            const typeConfig = annotationTypes[annotation.type];
            const isExpanded = expandedId === annotation.id;

            return (
              <div
                key={annotation.id}
                className={`p-3 transition ${annotation.resolved ? 'opacity-60' : ''} hover:bg-zinc-50 dark:hover:bg-zinc-700/50`}
              >
                <div className="flex items-start gap-3">
                  {/* Author avatar */}
                  <div className="relative flex-shrink-0">
                    {annotation.author.avatar ? (
                      <img
                        src={annotation.author.avatar}
                        alt={annotation.author.name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className={`w-8 h-8 rounded-full bg-${typeConfig.color}-100 dark:bg-${typeConfig.color}-900/40 flex items-center justify-center`}>
                        <span className={`text-xs font-bold text-${typeConfig.color}-600 dark:text-${typeConfig.color}-400`}>
                          {getInitials(annotation.author.name)}
                        </span>
                      </div>
                    )}
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-${typeConfig.color}-500 flex items-center justify-center`}>
                      <i className={`fa-solid ${typeConfig.icon} text-white text-[8px]`} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-800 dark:text-white">
                            {annotation.author.name}
                          </span>
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded bg-${typeConfig.color}-100 dark:bg-${typeConfig.color}-900/40 text-${typeConfig.color}-600 dark:text-${typeConfig.color}-400`}>
                            {typeConfig.label}
                          </span>
                          {annotation.resolved && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400">
                              Resolved
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-400">
                          {formatDate(annotation.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {onJumpToMessage && (
                          <button
                            onClick={() => onJumpToMessage(annotation.messageId)}
                            className="p-1 text-zinc-400 hover:text-indigo-500 transition"
                            title="Jump to message"
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                          </button>
                        )}
                        {annotation.author.id === currentUserId && onDelete && (
                          <button
                            onClick={() => onDelete(annotation.id)}
                            className="p-1 text-zinc-400 hover:text-red-500 transition"
                            title="Delete"
                          >
                            <i className="fa-solid fa-trash text-xs" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Selected text context */}
                    {annotation.position && (
                      <div className="mt-2 p-2 bg-zinc-50 dark:bg-zinc-900 rounded border-l-2 border-zinc-300 dark:border-zinc-600">
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 italic">
                          &quot;{annotation.position.selectedText}&quot;
                        </p>
                      </div>
                    )}

                    {/* Content */}
                    <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                      {annotation.content}
                    </p>

                    {/* Mentions */}
                    {annotation.mentions.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 flex-wrap">
                        {annotation.mentions.map(mention => (
                          <span
                            key={mention}
                            className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                          >
                            @{mention}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Reactions */}
                    {annotation.reactions.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 flex-wrap">
                        {annotation.reactions.map((reaction, idx) => (
                          <button
                            key={idx}
                            onClick={() => onReact?.(annotation.id, reaction.emoji)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition ${
                              reaction.users.includes(currentUserId)
                                ? 'bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-300 dark:border-indigo-700'
                                : 'bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                            }`}
                          >
                            <span>{reaction.emoji}</span>
                            <span className="text-zinc-600 dark:text-zinc-400">{reaction.users.length}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => setShowReactionPicker(showReactionPicker === annotation.id ? null : annotation.id)}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
                        >
                          <i className="fa-solid fa-face-smile text-xs" />
                        </button>
                        {showReactionPicker === annotation.id && (
                          <div className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-700 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-600">
                            {quickReactions.map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => {
                                  onReact?.(annotation.id, emoji);
                                  setShowReactionPicker(null);
                                }}
                                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-600 rounded transition"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : annotation.id)}
                        className="text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      >
                        {annotation.replies.length > 0
                          ? `${annotation.replies.length} replies`
                          : 'Reply'}
                        <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} ml-1`} />
                      </button>
                      {!annotation.resolved && onResolve && (
                        <button
                          onClick={() => onResolve(annotation.id)}
                          className="text-[10px] text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                        >
                          <i className="fa-solid fa-check mr-1" />
                          Resolve
                        </button>
                      )}
                      {annotation.resolved && onReopen && (
                        <button
                          onClick={() => onReopen(annotation.id)}
                          className="text-[10px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                        >
                          <i className="fa-solid fa-undo mr-1" />
                          Reopen
                        </button>
                      )}
                    </div>

                    {/* Replies */}
                    {isExpanded && (
                      <div className="mt-3 pl-3 border-l-2 border-zinc-200 dark:border-zinc-600 space-y-3">
                        {annotation.replies.map(reply => (
                          <div key={reply.id} className="flex items-start gap-2">
                            {reply.author.avatar ? (
                              <img
                                src={reply.author.avatar}
                                alt={reply.author.name}
                                className="w-6 h-6 rounded-full"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-600 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                                  {getInitials(reply.author.name)}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-zinc-800 dark:text-white">
                                  {reply.author.name}
                                </span>
                                <span className="text-[10px] text-zinc-400">
                                  {formatDate(reply.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                                {reply.content}
                              </p>
                            </div>
                          </div>
                        ))}

                        {/* Reply input */}
                        {replyingTo === annotation.id ? (
                          <div className="flex items-start gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                              <i className="fa-solid fa-user text-indigo-500 text-[10px]" />
                            </div>
                            <div className="flex-1">
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write a reply... Use @name to mention"
                                className="w-full px-2 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white placeholder-zinc-400 resize-none"
                                rows={2}
                                autoFocus
                              />
                              <div className="flex items-center gap-2 mt-1">
                                <button
                                  onClick={() => handleSubmitReply(annotation.id)}
                                  disabled={!replyText.trim()}
                                  className="px-2 py-1 text-[10px] font-medium bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Reply
                                </button>
                                <button
                                  onClick={() => {
                                    setReplyingTo(null);
                                    setReplyText('');
                                  }}
                                  className="px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setReplyingTo(annotation.id)}
                            className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                          >
                            <i className="fa-solid fa-reply mr-1" />
                            Add reply
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// Annotation button for messages
export const AnnotationButton: React.FC<{
  count: number;
  hasUnresolved: boolean;
  onClick: () => void;
}> = ({ count, hasUnresolved, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition ${
        hasUnresolved
          ? 'text-blue-500 bg-blue-100 dark:bg-blue-900/40'
          : count > 0
            ? 'text-zinc-500 bg-zinc-100 dark:bg-zinc-700'
            : 'text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
      }`}
      title={count > 0 ? `${count} annotations` : 'Add annotation'}
    >
      <i className="fa-solid fa-comment-dots text-xs" />
      {count > 0 && <span className="text-[10px] font-medium">{count}</span>}
    </button>
  );
};

// Quick annotation creator
export const QuickAnnotationCreator: React.FC<{
  onSubmit: (type: Annotation['type'], content: string) => void;
  onCancel: () => void;
  selectedText?: string;
}> = ({ onSubmit, onCancel, selectedText }) => {
  const [type, setType] = useState<Annotation['type']>('comment');
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    if (!content.trim()) return;
    onSubmit(type, content.trim());
  };

  return (
    <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700">
      {selectedText && (
        <div className="mb-3 p-2 bg-zinc-50 dark:bg-zinc-900 rounded border-l-2 border-indigo-500">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 italic line-clamp-2">
            &quot;{selectedText}&quot;
          </p>
        </div>
      )}

      <div className="flex items-center gap-1 mb-2">
        {Object.entries(annotationTypes).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setType(key as Annotation['type'])}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${
              type === key
                ? `bg-${config.color}-100 dark:bg-${config.color}-900/40 text-${config.color}-600 dark:text-${config.color}-400`
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            <i className={`fa-solid ${config.icon}`} />
          </button>
        ))}
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={`Add a ${annotationTypes[type].label.toLowerCase()}...`}
        className="w-full px-2 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white placeholder-zinc-400 resize-none"
        rows={2}
        autoFocus
      />

      <div className="flex items-center justify-end gap-2 mt-2">
        <button
          onClick={onCancel}
          className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!content.trim()}
          className="px-3 py-1 text-xs font-medium bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add {annotationTypes[type].label}
        </button>
      </div>
    </div>
  );
};

export default CollaborativeAnnotations;
