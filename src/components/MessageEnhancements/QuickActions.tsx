// Quick Actions Component - AI Smart Replies, Emoji Reactions, Voice Messages
import React, { useState } from 'react';
import { Smile, Mic, Zap, ThumbsUp, Heart, CheckCircle, PartyPopper } from 'lucide-react';

interface QuickActionsProps {
  onSmartReply: (reply: string) => void;
  onVoiceMessage: () => void;
  onEmojiReaction: (emoji: string) => void;
  smartReplies?: string[];
  loading?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onSmartReply,
  onVoiceMessage,
  onEmojiReaction,
  smartReplies = [],
  loading = false
}) => {
  const [showReplies, setShowReplies] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  
  const quickEmojis = [
    { emoji: '👍', label: 'thumbs up', icon: ThumbsUp },
    { emoji: '❤️', label: 'heart', icon: Heart },
    { emoji: '✅', label: 'check', icon: CheckCircle },
    { emoji: '🎉', label: 'party', icon: PartyPopper },
    { emoji: '😊', label: 'smile', icon: Smile }
  ];
  
  const defaultReplies = [
    'Thanks! Will do.',
    'Got it, thanks!',
    'Sounds good to me.',
    'Let me check and get back to you.',
    'Perfect, thanks for the update!'
  ];
  
  const repliesToShow = smartReplies.length > 0 ? smartReplies : defaultReplies;
  
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Smart Replies */}
      <div className="relative flex-1">
        <button
          onClick={() => setShowReplies(!showReplies)}
          className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Zap className="w-4 h-4" />
          <span>Smart Reply</span>
        </button>
        
        {showReplies && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowReplies(false)}
            />
            <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1">
              {loading ? (
                <div className="text-center py-4 text-sm text-gray-600 dark:text-gray-400">
                  Generating smart replies...
                </div>
              ) : (
                repliesToShow.map((reply, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      onSmartReply(reply);
                      setShowReplies(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    {reply}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Quick Emoji Reactions */}
      <div className="relative">
        <button
          onClick={() => setShowEmojis(!showEmojis)}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Quick reactions"
        >
          <Smile className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        
        {showEmojis && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowEmojis(false)}
            />
            <div className="absolute bottom-full right-0 mb-2 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2">
              <div className="flex gap-1">
                {quickEmojis.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      onEmojiReaction(item.emoji);
                      setShowEmojis(false);
                    }}
                    className="w-10 h-10 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-xl transition-colors"
                    title={item.label}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Voice Message */}
      <button
        onClick={onVoiceMessage}
        className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        title="Send voice message"
      >
        <Mic className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </button>
    </div>
  );
};
