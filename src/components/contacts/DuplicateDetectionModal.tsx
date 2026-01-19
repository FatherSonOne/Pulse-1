// ============================================
// DUPLICATE DETECTION MODAL COMPONENT
// Interface for reviewing and merging duplicate contacts
// ============================================

import React, { useState } from 'react';
import {
  DuplicateGroup,
  DuplicateContact,
  RelationshipProfile,
  getRelationshipHealthColor,
} from '../../types/relationshipTypes';

interface DuplicateDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: DuplicateGroup[];
  onMerge: (primaryId: string, duplicateIds: string[]) => Promise<boolean>;
  onDismiss: (groupId: string) => void;
  isLoading?: boolean;
}

export const DuplicateDetectionModal: React.FC<DuplicateDetectionModalProps> = ({
  isOpen,
  onClose,
  duplicates,
  onMerge,
  onDismiss,
  isLoading = false,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  if (!isOpen) return null;

  const handleSelectGroup = (group: DuplicateGroup) => {
    setSelectedGroup(group);
    setSelectedPrimary(group.suggestedPrimary || group.profiles[0]?.profileId || null);
  };

  const handleMerge = async () => {
    if (!selectedGroup || !selectedPrimary) return;

    const duplicateIds = selectedGroup.profiles
      .filter(p => p.profileId !== selectedPrimary)
      .map(p => p.profileId);

    setMerging(true);
    try {
      const success = await onMerge(selectedPrimary, duplicateIds);
      if (success) {
        setSelectedGroup(null);
        setSelectedPrimary(null);
      }
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                Duplicate Contacts
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {duplicates.length} potential duplicate{duplicates.length !== 1 ? ' groups' : ''} found
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Groups List */}
          <div className="w-1/2 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto">
            {duplicates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-6">
                <i className="fa-solid fa-check-circle text-4xl mb-3 text-green-500"></i>
                <p className="text-sm font-medium">No duplicates found</p>
                <p className="text-xs mt-1">Your contacts are clean!</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {duplicates.map((group) => (
                  <DuplicateGroupCard
                    key={group.groupId}
                    group={group}
                    isSelected={selectedGroup?.groupId === group.groupId}
                    onClick={() => handleSelectGroup(group)}
                    onDismiss={() => onDismiss(group.groupId)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Detail View */}
          <div className="w-1/2 overflow-y-auto">
            {selectedGroup ? (
              <div className="p-4">
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
                  Select Primary Contact
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  Choose which contact to keep. Others will be merged into it.
                </p>

                <div className="space-y-2 mb-6">
                  {selectedGroup.profiles.map((dup) => (
                    <DuplicateProfileCard
                      key={dup.profileId}
                      duplicate={dup}
                      isSelected={selectedPrimary === dup.profileId}
                      onClick={() => setSelectedPrimary(dup.profileId)}
                    />
                  ))}
                </div>

                {/* Merge info */}
                {selectedPrimary && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg mb-4">
                    <h4 className="font-medium text-purple-900 dark:text-purple-300 mb-2">
                      What will happen:
                    </h4>
                    <ul className="text-sm text-purple-700 dark:text-purple-400 space-y-1">
                      <li className="flex items-start gap-2">
                        <i className="fa-solid fa-check text-xs mt-1"></i>
                        <span>All interactions will be combined</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="fa-solid fa-check text-xs mt-1"></i>
                        <span>Tags and notes will be merged</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="fa-solid fa-check text-xs mt-1"></i>
                        <span>VIP/Favorite status preserved</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="fa-solid fa-check text-xs mt-1"></i>
                        <span>Duplicate emails will be linked</span>
                      </li>
                    </ul>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleMerge}
                    disabled={!selectedPrimary || merging}
                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
                  >
                    {merging ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Merging...
                      </span>
                    ) : (
                      <>
                        <i className="fa-solid fa-code-merge mr-2"></i>
                        Merge Contacts
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => onDismiss(selectedGroup.groupId)}
                    className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium transition"
                  >
                    Not a duplicate
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-6">
                <i className="fa-solid fa-users text-3xl mb-3"></i>
                <p className="text-sm">Select a group to review</p>
              </div>
            )}
          </div>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/80 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>
    </div>
  );
};

// Duplicate group card
interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  isSelected: boolean;
  onClick: () => void;
  onDismiss: () => void;
}

const DuplicateGroupCard: React.FC<DuplicateGroupCardProps> = ({
  group,
  isSelected,
  onClick,
  onDismiss,
}) => {
  const emails = group.profiles.map(p => p.profile?.contactEmail || 'Unknown');

  return (
    <div
      className={`p-4 rounded-xl border cursor-pointer transition ${
        isSelected
          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10'
          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {group.profiles.slice(0, 3).map((dup, idx) => (
              <div
                key={idx}
                className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-300"
              >
                {(dup.profile?.contactName?.[0] || dup.profile?.contactEmail[0] || '?').toUpperCase()}
              </div>
            ))}
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-900 dark:text-white">
              {group.profiles[0]?.profile?.contactName || emails[0]}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {group.profiles.length} contacts · {Math.round(group.avgConfidence * 100)}% match
            </div>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
          title="Not a duplicate"
        >
          <i className="fa-solid fa-xmark text-xs"></i>
        </button>
      </div>

      {/* Match reasons */}
      <div className="flex flex-wrap gap-1 mt-3">
        {[...new Set(group.profiles.flatMap(p => p.matchReasons))].slice(0, 3).map((reason, idx) => (
          <span
            key={idx}
            className="text-[10px] px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full"
          >
            {formatMatchReason(reason)}
          </span>
        ))}
      </div>
    </div>
  );
};

// Duplicate profile card
interface DuplicateProfileCardProps {
  duplicate: DuplicateContact;
  isSelected: boolean;
  onClick: () => void;
}

const DuplicateProfileCard: React.FC<DuplicateProfileCardProps> = ({
  duplicate,
  isSelected,
  onClick,
}) => {
  const profile = duplicate.profile;

  return (
    <div
      className={`p-4 rounded-xl border cursor-pointer transition ${
        isSelected
          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10'
          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{
              backgroundColor: profile?.relationshipScore
                ? getRelationshipHealthColor(profile.relationshipScore)
                : '#9ca3af'
            }}
          >
            {(profile?.contactName?.[0] || profile?.contactEmail[0] || '?').toUpperCase()}
          </div>
          {isSelected && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-check text-white text-[10px]"></i>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-zinc-900 dark:text-white truncate">
            {profile?.contactName || 'Unknown'}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {profile?.contactEmail}
          </div>
        </div>

        <div className="text-right text-xs text-zinc-500">
          <div>{Math.round(duplicate.matchConfidence * 100)}% match</div>
          {profile?.totalEmailsSent !== undefined && (
            <div className="text-zinc-400">
              {(profile.totalEmailsSent || 0) + (profile.totalEmailsReceived || 0)} emails
            </div>
          )}
        </div>
      </div>

      {/* Contact details */}
      {(profile?.company || profile?.phone) && (
        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          {profile?.company && (
            <span>
              <i className="fa-solid fa-building mr-1"></i>
              {profile.company}
            </span>
          )}
          {profile?.phone && (
            <span>
              <i className="fa-solid fa-phone mr-1"></i>
              {profile.phone}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// Helper function
function formatMatchReason(reason: string): string {
  return reason
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

export default DuplicateDetectionModal;
