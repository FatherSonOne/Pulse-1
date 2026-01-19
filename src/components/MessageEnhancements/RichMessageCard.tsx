// Rich Message Card Component
import React from 'react';
import { ExternalLink, Code, Calendar, CheckSquare, Play } from 'lucide-react';
import type { RichMessageCard } from '../../types/messageEnhancements';

interface RichMessageCardProps {
  card: RichMessageCard;
  onAction?: (action: string, data: any) => void;
}

export const RichMessageCardComponent: React.FC<RichMessageCardProps> = ({ card, onAction }) => {
  const renderCard = () => {
    switch (card.type) {
      case 'link':
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 hover:border-blue-400 transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                <ExternalLink className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {card.title}
                </div>
                {card.description && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                    {card.description}
                  </div>
                )}
                <a
                  href={card.metadata?.url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                >
                  Open Link →
                </a>
              </div>
            </div>
          </div>
        );
      
      case 'code':
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {card.title}
                </span>
              </div>
              {card.metadata?.runnable && (
                <button
                  onClick={() => onAction?.('run-code', card.metadata)}
                  className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  Run
                </button>
              )}
            </div>
            <pre className="text-xs bg-gray-900 dark:bg-black text-gray-100 p-2 rounded overflow-x-auto max-h-40">
              <code>{card.metadata?.code as string}</code>
            </pre>
          </div>
        );
      
      case 'calendar':
        return (
          <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-3 bg-purple-50 dark:bg-purple-900/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {card.title}
                </div>
                {card.description && (
                  <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    {card.description}
                  </div>
                )}
                <button
                  onClick={() => onAction?.('add-to-calendar', card)}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline mt-2"
                >
                  Add to Calendar
                </button>
              </div>
            </div>
          </div>
        );
      
      case 'task':
        return (
          <div className="border border-green-200 dark:border-green-800 rounded-lg p-3 bg-green-50 dark:bg-green-900/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                <CheckSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {card.title}
                </div>
                <button
                  onClick={() => onAction?.('create-task', card)}
                  className="text-xs px-3 py-1.5 rounded-full bg-green-600 text-white hover:bg-green-700 mt-2"
                >
                  Create Task
                </button>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };
  
  return <div className="my-2">{renderCard()}</div>;
};
