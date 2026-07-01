import React, { useState, useEffect, useCallback } from 'react';
import { Fingerprint, Loader2, Plus, Trash2, Check, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  passkeySupported,
  listPasskeys,
  registerPasskey,
  removePasskey,
  PasskeyRow,
} from '../../../services/passkeyService';
import { SettingsCard } from '../shared/SettingsCard';
import { MonoLabel } from '../shared/MonoLabel';

/** Best-effort friendly name for the authenticator being enrolled. */
function guessDeviceLabel(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iPhone / iPad';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac (Touch ID)';
  if (/Windows/.test(ua)) return 'Windows Hello';
  if (/Android/.test(ua)) return 'Android';
  return 'Passkey';
}

export const PasskeysCard: React.FC = () => {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setPasskeys(await listPasskeys());
    } catch (e) {
      console.error('[PasskeysCard] list failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    passkeySupported().then(setSupported);
    refresh();
  }, [refresh]);

  const handleAdd = async () => {
    setBusy(true);
    try {
      await registerPasskey(guessDeviceLabel());
      toast.success('Passkey added');
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not add passkey';
      // NotAllowedError = user cancelled / timed out the biometric prompt.
      if (/NotAllowed|cancel|timed out|abort/i.test(msg)) {
        toast('Passkey setup was cancelled');
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = (pk: PasskeyRow) => {
    toast(
      (t) => (
        <div className="flex flex-col gap-3">
          <span className="text-sm text-zinc-900 dark:text-white">
            Remove “{pk.device_label || 'this passkey'}”? You won't be able to sign in with it.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                toast.dismiss(t.id);
                setBusy(true);
                try {
                  await removePasskey(pk.id);
                  await refresh();
                  toast.success('Passkey removed');
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Could not remove passkey');
                } finally {
                  setBusy(false);
                }
              }}
              className="px-3 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded transition"
            >
              Remove
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
      { duration: 8000 }
    );
  };

  return (
    <SettingsCard className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Fingerprint className="w-4 h-4 text-zinc-500" />
          <MonoLabel>Passkeys</MonoLabel>
        </div>
        {passkeys.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wide">
            <Check className="w-3 h-3" /> {passkeys.length} active
          </span>
        )}
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Sign in with Face ID, Touch ID, Windows Hello, or a hardware key — no password. Passkeys are
        added on top of your existing sign-in methods.
      </p>

      {supported === false && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2">
          <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            This device or browser doesn't support passkeys. Try a recent Chrome, Safari, or Edge on a
            device with a fingerprint reader, Face ID, or Windows Hello.
          </p>
        </div>
      )}

      {!loading && passkeys.length > 0 && (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800">
          {passkeys.map((pk) => (
            <div key={pk.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-white truncate flex items-center gap-2">
                  {pk.device_label || 'Passkey'}
                  {pk.backed_up && (
                    <span className="text-[9px] uppercase tracking-wide font-semibold text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded px-1 py-0.5">
                      Synced
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-zinc-400">
                  Added {new Date(pk.created_at).toLocaleDateString()}
                  {pk.last_used_at ? ` · last used ${new Date(pk.last_used_at).toLocaleDateString()}` : ' · never used'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(pk)}
                disabled={busy}
                className="p-1.5 rounded text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition disabled:opacity-40"
                title="Remove passkey"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {supported !== false && (
        <button
          type="button"
          onClick={handleAdd}
          disabled={busy || supported === null}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add a passkey
        </button>
      )}
    </SettingsCard>
  );
};
