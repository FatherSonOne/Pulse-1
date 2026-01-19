
import React, { useState, useEffect, useRef } from 'react';
import { User, MessageSource } from '../types';
import { UnifiedMessage } from '../types/index';
import { SlackService } from '../services/slackService';
import { GmailService } from '../services/gmailService';
import { TwilioService } from '../services/twilioService';
import { unifiedInboxDb } from '../services/unifiedInboxDb';
import { dataService } from '../services/dataService';
import { pulseService, UserProfile } from '../services/pulseService';
import { supabase } from '../services/supabase';
import { loginWithGoogle, revokeGoogleAccess, disconnectGoogleAccount } from '../services/authService';
import { NotificationSettings } from './NotificationSettings';
import { DesignPreview } from './WarRoom/DesignPreview';
import AdminDashboard from './AdminDashboard';
import { ApiKeysPanel } from './ApiKeys';
import './Settings.css';


interface SettingsProps {
    user?: User | null;
    isDarkMode: boolean;
    toggleTheme: () => void;
    initialSection?: string;
}

const SECTIONS = [
  { id: 'account', icon: 'fa-user', label: 'My Account' },
  { id: 'ai_intelligence', icon: 'fa-brain', label: 'AI & Intelligence' },
  { id: 'integrations', icon: 'fa-plug', label: 'Integrations' },
  { id: 'notifications', icon: 'fa-bell', label: 'Notifications' },
  { id: 'team', icon: 'fa-users', label: 'Team Management' },
  { id: 'accessibility', icon: 'fa-universal-access', label: 'Accessibility' },
  { id: 'privacy_data', icon: 'fa-shield-halved', label: 'Privacy & Data' },
  { id: 'about', icon: 'fa-circle-info', label: 'About Pulse' },
  // Keeping these for completeness as they were in the original
  { id: 'billing', icon: 'fa-receipt', label: 'Plan & Billing' },
  { id: 'developer', icon: 'fa-code', label: 'Developer Tools' },
];

// Admin sections - only visible to admin users
const ADMIN_SECTIONS = [
  { id: 'admin', icon: 'fa-shield-halved', label: 'Admin Dashboard' },
];

