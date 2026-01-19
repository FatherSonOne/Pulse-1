/**
 * Highlight Popup Component
 * Shows when user selects text to create a highlight
 */

import React, { useState, useEffect, useRef } from 'react';
import { HighlightColor, HIGHLIGHT_COLORS, CreateHighlightPayload } from '../../../types/annotations';

interface HighlightPopupProps {
  selectedText: string;
  position: { x: number; y: number };
  onCreateHighlight: (payload: Omit<CreateHighlightPayload, 'doc_id'>) => void;
  onClose: () => void;
}

export const HighlightPopup: React.FC<HighlightPopupProps> = ({
  selectedText,
  position,
  onCreateHighlight,
  onClose,
}) => {
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleQuickHighlight = (color: HighlightColor) => {
    onCreateHighlight({
      start_offset: 0, // Will be set by parent
      end_offset: 0,   // Will be set by parent
      highlighted_text: selectedText,
      color,
    });
  };

  const handleDetailedHighlight = () => {
    onCreateHighlight({
      start_offset: 0,
      end_offset: 0,
      highlighted_text: selectedText,
      color: selectedColor,
      note: note.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  // Calculate popup position to stay in viewport
  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 320),
    top: Math.max(position.y + 10, 10),
    zIndex: 9999,
  };

  return (
    <div
      ref={popupRef}
      style={popupStyle}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in"
    >
      {/* Quick highlight colors */}
      <div className="p-2 flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Highlight:</span>
        {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((color) => (
          <button
            key={color}
            onClick={() => handleQuickHighlight(color)}
            className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${
              HIGHLIGHT_COLORS[color].bg
            } border-2 ${
              selectedColor === color
                ? 'border-gray-800 dark:border-white'
                : 'border-transparent'
            }`}
            title={`Highlight ${HIGHLIGHT_COLORS[color].name}`}
          />
        ))}

        {/* Expand button */}
        <button
          onClick={() => setShowNoteInput(!showNoteInput)}
          className="ml-2 p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Add note"
        >
          <i className={`fa ${showNoteInput ? 'fa-chevron-up' : 'fa-plus'} text-xs`}></i>
        </button>
      </div>

      {/* Expanded section for note and tags */}
      {showNoteInput && (
        <div className="p-3 space-y-3">
          {/* Color selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Color:</span>
            {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                  HIGHLIGHT_COLORS[color].bg
                } border-2 ${
                  selectedColor === color
                    ? 'border-gray-800 dark:border-white scale-110'
                    : 'border-transparent'
                }`}
              />
            ))}
          </div>

          {/* Note input */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this highlight..."
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg focus:border-rose-500 focus:outline-none resize-none text-gray-900 dark:text-white"
              rows={2}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              Tags
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="Add tag..."
                className="flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg focus:border-rose-500 focus:outline-none text-gray-900 dark:text-white"
              />
              <button
                onClick={handleAddTag}
                className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
              >
                <i className="fa fa-plus"></i>
              </button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-full text-xs"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-rose-900 dark:hover:text-rose-100"
                    >
                      <i className="fa fa-times text-[10px]"></i>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={handleDetailedHighlight}
            className="w-full py-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-lg text-sm font-medium transition-all"
          >
            <i className="fa fa-highlighter mr-2"></i>
            Save Highlight
          </button>
        </div>
      )}

      {/* Selected text preview */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[280px]">
          "{selectedText.length > 100 ? selectedText.slice(0, 100) + '...' : selectedText}"
        </p>
      </div>
    </div>
  );
};

export default HighlightPopup;
