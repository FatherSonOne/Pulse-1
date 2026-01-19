/**
 * Share Modal Component
 * Modal for sharing documents or projects with users
 */

import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  DocumentShare,
  ProjectShare,
  SharePermissions,
  PERMISSION_PRESETS,
  PermissionPreset,
} from '../../../types/collaboration';
import {
  getDocumentShares,
  createDocumentShare,
  deleteDocumentShare,
  createPublicLink,
  copyShareUrl,
  getProjectShares,
  createProjectShare,
  deleteProjectShare,
} from '../../../services/collaborationService';

interface ShareModalProps {
  type: 'document' | 'project';
  resourceId: string;
  resourceTitle: string;
  userId: string;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  type,
  resourceId,
  resourceTitle,
  userId,
  onClose,
}) => {
  const [shares, setShares] = useState<(DocumentShare | ProjectShare)[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<PermissionPreset>('viewer');
  const [message, setMessage] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expiresIn, setExpiresIn] = useState<string>('never');
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [isCreatingLink, setIsCreatingLink] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load existing shares
  useEffect(() => {
    loadShares();
    inputRef.current?.focus();
  }, [resourceId]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const loadShares = async () => {
    try {
      const data = type === 'document'
        ? await getDocumentShares(resourceId)
        : await getProjectShares(resourceId);
      setShares(data);

      // Find existing public link
      const linkShare = data.find(s => s.public_link);
      if (linkShare) {
        setPublicLink(linkShare.public_link!);
      }
    } catch (error) {
      console.error('Error loading shares:', error);
      toast.error('Failed to load shares');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      const permissions = PERMISSION_PRESETS[selectedPreset].permissions;
      let expiresAt: string | undefined;

      if (expiresIn !== 'never') {
        const date = new Date();
        switch (expiresIn) {
          case '1d': date.setDate(date.getDate() + 1); break;
          case '7d': date.setDate(date.getDate() + 7); break;
          case '30d': date.setDate(date.getDate() + 30); break;
        }
        expiresAt = date.toISOString();
      }

      if (type === 'document') {
        const share = await createDocumentShare(userId, {
          doc_id: resourceId,
          shared_with_email: email.trim(),
          permissions,
          message: message.trim() || undefined,
          expires_at: expiresAt,
        });
        setShares([share, ...shares]);
      } else {
        const share = await createProjectShare(userId, {
          project_id: resourceId,
          shared_with_email: email.trim(),
          permissions: { ...permissions, canAddDocs: selectedPreset === 'editor' || selectedPreset === 'admin' },
          message: message.trim() || undefined,
          expires_at: expiresAt,
        });
        setShares([share, ...shares]);
      }

      toast.success(`Shared with ${email}`);
      setEmail('');
      setMessage('');
    } catch (error: any) {
      console.error('Error sharing:', error);
      toast.error(error.message || 'Failed to share');
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    if (!confirm('Remove this share? The user will lose access.')) return;

    try {
      if (type === 'document') {
        await deleteDocumentShare(shareId);
      } else {
        await deleteProjectShare(shareId);
      }
      setShares(shares.filter(s => s.id !== shareId));
      toast.success('Share removed');
    } catch (error) {
      toast.error('Failed to remove share');
    }
  };

  const handleCreatePublicLink = async () => {
    setIsCreatingLink(true);
    try {
      const link = await createPublicLink(userId, resourceId);
      setPublicLink(link);
      toast.success('Public link created');
    } catch (error) {
      toast.error('Failed to create link');
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!publicLink) return;
    try {
      await copyShareUrl(publicLink, type);
      toast.success('Link copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const formatExpiration = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const date = new Date(expiresAt);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return 'Expired';
    if (diff < 86400000) return 'Expires today';
    if (diff < 604800000) return `Expires in ${Math.ceil(diff / 86400000)} days`;
    return `Expires ${date.toLocaleDateString()}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <i className="fa fa-share-alt text-rose-500"></i>
                Share {type === 'document' ? 'Document' : 'Project'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">
                {resourceTitle}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <i className="fa fa-times"></i>
            </button>
          </div>
        </div>

        {/* Share Form */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          {/* Email input */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleShare()}
                placeholder="Enter email address..."
                className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg focus:border-rose-500 focus:outline-none text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
            <button
              onClick={handleShare}
              className="px-4 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            >
              <i className="fa fa-paper-plane"></i>
              Share
            </button>
          </div>

          {/* Permission selector */}
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(PERMISSION_PRESETS) as PermissionPreset[]).map((preset) => {
              const config = PERMISSION_PRESETS[preset];
              return (
                <button
                  key={preset}
                  onClick={() => setSelectedPreset(preset)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                    selectedPreset === preset
                      ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <i className={`fa ${config.icon}`}></i>
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* Advanced options toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="mt-3 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
          >
            <i className={`fa fa-chevron-${showAdvanced ? 'up' : 'down'} text-[10px]`}></i>
            Advanced options
          </button>

          {/* Advanced options */}
          {showAdvanced && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-3">
              {/* Expiration */}
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  Access expires
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'never', label: 'Never' },
                    { value: '1d', label: '1 day' },
                    { value: '7d', label: '7 days' },
                    { value: '30d', label: '30 days' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setExpiresIn(opt.value)}
                      className={`px-3 py-1 rounded text-xs transition-all ${
                        expiresIn === opt.value
                          ? 'bg-rose-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  Add a message (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hey, I thought you'd find this useful..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:border-rose-500 focus:outline-none text-gray-900 dark:text-white resize-none"
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>

        {/* Public Link Section */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="fa fa-link text-gray-400"></i>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Public link
              </span>
            </div>

            {publicLink ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <i className="fa fa-check-circle"></i>
                  Active
                </span>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-xs transition-colors flex items-center gap-1"
                >
                  <i className="fa fa-copy"></i>
                  Copy link
                </button>
              </div>
            ) : (
              <button
                onClick={handleCreatePublicLink}
                disabled={isCreatingLink}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-xs transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                {isCreatingLink ? (
                  <i className="fa fa-spinner fa-spin"></i>
                ) : (
                  <i className="fa fa-plus"></i>
                )}
                Create link
              </button>
            )}
          </div>

          {publicLink && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={`${window.location.origin}/share/${type}/${publicLink}`}
                readOnly
                className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-gray-500 dark:text-gray-400"
              />
            </div>
          )}

          <p className="text-[10px] text-gray-400 mt-2">
            <i className="fa fa-info-circle mr-1"></i>
            Anyone with the link can view this {type}
          </p>
        </div>

        {/* Existing Shares */}
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center">
              <i className="fa fa-spinner fa-spin text-gray-400"></i>
            </div>
          ) : shares.filter(s => !s.public_link).length === 0 ? (
            <div className="p-6 text-center">
              <i className="fa fa-users text-2xl text-gray-300 dark:text-gray-600 mb-2"></i>
              <p className="text-sm text-gray-400">Not shared with anyone yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {shares.filter(s => !s.public_link).map((share) => {
                const email = share.shared_with_email || share.shared_with_user || '';
                const expiration = formatExpiration(share.expires_at);

                return (
                  <div
                    key={share.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-pink-400 flex items-center justify-center text-white text-sm font-medium">
                      {email.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        {email}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="capitalize">
                          {share.permissions.canEdit ? 'Editor' :
                           share.permissions.canComment ? 'Commenter' : 'Viewer'}
                        </span>
                        {expiration && (
                          <span className={expiration === 'Expired' ? 'text-red-400' : ''}>
                            • {expiration}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveShare(share.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Remove access"
                    >
                      <i className="fa fa-user-minus text-xs"></i>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
          <p className="text-[10px] text-gray-400">
            <i className="fa fa-shield-halved mr-1"></i>
            Only people you share with can access
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
