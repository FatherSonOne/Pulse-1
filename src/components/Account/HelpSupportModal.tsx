// HelpSupportModal.tsx - Help documentation and support
import React, { useState } from 'react';

import { Book, ChevronRight, Github, Headset, HelpCircle, Keyboard, Mail, MessageCircle, MessagesSquare, Newspaper, Video, X, Youtube } from 'lucide-react';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: string;
}

const keyboardShortcuts: KeyboardShortcut[] = [
  { keys: ['Ctrl', 'K'], description: 'Open command palette', category: 'General' },
  { keys: ['Ctrl', 'N'], description: 'New message', category: 'Messages' },
  { keys: ['Ctrl', 'S'], description: 'Save draft', category: 'Messages' },
  { keys: ['Ctrl', 'Enter'], description: 'Send message', category: 'Messages' },
  { keys: ['Ctrl', 'F'], description: 'Search messages', category: 'Search' },
  { keys: ['Ctrl', 'Shift', 'F'], description: 'Advanced search', category: 'Search' },
  { keys: ['Esc'], description: 'Close modal/dialog', category: 'General' },
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'General' },
  { keys: ['Ctrl', '/'], description: 'Toggle sidebar', category: 'Navigation' },
  { keys: ['Alt', 'H'], description: 'Go to home', category: 'Navigation' },
  { keys: ['Alt', 'M'], description: 'Go to messages', category: 'Navigation' },
  { keys: ['Alt', 'E'], description: 'Go to email', category: 'Navigation' },
  { keys: ['Alt', 'C'], description: 'Go to calendar', category: 'Navigation' },
];

const faqs = [
  {
    question: 'How do I connect my Google Account?',
    answer: 'Click on your profile photo in the sidebar, then select "Add account" or "Switch account". Follow the Google OAuth flow to connect your account.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes! All your data is encrypted in transit and at rest. We use industry-standard security practices and never sell your data to third parties. View our Privacy Policy for more details.',
  },
  {
    question: 'How do I sync my emails?',
    answer: 'Emails are automatically synced when you connect your Gmail account. You can manually trigger a sync from the Email settings menu.',
  },
  {
    question: 'Can I use Pulse offline?',
    answer: 'Yes! Pulse caches your recent data locally, so you can view and draft messages offline. Changes will sync when you reconnect to the internet.',
  },
  {
    question: 'How do I change my theme?',
    answer: 'Go to Account Settings > Appearance and select your preferred theme (Light, Dark, or System).',
  },
  {
    question: 'What keyboard shortcuts are available?',
    answer: 'Press "?" or check the Keyboard Shortcuts tab in this help modal to see all available shortcuts.',
  },
];

const resources = [
  {
    title: 'Getting Started Guide',
    description: 'Learn the basics of Pulse',
    icon: 'fa-rocket',
    link: '#',
    color: 'blue',
  },
  {
    title: 'Email Integration',
    description: 'Connect and manage your Gmail',
    icon: 'fa-envelope',
    link: '#',
    color: 'red',
  },
  {
    title: 'Calendar Setup',
    description: 'Sync your Google Calendar',
    icon: 'fa-calendar',
    link: '#',
    color: 'green',
  },
  {
    title: 'Voice Commands',
    description: 'Use voice to control Pulse',
    icon: 'fa-microphone',
    link: '#',
    color: 'purple',
  },
  {
    title: 'Privacy & Security',
    description: 'How we protect your data',
    icon: 'fa-shield-halved',
    link: '#',
    color: 'indigo',
  },
  {
    title: 'Troubleshooting',
    description: 'Common issues and solutions',
    icon: 'fa-wrench',
    link: '#',
    color: 'amber',
  },
];

