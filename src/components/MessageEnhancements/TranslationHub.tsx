import React, { useState, useCallback, useMemo } from 'react';

// Types
interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

interface TranslationEntry {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: Date;
  confidence: number;
  isAutoDetected: boolean;
}

interface TranslationSettings {
  autoTranslate: boolean;
  preferredLanguage: string;
  showOriginal: boolean;
  translateOutgoing: boolean;
  saveHistory: boolean;
}

interface LanguagePreference {
  contactId: string;
  contactName: string;
  preferredLanguage: string;
  autoTranslate: boolean;
}

interface TranslationHubProps {
  onTranslate?: (text: string, targetLanguage: string) => Promise<string>;
  onSettingsChange?: (settings: TranslationSettings) => void;
  onLanguagePreferenceChange?: (contactId: string, language: string) => void;
}

// Supported languages
const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' }
];

// Mock data
const generateMockHistory = (): TranslationEntry[] => [
  {
    id: '1',
    originalText: 'Bonjour, comment allez-vous?',
    translatedText: 'Hello, how are you?',
    sourceLanguage: 'fr',
    targetLanguage: 'en',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    confidence: 0.98,
    isAutoDetected: true
  },
  {
    id: '2',
    originalText: 'The meeting is scheduled for tomorrow at 3 PM.',
    translatedText: 'La reunión está programada para mañana a las 3 PM.',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    confidence: 0.95,
    isAutoDetected: false
  },
  {
    id: '3',
    originalText: 'お疲れ様でした',
    translatedText: 'Thank you for your hard work',
    sourceLanguage: 'ja',
    targetLanguage: 'en',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    confidence: 0.92,
    isAutoDetected: true
  }
];

const generateMockPreferences = (): LanguagePreference[] => [
  { contactId: '1', contactName: 'Pierre Dubois', preferredLanguage: 'fr', autoTranslate: true },
  { contactId: '2', contactName: 'Maria Garcia', preferredLanguage: 'es', autoTranslate: true },
  { contactId: '3', contactName: 'Yuki Tanaka', preferredLanguage: 'ja', autoTranslate: false },
  { contactId: '4', contactName: 'Hans Mueller', preferredLanguage: 'de', autoTranslate: true }
];

