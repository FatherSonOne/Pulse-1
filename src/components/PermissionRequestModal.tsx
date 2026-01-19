// Permission Request Modal - Shows on first app launch to request all permissions
// Only shows permissions that haven't been handled yet (not already granted/denied)
import React, { useState, useEffect, useMemo } from 'react';
import { usePermissions, PermissionName } from '../hooks/usePermissions';

interface PermissionRequestModalProps {
  onComplete: () => void;
  onSkip?: () => void;
}

interface PermissionItem {
  name: PermissionName;
  icon: string;
  title: string;
  description: string;
  required: boolean;
}

// All available permissions with their metadata
const ALL_PERMISSIONS: PermissionItem[] = [
  {
    name: 'microphone',
    icon: 'fa-microphone',
    title: 'Microphone',
    description: 'Required for Vox voice messaging, voice commands, and voice notes.',
    required: true,
  },
  {
    name: 'camera',
    icon: 'fa-video',
    title: 'Camera',
    description: 'Used for video calls in Pulse Meetings and video messages.',
    required: false,
  },
  {
    name: 'notifications',
    icon: 'fa-bell',
    title: 'Notifications',
    description: 'Get notified about new messages, reminders, and important updates.',
    required: true,
  },
  {
    name: 'contacts',
    icon: 'fa-address-book',
    title: 'Contacts',
    description: 'Find friends on Pulse and sync your address book.',
    required: false,
  },
];

const PermissionRequestModal: React.FC<PermissionRequestModalProps> = ({ onComplete, onSkip }) => {
  const {
    permissions,
    isRequesting,
    requestPermission,
    completedPermissions,
    markSetupComplete,
    isNativePlatform,
  } = usePermissions();

  const [currentStep, setCurrentStep] = useState(0);
  const [requestedInSession, setRequestedInSession] = useState<Set<PermissionName>>(new Set());

  // Filter to only show permissions that need to be requested
  // (not already completed/handled in a previous session)
  const permissionsToShow = useMemo(() => {
    return ALL_PERMISSIONS.filter(perm => {
      // If already completed in a previous session, skip it
      if (completedPermissions.has(perm.name)) {
        console.log(`[PermissionModal] Skipping ${perm.name} - already completed`);
        return false;
      }
      return true;
    });
  }, [completedPermissions]);

  // Get current permission to request
  const currentPermission = permissionsToShow[currentStep];

  // Check if all permissions have been handled
  const allComplete = currentStep >= permissionsToShow.length;

  // Get status for a permission
  const getStatus = (name: PermissionName): 'granted' | 'denied' | 'pending' => {
    if (permissions[name]?.granted) return 'granted';
    if (permissions[name]?.denied) return 'denied';
    return 'pending';
  };

  // Handle requesting current permission
  const handleRequestPermission = async () => {
    if (!currentPermission) return;

    setRequestedInSession(prev => new Set([...prev, currentPermission.name]));
    await requestPermission(currentPermission.name);

    // Move to next permission
    setCurrentStep(prev => prev + 1);
  };

  // Skip current permission (still marks it as completed so we don't ask again)
  const handleSkip = async () => {
    if (!currentPermission) return;
    
    setRequestedInSession(prev => new Set([...prev, currentPermission.name]));
    // Still call requestPermission to mark it as completed, even if user skips
    // This prevents the modal from showing again for this permission
    await requestPermission(currentPermission.name);
    setCurrentStep(prev => prev + 1);
  };

  // Complete the flow
  useEffect(() => {
    if (allComplete) {
      // Mark setup as complete so modal doesn't show again
      markSetupComplete().then(() => {
        console.log('[PermissionModal] Setup complete, closing modal');
        // Small delay before closing for better UX
        setTimeout(onComplete, 500);
      });
    }
  }, [allComplete, onComplete, markSetupComplete]);

  // If no permissions need to be shown, complete immediately
  useEffect(() => {
    if (permissionsToShow.length === 0) {
      console.log('[PermissionModal] No permissions to show, completing immediately');
      markSetupComplete().then(onComplete);
    }
  }, [permissionsToShow.length, markSetupComplete, onComplete]);

  // If no permissions to show, don't render anything (useEffect will handle completion)
  if (permissionsToShow.length === 0) {
    return null;
  }

  if (allComplete) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-8 text-center animate-scale-in">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-check text-4xl text-emerald-500"></i>
          </div>
          <h2 className="text-2xl font-bold dark:text-white mb-3">You're All Set!</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6">
            Pulse is ready to use. You can always change permissions in Settings.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            {ALL_PERMISSIONS.map(perm => (
              <div
                key={perm.name}
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm ${
                  permissions[perm.name]?.granted
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                }`}
              >
                <i className={`fa-solid ${perm.icon} text-xs`}></i>
                <span>{perm.title}</span>
                {permissions[perm.name]?.granted && (
                  <i className="fa-solid fa-check text-xs"></i>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full overflow-hidden animate-scale-in shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-500 to-cyan-500 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Set Up Pulse</h2>
            <span className="text-sm opacity-80">{currentStep + 1} of {permissionsToShow.length}</span>
          </div>
          <p className="text-sm opacity-90">
            We need a few permissions to give you the best experience.
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-zinc-200 dark:bg-zinc-700">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${((currentStep) / permissionsToShow.length) * 100}%` }}
          />
        </div>

        {/* Current Permission */}
        {currentPermission && (
          <div className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className={`fa-solid ${currentPermission.icon} text-2xl text-emerald-600 dark:text-emerald-400`}></i>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold dark:text-white">{currentPermission.title}</h3>
                  {currentPermission.required && (
                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase rounded">
                      Required
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {currentPermission.description}
                </p>
              </div>
            </div>

            {/* Status indicators for already requested */}
            <div className="flex flex-wrap gap-2 mb-6">
              {permissionsToShow.slice(0, currentStep).map(perm => (
                <div
                  key={perm.name}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                    permissions[perm.name]?.granted
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                  }`}
                >
                  <i className={`fa-solid ${perm.icon}`}></i>
                  {permissions[perm.name]?.granted ? (
                    <i className="fa-solid fa-check"></i>
                  ) : (
                    <i className="fa-solid fa-minus"></i>
                  )}
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              {!currentPermission.required && (
                <button
                  onClick={handleSkip}
                  disabled={isRequesting}
                  className="flex-1 py-3 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition disabled:opacity-50"
                >
                  Skip
                </button>
              )}
              <button
                onClick={handleRequestPermission}
                disabled={isRequesting}
                className={`flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition disabled:opacity-50 flex items-center justify-center gap-2 ${
                  currentPermission.required ? 'w-full' : ''
                }`}
              >
                {isRequesting ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    Requesting...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-shield-check"></i>
                    Allow {currentPermission.title}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Skip all */}
        {onSkip && currentStep === 0 && (
          <div className="px-6 pb-4">
            <button
              onClick={onSkip}
              className="w-full text-center text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Skip for now (you can set these later in Settings)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionRequestModal;
