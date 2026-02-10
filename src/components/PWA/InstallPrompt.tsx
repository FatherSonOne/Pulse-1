import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * InstallPrompt Component
 * Shows a custom install prompt with platform-specific instructions
 * Appears at the bottom of the screen with smooth animation
 */
export function InstallPrompt() {
  const {
    showPrompt,
    isIOSSafari,
    promptInstall,
    dismissPrompt,
    getInstructions
  } = useInstallPrompt();

  if (!showPrompt) {
    return null;
  }

  const handleInstall = async () => {
    if (isIOSSafari) {
      // For iOS Safari, we can't trigger install programmatically
      // Just show instructions in the prompt
      return;
    }

    const success = await promptInstall();
    if (success) {
      console.log('[PWA] App installation initiated');
    }
  };

  const instructions = getInstructions();

  return (
    <AnimatePresence>
      {showPrompt && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismissPrompt}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
          />

          {/* Install Prompt Card */}
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[9999] max-md:rounded-t-3xl md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:max-w-md md:rounded-2xl"
          >
            <div className="bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-md:rounded-t-3xl md:rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="relative bg-gradient-to-br from-emerald-500 to-cyan-500 p-6 text-white">
                {/* Close button */}
                <button
                  onClick={dismissPrompt}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition"
                  aria-label="Dismiss"
                >
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>

                <div className="flex items-center gap-4">
                  {/* App Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <i className="fa-solid fa-bolt text-3xl"></i>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold">Install Pulse</h3>
                    <p className="text-sm opacity-90 mt-1">
                      Get the full app experience
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {isIOSSafari ? (
                  // iOS Safari - Show manual instructions
                  <div className="space-y-4">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      To install Pulse on your iPhone or iPad:
                    </p>

                    <div className="space-y-3">
                      {instructions.map((instruction, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            {index + 1}
                          </div>
                          <p className="text-sm text-zinc-700 dark:text-zinc-300 pt-0.5">
                            {instruction}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Share icon hint */}
                    <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                        <i className="fa-solid fa-arrow-up-from-bracket text-lg"></i>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        Look for the Share icon in Safari's toolbar
                      </p>
                    </div>
                  </div>
                ) : (
                  // Chrome/Edge - Show install button
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <i className="fa-solid fa-check-circle"></i>
                        <span className="text-sm font-medium">Works offline</span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <i className="fa-solid fa-check-circle"></i>
                        <span className="text-sm font-medium">Fast & reliable</span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <i className="fa-solid fa-check-circle"></i>
                        <span className="text-sm font-medium">App-like experience</span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <i className="fa-solid fa-check-circle"></i>
                        <span className="text-sm font-medium">Push notifications</span>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={handleInstall}
                        className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold py-3 px-4 rounded-xl hover:from-emerald-600 hover:to-cyan-600 transition shadow-lg shadow-emerald-500/30"
                      >
                        Install Now
                      </button>
                      <button
                        onClick={dismissPrompt}
                        className="px-4 py-3 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      >
                        Maybe Later
                      </button>
                    </div>

                    <p className="text-xs text-zinc-500 dark:text-zinc-500 text-center">
                      You can always install later from the browser menu
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
