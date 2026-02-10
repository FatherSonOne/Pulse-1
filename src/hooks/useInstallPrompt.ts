import { useState, useEffect } from 'react';
import { pwaService } from '../services/pwaService';

/**
 * useInstallPrompt Hook
 * Manages PWA install prompt state and logic
 */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(pwaService.isInstalled());
  const [isIOSSafari, setIsIOSSafari] = useState(pwaService.isIOSSafari());

  useEffect(() => {
    // Check if we can show the install prompt
    const checkInstallability = () => {
      const canShow = pwaService.canInstall();
      const shouldShow = pwaService.shouldShowInstallPrompt();

      setCanInstall(canShow);
      setIsInstalled(pwaService.isInstalled());
      setIsIOSSafari(pwaService.isIOSSafari());

      // Show prompt if conditions are met
      if ((canShow || isIOSSafari) && shouldShow && !isInstalled) {
        // Delay showing prompt by 2 seconds for better UX
        setTimeout(() => {
          setShowPrompt(true);
        }, 2000);
      }
    };

    // Initial check
    checkInstallability();

    // Listen for beforeinstallprompt event
    const handleBeforeInstall = () => {
      checkInstallability();
    };

    // Listen for appinstalled event
    const handleInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [isInstalled, isIOSSafari]);

  /**
   * Trigger the install prompt
   */
  const promptInstall = async (): Promise<boolean> => {
    const outcome = await pwaService.showInstallPrompt();

    if (outcome === 'accepted') {
      setShowPrompt(false);
      setCanInstall(false);
      return true;
    }

    if (outcome === 'dismissed') {
      setShowPrompt(false);
    }

    return false;
  };

  /**
   * Dismiss the install prompt
   */
  const dismissPrompt = () => {
    pwaService.markPromptDismissed();
    setShowPrompt(false);
  };

  /**
   * Get platform-specific install instructions
   */
  const getInstructions = (): string[] => {
    return pwaService.getInstallInstructions();
  };

  return {
    canInstall,
    showPrompt,
    isInstalled,
    isIOSSafari,
    promptInstall,
    dismissPrompt,
    getInstructions
  };
}
