// Enhanced Translation Widget with Auto-Detect and Inline Translation
import React, { useState, useEffect, useCallback } from 'react';
import type { MessageTranslation } from '../../types/messageEnhancements';

interface Language {
  code: string;
  name: string;
  flag: string;
}

const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' }
];

// Simple language detection based on character patterns
const detectLanguage = (text: string): Language | null => {
  if (!text || text.length < 3) return null;

  const patterns: Record<string, RegExp> = {
    ja: /[\u3040-\u309F\u30A0-\u30FF]/,  // Hiragana/Katakana
    zh: /[\u4E00-\u9FFF]/,               // Chinese characters
    ko: /[\uAC00-\uD7AF]/,               // Korean
    ar: /[\u0600-\u06FF]/,               // Arabic
    ru: /[\u0400-\u04FF]/,               // Cyrillic
    hi: /[\u0900-\u097F]/,               // Devanagari
    th: /[\u0E00-\u0E7F]/,               // Thai
  };

  for (const [code, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      return LANGUAGES.find(l => l.code === code) || null;
    }
  }

  // For Latin-based languages, use common word patterns
  const lowerText = text.toLowerCase();
  const spanishPatterns = /\b(el|la|los|las|un|una|que|de|en|es|por|para)\b/g;
  const frenchPatterns = /\b(le|la|les|un|une|de|du|des|et|est|que|pour)\b/g;
  const germanPatterns = /\b(der|die|das|ein|eine|und|ist|ich|sie|wir)\b/g;
  const italianPatterns = /\b(il|lo|la|i|gli|le|un|una|che|di|e|per)\b/g;
  const portuguesePatterns = /\b(o|a|os|as|um|uma|de|do|da|e|que|para)\b/g;

  const spanishCount = (lowerText.match(spanishPatterns) || []).length;
  const frenchCount = (lowerText.match(frenchPatterns) || []).length;
  const germanCount = (lowerText.match(germanPatterns) || []).length;
  const italianCount = (lowerText.match(italianPatterns) || []).length;
  const portugueseCount = (lowerText.match(portuguesePatterns) || []).length;

  const counts = [
    { code: 'es', count: spanishCount },
    { code: 'fr', count: frenchCount },
    { code: 'de', count: germanCount },
    { code: 'it', count: italianCount },
    { code: 'pt', count: portugueseCount }
  ];

  const maxCount = Math.max(...counts.map(c => c.count));
  if (maxCount >= 2) {
    const detected = counts.find(c => c.count === maxCount);
    if (detected) {
      return LANGUAGES.find(l => l.code === detected.code) || null;
    }
  }

  // Default to English for Latin text
  return LANGUAGES.find(l => l.code === 'en') || null;
};

// Mock translation (in production, use a translation API)
const mockTranslate = async (text: string, targetLang: string): Promise<MessageTranslation> => {
  await new Promise(resolve => setTimeout(resolve, 800));

  // This is a mock - in production, you'd call a real translation API
  const mockTranslations: Record<string, Record<string, string>> = {
    'Hello': { es: 'Hola', fr: 'Bonjour', de: 'Hallo', it: 'Ciao', ja: 'こんにちは' },
    'Thank you': { es: 'Gracias', fr: 'Merci', de: 'Danke', it: 'Grazie', ja: 'ありがとう' },
    'How are you?': { es: '¿Cómo estás?', fr: 'Comment allez-vous?', de: 'Wie geht es dir?', it: 'Come stai?', ja: 'お元気ですか？' }
  };

  const translation = mockTranslations[text]?.[targetLang];

  return {
    originalText: text,
    translatedText: translation || `[${targetLang.toUpperCase()}] ${text}`,
    sourceLanguage: 'en',
    targetLanguage: targetLang,
    confidence: translation ? 0.95 : 0.7
  };
};

interface TranslationWidgetEnhancedProps {
  originalText: string;
  onTranslate?: (translation: MessageTranslation) => void;
  preferredLanguage?: string;
  autoDetect?: boolean;
  compact?: boolean;
}

