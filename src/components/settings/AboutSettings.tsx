import React, { useRef, useEffect } from 'react';
import { ArrowRight, Download, Github, Heart, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const AboutSettings: React.FC = () => {
  const deferredPromptRef = useRef<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" className="w-20 h-20 rounded-2xl shadow-lg shadow-rose-500/30 mb-6">
          <defs>
            <linearGradient id="about-pulse-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill="#0f172a" />
          <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#about-pulse-grad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <h2 className="text-3xl font-bold dark:text-white text-zinc-900 mb-2">Pulse</h2>
        <p className="text-zinc-500 mb-6">Version 2.4.0 (Beta)</p>

        <div className="flex gap-4">
          <button className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold rounded-full hover:scale-105 transition transform">
            Check for Updates
          </button>
          <button
            onClick={async () => {
              if (deferredPromptRef.current) {
                deferredPromptRef.current.prompt();
                await deferredPromptRef.current.userChoice;
                deferredPromptRef.current = null;
              } else {
                toast('Pulse is already installed or your browser doesn\'t support PWA install.', { icon: 'ℹ️' });
              }
            }}
            className="px-6 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
          >
            <Download className="mr-2" /> Install App
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
        <a href="/privacy" className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-500 transition group">
          <div className="flex items-center justify-between">
            <span className="font-medium dark:text-white text-zinc-900">Privacy Policy</span>
            <ArrowRight className="text-zinc-400 group-hover:text-blue-500 transition" />
          </div>
        </a>
        <a href="/terms" className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-500 transition group">
          <div className="flex items-center justify-between">
            <span className="font-medium dark:text-white text-zinc-900">Terms of Service</span>
            <ArrowRight className="text-zinc-400 group-hover:text-blue-500 transition" />
          </div>
        </a>
        <a href="https://github.com/pulse/pulse" target="_blank" rel="noreferrer" className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-500 transition group">
          <div className="flex items-center justify-between">
            <span className="font-medium dark:text-white text-zinc-900">GitHub Repository</span>
            <Github className="text-zinc-400 group-hover:text-black dark:group-hover:text-white transition" />
          </div>
        </a>
        <a href="#" className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-500 transition group">
          <div className="flex items-center justify-between">
            <span className="font-medium dark:text-white text-zinc-900">Help Center</span>
            <HelpCircle className="text-zinc-400 group-hover:text-blue-500 transition" />
          </div>
        </a>
      </div>

      <div className="text-center pt-8 text-xs text-zinc-400">
        <p>&copy; 2026 Pulse. All rights reserved.</p>
        <p className="mt-1">Made with <Heart className="text-rose-500 mx-1" /> by the Pulse Team.</p>
      </div>
    </div>
  );
};
