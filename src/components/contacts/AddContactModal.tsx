import React, { useState } from 'react';
import { Contact } from '../../types';
import toast from 'react-hot-toast';

import { Loader2, Plus, UserPlus, X } from 'lucide-react';

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-rose-500', 'bg-teal-500',
];

// US-leaning E.164 input formatter. Strips non-digits, prepends +1
// when the first digit isn't already a country marker, then renders
// as "+1 (XXX) XXX-XXXX" while keeping international numbers
// (anything starting with +<2+ digits> or 11+ leading digits) intact
// as a raw "+<digits>" string. Avoids fighting the user mid-edit.
const formatPhoneInput = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  const startsWithPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits === '') return startsWithPlus ? '+' : '';
  // International (non-US) or already-prefixed with a non-1 country code.
  if (startsWithPlus && !digits.startsWith('1')) {
    return `+${digits}`;
  }
  // Normalize US digits: strip leading 1 if present.
  const us = digits.startsWith('1') ? digits.slice(1) : digits;
  if (us.length === 0) return '+1 ';
  if (us.length <= 3) return `+1 (${us}`;
  if (us.length <= 6) return `+1 (${us.slice(0, 3)}) ${us.slice(3)}`;
  return `+1 (${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6, 10)}`;
};

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (contact: Omit<Contact, 'id'>) => Promise<void>;
}

export const AddContactModal: React.FC<AddContactModalProps> = ({
  isOpen,
  onClose,
  onAdd
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    company: '',
    notes: ''
  });

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    
    setIsAdding(true);
    try {
      await onAdd({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        role: form.role || 'Contact',
        company: form.company || undefined,
        notes: form.notes || undefined,
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        status: 'offline',
        groups: [],
        source: 'local'
      });
      setForm({ name: '', email: '', phone: '', role: '', company: '', notes: '' });
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Failed to add contact');
    } finally {
      setIsAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-scale-in">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
          <h3 className="font-bold dark:text-white flex items-center gap-2">
            <UserPlus className="text-blue-500" /> Add New Contact
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition">
            <X />
          </button>
        </div>
        <div className="p-4 space-y-4">
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
                autoFocus
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
                onChange={(e) => setForm(prev => ({ ...prev, phone: formatPhoneInput(e.target.value) }))}
                placeholder="+1 (555) 123-4567"
                inputMode="tel"
                autoComplete="tel"
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
            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none"
              />
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.name.trim() || !form.email.trim() || isAdding}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
          >
            {isAdding ? <Loader2 className="animate-spin" /> : <Plus />}
            Add Contact
          </button>
        </div>
      </div>
    </div>
  );
};
