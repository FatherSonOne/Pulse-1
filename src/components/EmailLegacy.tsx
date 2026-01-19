import React, { useState, useEffect } from 'react';
import { User, Email } from '../types';
import { connectProvider, fetchEmails } from '../services/authService';
import { generateEmailDraft, generateEmailSuggestions, improveEmailText, EmailTone } from '../services/geminiService';
import { getGmailService } from '../services/gmailService';
import toast from 'react-hot-toast';

interface EmailProps {
  user: User;
  onUpdateUser: () => void;
  apiKey?: string;
}

const EmailClient: React.FC<EmailProps> = ({ user, onUpdateUser, apiKey = '' }) => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(false);

  // Login Flow State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<'google' | 'microsoft' | 'icloud' | null>(null);
  const [loginStep, setLoginStep] = useState(0); // 0: input, 1: loading, 2: success

  // Filter States
  const [gmailTab, setGmailTab] = useState<'primary' | 'social' | 'updates'>('primary');
  const [outlookFocus, setOutlookFocus] = useState<'focused' | 'other'>('focused');

  // Compose Modal State
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeMode, setComposeMode] = useState<'new' | 'reply' | 'forward'>('new');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeTone, setComposeTone] = useState<EmailTone>('professional');
  const [aiIntent, setAiIntent] = useState('');
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [loadingSmartReplies, setLoadingSmartReplies] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    loadEmails();
  }, [selectedProvider, user.connectedProviders]);

  const loadEmails = async () => {
    setLoading(true);
    let allEmails: Email[] = [];

    // Fetch from connected APIs based on selected view
    if (user.connectedProviders.google && (selectedProvider === 'all' || selectedProvider === 'google')) {
        try {
          // Try to use real Gmail API
          const gmailService = getGmailService();
          const gmailMessages = await gmailService.getMessages(30);

          // Convert to Email type
          const gmailEmails: Email[] = gmailMessages.map(msg => ({
            id: msg.id,
            provider: 'google' as const,
            from: msg.senderEmail || 'unknown@gmail.com',
            subject: (msg.metadata?.subject as string) || '(No Subject)',
            snippet: msg.content?.substring(0, 100) || '',
            body: msg.content || '',
            date: msg.timestamp,
            read: msg.isRead || false,
            folder: 'inbox',
            labels: msg.tags
          }));

          allEmails = [...allEmails, ...gmailEmails];
        } catch (error) {
          console.error('Gmail API error, using mock data:', error);
          // Fallback to mock data
          const g = await fetchEmails('google');
          allEmails = [...allEmails, ...g];
        }
    }
    if (user.connectedProviders.microsoft && (selectedProvider === 'all' || selectedProvider === 'microsoft')) {
        const m = await fetchEmails('microsoft');
        allEmails = [...allEmails, ...m];
    }
    if (user.connectedProviders.icloud && (selectedProvider === 'all' || selectedProvider === 'icloud')) {
        const i = await fetchEmails('icloud');
        allEmails = [...allEmails, ...i];
    }

    // Sort by date desc
    allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setEmails(allEmails);
    setLoading(false);
  };

  const initiateConnection = (provider: 'google' | 'microsoft' | 'icloud') => {
      setConnectingProvider(provider);
      setLoginStep(0);
      setShowLoginModal(true);
  };

  const confirmConnection = async () => {
      if (!connectingProvider) return;
      setLoginStep(1);
      
      // Simulate API Handshake
      await connectProvider(connectingProvider);
      
      setLoginStep(2);
      setTimeout(() => {
          onUpdateUser();
          setShowLoginModal(false);
          setConnectingProvider(null);
          setLoginStep(0);
      }, 1500);
  };

  // Helper to filter emails based on active sub-tabs (Gmail Tabs / Outlook Focus)
  const getFilteredEmails = () => {
      return emails.filter(e => {
          if (selectedProvider === 'google' && e.provider === 'google') {
              // Mock logic for gmail tabs
              if (gmailTab === 'social') return false; // Demo doesn't have social
              if (gmailTab === 'updates') return e.labels?.includes('updates');
              return !e.labels?.includes('updates'); // Primary
          }
          if (selectedProvider === 'microsoft' && e.provider === 'microsoft') {
              // Mock logic for outlook focused
              if (outlookFocus === 'other') return e.read; // Just a mock rule
              return !e.read || true; // Show all in focused for demo
          }
          return true;
      });
  };

  const getProviderIcon = (provider: string) => {
      switch(provider) {
          case 'google': return 'fa-google text-red-500';
          case 'microsoft': return 'fa-microsoft text-blue-500';
          case 'icloud': return 'fa-apple text-zinc-500';
          default: return 'fa-envelope text-zinc-400';
      }
  };

  // Compose/Reply Handlers
  const openCompose = (mode: 'new' | 'reply' | 'forward' = 'new') => {
    setComposeMode(mode);
    if (mode === 'new') {
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
    } else if (mode === 'reply' && selectedEmail) {
      setComposeTo(selectedEmail.from);
      setComposeSubject(`Re: ${selectedEmail.subject}`);
      setComposeBody(`\n\n---\nOn ${selectedEmail.date.toLocaleString()}, ${selectedEmail.from} wrote:\n${selectedEmail.body}`);
      loadSmartReplies();
    } else if (mode === 'forward' && selectedEmail) {
      setComposeTo('');
      setComposeSubject(`Fwd: ${selectedEmail.subject}`);
      setComposeBody(`\n\n---\nForwarded message:\nFrom: ${selectedEmail.from}\nDate: ${selectedEmail.date.toLocaleString()}\nSubject: ${selectedEmail.subject}\n\n${selectedEmail.body}`);
    }
    setShowComposeModal(true);
  };

  const loadSmartReplies = async () => {
    if (!apiKey || !selectedEmail) return;
    setLoadingSmartReplies(true);
    const suggestions = await generateEmailSuggestions(apiKey, {
      from: selectedEmail.from,
      subject: selectedEmail.subject,
      body: selectedEmail.body
    });
    if (suggestions) setSmartReplies(suggestions);
    setLoadingSmartReplies(false);
  };

  const handleAIDraft = async () => {
    if (!apiKey || !aiIntent.trim()) return;
    setGeneratingDraft(true);

    const draft = await generateEmailDraft(apiKey, {
      replyTo: composeMode === 'reply' && selectedEmail ? {
        from: selectedEmail.from,
        subject: selectedEmail.subject,
        body: selectedEmail.body
      } : undefined,
      intent: aiIntent,
      tone: composeTone,
      recipientName: composeTo.split('@')[0]
    });

    if (draft) {
      if (composeMode === 'new') {
        setComposeSubject(draft.subject);
      }
      setComposeBody(draft.body + (composeMode === 'reply' ? composeBody : ''));
    }
    setGeneratingDraft(false);
    setAiIntent('');
  };

  const handleImproveText = async (improvement: 'shorten' | 'elaborate' | 'fix_grammar' | 'make_friendlier' | 'make_formal') => {
    if (!apiKey || !composeBody.trim()) return;
    setGeneratingDraft(true);
    const improved = await improveEmailText(apiKey, composeBody.split('---')[0], improvement);
    if (improved) {
      const signature = composeBody.includes('---') ? '\n\n---' + composeBody.split('---').slice(1).join('---') : '';
      setComposeBody(improved + signature);
    }
    setGeneratingDraft(false);
  };

  const handleSendEmail = async () => {
    if (!composeTo.trim()) {
      toast.error('Please enter a recipient');
      return;
    }
    if (!composeSubject.trim()) {
      toast.error('Please enter a subject');
      return;
    }

    setSendingEmail(true);
    try {
      const gmailService = getGmailService();
      await gmailService.sendEmail({
        to: composeTo.split(',').map(e => e.trim()),
        subject: composeSubject,
        body: composeBody,
        isHtml: false
      });

      toast.success('Email sent successfully!');
      setShowComposeModal(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setSmartReplies([]);
      loadEmails(); // Refresh to show sent email
    } catch (error) {
      console.error('Failed to send email:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  const filteredEmails = getFilteredEmails();

  return (
    <div className="h-full flex flex-col md:flex-row bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-fade-in shadow-xl relative">

        {/* Compose Modal */}
        {showComposeModal && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl h-[90%] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in border border-zinc-200 dark:border-zinc-800">
                    {/* Header */}
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950">
                        <h3 className="font-bold dark:text-white text-zinc-900 flex items-center gap-2">
                            <i className={`fa-solid ${composeMode === 'reply' ? 'fa-reply' : composeMode === 'forward' ? 'fa-share' : 'fa-pen'}`}></i>
                            {composeMode === 'reply' ? 'Reply' : composeMode === 'forward' ? 'Forward' : 'New Email'}
                        </h3>
                        <button onClick={() => setShowComposeModal(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    {/* Form */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">To</label>
                            <input
                                type="email"
                                value={composeTo}
                                onChange={(e) => setComposeTo(e.target.value)}
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-sm dark:text-white focus:border-blue-500 outline-none transition"
                                placeholder="recipient@example.com"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">Subject</label>
                            <input
                                type="text"
                                value={composeSubject}
                                onChange={(e) => setComposeSubject(e.target.value)}
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-sm dark:text-white focus:border-blue-500 outline-none transition"
                                placeholder="Email subject"
                            />
                        </div>

                        {/* AI Draft Section */}
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800/30">
                            <div className="flex items-center gap-2 mb-3 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider">
                                <i className="fa-solid fa-wand-magic-sparkles"></i> AI Draft Assistant
                            </div>
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={aiIntent}
                                    onChange={(e) => setAiIntent(e.target.value)}
                                    className="flex-1 bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800 rounded-lg px-3 py-2 text-sm dark:text-white focus:border-purple-500 outline-none transition"
                                    placeholder="Describe what you want to say..."
                                />
                                <button
                                    onClick={handleAIDraft}
                                    disabled={generatingDraft || !aiIntent.trim()}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-bold transition disabled:opacity-50 flex items-center gap-2"
                                >
                                    {generatingDraft ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-sparkles"></i>}
                                    Generate
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="text-xs text-zinc-500">Tone:</span>
                                {(['professional', 'friendly', 'concise', 'formal'] as EmailTone[]).map(tone => (
                                    <button
                                        key={tone}
                                        onClick={() => setComposeTone(tone)}
                                        className={`px-2 py-1 rounded text-xs font-medium transition ${composeTone === tone
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                                        }`}
                                    >
                                        {tone}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Smart Replies for Reply Mode */}
                        {composeMode === 'reply' && smartReplies.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-xs font-bold text-zinc-400 uppercase">Smart Replies</div>
                                <div className="flex flex-wrap gap-2">
                                    {smartReplies.map((reply, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setComposeBody(reply + composeBody)}
                                            className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 transition border border-blue-100 dark:border-blue-800"
                                        >
                                            {reply}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {composeMode === 'reply' && loadingSmartReplies && (
                            <div className="text-sm text-zinc-400 flex items-center gap-2">
                                <i className="fa-solid fa-circle-notch fa-spin"></i> Loading smart replies...
                            </div>
                        )}

                        {/* Body */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold text-zinc-400 uppercase">Message</label>
                                {composeBody && (
                                    <div className="flex gap-1">
                                        <button onClick={() => handleImproveText('shorten')} className="px-2 py-1 text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition" title="Shorten">
                                            <i className="fa-solid fa-compress"></i>
                                        </button>
                                        <button onClick={() => handleImproveText('elaborate')} className="px-2 py-1 text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition" title="Elaborate">
                                            <i className="fa-solid fa-expand"></i>
                                        </button>
                                        <button onClick={() => handleImproveText('fix_grammar')} className="px-2 py-1 text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition" title="Fix Grammar">
                                            <i className="fa-solid fa-spell-check"></i>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <textarea
                                value={composeBody}
                                onChange={(e) => setComposeBody(e.target.value)}
                                className="w-full h-48 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-sm dark:text-white focus:border-blue-500 outline-none transition resize-none"
                                placeholder="Write your message..."
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                        <div className="flex gap-2">
                            <button className="w-9 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                                <i className="fa-solid fa-paperclip"></i>
                            </button>
                            <button className="w-9 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                                <i className="fa-solid fa-link"></i>
                            </button>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowComposeModal(false)}
                                className="px-4 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition text-sm"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleSendEmail}
                                disabled={!composeTo || !composeSubject || sendingEmail}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {sendingEmail ? (
                                  <>
                                    <i className="fa-solid fa-circle-notch fa-spin"></i> Sending...
                                  </>
                                ) : (
                                  <>
                                    <i className="fa-solid fa-paper-plane"></i> Send
                                  </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Login Modal Simulation */}
        {showLoginModal && connectingProvider && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in border border-zinc-200 dark:border-zinc-800">
                    <div className="p-6 text-center">
                        <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
                            connectingProvider === 'microsoft' ? 'bg-blue-100 text-blue-600' : 'bg-zinc-100 text-zinc-900'
                        }`}>
                            <i className={`fa-brands ${
                                connectingProvider === 'microsoft' ? 'fa-microsoft' : 'fa-apple'
                            } text-3xl`}></i>
                        </div>
                        
                        <h3 className="text-xl font-bold dark:text-white text-zinc-900 mb-1">
                            {loginStep === 2 ? 'Connected!' : `Sign in with ${connectingProvider === 'microsoft' ? 'Outlook' : 'iCloud'}`}
                        </h3>
                        <p className="text-zinc-500 text-sm mb-6">
                            {loginStep === 0 ? 'Enter your credentials to authorize Pulse.' : loginStep === 1 ? 'Verifying credentials...' : 'Account successfully linked.'}
                        </p>

                        {loginStep === 0 && (
                            <div className="space-y-4 text-left">
                                <div>
                                    <label className="text-xs font-bold text-zinc-400 uppercase">Email</label>
                                    <input type="email" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500 transition" placeholder="name@example.com" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-400 uppercase">Password</label>
                                    <input type="password" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500 transition" placeholder="••••••••" />
                                </div>
                                <button onClick={confirmConnection} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition shadow-lg">
                                    Sign In
                                </button>
                            </div>
                        )}

                        {loginStep === 1 && (
                            <div className="py-8">
                                <i className="fa-solid fa-circle-notch fa-spin text-blue-500 text-2xl"></i>
                            </div>
                        )}
                        
                        {loginStep === 2 && (
                            <div className="py-4 text-emerald-500">
                                <i className="fa-solid fa-check-circle text-4xl"></i>
                            </div>
                        )}
                    </div>
                    {loginStep === 0 && (
                        <div className="bg-zinc-50 dark:bg-zinc-950 p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                            <span className="text-xs text-zinc-500"><i className="fa-solid fa-lock"></i> Secure Connection</span>
                            <button onClick={() => setShowLoginModal(false)} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">Cancel</button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Sidebar */}
        <div className="w-full md:w-64 bg-zinc-50 dark:bg-zinc-900/50 border-r border-zinc-200 dark:border-zinc-800 flex flex-col p-4 flex-shrink-0">
            
            {/* Compose Button */}
            <button
                onClick={() => openCompose('new')}
                className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition mb-6 flex items-center justify-center gap-2"
            >
                <i className="fa-solid fa-pen"></i> Compose
            </button>

            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Mailboxes</h3>
            <div className="space-y-1 mb-6">
                <button 
                    onClick={() => setSelectedProvider('all')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-between group ${selectedProvider === 'all' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                >
                    <div className="flex items-center gap-3">
                        <i className="fa-solid fa-inbox w-4 text-center"></i> Unified Inbox
                    </div>
                    {selectedProvider === 'all' && emails.length > 0 && <span className="bg-zinc-300 dark:bg-zinc-700 text-xs px-1.5 rounded-full">{emails.length}</span>}
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-3 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800">
                    <i className="fa-regular fa-paper-plane w-4 text-center"></i> Sent
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-3 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800">
                    <i className="fa-solid fa-file w-4 text-center"></i> Drafts
                </button>
            </div>

            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Accounts</h3>
            <div className="space-y-1">
                {/* Google */}
                <button 
                    onClick={() => user.connectedProviders.google ? setSelectedProvider('google') : initiateConnection('google')}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition ${selectedProvider === 'google' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}`}
                >
                    <div className="w-6 h-6 rounded bg-white flex items-center justify-center shadow-sm">
                         <i className="fa-brands fa-google text-red-500"></i>
                    </div>
                    <span className="flex-1 text-sm font-medium text-left">Gmail</span>
                    {user.connectedProviders.google && <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>}
                </button>

                {/* Outlook */}
                <button 
                    onClick={() => user.connectedProviders.microsoft ? setSelectedProvider('microsoft') : initiateConnection('microsoft')}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition ${selectedProvider === 'microsoft' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}`}
                >
                    <div className="w-6 h-6 rounded bg-white flex items-center justify-center shadow-sm">
                         <i className="fa-brands fa-microsoft text-blue-500"></i>
                    </div>
                    <span className="flex-1 text-sm font-medium text-left">Outlook</span>
                    {!user.connectedProviders.microsoft && <i className="fa-solid fa-plus text-xs opacity-50"></i>}
                    {user.connectedProviders.microsoft && <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>}
                </button>

                {/* iCloud */}
                <button 
                    onClick={() => user.connectedProviders.icloud ? setSelectedProvider('icloud') : initiateConnection('icloud')}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition ${selectedProvider === 'icloud' ? 'bg-zinc-200 dark:bg-zinc-700' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}`}
                >
                    <div className="w-6 h-6 rounded bg-white flex items-center justify-center shadow-sm">
                         <i className="fa-brands fa-apple text-zinc-800"></i>
                    </div>
                    <span className="flex-1 text-sm font-medium text-left">iCloud</span>
                    {!user.connectedProviders.icloud && <i className="fa-solid fa-plus text-xs opacity-50"></i>}
                    {user.connectedProviders.icloud && <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>}
                </button>
            </div>
        </div>

        {/* Email List Column */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-900 ${selectedEmail ? 'hidden md:flex' : 'flex'}`}>
            
            {/* Header / Search */}
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500 dark:text-white transition"
                    />
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-zinc-400 text-xs"></i>
                </div>
            </div>

            {/* Provider Specific Tabs */}
            {selectedProvider === 'google' && (
                <div className="flex border-b border-zinc-200 dark:border-zinc-800">
                    <button onClick={() => setGmailTab('primary')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${gmailTab === 'primary' ? 'border-red-500 text-red-500' : 'border-transparent text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>Primary</button>
                    <button onClick={() => setGmailTab('social')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${gmailTab === 'social' ? 'border-blue-500 text-blue-500' : 'border-transparent text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>Social</button>
                    <button onClick={() => setGmailTab('updates')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${gmailTab === 'updates' ? 'border-orange-500 text-orange-500' : 'border-transparent text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>Updates</button>
                </div>
            )}
            
            {selectedProvider === 'microsoft' && (
                <div className="flex p-2 gap-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                    <button onClick={() => setOutlookFocus('focused')} className={`flex-1 py-1.5 rounded text-xs font-semibold transition ${outlookFocus === 'focused' ? 'bg-white dark:bg-zinc-800 shadow text-blue-600' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>Focused</button>
                    <button onClick={() => setOutlookFocus('other')} className={`flex-1 py-1.5 rounded text-xs font-semibold transition ${outlookFocus === 'other' ? 'bg-white dark:bg-zinc-800 shadow text-blue-600' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>Other</button>
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-8 text-center text-zinc-500"><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Syncing...</div>
                ) : filteredEmails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-6 text-center">
                        <i className="fa-regular fa-folder-open text-3xl mb-3 opacity-30"></i>
                        <p className="text-sm">Folder is empty</p>
                    </div>
                ) : (
                    filteredEmails.map(email => (
                        <div 
                            key={email.id}
                            onClick={() => setSelectedEmail(email)}
                            className={`p-4 border-b border-zinc-100 dark:border-zinc-800/50 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition relative group ${selectedEmail?.id === email.id ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30' : ''}`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 overflow-hidden">
                                   {selectedProvider === 'all' && (
                                       <i className={`fa-brands ${getProviderIcon(email.provider)} text-xs`}></i>
                                   )}
                                   <span className={`font-bold text-sm truncate ${!email.read ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>{email.from}</span>
                                </div>
                                <span className={`text-[10px] whitespace-nowrap ${!email.read ? 'text-blue-600 font-bold' : 'text-zinc-400'}`}>
                                    {email.date.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </span>
                            </div>
                            
                            <div className={`text-sm mb-1 truncate ${!email.read ? 'font-semibold text-zinc-900 dark:text-zinc-200' : 'font-medium text-zinc-600 dark:text-zinc-500'}`}>
                                {email.subject}
                            </div>
                            
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                {email.snippet}
                            </div>

                            {/* Gmail Labels Mock */}
                            {email.provider === 'google' && email.labels && (
                                <div className="flex gap-1 mt-2">
                                    {email.labels.map(l => (
                                        <span key={l} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold">{l}</span>
                                    ))}
                                </div>
                            )}

                            {!email.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>}
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Reading Pane */}
        <div className={`flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-950 ${!selectedEmail ? 'hidden md:flex' : 'flex'}`}>
            {selectedEmail ? (
                <>
                    {/* Reading Header */}
                    <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-between items-start animate-slide-up">
                        <div className="flex-1">
                             <button onClick={() => setSelectedEmail(null)} className="md:hidden text-zinc-500 mb-4 flex items-center gap-1 text-sm"><i className="fa-solid fa-arrow-left"></i> Back</button>
                             
                             <div className="flex justify-between items-start">
                                 <h2 className="text-xl font-bold dark:text-white text-zinc-900 mb-4 leading-tight">{selectedEmail.subject}</h2>
                                 <div className="flex gap-2">
                                     <button className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"><i className="fa-solid fa-print text-sm"></i></button>
                                     <button className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"><i className="fa-solid fa-star text-sm"></i></button>
                                 </div>
                             </div>

                             <div className="flex items-center gap-3">
                                 <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm ${
                                     selectedEmail.provider === 'google' ? 'bg-red-500' : 
                                     selectedEmail.provider === 'microsoft' ? 'bg-blue-600' : 'bg-zinc-500'
                                 }`}>
                                     {selectedEmail.from.charAt(0).toUpperCase()}
                                 </div>
                                 <div>
                                     <div className="font-bold dark:text-white text-zinc-900 text-sm">{selectedEmail.from}</div>
                                     <div className="text-xs text-zinc-500">to me <i className="fa-solid fa-caret-down text-[10px] ml-1"></i></div>
                                 </div>
                                 <div className="ml-auto text-zinc-400 text-xs font-mono">{selectedEmail.date.toLocaleString()}</div>
                             </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 p-8 overflow-y-auto dark:text-zinc-300 text-zinc-800 leading-7 whitespace-pre-wrap animate-fade-in text-sm font-light">
                        {selectedEmail.body}
                    </div>

                    {/* Action Footer */}
                    <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex gap-3">
                         <button
                            onClick={() => openCompose('reply')}
                            className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 rounded-xl text-sm font-bold transition shadow-lg flex items-center gap-2"
                         >
                            <i className="fa-solid fa-reply"></i> Reply
                         </button>
                         <button
                            onClick={() => openCompose('forward')}
                            className="px-6 py-2.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:text-white text-zinc-700 rounded-xl text-sm font-medium transition flex items-center gap-2"
                         >
                            <i className="fa-solid fa-share"></i> Forward
                         </button>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="w-24 h-24 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6 animate-pulse">
                        <i className="fa-regular fa-envelope text-4xl opacity-50"></i>
                    </div>
                    <p className="font-medium">Select an email to read</p>
                </div>
            )}
        </div>

    </div>
  );
};

export default EmailClient;