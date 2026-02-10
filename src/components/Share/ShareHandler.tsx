import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * ShareHandler Component
 * Handles incoming shared content from other apps via Web Share Target API
 */
export function ShareHandler() {
  const navigate = useNavigate();
  const [sharedData, setSharedData] = useState<{
    title?: string;
    text?: string;
    url?: string;
    files?: File[];
  } | null>(null);

  useEffect(() => {
    // Check if this is a share target request
    const searchParams = new URLSearchParams(window.location.search);
    const title = searchParams.get('title');
    const text = searchParams.get('text');
    const url = searchParams.get('url');

    if (title || text || url) {
      // Extract shared data
      const data: any = {};
      if (title) data.title = title;
      if (text) data.text = text;
      if (url) data.url = url;

      setSharedData(data);

      // Redirect to messages with shared content
      // Store shared data in sessionStorage for the Messages component to pick up
      sessionStorage.setItem('sharedContent', JSON.stringify(data));

      // Navigate to messages
      navigate('/messages?action=share');
    }
  }, [navigate]);

  // This component doesn't render anything - it just handles the share
  return null;
}

/**
 * Hook to retrieve shared content
 */
export function useSharedContent() {
  const [sharedContent, setSharedContent] = useState<{
    title?: string;
    text?: string;
    url?: string;
    files?: File[];
  } | null>(null);

  useEffect(() => {
    // Check for shared content in sessionStorage
    const storedContent = sessionStorage.getItem('sharedContent');
    if (storedContent) {
      try {
        const data = JSON.parse(storedContent);
        setSharedContent(data);

        // Clear the stored content after retrieving
        sessionStorage.removeItem('sharedContent');
      } catch (error) {
        console.error('[Share] Error parsing shared content:', error);
      }
    }

    // Also check URL parameters (for direct share target)
    const searchParams = new URLSearchParams(window.location.search);
    const action = searchParams.get('action');

    if (action === 'share') {
      const title = searchParams.get('title');
      const text = searchParams.get('text');
      const url = searchParams.get('url');

      if (title || text || url) {
        const data: any = {};
        if (title) data.title = title;
        if (text) data.text = text;
        if (url) data.url = url;

        setSharedContent(data);

        // Clear URL parameters
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  const clearSharedContent = () => {
    setSharedContent(null);
    sessionStorage.removeItem('sharedContent');
  };

  return { sharedContent, clearSharedContent };
}
