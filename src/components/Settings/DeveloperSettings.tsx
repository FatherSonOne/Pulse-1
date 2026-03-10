import React, { useState } from 'react';
import { ApiKeysPanel } from '../ApiKeys';
import { DesignPreview } from '../WarRoom/DesignPreview';
import { Book, Bot, Check, Code, Key, Palette, Save, Server, Sparkles } from 'lucide-react';

export const DeveloperSettings: React.FC = () => {
  const [showApiKeysPanel, setShowApiKeysPanel] = useState(false);
  const [showDesignPreview, setShowDesignPreview] = useState(false);

  // API key state — initialized from localStorage (same pattern as Settings.tsx)
  const [openaiApiKey, setOpenaiApiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [openaiKeySaved, setOpenaiKeySaved] = useState(false);

  const [claudeApiKey, setClaudeApiKey] = useState(() => localStorage.getItem('claude_api_key') || '');
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [claudeKeySaved, setClaudeKeySaved] = useState(false);

  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);

  const [assemblyApiKey, setAssemblyApiKey] = useState(() => localStorage.getItem('assemblyai_api_key') || '');
  const [showAssemblyKey, setShowAssemblyKey] = useState(false);
  const [assemblyKeySaved, setAssemblyKeySaved] = useState(false);

  const [elevenLabsApiKey, setElevenLabsApiKey] = useState(() => localStorage.getItem('elevenlabs_api_key') || '');
  const [showElevenLabsKey, setShowElevenLabsKey] = useState(false);
  const [elevenLabsKeySaved, setElevenLabsKeySaved] = useState(false);

  const [perplexityApiKey, setPerplexityApiKey] = useState(() => localStorage.getItem('perplexity_api_key') || '');
  const [showPerplexityKey, setShowPerplexityKey] = useState(false);
  const [perplexityKeySaved, setPerplexityKeySaved] = useState(false);

  const [mapboxApiKey, setMapboxApiKey] = useState(() => localStorage.getItem('mapbox_api_key') || '');
  const [showMapboxKey, setShowMapboxKey] = useState(false);
  const [mapboxKeySaved, setMapboxKeySaved] = useState(false);

  return (
    <>
      <div className="space-y-8 animate-slide-up">
        <div className="section-header">
          <h3>
            <Code /> Developer Tools
          </h3>
          <p>Tools for development, testing, and debugging.</p>
        </div>

        {/* API Keys Card */}
        <div className="integration-card">
          <div className="integration-header">
            <div
              className="integration-icon"
              style={{ background: 'linear-gradient(135deg, #10B981, #06B6D4)' }}
            >
              <Key />
            </div>
            <div className="integration-info" style={{ flex: 1 }}>
              <h4>API Keys</h4>
              <p>Configure API keys for AI services</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* OpenAI API Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-white text-zinc-900 flex items-center gap-2">
                <Bot className="text-cyan-500" />
                OpenAI API Key
                <span className="text-xs text-zinc-500 font-normal">(for Voice Agents)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showOpenaiKey ? 'text' : 'password'}
                    value={openaiApiKey}
                    onChange={(e) => {
                      setOpenaiApiKey(e.target.value);
                      setOpenaiKeySaved(false);
                    }}
                    placeholder="sk-proj-..."
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                  />
                  <button
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    type="button"
                  >
                    <i className={`fa-solid ${showOpenaiKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                <button
                  onClick={() => {
                    localStorage.setItem('openai_api_key', openaiApiKey);
                    setOpenaiKeySaved(true);
                    setTimeout(() => setOpenaiKeySaved(false), 3000);
                  }}
                  className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {openaiKeySaved ? (
                    <>
                      <Check />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Save />
                      Save
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                Required for OpenAI Realtime Voice Agents in the War Room. Get your key from{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-500 hover:underline"
                >
                  platform.openai.com/api-keys
                </a>
              </p>
            </div>

            {/* Status indicator */}
            {openaiApiKey && (
              <div className="flex items-center gap-2 text-sm">
                <div
                  className={`w-2 h-2 rounded-full ${
                    openaiApiKey.startsWith('sk-') ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                ></div>
                <span className="text-zinc-500">
                  {openaiApiKey.startsWith('sk-')
                    ? 'API key format looks valid'
                    : 'API key should start with "sk-"'}
                </span>
              </div>
            )}

            {/* Gemini API Key */}
            <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <label className="text-sm font-medium dark:text-white text-zinc-900 flex items-center gap-2">
                <Sparkles className="text-blue-500" />
                Gemini API Key
                <span className="text-xs text-zinc-500 font-normal">
                  (for AI features & briefings)
                </span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={(e) => {
                      setGeminiApiKey(e.target.value);
                      setGeminiKeySaved(false);
                    }}
                    placeholder="AIza..."
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                  />
                  <button
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    type="button"
                  >
                    <i className={`fa-solid ${showGeminiKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                <button
                  onClick={() => {
                    localStorage.setItem('gemini_api_key', geminiApiKey);
                    setGeminiKeySaved(true);
                    setTimeout(() => setGeminiKeySaved(false), 3000);
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {geminiKeySaved ? (
                    <>
                      <Check />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Save />
                      Save
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                Required for daily briefings, smart replies, and AI insights. Get your key from{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  aistudio.google.com/apikey
                </a>
              </p>
            </div>

            {/* Gemini Status indicator */}
            {geminiApiKey && (
              <div className="flex items-center gap-2 text-sm">
                <div
                  className={`w-2 h-2 rounded-full ${
                    geminiApiKey.startsWith('AIza') ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                ></div>
                <span className="text-zinc-500">
                  {geminiApiKey.startsWith('AIza')
                    ? 'API key format looks valid'
                    : 'API key should start with "AIza"'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Supabase Connection Info */}
        <div className="integration-card">
          <div className="integration-header">
            <div
              className="integration-icon"
              style={{ background: 'linear-gradient(135deg, #3ECF8E, #1E9E6B)' }}
            >
              <Server />
            </div>
            <div className="integration-info" style={{ flex: 1 }}>
              <h4>Supabase Connection</h4>
              <p>Your database connection status</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-sm dark:text-white text-zinc-900">
                  Connected to Supabase
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Environment variables are configured. Check your .env file for VITE_SUPABASE_URL
                and VITE_SUPABASE_ANON_KEY.
              </p>
            </div>
          </div>
        </div>

        {/* Design Preview Card */}
        <div className="integration-card">
          <div className="integration-header">
            <div
              className="integration-icon"
              style={{ background: 'linear-gradient(135deg, #EC4899, #F43F5E)' }}
            >
              <Palette />
            </div>
            <div className="integration-info" style={{ flex: 1 }}>
              <h4>Design Preview</h4>
              <p>Preview and explore different design styles</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Explore different design aesthetics including minimal, glassmorphism, neumorphism,
              claymorphism, brutalism, and flat design styles.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowDesignPreview(true)}
                className="nothing-btn nothing-btn-primary"
              >
                <Palette />
                Open Design Preview
              </button>
            </div>
          </div>
        </div>

        {/* Public API Keys Card */}
        <div className="integration-card">
          <div className="integration-header">
            <div
              className="integration-icon"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}
            >
              <Key />
            </div>
            <div className="integration-info" style={{ flex: 1 }}>
              <h4>Public API</h4>
              <p>Generate API keys for programmatic access</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Create API keys to access Pulse programmatically. Build integrations, automate
              workflows, or connect the browser extension.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowApiKeysPanel(true)}
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Key />
                Manage API Keys
              </button>
              <a
                href="/docs/api"
                target="_blank"
                className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Book />
                API Documentation
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Design Preview Modal */}
      <DesignPreview isOpen={showDesignPreview} onClose={() => setShowDesignPreview(false)} />

      {/* API Keys Panel */}
      {showApiKeysPanel && <ApiKeysPanel onClose={() => setShowApiKeysPanel(false)} />}
    </>
  );
};
