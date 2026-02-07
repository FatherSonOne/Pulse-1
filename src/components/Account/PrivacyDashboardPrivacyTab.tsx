/**
 * Privacy Tab Component for Privacy Dashboard
 * Handles data retention, OAuth apps, and data management
 */

import React, { useState } from 'react';
import { dataRetentionService, RETENTION_OPTIONS } from '../../services/dataRetentionService';
import { oauthAppsService } from '../../services/oauthAppsService';
import type { DataRetentionPolicy, CleanupStats } from '../../services/dataRetentionService';
import type { OAuthConnectedApp } from '../../services/oauthAppsService';
import toast from 'react-hot-toast';

interface PrivacyTabProps {
  retentionPolicy: DataRetentionPolicy | null;
  cleanupStats: CleanupStats | null;
  thirdPartyApps: OAuthConnectedApp[];
  onPolicyUpdate: (policy: DataRetentionPolicy) => void;
  onAppRevoke: (appId: string) => void;
  formatTimestamp: (date: Date | string) => string;
}

export const PrivacyTab: React.FC<PrivacyTabProps> = ({
  retentionPolicy,
  cleanupStats,
  thirdPartyApps,
  onPolicyUpdate,
  onAppRevoke,
  formatTimestamp,
}) => {
  const [updatingRetention, setUpdatingRetention] = useState(false);
  const [previewingCleanup, setPreviewingCleanup] = useState(false);

  const handleRetentionChange = async (
    dataType: 'emails' | 'calendar' | 'contacts' | 'messages',
    days: number
  ) => {
    if (!retentionPolicy) return;

    setUpdatingRetention(true);
    try {
      await dataRetentionService.updateRetentionPeriod(dataType, days);
      const updatedPolicy = await dataRetentionService.getPolicy();
      if (updatedPolicy) {
        onPolicyUpdate(updatedPolicy);
        toast.success(`${dataType} retention updated to ${days === -1 ? 'never delete' : `${days} days`}`);
      }
    } catch (error) {
      console.error('Error updating retention:', error);
      toast.error('Failed to update retention policy');
    } finally {
      setUpdatingRetention(false);
    }
  };

  const handleAutoCleanupToggle = async (enabled: boolean) => {
    setUpdatingRetention(true);
    try {
      await dataRetentionService.setAutoCleanup(enabled);
      const updatedPolicy = await dataRetentionService.getPolicy();
      if (updatedPolicy) {
        onPolicyUpdate(updatedPolicy);
        toast.success(`Automatic cleanup ${enabled ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      console.error('Error toggling auto cleanup:', error);
      toast.error('Failed to update auto cleanup setting');
    } finally {
      setUpdatingRetention(false);
    }
  };

  const handlePreviewCleanup = async () => {
    setPreviewingCleanup(true);
    try {
      const preview = await dataRetentionService.previewCleanup();
      toast.success(
        `Cleanup would delete ${preview.stats.total_eligible} items and free ${preview.estimatedSavings}`,
        { duration: 5000 }
      );
    } catch (error) {
      console.error('Error previewing cleanup:', error);
      toast.error('Failed to preview cleanup');
    } finally {
      setPreviewingCleanup(false);
    }
  };

  const handleManualCleanup = async () => {
    if (!confirm('Are you sure you want to delete old data according to your retention policy? This cannot be undone.')) {
      return;
    }

    try {
      toast.loading('Running cleanup...');
      const results = await dataRetentionService.executeFullCleanup();
      const totalDeleted = results.reduce((sum, r) => sum + r.items_deleted, 0);
      toast.dismiss();
      toast.success(`Deleted ${totalDeleted} items`);
    } catch (error) {
      toast.dismiss();
      console.error('Error running cleanup:', error);
      toast.error('Failed to run cleanup');
    }
  };

  const handleRevokeApp = async (appId: string, appName: string) => {
    if (!confirm(`Are you sure you want to revoke access for ${appName}?`)) {
      return;
    }

    try {
      await oauthAppsService.revokeApp(appId);
      onAppRevoke(appId);
      toast.success(`Revoked access for ${appName}`);
    } catch (error) {
      console.error('Error revoking app:', error);
      toast.error('Failed to revoke app access');
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Retention Summary */}
      {cleanupStats && cleanupStats.total_eligible > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <i className="fa-solid fa-clock text-amber-500 text-xl"></i>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                {cleanupStats.total_eligible} Items Eligible for Cleanup
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                Based on your retention policy, these items are ready to be deleted.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreviewCleanup}
                  disabled={previewingCleanup}
                  className="px-3 py-1.5 text-sm bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/60 transition"
                >
                  {previewingCleanup ? 'Previewing...' : 'Preview Cleanup'}
                </button>
                <button
                  onClick={handleManualCleanup}
                  className="px-3 py-1.5 text-sm bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/60 transition"
                >
                  Run Cleanup Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto Cleanup Toggle */}
      {retentionPolicy && (
        <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-zinc-900 dark:text-white mb-1">
                Automatic Data Cleanup
              </h4>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Automatically delete old data based on retention periods
              </p>
            </div>
            <button
              onClick={() => handleAutoCleanupToggle(!retentionPolicy.auto_cleanup_enabled)}
              disabled={updatingRetention}
              className={`relative inline-flex items-center h-6 w-11 rounded-full transition ${
                retentionPolicy.auto_cleanup_enabled ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block w-5 h-5 bg-white rounded-full transform transition ${
                  retentionPolicy.auto_cleanup_enabled ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {retentionPolicy.auto_cleanup_enabled && retentionPolicy.next_cleanup_at && (
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                <i className="fa-solid fa-clock mr-2"></i>
                Next cleanup: {new Date(retentionPolicy.next_cleanup_at).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Data Retention Policies */}
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Data Retention Policies</h3>
        <div className="space-y-3">
          {/* Emails Retention */}
          <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                  <i className="fa-solid fa-envelope text-red-600 dark:text-red-400"></i>
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-900 dark:text-white">Emails</h4>
                  {cleanupStats && cleanupStats.emails_eligible > 0 && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {cleanupStats.emails_eligible} items eligible for deletion
                    </p>
                  )}
                </div>
              </div>
            </div>
            <select
              value={retentionPolicy?.emails_retention_days || 90}
              onChange={(e) => handleRetentionChange('emails', Number(e.target.value))}
              disabled={updatingRetention}
              className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white disabled:opacity-50"
            >
              {RETENTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Calendar Retention */}
          <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <i className="fa-solid fa-calendar text-green-600 dark:text-green-400"></i>
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-900 dark:text-white">Calendar Events</h4>
                  {cleanupStats && cleanupStats.calendar_eligible > 0 && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {cleanupStats.calendar_eligible} items eligible for deletion
                    </p>
                  )}
                </div>
              </div>
            </div>
            <select
              value={retentionPolicy?.calendar_retention_days || 365}
              onChange={(e) => handleRetentionChange('calendar', Number(e.target.value))}
              disabled={updatingRetention}
              className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white disabled:opacity-50"
            >
              {RETENTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Messages Retention */}
          <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <i className="fa-solid fa-message text-blue-600 dark:text-blue-400"></i>
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-900 dark:text-white">Messages</h4>
                  {cleanupStats && cleanupStats.messages_eligible > 0 && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {cleanupStats.messages_eligible} items eligible for deletion
                    </p>
                  )}
                </div>
              </div>
            </div>
            <select
              value={retentionPolicy?.messages_retention_days || 180}
              onChange={(e) => handleRetentionChange('messages', Number(e.target.value))}
              disabled={updatingRetention}
              className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white disabled:opacity-50"
            >
              {RETENTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Third-Party OAuth Apps */}
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Connected Third-Party Apps</h3>
        <div className="space-y-3">
          {thirdPartyApps.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <i className="fa-solid fa-shield-check text-4xl mb-3 text-zinc-300 dark:text-zinc-600"></i>
              <p>No third-party apps connected</p>
              <p className="text-xs mt-1">Your account is only accessed by Pulse</p>
            </div>
          ) : (
            thirdPartyApps.map((app) => (
              <div
                key={app.id}
                className="bg-white dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                      <i className="fa-solid fa-plug text-zinc-600 dark:text-zinc-400"></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-white">{app.app_name}</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Last used: {app.last_used_at ? formatTimestamp(app.last_used_at) : 'Never'}
                      </p>
                    </div>
                  </div>
                  {app.is_trusted && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                      Trusted
                    </span>
                  )}
                </div>
                <div className="mb-3">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Permissions:
                  </p>
                  <ul className="space-y-1">
                    {app.permissions_granted.map((permission, idx) => (
                      <li key={idx} className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                        <i className="fa-solid fa-check text-green-500 text-[10px]"></i>
                        {permission}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => handleRevokeApp(app.id, app.app_name)}
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  <i className="fa-solid fa-ban mr-1"></i>
                  Revoke Access
                </button>
              </div>
            ))
          )}
        </div>

        {/* Link to Google/Microsoft account permissions */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => oauthAppsService.openGooglePermissionsPage()}
            className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            <i className="fa-brands fa-google text-rose-500"></i>
            <span>Google Apps</span>
            <i className="fa-solid fa-external-link text-xs"></i>
          </button>
          <button
            onClick={() => oauthAppsService.openMicrosoftPermissionsPage()}
            className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            <i className="fa-brands fa-microsoft text-blue-500"></i>
            <span>Microsoft Apps</span>
            <i className="fa-solid fa-external-link text-xs"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyTab;
