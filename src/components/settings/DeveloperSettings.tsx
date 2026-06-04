import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ApiKeysPanel } from '../ApiKeys';
import { DesignPreview } from '../WarRoom/DesignPreview';
import { settingsService } from '../../services/settingsService';
import { supabase } from '../../services/supabase';
import { seedSampleDataService } from '../../services/seedSampleDataService';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { WebhooksCard } from './developer/WebhooksCard';
import { Book, Bot, Check, Code, Database, Key, Loader2, Palette, Save, Server, Mic, Map, Trash2 } from 'lucide-react';

export const DeveloperSettings: React.FC = () => {
  const [showApiKeysPanel, setShowApiKeysPanel] = useState(false);
  const [showDesignPreview, setShowDesignPreview] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  // Sample data — lets the operator preview the Decisions & Tasks surface
  // populated. Inserts are tagged with `metadata.is_sample` so cleanup
  // deletes only what we wrote.
  const { currentWorkspace } = useWorkspace();
  const [sampleBusy, setSampleBusy] = useState<'idle' | 'loading' | 'clearing'>('idle');
  const [sampleHasData, setSampleHasData] = useState<boolean | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);

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

  // Probe for existing sample rows whenever the workspace changes so the
  // Load button can disable itself rather than silently double-seed.
  useEffect(() => {
    if (!currentWorkspace?.id) {
      setSampleHasData(null);
      return;
    }
    let cancelled = false;
    seedSampleDataService
      .hasSampleData({ workspaceId: currentWorkspace.id })
      .then((has) => {
        if (!cancelled) setSampleHasData(has);
      })
      .catch(() => {
        if (!cancelled) setSampleHasData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentWorkspace?.id]);

  const handleLoadSample = useCallback(async () => {
    if (!currentWorkspace?.id) {
      setSampleError('No active workspace.');
      return;
    }
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) {
      setSampleError('Not signed in.');
      return;
    }
    setSampleBusy('loading');
    setSampleError(null);
    try {
      const result = await seedSampleDataService.loadSampleData({
        workspaceId: currentWorkspace.id,
        userId,
      });
      toast.success(
        `Seeded ${result.decisions} decision${result.decisions === 1 ? '' : 's'} and ${result.tasks} task${result.tasks === 1 ? '' : 's'}. Open Decisions & Tasks.`,
        { duration: 4500 }
      );
      setSampleHasData(true);
    } catch (err) {
      console.error('Failed to load sample data:', err);
      setSampleError(err instanceof Error ? err.message : 'Failed to load sample data.');
      toast.error('Sample data load failed. Check the console.');
    } finally {
      setSampleBusy('idle');
    }
  }, [currentWorkspace?.id]);

  const handleClearSample = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setSampleBusy('clearing');
    setSampleError(null);
    try {
      const result = await seedSampleDataService.clearSampleData({
        workspaceId: currentWorkspace.id,
      });
      toast.success(
        `Removed ${result.decisions} decision${result.decisions === 1 ? '' : 's'} and ${result.tasks} task${result.tasks === 1 ? '' : 's'}.`,
        { duration: 3500 }
      );
      setSampleHasData(false);
    } catch (err) {
      console.error('Failed to clear sample data:', err);
      setSampleError(err instanceof Error ? err.message : 'Failed to clear sample data.');
      toast.error('Sample data clear failed. Check the console.');
    } finally {
      setSampleBusy('idle');
    }
  }, [currentWorkspace?.id]);

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
              style={{ background: 'var(--pulse-rose-soft)', color: 'var(--pulse-rose)' }}
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
                <Mic className="text-zinc-500 dark:text-zinc-400" />
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
                    className="w-full px-4 py-2.5 bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-lg text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
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
                  className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {assemblyKeySaved ? <><Check /> Saved!</> : <><Save /> Save</>}
                </button>
              </div>
            </div>

            {/* ElevenLabs API Key */}
            <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <label className="text-sm font-medium dark:text-white text-zinc-900 flex items-center gap-2">
                <Bot className="text-zinc-500 dark:text-zinc-400" />
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
                    className="w-full px-4 py-2.5 bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-lg text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
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
                  className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {elevenLabsKeySaved ? <><Check /> Saved!</> : <><Save /> Save</>}
                </button>
              </div>
            </div>

            {/* Mapbox API Key */}
            <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <label className="text-sm font-medium dark:text-white text-zinc-900 flex items-center gap-2">
                <Map className="text-zinc-500 dark:text-zinc-400" />
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
                    className="w-full px-4 py-2.5 bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-lg text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
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
                  className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
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
              style={{ background: 'var(--pulse-rose-soft)', color: 'var(--pulse-rose)' }}
            >
              <Server />
            </div>
            <div className="integration-info" style={{ flex: 1 }}>
              <h4>Supabase Connection</h4>
              <p>Your database connection status</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-lg p-4">
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

        {/* Sample Data Card — dev-only seed for Decisions & Tasks. Inserts are
            tagged with metadata.is_sample so Clear deletes only seeded rows. */}
        <div className="integration-card">
          <div className="integration-header">
            <div
              className="integration-icon"
              style={{ background: 'var(--pulse-rose-soft)', color: 'var(--pulse-rose)' }}
            >
              <Database />
            </div>
            <div className="integration-info" style={{ flex: 1 }}>
              <h4>Sample Data — Decisions &amp; Tasks</h4>
              <p>Populate the current workspace so you can preview the surface populated. Cleanup is safe; only seeded rows are removed.</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Loads 3 decisions (Proposed, Voting with a vote, Decided) and 9 tasks across To Do, In Progress, In Review, Blocked, and Done. Includes one overdue and one decision-linked task so the Active view's groupings render.
            </p>

            <div className="flex flex-wrap gap-3 items-center">
              <button
                type="button"
                onClick={handleLoadSample}
                disabled={
                  !currentWorkspace?.id ||
                  sampleBusy !== 'idle' ||
                  sampleHasData === true
                }
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                title={
                  sampleHasData === true
                    ? 'Sample data already loaded — clear it first to reseed'
                    : 'Insert ~12 sample rows tagged metadata.is_sample'
                }
              >
                {sampleBusy === 'loading' ? (
                  <><Loader2 className="animate-spin" /> Loading...</>
                ) : sampleHasData === true ? (
                  <><Check /> Loaded</>
                ) : (
                  <><Database /> Load sample data</>
                )}
              </button>

              <button
                type="button"
                onClick={handleClearSample}
                disabled={
                  !currentWorkspace?.id ||
                  sampleBusy !== 'idle' ||
                  sampleHasData === false
                }
                className="px-4 py-2.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                title="Delete only rows tagged metadata.is_sample for this workspace"
              >
                {sampleBusy === 'clearing' ? (
                  <><Loader2 className="animate-spin" /> Clearing...</>
                ) : (
                  <><Trash2 /> Clear sample data</>
                )}
              </button>

              {currentWorkspace?.id ? (
                <span className="text-xs text-zinc-500 font-mono">
                  workspace: {currentWorkspace.id.slice(0, 8)}…
                </span>
              ) : (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  No active workspace — switch to one before loading.
                </span>
              )}
            </div>

            {sampleError && (
              <div className="text-xs text-red-600 dark:text-red-400 px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md">
                {sampleError}
              </div>
            )}
          </div>
        </div>

        {/* Design Preview Card */}
        <div className="integration-card">
          <div className="integration-header">
            <div
              className="integration-icon"
              style={{ background: 'var(--pulse-rose-soft)', color: 'var(--pulse-rose)' }}
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

        {/* Webhook Activity Card */}
        <WebhooksCard />

        {/* Public API Keys Card */}
        <div className="integration-card">
          <div className="integration-header">
            <div
              className="integration-icon"
              style={{ background: 'var(--pulse-rose-soft)', color: 'var(--pulse-rose)' }}
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
                className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
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
