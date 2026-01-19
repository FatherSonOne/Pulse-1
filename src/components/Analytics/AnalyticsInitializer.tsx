/**
 * Analytics Initializer
 * Shows setup wizard on first visit, then tracks messages automatically
 */

import React, { useState, useEffect } from 'react';
import { AnalyticsSetup } from './AnalyticsSetup';

export const AnalyticsInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showSetup, setShowSetup] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check if analytics has been set up
    const analyticsSetup = localStorage.getItem('analytics_setup_complete');
    
    if (!analyticsSetup) {
      // Show setup wizard after a short delay
      setTimeout(() => {
        setShowSetup(true);
        setIsChecking(false);
      }, 2000);
    } else {
      setIsChecking(false);
    }
  }, []);

  const handleSetupComplete = () => {
    localStorage.setItem('analytics_setup_complete', 'true');
    setShowSetup(false);
  };

  const handleSetupSkip = () => {
    localStorage.setItem('analytics_setup_complete', 'skipped');
    setShowSetup(false);
  };

  if (isChecking) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {showSetup && (
        <AnalyticsSetup
          onComplete={handleSetupComplete}
          onSkip={handleSetupSkip}
        />
      )}
    </>
  );
};
