// src/components/settings/EcosystemSettings.tsx
// Standalone Ecosystem Bridge settings panel — full light/dark mode support

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { entomateService } from '../../services/entomateService';
import type { EcosystemConfig, EcosystemEvent } from '../../types/messages';
import { ECOSYSTEM_APPS, ECOSYSTEM_APP_ORDER, type EcosystemAppName } from '../../config/ecosystem';
import { EcosystemAppLogo } from './EcosystemAppLogo';
import {
  Zap, Activity, Bot, Loader2,
  ChevronDown, ChevronUp,
} from 'lucide-react';

interface EcosystemSettingsProps {
  userId: string;
}

export const EcosystemSettings: React.FC<EcosystemSettingsProps> = ({ userId }) => {
  const [ecosystemConfigs, setEcosystemConfigs] = useState<Omit<EcosystemConfig, 'service_token' | 'inbound_token' | 'features'>[]>([]);
  const [ecosystemEvents, setEcosystemEvents] = useState<EcosystemEvent[]>([]);
  const [ecosystemLoading, setEcosystemLoading] = useState(false);
  const [ecosystemEventsExpanded, setEcosystemEventsExpanded] = useState(false);
  const [ecosystemSetupStatus, setEcosystemSetupStatus] = useState<string | null>(null);

  useEffect(() => { loadEcosystemData(); }, []);

  const loadEcosystemData = async () => {
    setEcosystemLoading(true);
    try {
      const { data: configs } = await supabase
        // Tokens and features are not readable from the browser (EAI-08).
        .from('ecosystem_config')
        .select('id, app_name, api_url, bot_url, enabled, last_heartbeat, created_at, updated_at')
        .order('app_name');
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
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/3 dark:bg-rose-500/5 p-5 space-y-4">
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
                  ? 'border-zinc-300/60 dark:border-zinc-600/50 bg-zinc-50 dark:bg-white/2'
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
                <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                  style={isActive ? { boxShadow: '0 0 6px var(--pulse-rose-glow)' } : {}} />
                {idx < ECOSYSTEM_APP_ORDER.length - 1 && (
                  <div className="flex-1 h-px relative overflow-hidden">
                    <div className={`h-full ${config?.enabled
                      ? 'bg-linear-to-r from-rose-500/60 to-rose-500/60'
                      : 'bg-zinc-200 dark:bg-zinc-700/50'
                    }`} />
                    {config?.enabled && (
                      <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/40 to-transparent"
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
              return (
                <div key={config.id} className="rounded-xl bg-(--pulse-surface) border border-(--pulse-border) overflow-hidden">
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
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* ── MANAGED CONNECTIONS (EAI-08) ── */}
      <div className="rounded-xl bg-(--pulse-surface) border border-(--pulse-border) p-4 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <span className="font-semibold text-zinc-900 dark:text-white">Connections are managed by a platform admin.</span>{' '}
        Bridge tokens are secrets, so this page does not show or change them. Each app checks the
        connection every 15 minutes; the last ping above shows the result.
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
          <div className="rounded-xl bg-(--pulse-surface) border border-(--pulse-border) overflow-hidden">
            {ecosystemEvents.length === 0 ? (
              <div className="text-xs text-zinc-400 text-center py-4">No events yet</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-white/6 text-zinc-500">
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Source</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {ecosystemEvents.map(ev => (
                    <tr key={ev.id} className="border-b border-zinc-100 dark:border-white/4 hover:bg-zinc-100/50 dark:hover:bg-white/2">
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
