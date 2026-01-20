import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { analyticsExportService, type ExportJob as ServiceExportJob, type AnalyticsData as ServiceAnalyticsData } from '../../services/analyticsExportService';
import { supabase } from '../../services/supabase';

// Types
interface ExportFormat {
  id: string;
  name: string;
  extension: string;
  icon: string;
  description: string;
}

interface ExportOptions {
  format: string;
  dateRange: 'all' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  customStartDate?: Date;
  customEndDate?: Date;
  includeMetadata: boolean;
  includeAttachments: boolean;
  includeAnalytics: boolean;
  anonymize: boolean;
  compress: boolean;
}

interface ExportJob {
  id: string;
  name: string;
  format: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  fileSize?: number;
  downloadUrl?: string;
  error?: string;
}

interface AnalyticsData {
  totalMessages: number;
  totalContacts: number;
  totalAttachments: number;
  dateRange: { start: Date; end: Date };
  messageTrend: { date: string; count: number }[];
  topContacts: { name: string; count: number }[];
  responseTimeAvg: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
}

interface AnalyticsExportProps {
  onExport?: (options: ExportOptions) => Promise<void>;
  onDownload?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
}

const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'csv', name: 'CSV', extension: '.csv', icon: 'fa-file-csv', description: 'Spreadsheet format, great for Excel/Sheets' },
  { id: 'json', name: 'JSON', extension: '.json', icon: 'fa-file-code', description: 'Structured data for developers' },
  { id: 'pdf', name: 'PDF', extension: '.pdf', icon: 'fa-file-pdf', description: 'Professional report format' },
  { id: 'html', name: 'HTML', extension: '.html', icon: 'fa-file-lines', description: 'Interactive web report' },
  { id: 'xlsx', name: 'Excel', extension: '.xlsx', icon: 'fa-file-excel', description: 'Rich spreadsheet with charts' }
];

// Helper to convert service types to component types
const convertServiceJobToComponent = (job: ServiceExportJob): ExportJob => ({
  id: job.id,
  name: job.name,
  format: job.format as ExportFormat['id'],
  status: job.status,
  progress: job.progress,
  createdAt: new Date(job.created_at),
  completedAt: job.completed_at ? new Date(job.completed_at) : undefined,
  fileSize: job.file_size,
  downloadUrl: job.download_url
});

const convertServiceAnalyticsToComponent = (analytics: ServiceAnalyticsData): AnalyticsData => ({
  totalMessages: analytics.total_messages,
  totalContacts: analytics.total_contacts,
  totalAttachments: analytics.total_attachments,
  dateRange: {
    start: new Date(analytics.date_range.start),
    end: new Date(analytics.date_range.end)
  },
  messageTrend: analytics.message_trend,
  topContacts: analytics.top_contacts,
  responseTimeAvg: analytics.response_time_avg,
  sentimentBreakdown: analytics.sentiment_breakdown
});

