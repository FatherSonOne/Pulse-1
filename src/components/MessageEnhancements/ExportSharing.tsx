// Export & Sharing Tools
import React, { useState } from 'react';

interface ExportOptions {
  format: 'txt' | 'json' | 'csv' | 'html' | 'pdf';
  includeMetadata: boolean;
  includeAttachments: boolean;
  dateRange?: { start: string; end: string };
  selectedMessages?: string[];
}

interface ShareOptions {
  method: 'email' | 'link' | 'slack' | 'teams' | 'copy';
  recipients?: string[];
  message?: string;
  expiresIn?: '1h' | '24h' | '7d' | '30d' | 'never';
  allowDownload?: boolean;
  requireAuth?: boolean;
}

interface ExportSharingProps {
  threadId: string;
  threadTitle: string;
  messageCount: number;
  onExport: (options: ExportOptions) => Promise<{ url?: string; blob?: Blob }>;
  onShare: (options: ShareOptions) => Promise<{ shareUrl?: string; success: boolean }>;
  onGenerateReport?: () => Promise<string>;
  recentExports?: Array<{
    id: string;
    format: string;
    createdAt: string;
    size: string;
  }>;
  compact?: boolean;
}

const formatConfig = {
  txt: { icon: 'fa-file-lines', label: 'Plain Text', description: 'Simple text file' },
  json: { icon: 'fa-code', label: 'JSON', description: 'Structured data format' },
  csv: { icon: 'fa-table', label: 'CSV', description: 'Spreadsheet compatible' },
  html: { icon: 'fa-globe', label: 'HTML', description: 'Web page format' },
  pdf: { icon: 'fa-file-pdf', label: 'PDF', description: 'Print-ready document' }
};

const shareMethodConfig = {
  email: { icon: 'fa-envelope', label: 'Email', color: 'blue' },
  link: { icon: 'fa-link', label: 'Share Link', color: 'green' },
  slack: { icon: 'fa-brands fa-slack', label: 'Slack', color: 'purple' },
  teams: { icon: 'fa-brands fa-microsoft', label: 'Teams', color: 'indigo' },
  copy: { icon: 'fa-copy', label: 'Copy', color: 'zinc' }
};

