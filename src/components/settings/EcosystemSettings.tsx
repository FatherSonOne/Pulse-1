// src/components/settings/EcosystemSettings.tsx
// Standalone Ecosystem Bridge settings panel — full light/dark mode support

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { entomateService } from '../../services/entomateService';
import type { EcosystemConfig, EcosystemEvent } from '../../types/messages';
import { ECOSYSTEM_APPS, ECOSYSTEM_APP_ORDER, type EcosystemAppName } from '../../config/ecosystem';
import { EcosystemAppLogo } from './EcosystemAppLogo';
import {
  Zap, Link2, Activity, Bot, Loader2, Check, X,
  ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
} from 'lucide-react';

interface EcosystemSettingsProps {
  userId: string;
}

export const EcosystemSettings: React.FC<EcosystemSettingsProps> = ({ userId }) => {
  const [ecosystemConfigs, setEcosystemConfigs] = useState<EcosystemConfig[]>([]);
  const [ecosystemEvents, setEcosystemEvents] = useState<EcosystemEvent[]>([]);
  const [ecosystemLoading, setEcosystemLoading] = useState(false);
  const [ecosystemEventsExpanded, setEcosystemEventsExpanded] = useState(false);
  const [newAppName, setNewAppName] = useState<EcosystemAppName>('entomate');
  const [newApiUrl, setNewApiUrl] = useState(ECOSYSTEM_APPS.entomate.inboundUrl);
  const [newBotUrl, setNewBotUrl] = useState(ECOSYSTEM_APPS.entomate.botUrl ?? '');
  const [newServiceToken, setNewServiceToken] = useState('');
  const [newInboundToken, setNewInboundToken] = useState('');
  const [ecosystemSaving, setEcosystemSaving] = useState(false);
  const [ecosystemTestStatus, setEcosystemTestStatus] = useState<Record<string, 'testing' | 'ok' | 'error'>>({});
  const [ecosystemSetupStatus, setEcosystemSetupStatus] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [expandedConfigTokens, setExpandedConfigTokens] = useState<string | null>(null);

  const generateToken = (): string => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedToken(label);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  useEffect(() => { loadEcosystemData(); }, []);

  const loadEcosystemData = async () => {
    setEcosystemLoading(true);
    try {
      const { data: configs } = await supabase
        .from('ecosystem_config').select('*').order('app_name');
      setEcosystemConfigs(configs || []);

      const { data: events } = await supabase
        .from('ecosystem_events').select('*')
        .order('created_at', { ascending: false }).limit(20);
      setEcosystemEvents(events || []);
    } catch (err) {
      console.error('Failed to load ecosystem data:', err);
    } finally {
      setEcosystemLoading(false);
    }
  };

  const saveEcosystemConfig = async () => {
    if (!newApiUrl || !newServiceToken || !newInboundToken) return;
    setEcosystemSaving(true);
    try {
      const { error } = await supabase.from('ecosystem_config').upsert({
        app_name: newAppName,
        api_url: newApiUrl,
        bot_url: newBotUrl || null,
        service_token: newServiceToken,
        inbound_token: newInboundToken,
        enabled: true,
        features: { bot_messages: true, sync_tasks: true, notifications: true },
      }, { onConflict: 'app_name' });
      if (error) throw error;
      setNewServiceToken('');
      setNewInboundToken('');
      await loadEcosystemData();
    } catch (err) {
      console.error('Failed to save ecosystem config:', err);
    } finally {
      setEcosystemSaving(false);
    }
  };

  const testEcosystemConnection = async (config: EcosystemConfig) => {
    setEcosystemTestStatus(s => ({ ...s, [config.app_name]: 'testing' }));
    try {
      // Call Pulse's own edge function with the app's inbound_token
      // The function validates X-Ecosystem-Token against ecosystem_config.inbound_token
      const { error } = await supabase.functions.invoke('ecosystem-inbound', {
        body: {
          id: crypto.randomUUID(),
          source: config.app_name,
          timestamp: new Date().toISOString(),
          serviceToken: config.inbound_token,
          eventType: 'heartbeat',
          data: {},
        },
        headers: {
          'X-Ecosystem-Token': config.inbound_token,
        },
      });
      setEcosystemTestStatus(s => ({
        ...s,
        [config.app_name]: error ? 'error' : 'ok',
      }));
    } catch {
      setEcosystemTestStatus(s => ({ ...s, [config.app_name]: 'error' }));
    }
  };

  const toggleEcosystemApp = async (config: EcosystemConfig) => {
    const { error } = await supabase
      .from('ecosystem_config').update({ enabled: !config.enabled }).eq('id', config.id);
    if (!error) await loadEcosystemData();
  };

  const setupWorkspaceBot = async (workspaceId: string) => {
    setEcosystemSetupStatus('Setting up bot channels...');
    try {
      const result = await entomateService.setupWorkspace(workspaceId);
      setEcosystemSetupStatus(
        `Created: ${result.created.join(', ') || 'none'} | Already existed: ${result.existing.join(', ') || 'none'}`
      );
    } catch (err) {
      setEcosystemSetupStatus('Setup failed — check console');
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-rose-500 dark:text-rose-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              Ecosystem Bridge
              <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                QNTMECOS
              </span>
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Connect Logos Vision, Pulse &amp; Entomate
            </p>
          </div>
          {ecosystemLoading && <Loader2 className="w-4 h-4 text-rose-500 dark:text-rose-400 animate-spin ml-auto" />}
        </div>
      </div>

      {/* ── TRIFECTA OVERVIEW ── */}
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] dark:bg-rose-500/5 p-5 space-y-4">
        <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          The QNTMECOS Trifecta
        </div>

        {/* 3-app grid */}
        <div className="grid grid-cols-3 gap-2">
          {ECOSYSTEM_APP_ORDER.map((appKey) => {
            const appMeta = ECOSYSTEM_APPS[appKey];
            const config = ecosystemConfigs.find(c => c.app_name === appKey);
            const isCurrentApp = appKey === 'pulse';
            const isConnected = !!config;
            const isEnabled = config?.enabled ?? false;

            return (
              <div key={appKey} className={`rounded-xl p-3 flex flex-col items-center gap-2 border transition-all ${
                isCurrentApp
                  ? 'border-rose-500/30 bg-rose-500/5'
                  : isEnabled
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : isConnected
                  ? 'border-zinc-300/60 dark:border-zinc-600/50 bg-zinc-50 dark:bg-white/[0.02]'
                  : 'border-zinc-200 dark:border-zinc-700/40 bg-zinc-50/50 dark:bg-zinc-950/40'
              }`}>
                <EcosystemAppLogo app={appKey} size={40} />
                <div className="text-center">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-white leading-tight">
                    {appMeta.name}
                    {isCurrentApp && (
                      <span className="ml-1 text-[9px] text-rose-500 dark:text-rose-400 font-normal">you</span>
                    )}
                  </div>
                  <div className="text-[9px] text-zinc-500 leading-tight mt-0.5">
                    {appMeta.tagline}
                  </div>
                </div>
                <div className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                  isCurrentApp
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                    : isEnabled
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : isConnected
                    ? 'bg-zinc-200 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400'
                    : 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-600'
                }`}>
                  {isCurrentApp ? 'Active' : isEnabled ? 'Connected' : isConnected ? 'Disabled' : 'Not set up'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Connection line indicator */}
        <div className="flex items-center justify-center gap-1 px-2">
          {ECOSYSTEM_APP_ORDER.map((appKey, idx) => {
            const config = ecosystemConfigs.find(c => c.app_name === appKey);
            const isActive = appKey === 'pulse' || !!config?.enabled;
            return (
              <React.Fragment key={appKey}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                  style={isActive ? { boxShadow: '0 0 6px var(--pulse-rose-glow)' } : {}} />
                {idx < ECOSYSTEM_APP_ORDER.length - 1 && (
                  <div className="flex-1 h-px relative overflow-hidden">
                    <div className={`h-full ${config?.enabled
                      ? 'bg-gradient-to-r from-rose-500/60 to-rose-500/60'
                      : 'bg-zinc-200 dark:bg-zinc-700/50'
                    }`} />
                    {config?.enabled && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                        style={{ animation: 'slideRight 2s linear infinite' }} />
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="text-xs text-zinc-500 dark:text-zinc-500 text-center">
          {ecosystemConfigs.filter(c => c.enabled).length} of {ecosystemConfigs.length} connections active
        </div>
      </div>

      {/* ── EXISTING CONNECTIONS ── */}
      {ecosystemConfigs.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Connections</div>
          {ECOSYSTEM_APP_ORDER
            .filter(k => k !== 'pulse')
            .map(appKey => {
              const config = ecosystemConfigs.find(c => c.app_name === appKey);
              if (!config) return null;
              const appMeta = ECOSYSTEM_APPS[appKey];
              const testStatus = ecosystemTestStatus[config.app_name];
              return (
                <div key={config.id} className="rounded-xl bg-[var(--pulse-surface)] border border-[var(--pulse-border)] overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    <EcosystemAppLogo app={appKey} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-white">{appMeta.name}</span>
                        <span className={`w-2 h-2 rounded-full ${config.enabled ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'}`}
                          style={config.enabled ? { boxShadow: '0 0 4px var(--pulse-tone-positive-glow)' } : {}} />
                      </div>
                      <div className="text-[10px] text-rose-600/70 dark:text-rose-300/60 font-mono mt-0.5 break-all leading-relaxed">Inbound: {config.api_url}</div>
                      <div className="text-[10px] font-mono mt-0.5 break-all leading-relaxed">
                        {config.bot_url ? (
                          <span className="text-rose-600/70 dark:text-rose-300/60">Bot API: {config.bot_url}</span>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-600">Bot API: Not configured</span>
                        )}
                      </div>
                      {config.last_heartbeat ? (
                        <div className={`text-[10px] mt-0.5 ${
                          Date.now() - new Date(config.last_heartbeat).getTime() > 30 * 60 * 1000
                            ? 'text-amber-500'
                            : 'text-emerald-500'
                        }`}>
                          Last ping: {new Date(config.last_heartbeat).toLocaleString()}
                        </div>
                      ) : config.enabled ? (
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5">No heartbeat yet</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button type="button"
                        onClick={() => setExpandedConfigTokens(expandedConfigTokens === config.id ? null : config.id)}
                        className="px-2 py-1 rounded-lg text-xs bg-[var(--pulse-surface)] hover:bg-[var(--pulse-surface-raised)] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-[var(--pulse-border)] transition">
                        Tokens
                      </button>
                      <button type="button"
                        onClick={() => testEcosystemConnection(config)}
                        disabled={testStatus === 'testing'}
                        className="px-2 py-1 rounded-lg text-xs bg-[var(--pulse-surface)] hover:bg-[var(--pulse-surface-raised)] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-[var(--pulse-border)] transition flex items-center gap-1">
                        {testStatus === 'testing' ? <Loader2 className="w-3 h-3 animate-spin" />
                          : testStatus === 'ok' ? <Check className="w-3 h-3 text-emerald-500" />
                          : testStatus === 'error' ? <X className="w-3 h-3 text-rose-500" />
                          : <Activity className="w-3 h-3" />}
                        Test
                      </button>
                      <button type="button" onClick={() => toggleEcosystemApp(config)}
                        className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
                        title={config.enabled ? 'Disable' : 'Enable'}>
                        {config.enabled
                          ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                          : <ToggleLeft className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {expandedConfigTokens === config.id && (
                    <div className="border-t border-[var(--pulse-border)] px-4 py-3 bg-[var(--pulse-surface-raised)] space-y-2">
                      <p className="text-[10px] text-zinc-500 mb-2">
                        Copy these into <span className="text-zinc-900 dark:text-white font-medium">{appMeta.name}</span>'s{' '}
                        <code className="text-rose-600 dark:text-rose-300">ecosystem_config</code> table — values are <strong>swapped</strong>.
                      </p>
                      {[
                        { label: `Pulse → ${appMeta.name}`, value: config.service_token, hint: `paste as inbound_token in ${appMeta.name}`, key: `svc-${config.id}` },
                        { label: `${appMeta.name} → Pulse`, value: config.inbound_token, hint: `paste as service_token in ${appMeta.name}`, key: `inb-${config.id}` },
                      ].map(({ label, value, hint, key }) => (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-zinc-500">{label}</span>
                            <button type="button" onClick={() => copyToClipboard(value, key)}
                              className="text-[10px] px-2 py-0.5 rounded bg-[var(--pulse-surface)] hover:bg-[var(--pulse-surface-raised)] text-zinc-600 dark:text-zinc-400 border border-[var(--pulse-border)] transition">
                              {copiedToken === key ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                          <div className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400 bg-[var(--pulse-surface)] rounded px-2 py-1.5 truncate border border-[var(--pulse-border)]">
                            {value}
                          </div>
                          <p className="text-[9px] text-zinc-400 dark:text-zinc-600 mt-0.5">→ {hint}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* ── ADD CONNECTION ── */}
      <div className="rounded-xl bg-[var(--pulse-surface)] border border-[var(--pulse-border)] p-4 space-y-3">
        <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <Link2 className="w-3 h-3" />
          Add Connection
        </div>

        {/* App selector */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">App</label>
          <select
            value={newAppName}
            onChange={(e) => {
              const app = e.target.value as EcosystemAppName;
              setNewAppName(app);
              setNewApiUrl(ECOSYSTEM_APPS[app].inboundUrl);
              setNewBotUrl(ECOSYSTEM_APPS[app].botUrl ?? '');
            }}
            title="Select app to connect"
            aria-label="Select app to connect"
            className="w-full px-3 py-2 bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-rose-500 transition"
          >
            <option value="entomate">Entomate</option>
            <option value="logos_vision">Logos Vision</option>
          </select>
        </div>

        {/* Inbound URL — full width */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">
            Inbound URL
            <span className="ml-1.5 text-rose-500 dark:text-rose-400 opacity-70">(auto-filled)</span>
          </label>
          <input
            type="url"
            value={newApiUrl}
            readOnly
            title="Inbound URL for selected app"
            placeholder="Auto-filled from app selection"
            aria-label="Inbound URL for selected app"
            className="w-full px-3 py-2 bg-[var(--pulse-surface-raised)] border border-rose-500/20 rounded-lg text-xs text-rose-600 dark:text-rose-300 font-mono cursor-default select-all"
          />
        </div>

        {/* Bot URL — optional, editable */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">
            Bot URL
            <span className="ml-1.5 text-zinc-400 dark:text-zinc-600 opacity-70">(optional)</span>
          </label>
          <input
            type="url"
            value={newBotUrl}
            onChange={(e) => setNewBotUrl(e.target.value)}
            placeholder="No bot API configured for this app"
            title="Bot API URL for selected app"
            aria-label="Bot API URL for selected app"
            className="w-full px-3 py-2 bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-lg text-xs text-zinc-700 dark:text-zinc-300 font-mono placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-rose-500 transition"
          />
        </div>

        {/* Token how-it-works hint */}
        <div className="rounded-lg bg-rose-500/[0.07] dark:bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <span className="text-rose-600 dark:text-rose-300 font-semibold block mb-1">How tokens work:</span>
          <span className="font-semibold text-zinc-800 dark:text-zinc-300">Service token</span> = what Pulse sends when calling <em>their</em> API.
          Paste into the other app's <code className="text-rose-600 dark:text-rose-300">inbound_token</code>.<br />
          <span className="font-semibold text-zinc-800 dark:text-zinc-300">Inbound token</span> = what they send when calling Pulse.
          Paste into the other app's <code className="text-rose-600 dark:text-rose-300">service_token</code>.
        </div>

        {/* Service Token */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-zinc-500">Service Token — Pulse → {newAppName.replace('_', ' ')}</label>
            <div className="flex gap-1">
              <button type="button" onClick={() => setNewServiceToken(generateToken())}
                className="text-[10px] px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 border border-rose-500/25 transition">
                Generate
              </button>
              {newServiceToken && (
                <button type="button" onClick={() => copyToClipboard(newServiceToken, 'service')}
                  className="text-[10px] px-2 py-0.5 rounded bg-[var(--pulse-surface)] hover:bg-[var(--pulse-surface-raised)] text-zinc-600 dark:text-zinc-400 border border-[var(--pulse-border)] transition">
                  {copiedToken === 'service' ? '✓ Copied' : 'Copy'}
                </button>
              )}
            </div>
          </div>
          <input
            type="text"
            value={newServiceToken}
            onChange={(e) => setNewServiceToken(e.target.value)}
            placeholder="Click Generate or paste existing token"
            className="w-full px-3 py-2 bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-lg text-xs text-zinc-700 dark:text-zinc-300 font-mono placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-rose-500 transition"
          />
          {newServiceToken && (
            <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">
              → Paste as <code>inbound_token</code> in {newAppName.replace('_', ' ')}'s ecosystem_config
            </p>
          )}
        </div>

        {/* Inbound Token */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-zinc-500">Inbound Token — {newAppName.replace('_', ' ')} → Pulse</label>
            <div className="flex gap-1">
              <button type="button" onClick={() => setNewInboundToken(generateToken())}
                className="text-[10px] px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 border border-rose-500/25 transition">
                Generate
              </button>
              {newInboundToken && (
                <button type="button" onClick={() => copyToClipboard(newInboundToken, 'inbound')}
                  className="text-[10px] px-2 py-0.5 rounded bg-[var(--pulse-surface)] hover:bg-[var(--pulse-surface-raised)] text-zinc-600 dark:text-zinc-400 border border-[var(--pulse-border)] transition">
                  {copiedToken === 'inbound' ? '✓ Copied' : 'Copy'}
                </button>
              )}
            </div>
          </div>
          <input
            type="text"
            value={newInboundToken}
            onChange={(e) => setNewInboundToken(e.target.value)}
            placeholder="Click Generate or paste existing token"
            className="w-full px-3 py-2 bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-lg text-xs text-zinc-700 dark:text-zinc-300 font-mono placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-rose-500 transition"
          />
          {newInboundToken && (
            <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">
              → Paste as <code>service_token</code> in {newAppName.replace('_', ' ')}'s ecosystem_config
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={saveEcosystemConfig}
          disabled={ecosystemSaving || !newApiUrl || !newServiceToken || !newInboundToken}
          className="w-full py-2 rounded-lg text-sm font-semibold bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition flex items-center justify-center gap-2"
        >
          {ecosystemSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          {ecosystemSaving ? 'Saving...' : 'Save Connection'}
        </button>
      </div>

      {/* ── BOT CHANNEL SETUP ── */}
      {ecosystemConfigs.some(c => c.app_name === 'entomate' && c.enabled) && (
        <div className="rounded-xl bg-rose-500/[0.07] dark:bg-rose-500/10 border border-rose-500/20 p-4 space-y-3">
          <div className="text-xs font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
            <Bot className="w-3 h-3" />
            Bot Channel Setup
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Creates <code className="text-rose-600 dark:text-rose-300">#entomate-meetings</code>,{' '}
            <code className="text-rose-600 dark:text-rose-300">#entomate-tasks</code>,{' '}
            <code className="text-rose-600 dark:text-rose-300">#entomate-alerts</code> in the default workspace.
          </p>
          <button
            type="button"
            onClick={() => setupWorkspaceBot(userId)}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 border border-rose-500/25 transition flex items-center gap-2"
          >
            <Bot className="w-3 h-3" />
            Setup Entomate Channels
          </button>
          {ecosystemSetupStatus && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{ecosystemSetupStatus}</p>
          )}
        </div>
      )}

      {/* ── RECENT EVENTS ── */}
      <div>
        <button
          type="button"
          onClick={() => setEcosystemEventsExpanded(e => !e)}
          className="w-full flex items-center justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-200 transition mb-2"
        >
          <span className="flex items-center gap-1.5"><Activity className="w-3 h-3" /> Recent Events</span>
          {ecosystemEventsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {ecosystemEventsExpanded && (
          <div className="rounded-xl bg-[var(--pulse-surface)] border border-[var(--pulse-border)] overflow-hidden">
            {ecosystemEvents.length === 0 ? (
              <div className="text-xs text-zinc-400 text-center py-4">No events yet</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-white/[0.06] text-zinc-500">
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Source</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {ecosystemEvents.map(ev => (
                    <tr key={ev.id} className="border-b border-zinc-100 dark:border-white/[0.04] hover:bg-zinc-100/50 dark:hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300 font-mono">{ev.event_type}</td>
                      <td className="px-3 py-2 text-zinc-500 capitalize">{ev.source}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          ev.status === 'processed' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' :
                          ev.status === 'failed' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400' :
                          'bg-zinc-200 dark:bg-zinc-500/20 text-zinc-600 dark:text-zinc-400'
                        }`}>{ev.status}</span>
                      </td>
                      <td className="px-3 py-2 text-zinc-400 dark:text-zinc-600">
                        {new Date(ev.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EcosystemSettings;
