// UserContactCard Component
// Displays contact details for a Pulse user with ability to add private notes

import React, { useState, useEffect } from 'react';
import { userContactService } from '../../services/userContactService';
import { useUserPresence } from '../../hooks/usePresence';
import type { EnrichedUserProfile } from '../../types/userContact';
import './UserContactCard.css';

interface UserContactCardProps {
  userId: string;
  onClose: () => void;
}

export const UserContactCard: React.FC<UserContactCardProps> = ({ userId, onClose }) => {
  const [profile, setProfile] = useState<EnrichedUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Editing state
  const [nickname, setNickname] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [customCompany, setCustomCompany] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);

  const { presence, lastActive, isOnline } = useUserPresence(userId);

  const MAX_RETRIES = 3;

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async (isRetry = false) => {
    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.error('[UserContactCard] Invalid userId provided:', userId);
      setError('Invalid user ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await userContactService.getEnrichedProfile(userId);

      if (data) {
        setProfile(data);
        setRetryCount(0);

        if (data.annotation) {
          setNickname(data.annotation.nickname || '');
          setCustomNotes(data.annotation.customNotes || '');
          setCustomPhone(data.annotation.customPhone || '');
          setCustomEmail(data.annotation.customEmail || '');
          setCustomCompany(data.annotation.customCompany || '');
          setCustomRole(data.annotation.customRole || '');
          setIsFavorite(data.annotation.isFavorite);
        }
      } else {
        // Profile not found - try automatic retry with exponential backoff
        if (isRetry && retryCount < MAX_RETRIES) {
          const delay = Math.pow(2, retryCount) * 500; // 500ms, 1s, 2s
          console.log(`[UserContactCard] Retry ${retryCount + 1}/${MAX_RETRIES} in ${delay}ms`);
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            loadProfile(true);
          }, delay);
        } else {
          setError('Profile not found');
          setProfile(null);
        }
      }
    } catch (err) {
      console.error('[UserContactCard] Error loading profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(0);
    loadProfile(true);
  };
  
  const handleSave = async () => {
    if (!profile) return;
    
    try {
      setSaving(true);
      await userContactService.updateAnnotation({
        targetUserId: userId,
        nickname: nickname || undefined,
        customNotes: customNotes || undefined,
        customPhone: customPhone || undefined,
        customEmail: customEmail || undefined,
        customCompany: customCompany || undefined,
        customRole: customRole || undefined,
        isFavorite
      });
      
      await loadProfile();
      setEditing(false);
    } catch (error) {
      console.error('Error saving annotation:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const toggleFavorite = async () => {
    if (!profile) return;
    
    try {
      const newFavorite = !isFavorite;
      setIsFavorite(newFavorite);
      
      await userContactService.updateAnnotation({
        targetUserId: userId,
        isFavorite: newFavorite
      });
      
      await loadProfile();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      setIsFavorite(!isFavorite);
    }
  };
  
  if (loading) {
    return (
      <div className="user-contact-card-overlay" onClick={onClose}>
        <div className="user-contact-card" onClick={(e) => e.stopPropagation()}>
          <div className="card-loading">
            <div className="spinner"></div>
            <p>Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (!profile || error) {
    return (
      <div className="user-contact-card-overlay" onClick={onClose}>
        <div className="user-contact-card" onClick={(e) => e.stopPropagation()}>
          <div className="card-error">
            <i className="fa-solid fa-exclamation-circle"></i>
            <p>{error || 'Profile not found'}</p>
            <p className="text-sm text-zinc-500 mt-2">
              Unable to load profile for user ID: {userId?.substring(0, 8)}...
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {retryCount > 0
                ? `Attempted ${retryCount} retries. The user may not exist or there may be a connectivity issue.`
                : 'This may indicate the user hasn\'t completed their profile setup, or there may be a database connectivity issue.'
              }
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleRetry}
                className="btn-primary text-sm"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin mr-1"></i>
                    Retrying...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-refresh mr-1"></i>
                    Retry
                  </>
                )}
              </button>
              <button onClick={onClose} className="btn-secondary text-sm">Close</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  const displayName = profile.annotation?.nickname || profile.displayName || profile.fullName || profile.handle || 'Unknown User';
  const showingNickname = profile.annotation?.nickname && profile.annotation.nickname !== profile.displayName;
  
  return (
    <div className="user-contact-card-overlay" onClick={onClose}>
      <div className="user-contact-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="card-header">
          <h3>Contact Details</h3>
          <div className="card-header-actions">
            <button
              onClick={toggleFavorite}
              className={`btn-icon ${isFavorite ? 'favorite-active' : ''}`}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <i className={`fa-${isFavorite ? 'solid' : 'regular'} fa-star`}></i>
            </button>
            <button onClick={onClose} className="btn-icon">
              <i className="fa-solid fa-times"></i>
            </button>
          </div>
        </div>
        
        {/* Profile Section */}
        <div className="card-profile">
          <div className="profile-avatar-section">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={displayName} className="profile-avatar" />
            ) : (
              <div className="profile-avatar-placeholder">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className={`presence-indicator ${isOnline ? 'online' : 'offline'}`}></div>
          </div>
          
          <div className="profile-info">
            <h2 className="profile-name">{displayName}</h2>
            {showingNickname && (
              <p className="profile-real-name">
                {profile.displayName || profile.fullName}
              </p>
            )}
            {profile.handle && (
              <p className="profile-handle">@{profile.handle}</p>
            )}
            {profile.isVerified && (
              <span className="verified-badge">
                <i className="fa-solid fa-circle-check"></i> Verified
              </span>
            )}
          </div>
          
          <div className="profile-status">
            {isOnline ? (
              <span className="status-online">
                <i className="fa-solid fa-circle"></i> Active now
              </span>
            ) : (
              <span className="status-offline">
                <i className="fa-regular fa-circle"></i> {lastActive.text}
              </span>
            )}
          </div>
        </div>
        
        {/* Bio */}
        {profile.bio && (
          <div className="card-section">
            <div className="section-label">About</div>
            <p className="profile-bio">{profile.bio}</p>
          </div>
        )}
        
        {/* Public Information */}
        <div className="card-section">
          <div className="section-header">
            <div className="section-label">Public Information</div>
          </div>
          
          <div className="info-grid">
            {profile.email && (
              <div className="info-item">
                <i className="fa-solid fa-envelope"></i>
                <div className="info-content">
                  <span className="info-label">Email</span>
                  <a href={`mailto:${profile.email}`} className="info-value">
                    {profile.email}
                  </a>
                </div>
              </div>
            )}
            
            {profile.phone && (
              <div className="info-item">
                <i className="fa-solid fa-phone"></i>
                <div className="info-content">
                  <span className="info-label">Phone</span>
                  <a href={`tel:${profile.phone}`} className="info-value">
                    {profile.phone}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Private Notes Section */}
        <div className="card-section private-section">
          <div className="section-header">
            <div className="section-label">
              <i className="fa-solid fa-lock"></i>
              My Private Notes
              <span className="private-badge">Only visible to you</span>
            </div>
            {!editing && (
              <button onClick={() => setEditing(true)} className="btn-edit">
                <i className="fa-solid fa-pencil"></i>
                Edit
              </button>
            )}
          </div>
          
          {editing ? (
            <div className="edit-form">
              <div className="form-group">
                <label>Nickname</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g., Babe, Boss, Best Friend"
                  className="form-input"
                />
                <small className="form-hint">How you want to call them in your contacts</small>
              </div>
              
              <div className="form-group">
                <label>Personal Notes</label>
                <textarea
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Add your private notes about this contact..."
                  className="form-textarea"
                  rows={3}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Additional Phone</label>
                  <input
                    type="tel"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    placeholder="Additional phone number"
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label>Additional Email</label>
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="Additional email"
                    className="form-input"
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Company</label>
                  <input
                    type="text"
                    value={customCompany}
                    onChange={(e) => setCustomCompany(e.target.value)}
                    placeholder="Their company"
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label>Role/Position</label>
                  <input
                    type="text"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder="Their role"
                    className="form-input"
                  />
                </div>
              </div>
              
              <div className="form-actions">
                <button
                  onClick={() => {
                    setEditing(false);
                    // Reset to saved values
                    if (profile?.annotation) {
                      setNickname(profile.annotation.nickname || '');
                      setCustomNotes(profile.annotation.customNotes || '');
                      setCustomPhone(profile.annotation.customPhone || '');
                      setCustomEmail(profile.annotation.customEmail || '');
                      setCustomCompany(profile.annotation.customCompany || '');
                      setCustomRole(profile.annotation.customRole || '');
                    }
                  }}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check"></i>
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="info-grid">
              {nickname && (
                <div className="info-item">
                  <i className="fa-solid fa-user-tag"></i>
                  <div className="info-content">
                    <span className="info-label">Nickname</span>
                    <span className="info-value">{nickname}</span>
                  </div>
                </div>
              )}
              
              {customNotes && (
                <div className="info-item">
                  <i className="fa-solid fa-note-sticky"></i>
                  <div className="info-content">
                    <span className="info-label">Notes</span>
                    <span className="info-value">{customNotes}</span>
                  </div>
                </div>
              )}
              
              {customPhone && (
                <div className="info-item">
                  <i className="fa-solid fa-phone"></i>
                  <div className="info-content">
                    <span className="info-label">Additional Phone</span>
                    <a href={`tel:${customPhone}`} className="info-value">{customPhone}</a>
                  </div>
                </div>
              )}
              
              {customEmail && (
                <div className="info-item">
                  <i className="fa-solid fa-envelope"></i>
                  <div className="info-content">
                    <span className="info-label">Additional Email</span>
                    <a href={`mailto:${customEmail}`} className="info-value">{customEmail}</a>
                  </div>
                </div>
              )}
              
              {customCompany && (
                <div className="info-item">
                  <i className="fa-solid fa-building"></i>
                  <div className="info-content">
                    <span className="info-label">Company</span>
                    <span className="info-value">{customCompany}</span>
                  </div>
                </div>
              )}
              
              {customRole && (
                <div className="info-item">
                  <i className="fa-solid fa-briefcase"></i>
                  <div className="info-content">
                    <span className="info-label">Role</span>
                    <span className="info-value">{customRole}</span>
                  </div>
                </div>
              )}
              
              {!nickname && !customNotes && !customPhone && !customEmail && !customCompany && !customRole && (
                <div className="empty-state">
                  <i className="fa-regular fa-note-sticky"></i>
                  <p>No private notes yet</p>
                  <small>Click Edit to add your personal notes about this contact</small>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="card-actions">
          <button className="btn-action" onClick={onClose}>
            <i className="fa-solid fa-comment"></i>
            Send Message
          </button>
        </div>
      </div>
    </div>
  );
};
