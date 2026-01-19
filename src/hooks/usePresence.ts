// usePresence Hook
// React hook for managing user presence and online status

import { useState, useEffect, useCallback } from 'react';
import { userContactService } from '../services/userContactService';
import type { OnlineStatus, LastActiveStatus } from '../types/userContact';

/**
 * Hook to manage current user's presence
 */
export function usePresence() {
  const [isOnline, setIsOnline] = useState(true);
  const [status, setStatus] = useState<OnlineStatus>('online');
  
  useEffect(() => {
    // Start presence heartbeat
    const cleanup = userContactService.startPresenceHeartbeat(60000); // 1 minute
    
    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        userContactService.updatePresence('away');
        setStatus('away');
      } else {
        userContactService.updatePresence('online');
        setStatus('online');
      }
    };
    
    // Handle before unload
    const handleBeforeUnload = () => {
      userContactService.updatePresence('offline');
    };
    
    // Handle online/offline
    const handleOnline = () => {
      setIsOnline(true);
      userContactService.updatePresence('online');
      setStatus('online');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setStatus('offline');
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      cleanup();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const updateStatus = useCallback(async (newStatus: OnlineStatus) => {
    setStatus(newStatus);
    await userContactService.updatePresence(newStatus);
  }, []);
  
  return {
    isOnline,
    status,
    updateStatus
  };
}

/**
 * Hook to track another user's presence
 */
export function useUserPresence(userId: string | null | undefined) {
  const [presence, setPresence] = useState<{
    status: OnlineStatus;
    lastActiveAt: Date;
  } | null>(null);
  const [lastActive, setLastActive] = useState<LastActiveStatus>({
    status: 'unknown',
    text: 'Unknown'
  });
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    let mounted = true;
    
    // Fetch initial presence
    const fetchPresence = async () => {
      try {
        const [presenceData, lastActiveData] = await Promise.all([
          userContactService.getPresence(userId),
          userContactService.getLastActiveStatus(userId)
        ]);
        
        if (mounted) {
          setPresence(presenceData);
          setLastActive(lastActiveData);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching user presence:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    fetchPresence();
    
    // Subscribe to presence changes
    const unsubscribe = userContactService.subscribeToPresence(userId, (newPresence) => {
      if (mounted) {
        setPresence(newPresence);
        // Update last active text
        userContactService.getLastActiveStatus(userId).then(status => {
          if (mounted) {
            setLastActive(status);
          }
        });
      }
    });
    
    // Refresh last active every minute
    const intervalId = setInterval(() => {
      if (mounted && presence && presence.status !== 'online') {
        userContactService.getLastActiveStatus(userId).then(status => {
          if (mounted) {
            setLastActive(status);
          }
        });
      }
    }, 60000);
    
    return () => {
      mounted = false;
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [userId]);
  
  return {
    presence,
    lastActive,
    loading,
    isOnline: presence?.status === 'online'
  };
}

/**
 * Hook to get online users count
 */
export function useOnlineUsersCount() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    // Fetch initial count
    userContactService.getOnlineUsersCount().then(setCount);
    
    // Refresh every 30 seconds
    const intervalId = setInterval(() => {
      userContactService.getOnlineUsersCount().then(setCount);
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  return count;
}