export const HelpSupportModal: React.FC<HelpSupportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'resources' | 'faq' | 'shortcuts' | 'contact'>('resources');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const filteredShortcuts = keyboardShortcuts.filter((shortcut) =>
    shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shortcut.keys.some((key) => key.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const groupedShortcuts = filteredShortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  // Helper function to detect browser
  const detectBrowser = () => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Firefox/')) return 'Firefox';
    if (userAgent.includes('Edg/')) return 'Edge';
    if (userAgent.includes('Chrome/') && !userAgent.includes('Edg/')) return 'Chrome';
    if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) return 'Safari';
    if (userAgent.includes('OPR/') || userAgent.includes('Opera/')) return 'Opera';
    return 'Unknown';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-end z-[9999] animate-fadeIn p-0">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl h-screen rounded-l-2xl shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800 overflow-hidden animate-slideInFromRight">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-rose-500/10 to-pink-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
              <HelpCircle className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Help & Support</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Get help using Pulse</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition"
            title="Close"
          >
            <X />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-stretch gap-1 px-2 sm:px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          <button
            onClick={() => setActiveTab('resources')}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'resources'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Book className="shrink-0" />
            <span className="truncate">Resources</span>
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'faq'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <MessagesSquare className="shrink-0" />
            <span className="truncate">FAQ</span>
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'shortcuts'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Keyboard className="shrink-0" />
            <span className="truncate"><span className="sm:hidden">Shortcuts</span><span className="hidden sm:inline">Keyboard Shortcuts</span></span>
          </button>
          <button
            onClick={() => setActiveTab('contact')}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'contact'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Headset className="shrink-0" />
            <span className="truncate"><span className="sm:hidden">Contact</span><span className="hidden sm:inline">Contact Support</span></span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[500px]">
          {/* Resources Tab */}
          {activeTab === 'resources' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Documentation & Guides</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {resources.map((resource) => (
                    <a
                      key={resource.title}
                      href={resource.link}
                      className="flex items-start gap-4 p-4 bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition group"
                    >
                      <div className={`w-12 h-12 rounded-lg bg-${resource.color}-100 dark:bg-${resource.color}-900/20 flex items-center justify-center flex-shrink-0`}>
                        <i className={`fa-solid ${resource.icon} text-${resource.color}-600 dark:text-${resource.color}-400 text-xl`}></i>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-zinc-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition">
                          {resource.title}
                        </h4>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                          {resource.description}
                        </p>
                      </div>
                      <ChevronRight className="text-zinc-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Quick Links</h3>
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href="#"
                    className="flex items-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    <Video className="text-zinc-500" />
                    Video Tutorials
                  </a>
                  <a
                    href="#"
                    className="flex items-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    <Newspaper className="text-zinc-500" />
                    Blog & Updates
                  </a>
                  <a
                    href="#"
                    className="flex items-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    <Youtube className="text-zinc-500" />
                    YouTube Channel
                  </a>
                  <a
                    href="#"
                    className="flex items-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    <Github className="text-zinc-500" />
                    GitHub
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* FAQ Tab */}
          {activeTab === 'faq' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Frequently Asked Questions</h3>
              {faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
                  >
                    <span className="font-semibold text-zinc-900 dark:text-white">{faq.question}</span>
                    <i className={`fa-solid fa-chevron-down text-zinc-400 transition-transform ${expandedFaq === idx ? 'rotate-180' : ''}`}></i>
                  </button>
                  {expandedFaq === idx && (
                    <div className="px-4 pb-4">
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Keyboard Shortcuts Tab */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-6">
              <div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search shortcuts..."
                  className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400"
                />
              </div>

              {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {shortcuts.map((shortcut, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700"
                      >
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{shortcut.description}</span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, keyIdx) => (
                            <React.Fragment key={keyIdx}>
                              <kbd className="px-2 py-1 text-xs font-semibold bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded border border-zinc-300 dark:border-zinc-600">
                                {key}
                              </kbd>
                              {keyIdx < shortcut.keys.length - 1 && (
                                <span className="text-zinc-400 text-xs">+</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Contact Support Tab */}
          {activeTab === 'contact' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Get in Touch</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                  Can't find what you're looking for? Our support team is here to help!
                </p>

                <div className="space-y-4">
                  <a
                    href="mailto:fm1@qntmecos.com"
                    className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition"
                  >
                    <div className="w-12 h-12 rounded-lg bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center flex-shrink-0">
                      <Mail className="text-rose-600 dark:text-rose-400 text-xl" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-white">Email Support</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">fm1@qntmecos.com</p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Response time: 24-48 hours</p>
                    </div>
                  </a>

                  <a
                    href="#"
                    className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition"
                  >
                    <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                      <MessagesSquare className="text-green-600 dark:text-green-400 text-xl" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-white">Live Chat</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Chat with our team</p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">● Online now</p>
                    </div>
                  </a>

                  <a
                    href="#"
                    className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition"
                  >
                    <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="text-purple-600 dark:text-purple-400 text-xl" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-white">Community Discord</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Join our community</p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Get help from other users</p>
                    </div>
                  </a>
                </div>
              </div>

              {/* System Info */}
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">System Information</h4>
                <div className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  <div className="flex justify-between">
                    <span>Version:</span>
                    <span>1.0.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Browser:</span>
                    <span>{detectBrowser()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform:</span>
                    <span>{navigator.platform}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
          >
            Close
          </button>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Press <kbd className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-zinc-700 dark:text-zinc-300">?</kbd> to open this anytime
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpSupportModal;