export const AnalyticsExport: React.FC<AnalyticsExportProps> = ({
  onExport,
  onDownload,
  onCancel
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'history' | 'preview'>('export');
  const [options, setOptions] = useState<ExportOptions>({
    format: 'pdf',
    dateRange: 'month',
    includeMetadata: true,
    includeAttachments: false,
    includeAnalytics: true,
    anonymize: false,
    compress: true
  });
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalMessages: 0,
    totalContacts: 0,
    totalAttachments: 0,
    dateRange: { start: new Date(), end: new Date() },
    messageTrend: [],
    topContacts: [],
    responseTimeAvg: 0,
    sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 }
  });

  // Load data on mount
  useEffect(() => {
    loadExportJobs();
  }, []);

  const loadExportJobs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const serviceJobs = await analyticsExportService.listExportJobs(user.id);
      setJobs(serviceJobs.map(convertServiceJobToComponent));
    } catch (error) {
      console.error('Failed to load export jobs:', error);
    }
  };

  const selectedFormat = useMemo(() =>
    EXPORT_FORMATS.find(f => f.id === options.format),
    [options.format]
  );

  const estimatedSize = useMemo(() => {
    let size = analytics.totalMessages * 500; // ~500 bytes per message
    if (options.includeAttachments) size += analytics.totalAttachments * 50000; // ~50KB per attachment
    if (options.includeAnalytics) size += 100000; // ~100KB for analytics
    if (options.compress) size *= 0.3;
    return size;
  }, [analytics, options]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Convert component options to service options
      const serviceOptions = {
        format: options.format,
        date_range: options.dateRange,
        include_metadata: options.includeMetadata,
        include_attachments: options.includeAttachments,
        include_analytics: options.includeAnalytics,
        anonymize: options.anonymize,
        compress: options.compress
      };

      const job = await analyticsExportService.createExport(
        user.id,
        serviceOptions,
        (progress) => {
          // Update job progress in real-time
          setJobs(prev => prev.map(j =>
            j.id === job.id ? { ...j, progress } : j
          ));
        }
      );

      const newJob = convertServiceJobToComponent(job);
      setJobs(prev => [newJob, ...prev.filter(j => j.id !== newJob.id)]);

      if (onExport) {
        await onExport(options);
      }
    } catch (error: any) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  }, [options, onExport]);

  const handleCancel = useCallback(async (jobId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await analyticsExportService.cancelExportJob(jobId, user.id);
      setJobs(prev => prev.map(j =>
        j.id === jobId ? { ...j, status: 'failed' } : j
      ));
      onCancel?.(jobId);
    } catch (error) {
      console.error('Failed to cancel export:', error);
    }
  }, [onCancel]);

  const getStatusColor = (status: ExportJob['status']): string => {
    switch (status) {
      case 'completed': return 'text-green-500 bg-green-50 dark:bg-green-900/20';
      case 'processing': return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'failed': return 'text-red-500 bg-red-50 dark:bg-red-900/20';
      default: return 'text-zinc-500 bg-zinc-50 dark:bg-zinc-800';
    }
  };

  const maxTrend = useMemo(() => Math.max(...analytics.messageTrend.map(t => t.count)), [analytics.messageTrend]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm">
              <i className="fa-solid fa-file-export text-indigo-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Analytics Export</p>
              <p className="text-xs text-zinc-500">{analytics.totalMessages.toLocaleString()} messages to export</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">~{formatFileSize(estimatedSize)}</p>
            <p className="text-xs text-zinc-500">Estimated size</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
        {[
          { id: 'export' as const, label: 'Export', icon: 'fa-download' },
          { id: 'history' as const, label: 'History', icon: 'fa-clock-rotate-left' },
          { id: 'preview' as const, label: 'Preview', icon: 'fa-eye' }
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
      {activeTab === 'export' && (
        <div className="space-y-4">
          {/* Format Selection */}
          <div>
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Export Format</p>
            <div className="grid grid-cols-5 gap-2">
              {EXPORT_FORMATS.map(format => (
                <button
                  key={format.id}
                  onClick={() => setOptions(prev => ({ ...prev, format: format.id }))}
                  className={`p-3 rounded-lg border text-center transition ${
                    options.format === format.id
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-indigo-300'
                  }`}
                >
                  <i className={`fa-solid ${format.icon} text-lg mb-1`} />
                  <p className="text-xs font-medium">{format.name}</p>
                </button>
              ))}
            </div>
            {selectedFormat && (
              <p className="text-xs text-zinc-500 mt-2">{selectedFormat.description}</p>
            )}
          </div>

          {/* Date Range */}
          <div>
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Date Range</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'week' as const, label: 'Last Week' },
                { id: 'month' as const, label: 'Last Month' },
                { id: 'quarter' as const, label: 'Last Quarter' },
                { id: 'year' as const, label: 'Last Year' },
                { id: 'all' as const, label: 'All Time' }
              ].map(range => (
                <button
                  key={range.id}
                  onClick={() => setOptions(prev => ({ ...prev, dateRange: range.id }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    options.dateRange === range.id
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Options</p>
            {[
              { key: 'includeMetadata' as const, label: 'Include metadata', description: 'Timestamps, read receipts, etc.' },
              { key: 'includeAttachments' as const, label: 'Include attachments', description: 'Images, files, and documents' },
              { key: 'includeAnalytics' as const, label: 'Include analytics', description: 'Charts and statistics' },
              { key: 'anonymize' as const, label: 'Anonymize data', description: 'Remove personal information' },
              { key: 'compress' as const, label: 'Compress file', description: 'Create a smaller ZIP archive' }
            ].map(option => (
              <div
                key={option.key}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{option.label}</p>
                  <p className="text-xs text-zinc-500">{option.description}</p>
                </div>
                <button
                  onClick={() => setOptions(prev => ({ ...prev, [option.key]: !prev[option.key] }))}
                  className={`w-10 h-5 rounded-full transition-colors ${options[option.key] ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${options[option.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin" />
                Exporting...
              </>
            ) : (
              <>
                <i className="fa-solid fa-download" />
                Export {selectedFormat?.name} (~{formatFileSize(estimatedSize)})
              </>
            )}
          </button>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-2">
          {jobs.length === 0 ? (
            <div className="text-center py-8">
              <i className="fa-solid fa-clock-rotate-left text-zinc-300 text-3xl mb-3" />
              <p className="text-sm text-zinc-500">No export history</p>
            </div>
          ) : (
            jobs.map(job => (
              <div
                key={job.id}
                className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <i className={`fa-solid ${EXPORT_FORMATS.find(f => f.id === job.format)?.icon || 'fa-file'} text-zinc-400`} />
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{job.name}</p>
                      <p className="text-xs text-zinc-500">{formatTimeAgo(job.createdAt)}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                </div>

                {job.status === 'processing' && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                      <span>Processing...</span>
                      <span>{job.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <button
                      onClick={() => handleCancel(job.id)}
                      className="mt-2 text-xs text-red-500 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {job.status === 'completed' && job.downloadUrl && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      {job.fileSize && formatFileSize(job.fileSize)}
                    </span>
                    <button
                      onClick={() => onDownload?.(job.id)}
                      className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-xs font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                    >
                      <i className="fa-solid fa-download mr-1" />
                      Download
                    </button>
                  </div>
                )}

                {job.status === 'failed' && job.error && (
                  <p className="mt-2 text-xs text-red-500">{job.error}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 text-center">
              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{analytics.totalMessages.toLocaleString()}</p>
              <p className="text-xs text-zinc-500">Messages</p>
            </div>
            <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 text-center">
              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{analytics.totalContacts}</p>
              <p className="text-xs text-zinc-500">Contacts</p>
            </div>
            <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 text-center">
              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{analytics.totalAttachments}</p>
              <p className="text-xs text-zinc-500">Attachments</p>
            </div>
          </div>

          {/* Message Trend */}
          <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-3">Messages This Week</p>
            <div className="flex items-end justify-between h-24 gap-1">
              {analytics.messageTrend.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-all cursor-pointer"
                    style={{ height: `${(day.count / maxTrend) * 100}%` }}
                    title={`${day.date}: ${day.count} messages`}
                  />
                  <span className="text-[10px] text-zinc-400">{day.date}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sentiment Breakdown */}
          <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-3">Sentiment Distribution</p>
            <div className="flex h-3 rounded-full overflow-hidden">
              <div
                className="bg-green-500"
                style={{ width: `${analytics.sentimentBreakdown.positive}%` }}
                title={`Positive: ${analytics.sentimentBreakdown.positive}%`}
              />
              <div
                className="bg-zinc-400"
                style={{ width: `${analytics.sentimentBreakdown.neutral}%` }}
                title={`Neutral: ${analytics.sentimentBreakdown.neutral}%`}
              />
              <div
                className="bg-red-500"
                style={{ width: `${analytics.sentimentBreakdown.negative}%` }}
                title={`Negative: ${analytics.sentimentBreakdown.negative}%`}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Positive {analytics.sentimentBreakdown.positive}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                Neutral {analytics.sentimentBreakdown.neutral}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Negative {analytics.sentimentBreakdown.negative}%
              </span>
            </div>
          </div>

          {/* Top Contacts */}
          <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-3">Top Contacts</p>
            <div className="space-y-2">
              {analytics.topContacts.slice(0, 5).map((contact, i) => (
                <div key={contact.name} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] flex items-center justify-center font-bold">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">{contact.name}</span>
                  <span className="text-xs text-zinc-500">{contact.count} msgs</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Quick Export Button
interface QuickExportButtonProps {
  onClick: () => void;
}

export const QuickExportButton: React.FC<QuickExportButtonProps> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
    title="Export conversation"
  >
    <i className="fa-solid fa-file-export text-zinc-500" />
  </button>
);