export const TranslationHub: React.FC<TranslationHubProps> = ({
  onTranslate,
  onSettingsChange,
  onLanguagePreferenceChange
}) => {
  const [activeTab, setActiveTab] = useState<'translate' | 'history' | 'contacts' | 'settings'>('translate');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [history, setHistory] = useState<TranslationEntry[]>(generateMockHistory);
  const [contactPreferences, setContactPreferences] = useState<LanguagePreference[]>(generateMockPreferences);
  const [settings, setSettings] = useState<TranslationSettings>({
    autoTranslate: true,
    preferredLanguage: 'en',
    showOriginal: true,
    translateOutgoing: false,
    saveHistory: true
  });
  const [searchLanguage, setSearchLanguage] = useState('');

  const filteredLanguages = useMemo(() => {
    if (!searchLanguage) return LANGUAGES;
    const search = searchLanguage.toLowerCase();
    return LANGUAGES.filter(lang =>
      lang.name.toLowerCase().includes(search) ||
      lang.nativeName.toLowerCase().includes(search) ||
      lang.code.includes(search)
    );
  }, [searchLanguage]);

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) return;

    setIsTranslating(true);
    try {
      // Simulate translation
      await new Promise(resolve => setTimeout(resolve, 800));

      const mockTranslations: Record<string, Record<string, string>> = {
        'Hello': { es: 'Hola', fr: 'Bonjour', de: 'Hallo', ja: 'こんにちは' },
        'Thank you': { es: 'Gracias', fr: 'Merci', de: 'Danke', ja: 'ありがとう' },
        'Good morning': { es: 'Buenos días', fr: 'Bonjour', de: 'Guten Morgen', ja: 'おはよう' }
      };

      const result = mockTranslations[sourceText]?.[targetLanguage] || `[Translated to ${targetLanguage}]: ${sourceText}`;
      setTranslatedText(result);

      if (settings.saveHistory) {
        const entry: TranslationEntry = {
          id: Date.now().toString(),
          originalText: sourceText,
          translatedText: result,
          sourceLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage,
          targetLanguage,
          timestamp: new Date(),
          confidence: 0.95,
          isAutoDetected: sourceLanguage === 'auto'
        };
        setHistory(prev => [entry, ...prev]);
      }

      if (onTranslate) {
        await onTranslate(sourceText, targetLanguage);
      }
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setIsTranslating(false);
    }
  }, [sourceText, targetLanguage, sourceLanguage, settings.saveHistory, onTranslate]);

  const swapLanguages = useCallback(() => {
    if (sourceLanguage !== 'auto') {
      const temp = sourceLanguage;
      setSourceLanguage(targetLanguage);
      setTargetLanguage(temp);
      setSourceText(translatedText);
      setTranslatedText(sourceText);
    }
  }, [sourceLanguage, targetLanguage, sourceText, translatedText]);

  const updateSetting = useCallback(<K extends keyof TranslationSettings>(
    key: K,
    value: TranslationSettings[K]
  ) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      onSettingsChange?.(updated);
      return updated;
    });
  }, [onSettingsChange]);

  const updateContactPreference = useCallback((contactId: string, language: string) => {
    setContactPreferences(prev =>
      prev.map(p => p.contactId === contactId ? { ...p, preferredLanguage: language } : p)
    );
    onLanguagePreferenceChange?.(contactId, language);
  }, [onLanguagePreferenceChange]);

  const getLanguage = (code: string): Language | undefined =>
    LANGUAGES.find(l => l.code === code);

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-500/10 to-blue-500/10 dark:from-sky-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-sky-200 dark:border-sky-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm">
            <i className="fa-solid fa-language text-sky-500 text-lg" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">Translation Hub</p>
            <p className="text-xs text-zinc-500">{LANGUAGES.length} languages supported</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
        {[
          { id: 'translate' as const, label: 'Translate', icon: 'fa-globe' },
          { id: 'history' as const, label: 'History', icon: 'fa-clock-rotate-left' },
          { id: 'contacts' as const, label: 'Contacts', icon: 'fa-users' },
          { id: 'settings' as const, label: 'Settings', icon: 'fa-gear' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition ${
              activeTab === tab.id
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <i className={`fa-solid ${tab.icon}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'translate' && (
        <div className="space-y-4">
          {/* Language Selection */}
          <div className="flex items-center gap-2">
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
            >
              <option value="auto">Auto-detect</option>
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>

            <button
              onClick={swapLanguages}
              disabled={sourceLanguage === 'auto'}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fa-solid fa-arrow-right-arrow-left text-zinc-500" />
            </button>

            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Source Text */}
          <div className="relative">
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Enter text to translate..."
              className="w-full h-32 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm resize-none"
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-2">
              <span className="text-xs text-zinc-400">{sourceText.length} chars</span>
              {sourceText && (
                <button
                  onClick={() => setSourceText('')}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                >
                  <i className="fa-solid fa-xmark text-zinc-400 text-xs" />
                </button>
              )}
            </div>
          </div>

          {/* Translate Button */}
          <button
            onClick={handleTranslate}
            disabled={!sourceText.trim() || isTranslating}
            className="w-full py-2.5 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {isTranslating ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin" />
                Translating...
              </>
            ) : (
              <>
                <i className="fa-solid fa-language" />
                Translate
              </>
            )}
          </button>

          {/* Translated Text */}
          {translatedText && (
            <div className="p-3 bg-sky-50 dark:bg-sky-900/20 rounded-lg border border-sky-200 dark:border-sky-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-sky-600 dark:text-sky-400">
                  {getLanguage(targetLanguage)?.flag} {getLanguage(targetLanguage)?.name}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(translatedText)}
                  className="p-1 hover:bg-sky-100 dark:hover:bg-sky-900/30 rounded"
                >
                  <i className="fa-solid fa-copy text-sky-500 text-xs" />
                </button>
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{translatedText}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-2">
          {history.length === 0 ? (
            <div className="text-center py-8">
              <i className="fa-solid fa-clock-rotate-left text-zinc-300 text-3xl mb-3" />
              <p className="text-sm text-zinc-500">No translation history</p>
            </div>
          ) : (
            history.map(entry => (
              <div
                key={entry.id}
                className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{getLanguage(entry.sourceLanguage)?.flag}</span>
                    <i className="fa-solid fa-arrow-right text-[10px]" />
                    <span>{getLanguage(entry.targetLanguage)?.flag}</span>
                    {entry.isAutoDetected && (
                      <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 rounded text-[10px]">
                        Auto
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400">{formatTimeAgo(entry.timestamp)}</span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">{entry.originalText}</p>
                <p className="text-sm text-zinc-900 dark:text-white">{entry.translatedText}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-zinc-400">
                    {Math.round(entry.confidence * 100)}% confidence
                  </span>
                  <button
                    onClick={() => {
                      setSourceText(entry.originalText);
                      setSourceLanguage(entry.sourceLanguage);
                      setTargetLanguage(entry.targetLanguage);
                      setActiveTab('translate');
                    }}
                    className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    Re-translate
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'contacts' && (
        <div className="space-y-4">
          {/* Language Search */}
          <div className="relative">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm" />
            <input
              type="text"
              value={searchLanguage}
              onChange={(e) => setSearchLanguage(e.target.value)}
              placeholder="Search languages..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
            />
          </div>

          {/* Contact Preferences */}
          <div className="space-y-2">
            {contactPreferences.map(pref => (
              <div
                key={pref.contactId}
                className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                      {pref.contactName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{pref.contactName}</p>
                      <p className="text-xs text-zinc-500">
                        {getLanguage(pref.preferredLanguage)?.flag} {getLanguage(pref.preferredLanguage)?.name}
                      </p>
                    </div>
                  </div>
                  <select
                    value={pref.preferredLanguage}
                    onChange={(e) => updateContactPreference(pref.contactId, e.target.value)}
                    className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Language List */}
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Available Languages</p>
            <div className="grid grid-cols-2 gap-2">
              {filteredLanguages.slice(0, 8).map(lang => (
                <div
                  key={lang.code}
                  className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
                >
                  <span className="text-lg">{lang.flag}</span>
                  <div>
                    <p className="text-xs font-medium text-zinc-900 dark:text-white">{lang.name}</p>
                    <p className="text-[10px] text-zinc-500">{lang.nativeName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-3">
          {/* Preferred Language */}
          <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <p className="text-sm font-medium text-zinc-900 dark:text-white mb-2">My Language</p>
            <select
              value={settings.preferredLanguage}
              onChange={(e) => updateSetting('preferredLanguage', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Settings */}
          {[
            { key: 'autoTranslate' as const, label: 'Auto-translate incoming messages', description: 'Automatically translate messages in other languages' },
            { key: 'translateOutgoing' as const, label: 'Translate outgoing messages', description: 'Translate your messages to recipient\'s language' },
            { key: 'showOriginal' as const, label: 'Show original text', description: 'Display original text alongside translations' },
            { key: 'saveHistory' as const, label: 'Save translation history', description: 'Keep a record of your translations' }
          ].map(setting => (
            <div
              key={setting.key}
              className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
            >
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-white">{setting.label}</p>
                <p className="text-xs text-zinc-500">{setting.description}</p>
              </div>
              <button
                onClick={() => updateSetting(setting.key, !settings[setting.key])}
                className={`w-10 h-5 rounded-full transition-colors ${settings[setting.key] ? 'bg-sky-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${settings[setting.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}

          {/* Clear History */}
          <button
            onClick={() => setHistory([])}
            className="w-full py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
          >
            <i className="fa-solid fa-trash mr-2" />
            Clear Translation History
          </button>
        </div>
      )}
    </div>
  );
};

// Compact Translation Button
interface TranslateButtonProps {
  text: string;
  onTranslate: (translatedText: string) => void;
}

export const TranslateButton: React.FC<TranslateButtonProps> = ({ text, onTranslate }) => {
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async () => {
    setIsTranslating(true);
    // Simulate translation
    await new Promise(resolve => setTimeout(resolve, 500));
    onTranslate(`[Translated]: ${text}`);
    setIsTranslating(false);
  };

  return (
    <button
      onClick={handleTranslate}
      disabled={isTranslating}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded transition"
    >
      {isTranslating ? (
        <i className="fa-solid fa-circle-notch fa-spin" />
      ) : (
        <i className="fa-solid fa-language" />
      )}
      Translate
    </button>
  );
};
