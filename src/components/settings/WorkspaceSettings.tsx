import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AlertTriangle, Building2, Archive, Trash2, Camera, Loader2, ArrowRightLeft, ScrollText, Clock, Globe, Briefcase, Users, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkspaceData, useWorkspaceActions, useWorkspacePermissions } from '../../contexts/WorkspaceContext';
import { workspaceService, AuditLogEntry, OrgSizeBucket } from '../../services/workspaceService';
import { DeleteWorkspaceDialog } from './DeleteWorkspaceDialog';
import { supabase } from '../../services/supabase';
import { SettingsCard } from './shared/SettingsCard';
import { MonoLabel } from './shared/MonoLabel';

const SIZE_OPTIONS: { value: OrgSizeBucket; label: string }[] = [
  { value: '1-10',   label: '1–10' },
  { value: '11-50',  label: '11–50' },
  { value: '51-200', label: '51–200' },
  { value: '200+',   label: '200+' },
];

export const WorkspaceSettings: React.FC = () => {
  const { currentWorkspace, members } = useWorkspaceData();
  const { softDeleteWorkspace, hardDeleteWorkspace, updateWorkspace, refreshWorkspaces, refreshMembers } = useWorkspaceActions();
  const { isOwner, isAdmin } = useWorkspacePermissions();

  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit state
  const [name, setName] = useState(currentWorkspace?.name ?? '');
  const [description, setDescription] = useState(currentWorkspace?.description ?? '');
  const [legalName, setLegalName] = useState(currentWorkspace?.legal_name ?? '');
  const [industry, setIndustry] = useState(currentWorkspace?.industry ?? '');
  const [sizeBucket, setSizeBucket] = useState<OrgSizeBucket | ''>(currentWorkspace?.size_bucket ?? '');
  const [billingEmail, setBillingEmail] = useState(currentWorkspace?.billing_email ?? '');
  const [autoJoinDomain, setAutoJoinDomain] = useState(currentWorkspace?.auto_join_domain ?? '');
  const [autoJoinEnabled, setAutoJoinEnabled] = useState(currentWorkspace?.auto_join_enabled ?? false);
  const [isSavingMembership, setIsSavingMembership] = useState(false);
  const [isSavingBilling, setIsSavingBilling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Refs + highlight state for deep-linked onboarding focus
  // (?focus=logo | auto-join | billing-contact). When the onboarding
  // checklist deep-links here, we scroll to and visually highlight the
  // specific card so the user doesn't have to hunt through a long settings page.
  const avatarCardRef = useRef<HTMLDivElement>(null);
  const autoJoinCardRef = useRef<HTMLDivElement>(null);
  const billingContactCardRef = useRef<HTMLDivElement>(null);
  type FocusTarget = 'logo' | 'auto-join' | 'billing-contact';
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const focus = params.get('focus');
    if (focus !== 'logo' && focus !== 'auto-join' && focus !== 'billing-contact') return;

    setFocusTarget(focus);

    const t = setTimeout(() => {
      const target =
        focus === 'logo' ? avatarCardRef.current
        : focus === 'auto-join' ? autoJoinCardRef.current
        : billingContactCardRef.current;
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // For `logo`, open the file picker directly — the existing UI hides the
      // upload behind a hover-revealed Camera button, which is invisible to
      // someone who didn't already know it was there.
      if (focus === 'logo') {
        setTimeout(() => avatarInputRef.current?.click(), 350);
      }
    }, 50);

    const fade = setTimeout(() => setFocusTarget(null), 3000);

    params.delete('focus');
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`,
    );

    return () => { clearTimeout(t); clearTimeout(fade); };
  }, []);

  // Sync local form state when the active workspace changes.
  useEffect(() => {
    if (!currentWorkspace) return;
    setName(currentWorkspace.name ?? '');
    setDescription(currentWorkspace.description ?? '');
    setLegalName(currentWorkspace.legal_name ?? '');
    setIndustry(currentWorkspace.industry ?? '');
    setSizeBucket(currentWorkspace.size_bucket ?? '');
    setBillingEmail(currentWorkspace.billing_email ?? '');
    setAutoJoinDomain(currentWorkspace.auto_join_domain ?? '');
    setAutoJoinEnabled(currentWorkspace.auto_join_enabled ?? false);
  }, [currentWorkspace?.id]);

  // Transfer state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Audit log state
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  const loadAuditLog = useCallback(async () => {
    if (!currentWorkspace) return;
    setIsLoadingAudit(true);
    try {
      const entries = await workspaceService.getAuditLog(currentWorkspace.id);
      setAuditLog(entries);
    } catch {
      // non-fatal
    } finally {
      setIsLoadingAudit(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (showAuditLog) loadAuditLog();
  }, [showAuditLog, loadAuditLog]);

  if (!currentWorkspace) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm p-6">
        No organization selected.
      </div>
    );
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentWorkspace) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2 MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${currentWorkspace.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('workspace-avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('workspace-avatars')
        .getPublicUrl(path);

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await updateWorkspace(currentWorkspace.id, { avatar_url: avatarUrl });
      toast.success('Avatar updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload avatar';
      toast.error(msg);
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Organization name is required');
      return;
    }
    setIsSaving(true);
    try {
      await updateWorkspace(currentWorkspace.id, {
        name: name.trim(),
        description: description.trim() || null,
        legal_name: legalName.trim() || null,
        industry: industry.trim() || null,
        size_bucket: sizeBucket || null,
      });
      toast.success('Organization updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update organization';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMembership = async () => {
    const normalizedDomain = autoJoinDomain.trim().toLowerCase().replace(/^@/, '');
    if (autoJoinEnabled && !normalizedDomain) {
      toast.error('Enter a domain to enable auto-join');
      return;
    }
    if (normalizedDomain && !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(normalizedDomain)) {
      toast.error('Enter a valid domain (e.g., acme.com)');
      return;
    }
    setIsSavingMembership(true);
    try {
      await updateWorkspace(currentWorkspace.id, {
        auto_join_domain: normalizedDomain || null,
        auto_join_enabled: !!normalizedDomain && autoJoinEnabled,
      });
      toast.success('Membership policy updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update membership policy';
      toast.error(msg);
    } finally {
      setIsSavingMembership(false);
    }
  };

  const handleSaveBilling = async () => {
    const trimmed = billingEmail.trim();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Enter a valid email address');
      return;
    }
    setIsSavingBilling(true);
    try {
      await updateWorkspace(currentWorkspace.id, {
        billing_email: trimmed || null,
      });
      toast.success('Billing contact updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update billing contact';
      toast.error(msg);
    } finally {
      setIsSavingBilling(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteMode) return;
    setIsDeleting(true);
    const toastId = toast.loading(
      deleteMode === 'soft' ? 'Archiving organization...' : 'Permanently deleting organization...',
    );
    try {
      if (deleteMode === 'soft') {
        await softDeleteWorkspace(currentWorkspace.id);
        toast.success('Organization archived. You have 30 days to restore it.', { id: toastId });
      } else {
        await hardDeleteWorkspace(currentWorkspace.id);
        toast.success('Organization permanently deleted.', { id: toastId });
      }
      setDeleteMode(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete organization';
      toast.error(msg, { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferTargetId || !currentWorkspace) return;
    const target = members.find(m => m.user_id === transferTargetId);
    if (!confirm(`Transfer ownership of "${currentWorkspace.name}" to ${target?.name || 'this member'}? You will be demoted to admin.`)) return;

    setIsTransferring(true);
    try {
      await workspaceService.transferOwnership(currentWorkspace.id, transferTargetId);
      toast.success('Ownership transferred');
      setShowTransfer(false);
      setTransferTargetId('');
      await Promise.all([refreshWorkspaces(), refreshMembers()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to transfer ownership';
      toast.error(msg);
    } finally {
      setIsTransferring(false);
    }
  };

  const nonOwnerMembers = members.filter(m => m.role !== 'owner');

  const formatAction = (action: string) => action.replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Organization info */}
      <div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-rose-500" />
          Organization
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Your organization profile, membership policy, and lifecycle.
        </p>
      </div>

      {/* Avatar + Edit fields */}
      <div
        ref={avatarCardRef}
        className="scroll-mt-4 rounded-2xl transition-shadow"
        style={{
          boxShadow: focusTarget === 'logo' ? '0 0 0 3px rgba(244, 63, 94, 0.45)' : 'none',
        }}
      >
      <SettingsCard className="space-y-4">
        {focusTarget === 'logo' && (
          <div className="flex items-center gap-2 px-3 py-2 -mt-1 mb-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
            <Camera className="w-3.5 h-3.5" />
            <span>Pick an image to use as your organization logo — the avatar block below opens the upload dialog.</span>
          </div>
        )}
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="w-16 h-16 rounded-xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 flex items-center justify-center text-rose-500 dark:text-rose-400 text-xl font-semibold overflow-hidden">
              {currentWorkspace.avatar_url ? (
                <img src={currentWorkspace.avatar_url} alt={currentWorkspace.name} className="w-full h-full object-cover" />
              ) : (
                currentWorkspace.name.charAt(0).toUpperCase()
              )}
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                aria-label={currentWorkspace.avatar_url ? 'Replace logo' : 'Upload logo'}
                // Always visible when no avatar is set yet (discoverable for
                // first-time setup); fades to hover-only after an avatar exists
                // so it doesn't obscure the real image.
                className={`absolute inset-0 flex items-center justify-center rounded-xl transition ${
                  currentWorkspace.avatar_url
                    ? 'bg-zinc-950/60 opacity-0 group-hover:opacity-100'
                    : 'bg-zinc-950/40 opacity-100'
                }`}
              >
                {isUploadingAvatar ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </button>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              aria-label="Upload workspace avatar"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-900 dark:text-white">{currentWorkspace.name}</p>
            <p className="text-xs text-zinc-500">{currentWorkspace.slug ? `slug: ${currentWorkspace.slug}` : 'Organization'}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Organization name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isAdmin}
            maxLength={80}
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Legal name <span className="text-xs text-zinc-400 font-normal">(optional)</span></label>
          <input
            type="text"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            disabled={!isAdmin}
            placeholder="e.g., Acme Incorporated"
            maxLength={120}
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!isAdmin}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white disabled:opacity-50 resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-zinc-400" /> Industry
            </label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              disabled={!isAdmin}
              placeholder="e.g., Media, SaaS, Consulting"
              maxLength={60}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-zinc-400" /> Team size
            </label>
            <select
              value={sizeBucket}
              onChange={(e) => setSizeBucket(e.target.value as OrgSizeBucket | '')}
              disabled={!isAdmin}
              aria-label="Team size"
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            >
              <option value="">Select size...</option>
              {SIZE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        {isAdmin && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || (
                name.trim() === (currentWorkspace.name ?? '') &&
                (description.trim() || '') === (currentWorkspace.description || '') &&
                (legalName.trim() || '') === (currentWorkspace.legal_name || '') &&
                (industry.trim() || '') === (currentWorkspace.industry || '') &&
                (sizeBucket || '') === (currentWorkspace.size_bucket || '')
              )}
              className="px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </SettingsCard>
      </div>

      {/* Membership policy — admin+ */}
      {isAdmin && (
      <div
        ref={autoJoinCardRef}
        className="scroll-mt-4 rounded-2xl transition-shadow"
        style={{
          boxShadow: focusTarget === 'auto-join' ? '0 0 0 3px rgba(244, 63, 94, 0.45)' : 'none',
        }}
      >
        <SettingsCard className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-zinc-500" />
            <MonoLabel>Membership policy</MonoLabel>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            When enabled, anyone signing up with this email domain automatically joins your organization as a Member.
          </p>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Auto-join domain</label>
            <input
              type="text"
              value={autoJoinDomain}
              onChange={(e) => setAutoJoinDomain(e.target.value)}
              placeholder="acme.com"
              autoComplete="off"
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            />
            <p className="text-[11px] text-zinc-400 mt-1">No "@" — just the domain.</p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoJoinEnabled}
              onChange={(e) => setAutoJoinEnabled(e.target.checked)}
              className="w-4 h-4 text-rose-500 border-zinc-300 rounded focus:ring-rose-500"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">Enable auto-join for this domain</span>
          </label>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveMembership}
              disabled={isSavingMembership || (
                (autoJoinDomain.trim().toLowerCase().replace(/^@/, '')) === (currentWorkspace.auto_join_domain || '') &&
                autoJoinEnabled === (currentWorkspace.auto_join_enabled ?? false)
              )}
              className="px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSavingMembership ? 'Saving...' : 'Save Policy'}
            </button>
          </div>
        </SettingsCard>
      </div>
      )}

      {/* Billing contact — admin+ */}
      {isAdmin && (
      <div
        ref={billingContactCardRef}
        className="scroll-mt-4 rounded-2xl transition-shadow"
        style={{
          boxShadow: focusTarget === 'billing-contact' ? '0 0 0 3px rgba(244, 63, 94, 0.45)' : 'none',
        }}
      >
        <SettingsCard className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-zinc-500" />
            <MonoLabel>Billing contact</MonoLabel>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Where invoices, receipts, and payment notices are sent. Defaults to the owner's email if empty.
          </p>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Billing email</label>
            <input
              type="email"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              placeholder="billing@acme.com"
              autoComplete="off"
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveBilling}
              disabled={isSavingBilling || (billingEmail.trim() === (currentWorkspace.billing_email || ''))}
              className="px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSavingBilling ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </SettingsCard>
      </div>
      )}

      {/* Transfer Ownership — owner only */}
      {isOwner && nonOwnerMembers.length > 0 && (
        <SettingsCard className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-zinc-500" />
              <MonoLabel>Transfer Ownership</MonoLabel>
            </div>
            <button
              type="button"
              onClick={() => setShowTransfer(!showTransfer)}
              className="text-xs text-rose-500 hover:text-rose-600 font-medium"
            >
              {showTransfer ? 'Cancel' : 'Transfer'}
            </button>
          </div>
          {showTransfer && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Transfer ownership to another member. You will become an admin.
              </p>
              <select
                value={transferTargetId}
                onChange={(e) => setTransferTargetId(e.target.value)}
                aria-label="New owner"
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
              >
                <option value="">Select a member...</option>
                {nonOwnerMembers.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name || m.email || m.user_id} ({m.role})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={!transferTargetId || isTransferring}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition disabled:opacity-40"
              >
                {isTransferring ? 'Transferring...' : 'Confirm Transfer'}
              </button>
            </div>
          )}
        </SettingsCard>
      )}

      {/* Audit Log — admin+ */}
      {isAdmin && (
        <SettingsCard padded={false} className="overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAuditLog(!showAuditLog)}
            className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
          >
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-zinc-500" />
              <MonoLabel>Audit Log</MonoLabel>
            </div>
            <span className="text-xs text-zinc-400">{showAuditLog ? 'Hide' : 'Show'}</span>
          </button>
          {showAuditLog && (
            <div className="border-t border-zinc-200 dark:border-zinc-700 max-h-80 overflow-y-auto">
              {isLoadingAudit ? (
                <div className="p-6 text-center">
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin mx-auto" />
                </div>
              ) : auditLog.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400">No audit entries yet.</div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {auditLog.map(entry => (
                    <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                      <Clock className="w-3.5 h-3.5 text-zinc-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-700 dark:text-zinc-300">
                          <span className="font-medium">{formatAction(entry.action)}</span>
                          {entry.target_id && (
                            <span className="text-zinc-400"> &middot; {entry.target_id.slice(0, 8)}...</span>
                          )}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          {new Date(entry.created_at).toLocaleString()} &middot; by {entry.actor_id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </SettingsCard>
      )}

      {/* Danger Zone — only for owner/admin */}
      {isAdmin && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h4 className="text-sm font-bold text-red-600 dark:text-red-400">Danger Zone</h4>
          </div>

          <p className="text-xs text-red-600/80 dark:text-red-400/80">
            Archiving hides the organization from all members. The owner has 30 days to restore it before
            data becomes eligible for permanent deletion.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setDeleteMode('soft')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
            >
              <Archive className="w-4 h-4" />
              Archive Organization
            </button>

            {isOwner && (
              <button
                type="button"
                onClick={() => setDeleteMode('hard')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
                Permanently Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {deleteMode && (
        <DeleteWorkspaceDialog
          workspaceName={currentWorkspace.name}
          mode={deleteMode}
          isOpen={true}
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteMode(null)}
        />
      )}
    </div>
  );
};
