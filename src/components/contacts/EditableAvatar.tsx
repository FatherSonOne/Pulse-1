// ============================================
// EditableAvatar — avatar display + upload affordance (Phase 5).
// Placed here (shared contacts dir) rather than hybrid/avatar/ as the handoff
// §5 suggested, because it is consumed by the SHARED Edit/Add modals — having
// those import from hybrid/ would be a backwards dependency. Also used by the
// hybrid FocusColumn/ContactListItem.
//
// Uploads via contactAvatarService to the public contact-avatars bucket and
// hands the resulting public URL back via onUploaded; the caller persists it as
// contact.avatarUrl. See docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md §4.5.
// ============================================

import React, { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadContactAvatar } from '../../services/contactAvatarService';

interface EditableAvatarProps {
  name: string;
  avatarColor?: string;
  avatarUrl?: string;
  userId?: string;
  /** Upload-path key under {userId}/ — contact id (Edit) or a generated id (Add). */
  storageKey: string;
  size?: number;
  onUploaded: (url: string) => void;
}

export const EditableAvatar: React.FC<EditableAvatarProps> = ({
  name,
  avatarColor,
  avatarUrl,
  userId,
  storageKey,
  size = 80,
  onUploaded,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState<string | undefined>(avatarUrl);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    if (!userId) {
      toast.error('Sign in to upload an avatar.');
      return;
    }
    setUploading(true);
    try {
      const next = await uploadContactAvatar(userId, storageKey, file);
      setUrl(next);
      onUploaded(next);
    } catch (err) {
      console.warn('[EditableAvatar] upload failed:', err);
      toast.error(err instanceof Error ? err.message : 'Avatar upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {url ? (
        <img
          src={url}
          alt={name}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white font-bold"
          style={{
            width: size,
            height: size,
            backgroundColor: avatarColor || '#6366f1',
            fontSize: size * 0.4,
          }}
        >
          {name.charAt(0).toUpperCase() || '?'}
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || !userId}
        title={userId ? 'Upload a photo' : 'Sign in to upload'}
        aria-label="Upload a photo"
        className="absolute -right-1 -bottom-1 w-7 h-7 rounded-full flex items-center justify-center border shadow disabled:opacity-50"
        style={{
          background: 'var(--pulse-surface)',
          borderColor: 'var(--pulse-border-strong)',
          color: 'var(--pulse-ink-2)',
        }}
      >
        {uploading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Camera className="w-3.5 h-3.5" />
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
    </div>
  );
};

export default EditableAvatar;
