// ============================================
// contactAvatarService — upload a contact avatar to the `contact-avatars`
// Storage bucket (Phase 5). Client-side resize keeps uploads small; the path
// is `{userId}/{key}` so the per-user RLS policy
// (users_manage_own_contact_avatars: foldername[1] = auth.uid()) authorizes
// the write. Bucket is public → getPublicUrl renders directly in <img>.
// See docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md §4.5 (D3).
// ============================================

import { supabase } from './supabase';

const BUCKET = 'contact-avatars';
const MAX_DIM = 256; // avatars never need to be larger than this on screen

/** Downscale to <= MAX_DIM on the long edge and re-encode as webp. */
async function resizeToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Image encode failed'))),
        'image/webp',
        0.85,
      );
    });
  } finally {
    bitmap.close?.();
  }
}

/**
 * Upload a contact avatar and return its public URL (cache-busted so a re-upload
 * to the same path renders immediately). `key` is the contact id (Edit) or a
 * generated id (Add, where no contact id exists yet).
 */
export async function uploadContactAvatar(userId: string, key: string, file: File): Promise<string> {
  if (!userId) throw new Error('You must be signed in to upload an avatar.');
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');

  const blob = await resizeToWebp(file);
  const path = `${userId}/${key}.webp`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: 'image/webp',
    cacheControl: '3600',
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