const Settings: React.FC<SettingsProps> = ({ user, isDarkMode, toggleTheme, initialSection }) => {
  const [activeSection, setActiveSection] = useState(initialSection || 'account');

  // --- MY ACCOUNT STATE ---
  const [name, setName] = useState(user?.name || 'Demo User');
  const [email, setEmail] = useState(user?.email || 'user@example.com');
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  
  // Pulse Handle
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

  // --- AI & INTELLIGENCE STATE ---
  const [primaryAIModel, setPrimaryAIModel] = useState('gemini-2.5-flash');
  const [enableAdvancedReasoning, setEnableAdvancedReasoning] = useState(false);
  // Voice Agent
  const [agentVoice, setAgentVoice] = useState('nova');
  const [turnDetectionMode, setTurnDetectionMode] = useState<'semantic' | 'server'>('semantic');
  const [voiceActivityEagerness, setVoiceActivityEagerness] = useState('medium');
  const [interactionMode, setInteractionMode] = useState<'vad' | 'ptt'>('vad');
  // Knowledge Base
  const [defaultSearchScope, setDefaultSearchScope] = useState('current_project');
  const [autoAnalyzeDocs, setAutoAnalyzeDocs] = useState(true);
  // Device Selection (moved from audio_video)
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState('');
  const [selectedVideoInput, setSelectedVideoInput] = useState('');
  const [deviceError, setDeviceError] = useState(false);
  const [isTestingDevices, setIsTestingDevices] = useState(false);
  const [testStream, setTestStream] = useState<MediaStream | null>(null);
  
  // API Keys (AI Lab)
  const [openaiApiKey, setOpenaiApiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [openaiKeySaved, setOpenaiKeySaved] = useState(false);
  const [claudeApiKey, setClaudeApiKey] = useState(() => localStorage.getItem('claude_api_key') || '');
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [claudeKeySaved, setClaudeKeySaved] = useState(false);
  const [assemblyApiKey, setAssemblyApiKey] = useState(() => localStorage.getItem('assemblyai_api_key') || '');
  const [showAssemblyKey, setShowAssemblyKey] = useState(false);
  const [assemblyKeySaved, setAssemblyKeySaved] = useState(false);
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState(() => localStorage.getItem('elevenlabs_api_key') || '');
  const [showElevenLabsKey, setShowElevenLabsKey] = useState(false);
  const [elevenLabsKeySaved, setElevenLabsKeySaved] = useState(false);
  const [perplexityApiKey, setPerplexityApiKey] = useState(() => localStorage.getItem('perplexity_api_key') || '');
  const [showPerplexityKey, setShowPerplexityKey] = useState(false);
  const [perplexityKeySaved, setPerplexityKeySaved] = useState(false);
  const [mapboxApiKey, setMapboxApiKey] = useState(() => localStorage.getItem('mapbox_api_key') || '');
  const [showMapboxKey, setShowMapboxKey] = useState(false);
  const [mapboxKeySaved, setMapboxKeySaved] = useState(false);

  // --- INTEGRATIONS STATE ---
  const [slackToken, setSlackToken] = useState(import.meta.env.VITE_SLACK_BOT_TOKEN || '');
  const [slackTesting, setSlackTesting] = useState(false);
  const [slackStatus, setSlackStatus] = useState<{ success: boolean; workspace?: string; error?: string } | null>(null);
  const [slackMessages, setSlackMessages] = useState<UnifiedMessage[]>([]);
  const [slackChannels, setSlackChannels] = useState<Array<{ id: string; name: string }>>([]);
  
  const [gmailToken, setGmailToken] = useState('');
  const [gmailTesting, setGmailTesting] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<{ success: boolean; email?: string; error?: string } | null>(null);
  const [gmailMessages, setGmailMessages] = useState<UnifiedMessage[]>([]);

  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioTesting, setTwilioTesting] = useState(false);
  const [twilioStatus, setTwilioStatus] = useState<{ success: boolean; phoneNumber?: string; error?: string } | null>(null);
  const [twilioMessages, setTwilioMessages] = useState<UnifiedMessage[]>([]);

  const [calendarTesting, setCalendarTesting] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<{ success: boolean; email?: string; calendarCount?: number; error?: string } | null>(null);
  const [userCalendars, setUserCalendars] = useState<Array<{ id: string; name: string; primary: boolean }>>([]);

  const [contactsTesting, setContactsTesting] = useState(false);
  const [contactsStatus, setContactsStatus] = useState<{ success: boolean; contactCount?: number; error?: string } | null>(null);

  const [mapsApiKey, setMapsApiKey] = useState(() => localStorage.getItem('google_maps_api_key') || '');
  const [mapsTesting, setMapsTesting] = useState(false);
  const [mapsStatus, setMapsStatus] = useState<{ success: boolean; error?: string } | null>(null);

  // --- NOTIFICATIONS STATE ---
  const [enableAllNotifications, setEnableAllNotifications] = useState(true);
  // Smart Batching (Attention Budget)
  const [smartBatching, setSmartBatching] = useState(true);
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [vipContacts, setVipContacts] = useState(['Sarah Jenkins', 'Robert Vance']);
  // Granular
  const [notifSound, setNotifSound] = useState(true);
  const [notifDesktop, setNotifDesktop] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);
  
  // --- TEAM MANAGEMENT STATE ---
  const [pendingInvites, setPendingInvites] = useState<{email: string, date: string}[]>([
      { email: 'colleague@example.com', date: '2024-05-14' }
  ]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  // --- ACCESSIBILITY STATE ---
  // Theme is passed as prop
  const [accentColor, setAccentColor] = useState('rose');
  const [customColor, setCustomColor] = useState('#f43f5e');
  const [fontSize, setFontSize] = useState<'small' | 'default' | 'large'>('default');
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // --- PRIVACY & DATA STATE ---
  const [analyticsTracking, setAnalyticsTracking] = useState(true);
  
  // --- OTHER ---
  const [showDesignPreview, setShowDesignPreview] = useState(false);
  const [showApiKeysPanel, setShowApiKeysPanel] = useState(false);

  useEffect(() => {
    const getDevices = async () => {
      if (activeSection !== 'audio_video') return;

      try {
        // Request permission briefly to ensure labels are available
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        // Stop immediately after getting permission
        stream.getTracks().forEach(t => t.stop());
        setDeviceError(false);

        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const aIn = devices.filter(d => d.kind === 'audioinput');
        const aOut = devices.filter(d => d.kind === 'audiooutput');
        const vIn = devices.filter(d => d.kind === 'videoinput');
        
        setAudioInputs(aIn);
        setAudioOutputs(aOut);
        setVideoInputs(vIn);

        // Set defaults if not set
        if (!selectedAudioInput && aIn.length > 0) setSelectedAudioInput(aIn[0].deviceId);
        if (!selectedAudioOutput && aOut.length > 0) setSelectedAudioOutput(aOut[0].deviceId);
        if (!selectedVideoInput && vIn.length > 0) setSelectedVideoInput(vIn[0].deviceId);

      } catch (e) {
        console.error("Error enumerating devices", e);
        setDeviceError(true);
      }
    };

    getDevices();
  }, [activeSection]);

  // Color palette presets - Pulse Brand Colors
  const colorPresets = {
    rose: { hex: '#f43f5e', name: 'Pulse Rose' },
    pink: { hex: '#ec4899', name: 'Pulse Pink' },
    coral: { hex: '#fb7185', name: 'Heartbeat Coral' },
    purple: { hex: '#8B5CF6', name: 'Vision Purple' },
    teal: { hex: '#14B8A6', name: 'Entomate Teal' },
    blue: { hex: '#3B82F6', name: 'Ocean Blue' },
    amber: { hex: '#F59E0B', name: 'Warm Amber' },
  };

  // Apply accent color to CSS custom properties
  useEffect(() => {
    const applyColor = (hex: string) => {
      // Convert hex to RGB
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);

      document.documentElement.style.setProperty('--accent-primary', hex);
      document.documentElement.style.setProperty('--accent-primary-rgb', `${r}, ${g}, ${b}`);

      // Save to localStorage
      localStorage.setItem('accentColor', accentColor);
      localStorage.setItem('customColor', hex);
    };

    if (accentColor === 'custom') {
      applyColor(customColor);
    } else if (colorPresets[accentColor as keyof typeof colorPresets]) {
      applyColor(colorPresets[accentColor as keyof typeof colorPresets].hex);
    }
  }, [accentColor, customColor]);

  // Load saved color on mount
  useEffect(() => {
    const savedAccent = localStorage.getItem('accentColor');
    const savedCustom = localStorage.getItem('customColor');

    if (savedAccent) setAccentColor(savedAccent);
    if (savedCustom) setCustomColor(savedCustom);
  }, []);

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

  const handleColorChange = (preset: string) => {
    setAccentColor(preset);
  };

  const handleCustomColorChange = (hex: string) => {
    setCustomColor(hex);
    setAccentColor('custom');
  };

  // Slack Integration Handlers
  const testSlackConnection = async () => {
    if (!slackToken) {
      setSlackStatus({ success: false, error: 'Please enter a Slack bot token' });
      return;
    }

    setSlackTesting(true);
    setSlackStatus(null);

    try {
      const slackService = new SlackService(slackToken);
      const result = await slackService.testConnection();
      setSlackStatus(result);

      if (result.success) {
        // Fetch channels if connection successful
        const channels = await slackService.getChannels();
        setSlackChannels(channels);
      }
    } catch (error: any) {
      setSlackStatus({ success: false, error: error.message || 'Unknown error' });
    } finally {
      setSlackTesting(false);
    }
  };

  const fetchSlackMessages = async () => {
    if (!slackToken) return;

    // Use mock user ID for testing if no user is logged in
    // Generate a valid UUID format for Supabase
    const userId = user?.id || '00000000-0000-0000-0000-000000000001';

    setSlackTesting(true);
    try {
      // Update sync state to 'syncing'
      await unifiedInboxDb.updateSyncState(userId, 'slack', {
        syncStatus: 'syncing'
      });

      const slackService = new SlackService(slackToken);
      const messages = await slackService.getAllMessages(20);

      // Persist messages to database
      const storedCount = await unifiedInboxDb.storeMessages(userId, messages);
      console.log(`Stored ${storedCount} Slack messages to database`);

      // Update sync state to 'completed'
      await unifiedInboxDb.updateSyncState(userId, 'slack', {
        syncStatus: 'completed',
        lastMessageTimestamp: messages.length > 0 ? messages[0].timestamp : undefined
      });

      // Load messages from database to display
      const dbMessages = await unifiedInboxDb.getMessages(userId, {
        platform: 'slack',
        limit: 50
      });

      // Convert database messages to UnifiedMessage format for display
      setSlackMessages(messages);

      if (messages.length === 0) {
        setSlackStatus({
          success: true,
          workspace: slackStatus?.workspace,
          error: 'No messages found. Make sure your bot is added to at least one channel.'
        });
      } else {
        setSlackStatus({
          success: true,
          workspace: slackStatus?.workspace,
          error: `Successfully synced ${storedCount} messages to database`
        });
      }
    } catch (error) {
      console.error('Error fetching Slack messages:', error);

      // Update sync state to 'failed'
      await unifiedInboxDb.updateSyncState(userId, 'slack', {
        syncStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      setSlackStatus({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch messages'
      });
    } finally {
      setSlackTesting(false);
    }
  };

  // Gmail Integration Handlers
  const testGmailConnection = async () => {
    if (!gmailToken) {
      setGmailStatus({ success: false, error: 'Please enter a Gmail access token' });
      return;
    }

    setGmailTesting(true);
    setGmailStatus(null);

    try {
      const gmailService = new GmailService(gmailToken);
      const result = await gmailService.testConnection();
      setGmailStatus(result);
    } catch (error: any) {
      setGmailStatus({ success: false, error: error.message || 'Unknown error' });
    } finally {
      setGmailTesting(false);
    }
  };

  const fetchGmailMessages = async () => {
    if (!gmailToken) return;

    const userId = user?.id || '00000000-0000-0000-0000-000000000001';

    setGmailTesting(true);
    try {
      await unifiedInboxDb.updateSyncState(userId, 'email', {
        syncStatus: 'syncing'
      });

      const gmailService = new GmailService(gmailToken);
      const messages = await gmailService.getMessages(20);

      const storedCount = await unifiedInboxDb.storeMessages(userId, messages);
      console.log(`Stored ${storedCount} Gmail messages to database`);

      await unifiedInboxDb.updateSyncState(userId, 'email', {
        syncStatus: 'completed',
        lastMessageTimestamp: messages.length > 0 ? messages[0].timestamp : undefined
      });

      setGmailMessages(messages);

      if (messages.length === 0) {
        setGmailStatus({
          success: true,
          email: gmailStatus?.email,
          error: 'No messages found in inbox.'
        });
      } else {
        setGmailStatus({
          success: true,
          email: gmailStatus?.email,
          error: `✅ Successfully synced ${storedCount} messages to database`
        });
      }
    } catch (error) {
      console.error('Error fetching Gmail messages:', error);

      await unifiedInboxDb.updateSyncState(userId, 'email', {
        syncStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      setGmailStatus({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch messages'
      });
    } finally {
      setGmailTesting(false);
    }
  };

  // Twilio SMS Integration Handlers
  const testTwilioConnection = async () => {
    if (!twilioAccountSid || !twilioAuthToken) {
      setTwilioStatus({ success: false, error: 'Please enter Twilio credentials' });
      return;
    }

    setTwilioTesting(true);
    setTwilioStatus(null);

    try {
      const twilioService = new TwilioService(twilioAccountSid, twilioAuthToken);
      const result = await twilioService.testConnection();
      setTwilioStatus(result);
    } catch (error: any) {
      setTwilioStatus({ success: false, error: error.message || 'Unknown error' });
    } finally {
      setTwilioTesting(false);
    }
  };

  const fetchTwilioMessages = async () => {
    if (!twilioAccountSid || !twilioAuthToken) return;

    const userId = user?.id || '00000000-0000-0000-0000-000000000001';

    setTwilioTesting(true);
    try {
      await unifiedInboxDb.updateSyncState(userId, 'sms', {
        syncStatus: 'syncing'
      });

      const twilioService = new TwilioService(twilioAccountSid, twilioAuthToken);
      const messages = await twilioService.getMessages(20);

      const storedCount = await unifiedInboxDb.storeMessages(userId, messages);
      console.log(`Stored ${storedCount} SMS messages to database`);

      await unifiedInboxDb.updateSyncState(userId, 'sms', {
        syncStatus: 'completed',
        lastMessageTimestamp: messages.length > 0 ? messages[0].timestamp : undefined
      });

      setTwilioMessages(messages);

      if (messages.length === 0) {
        setTwilioStatus({
          success: true,
          phoneNumber: twilioStatus?.phoneNumber,
          error: 'No messages found.'
        });
      } else {
        setTwilioStatus({
          success: true,
          phoneNumber: twilioStatus?.phoneNumber,
          error: `✅ Successfully synced ${storedCount} messages to database`
        });
      }
    } catch (error) {
      console.error('Error fetching Twilio messages:', error);

      await unifiedInboxDb.updateSyncState(userId, 'sms', {
        syncStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      setTwilioStatus({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch messages'
      });
    } finally {
      setTwilioTesting(false);
    }
  };

  const renderContent = () => {
    switch(activeSection) {
      case 'integrations':
        return (
          <div className="space-y-8 animate-slide-up">
            <div className="section-header">
              <h3>
                <i className="fa-solid fa-plug"></i> Platform Integrations
              </h3>
              <p>
                Connect your accounts to sync data across all your platforms. Messages, calendars, and contacts will be unified in one place.
              </p>
            </div>

            {/* Sync Preferences (New) */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-arrows-rotate"></i> Sync Preferences
                </h4>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium dark:text-white text-zinc-900">Sync Frequency</p>
                            <p className="text-xs text-zinc-500">How often Pulse checks for new data in background</p>
                        </div>
                        <select className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm dark:text-white text-zinc-900 focus:outline-none">
                            <option>Real-time (Instant)</option>
                            <option>Every 15 minutes</option>
                            <option>Every hour</option>
                            <option>Manual only</option>
                        </select>
                    </div>
                    <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium dark:text-white text-zinc-900">Slack Channels</p>
                            <p className="text-xs text-zinc-500">Select which channels to import</p>
                        </div>
                        <button className="text-sm text-blue-500 hover:underline">Manage (All)</button>
                    </div>
                </div>
            </div>

            {/* ==================== GOOGLE SERVICES SECTION ==================== */}
            <div className="section-header">
              <h3>
                <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google Services
              </h3>
              <p>
                Connect your Google account to sync Calendar, Contacts, Gmail, and Maps. All services use a single Google sign-in.
              </p>
            </div>

            {/* Google Account Connection Card */}
            <div className="integration-card" style={{ borderColor: user?.connectedProviders.google ? 'rgba(16, 185, 129, 0.3)' : undefined }}>
              <div className="integration-header">
                <div className="integration-icon" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                  <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <div className="integration-info" style={{ flex: 1 }}>
                  <h4>Google Account</h4>
                  <p>Connect once to enable all Google services</p>
                </div>
                {user?.connectedProviders.google && (
                  <span className="connected-badge">
                    Connected
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {user?.connectedProviders.google ? (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <i className="fa-solid fa-check text-emerald-500"></i>
                      </div>
                      <div>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">Google Account Connected</p>
                        <p className="text-sm text-emerald-600 dark:text-emerald-500">{user?.email}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-4">
                      <div className="flex flex-col items-center p-2 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
                        <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                          <path fill="#EA4335" d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20m0-2H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
                        </svg>
                        <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Gmail</span>
                      </div>
                      <div className="flex flex-col items-center p-2 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
                        <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                          <path fill="#4285F4" d="M19 19H5V8h14m-3-7v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1V1m-1 11h-5v5h5v-5z"/>
                        </svg>
                        <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Calendar</span>
                      </div>
                      <div className="flex flex-col items-center p-2 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
                        <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                          <path fill="#1A73E8" d="M12 4a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4z"/>
                        </svg>
                        <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Contacts</span>
                      </div>
                      <div className="flex flex-col items-center p-2 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
                        <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                          <path fill="#34A853" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
                        </svg>
                        <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Maps</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
                      </div>
                      <div>
                        <p className="font-semibold text-amber-700 dark:text-amber-400">Google Account Not Connected</p>
                        <p className="text-sm text-amber-600 dark:text-amber-500">Sign in with Google to enable all services</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="nothing-info-box" style={{ marginTop: '16px' }}>
                  <p className="info-title">
                    <i className="fa-solid fa-circle-info"></i>
                    Google API Permissions Requested:
                  </p>
                  <ul>
                    <li><code>calendar.readonly</code> Read calendar events</li>
                    <li><code>calendar.events</code> Create and modify events</li>
                    <li><code>gmail.readonly</code> Read email messages</li>
                    <li><code>gmail.send</code> Send emails</li>
                    <li><code>contacts.readonly</code> Read your contacts</li>
                  </ul>
                  <p style={{ marginTop: '12px', opacity: 0.8 }}>
                    Your data is handled securely and never shared with third parties.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {!user?.connectedProviders.google ? (
                    <button
                      onClick={async () => {
                        try {
                          await loginWithGoogle();
                        } catch (error) {
                          console.error('Failed to connect Google:', error);
                        }
                      }}
                      className="nothing-btn nothing-btn-primary"
                    >
                      <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px', marginRight: '6px' }}>
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Connect Google Account
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={async () => {
                          if (confirm('This will disconnect your Google account from Pulse. You can reconnect at any time.')) {
                            try {
                              await disconnectGoogleAccount();
                            } catch (error) {
                              console.error('Failed to disconnect Google:', error);
                            }
                          }
                        }}
                        className="nothing-btn nothing-btn-secondary"
                      >
                        <i className="fa-solid fa-link-slash"></i>
                        Disconnect
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('This will completely revoke Pulse\'s access to your Google account. You\'ll need to re-authorize all permissions to reconnect.')) {
                            try {
                              await revokeGoogleAccess();
                            } catch (error) {
                              console.error('Failed to revoke Google access:', error);
                            }
                          }
                        }}
                        className="nothing-btn"
                        style={{ color: '#ef4444' }}
                      >
                        <i className="fa-solid fa-ban"></i>
                        Revoke Access
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Gmail Integration */}
            <div className="integration-card">
              <div className="integration-header">
                <div className="integration-icon" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                  <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
                    <path fill="#4285F4" d="M22 6V4H2v2l10 6 10-6z"/>
                    <path fill="#EA4335" d="M22 8l-10 6L2 8v10h20V8z"/>
                    <path fill="#FBBC05" d="M2 4v4l10 6V6L2 4z"/>
                    <path fill="#34A853" d="M22 4l-10 2v8l10-6V4z"/>
                  </svg>
                </div>
                <div className="integration-info" style={{ flex: 1 }}>
                  <h4>Gmail</h4>
                  <p>Pull in email conversations</p>
                </div>
                {(gmailStatus?.success || user?.connectedProviders.google) && (
                  <span className="connected-badge">
                    Connected
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {user?.connectedProviders.google ? (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <i className="fa-solid fa-check text-emerald-500"></i>
                      </div>
                      <div>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">Gmail Connected</p>
                        <p className="text-sm text-emerald-600 dark:text-emerald-500">{user?.email}</p>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Gmail integration is active through your Google sign-in. Your emails are accessible in the Email section.
                    </p>
                  </div>
                ) : (
                  <div className="bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 text-center">
                    <i className="fa-solid fa-lock text-zinc-400 text-2xl mb-2"></i>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Connect your Google account above to enable Gmail</p>
                  </div>
                )}

                <div className="nothing-info-box" style={{ marginTop: '16px' }}>
                  <p className="info-title">
                    <i className="fa-solid fa-circle-info"></i>
                    Gmail API Permissions:
                  </p>
                  <ul>
                    <li><code>gmail.readonly</code> Read email messages</li>
                    <li><code>gmail.send</code> Send emails on your behalf</li>
                    <li><code>gmail.modify</code> Mark as read, archive, delete</li>
                  </ul>
                </div>

                {user?.connectedProviders.google && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={async () => {
                        setGmailTesting(true);
                        setGmailStatus(null);
                        try {
                          const { getGmailService } = await import('../services/gmailService');
                          const gmailService = getGmailService();
                          const result = await gmailService.testConnection();
                          setGmailStatus(result);
                        } catch (error: any) {
                          setGmailStatus({ success: false, error: error.message || 'Connection failed' });
                        } finally {
                          setGmailTesting(false);
                        }
                      }}
                      disabled={gmailTesting}
                      className="nothing-btn nothing-btn-primary"
                    >
                      {gmailTesting ? (
                        <>
                          <i className="fa-solid fa-circle-notch spinner-icon"></i>
                          Testing...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-plug"></i>
                          Test Connection
                        </>
                      )}
                    </button>

                    {gmailStatus?.success && (
                      <button
                        onClick={async () => {
                          setGmailTesting(true);
                          try {
                            const { getGmailService } = await import('../services/gmailService');
                            const gmailService = getGmailService();
                            const messages = await gmailService.getMessages(10);
                            setGmailMessages(messages);
                            setGmailStatus({
                              success: true,
                              email: gmailStatus?.email,
                              error: `Fetched ${messages.length} recent emails`
                            });
                          } catch (error: any) {
                            setGmailStatus({ success: false, error: error.message });
                          } finally {
                            setGmailTesting(false);
                          }
                        }}
                        disabled={gmailTesting}
                        className="nothing-btn nothing-btn-secondary"
                      >
                        <i className="fa-solid fa-download"></i>
                        Fetch Messages
                      </button>
                    )}
                  </div>
                )}

                {gmailStatus && (
                  <div className={`status-display ${gmailStatus.success ? 'success' : 'error'}`}>
                    <i className={`fa-solid ${gmailStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
                    <span>{gmailStatus.success ? `Connected to ${gmailStatus.email}` : `Error: ${gmailStatus.error}`}</span>
                  </div>
                )}

                {gmailMessages.length > 0 && (
                  <div className="message-preview">
                    <div className="message-preview-title">
                      Recent Emails ({gmailMessages.length})
                    </div>
                    <div>
                      {gmailMessages.slice(0, 5).map((msg) => (
                        <div key={msg.id} className="preview-message">
                          <div className="preview-message-sender">
                            {msg.senderName} <span style={{ opacity: 0.5 }}>• {msg.senderEmail}</span>
                          </div>
                          <div className="preview-message-content">{msg.content}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Google Calendar Integration */}
            <div className="integration-card">
              <div className="integration-header">
                <div className="integration-icon" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                  <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
                    <path fill="#4285F4" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/>
                    <path fill="#fff" d="M5 10h14v10H5z"/>
                    <path fill="#EA4335" d="M9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/>
                  </svg>
                </div>
                <div className="integration-info" style={{ flex: 1 }}>
                  <h4>Google Calendar</h4>
                  <p>Sync events and schedule meetings</p>
                </div>
                {user?.connectedProviders.google && calendarStatus?.success && (
                  <span className="connected-badge">
                    Connected
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {user?.connectedProviders.google ? (
                  <>
                    <div className="nothing-info-box">
                      <p className="info-title">
                        <i className="fa-solid fa-circle-info"></i>
                        Calendar Features:
                      </p>
                      <ul>
                        <li>View and sync all your calendars</li>
                        <li>Create events with Google Meet links</li>
                        <li>AI-powered scheduling suggestions</li>
                        <li>Two-way sync with local events</li>
                      </ul>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={async () => {
                          setCalendarTesting(true);
                          setCalendarStatus(null);
                          try {
                            const { googleCalendarService } = await import('../services/googleCalendarService');
                            const calendars = await googleCalendarService.getCalendars();
                            setUserCalendars(calendars.map(c => ({ id: c.id, name: c.summary, primary: c.primary || false })));
                            setCalendarStatus({
                              success: true,
                              email: user?.email,
                              calendarCount: calendars.length
                            });
                          } catch (error: any) {
                            setCalendarStatus({ success: false, error: error.message || 'Connection failed' });
                          } finally {
                            setCalendarTesting(false);
                          }
                        }}
                        disabled={calendarTesting}
                        className="nothing-btn nothing-btn-primary"
                      >
                        {calendarTesting ? (
                          <>
                            <i className="fa-solid fa-circle-notch spinner-icon"></i>
                            Testing...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-plug"></i>
                            Test Connection
                          </>
                        )}
                      </button>
                    </div>

                    {calendarStatus && (
                      <div className={`status-display ${calendarStatus.success ? 'success' : 'error'}`}>
                        <i className={`fa-solid ${calendarStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
                        <span>{calendarStatus.success ? `Found ${calendarStatus.calendarCount} calendars` : `Error: ${calendarStatus.error}`}</span>
                      </div>
                    )}

                    {userCalendars.length > 0 && (
                      <div className="mt-4">
                        <h5 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                          Your Calendars ({userCalendars.length})
                        </h5>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                          {userCalendars.map((cal) => (
                            <div key={cal.id} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                              <i className={`fa-solid fa-calendar text-blue-500 ${cal.primary ? 'text-blue-600' : 'text-zinc-400'}`}></i>
                              <span className="dark:text-white text-zinc-900 truncate">{cal.name}</span>
                              {cal.primary && <span className="text-[9px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">Primary</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 text-center">
                    <i className="fa-solid fa-lock text-zinc-400 text-2xl mb-2"></i>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Connect your Google account above to enable Calendar sync</p>
                  </div>
                )}
              </div>
            </div>

            {/* Google Contacts Integration */}
            <div className="integration-card">
              <div className="integration-header">
                <div className="integration-icon" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                  <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
                    <path fill="#1A73E8" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                  </svg>
                </div>
                <div className="integration-info" style={{ flex: 1 }}>
                  <h4>Google Contacts</h4>
                  <p>Sync your contacts and connections</p>
                </div>
                {user?.connectedProviders.google && contactsStatus?.success && (
                  <span className="connected-badge">
                    Connected
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {user?.connectedProviders.google ? (
                  <>
                    <div className="nothing-info-box">
                      <p className="info-title">
                        <i className="fa-solid fa-circle-info"></i>
                        Contacts Features:
                      </p>
                      <ul>
                        <li>Import contacts from Google</li>
                        <li>Access contact details and photos</li>
                        <li>Use contacts for scheduling and messaging</li>
                        <li>Keep contacts in sync automatically</li>
                      </ul>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={async () => {
                          setContactsTesting(true);
                          setContactsStatus(null);
                          try {
                            const { googleContactsService } = await import('../services/googleContactsService');
                            const contacts = await googleContactsService.getAllContacts();
                            setContactsStatus({
                              success: true,
                              contactCount: contacts.length
                            });
                          } catch (error: any) {
                            setContactsStatus({ success: false, error: error.message || 'Connection failed' });
                          } finally {
                            setContactsTesting(false);
                          }
                        }}
                        disabled={contactsTesting}
                        className="nothing-btn nothing-btn-primary"
                      >
                        {contactsTesting ? (
                          <>
                            <i className="fa-solid fa-circle-notch spinner-icon"></i>
                            Testing...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-plug"></i>
                            Test Connection
                          </>
                        )}
                      </button>
                    </div>

                    {contactsStatus && (
                      <div className={`status-display ${contactsStatus.success ? 'success' : 'error'}`}>
                        <i className={`fa-solid ${contactsStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
                        <span>{contactsStatus.success ? `Found ${contactsStatus.contactCount} contacts` : `Error: ${contactsStatus.error}`}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 text-center">
                    <i className="fa-solid fa-lock text-zinc-400 text-2xl mb-2"></i>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Connect your Google account above to enable Contacts sync</p>
                  </div>
                )}
              </div>
            </div>

            {/* Google Maps Integration */}
            <div className="integration-card">
              <div className="integration-header">
                <div className="integration-icon" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                  <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
                    <path fill="#34A853" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                    <circle fill="#fff" cx="12" cy="9" r="2.5"/>
                    <path fill="#4285F4" d="M12 2C8.13 2 5 5.13 5 9c0 1.74.5 3.37 1.41 4.84.95 1.54 2.2 2.86 3.16 4.4.47.75.81 1.45 1.17 2.26L12 24"/>
                    <path fill="#FBBC05" d="M12 2c3.87 0 7 3.13 7 7 0 1.74-.5 3.37-1.41 4.84-.95 1.54-2.2 2.86-3.16 4.4-.47.75-.81 1.45-1.17 2.26L12 24"/>
                  </svg>
                </div>
                <div className="integration-info" style={{ flex: 1 }}>
                  <h4>Google Maps</h4>
                  <p>Location services and directions</p>
                </div>
                {mapsStatus?.success && (
                  <span className="connected-badge">
                    Connected
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className="nothing-info-box">
                  <p className="info-title">
                    <i className="fa-solid fa-circle-info"></i>
                    Maps Features:
                  </p>
                  <ul>
                    <li>Add locations to calendar events</li>
                    <li>Get directions to meetings</li>
                    <li>Calculate travel time between events</li>
                    <li>Location suggestions for scheduling</li>
                  </ul>
                </div>

                <div>
                  <label className="nothing-input-label">
                    Google Maps API Key (Optional)
                  </label>
                  <input
                    type="password"
                    value={mapsApiKey}
                    onChange={(e) => {
                      setMapsApiKey(e.target.value);
                      localStorage.setItem('google_maps_api_key', e.target.value);
                    }}
                    placeholder="AIza..."
                    className="nothing-input"
                  />
                  <p className="text-xs text-zinc-500 mt-2">
                    For enhanced location features. Get an API key from <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google Cloud Console</a>
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={async () => {
                      setMapsTesting(true);
                      setMapsStatus(null);
                      try {
                        if (mapsApiKey) {
                          const response = await fetch(
                            `https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${mapsApiKey}`
                          );
                          const data = await response.json();
                          if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
                            setMapsStatus({ success: true });
                          } else if (data.error_message) {
                            setMapsStatus({ success: false, error: data.error_message });
                          } else {
                            setMapsStatus({ success: false, error: `API returned status: ${data.status}` });
                          }
                        } else {
                          setMapsStatus({ success: true });
                        }
                      } catch (error: any) {
                        setMapsStatus({ success: false, error: error.message || 'Connection failed' });
                      } finally {
                        setMapsTesting(false);
                      }
                    }}
                    disabled={mapsTesting}
                    className="nothing-btn nothing-btn-primary"
                  >
                    {mapsTesting ? (
                      <>
                        <i className="fa-solid fa-circle-notch spinner-icon"></i>
                        Testing...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-plug"></i>
                        Test Connection
                      </>
                    )}
                  </button>
                </div>

                {mapsStatus && (
                  <div className={`status-display ${mapsStatus.success ? 'success' : 'error'}`}>
                    <i className={`fa-solid ${mapsStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
                    <span>{mapsStatus.success ? 'Maps API is ready' : `Error: ${mapsStatus.error}`}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ==================== OTHER INTEGRATIONS SECTION ==================== */}
            <div className="section-header" style={{ marginTop: '48px' }}>
              <h3>
                <i className="fa-solid fa-plug"></i> Other Integrations
              </h3>
              <p>
                Connect additional platforms to aggregate all your messages in one unified inbox.
              </p>
            </div>

            {/* Slack Integration */}
            <div className="integration-card">
              <div className="integration-header">
                <div className="integration-icon" style={{ background: '#4A154B' }}>
                  <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
                    <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
                    <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
                    <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.521 2.522v6.312z"/>
                    <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.521-2.522v-2.522h2.521zm0-1.27a2.527 2.527 0 0 1-2.521-2.522 2.527 2.527 0 0 1 2.521-2.521h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.313z"/>
                  </svg>
                </div>
                <div className="integration-info" style={{ flex: 1 }}>
                  <h4>Slack</h4>
                  <p>Aggregate messages from Slack channels</p>
                </div>
                {slackStatus?.success && (
                  <span className="connected-badge">
                    Connected
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="nothing-input-label">
                    Slack Bot Token
                  </label>
                  <input
                    type="password"
                    value={slackToken}
                    onChange={(e) => setSlackToken(e.target.value)}
                    placeholder="xoxb-your-slack-bot-token"
                    className="nothing-input"
                  />
                  <div className="nothing-info-box">
                    <p className="info-title">
                      <i className="fa-solid fa-circle-info"></i>
                      Required Slack Bot Scopes:
                    </p>
                    <ul>
                      <li><code>channels:history</code> Read public channel messages</li>
                      <li><code>channels:read</code> View public channels</li>
                      <li><code>groups:history</code> Read private channel messages</li>
                      <li><code>groups:read</code> View private channels</li>
                      <li><code>im:history</code> Read DM messages</li>
                      <li><code>im:read</code> View DMs</li>
                      <li><code>users:read</code> View user info</li>
                    </ul>
                    <p style={{ marginTop: '12px' }}>
                      Configure at <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer">Slack API Dashboard</a> → OAuth & Permissions → Scopes
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={testSlackConnection}
                    disabled={slackTesting || !slackToken}
                    className="nothing-btn nothing-btn-primary"
                  >
                    {slackTesting ? (
                      <>
                        <i className="fa-solid fa-circle-notch spinner-icon"></i>
                        Testing...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-plug"></i>
                        Test Connection
                      </>
                    )}
                  </button>

                  {slackStatus?.success && (
                    <button
                      onClick={fetchSlackMessages}
                      disabled={slackTesting}
                      className="nothing-btn nothing-btn-secondary"
                    >
                      <i className="fa-solid fa-download"></i>
                      Fetch Messages
                    </button>
                  )}

                </div>

                {slackStatus && (
                  <div className={`status-display ${slackStatus.success ? 'success' : 'error'}`}>
                    <i className={`fa-solid ${slackStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
                    <span>{slackStatus.success ? `Connected to ${slackStatus.workspace}` : `Error: ${slackStatus.error}`}</span>
                  </div>
                )}

                {slackChannels.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                      Available Channels ({slackChannels.length})
                    </h5>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {slackChannels.slice(0, 10).map((channel) => (
                        <div key={channel.id} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs">
                          <span className="text-zinc-500">#</span>
                          <span className="dark:text-white text-zinc-900">{channel.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {slackMessages.length > 0 && (
                  <div className="message-preview">
                    <div className="message-preview-title">
                      Recent Messages ({slackMessages.length})
                    </div>
                    <div>
                      {slackMessages.slice(0, 5).map((msg) => (
                        <div key={msg.id} className="preview-message">
                          <div className="preview-message-sender">
                            {msg.senderName} <span style={{ opacity: 0.5 }}>• #{msg.channelName}</span>
                          </div>
                          <div className="preview-message-content">{msg.content}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Twilio SMS Integration */}
            <div className="integration-card">
              <div className="integration-header">
                <div className="integration-icon" style={{ background: '#F22F46' }}>
                  <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
                    <path fill="#fff" d="M12 0C5.381 0 0 5.381 0 12s5.381 12 12 12 12-5.381 12-12S18.619 0 12 0zm0 20.4c-4.639 0-8.4-3.761-8.4-8.4S7.361 3.6 12 3.6s8.4 3.761 8.4 8.4-3.761 8.4-8.4 8.4zm3.6-8.4c0 .994-.806 1.8-1.8 1.8s-1.8-.806-1.8-1.8.806-1.8 1.8-1.8 1.8.806 1.8 1.8zm-5.4 0c0 .994-.806 1.8-1.8 1.8S6.6 12.994 6.6 12s.806-1.8 1.8-1.8 1.8.806 1.8 1.8z"/>
                  </svg>
                </div>
                <div className="integration-info" style={{ flex: 1 }}>
                  <h4>Twilio SMS</h4>
                  <p>Include SMS messages</p>
                </div>
                {twilioStatus?.success && (
                  <span className="connected-badge">
                    Connected
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="nothing-input-label">
                    Twilio Account SID
                  </label>
                  <input
                    type="text"
                    value={twilioAccountSid}
                    onChange={(e) => setTwilioAccountSid(e.target.value)}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="nothing-input"
                  />
                </div>

                <div>
                  <label className="nothing-input-label">
                    Twilio Auth Token
                  </label>
                  <input
                    type="password"
                    value={twilioAuthToken}
                    onChange={(e) => setTwilioAuthToken(e.target.value)}
                    placeholder="********************************"
                    className="nothing-input"
                  />
                  <div className="nothing-info-box">
                    <p className="info-title">
                      <i className="fa-solid fa-circle-info"></i>
                      Twilio API Credentials:
                    </p>
                    <ul>
                      <li>Find your Account SID and Auth Token in the Twilio Console</li>
                      <li>Ensure your Twilio number has SMS capabilities enabled</li>
                    </ul>
                    <p style={{ marginTop: '12px' }}>
                      Get credentials at <a href="https://console.twilio.com/" target="_blank" rel="noopener noreferrer">Twilio Console</a>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={testTwilioConnection}
                    disabled={twilioTesting || !twilioAccountSid || !twilioAuthToken}
                    className="nothing-btn nothing-btn-primary"
                  >
                    {twilioTesting ? (
                      <>
                        <i className="fa-solid fa-circle-notch spinner-icon"></i>
                        Testing...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-plug"></i>
                        Test Connection
                      </>
                    )}
                  </button>

                  {twilioStatus?.success && (
                    <button
                      onClick={fetchTwilioMessages}
                      disabled={twilioTesting}
                      className="nothing-btn nothing-btn-secondary"
                    >
                      <i className="fa-solid fa-download"></i>
                      Fetch Messages
                    </button>
                  )}

                </div>

                {twilioStatus && (
                  <div className={`status-display ${twilioStatus.success ? 'success' : 'error'}`}>
                    <i className={`fa-solid ${twilioStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
                    <span>{twilioStatus.success ? `Connected to ${twilioStatus.phoneNumber}` : `Error: ${twilioStatus.error}`}</span>
                  </div>
                )}

                {twilioMessages.length > 0 && (
                  <div className="message-preview">
                    <div className="message-preview-title">
                      Recent SMS ({twilioMessages.length})
                    </div>
                    <div>
                      {twilioMessages.slice(0, 5).map((msg) => (
                        <div key={msg.id} className="preview-message">
                          <div className="preview-message-sender">
                            {msg.senderName} <span style={{ opacity: 0.5 }}>• {(msg.metadata as Record<string, unknown>)?.formattedPhone as string}</span>
                          </div>
                          <div className="preview-message-content">{msg.content}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Future Integrations Teaser */}
            <div className="section-header" style={{ marginTop: '48px' }}>
              <h3>
                <i className="fa-solid fa-rocket"></i> Coming Soon
              </h3>
              <p>
                More integrations are on the way to help you sync all your data in one place.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="integration-card" style={{ opacity: 0.6, pointerEvents: 'none' }}>
                <div className="integration-header">
                  <div className="integration-icon" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                    <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
                      <path fill="#F25022" d="M1 1h10v10H1z"/>
                      <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                      <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                      <path fill="#FFB900" d="M13 13h10v10H13z"/>
                    </svg>
                  </div>
                  <div className="integration-info">
                    <h4>Microsoft 365</h4>
                    <p>Outlook, Teams, OneDrive</p>
                  </div>
                </div>
                <div className="text-center py-4">
                  <span className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 px-3 py-1 rounded-full">Coming Soon</span>
                </div>
              </div>

              <div className="integration-card" style={{ opacity: 0.6, pointerEvents: 'none' }}>
                <div className="integration-header">
                  <div className="integration-icon" style={{ background: '#000000' }}>
                    <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
                      <path fill="#fff" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                  </div>
                  <div className="integration-info">
                    <h4>Apple iCloud</h4>
                    <p>Calendar, Contacts, Reminders</p>
                  </div>
                </div>
                <div className="text-center py-4">
                  <span className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 px-3 py-1 rounded-full">Coming Soon</span>
                </div>
              </div>

              <div className="integration-card" style={{ opacity: 0.6, pointerEvents: 'none' }}>
                <div className="integration-header">
                  <div className="integration-icon" style={{ background: '#0A66C2' }}>
                    <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
                      <path fill="#fff" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </div>
                  <div className="integration-info">
                    <h4>LinkedIn</h4>
                    <p>Messages, Connections</p>
                  </div>
                </div>
                <div className="text-center py-4">
                  <span className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 px-3 py-1 rounded-full">Coming Soon</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'ai_intelligence':
        return (
          <div className="space-y-8 animate-slide-up">
            <div className="section-header">
              <h3>
                <i className="fa-solid fa-brain"></i> AI & Intelligence
              </h3>
              <p>
                Configure the brain of your Pulse workspace. Choose models, voices, and reasoning capabilities.
              </p>
            </div>

            {/* General AI */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
                    <i className="fa-solid fa-microchip"></i> General AI
                </h4>
                
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium dark:text-white text-zinc-900">Primary AI Model</label>
                        <select 
                            value={primaryAIModel} 
                            onChange={(e) => setPrimaryAIModel(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 dark:text-white text-zinc-900 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fastest)</option>
                            <option value="gemini-2.0-pro">Gemini 2.0 Pro (Balanced)</option>
                            <option value="gpt-4o">GPT-4o (OpenAI)</option>
                            <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                            <option value="perplexity-sonar-small">Perplexity Sonar Small</option>
                        </select>
                        <p className="text-xs text-zinc-500">The default model used for general queries, summaries, and chat.</p>
                    </div>

                    <ToggleItem
                        label="Enable Advanced Reasoning"
                        desc="Use slower but more powerful models (e.g. Gemini 1.5 Pro) for complex queries in War Room"
                        active={enableAdvancedReasoning}
                        onToggle={() => setEnableAdvancedReasoning(!enableAdvancedReasoning)}
                    />
                </div>
            </div>

            {/* Voice Agent */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
                    <i className="fa-solid fa-headset"></i> Voice Agent
                </h4>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium dark:text-white text-zinc-900">Agent Voice</label>
                        <div className="flex gap-2">
                            <select 
                                value={agentVoice} 
                                onChange={(e) => {
                                    setAgentVoice(e.target.value);
                                    setAiVoiceModel(e.target.value); // Sync with legacy state
                                    localStorage.setItem('pulse_ai_voice_model', e.target.value);
                                }}
                                className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 dark:text-white text-zinc-900 focus:border-blue-500 focus:outline-none"
                            >
                                <option value="alloy">Alloy (Neutral)</option>
                                <option value="echo">Echo (Male)</option>
                                <option value="fable">Fable (Expressive)</option>
                                <option value="onyx">Onyx (Deep)</option>
                                <option value="nova">Nova (Friendly)</option>
                                <option value="shimmer">Shimmer (Soothing)</option>
                            </select>
                            <button 
                                onClick={() => {
                                    const utterance = new SpeechSynthesisUtterance("Hello, I am your Pulse AI assistant.");
                                    speechSynthesis.speak(utterance);
                                }}
                                className="px-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                            >
                                <i className="fa-solid fa-play"></i>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium dark:text-white text-zinc-900">Turn Detection Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => setTurnDetectionMode('semantic')}
                                className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all ${turnDetectionMode === 'semantic' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-600 dark:text-blue-400' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'}`}
                            >
                                Semantic VAD
                                <span className="block text-[10px] font-normal opacity-70 mt-1">Natural conversation flow</span>
                            </button>
                            <button 
                                onClick={() => setTurnDetectionMode('server')}
                                className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all ${turnDetectionMode === 'server' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-600 dark:text-blue-400' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'}`}
                            >
                                Server VAD
                                <span className="block text-[10px] font-normal opacity-70 mt-1">Silence-based detection</span>
                            </button>
                        </div>
                    </div>

                    {turnDetectionMode === 'semantic' && (
                        <div className="space-y-2 pl-4 border-l-2 border-blue-100 dark:border-blue-900">
                            <label className="text-sm font-medium dark:text-white text-zinc-900">Voice Activity Eagerness</label>
                            <input 
                                type="range" 
                                min="0" max="2" step="1" 
                                value={voiceActivityEagerness === 'low' ? 0 : voiceActivityEagerness === 'medium' ? 1 : 2}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setVoiceActivityEagerness(val === 0 ? 'low' : val === 1 ? 'medium' : 'high');
                                }}
                                className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <div className="flex justify-between text-xs text-zinc-500">
                                <span>Low (Patient)</span>
                                <span>Medium (Balanced)</span>
                                <span>High (Interrupts)</span>
                            </div>
                        </div>
                    )}

                    <ToggleItem
                        label="Push-to-Talk Mode"
                        desc="Disable voice activity detection and only listen when button is held"
                        active={interactionMode === 'ptt'}
                        onToggle={() => setInteractionMode(interactionMode === 'ptt' ? 'vad' : 'ptt')}
                    />
                </div>
            </div>

            {/* Knowledge Base */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
                    <i className="fa-solid fa-book"></i> Knowledge Base (RAG)
                </h4>
                
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium dark:text-white text-zinc-900">Default Search Scope</label>
                        <select 
                            value={defaultSearchScope} 
                            onChange={(e) => setDefaultSearchScope(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 dark:text-white text-zinc-900 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="current_project">Current Project Context</option>
                            <option value="all_projects">All Projects & Knowledge</option>
                            <option value="global">Global (Web + Local)</option>
                        </select>
                    </div>

                    <ToggleItem
                        label="Auto-Analyze New Documents"
                        desc="Automatically generate summaries and extract keywords when uploading files (Uses API credits)"
                        active={autoAnalyzeDocs}
                        onToggle={() => setAutoAnalyzeDocs(!autoAnalyzeDocs)}
                    />
                </div>
            </div>

            {/* Device Selection (Hardware) */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
                    <i className="fa-solid fa-sliders"></i> Hardware Settings
                </h4>
                
                <div className="space-y-4">
                    {/* Audio Input */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            <i className="fa-solid fa-microphone"></i> Microphone
                        </label>
                        <div className="relative">
                            <select 
                                value={selectedAudioInput}
                                onChange={(e) => setSelectedAudioInput(e.target.value)}
                                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 pr-10 appearance-none text-sm dark:text-white text-zinc-900 focus:border-blue-500 focus:outline-none"
                            >
                                {audioInputs.map(device => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Microphone ${device.deviceId.substr(0, 5)}...`}
                                    </option>
                                ))}
                                {audioInputs.length === 0 && <option>No microphones found</option>}
                            </select>
                            <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none"></i>
                        </div>
                    </div>

                    {/* Audio Output */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            <i className="fa-solid fa-volume-high"></i> Speaker
                        </label>
                        <div className="relative">
                            <select 
                                value={selectedAudioOutput}
                                onChange={(e) => setSelectedAudioOutput(e.target.value)}
                                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 pr-10 appearance-none text-sm dark:text-white text-zinc-900 focus:border-blue-500 focus:outline-none"
                            >
                                {audioOutputs.map(device => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Speaker ${device.deviceId.substr(0, 5)}...`}
                                    </option>
                                ))}
                                {audioOutputs.length === 0 && <option>Default Speaker</option>}
                            </select>
                            <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none"></i>
                        </div>
                    </div>

                    {/* Diagnostics Button */}
                    <div className="pt-2">
                        <button 
                            onClick={async () => {
                                setIsTestingDevices(true);
                                try {
                                const stream = await navigator.mediaDevices.getUserMedia({ 
                                    audio: selectedAudioInput ? { deviceId: selectedAudioInput } : true,
                                    video: selectedVideoInput ? { deviceId: selectedVideoInput } : true
                                });
                                setTestStream(stream);
                                alert('✅ Audio/Video Test Successful!');
                                setTimeout(() => {
                                    stream.getTracks().forEach(track => track.stop());
                                    setTestStream(null);
                                    setIsTestingDevices(false);
                                }, 3000);
                                } catch (error) {
                                alert('❌ Device Access Failed');
                                setIsTestingDevices(false);
                                }
                            }}
                            disabled={isTestingDevices}
                            className="text-xs font-bold uppercase tracking-wider text-blue-500 hover:text-blue-600 transition"
                        >
                            {isTestingDevices ? 'Testing...' : 'Test Devices'}
                        </button>
                    </div>
                </div>
            </div>
          </div>
        );

      case 'account':
        return (
          <div className="space-y-8 animate-slide-up">
            <div className="section-header">
              <h3>
                <i className="fa-solid fa-user"></i> My Account
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
                      <i className="fa-solid fa-circle-notch fa-spin text-white"></i>
                    ) : (
                      <i className="fa-solid fa-camera text-white"></i>
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
                            {handleAvailable && !handleError && <i className="fa-solid fa-check text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2"></i>}
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
                        {isSavingProfile ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
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
                                if(confirm('Are you sure you want to log out?')) {
                                    await logoutUser();
                                }
                            }}
                            className="text-red-500 hover:text-red-600 font-medium text-sm flex items-center gap-2"
                        >
                            <i className="fa-solid fa-right-from-bracket"></i>
                            Log Out of Pulse
                        </button>
                    </div>
                </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-4 animate-slide-up">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-bold dark:text-white text-zinc-900">Enable All Notifications</h4>
                    <p className="text-xs text-zinc-500">Master switch to pause all alerts</p>
                </div>
                <ToggleItem 
                    label="" 
                    desc="" 
                    active={enableAllNotifications} 
                    onToggle={() => setEnableAllNotifications(!enableAllNotifications)} 
                />
            </div>

            {enableAllNotifications && (
                <NotificationSettings
                    notifSound={notifSound}
                    setNotifSound={setNotifSound}
                    notifDesktop={notifDesktop}
                    setNotifDesktop={setNotifDesktop}
                    notifEmail={notifEmail}
                    setNotifEmail={setNotifEmail}
                    ToggleItem={ToggleItem}
                />
            )}
          </div>
        );

      case 'team':
        return (
            <div className="space-y-8 animate-slide-up">
                <div className="section-header">
                    <h3>
                        <i className="fa-solid fa-users"></i> Team Management
                    </h3>
                    <p>
                        Invite team members and manage access permissions.
                    </p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Invite New Member</h4>
                    <div className="flex gap-2">
                        <input 
                            type="email" 
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="colleague@company.com"
                            className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 dark:text-white text-zinc-900 focus:outline-none focus:border-blue-500"
                        />
                        <button 
                            onClick={() => {
                                if(inviteEmail) {
                                    setIsInviting(true);
                                    setTimeout(() => {
                                        setPendingInvites([...pendingInvites, { email: inviteEmail, date: new Date().toLocaleDateString() }]);
                                        setInviteEmail('');
                                        setIsInviting(false);
                                    }, 1000);
                                }
                            }}
                            disabled={!inviteEmail || isInviting}
                            className="px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                        >
                            {isInviting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                            Send Invite
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                        <h4 className="text-sm font-bold dark:text-white text-zinc-900">Pending Invitations</h4>
                    </div>
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                        {pendingInvites.map((invite, idx) => (
                            <div key={idx} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-500">
                                        <i className="fa-solid fa-envelope"></i>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium dark:text-white text-zinc-900">{invite.email}</p>
                                        <p className="text-xs text-zinc-500">Sent on {invite.date}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="text-xs font-medium text-blue-500 hover:text-blue-600">Resend</button>
                                    <button 
                                        className="text-xs font-medium text-red-500 hover:text-red-600"
                                        onClick={() => setPendingInvites(pendingInvites.filter((_, i) => i !== idx))}
                                    >
                                        Revoke
                                    </button>
                                </div>
                            </div>
                        ))}
                        {pendingInvites.length === 0 && (
                            <div className="p-8 text-center text-zinc-500 text-sm">
                                No pending invitations.
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                        <h4 className="text-sm font-bold dark:text-white text-zinc-900">Current Members</h4>
                    </div>
                    <div className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                            {name.charAt(0)}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold dark:text-white text-zinc-900">{name} (You)</p>
                            <p className="text-xs text-zinc-500">Admin</p>
                        </div>
                        <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs rounded-full font-medium">Active</span>
                    </div>
                </div>
            </div>
        );

      case 'accessibility':
        return (
            <div className="space-y-8 animate-slide-up">
                <div className="section-header">
                    <h3>
                        <i className="fa-solid fa-universal-access"></i> Accessibility
                    </h3>
                    <p>
                        Customize the interface to match your visual and motor preferences.
                    </p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-6">
                    <div>
                        <label className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4 block">Font Size</label>
                        <div className="flex gap-4">
                            {['small', 'default', 'large'].map((size) => (
                                <button
                                    key={size}
                                    onClick={() => setFontSize(size)}
                                    className={`flex-1 py-3 border rounded-xl flex flex-col items-center justify-center gap-2 transition ${
                                        fontSize === size 
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                                    }`}
                                >
                                    <span className={size === 'small' ? 'text-xs' : size === 'large' ? 'text-xl' : 'text-base'}>A</span>
                                    <span className="text-xs capitalize">{size}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

                    <ToggleItem 
                        label="High Contrast Mode" 
                        desc="Increase contrast for better legibility" 
                        active={highContrast} 
                        onToggle={() => setHighContrast(!highContrast)} 
                    />

                    <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

                    <ToggleItem 
                        label="Reduced Motion" 
                        desc="Minimize animations and transitions" 
                        active={reducedMotion} 
                        onToggle={() => setReducedMotion(!reducedMotion)} 
                    />
                </div>
            </div>
        );

      case 'privacy_data':
        return (
            <div className="space-y-8 animate-slide-up">
                <div className="section-header">
                    <h3>
                        <i className="fa-solid fa-shield-halved"></i> Privacy & Data
                    </h3>
                    <p>
                        Control your data collection settings and manage your personal information.
                    </p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Data Collection</h4>
                    <ToggleItem 
                        label="Analytics Tracking" 
                        desc="Allow Pulse to collect anonymous usage data to improve the app" 
                        active={analyticsTracking} 
                        onToggle={() => setAnalyticsTracking(!analyticsTracking)} 
                    />
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Data Management</h4>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium dark:text-white text-zinc-900">Rebuild Analytics Cache</p>
                                <p className="text-xs text-zinc-500">Fix issues with missing or incorrect charts</p>
                            </div>
                            <button className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
                                <i className="fa-solid fa-rotate mr-2"></i> Rebuild
                            </button>
                        </div>

                        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium dark:text-white text-zinc-900">Export My Data</p>
                                <p className="text-xs text-zinc-500">Download a copy of all your messages and contacts</p>
                            </div>
                            <button className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
                                <i className="fa-solid fa-download mr-2"></i> Export JSON
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-6 flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-bold text-red-600 dark:text-red-400 mb-1">Delete My Account</h4>
                        <p className="text-xs text-red-500/80">Permanently remove your account and all associated data</p>
                    </div>
                    <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm transition">
                        Delete Account
                    </button>
                </div>
            </div>
        );

      case 'about':
        return (
            <div className="space-y-8 animate-slide-up">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-20 h-20 bg-gradient-to-tr from-rose-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/30 mb-6">
                        <svg viewBox="0 0 64 64" className="w-12 h-12 text-white fill-current">
                            <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        </svg>
                    </div>
                    <h2 className="text-3xl font-bold dark:text-white text-zinc-900 mb-2">Pulse</h2>
                    <p className="text-zinc-500 mb-6">Version 2.4.0 (Beta)</p>
                    
                    <div className="flex gap-4">
                        <button className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold rounded-full hover:scale-105 transition transform">
                            Check for Updates
                        </button>
                        <button className="px-6 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                            <i className="fa-solid fa-download mr-2"></i> Install App
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    <a href="/privacy" className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-500 transition group">
                        <div className="flex items-center justify-between">
                            <span className="font-medium dark:text-white text-zinc-900">Privacy Policy</span>
                            <i className="fa-solid fa-arrow-right text-zinc-400 group-hover:text-blue-500 transition"></i>
                        </div>
                    </a>
                    <a href="/terms" className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-500 transition group">
                        <div className="flex items-center justify-between">
                            <span className="font-medium dark:text-white text-zinc-900">Terms of Service</span>
                            <i className="fa-solid fa-arrow-right text-zinc-400 group-hover:text-blue-500 transition"></i>
                        </div>
                    </a>
                    <a href="https://github.com/pulse/pulse" target="_blank" rel="noreferrer" className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-500 transition group">
                        <div className="flex items-center justify-between">
                            <span className="font-medium dark:text-white text-zinc-900">GitHub Repository</span>
                            <i className="fa-brands fa-github text-zinc-400 group-hover:text-black dark:group-hover:text-white transition"></i>
                        </div>
                    </a>
                    <a href="#" className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-500 transition group">
                        <div className="flex items-center justify-between">
                            <span className="font-medium dark:text-white text-zinc-900">Help Center</span>
                            <i className="fa-solid fa-circle-question text-zinc-400 group-hover:text-blue-500 transition"></i>
                        </div>
                    </a>
                </div>

                <div className="text-center pt-8 text-xs text-zinc-400">
                    <p>&copy; 2026 Pulse. All rights reserved.</p>
                    <p className="mt-1">Made with <i className="fa-solid fa-heart text-rose-500 mx-1"></i> by the Pulse Team.</p>
                </div>
            </div>
        );

      case 'billing':
        return (
          <div className="space-y-8 animate-slide-up">
            <div className="section-header">
              <h3>
                <i className="fa-solid fa-receipt"></i> Plan & Billing
              </h3>
              <p>
                Manage your subscription and team settings.
              </p>
            </div>

            {/* Current Plan Banner */}
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 border-2 border-rose-200 dark:border-rose-800 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
                  <i className="fa-solid fa-user text-white text-xl"></i>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xl font-bold dark:text-white text-zinc-900">Individual Plan</h4>
                    <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full">CURRENT</span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Free forever for personal use</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                  <i className="fa-solid fa-check text-emerald-500"></i>
                  <span>Unlimited conversations</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                  <i className="fa-solid fa-check text-emerald-500"></i>
                  <span>Voice & video calls</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                  <i className="fa-solid fa-check text-emerald-500"></i>
                  <span>AI-powered inbox</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                  <i className="fa-solid fa-check text-emerald-500"></i>
                  <span>Email & calendar sync</span>
                </div>
              </div>
            </div>

            {/* Plan Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Team Plan */}
              <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 hover:border-blue-400 dark:hover:border-blue-500 transition-all hover:shadow-lg group">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <i className="fa-solid fa-users text-white text-lg"></i>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold dark:text-white text-zinc-900">Team</h4>
                    <p className="text-xs text-zinc-500">Up to 10 members</p>
                  </div>
                </div>

                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  Perfect for small teams who want to collaborate with shared context.
                </p>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <i className="fa-solid fa-check text-blue-500"></i>
                    <span>Everything in Individual</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <i className="fa-solid fa-check text-blue-500"></i>
                    <span>Shared team database</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <i className="fa-solid fa-check text-blue-500"></i>
                    <span>Team knowledge base</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <i className="fa-solid fa-check text-blue-500"></i>
                    <span>Shared conversation history</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <i className="fa-solid fa-check text-blue-500"></i>
                    <span>Document collaboration</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <i className="fa-solid fa-check text-blue-500"></i>
                    <span>Team analytics dashboard</span>
                  </div>
                </div>

                <button className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-blue-500/30">
                  <span>Learn More</span>
                  <i className="fa-solid fa-arrow-right text-sm"></i>
                </button>
              </div>

              {/* Enterprise Plan */}
              <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 hover:border-purple-400 dark:hover:border-purple-500 transition-all hover:shadow-lg group">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                    <i className="fa-solid fa-building text-white text-lg"></i>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold dark:text-white text-zinc-900">Enterprise</h4>
                    <p className="text-xs text-zinc-500">10+ members</p>
                  </div>
                </div>

                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  For larger organizations with advanced security and customization needs.
                </p>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <i className="fa-solid fa-check text-purple-500"></i>
                    <span>Everything in Team</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <i className="fa-solid fa-check text-purple-500"></i>
                    <span>Unlimited team members</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <i className="fa-solid fa-check text-purple-500"></i>
                    <span>SSO & advanced security</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <i className="fa-solid fa-check text-purple-500"></i>
                    <span>Custom integrations</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <i className="fa-solid fa-check text-purple-500"></i>
                    <span>Dedicated support</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <i className="fa-solid fa-check text-purple-500"></i>
                    <span>On-premise deployment option</span>
                  </div>
                </div>

                <button className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-purple-500/30">
                  <span>Learn More</span>
                  <i className="fa-solid fa-arrow-right text-sm"></i>
                </button>
              </div>
            </div>

            {/* Billing Info */}
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4">Billing Information</h4>
              <div className="flex items-center justify-between py-3 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Current Plan</span>
                <span className="text-sm font-semibold dark:text-white text-zinc-900">Individual (Free)</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Billing Cycle</span>
                <span className="text-sm dark:text-zinc-300 text-zinc-700">N/A</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Next Invoice</span>
                <span className="text-sm dark:text-zinc-300 text-zinc-700">N/A</span>
              </div>
            </div>
          </div>
        );



      case 'developer':
        return (
          <div className="space-y-8 animate-slide-up">
            <div className="section-header">
              <h3>
                <i className="fa-solid fa-code"></i> Developer Tools
              </h3>
              <p>
                Tools for development, testing, and debugging.
              </p>
            </div>

            {/* API Keys Card */}
            <div className="integration-card">
              <div className="integration-header">
                <div className="integration-icon" style={{ background: 'linear-gradient(135deg, #10B981, #06B6D4)' }}>
                  <i className="fa-solid fa-key" style={{ color: 'white' }}></i>
                </div>
                <div className="integration-info" style={{ flex: 1 }}>
                  <h4>API Keys</h4>
                  <p>Configure API keys for AI services</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* OpenAI API Key */}
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-white text-zinc-900 flex items-center gap-2">
                    <i className="fa-solid fa-robot text-cyan-500"></i>
                    OpenAI API Key
                    <span className="text-xs text-zinc-500 font-normal">(for Voice Agents)</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showOpenaiKey ? 'text' : 'password'}
                        value={openaiApiKey}
                        onChange={(e) => {
                          setOpenaiApiKey(e.target.value);
                          setOpenaiKeySaved(false);
                        }}
                        placeholder="sk-proj-..."
                        className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                      />
                      <button
                        onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                        type="button"
                      >
                        <i className={`fa-solid ${showOpenaiKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        localStorage.setItem('openai_api_key', openaiApiKey);
                        setOpenaiKeySaved(true);
                        setTimeout(() => setOpenaiKeySaved(false), 3000);
                      }}
                      className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      {openaiKeySaved ? (
                        <>
                          <i className="fa-solid fa-check"></i>
                          Saved!
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-save"></i>
                          Save
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Required for OpenAI Realtime Voice Agents in the War Room. Get your key from{' '}
                    <a 
                      href="https://platform.openai.com/api-keys" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-cyan-500 hover:underline"
                    >
                      platform.openai.com/api-keys
                    </a>
                  </p>
                </div>

                {/* Status indicator */}
                {openaiApiKey && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${openaiApiKey.startsWith('sk-') ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                    <span className="text-zinc-500">
                      {openaiApiKey.startsWith('sk-') 
                        ? 'API key format looks valid' 
                        : 'API key should start with "sk-"'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Supabase Connection Info */}
            <div className="integration-card">
              <div className="integration-header">
                <div className="integration-icon" style={{ background: 'linear-gradient(135deg, #3ECF8E, #1E9E6B)' }}>
                  <i className="fa-solid fa-server" style={{ color: 'white' }}></i>
                </div>
                <div className="integration-info" style={{ flex: 1 }}>
                  <h4>Supabase Connection</h4>
                  <p>Your database connection status</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-sm dark:text-white text-zinc-900">Connected to Supabase</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">
                    Environment variables are configured. Check your .env file for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
                  </p>
                </div>
              </div>
            </div>

            {/* Design Preview Card */}
            <div className="integration-card">
              <div className="integration-header">
                <div className="integration-icon" style={{ background: 'linear-gradient(135deg, #EC4899, #F43F5E)' }}>
                  <i className="fa-solid fa-palette" style={{ color: 'white' }}></i>
                </div>
                <div className="integration-info" style={{ flex: 1 }}>
                  <h4>Design Preview</h4>
                  <p>Preview and explore different design styles</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Explore different design aesthetics including minimal, glassmorphism, neumorphism, claymorphism, brutalism, and flat design styles.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowDesignPreview(true)}
                    className="nothing-btn nothing-btn-primary"
                  >
                    <i className="fa-solid fa-palette"></i>
                    Open Design Preview
                  </button>
                </div>
              </div>
            </div>

            {/* Public API Keys Card */}
            <div className="integration-card">
              <div className="integration-header">
                <div className="integration-icon" style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}>
                  <i className="fa-solid fa-key" style={{ color: 'white' }}></i>
                </div>
                <div className="integration-info" style={{ flex: 1 }}>
                  <h4>Public API</h4>
                  <p>Generate API keys for programmatic access</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Create API keys to access Pulse programmatically. Build integrations, automate workflows, or connect the browser extension.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowApiKeysPanel(true)}
                    className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <i className="fa-solid fa-key"></i>
                    Manage API Keys
                  </button>
                  <a
                    href="/docs/api"
                    target="_blank"
                    className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <i className="fa-solid fa-book"></i>
                    API Documentation
                  </a>
                </div>
              </div>
            </div>
          </div>
        );


      case 'admin':
        // Admin Dashboard - embedded within Settings for admin users
        return (
          <div className="animate-slide-up -m-8">
            <AdminDashboard userId={user?.id || ''} />
          </div>
        );

      default:
        return <div className="text-zinc-500">Section under construction.</div>;
    }
  };

  const ToggleItem = ({ label, desc, active, onToggle }: { label: string, desc: string, active: boolean, onToggle: () => void }) => (
    <div className="flex justify-between items-center group cursor-pointer" onClick={onToggle}>
      <div>
        <div className="dark:text-white text-zinc-900 font-medium text-sm">{label}</div>
        <div className="text-zinc-500 text-xs">{desc}</div>
      </div>
      <button 
        className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${active ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
      >
        <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${active ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  );

  return (
    <div className="h-full bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row shadow-xl">
      
      {/* Settings Sidebar */}
      <div className="w-full md:w-64 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 p-4 flex flex-col">
        <h2 className="text-2xl font-bold dark:text-white text-zinc-900 mb-6 px-2 animate-fade-in">Settings</h2>
        <nav className="space-y-1 flex-1">
          {SECTIONS.map((section, idx) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group animate-slide-in-right ${activeSection === section.id ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <i className={`fa-solid ${section.icon} w-5 text-center transition-transform group-hover:scale-110`}></i>
              <span className="text-sm">{section.label}</span>
              {activeSection === section.id && <i className="fa-solid fa-chevron-right ml-auto text-xs opacity-50"></i>}
            </button>
          ))}

          {/* Admin Sections - Only visible to admin users */}
          {(user?.role === 'admin' || user?.isAdmin) && (
            <>
              <div className="border-t border-zinc-200 dark:border-zinc-800 my-4 pt-4">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-4">Admin</span>
              </div>
              {ADMIN_SECTIONS.map((section, idx) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group animate-slide-in-right ${activeSection === section.id ? 'bg-purple-600/10 text-purple-600 dark:text-purple-400 font-semibold' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                  style={{ animationDelay: `${(SECTIONS.length + idx) * 50}ms` }}
                >
                  <i className={`fa-solid ${section.icon} w-5 text-center transition-transform group-hover:scale-110`}></i>
                  <span className="text-sm">{section.label}</span>
                  {activeSection === section.id && <i className="fa-solid fa-chevron-right ml-auto text-xs opacity-50"></i>}
                </button>
              ))}
            </>
          )}
        </nav>
      </div>

      {/* Main Settings Content */}
      <div className="flex-1 overflow-y-auto p-8 relative bg-white dark:bg-zinc-950">
        <div className="max-w-2xl mx-auto">
             {renderContent()}
        </div>
      </div>

      {/* Design Preview Modal */}
      <DesignPreview
        isOpen={showDesignPreview}
        onClose={() => setShowDesignPreview(false)}
      />

      {/* API Keys Panel Modal */}
      {showApiKeysPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl">
            <ApiKeysPanel onClose={() => setShowApiKeysPanel(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
