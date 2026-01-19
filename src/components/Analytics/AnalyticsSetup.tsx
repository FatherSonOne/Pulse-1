/**
 * Analytics Setup Component
 * One-time setup wizard to backfill analytics data
 */

import React, { useState } from 'react';
import { useAnalyticsTracking } from '../../hooks/useAnalyticsTracking';

interface AnalyticsSetupProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const AnalyticsSetup: React.FC<AnalyticsSetupProps> = ({ onComplete, onSkip }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [daysBack, setDaysBack] = useState(90);
  const { backfillAnalytics } = useAnalyticsTracking();

  const handleBackfill = async () => {
    setIsProcessing(true);
    setProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      await backfillAnalytics(daysBack);

      clearInterval(progressInterval);
      setProgress(100);

      setTimeout(() => {
        onComplete();
      }, 1000);
    } catch (error) {
      console.error('Error during backfill:', error);
      alert('Failed to backfill analytics. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 max-w-lg w-full rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-chart-line text-white text-2xl"></i>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            Setup Analytics
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Let's analyze your communication history to provide insights
          </p>
        </div>

        {!isProcessing ? (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Analyze messages from the last:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[30, 60, 90, 180].map(days => (
                  <button
                    key={days}
                    onClick={() => setDaysBack(days)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      daysBack === days
                        ? 'bg-rose-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <i className="fa-solid fa-info-circle text-blue-600 dark:text-blue-400 mt-0.5"></i>
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <p className="font-medium mb-1">What we'll analyze:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                    <li>Message volume and patterns</li>
                    <li>Response times</li>
                    <li>Contact engagement scores</li>
                    <li>Communication sentiment</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onSkip}
                className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                Skip for now
              </button>
              <button
                onClick={handleBackfill}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-pink-600 text-white font-medium hover:from-rose-600 hover:to-pink-700 transition"
              >
                Start Analysis
              </button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="mb-4">
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-pink-600 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                {progress < 100 ? 'Analyzing your messages...' : 'Complete!'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-zinc-500 dark:text-zinc-400">
              <div className="animate-spin">
                <i className="fa-solid fa-spinner"></i>
              </div>
              <span className="text-sm">{progress}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
