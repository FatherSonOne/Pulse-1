import React, { useState, useEffect } from 'react';
import { ApiKeysPanel } from '../ApiKeys';
import { DesignPreview } from '../WarRoom/DesignPreview';
import { settingsService } from '../../services/settingsService';
import { supabase } from '../../services/supabase';
import { Book, Bot, Check, Code, Key, Palette, Save, Server, Mic, Map } from 'lucide-react';

export const DeveloperSettings: React.FC = () => {
  const [showApiKeysPanel, setShowApiKeysPanel] = useState(false);
  const [showDesignPreview, setShowDesignPreview] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { error } = await supabase.auth.getSession();
        setSupabaseStatus(error ? 'error' : 'connected');
      } catch {
        setSupabaseStatus('error');
      }
    };
    checkConnection();
  }, []);

  // Non-AI API key state — AI providers (Gemini/Claude/OpenAI) are platform-managed
  // via the ai-router edge function and no longer require user-supplied keys.
  const [assemblyApiKey, setAssemblyApiKey] = useState(() => localStorage.getItem('assemblyai_api_key') || '');
  const [showAssemblyKey, setShowAssemblyKey] = useState(false);
  const [assemblyKeySaved, setAssemblyKeySaved] = useState(false);

  const [elevenLabsApiKey, setElevenLabsApiKey] = useState(() => localStorage.getItem('elevenlabs_api_key') || '');
  const [showElevenLabsKey, setShowElevenLabsKey] = useState(false);
  const [elevenLabsKeySaved, setElevenLabsKeySaved] = useState(false);

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
              <p>Configure API keys for third-party services</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* AssemblyAI API Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-white text-zinc-900 flex items-center gap-2">
                <Mic className="text-emerald-500" />
                AssemblyAI API Key
                <span className="text-xs text-zinc-500 font-normal">(for transcription)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showAssemblyKey ? 'text' : 'password'}
                    value={assemblyApiKey}
                    onChange={(e) => { setAssemblyApiKey(e.target.value); setAssemblyKeySaved(false); }}
                    placeholder="Enter AssemblyAI key..."
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                  />
                  <button
                    onClick={() => setShowAssemblyKey(!showAssemblyKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    type="button"
                    title={showAssemblyKey ? 'Hide key' : 'Show key'}
                  >
                    <i className={`fa-solid ${showAssemblyKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    settingsService.set('assemblyaiApiKey', assemblyApiKey);
                    setAssemblyKeySaved(true);
                    setTimeout(() => setAssemblyKeySaved(false), 3000);
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {assemblyKeySaved ? <><Check /> Saved!</> : <><Save /> Save</>}
                </button>
              </div>
            </div>

            {/* ElevenLabs API Key */}
            <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <label className="text-sm font-medium dark:text-white text-zinc-900 flex items-center gap-2">
                <Bot className="text-purple-500" />
                ElevenLabs API Key
                <span className="text-xs text-zinc-500 font-normal">(for voice synthesis)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showElevenLabsKey ? 'text' : 'password'}
                    value={elevenLabsApiKey}
                    onChange={(e) => { setElevenLabsApiKey(e.target.value); setElevenLabsKeySaved(false); }}
                    placeholder="Enter ElevenLabs key..."
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30"
                  />
                  <button
                    onClick={() => setShowElevenLabsKey(!showElevenLabsKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    type="button"
                    title={showElevenLabsKey ? 'Hide key' : 'Show key'}
                  >
                    <i className={`fa-solid ${showElevenLabsKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    settingsService.set('elevenlabsApiKey', elevenLabsApiKey);
                    setElevenLabsKeySaved(true);
                    setTimeout(() => setElevenLabsKeySaved(false), 3000);
                  }}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {elevenLabsKeySaved ? <><Check /> Saved!</> : <><Save /> Save</>}
                </button>
              </div>
            </div>

            {/* Mapbox API Key */}
            <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <label className="text-sm font-medium dark:text-white text-zinc-900 flex items-center gap-2">
                <Map className="text-indigo-500" />
                Mapbox API Key
                <span className="text-xs text-zinc-500 font-normal">(for maps & geocoding)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showMapboxKey ? 'text' : 'password'}
                    value={mapboxApiKey}
                    onChange={(e) => { setMapboxApiKey(e.target.value); setMapboxKeySaved(false); }}
                    placeholder="pk.eyJ1..."
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                  />
                  <button
                    onClick={() => setShowMapboxKey(!showMapboxKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    type="button"
                    title={showMapboxKey ? 'Hide key' : 'Show key'}
                  >
                    <i className={`fa-solid ${showMapboxKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    settingsService.set('mapboxApiKey', mapboxApiKey);
                    setMapboxKeySaved(true);
                    setTimeout(() => setMapboxKeySaved(false), 3000);
                  }}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {mapboxKeySaved ? <><Check /> Saved!</> : <><Save /> Save</>}
                </button>
              </div>
            </div>
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
                <div className={`w-3 h-3 rounded-full ${
                  supabaseStatus === 'connected' ? 'bg-emerald-500' :
                  supabaseStatus === 'error' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'
                }`}></div>
                <span className="text-sm dark:text-white text-zinc-900">
                  {supabaseStatus === 'connected' ? 'Connected to Supabase' :
                   supabaseStatus === 'error' ? 'Supabase connection failed' : 'Checking connection...'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                {supabaseStatus === 'error'
                  ? 'Check your .env file for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
                  : 'Environment variables are configured and connection is active.'}
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
