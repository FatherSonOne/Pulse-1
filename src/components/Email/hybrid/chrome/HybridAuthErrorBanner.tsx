// HybridAuthErrorBanner — amber-tinted banner above the canvas top bar when
// the Gmail session has expired. Ports the legacy auth-error banner copy
// verbatim. Click "Reconnect Google" triggers handleReAuthenticate via
// the onReconnect prop.
import React from 'react';
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';

interface HybridAuthErrorBannerProps {
  reconnecting: boolean;
  onReconnect: () => void;
}

export const HybridAuthErrorBanner: React.FC<HybridAuthErrorBannerProps> = ({
  reconnecting,
  onReconnect,
}) => (
  <div
    role="alert"
    className="border-b px-6 py-3 flex items-center justify-between gap-3 shrink-0"
    style={{
      background: 'rgba(245, 158, 11, 0.10)',
      borderColor: 'rgba(245, 158, 11, 0.30)',
    }}
  >
    <div className="flex items-center gap-3 min-w-0">
      <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#d97706' }} />
      <span className="text-sm truncate" style={{ color: '#92400e' }}>
        Your Google session has expired. Reconnect to send emails.
      </span>
    </div>
    <button
      type="button"
      onClick={onReconnect}
      disabled={reconnecting}
      className="px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 disabled:opacity-50 shrink-0"
      style={{ background: '#f59e0b', color: '#1a1a1a' }}
    >
      {reconnecting ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Connecting…
        </>
      ) : (
        <>
          <ExternalLink className="w-3.5 h-3.5" />
          Reconnect Google
        </>
      )}
    </button>
  </div>
);

export default HybridAuthErrorBanner;
