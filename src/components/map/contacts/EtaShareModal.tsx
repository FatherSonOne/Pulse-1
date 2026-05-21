// ============================================================
// EtaShareModal
//
// Two-step flow:
//   1. Pick which of the contact's locations (home/work) to share an
//      ETA to + how long the share should stay live (30m / 2h / 4h /
//      8h). Submit creates the row server-side and gets a token back.
//   2. Show the public URL with copy + native-share buttons. The
//      sharer keeps it open while moving; tap "Stop sharing" to end.
//
// Position + ETA updates are handled invisibly by the broadcast tick
// once the share row exists. This modal only handles creation +
// link delivery + manual cancel.
// ============================================================

import React, { useState } from 'react';
import { Briefcase, Check, Copy, Home, Loader2, Share2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Contact } from '../../../types';
import {
  createEtaShare,
  cancelEtaShare,
  EtaShare,
} from '../../../services/etaShareService';

interface EtaShareModalProps {
  contact: Contact;
  isOpen: boolean;
  isDarkMode: boolean;
  onClose: () => void;
}

const DURATION_OPTIONS = [
  { label: '30 min', minutes: 30 },
  { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 },
  { label: '8 hours', minutes: 480 },
];

const EtaShareModal: React.FC<EtaShareModalProps> = ({
  contact,
  isOpen,
  isDarkMode,
  onClose,
}) => {
  const hasHome = contact.homeLat != null && contact.homeLng != null;
  const hasWork = contact.workLat != null && contact.workLng != null;
  const initialDestination: 'home' | 'work' = hasHome ? 'home' : 'work';

  const [destinationType, setDestinationType] = useState<'home' | 'work'>(initialDestination);
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [creating, setCreating] = useState(false);
  const [share, setShare] = useState<EtaShare | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);

  if (!isOpen) return null;

  const bg = isDarkMode ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-200';
  const text = isDarkMode ? 'text-white' : 'text-gray-900';
  const sub = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  const handleCreate = async () => {
    const lat = destinationType === 'home' ? contact.homeLat : contact.workLat;
    const lng = destinationType === 'home' ? contact.homeLng : contact.workLng;
    const addr = destinationType === 'home' ? contact.homeAddress : contact.workAddress;
    if (lat == null || lng == null) {
      toast.error('Contact location missing');
      return;
    }

    setCreating(true);
    try {
      const result = await createEtaShare({
        destination: {
          lat,
          lng,
          label: addr || `${contact.name}'s ${destinationType}`,
        },
        expiresInMinutes: durationMinutes,
        recipientContactId: contact.id,
        recipientLabel: contact.name,
      });
      setShare(result.share);
      setShareUrl(result.url);
      toast.success('Live ETA share created');
    } catch (err) {
      console.error('[EtaShareModal] create failed', err);
      toast.error('Failed to create share');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Copy failed');
    }
  };

  const handleNativeShare = async () => {
    if (!shareUrl) return;
    if (!navigator.share) {
      handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: 'Live ETA',
        text: `I'm on my way — track me here:`,
        url: shareUrl,
      });
    } catch {
      // user dismissed — no toast needed
    }
  };

  const handleEnd = async () => {
    if (!share) return;
    setEnding(true);
    try {
      await cancelEtaShare(share.id);
      toast('Live ETA share stopped', { icon: '⏹' });
      onClose();
    } catch {
      toast.error('Failed to stop share');
    } finally {
      setEnding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${bg} animate-scale-in`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Share2 size={16} className="text-rose-500" />
            <h2 className={`text-base font-bold ${text}`}>
              {shareUrl ? 'Share is live' : 'Share Live ETA'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className={`p-1.5 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X size={14} />
          </button>
        </div>

        <div className={`mx-5 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`} />

        {!shareUrl ? (
          // Step 1: choose destination + duration
          <div className="p-5 space-y-4">
            <p className={`text-xs ${sub}`}>
              Share a public link with {contact.name.split(' ')[0]} that shows your live
              position and travel time. The link auto-expires.
            </p>

            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${sub}`}>
                Destination
              </label>
              <div className={`flex rounded-lg overflow-hidden text-xs ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
                {([
                  { value: 'home' as const, label: 'Home', Icon: Home, available: hasHome },
                  { value: 'work' as const, label: 'Work', Icon: Briefcase, available: hasWork },
                ]).map(({ value, label, Icon, available }) => (
                  <button
                    key={value}
                    disabled={!available}
                    onClick={() => available && setDestinationType(value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      destinationType === value
                        ? 'bg-rose-500 text-white'
                        : `${isDarkMode ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-200'}`
                    }`}
                  >
                    <Icon size={12} />
                    {label}
                  </button>
                ))}
              </div>
              {!hasHome && !hasWork && (
                <p className="text-xs text-amber-500 mt-1.5">
                  Add a home or work location for this contact first.
                </p>
              )}
            </div>

            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${sub}`}>
                Duration
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {DURATION_OPTIONS.map(opt => {
                  const active = durationMinutes === opt.minutes;
                  return (
                    <button
                      key={opt.minutes}
                      onClick={() => setDurationMinutes(opt.minutes)}
                      className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                        active
                          ? 'bg-rose-500 text-white'
                          : isDarkMode
                            ? 'bg-white/5 text-gray-300 hover:bg-white/10'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={creating || (!hasHome && !hasWork)}
              className="w-full py-2.5 rounded-xl bg-rose-500 text-white font-semibold hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
            >
              {creating && <Loader2 size={14} className="animate-spin" />}
              Create share link
            </button>
          </div>
        ) : (
          // Step 2: show the link
          <div className="p-5 space-y-4">
            <p className={`text-xs ${sub}`}>
              Send this link to {contact.name.split(' ')[0]}. It updates in real time and
              expires automatically. Make sure your Live Location toggle (Map header) is on
              so position updates flow.
            </p>

            <div className={`rounded-xl border p-3 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`text-xs font-mono break-all ${text}`}>{shareUrl}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopy}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors inline-flex items-center justify-center gap-1.5 ${
                  isDarkMode
                    ? 'border-white/15 text-white hover:bg-white/10'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={handleNativeShare}
                className="py-2 rounded-lg text-sm font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Share2 size={14} />
                Share
              </button>
            </div>

            <button
              onClick={handleEnd}
              disabled={ending}
              className="w-full py-2 rounded-lg text-xs font-medium text-rose-500 hover:underline disabled:opacity-50"
            >
              {ending ? 'Stopping…' : 'Stop sharing now'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EtaShareModal;
