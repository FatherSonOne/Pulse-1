// PrivacyDashboard.tsx - Show connected services and privacy controls
import React, { useState, useEffect } from 'react';
import { getGmailService } from '../../services/gmailService';
import { googleCalendarService } from '../../services/googleCalendarService';
import { supabase } from '../../services/supabase';
import { sessionService, type UserSession } from '../../services/sessionService';
import { mfaService, type MFAStatus, type MFAEnrollment } from '../../services/mfaService';
import { activityService, type ActivityLog } from '../../services/activityService';
import { securityAlertsService, type SecurityAlert } from '../../services/securityAlertsService';
import { dataRetentionService, RETENTION_OPTIONS, type DataRetentionPolicy, type CleanupStats } from '../../services/dataRetentionService';
import { oauthAppsService, type OAuthConnectedApp } from '../../services/oauthAppsService';
import { PrivacyTab } from './PrivacyDashboardPrivacyTab';
import { disconnectGoogleAccount } from '../../services/authService';
import toast from 'react-hot-toast';

import { AlertTriangle, Bell, Check, Download, ExternalLink, FileArchive, FileOutput, Info, Loader2, Lock, LogOut, Plug, RefreshCw, Shield, ShieldHalf, Trash2, TrendingUp, Unlink, X } from 'lucide-react';

interface PrivacyDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

interface ConnectedService {
  name: string;
  icon: string;
  status: 'active' | 'error' | 'disconnected';
  scopes: string[];
  dataAccessed: string[];
  lastSync?: Date;
  color: string;
}

// Remove local interface - using imported UserSession type

// Removed - using OAuthConnectedApp from service

