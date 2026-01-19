import React, { useState, useEffect } from 'react';
import { Contact } from '../../types';

interface EditContactModalProps {
  isOpen: boolean;
  contact: Contact | null;
  onClose: () => void;
  onSave: (contact: Contact) => Promise<void>;
}

export const EditContactModal: React.FC<EditContactModalProps> = ({
  isOpen,
  contact,
  onClose,
  onSave
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    company: '',
    notes: '',
    groups: [] as string[],
  });

  // Sync form with contact when modal opens
  useEffect(() => {
    if (contact && isOpen) {
      setForm({
        name: contact.name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        role: contact.role || '',
        company: contact.company || '',
        notes: contact.notes || '',
        groups: contact.groups || [],
      });
    }
  }, [contact, isOpen]);

  const handleSubmit = async () => {
    if (!contact || !form.name.trim() || !form.email.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        ...contact,
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        role: form.role || 'Contact',
        company: form.company || undefined,
        notes: form.notes || undefined,
        groups: form.groups,
      });
      onClose();
    } catch (error) {
      console.error('Error saving contact:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddGroup = (group: string) => {
    if (group && !form.groups.includes(group)) {
      setForm(prev => ({ ...prev, groups: [...prev.groups, group] }));
    }
  };

  const handleRemoveGroup = (group: string) => {
    setForm(prev => ({ ...prev, groups: prev.groups.filter(g => g !== group) }));
  };

  if (!isOpen || !contact) return null;

  const PRESET_GROUPS = ['VIP', 'Prospect', 'Customer', 'Partner', 'Vendor', 'Team', 'Family', 'Friend'];

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-scale-in max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
          <h3 className="font-bold dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-user-pen text-blue-500"></i> Edit Contact
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Avatar Preview */}
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-16 h-16 rounded-full ${contact.avatarColor || 'bg-blue-500'} flex items-center justify-center text-2xl font-bold text-white`}>
              {form.name.charAt(0) || '?'}
            </div>
            <div className="flex-1">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Contact ID: {contact.id}</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">Source: {contact.source || 'local'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="John Doe"
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john@example.com"
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+1 555..."
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Role</label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value }))}
                placeholder="Manager"
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Company</label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => setForm(prev => ({ ...prev, company: e.target.value }))}
                placeholder="Acme Inc"
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>

            {/* Groups/Tags */}
            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Groups</label>

              {/* Current groups */}
              <div className="flex flex-wrap gap-2 mb-2">
                {form.groups.map(group => (
                  <span
                    key={group}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium"
                  >
                    {group}
                    <button
                      onClick={() => handleRemoveGroup(group)}
                      className="hover:text-blue-900 dark:hover:text-blue-100"
                    >
                      <i className="fa-solid fa-xmark text-[10px]"></i>
                    </button>
                  </span>
                ))}
                {form.groups.length === 0 && (
                  <span className="text-xs text-zinc-400">No groups assigned</span>
                )}
              </div>

              {/* Quick add buttons */}
              <div className="flex flex-wrap gap-1">
                {PRESET_GROUPS.filter(g => !form.groups.includes(g)).map(group => (
                  <button
                    key={group}
                    onClick={() => handleAddGroup(group)}
                    className="px-2 py-0.5 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                  >
                    + {group}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-between gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.name.trim() || !form.email.trim() || isSaving}
            className="px-6 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
          >
            {isSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
