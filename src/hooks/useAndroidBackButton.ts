import { useEffect, useRef } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import toast from 'react-hot-toast';
import { AppView } from '../types';

interface UseAndroidBackButtonArgs {
  view: AppView;
  setView: React.Dispatch<React.SetStateAction<AppView>>;
  rootView?: AppView;
  exitToastMs?: number;
}

export function useAndroidBackButton({
  view,
  setView,
  rootView = AppView.DASHBOARD,
  exitToastMs = 2000,
}: UseAndroidBackButtonArgs) {
  const viewRef = useRef(view);
  const exitArmedRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return;
    }

    let handle: PluginListenerHandle | undefined;

    CapacitorApp.addListener('backButton', () => {
      const current = viewRef.current;

      if (current !== rootView) {
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current);
          exitTimerRef.current = null;
        }
        exitArmedRef.current = false;
        setView(rootView);
        return;
      }

      if (exitArmedRef.current) {
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current);
          exitTimerRef.current = null;
        }
        exitArmedRef.current = false;
        CapacitorApp.exitApp().catch(() => undefined);
        return;
      }

      exitArmedRef.current = true;
      toast('Press back again to exit', {
        id: 'pulse-back-exit',
        duration: exitToastMs,
        position: 'bottom-center',
      });
      exitTimerRef.current = setTimeout(() => {
        exitArmedRef.current = false;
        exitTimerRef.current = null;
      }, exitToastMs);
    }).then(h => { handle = h; });

    return () => {
      handle?.remove();
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      exitArmedRef.current = false;
    };
  }, [rootView, setView, exitToastMs]);
}
