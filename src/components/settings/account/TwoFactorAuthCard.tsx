import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Loader2, KeyRound, Copy, Check, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { mfaService, MFAStatus, MFAEnrollment } from '../../../services/mfaService';

type Stage = 'idle' | 'enrolling' | 'verifying' | 'enrolled';

export const TwoFactorAuthCard: React.FC = () => {
  const [status, setStatus] = useState<MFAStatus | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [enrollment, setEnrollment] = useState<MFAEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  const refresh = useCallback(async () => {
    const next = await mfaService.getMFAStatus();
    setStatus(next);
    setStage(next.enabled ? 'enrolled' : 'idle');
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleEnroll = async () => {
    setBusy(true);
    try {
      const data = await mfaService.enrollMFA();
      if (data) {
        setEnrollment(data);
        setStage('verifying');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (!enrollment) return;
    if (!/^\d{6}$/.test(code)) {
      toast.error('Enter the 6-digit code from your authenticator');
      return;
    }
    setBusy(true);
    try {
      const ok = await mfaService.verifyMFAEnrollment(enrollment.id, code);
      if (ok) {
        setEnrollment(null);
        setCode('');
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (!confirm('Disable two-factor authentication? Your account will rely on password only.')) return;
    setBusy(true);
    try {
      const ok = await mfaService.disableAllMFA();
      if (ok) await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleCancelEnroll = async () => {
    if (enrollment) {
      // Best-effort cleanup of unverified factor
      try { await mfaService.unenrollMFA(enrollment.id); } catch { /* non-fatal */ }
    }
    setEnrollment(null);
    setCode('');
    setStage('idle');
  };

  const copySecret = async () => {
    if (!enrollment?.secret) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      toast.error('Could not copy secret');
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-zinc-500" />
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Two-factor authentication</h4>
        </div>
        {status?.enabled && (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide">
            <Check className="w-3 h-3" /> Enabled
          </span>
        )}
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Add a second factor to your sign-in. Use any TOTP authenticator (Google Authenticator, 1Password, Authy, etc.).
      </p>

      {stage === 'idle' && (
        <button
          type="button"
          onClick={handleEnroll}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          Enable 2FA
        </button>
      )}

      {stage === 'verifying' && enrollment && (
        <div className="space-y-4">
          <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-3">
            <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
              1. Scan this QR code with your authenticator app
            </p>
            {enrollment.qrCode && (
              <div className="flex justify-center bg-white p-3 rounded-lg">
                <img
                  src={enrollment.qrCode}
                  alt="2FA QR code"
                  className="w-44 h-44"
                />
              </div>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Or enter this secret manually:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono break-all px-2 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-700 dark:text-zinc-300">
                {enrollment.secret}
              </code>
              <button
                type="button"
                onClick={copySecret}
                className="p-1.5 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                title="Copy secret"
              >
                {secretCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-zinc-500" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="totp-code" className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
              2. Enter the 6-digit code
            </label>
            <input
              id="totp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full px-3 py-2 text-lg font-mono tracking-widest text-center border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleCancelEnroll}
              disabled={busy}
              className="px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleVerify}
              disabled={busy || code.length !== 6}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Verify &amp; Enable
            </button>
          </div>
        </div>
      )}

      {stage === 'enrolled' && status && (
        <div className="space-y-3">
          {status.factors.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-lg">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-white">{f.friendlyName}</p>
                <p className="text-[11px] text-zinc-400">Enrolled {new Date(f.createdAt).toLocaleDateString()}</p>
              </div>
              <span className="text-[10px] uppercase tracking-wide font-semibold text-zinc-400">{f.type}</span>
            </div>
          ))}

          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Disabling 2FA reduces account security. Only do this if you've lost access to your authenticator
              and need to re-enroll, or if your organization no longer requires it.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDisable}
            disabled={busy}
            className="text-sm font-medium text-red-500 hover:text-red-600 disabled:opacity-40"
          >
            {busy ? 'Disabling...' : 'Disable 2FA'}
          </button>
        </div>
      )}
    </div>
  );
};
