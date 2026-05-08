import React, { useEffect, useState } from 'react';
import { Webhook, RefreshCcw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { webhookService, WebhookLogEntry } from '../../../services/webhookService';

interface WebhookStats {
  totalReceived: number;
  totalProcessed: number;
  totalFailed: number;
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const statusStyles: Record<WebhookLogEntry['status'], string> = {
  received: 'text-blue-500 bg-blue-500/10',
  processed: 'text-emerald-500 bg-emerald-500/10',
  failed: 'text-red-500 bg-red-500/10',
  ignored: 'text-zinc-500 bg-zinc-500/10',
};

export const WebhooksCard: React.FC = () => {
  const [stats, setStats] = useState<WebhookStats>({ totalReceived: 0, totalProcessed: 0, totalFailed: 0 });
  const [logs, setLogs] = useState<WebhookLogEntry[]>([]);

  const refresh = () => {
    const s = webhookService.getStats();
    setStats({ totalReceived: s.totalReceived, totalProcessed: s.totalProcessed, totalFailed: s.totalFailed });
    setLogs(webhookService.getLogs({ limit: 25 }));
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="integration-card">
      <div className="integration-header">
        <div
          className="integration-icon"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
        >
          <Webhook />
        </div>
        <div className="integration-info" style={{ flex: 1 }}>
          <h4>Webhook Activity</h4>
          <p>Recent incoming events and processing status</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
          title="Refresh"
        >
          <RefreshCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <Clock className="w-3.5 h-3.5" /> Received
          </div>
          <div className="text-2xl font-semibold text-zinc-900 dark:text-white tabular-nums">{stats.totalReceived}</div>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Processed
          </div>
          <div className="text-2xl font-semibold text-zinc-900 dark:text-white tabular-nums">{stats.totalProcessed}</div>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" /> Failed
          </div>
          <div className={`text-2xl font-semibold tabular-nums ${stats.totalFailed > 0 ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>
            {stats.totalFailed}
          </div>
        </div>
      </div>

      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-sm text-zinc-500">No webhook activity yet</div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-80 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className="text-zinc-400 font-mono shrink-0 w-20">{formatTime(log.timestamp)}</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-medium uppercase tracking-wider shrink-0 w-20">
                  {log.source}
                </span>
                <span className={`px-1.5 py-0.5 rounded font-medium uppercase tracking-wider shrink-0 ${statusStyles[log.status]}`}>
                  {log.status}
                </span>
                <span className="text-zinc-600 dark:text-zinc-400 truncate flex-1">{log.eventType}</span>
                {log.processingTime !== undefined && (
                  <span className="text-zinc-400 tabular-nums shrink-0">{log.processingTime}ms</span>
                )}
                {log.error && (
                  <span className="text-red-500 truncate max-w-[200px]" title={log.error}>{log.error}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