export const PrivacyDashboard: React.FC<PrivacyDashboardProps> = ({
  isOpen,
  onClose,
  userEmail,
}) => {
  const [activeTab, setActiveTab] = useState<'services' | 'privacy' | 'security' | 'activity'>('services');
  const [services, setServices] = useState<ConnectedService[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [thirdPartyApps, setThirdPartyApps] = useState<OAuthConnectedApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [downloadHistory, setDownloadHistory] = useState<any[]>([]);

  // Privacy settings
  const [retentionPolicy, setRetentionPolicy] = useState<DataRetentionPolicy | null>(null);
  const [cleanupStats, setCleanupStats] = useState<CleanupStats | null>(null);
  const [mfaStatus, setMfaStatus] = useState<MFAStatus>({ enabled: false, factors: [], hasRecoveryCodes: false });
  const [securityAlertsEnabled, setSecurityAlertsEnabled] = useState(true);

  // Delete account confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // MFA enrollment state
  const [mfaEnrollment, setMfaEnrollment] = useState<MFAEnrollment | null>(null);
  const [mfaVerificationCode, setMfaVerificationCode] = useState('');
  const [showMfaSetup, setShowMfaSetup] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let unsubscribeActivity: (() => void) | undefined;
    let unsubscribeAlerts: (() => void) | undefined;

    const setupSubscriptions = async () => {
      loadServicesAndActivity();
      loadSecurityData();

      // Subscribe to real-time activity updates
      unsubscribeActivity = await activityService.subscribeToActivity((activity) => {
        setActivityLog((prev) => [activity, ...prev].slice(0, 50));
      });

      // Subscribe to real-time security alerts
      unsubscribeAlerts = await securityAlertsService.subscribeToAlerts((alert) => {
        setSecurityAlerts((prev) => [alert, ...prev]);
        // Show toast notification for new alert
        if (alert.alert_level === 'critical' || alert.alert_level === 'high') {
          toast.error(`Security Alert: ${alert.title}`);
        } else {
          toast(`Security Alert: ${alert.title}`);
        }
      });
    };

    setupSubscriptions();

    return () => {
      if (unsubscribeActivity) unsubscribeActivity();
      if (unsubscribeAlerts) unsubscribeAlerts();
    };
  }, [isOpen]);

  const loadServicesAndActivity = async () => {
    setLoading(true);
    try {
      // Check if Google is connected via Supabase session provider token
      const { data: { session } } = await supabase.auth.getSession();
      const isGoogleConnected: boolean = !!(
        session?.provider_token ||
        session?.user?.app_metadata?.provider === 'google' ||
        session?.user?.app_metadata?.providers?.includes('google')
      );
      const googleStatus: ConnectedService['status'] = isGoogleConnected ? 'active' : 'disconnected';

      const servicesData: ConnectedService[] = [
        {
          name: 'Gmail',
          icon: 'fa-envelope',
          status: googleStatus,
          scopes: [
            'gmail.readonly',
            'gmail.send',
            'gmail.modify',
            'gmail.labels',
          ],
          dataAccessed: [
            'Read your emails',
            'Send emails on your behalf',
            'Create and manage labels',
            'Search your emails',
            'Manage drafts',
          ],
          lastSync: new Date(),
          color: 'red',
        },
        {
          name: 'Google Contacts',
          icon: 'fa-address-book',
          status: googleStatus,
          scopes: ['contacts.readonly', 'contacts.other.readonly'],
          dataAccessed: [
            'Read your contacts',
            'Sync contact information',
            'Access contact photos',
          ],
          lastSync: new Date(),
          color: 'blue',
        },
        {
          name: 'Google Calendar',
          icon: 'fa-calendar',
          status: googleStatus,
          scopes: ['calendar.readonly', 'calendar.events'],
          dataAccessed: [
            'Read calendar events',
            'Create and modify events',
            'Send meeting invitations',
          ],
          lastSync: new Date(),
          color: 'green',
        },
        {
          name: 'Google Drive',
          icon: 'fa-folder-open',
          status: googleStatus,
          scopes: ['drive.file', 'drive.readonly'],
          dataAccessed: [
            'Access files created by Pulse',
            'Read shared files',
            'Upload attachments',
          ],
          lastSync: new Date(),
          color: 'yellow',
        },
      ];

      setServices(servicesData);

      // Load real activity log from Supabase
      const activities = await activityService.getRecentActivity(50);
      setActivityLog(activities);

      // Load security alerts
      const alerts = await securityAlertsService.getAlerts(undefined, 20);
      setSecurityAlerts(alerts);

      // Load security settings
      const settings = await securityAlertsService.getSecuritySettings();
      if (settings) {
        setSecurityAlertsEnabled(settings.alerts_enabled);
      }

      // Load data retention policy and stats
      try {
        const policy = await dataRetentionService.getPolicy();
        setRetentionPolicy(policy);

        const stats = await dataRetentionService.getCleanupStats();
        setCleanupStats(stats);
      } catch (error) {
        console.error('Error loading retention policy:', error);
      }

      // Sessions loaded separately in loadSecurityData()

      // Load third-party OAuth apps
      try {
        await oauthAppsService.syncGoogleApps();
        const apps = await oauthAppsService.getConnectedApps();
        setThirdPartyApps(apps);
      } catch (error) {
        console.error('Error loading OAuth apps:', error);
        setThirdPartyApps([]);
      }

      // Load download history (mock data)
      setDownloadHistory([
        {
          id: '1',
          type: 'Data Export',
          size: '2.4 GB',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
          status: 'completed',
        },
        {
          id: '2',
          type: 'Email Archive',
          size: '850 MB',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
          status: 'completed',
        },
      ]);
    } catch (error) {
      console.error('Error loading services:', error);
      toast.error('Failed to load privacy information');
    } finally {
      setLoading(false);
    }
  };

  const loadSecurityData = async () => {
    try {
      // Load real sessions from Supabase Auth
      const userSessions = await sessionService.getAllSessions();
      setSessions(userSessions);

      // Load real MFA status
      const status = await mfaService.getMFAStatus();
      setMfaStatus(status);
    } catch (error) {
      console.error('Error loading security data:', error);
      toast.error('Failed to load security information');
    }
  };

  const handleRefreshService = async (serviceName: string) => {
    const toastId = toast.loading(`Refreshing ${serviceName}...`);
    try {
      await loadServicesAndActivity();
      toast.success(`${serviceName} refreshed`, { id: toastId });
    } catch {
      toast.error(`Failed to refresh ${serviceName}`, { id: toastId });
    }
  };

  const handleDisconnectService = async (serviceName: string) => {
    if (!confirm(`Are you sure you want to disconnect ${serviceName}? You will lose access to ${serviceName} features in Pulse.`)) {
      return;
    }
    const toastId = toast.loading(`Disconnecting ${serviceName}...`);
    try {
      // All current services are Google services — revoke Google OAuth access
      await disconnectGoogleAccount();
      await loadServicesAndActivity();
      toast.success(`${serviceName} disconnected`, { id: toastId });
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error(`Failed to disconnect ${serviceName}`, { id: toastId });
    }
  };

  const handleExportData = async () => {
    const toastId = toast.loading('Preparing data export...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('pulse_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const exportData = {
        exportedAt: new Date().toISOString(),
        email: user.email,
        profile: profile || {},
        userId: user.id,
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pulse-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data export downloaded!', { id: toastId });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data', { id: toastId });
    }
  };

  const handleDeleteData = () => {
    setShowDeleteConfirm(true);
    setDeleteConfirmEmail('');
  };

  const confirmDeleteAccount = async () => {
    if (deleteConfirmEmail !== userEmail) {
      toast.error('Email does not match your account email.');
      return;
    }
    setIsDeletingAccount(true);
    const toastId = toast.loading('Deleting account data...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await supabase.rpc('delete_user_account', { target_user_id: user.id });
      await supabase.auth.signOut();
      toast.success('Account deleted', { id: toastId });
      onClose();
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error('Failed to delete account. Please contact support.', { id: toastId });
      setIsDeletingAccount(false);
    }
  };

  const handlePolicyUpdate = (policy: DataRetentionPolicy) => {
    setRetentionPolicy(policy);
    // Reload cleanup stats after policy update
    dataRetentionService.getCleanupStats().then(setCleanupStats).catch(console.error);
  };

  const handleAppRevoke = (appId: string) => {
    setThirdPartyApps((prev) => prev.filter((app) => app.id !== appId));
  };

  const handleRevokeSession = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    if (!confirm(`Sign out from ${session.device}?`)) {
      return;
    }

    const success = await sessionService.revokeSession(sessionId);
    if (success) {
      await loadSecurityData();
    }
  };

  const handleSignOutAllOtherDevices = async () => {
    if (!confirm('This will sign you out of all other devices. Continue?')) {
      return;
    }

    const success = await sessionService.signOutAllOtherDevices();
    if (success) {
      await loadSecurityData();
    }
  };

  const handleEnableMFA = async () => {
    setLoading(true);
    try {
      const enrollment = await mfaService.enrollMFA();
      if (enrollment) {
        setMfaEnrollment(enrollment);
        setShowMfaSetup(true);
      }
    } catch (error) {
      console.error('Error enabling MFA:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMFA = async () => {
    if (!mfaEnrollment || !mfaVerificationCode) {
      toast.error('Please enter the verification code');
      return;
    }

    setLoading(true);
    try {
      const success = await mfaService.verifyMFAEnrollment(mfaEnrollment.id, mfaVerificationCode);
      if (success) {
        setShowMfaSetup(false);
        setMfaEnrollment(null);
        setMfaVerificationCode('');
        await loadSecurityData();
      }
    } catch (error) {
      console.error('Error verifying MFA:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMFA = async () => {
    if (!confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
      return;
    }

    setLoading(true);
    try {
      const success = await mfaService.disableAllMFA();
      if (success) {
        await loadSecurityData();
      }
    } catch (error) {
      console.error('Error disabling MFA:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelMFASetup = () => {
    setShowMfaSetup(false);
    setMfaEnrollment(null);
    setMfaVerificationCode('');
  };

  const getStatusBadge = (status: ConnectedService['status']) => {
    const badges = {
      active: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
      error: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
      disconnected: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400',
    };

    const labels = {
      active: 'Connected',
      error: 'Error',
      disconnected: 'Disconnected',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const formatTimestamp = (date: Date | string) => {
    const now = new Date();
    const dateObj = date instanceof Date ? date : new Date(date);
    const diffMinutes = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return dateObj.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* MFA Setup Modal */}
      {showMfaSetup && mfaEnrollment && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[10000] animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 border border-zinc-200 dark:border-zinc-800">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-4">
                <ShieldHalf className="text-3xl text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                Set Up Two-Factor Authentication
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Scan the QR code with your authenticator app
              </p>
            </div>

            <div className="space-y-4">
              {/* QR Code */}
              {mfaEnrollment.qrCode && (
                <div className="bg-white p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                  <img
                    src={mfaEnrollment.qrCode}
                    alt="QR Code"
                    className="w-48 h-48"
                  />
                </div>
              )}

              {/* Manual Entry Code */}
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  Or enter this code manually:
                </p>
                <code className="text-sm font-mono text-zinc-900 dark:text-white break-all">
                  {mfaEnrollment.secret}
                </code>
              </div>

              {/* Verification Code Input */}
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  Enter 6-digit code from your app
                </label>
                <input
                  type="text"
                  value={mfaVerificationCode}
                  onChange={(e) => setMfaVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white text-center text-xl font-mono tracking-widest"
                  maxLength={6}
                  autoFocus
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCancelMFASetup}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifyMFA}
                  disabled={loading || mfaVerificationCode.length !== 6}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Enable'
                  )}
                </button>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <Info className="mr-2" />
                  Use apps like Google Authenticator, Authy, or 1Password to scan the QR code.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Privacy Dashboard */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-end z-[9999] animate-fadeIn p-0">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl h-screen rounded-l-2xl shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800 overflow-hidden animate-slideInFromRight">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-rose-500/10 to-pink-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
              <ShieldHalf className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Privacy & Connected Services</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{userEmail}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition"
            title="Close"
          >
            <X />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-stretch gap-1 px-2 sm:px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          <button
            onClick={() => setActiveTab('services')}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'services'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Plug className="text-xs shrink-0" />
            <span className="truncate">Services</span>
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'privacy'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Lock className="text-xs shrink-0" />
            <span className="truncate">Privacy</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'security'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Shield className="text-xs shrink-0" />
            <span className="truncate">Security</span>
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'activity'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="text-xs shrink-0" />
            <span className="truncate">Activity</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="text-3xl text-rose-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Services Tab */}
              {activeTab === 'services' && (
                <div className="space-y-6">
                  {/* Privacy Summary */}
                  <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-4 border border-rose-200 dark:border-rose-800">
                    <div className="flex items-start gap-3">
                      <Info className="text-rose-500 text-xl" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-rose-900 dark:text-rose-100 mb-1">
                          How Pulse Uses Your Data
                        </h3>
                        <p className="text-sm text-rose-800 dark:text-rose-200">
                          Pulse has access to the following Google services on your behalf. All data is encrypted
                          and used only to provide the features you've requested. We never sell your data to third parties.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Connected Services */}
                  <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Connected Services</h3>
                <div className="space-y-4">
                  {services.map((service) => (
                    <div
                      key={service.name}
                      className="bg-white dark:bg-zinc-800/50 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-lg bg-${service.color}-100 dark:bg-${service.color}-900/20 flex items-center justify-center`}>
                            <i className={`fa-solid ${service.icon} text-${service.color}-600 dark:text-${service.color}-400 text-xl`}></i>
                          </div>
                          <div>
                            <h4 className="font-semibold text-zinc-900 dark:text-white">{service.name}</h4>
                            {service.lastSync && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Last synced: {formatTimestamp(service.lastSync)}
                              </p>
                            )}
                          </div>
                        </div>
                        {getStatusBadge(service.status)}
                      </div>

                      <div className="mb-4">
                        <h5 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                          What Pulse can access:
                        </h5>
                        <ul className="space-y-1">
                          {service.dataAccessed.map((access, idx) => (
                            <li key={idx} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                              <Check className="text-green-500 text-xs mt-1 flex-shrink-0" />
                              <span>{access}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRefreshService(service.name)}
                          className="px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition"
                        >
                          <RefreshCw className="mr-2" />
                          Refresh
                        </button>
                        <button
                          onClick={() => handleDisconnectService(service.name)}
                          className="px-3 py-2 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition"
                        >
                          <Unlink className="mr-2" />
                          Disconnect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Google Account Link */}
              <div>
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition group"
                >
                  <div className="flex items-center gap-3">
                    <ExternalLink className="text-rose-500 text-xl" />
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        Manage Google Account Permissions
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        View and manage all apps connected to your Google Account
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
                </a>
              </div>
            </div>
              )}

              {/* Privacy Tab */}
              {activeTab === 'privacy' && (
                <div className="space-y-6">
                  <PrivacyTab
                    retentionPolicy={retentionPolicy}
                    cleanupStats={cleanupStats}
                    thirdPartyApps={thirdPartyApps}
                    onPolicyUpdate={handlePolicyUpdate}
                    onAppRevoke={handleAppRevoke}
                    formatTimestamp={formatTimestamp}
                  />

                  {/* Data Actions */}
                  <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700 space-y-4">
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Data Actions</h3>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handleExportData}
                        className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                      >
                        <FileOutput />
                        Export My Data
                      </button>
                      <button
                        onClick={handleDeleteData}
                        className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                      >
                        <Trash2 />
                        Delete Account
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Data export downloads a JSON file with your profile and settings. Account deletion is permanent and cannot be undone.
                    </p>
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  {/* Active Sessions */}
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Active Sessions</h3>
                    <div className="space-y-3">
                      {sessions.map((session) => (
                        <div
                          key={session.id}
                          className="bg-white dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                                <i className={`fa-solid ${session.device.includes('iPhone') ? 'fa-mobile' : 'fa-desktop'} text-zinc-600 dark:text-zinc-400`}></i>
                              </div>
                              <div>
                                <h4 className="font-semibold text-zinc-900 dark:text-white">{session.device}</h4>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {session.browser} • {session.location}
                                </p>
                              </div>
                            </div>
                            {session.current && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              Last active: {formatTimestamp(session.lastActive)}
                            </p>
                            {!session.current && (
                              <button
                                onClick={() => handleRevokeSession(session.id)}
                                className="text-sm text-red-600 dark:text-red-400 hover:underline"
                                disabled={loading}
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Two-Factor Authentication */}
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Two-Factor Authentication</h3>
                    <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-semibold text-zinc-900 dark:text-white mb-1">
                            {mfaStatus.enabled ? 'Enabled' : 'Not Enabled'}
                          </h4>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {mfaStatus.enabled
                              ? 'Your account is protected with 2FA'
                              : 'Add an extra layer of security to your account'}
                          </p>
                          {mfaStatus.enabled && mfaStatus.factors.length > 0 && (
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                              Enrolled: {new Date(mfaStatus.factors[0].createdAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${mfaStatus.enabled ? 'bg-green-100 dark:bg-green-900/20' : 'bg-amber-100 dark:bg-amber-900/20'}`}>
                          <i className={`fa-solid ${mfaStatus.enabled ? 'fa-check' : 'fa-exclamation-triangle'} text-xl ${mfaStatus.enabled ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}></i>
                        </div>
                      </div>
                      <button
                        onClick={mfaStatus.enabled ? handleDisableMFA : handleEnableMFA}
                        disabled={loading}
                        className={`w-full px-4 py-2 rounded-lg font-medium transition ${
                          mfaStatus.enabled
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                            : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 animate-spin" />
                            {mfaStatus.enabled ? 'Disabling...' : 'Setting up...'}
                          </>
                        ) : (
                          <>{mfaStatus.enabled ? 'Disable 2FA' : 'Enable 2FA'}</>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Security Alerts */}
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Security Alerts</h3>
                    <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-semibold text-zinc-900 dark:text-white mb-1">
                            Unusual Activity Notifications
                          </h4>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Get notified about suspicious login attempts
                          </p>
                        </div>
                        <button
                          onClick={() => setSecurityAlertsEnabled(!securityAlertsEnabled)}
                          className={`relative inline-flex items-center h-6 w-11 rounded-full transition ${
                            securityAlertsEnabled ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        >
                          <span
                            className={`inline-block w-5 h-5 bg-white rounded-full transform transition ${
                              securityAlertsEnabled ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      {securityAlertsEnabled && (
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                          <p className="text-xs text-zinc-600 dark:text-zinc-400">
                            <Bell className="text-rose-500 mr-2" />
                            We'll send you email alerts when we detect unusual activity on your account
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sign Out All Devices */}
                  <div>
                    <button
                      onClick={handleSignOutAllOtherDevices}
                      disabled={loading || sessions.filter(s => !s.current).length === 0}
                      className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <LogOut className="mr-2" />
                      Sign Out of All Other Devices
                    </button>
                    {sessions.filter(s => !s.current).length === 0 && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 text-center">
                        No other active sessions
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Activity Tab */}
              {activeTab === 'activity' && (
                <div className="space-y-6">
                  {/* Recent Activity */}
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Recent Activity</h3>
                    <div className="bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                      {activityLog.length === 0 ? (
                        <div className="p-6 text-center text-zinc-500 dark:text-zinc-400">
                          No recent activity
                        </div>
                      ) : (
                        <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                          {activityLog.map((log) => (
                            <div key={log.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                      {log.description}
                                    </p>
                                    {log.severity === 'critical' && (
                                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                                        Critical
                                      </span>
                                    )}
                                    {log.severity === 'warning' && (
                                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                                        Warning
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                      {log.action_type.replace(/_/g, ' ')}
                                    </span>
                                    {log.device_info?.os && (
                                      <>
                                        <span className="text-xs text-zinc-400">•</span>
                                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                          {log.device_info.os} - {log.device_info.browser}
                                        </span>
                                      </>
                                    )}
                                    {log.location_info?.city && (
                                      <>
                                        <span className="text-xs text-zinc-400">•</span>
                                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                          {log.location_info.city}, {log.location_info.country}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <span className="text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                                  {formatTimestamp(new Date(log.created_at))}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Download History */}
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Download History</h3>
                    <div className="space-y-3">
                      {downloadHistory.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                          No data exports yet
                        </div>
                      ) : (
                        downloadHistory.map((download) => (
                          <div
                            key={download.id}
                            className="bg-white dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                                  <FileArchive className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-zinc-900 dark:text-white">{download.type}</h4>
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {download.size} • {formatTimestamp(download.timestamp)}
                                  </p>
                                </div>
                              </div>
                              <button className="px-3 py-1.5 text-sm bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 transition">
                                <Download className="mr-1" />
                                Download
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
          >
            Close
          </button>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-rose-600 dark:text-rose-400 hover:underline"
          >
            Privacy Policy <ExternalLink className="text-xs ml-1" />
          </a>
        </div>
      </div>
    </div>

    {/* Delete Account Confirmation Modal */}
    {showDeleteConfirm && (
      <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-white">Delete Account</h3>
              <p className="text-sm text-zinc-500">This action is permanent and cannot be undone.</p>
            </div>
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">
            All your messages, contacts, calendar events, and settings will be permanently deleted.
            To confirm, type your account email: <strong>{userEmail}</strong>
          </p>
          <input
            type="email"
            value={deleteConfirmEmail}
            onChange={(e) => setDeleteConfirmEmail(e.target.value)}
            placeholder={userEmail}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm mb-4 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteAccount}
              disabled={isDeletingAccount || deleteConfirmEmail !== userEmail}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition"
            >
              {isDeletingAccount ? 'Deleting...' : 'Delete My Account'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default PrivacyDashboard;
