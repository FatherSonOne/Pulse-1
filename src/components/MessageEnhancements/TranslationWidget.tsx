// Translation Component
import React, { useState } from 'react';
import { Globe, Loader } from 'lucide-react';
import type { MessageTranslation } from '../../types/messageEnhancements';

interface TranslationWidgetProps {
  originalText: string;
  onTranslate: (targetLanguage: string) => Promise<MessageTranslation>;
}

export const TranslationWidget: React.FC<TranslationWidgetProps> = ({
  originalText,
  onTranslate
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [translation, setTranslation] = useState<MessageTranslation | null>(null);
  const [loading, setLoading] = useState(false);
  
  const languages = [
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'ru', name: 'Russian' }
  ];
  
  const handleTranslate = async (langCode: string) => {
    setLoading(true);
    try {
      const result = await onTranslate(langCode);
      setTranslation(result);
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Translate message"
      >
        <Globe className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 min-w-[250px]">
          {translation ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Translated to {translation.targetLanguage}
                </div>
                <button
                  onClick={() => setTranslation(null)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Back
                </button>
              </div>
              <div className="text-sm text-gray-900 dark:text-gray-100 mb-2">
                {translation.translatedText}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Confidence: {Math.round(translation.confidence * 100)}%
              </div>
            </>
          ) : (
            <>
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Translate to:
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {languages.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => handleTranslate(lang.code)}
                      className="text-xs px-2 py-1.5 rounded bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
