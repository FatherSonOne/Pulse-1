// usePlaybackSpeed - Persistent playback speed for audio/video messages
// Saves user's preferred playback speed to localStorage and applies to all players

import { useState, useEffect, useCallback } from 'react';

export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;

export const PLAYBACK_SPEEDS: PlaybackSpeed[] = [0.5, 0.75, 1, 1.25, 1.5, 2];

const STORAGE_KEY = 'voxer-playback-speed';

export function usePlaybackSpeed() {
  const [playbackSpeed, setPlaybackSpeedState] = useState<PlaybackSpeed>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = parseFloat(saved);
      if (PLAYBACK_SPEEDS.includes(parsed as PlaybackSpeed)) {
        return parsed as PlaybackSpeed;
      }
    }
    return 1; // Default normal speed
  });

  // Persist to localStorage whenever speed changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, playbackSpeed.toString());
  }, [playbackSpeed]);

  const setPlaybackSpeed = useCallback((speed: PlaybackSpeed) => {
    setPlaybackSpeedState(speed);
  }, []);

  const cyclePlaybackSpeed = useCallback(() => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackSpeedState(PLAYBACK_SPEEDS[nextIndex]);
  }, [playbackSpeed]);

  // Apply speed to an audio/video element
  const applyToElement = useCallback(
    (element: HTMLAudioElement | HTMLVideoElement | null) => {
      if (element) {
        element.playbackRate = playbackSpeed;
      }
    },
    [playbackSpeed]
  );

  return {
    playbackSpeed,
    setPlaybackSpeed,
    cyclePlaybackSpeed,
    applyToElement,
  };
}

export default usePlaybackSpeed;
