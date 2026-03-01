// ============================================
// SEARCH ANALYTICS DASHBOARD
// Admin view of search telemetry collected by
// searchAnalyticsService (localStorage, 30-day window)
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import { Search, TrendingUp, MousePointerClick, AlertTriangle, Download, Trash2, RefreshCw } from 'lucide-react';
import { searchAnalyticsService, SearchAnalyticsSummary } from '../../services/searchAnalyticsService';

interface SearchAnalyticsDashboardProps {
  userId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_COLOURS: Record<string, string> = {
  email:           'bg-blue-400',
  message:         'bg-purple-400',
  unified_message: 'bg-purple-400',
  vox:             'bg-pink-400',
  note:            'bg-yellow-400',
  task:            'bg-green-400',
  event:           'bg-orange-400',
  contact:         'bg-teal-400',
  sms:             'bg-indigo-400',
  archive:         'bg-gray-400',
};

function barWidth(value: number, max: number): string {
  if (max === 0) return '0%';
  return `${Math.round((value / max) * 100)}%`;
}

function downloadCSV(rows: string[][], filename: string) {
  const content = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────

const SearchAnalyticsDashboard: React.FC<SearchAnalyticsDashboardProps> = ({ userId }) => {
  const [summary, setSummary] = useState<SearchAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    try {
      setSummary(searchAnalyticsService.getSummary(userId));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleClear = () => {
    if (!window.confirm('Clear all search analytics data for this user? This cannot be undone.')) return;
    searchAnalyticsService.clearAll(userId);
    load();
  };

  const handleExport = () => {
    if (!summary) return;
    const rows: string[][] = [
      ['Section', 'Query', 'Count', 'Last Used', 'Zero Results'],
      ...summary.topQueries.map(q => [
        'Top Queries', q.query, String(q.count),
        new Date(q.lastUsed).toLocaleString(), String(q.zeroResults),
      ]),
      [],
      ['Section', 'Query', 'Count', 'Last Used', ''],
      ...summary.zeroResultQueries.map(q => [
        'Zero-Result Queries', q.query, String(q.count),
        new Date(q.lastUsed).toLocaleString(), '',
      ]),
      [],
      ['Section', 'Result Type', 'Clicks', '', ''],
      ...Object.entries(summary.clicksByType).map(([type, count]) => [
        'Clicks by Type', type, String(count), '', '',
      ]),
    ];
    downloadCSV(rows, `pulse-search-analytics-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-zinc-400">
        <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
        Loading analytics…
      </div>
    );
  }

  if (!summary) return null;

  const zeroResultRate = summary.totalSearches > 0
    ? Math.round((summary.zeroResultQueries.reduce((s, q) => s + q.count, 0) / summary.totalSearches) * 100)
    : 0;

  const uniqueQueryCount = summary.topQueries.length;
  const maxQueryCount = summary.topQueries[0]?.count ?? 1;
  const maxClickCount = Math.max(...Object.values(summary.clicksByType), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-1">Search Analytics</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            30-day client-side telemetry — query frequency, zero-results, click-through by type.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            title="Refresh"
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={summary.totalSearches === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Search size={20} className="text-pink-500" />}
          label="Total Searches"
          value={summary.totalSearches.toLocaleString()}
          sub="last 30 days"
        />
        <SummaryCard
          icon={<MousePointerClick size={20} className="text-purple-500" />}
          label="Total Clicks"
          value={summary.totalClicks.toLocaleString()}
          sub={summary.totalSearches > 0 ? `${Math.round((summary.totalClicks / summary.totalSearches) * 100) / 100} per search` : '—'}
        />
        <SummaryCard
          icon={<TrendingUp size={20} className="text-blue-500" />}
          label="Unique Queries"
          value={uniqueQueryCount.toLocaleString()}
          sub="distinct search terms"
        />
        <SummaryCard
          icon={<AlertTriangle size={20} className={zeroResultRate > 20 ? 'text-red-500' : 'text-amber-500'} />}
          label="Zero-Result Rate"
          value={`${zeroResultRate}%`}
          sub={zeroResultRate > 20 ? 'high — review queries below' : 'of searches returned nothing'}
          highlight={zeroResultRate > 20 ? 'red' : undefined}
        />
      </div>

      {summary.totalSearches === 0 && (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 p-12 text-center">
          <Search size={32} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">No search data yet</p>
          <p className="text-zinc-400 dark:text-zinc-500 text-sm mt-1">Analytics appear here after users perform searches.</p>
        </div>
      )}

      {summary.totalSearches > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Top Queries */}
          <section className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-pink-500" /> Top Queries
            </h2>
            {summary.topQueries.length === 0 ? (
              <p className="text-sm text-zinc-400">No data yet.</p>
            ) : (
              <ol className="space-y-2">
                {summary.topQueries.map((q, i) => (
                  <li key={q.query} className="flex items-center gap-3">
                    <span className="w-5 text-right text-xs text-zinc-400 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm text-zinc-800 dark:text-zinc-200 truncate font-mono">{q.query}</span>
                        <span className="text-xs text-zinc-400 ml-2 flex-shrink-0">{q.count}×</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-pink-400 transition-all"
                          style={{ width: barWidth(q.count, maxQueryCount) }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Click-Through by Type */}
          <section className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <MousePointerClick size={16} className="text-purple-500" /> Clicks by Result Type
            </h2>
            {Object.keys(summary.clicksByType).length === 0 ? (
              <p className="text-sm text-zinc-400">No click data yet.</p>
            ) : (
              <ul className="space-y-2">
                {Object.entries(summary.clicksByType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <li key={type} className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_COLOURS[type] ?? 'bg-zinc-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm text-zinc-800 dark:text-zinc-200 capitalize">
                            {type === 'unified_message' ? 'Message' : type}
                          </span>
                          <span className="text-xs text-zinc-400 ml-2 flex-shrink-0">{count} click{count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${TYPE_COLOURS[type] ?? 'bg-zinc-400'} transition-all`}
                            style={{ width: barWidth(count, maxClickCount) }}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          {/* Zero-Result Queries */}
          <section className="lg:col-span-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" /> Zero-Result Queries
            </h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
              These are terms users searched for but got no results — good candidates for content gaps or search improvements.
            </p>
            {summary.zeroResultQueries.length === 0 ? (
              <p className="text-sm text-zinc-400 italic">None — great coverage!</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-700">
                      <th className="pb-2 font-medium">Query</th>
                      <th className="pb-2 font-medium text-right">Searches</th>
                      <th className="pb-2 font-medium text-right">Last searched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.zeroResultQueries.map(q => (
                      <tr key={q.query} className="border-b border-zinc-50 dark:border-zinc-700/50 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
                        <td className="py-2 pr-4 font-mono text-zinc-800 dark:text-zinc-200">{q.query}</td>
                        <td className="py-2 text-right tabular-nums text-zinc-500">{q.count}</td>
                        <td className="py-2 text-right text-zinc-400 text-xs">{new Date(q.lastUsed).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      )}
    </div>
  );
};

// ── Sub-component ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  highlight?: 'red';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value, sub, highlight }) => (
  <div className={`p-5 rounded-xl border ${highlight === 'red' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'}`}>
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      {icon}
    </div>
    <div className={`text-3xl font-bold mb-1 ${highlight === 'red' ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>
      {value}
    </div>
    <p className="text-xs text-zinc-400 dark:text-zinc-500">{sub}</p>
  </div>
);

export default SearchAnalyticsDashboard;