export const ExportSharing: React.FC<ExportSharingProps> = ({
  threadId,
  threadTitle,
  messageCount,
  onExport,
  onShare,
  onGenerateReport,
  recentExports = [],
  compact = false
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'share' | 'history'>('export');
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportResult, setExportResult] = useState<{ url?: string; blob?: Blob } | null>(null);
  const [shareResult, setShareResult] = useState<{ shareUrl?: string } | null>(null);

  // Export options
  const [selectedFormat, setSelectedFormat] = useState<ExportOptions['format']>('txt');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [useDateRange, setUseDateRange] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Share options
  const [shareMethod, setShareMethod] = useState<ShareOptions['method']>('link');
  const [recipients, setRecipients] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [expiresIn, setExpiresIn] = useState<ShareOptions['expiresIn']>('7d');
  const [allowDownload, setAllowDownload] = useState(true);
  const [requireAuth, setRequireAuth] = useState(false);

  const handleExport = async () => {
    setIsProcessing(true);
    try {
      const result = await onExport({
        format: selectedFormat,
        includeMetadata,
        includeAttachments,
        dateRange: useDateRange && dateStart && dateEnd ? { start: dateStart, end: dateEnd } : undefined
      });
      setExportResult(result);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShare = async () => {
    setIsProcessing(true);
    try {
      const result = await onShare({
        method: shareMethod,
        recipients: recipients ? recipients.split(',').map(r => r.trim()) : undefined,
        message: shareMessage || undefined,
        expiresIn,
        allowDownload,
        requireAuth
      });
      setShareResult(result);

      if (shareMethod === 'copy' && result.shareUrl) {
        await navigator.clipboard.writeText(result.shareUrl);
      }
    } catch (error) {
      console.error('Share failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('export')}
          className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-900/60 transition"
        >
          <i className="fa-solid fa-download text-xs" />
          <span className="text-xs font-medium">Export</span>
        </button>
        <button
          onClick={() => setActiveTab('share')}
          className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition"
        >
          <i className="fa-solid fa-share-nodes text-xs" />
          <span className="text-xs font-medium">Share</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center">
              <i className="fa-solid fa-share-from-square text-cyan-500 text-sm" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Export & Share</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {threadTitle} • {messageCount} messages
              </p>
            </div>
          </div>
          {onGenerateReport && (
            <button
              onClick={async () => {
                setIsProcessing(true);
                try {
                  await onGenerateReport();
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={isProcessing}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-cyan-500 text-white hover:bg-cyan-600 transition disabled:opacity-50"
            >
              <i className="fa-solid fa-chart-simple" />
              Report
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg p-1">
          {[
            { id: 'export', label: 'Export', icon: 'fa-download' },
            { id: 'share', label: 'Share', icon: 'fa-share-nodes' },
            { id: 'history', label: 'History', icon: 'fa-clock-rotate-left' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-zinc-600 text-zinc-800 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white'
              }`}
            >
              <i className={`fa-solid ${tab.icon}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'export' && (
          <div className="space-y-4">
            {/* Format selection */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                Export Format
              </label>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(formatConfig).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedFormat(key as ExportOptions['format'])}
                    className={`p-2 rounded-lg border text-center transition ${
                      selectedFormat === key
                        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                        : 'border-zinc-200 dark:border-zinc-600 hover:border-cyan-300 dark:hover:border-cyan-700'
                    }`}
                  >
                    <i className={`fa-solid ${config.icon} text-lg ${
                      selectedFormat === key ? 'text-cyan-500' : 'text-zinc-400'
                    }`} />
                    <p className={`text-[10px] font-medium mt-1 ${
                      selectedFormat === key ? 'text-cyan-600 dark:text-cyan-400' : 'text-zinc-600 dark:text-zinc-400'
                    }`}>
                      {config.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                  className="rounded border-zinc-300 text-cyan-500 focus:ring-cyan-500"
                />
                Include timestamps & metadata
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={includeAttachments}
                  onChange={(e) => setIncludeAttachments(e.target.checked)}
                  className="rounded border-zinc-300 text-cyan-500 focus:ring-cyan-500"
                />
                Include attachments
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={useDateRange}
                  onChange={(e) => setUseDateRange(e.target.checked)}
                  className="rounded border-zinc-300 text-cyan-500 focus:ring-cyan-500"
                />
                Limit to date range
              </label>
            </div>

            {/* Date range */}
            {useDateRange && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-zinc-500 mb-1">From</label>
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-zinc-500 mb-1">To</label>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* Export button */}
            <button
              onClick={handleExport}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-cyan-500 text-white hover:bg-cyan-600 transition disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-download" />
                  Export as {formatConfig[selectedFormat].label}
                </>
              )}
            </button>

            {/* Export result */}
            {exportResult && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <i className="fa-solid fa-check-circle" />
                  <span className="text-sm font-medium">Export ready!</span>
                </div>
                {exportResult.url && (
                  <a
                    href={exportResult.url}
                    download
                    className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline"
                  >
                    <i className="fa-solid fa-download" />
                    Download file
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'share' && (
          <div className="space-y-4">
            {/* Share method */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                Share via
              </label>
              <div className="flex gap-2">
                {Object.entries(shareMethodConfig).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setShareMethod(key as ShareOptions['method'])}
                    className={`flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg border transition ${
                      shareMethod === key
                        ? `border-${config.color}-500 bg-${config.color}-50 dark:bg-${config.color}-900/20`
                        : 'border-zinc-200 dark:border-zinc-600 hover:border-zinc-300 dark:hover:border-zinc-500'
                    }`}
                  >
                    <i className={`${config.icon} ${shareMethod === key ? `text-${config.color}-500` : 'text-zinc-400'}`} />
                    <span className={`text-xs font-medium ${
                      shareMethod === key ? `text-${config.color}-600 dark:text-${config.color}-400` : 'text-zinc-600 dark:text-zinc-400'
                    }`}>
                      {config.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recipients (for email) */}
            {shareMethod === 'email' && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Recipients (comma-separated)
                </label>
                <input
                  type="text"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
                  placeholder="email@example.com, another@example.com"
                />
              </div>
            )}

            {/* Message */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Message (optional)
              </label>
              <textarea
                value={shareMessage}
                onChange={(e) => setShareMessage(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white resize-none"
                rows={2}
                placeholder="Add a note..."
              />
            </div>

            {/* Link options */}
            {(shareMethod === 'link' || shareMethod === 'copy') && (
              <div className="space-y-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">Link expires in</span>
                  <select
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value as ShareOptions['expiresIn'])}
                    className="px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
                  >
                    <option value="1h">1 hour</option>
                    <option value="24h">24 hours</option>
                    <option value="7d">7 days</option>
                    <option value="30d">30 days</option>
                    <option value="never">Never</option>
                  </select>
                </div>
                <label className="flex items-center justify-between">
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">Allow download</span>
                  <input
                    type="checkbox"
                    checked={allowDownload}
                    onChange={(e) => setAllowDownload(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-500 focus:ring-indigo-500"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">Require authentication</span>
                  <input
                    type="checkbox"
                    checked={requireAuth}
                    onChange={(e) => setRequireAuth(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-500 focus:ring-indigo-500"
                  />
                </label>
              </div>
            )}

            {/* Share button */}
            <button
              onClick={handleShare}
              disabled={isProcessing || (shareMethod === 'email' && !recipients)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <i className={`${shareMethodConfig[shareMethod].icon}`} />
                  {shareMethod === 'copy' ? 'Copy Link' : `Share via ${shareMethodConfig[shareMethod].label}`}
                </>
              )}
            </button>

            {/* Share result */}
            {shareResult?.shareUrl && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                  <i className="fa-solid fa-check-circle" />
                  <span className="text-sm font-medium">
                    {shareMethod === 'copy' ? 'Copied to clipboard!' : 'Share link created!'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareResult.shareUrl}
                    readOnly
                    className="flex-1 px-2 py-1 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(shareResult.shareUrl!)}
                    className="p-1.5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    <i className="fa-solid fa-copy text-xs" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {recentExports.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-3">
                  <i className="fa-solid fa-clock-rotate-left text-zinc-400 text-lg" />
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No export history</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                  Your exports will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentExports.map(exp => (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                        <i className={`fa-solid ${formatConfig[exp.format as keyof typeof formatConfig]?.icon || 'fa-file'} text-zinc-500 text-sm`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-800 dark:text-white uppercase">
                          {exp.format}
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          {formatDate(exp.createdAt)} • {exp.size}
                        </p>
                      </div>
                    </div>
                    <button className="p-1.5 text-zinc-400 hover:text-cyan-500 transition">
                      <i className="fa-solid fa-download text-sm" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Quick export button
export const QuickExportButton: React.FC<{
  onClick: () => void;
}> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded text-zinc-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition"
      title="Export conversation"
    >
      <i className="fa-solid fa-download text-sm" />
    </button>
  );
};

// Quick share button
export const QuickShareButton: React.FC<{
  onClick: () => void;
}> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
      title="Share conversation"
    >
      <i className="fa-solid fa-share-nodes text-sm" />
    </button>
  );
};

export default ExportSharing;
