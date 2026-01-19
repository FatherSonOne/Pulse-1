/**
 * Annotation Popup Component
 * Shows when user clicks to add an annotation
 */

import React, { useState, useEffect, useRef } from 'react';
import { AnnotationType, ANNOTATION_TYPES, CreateAnnotationPayload, AnnotationPosition } from '../../../types/annotations';

interface AnnotationPopupProps {
  position: AnnotationPosition;
  screenPosition: { x: number; y: number };
  onCreateAnnotation: (payload: Omit<CreateAnnotationPayload, 'doc_id'>) => void;
  onClose: () => void;
}

export const AnnotationPopup: React.FC<AnnotationPopupProps> = ({
  position,
  screenPosition,
  onCreateAnnotation,
  onClose,
}) => {
  const [selectedType, setSelectedType] = useState<AnnotationType>('note');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const popupRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

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

  const handleCreate = () => {
    if (!content.trim()) return;

    onCreateAnnotation({
      position,
      content: content.trim(),
      type: selectedType,
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      handleCreate();
    }
  };

  // Calculate popup position to stay in viewport
  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(screenPosition.x, window.innerWidth - 340),
    top: Math.max(screenPosition.y + 10, 10),
    zIndex: 9999,
  };

  return (
    <div
      ref={popupRef}
      style={popupStyle}
      className="w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in"
    >
      {/* Header with type selector */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            New Annotation
          </span>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <i className="fa fa-times"></i>
          </button>
        </div>

        {/* Type selector */}
        <div className="flex gap-1">
          {(Object.keys(ANNOTATION_TYPES) as AnnotationType[]).map((type) => {
            const config = ANNOTATION_TYPES[type];
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                  selectedType === type
                    ? `bg-gray-200 dark:bg-gray-700 ${config.color}`
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <i className={`fa ${config.icon}`}></i>
                <span className="hidden sm:inline">{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Content input */}
        <div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedType === 'question'
                ? 'What question do you have about this?'
                : selectedType === 'todo'
                ? 'What needs to be done?'
                : selectedType === 'important'
                ? 'Why is this important?'
                : 'Add your note...'
            }
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg focus:border-rose-500 focus:outline-none resize-none text-gray-900 dark:text-white placeholder-gray-400"
            rows={3}
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Press ⌘+Enter to save
          </p>
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
            Tags (optional)
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
      </div>

      {/* Footer */}
      <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={!content.trim()}
          className="flex-1 py-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all"
        >
          <i className={`fa ${ANNOTATION_TYPES[selectedType].icon} mr-2`}></i>
          Add
        </button>
      </div>
    </div>
  );
};

export default AnnotationPopup;
