import React, { useState, useCallback, useRef } from 'react';
import './AILabToast.css';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  exiting: boolean;
}

const ICONS: Record<ToastType, string> = {
  success: 'fa-circle-check',
  error: 'fa-circle-exclamation',
  info: 'fa-circle-info',
};

let toastCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timers.current.delete(id);
    }, 200);
    timers.current.set(id, timer);
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);

    // Auto dismiss after 2.5s
    const timer = setTimeout(() => dismiss(id), 2500);
    timers.current.set(id, timer);
  }, [dismiss]);

  const ToastComponent = (
    <div className="ailab-toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`ailab-toast ailab-toast-${toast.type} ${toast.exiting ? 'ailab-toast-out' : ''}`}
          onClick={() => dismiss(toast.id)}
          role="alert"
        >
          <i className={`fa-solid ${ICONS[toast.type]} ailab-toast-icon`} />
          <span className="ailab-toast-message">{toast.message}</span>
        </div>
      ))}
    </div>
  );

  return { showToast, ToastComponent };
}
