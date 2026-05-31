import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { pulseService, UserProfile } from '../../services/pulseService';
import { logoutUser } from '../../services/authService';
import { settingsService } from '../../services/settingsService';
import { Camera, Check, Loader2, LogOut, Monitor, Moon, Sun, User as UserIcon } from 'lucide-react';
import { ToggleItem } from './shared/ToggleItem';
import { SettingsCard } from './shared/SettingsCard';
import { MonoLabel } from './shared/MonoLabel';
import { TwoFactorAuthCard } from './account/TwoFactorAuthCard';
import { DevicesSessionsCard } from './account/DevicesSessionsCard';
import { LocaleSettingsCard } from './account/LocaleSettingsCard';

type ThemeMode = 'system' | 'light' | 'dark';

interface AccountSettingsProps {
  user?: { id: string; name?: string; email?: string; connectedProviders?: any } | null;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({ user, isDarkMode, toggleTheme }) => {
  const [name, setName] = useState(user?.name || 'Demo User');
  const [email, setEmail] = useState(user?.email || 'user@example.com');
  const [keepLoggedIn, setKeepLoggedIn] = useState(() => localStorage.getItem('pulse_keep_logged_in') !== 'false');
  const [pulseProfile, setPulseProfile] = useState<UserProfile | null>(null);
  const [handle, setHandle] = useState('');
  const [handleError, setHandleError] = useState<string | null>(null);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [bio, setBio] = useState('');
  const [isPublicProfile, setIsPublicProfile] = useState(true);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('pulse_theme_mode');
    if (stored === 'system' || stored === 'light' || stored === 'dark') return stored;
    return isDarkMode ? 'dark' : 'light';
  });

  // Keep the actual theme in sync with the chosen mode. System mode follows OS.
  useEffect(() => {
    if (themeMode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const sync = () => {
        if (mq.matches !== isDarkMode) toggleTheme();
      };
      sync();
      mq.addEventListener('change', sync);
      return () => mq.removeEventListener('change', sync);
    }
    const wantDark = themeMode === 'dark';
    if (wantDark !== isDarkMode) toggleTheme();
  }, [themeMode, isDarkMode, toggleTheme]);

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem('pulse_theme_mode', mode);
  };

  // Load Pulse profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await pulseService.getCurrentProfile();
        if (profile) {
          setPulseProfile(profile);
          setHandle(profile.handle || '');
          setBio(profile.bio || '');
          setIsPublicProfile(profile.is_public);
          if (profile.display_name) setName(profile.display_name);
          if (profile.avatar_url) setProfileImageUrl(profile.avatar_url);
        }
      } catch (error) {
        console.error('Error loading pulse profile:', error);
      }
    };
    loadProfile();
  }, []);

  // Unsaved changes guard
  const isDirty = pulseProfile && (
    name !== (pulseProfile.display_name || '') ||
    bio !== (pulseProfile.bio || '') ||
    handle !== (pulseProfile.handle || '')
  );

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Debounced handle availability check
  useEffect(() => {
    if (!handle || handle === pulseProfile?.handle) {
      setHandleError(null);
      setHandleAvailable(null);
      return;
    }

    const validation = pulseService.validateHandle(handle);
    if (!validation.valid) {
      setHandleError(validation.error || 'Invalid handle');
      setHandleAvailable(null);
      return;
    }

    setHandleError(null);
    const timeout = setTimeout(async () => {
      setIsCheckingHandle(true);
      try {
        const available = await pulseService.isHandleAvailable(handle);
        setHandleAvailable(available);
        if (!available) {
          setHandleError('This handle is already taken');
        }
      } catch (error) {
        console.error('Error checking handle:', error);
        setHandleError('Unable to check availability');
      } finally {
        setIsCheckingHandle(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [handle, pulseProfile?.handle]);

  // Handle profile image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setIsUploadingImage(true);

    // Instant local preview via an object URL — this is NEVER persisted to the DB.
    const previewUrl = URL.createObjectURL(file);
    setProfileImageUrl(previewUrl);

    try {
      // Upload the file to Supabase Storage (pulse-attachments) and persist the
      // resulting PUBLIC URL — never a base64 data URL. Inline base64 avatars
      // bloat user_profiles rows to >1 MB and get re-shipped on every
      // contact-directory query, which was the cause of a multi-GB Supabase
      // egress spike. (The old code uploaded to a non-existent `avatars` bucket,
      // silently failed, and fell back to saving the data URL.) See
      // scripts/migrate-base64-avatars.mjs for the one-time backfill.
      const { url } = await pulseService.uploadAttachment(file);

      await pulseService.updateProfile({ avatar_url: url });
      setProfileImageUrl(url);
      setPulseProfile(prev => (prev ? { ...prev, avatar_url: url } : null));
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Could not upload image. Try again.');
      // Revert the optimistic preview to the previously saved avatar so we never
      // leave a transient blob URL staged for save.
      setProfileImageUrl(pulseProfile?.avatar_url || '');
    } finally {
      URL.revokeObjectURL(previewUrl);
      setIsUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Save profile handler
  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setProfileSaveSuccess(false);
    try {
      const updates: Partial<UserProfile> = {
        display_name: name,
        bio: bio,
        is_public: isPublicProfile
      };

      // Include avatar URL if it was updated
      if (profileImageUrl && profileImageUrl !== pulseProfile?.avatar_url) {
        updates.avatar_url = profileImageUrl;
      }

      // Only update handle if it changed and is available
      if (handle && handle !== pulseProfile?.handle) {
        if (!handleAvailable) {
          setHandleError('Please choose an available handle');
          setIsSavingProfile(false);
          return;
        }
        updates.handle = handle;
      }

      const updated = await pulseService.updateProfile(updates);
      setPulseProfile(updated);
      if (updated.avatar_url) setProfileImageUrl(updated.avatar_url);
      setProfileSaveSuccess(true);
      setTimeout(() => setProfileSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setHandleError(error.message || 'Failed to save profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="section-header">
        <h3>
          <UserIcon /> My Account
        </h3>
        <p>
          Manage your personal profile, appearance, and session settings.
        </p>
      </div>

      {/* Profile Section */}
      <SettingsCard>
        <MonoLabel className="mb-6">Profile</MonoLabel>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="relative group mx-auto md:mx-0">
            <div
              className="relative w-24 h-24 rounded-full bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 flex items-center justify-center text-3xl font-semibold text-rose-500 dark:text-rose-400 overflow-hidden cursor-pointer transition-colors hover:bg-rose-500/15 dark:hover:bg-rose-500/20"
              onClick={() => fileInputRef.current?.click()}
              title="Click to edit profile image"
            >
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="absolute inset-0 bg-zinc-950/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none">
              {isUploadingImage ? (
                <Loader2 className="text-white animate-spin" />
              ) : (
                <Camera className="text-white" />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          <div className="flex-1 space-y-4 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <MonoLabel as="label">Display Name</MonoLabel>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 dark:text-white text-zinc-900 focus:border-rose-500 focus:outline-none transition"
                />
              </div>
              <div className="space-y-2">
                <MonoLabel as="label">Pulse Handle</MonoLabel>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">@</span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className={`w-full bg-zinc-50 dark:bg-zinc-800 border rounded-lg pl-7 pr-10 py-2.5 dark:text-white text-zinc-900 focus:outline-none transition ${
                      handleError ? 'border-red-400 focus:border-red-500' :
                      handleAvailable ? 'border-emerald-400 focus:border-emerald-500' :
                      'border-zinc-200 dark:border-zinc-700 focus:border-rose-500'
                    }`}
                  />
                  {handleAvailable && !handleError && <Check className="text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                </div>
                {handleError && <p className="text-xs text-red-500">{handleError}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <MonoLabel as="label">Bio</MonoLabel>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={2}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 dark:text-white text-zinc-900 focus:border-rose-500 focus:outline-none transition resize-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile || (handle !== pulseProfile?.handle && !handleAvailable && handle !== '')}
                className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingProfile ? <Loader2 className="animate-spin" /> : <Check />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Appearance Section */}
      <SettingsCard>
        <MonoLabel className="mb-4">Appearance</MonoLabel>

        <div
          role="radiogroup"
          aria-label="Theme mode"
          className="inline-flex p-1 rounded-lg border"
          style={{
            backgroundColor: 'var(--pulse-canvas-soft)',
            borderColor: 'var(--pulse-border)',
          }}
        >
          {([
            { id: 'system', label: 'System', Icon: Monitor },
            { id: 'light', label: 'Light', Icon: Sun },
            { id: 'dark', label: 'Dark', Icon: Moon },
          ] as const).map(({ id, label, Icon }) => {
            const isActive = themeMode === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => handleThemeChange(id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-medium transition ${
                  isActive
                    ? 'text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
                style={isActive ? { backgroundColor: 'var(--pulse-surface)' } : undefined}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2.5">
          {themeMode === 'system'
            ? 'Following your operating system. Changes when your OS does.'
            : `Always ${themeMode === 'dark' ? 'dark' : 'light'}, regardless of OS preference.`}
        </p>
      </SettingsCard>

      {/* Language & Timezone */}
      <LocaleSettingsCard
        initialProfile={pulseProfile}
        onProfileUpdated={(p) => setPulseProfile(p)}
      />

      {/* Two-factor authentication */}
      <TwoFactorAuthCard />

      {/* Devices & sessions */}
      <DevicesSessionsCard />

      {/* Session Management */}
      <SettingsCard>
        <MonoLabel className="mb-6">Session Management</MonoLabel>
        <div className="space-y-4">
          <ToggleItem
            label="Keep me logged in"
            desc="Stay signed in on this browser until you explicitly log out"
            active={keepLoggedIn}
            onToggle={() => {
              const v = !keepLoggedIn;
              setKeepLoggedIn(v);
              localStorage.setItem('pulse_keep_logged_in', String(v));
            }}
          />

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => {
                toast(
                  (t) => (
                    <div className="flex flex-col gap-3">
                      <span className="text-sm text-zinc-900 dark:text-white">Log out of Pulse?</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            toast.dismiss(t.id);
                            await logoutUser();
                          }}
                          className="px-3 py-1 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded transition"
                        >
                          Log out
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
                  { duration: 6000 }
                );
              }}
              className="text-red-500 hover:text-red-600 font-medium text-sm flex items-center gap-2"
            >
              <LogOut />
              Log Out of Pulse
            </button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};
