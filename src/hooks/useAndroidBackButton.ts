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
  /** Optional overlay hook: return true to consume the back press (e.g. an
   *  open bottom sheet closing itself) before any view navigation runs.
   *  Read through a ref so an unstable callback can't re-register the
   *  Capacitor listener. */
  interceptBack?: () => boolean;
}

export function useAndroidBackButton({
  view,
  setView,
  rootView = AppView.DASHBOARD,
  exitToastMs = 2000,
  interceptBack,
}: UseAndroidBackButtonArgs) {
  const viewRef = useRef(view);
  const exitArmedRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interceptRef = useRef(interceptBack);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    interceptRef.current = interceptBack;
  }, [interceptBack]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return;
    }

    let handle: PluginListenerHandle | undefined;

    CapacitorApp.addListener('backButton', () => {
      // An open overlay (mobile bottom sheet) consumes the press outright.
      if (interceptRef.current?.()) {
        return;
      }

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
