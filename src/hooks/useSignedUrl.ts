// useSignedUrl — resolve a stored media reference to a signed, private-bucket-
// ready URL for use in a JSX `src`/`poster` binding.
//
// Imperative playback paths (the Relay studio engine, downloads) can `await
// getPlayableUrl(...)` inline. Declarative bindings can't — a `<video src>` or
// `<img src>` needs a plain string at render time. This hook bridges that: it
// signs on mount / when the input changes and returns '' until the signed URL
// resolves, then the signed URL. blob:/data:/foreign URLs pass straight through.
//
// `enabled` gates the sign so callers can stay lazy — e.g. only sign a video
// when its player is actually open, avoiding a createSignedUrl per feed item.

import { useEffect, useState } from 'react';
import { getPlayableUrl } from '../services/relay/resolveAudioUrl';

export function useSignedUrl(
  input: string | null | undefined,
  enabled: boolean = true,
): string {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!enabled || !input) {
      setUrl('');
      return;
    }
    let active = true;
    getPlayableUrl(input).then((signed) => {
      if (active) setUrl(signed);
    });
    return () => {
      active = false;
    };
  }, [input, enabled]);

  return url;
}
