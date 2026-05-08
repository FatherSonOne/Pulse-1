import React, { useState, useEffect } from 'react';
import { ArrowRight, Copy, Github, Heart, HelpCircle, MessageSquare, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { SettingsCard } from './shared/SettingsCard';
import { MonoLabel } from './shared/MonoLabel';

const FEEDBACK_EMAIL = 'feedback@quantumecosystems.com';
const BUILD_HASH = (import.meta.env.VITE_BUILD_HASH as string | undefined) || 'dev';
const BUILD_DATE = (import.meta.env.VITE_BUILD_DATE as string | undefined) || '';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface SystemInfo {
  browser: string;
  os: string;
  viewport: string;
  online: boolean;
  storage: string;
}

export const AboutSettings: React.FC = () => {
  const [system, setSystem] = useState<SystemInfo>({
    browser: '—',
    os: '—',
    viewport: '—',
    online: true,
    storage: '—',
  });
  const [storageBytes, setStorageBytes] = useState<number | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  useEffect(() => {
    // Browser + OS guesses from UA. Not bulletproof — fine for a debug surface.
    const ua = navigator.userAgent;
    const browser =
      /Edg\//.test(ua) ? 'Edge' :
      /OPR\//.test(ua) ? 'Opera' :
      /Chrome/.test(ua) ? 'Chrome' :
      /Firefox/.test(ua) ? 'Firefox' :
      /Safari/.test(ua) ? 'Safari' : 'Unknown';
    const os =
      /Windows NT 10/.test(ua) ? 'Windows 10/11' :
      /Mac OS X/.test(ua) ? 'macOS' :
      /Android/.test(ua) ? 'Android' :
      /iPhone|iPad/.test(ua) ? 'iOS' :
      /Linux/.test(ua) ? 'Linux' : 'Unknown';

    setSystem(prev => ({
      ...prev,
      browser,
      os,
      viewport: `${window.innerWidth} × ${window.innerHeight}`,
      online: navigator.onLine,
    }));

    // Storage estimate — supported in most modern browsers.
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then((est) => {
        const used = est.usage ?? 0;
        setStorageBytes(used);
        setSystem(prev => ({ ...prev, storage: formatBytes(used) }));
      }).catch(() => {
        setSystem(prev => ({ ...prev, storage: 'unavailable' }));
      });
    } else {
      setSystem(prev => ({ ...prev, storage: 'unavailable' }));
    }
  }, []);

  const handleCheckUpdates = async () => {
    setIsCheckingUpdate(true);
    const toastId = toast.loading('Checking for updates...');
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          await new Promise(r => setTimeout(r, 1200));
          if (reg.waiting) {
            toast('A new version is ready. Reload to update.', { id: toastId, icon: '🔄', duration: 6000 });
          } else {
            toast.success('You are running the latest version.', { id: toastId });
          }
        } else {
          toast.success('You are running the latest version.', { id: toastId });
        }
      } else {
        toast.success('You are running the latest version.', { id: toastId });
      }
    } catch {
      toast.error('Could not check for updates', { id: toastId });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleCopyDebugInfo = async () => {
    const lines = [
      `Pulse — Debug Info`,
      `Version: ${__APP_VERSION__ || 'dev'}`,
      `Build: ${BUILD_HASH}${BUILD_DATE ? ` (${BUILD_DATE})` : ''}`,
      `Browser: ${system.browser}`,
      `OS: ${system.os}`,
      `Viewport: ${system.viewport}`,
      `Online: ${system.online ? 'yes' : 'no'}`,
      `Storage used: ${system.storage}`,
      `URL: ${window.location.href}`,
      `Timestamp: ${new Date().toISOString()}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      toast.success('Debug info copied to clipboard');
    } catch {
      toast.error('Could not copy debug info');
    }
  };

  const handleClearCache = async () => {
    toast(
      (t) => (
        <div className="flex flex-col gap-3">
          <span className="text-sm text-zinc-900 dark:text-white">
            Clear local cache? Saved drafts and settings stay.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                toast.dismiss(t.id);
                setIsClearingCache(true);
                const toastId = toast.loading('Clearing cache...');
                try {
                  // Clear cache storage
                  if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                  }
                  // Drop pulse-* localStorage entries except settings + drafts
                  const preserve = ['pulse_settings', 'pulse-api-keys', 'pulse_theme_mode', 'pulse_keep_logged_in', 'pulse_feature_flags', 'pulse_advanced_mode'];
                  Object.keys(localStorage)
                    .filter(k => k.startsWith('pulse-') && !preserve.includes(k) && !k.startsWith('pulse_msg_draft_v1:'))
                    .forEach(k => localStorage.removeItem(k));
                  toast.success('Cache cleared', { id: toastId });
                  // Re-estimate storage
                  if ('storage' in navigator && 'estimate' in navigator.storage) {
                    const est = await navigator.storage.estimate();
                    const used = est.usage ?? 0;
                    setStorageBytes(used);
                    setSystem(prev => ({ ...prev, storage: formatBytes(used) }));
                  }
                } catch {
                  toast.error('Failed to clear cache', { id: toastId });
                } finally {
                  setIsClearingCache(false);
                }
              }}
              className="px-3 py-1 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded transition"
            >
              Clear cache
            </button>
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </div>
      ),
      { duration: 6000 }
    );
  };

  const feedbackMailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
    `Pulse feedback (${__APP_VERSION__ || 'dev'} · ${BUILD_HASH})`
  )}&body=${encodeURIComponent(
    `\n\n---\nVersion: ${__APP_VERSION__ || 'dev'}\nBuild: ${BUILD_HASH}\nBrowser: ${system.browser} on ${system.os}\nViewport: ${system.viewport}`
  )}`;

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center pt-8 pb-2 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" className="w-20 h-20 rounded-2xl shadow-lg shadow-rose-500/30 mb-6">
          <defs>
            <linearGradient id="about-pulse-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill="#0f172a" />
          <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#about-pulse-grad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <h2 className="text-3xl font-bold dark:text-white text-zinc-900 mb-1">Pulse</h2>
        <p className="text-zinc-500 mb-1">Version {__APP_VERSION__ || 'dev'} (Beta)</p>
        <p
          className="text-[10px] text-zinc-400 mb-6"
          style={{ fontFamily: 'var(--pulse-font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)' }}
        >
          {BUILD_HASH}{BUILD_DATE ? ` · ${BUILD_DATE}` : ''}
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={handleCheckUpdates}
            disabled={isCheckingUpdate}
            className="inline-flex items-center gap-2 px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
            Check for Updates
          </button>
          <a
            href={feedbackMailto}
            className="inline-flex items-center gap-2 px-5 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold rounded-lg hover:border-rose-500 hover:text-rose-500 transition"
          >
            <MessageSquare className="w-4 h-4" />
            Send Feedback
          </a>
        </div>
      </div>

      {/* System diagnostics */}
      <SettingsCard className="space-y-4">
        <div className="flex items-center justify-between">
          <MonoLabel>System diagnostics</MonoLabel>
          <button
            type="button"
            onClick={handleCopyDebugInfo}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-rose-500 transition"
            title="Copy this block for support tickets"
          >
            <Copy className="w-3 h-3" /> Copy debug info
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-zinc-500 dark:text-zinc-400">Browser</dt>
          <dd className="text-zinc-900 dark:text-zinc-100 font-medium">{system.browser}</dd>

          <dt className="text-zinc-500 dark:text-zinc-400">OS</dt>
          <dd className="text-zinc-900 dark:text-zinc-100 font-medium">{system.os}</dd>

          <dt className="text-zinc-500 dark:text-zinc-400">Viewport</dt>
          <dd
            className="text-zinc-900 dark:text-zinc-100 font-medium"
            style={{ fontFamily: 'var(--pulse-font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)' }}
          >
            {system.viewport}
          </dd>

          <dt className="text-zinc-500 dark:text-zinc-400">Connection</dt>
          <dd className="text-zinc-900 dark:text-zinc-100 font-medium">
            {system.online ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                Offline
              </span>
            )}
          </dd>

          <dt className="text-zinc-500 dark:text-zinc-400">Storage used</dt>
          <dd className="text-zinc-900 dark:text-zinc-100 font-medium">{system.storage}</dd>
        </dl>

        {storageBytes !== null && storageBytes > 0 && (
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleClearCache}
              disabled={isClearingCache}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-red-500 transition disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" /> Clear local cache
            </button>
          </div>
        )}
      </SettingsCard>

      {/* Reference links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
        <a href="/privacy" className="p-4 rounded-xl hover:border-rose-500 transition group"
          style={{ backgroundColor: 'var(--pulse-surface)', border: '1px solid var(--pulse-border)' }}>
          <div className="flex items-center justify-between">
            <span className="font-medium dark:text-white text-zinc-900">Privacy Policy</span>
            <ArrowRight className="text-zinc-400 group-hover:text-rose-500 transition w-4 h-4" />
          </div>
        </a>
        <a href="/terms" className="p-4 rounded-xl hover:border-rose-500 transition group"
          style={{ backgroundColor: 'var(--pulse-surface)', border: '1px solid var(--pulse-border)' }}>
          <div className="flex items-center justify-between">
            <span className="font-medium dark:text-white text-zinc-900">Terms of Service</span>
            <ArrowRight className="text-zinc-400 group-hover:text-rose-500 transition w-4 h-4" />
          </div>
        </a>
        <a href="https://github.com/Aegis-FM/pulse" target="_blank" rel="noreferrer" className="p-4 rounded-xl hover:border-rose-500 transition group"
          style={{ backgroundColor: 'var(--pulse-surface)', border: '1px solid var(--pulse-border)' }}>
          <div className="flex items-center justify-between">
            <span className="font-medium dark:text-white text-zinc-900">GitHub Repository</span>
            <Github className="text-zinc-400 group-hover:text-black dark:group-hover:text-white transition w-4 h-4" />
          </div>
        </a>
        <a href="/docs/help" className="p-4 rounded-xl hover:border-rose-500 transition group"
          style={{ backgroundColor: 'var(--pulse-surface)', border: '1px solid var(--pulse-border)' }}>
          <div className="flex items-center justify-between">
            <span className="font-medium dark:text-white text-zinc-900">Help Center</span>
            <HelpCircle className="text-zinc-400 group-hover:text-rose-500 transition w-4 h-4" />
          </div>
        </a>
      </div>

      <div className="text-center pt-4 pb-8 text-xs text-zinc-400">
        <p>&copy; {new Date().getFullYear()} Pulse. All rights reserved.</p>
        <p className="mt-1 inline-flex items-center gap-1.5">
          Made with <Heart className="text-rose-500 w-3 h-3" /> by the Pulse Team
        </p>
      </div>
    </div>
  );
};
