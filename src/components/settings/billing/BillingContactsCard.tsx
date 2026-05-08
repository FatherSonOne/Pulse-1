import React, { useState, useEffect } from 'react';
import { Mail, Plus, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkspaceData, useWorkspaceActions } from '../../../contexts/WorkspaceContext';
import { SettingsCard } from '../shared/SettingsCard';
import { MonoLabel } from '../shared/MonoLabel';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CONTACTS = 10;

export const BillingContactsCard: React.FC = () => {
  const { currentWorkspace } = useWorkspaceData();
  const { updateWorkspace } = useWorkspaceActions();

  const [contacts, setContacts] = useState<string[]>([]);
  const [draft, setDraft]       = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!currentWorkspace) return;
    setContacts(currentWorkspace.billing_contacts ?? []);
  }, [currentWorkspace?.id, currentWorkspace?.billing_contacts]);

  if (!currentWorkspace) return null;

  const primary = currentWorkspace.billing_email;

  const addDraft = () => {
    const candidate = draft.trim().toLowerCase();
    if (!candidate) return;
    if (!EMAIL_REGEX.test(candidate)) {
      toast.error('Enter a valid email address');
      return;
    }
    if (candidate === primary?.toLowerCase()) {
      toast.error('That address is already the primary billing contact');
      return;
    }
    if (contacts.map(c => c.toLowerCase()).includes(candidate)) {
      toast.error('Already in the list');
      return;
    }
    if (contacts.length >= MAX_CONTACTS) {
      toast.error(`Maximum ${MAX_CONTACTS} additional contacts`);
      return;
    }
    setContacts(prev => [...prev, candidate]);
    setDraft('');
  };

  const removeContact = (email: string) => {
    setContacts(prev => prev.filter(c => c !== email));
  };

  const dirty = JSON.stringify(contacts) !== JSON.stringify(currentWorkspace.billing_contacts ?? []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateWorkspace(currentWorkspace.id, { billing_contacts: contacts });
      toast.success('Billing contacts saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save billing contacts';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsCard className="space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-zinc-500" />
        <MonoLabel>Billing contacts</MonoLabel>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Additional email addresses that receive invoices and billing notices alongside the primary contact.
      </p>

      <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide font-semibold text-zinc-400">Primary</span>
        <span className="text-sm text-zinc-700 dark:text-zinc-300">
          {primary || <em className="text-zinc-400">not set — defaults to the workspace owner</em>}
        </span>
      </div>

      {contacts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-zinc-400">CC list</p>
          {contacts.map((email) => (
            <div key={email} className="flex items-center justify-between gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-lg">
              <span className="text-sm text-zinc-700 dark:text-zinc-300 font-mono truncate">{email}</span>
              <button
                type="button"
                onClick={() => removeContact(email)}
                className="p-1 text-zinc-400 hover:text-red-500 rounded"
                aria-label={`Remove ${email}`}
                title="Remove"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {contacts.length < MAX_CONTACTS && (
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDraft(); } }}
            placeholder="finance@example.com"
            spellCheck={false}
            autoComplete="off"
            className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
          <button
            type="button"
            onClick={addDraft}
            disabled={!draft.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      )}

      <p className="text-[10px] text-zinc-400">
        {contacts.length} of {MAX_CONTACTS} additional contacts
      </p>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !dirty}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Contacts'}
        </button>
      </div>
    </SettingsCard>
  );
};