export const TranslationWidgetEnhanced: React.FC<TranslationWidgetEnhancedProps> = ({
  originalText,
  onTranslate,
  preferredLanguage = 'en',
  autoDetect = true,
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [translation, setTranslation] = useState<MessageTranslation | null>(null);
  const [loading, setLoading] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<Language | null>(null);
  const [recentLanguages, setRecentLanguages] = useState<string[]>(['es', 'fr', 'de']);
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-detect language on mount
  useEffect(() => {
    if (autoDetect && originalText) {
      const detected = detectLanguage(originalText);
      setDetectedLanguage(detected);
    }
  }, [originalText, autoDetect]);

  const handleTranslate = useCallback(async (targetLang: string) => {
    setLoading(true);
    try {
      const result = await mockTranslate(originalText, targetLang);
      setTranslation(result);
      onTranslate?.(result);

      // Update recent languages
      setRecentLanguages(prev => {
        const updated = [targetLang, ...prev.filter(l => l !== targetLang)].slice(0, 3);
        return updated;
      });
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setLoading(false);
    }
  }, [originalText, onTranslate]);

  const filteredLanguages = searchQuery
    ? LANGUAGES.filter(l =>
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : LANGUAGES;

  const recentLangObjects = recentLanguages
    .map(code => LANGUAGES.find(l => l.code === code))
    .filter(Boolean) as Language[];

  if (compact) {
    return (
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1.5 rounded-lg transition-colors ${
          detectedLanguage && detectedLanguage.code !== 'en'
            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
            : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
        title={detectedLanguage ? `Detected: ${detectedLanguage.name}` : 'Translate'}
      >
        <i className="fa-solid fa-globe text-xs" />
      </button>
    );
  }

  return (
    <div className="relative inline-block">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
          isOpen
            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        <i className="fa-solid fa-globe text-xs" />
        {detectedLanguage && detectedLanguage.code !== 'en' && (
          <span className="text-[10px] font-medium">
            {detectedLanguage.flag} {detectedLanguage.name}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-72 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-language text-blue-500" />
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                  Translation
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <i className="fa-solid fa-times text-xs" />
              </button>
            </div>

            {/* Auto-detected language */}
            {detectedLanguage && (
              <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <i className="fa-solid fa-wand-magic-sparkles text-purple-500" />
                <span>Detected: {detectedLanguage.flag} {detectedLanguage.name}</span>
              </div>
            )}
          </div>

          {/* Translation Result */}
          {translation && (
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-700 bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                  <i className="fa-solid fa-check-circle" />
                  <span className="font-medium">
                    {LANGUAGES.find(l => l.code === translation.targetLanguage)?.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-400">
                    {Math.round(translation.confidence * 100)}%
                  </span>
                  <button
                    onClick={() => setTranslation(null)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Try another
                  </button>
                </div>
              </div>
              <p className="text-sm text-zinc-800 dark:text-zinc-200">
                {translation.translatedText}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(translation.translatedText);
                }}
                className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1"
              >
                <i className="fa-solid fa-copy" />
                Copy translation
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="p-4 flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Translating...</span>
            </div>
          )}

          {/* Language Selection */}
          {!loading && !translation && (
            <>
              {/* Search */}
              <div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
                <div className="relative">
                  <i className="fa-solid fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs" />
                  <input
                    type="text"
                    placeholder="Search languages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-700 rounded-lg border-0 outline-none text-zinc-800 dark:text-zinc-200 placeholder-zinc-400"
                  />
                </div>
              </div>

              {/* Recent Languages */}
              {!searchQuery && recentLangObjects.length > 0 && (
                <div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1.5">
                    Recent
                  </div>
                  <div className="flex gap-1.5">
                    {recentLangObjects.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => handleTranslate(lang.code)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-zinc-700 dark:text-zinc-300 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* All Languages */}
              <div className="max-h-48 overflow-y-auto">
                <div className="grid grid-cols-2 gap-1 p-2">
                  {filteredLanguages.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => handleTranslate(lang.code)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors text-left"
                    >
                      <span className="text-base">{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Inline translation indicator for received messages
export const TranslationIndicator: React.FC<{
  detectedLanguage?: string;
  onClick?: () => void;
}> = ({ detectedLanguage, onClick }) => {
  if (!detectedLanguage || detectedLanguage === 'en') return null;

  const lang = LANGUAGES.find(l => l.code === detectedLanguage);
  if (!lang) return null;

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-medium hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors"
    >
      <span>{lang.flag}</span>
      <span>Translate</span>
    </button>
  );
};

// Auto-translate toggle for settings
export const AutoTranslateToggle: React.FC<{
  enabled: boolean;
  targetLanguage: string;
  onToggle: (enabled: boolean) => void;
  onLanguageChange: (lang: string) => void;
}> = ({ enabled, targetLanguage, onToggle, onLanguageChange }) => {
  const [showLanguages, setShowLanguages] = useState(false);
  const targetLang = LANGUAGES.find(l => l.code === targetLanguage);

  return (
    <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
          <i className="fa-solid fa-globe text-blue-500" />
        </div>
        <div>
          <div className="text-sm font-medium text-zinc-800 dark:text-white">
            Auto-translate messages
          </div>
          <button
            onClick={() => setShowLanguages(!showLanguages)}
            className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
          >
            <span>to {targetLang?.flag} {targetLang?.name}</span>
            <i className={`fa-solid fa-chevron-${showLanguages ? 'up' : 'down'} text-[8px]`} />
          </button>
        </div>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          enabled ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>

      {/* Language selector dropdown */}
      {showLanguages && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 p-1 z-50">
          {LANGUAGES.filter(l => l.code !== 'en').map(lang => (
            <button
              key={lang.code}
              onClick={() => {
                onLanguageChange(lang.code);
                setShowLanguages(false);
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                lang.code === targetLanguage
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
              {lang.code === targetLanguage && (
                <i className="fa-solid fa-check text-blue-500 ml-auto" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TranslationWidgetEnhanced;
