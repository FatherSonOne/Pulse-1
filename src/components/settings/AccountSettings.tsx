import React, { useState, useEffect, useRef } from 'react';
import { pulseService, UserProfile } from '../../services/pulseService';
import { supabase } from '../../services/supabase';
import { logoutUser } from '../../services/authService';
import { Camera, Check, Loader2, LogOut, User as UserIcon } from 'lucide-react';

interface AccountSettingsProps {
  user?: { id: string; name?: string; email?: string; connectedProviders?: any } | null;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ToggleItem = ({
  label,
  desc,
  active,
  onToggle,
}: {
  label: string;
  desc: string;
  active: boolean;
  onToggle: () => void;
}) => (
  <div className="flex justify-between items-center group cursor-pointer" onClick={onToggle}>
    <div>
      <div className="dark:text-white text-zinc-900 font-medium text-sm">{label}</div>
      <div className="text-zinc-500 text-xs">{desc}</div>
    </div>
    <button
      className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${active ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
    >
      <div
        className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${active ? 'translate-x-6' : 'translate-x-0'}`}
      />
    </button>
  </div>
);

export const AccountSettings: React.FC<AccountSettingsProps> = ({ user, isDarkMode, toggleTheme }) => {
  const [name, setName] = useState(user?.name || 'Demo User');
  const [email, setEmail] = useState(user?.email || 'user@example.com');
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setIsUploadingImage(true);

    try {
      // Convert to data URL for immediate preview
      const reader = new FileReader();
      const dataUrlPromise = new Promise<string>((resolve) => {
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setProfileImageUrl(dataUrl);
          resolve(dataUrl);
        };
        reader.readAsDataURL(file);
      });

      const dataUrl = await dataUrlPromise;

      // Try to upload to Supabase storage if available
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && supabase.storage) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}.${fileExt}`;
          const filePath = `avatars/${fileName}`;

          // Upload to Supabase storage
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: true
            });

          if (!uploadError) {
            // Get public URL
            const { data: urlData } = supabase.storage
              .from('avatars')
              .getPublicUrl(filePath);

            if (urlData?.publicUrl) {
              setProfileImageUrl(urlData.publicUrl);
              // Update profile with storage URL
              await pulseService.updateProfile({ avatar_url: urlData.publicUrl });
              setPulseProfile(prev => prev ? { ...prev, avatar_url: urlData.publicUrl } : null);
              setIsUploadingImage(false);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
              return;
            }
          }
        }
      } catch (storageError) {
        // Storage not available or error, fall through to data URL method
        console.log('Storage upload not available, using data URL:', storageError);
      }

      // Fallback: use data URL and save to profile
      await pulseService.updateProfile({ avatar_url: dataUrl });
      setPulseProfile(prev => prev ? { ...prev, avatar_url: dataUrl } : null);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
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
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Profile</h4>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="relative group mx-auto md:mx-0">
            <div
              className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl overflow-hidden cursor-pointer"
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
                name.charAt(0)
              )}
            </div>
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none">
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
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 dark:text-white text-zinc-900 focus:border-blue-500 focus:outline-none transition"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Pulse Handle</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">@</span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className={`w-full bg-zinc-50 dark:bg-zinc-800 border rounded-lg pl-7 pr-10 py-2.5 dark:text-white text-zinc-900 focus:outline-none transition ${
                      handleError ? 'border-red-400 focus:border-red-500' :
                      handleAvailable ? 'border-emerald-400 focus:border-emerald-500' :
                      'border-zinc-200 dark:border-zinc-700 focus:border-blue-500'
                    }`}
                  />
                  {handleAvailable && !handleError && <Check className="text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                </div>
                {handleError && <p className="text-xs text-red-500">{handleError}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={2}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 dark:text-white text-zinc-900 focus:border-blue-500 focus:outline-none transition resize-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile || (handle !== pulseProfile?.handle && !handleAvailable && handle !== '')}
                className="px-6 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingProfile ? <Loader2 className="animate-spin" /> : <Check />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Appearance Section */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Appearance</h4>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => !isDarkMode && toggleTheme()}
            className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${isDarkMode ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'}`}
          >
            <i className={`fa-solid fa-moon ${isDarkMode ? 'text-blue-500' : 'text-zinc-400'}`}></i>
            <span className="text-xs font-medium dark:text-zinc-300 text-zinc-600">Dark Mode</span>
          </button>
          <button
            onClick={() => isDarkMode && toggleTheme()}
            className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${!isDarkMode ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}`}
          >
            <i className={`fa-solid fa-sun ${!isDarkMode ? 'text-blue-500' : 'text-zinc-400'}`}></i>
            <span className="text-xs font-medium dark:text-zinc-300 text-zinc-600">Light Mode</span>
          </button>
        </div>
      </div>

      {/* Session Management */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Session Management</h4>
        <div className="space-y-4">
          <ToggleItem
            label="Keep me logged in"
            desc="Stay signed in on this browser until you explicitly log out"
            active={keepLoggedIn}
            onToggle={() => setKeepLoggedIn(!keepLoggedIn)}
          />

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={async () => {
                if (confirm('Are you sure you want to log out?')) {
                  await logoutUser();
                }
              }}
              className="text-red-500 hover:text-red-600 font-medium text-sm flex items-center gap-2"
            >
              <LogOut />
              Log Out of Pulse
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
