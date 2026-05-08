import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  ShieldCheck,
  Clock,
  Globe2,
  Activity,
  Loader2,
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Circle,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkspaceData, useWorkspaceActions, useWorkspacePermissions } from '../../contexts/WorkspaceContext';
import { workspaceService, SessionTimeoutMinutes, SignInActivityEntry } from '../../services/workspaceService';
import { SettingsCard } from './shared/SettingsCard';
import { MonoLabel } from './shared/MonoLabel';

const SESSION_TIMEOUT_OPTIONS: { value: SessionTimeoutMinutes; label: string }[] = [
  { value: 0,     label: 'Never' },
  { value: 60,    label: '1 hour' },
  { value: 480,   label: '8 hours' },
  { value: 1440,  label: '24 hours' },
  { value: 10080, label: '7 days' },
];

// Matches an IPv4 or IPv6 CIDR block. Loose enough that obvious typos fail
// but strict enough that totally bogus input is rejected before it hits the DB.
const CIDR_REGEX =
  /^((\d{1,3}\.){3}\d{1,3}\/(3[0-2]|[12]?\d))$|^(([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{0,4}|::1?)\/(12[0-8]|1[01]\d|[1-9]?\d)$/;

function validateCidrList(lines: string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of lines) {
    const entry = raw.trim();
    if (!entry) continue;
    if (CIDR_REGEX.test(entry)) valid.push(entry);
    else invalid.push(entry);
  }
  return { valid, invalid };
}

function deviceIcon(deviceType: string | null): React.ReactElement {
  switch ((deviceType || '').toLowerCase()) {
    case 'mobile':  return <Smartphone className="w-4 h-4 text-zinc-400" />;
    case 'tablet':  return <Tablet className="w-4 h-4 text-zinc-400" />;
    case 'desktop': return <Laptop className="w-4 h-4 text-zinc-400" />;
    default:        return <Monitor className="w-4 h-4 text-zinc-400" />;
  }
}

export const SecuritySettings: React.FC = () => {
  const { currentWorkspace } = useWorkspaceData();
  const { updateWorkspace } = useWorkspaceActions();
  const { isAdmin } = useWorkspacePermissions();

  const [enforce2FA, setEnforce2FA] = useState(currentWorkspace?.enforce_2fa ?? false);
  const [sessionTimeout, setSessionTimeout] = useState<SessionTimeoutMinutes>(
    (currentWorkspace?.session_timeout_minutes ?? 0) as SessionTimeoutMinutes,
  );
  const [ipAllowlistText, setIpAllowlistText] = useState(
    (currentWorkspace?.ip_allowlist ?? []).join('\n'),
  );
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [isSavingAllowlist, setIsSavingAllowlist] = useState(false);

  const [activity, setActivity] = useState<SignInActivityEntry[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  useEffect(() => {
    if (!currentWorkspace) return;
    setEnforce2FA(currentWorkspace.enforce_2fa ?? false);
    setSessionTimeout((currentWorkspace.session_timeout_minutes ?? 0) as SessionTimeoutMinutes);
    setIpAllowlistText((currentWorkspace.ip_allowlist ?? []).join('\n'));
  }, [currentWorkspace?.id]);

  const loadActivity = useCallback(async () => {
    if (!currentWorkspace) return;
    setIsLoadingActivity(true);
    try {
      const entries = await workspaceService.getSignInActivity(currentWorkspace.id);
      setActivity(entries);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load sign-in activity';
      toast.error(msg);
    } finally {
      setIsLoadingActivity(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (showActivity) loadActivity();
  }, [showActivity, loadActivity]);

  if (!currentWorkspace) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm p-6">
        No organization selected.
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-rose-500" />
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Security</h3>
        </div>
        <SettingsCard>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Security policy is managed by organization owners and admins.
          </p>
        </SettingsCard>
      </div>
    );
  }

  const handleSavePolicy = async () => {
    setIsSavingPolicy(true);
    try {
      await updateWorkspace(currentWorkspace.id, {
        enforce_2fa: enforce2FA,
        session_timeout_minutes: sessionTimeout,
      });
      toast.success('Security policy updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update security policy';
      toast.error(msg);
    } finally {
      setIsSavingPolicy(false);
    }
  };

  const handleSaveAllowlist = async () => {
    const lines = ipAllowlistText.split('\n');
    const { valid, invalid } = validateCidrList(lines);
    if (invalid.length > 0) {
      toast.error(`Invalid CIDR: ${invalid.slice(0, 2).join(', ')}${invalid.length > 2 ? '...' : ''}`);
      return;
    }
    setIsSavingAllowlist(true);
    try {
      await updateWorkspace(currentWorkspace.id, { ip_allowlist: valid });
      setIpAllowlistText(valid.join('\n'));
      toast.success(valid.length === 0 ? 'IP allowlist cleared' : `Saved ${valid.length} CIDR block${valid.length === 1 ? '' : 's'}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update IP allowlist';
      toast.error(msg);
    } finally {
      setIsSavingAllowlist(false);
    }
  };

  const policyDirty =
    enforce2FA !== (currentWorkspace.enforce_2fa ?? false) ||
    sessionTimeout !== (currentWorkspace.session_timeout_minutes ?? 0);

  const allowlistDirty =
    ipAllowlistText.trim() !==
    (currentWorkspace.ip_allowlist ?? []).join('\n').trim();

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
          <Lock className="w-5 h-5 text-rose-500" />
          Security
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Organization-wide access controls: 2FA, session duration, network restrictions, and sign-in activity.
        </p>
      </div>

      {/* Enforce 2FA + Session timeout */}
      <SettingsCard className="space-y-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-zinc-500" />
          <MonoLabel>Access policy</MonoLabel>
        </div>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enforce2FA}
            onChange={(e) => setEnforce2FA(e.target.checked)}
            className="w-4 h-4 mt-0.5 text-rose-500 border-zinc-300 rounded focus:ring-rose-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-zinc-900 dark:text-white">
              Require two-factor authentication
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Every member must enroll TOTP in My Account before they can access this organization.
              Members without 2FA will be prompted on next sign-in.
            </p>
          </div>
        </label>

        {enforce2FA && !currentWorkspace.enforce_2fa && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Members who have not yet enrolled 2FA will be locked out until they do.
              Make sure your team is notified before saving.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="session-timeout" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-400" /> Session timeout
          </label>
          <select
            id="session-timeout"
            value={sessionTimeout}
            onChange={(e) => setSessionTimeout(Number(e.target.value) as SessionTimeoutMinutes)}
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          >
            {SESSION_TIMEOUT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-400 mt-1">
            After this period of inactivity, members will be signed out and must sign in again.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSavePolicy}
            disabled={isSavingPolicy || !policyDirty}
            className="px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSavingPolicy ? 'Saving...' : 'Save Policy'}
          </button>
        </div>
      </SettingsCard>

      {/* IP Allowlist */}
      <SettingsCard className="space-y-4">
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-zinc-500" />
          <MonoLabel>IP allowlist</MonoLabel>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Restrict organization access to specific networks. One CIDR block per line.
          Leave empty to allow all IPs.
        </p>

        <div>
          <label htmlFor="ip-allowlist" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Allowed CIDR blocks
          </label>
          <textarea
            id="ip-allowlist"
            value={ipAllowlistText}
            onChange={(e) => setIpAllowlistText(e.target.value)}
            rows={5}
            spellCheck={false}
            placeholder={'10.0.0.0/8\n192.168.1.0/24\n2001:db8::/32'}
            className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-y focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
          <p className="text-[11px] text-zinc-400 mt-1">
            IPv4 and IPv6 supported. Example: <code className="text-zinc-500">203.0.113.0/24</code>.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveAllowlist}
            disabled={isSavingAllowlist || !allowlistDirty}
            className="px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSavingAllowlist ? 'Saving...' : 'Save Allowlist'}
          </button>
        </div>
      </SettingsCard>

      {/* Sign-in activity */}
      <SettingsCard padded={false} className="overflow-hidden">
        <button
          type="button"
          onClick={() => setShowActivity(!showActivity)}
          className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-zinc-500" />
            <MonoLabel>Recent sign-in activity</MonoLabel>
          </div>
          <span className="text-xs text-zinc-400">{showActivity ? 'Hide' : 'Show'}</span>
        </button>

        {showActivity && (
          <div className="border-t border-zinc-200 dark:border-zinc-700 max-h-96 overflow-y-auto">
            {isLoadingActivity ? (
              <div className="p-6 text-center">
                <Loader2 className="w-5 h-5 text-zinc-400 animate-spin mx-auto" />
              </div>
            ) : activity.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400">
                No sign-in activity yet.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {activity.map((s) => (
                  <div key={s.session_id} className="px-4 py-3 flex items-start gap-3">
                    {deviceIcon(s.device_type)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-zinc-900 dark:text-white truncate">
                          {s.user_name || s.user_email || 'Unknown user'}
                        </p>
                        {s.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            <Circle className="w-1.5 h-1.5 fill-emerald-500 text-emerald-500" />
                            active
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400">revoked</span>
                        )}
                        {s.is_current && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 font-medium">
                            this session
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                        {[s.browser_name, s.os_name].filter(Boolean).join(' · ') || 'Unknown device'}
                        {s.ip_address && <> · <span className="font-mono">{s.ip_address}</span></>}
                        {s.location && <> · {s.location}</>}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {s.last_active_at
                          ? `Last active ${new Date(s.last_active_at).toLocaleString()}`
                          : `Created ${new Date(s.created_at).toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SettingsCard>
    </div>
  );
};
