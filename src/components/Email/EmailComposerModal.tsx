// EmailComposerModal.tsx - Enhanced email composer with AI features
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CachedEmail, emailSyncService, EmailTemplate } from '../../services/emailSyncService';
import { SendEmailParams, EmailAttachment, getGmailService } from '../../services/gmailService';
import { emailAIService, ToneCheckResult } from '../../services/emailAIService';
import { smartComposeService } from '../../services/smartComposeService';
import { settingsService } from '../../services/settingsService';
import { emailMeetService } from '../../services/emailMeetService';
import { confidentialEmailService } from '../../services/confidentialEmailService';
import ScheduleSendModal from './ScheduleSendModal';
import TemplatesModal from './TemplatesModal';
import TemplateVariablesModal from './TemplateVariablesModal';
import { VoiceTextButton } from '../shared/VoiceTextButton';
import toast from 'react-hot-toast';

interface EmailComposerModalProps {
  userEmail: string;
  userName: string;
  replyTo: CachedEmail | null;
  prefilledBody?: string;
  // For restoring a cancelled send
  initialTo?: string;
  initialSubject?: string;
  initialCc?: string;
  initialBcc?: string;
  onClose: () => void;
  onSend: (params: SendEmailParams) => Promise<void>;
}

type ToneType = 'professional' | 'friendly' | 'formal' | 'concise';

export const EmailComposerModal: React.FC<EmailComposerModalProps> = ({
  userEmail,
  userName,
  replyTo,
  prefilledBody,
  initialTo,
  initialSubject,
  initialCc,
  initialBcc,
  onClose,
  onSend,
}) => {
  // Build initial body - use prefilled if available, otherwise use quote
  const getInitialBody = () => {
    const quotedReply = replyTo
      ? `\n\n---\nOn ${new Date(replyTo.received_at).toLocaleString()}, ${replyTo.from_name || replyTo.from_email} wrote:\n\n${replyTo.body_text}`
      : '';

    if (prefilledBody) {
      return prefilledBody + quotedReply;
    }
    return quotedReply;
  };

  // Form state - prefer initial values (for undo restore), then replyTo, then empty
  const [to, setTo] = useState<string>(initialTo || replyTo?.from_email || '');
  const [cc, setCc] = useState<string>(initialCc || '');
  const [bcc, setBcc] = useState<string>(initialBcc || '');
  const [subject, setSubject] = useState<string>(
    initialSubject || (replyTo ? `Re: ${replyTo.subject}` : '')
  );
  const [body, setBody] = useState<string>(getInitialBody());

  // UI state - show CC/BCC if they have initial values
  const [showCc, setShowCc] = useState(!!initialCc);
  const [showBcc, setShowBcc] = useState(!!initialBcc);
  const [sending, setSending] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // AI state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [selectedTone, setSelectedTone] = useState<ToneType>('professional');
  const [showToneCheck, setShowToneCheck] = useState(false);
  const [toneCheckResult, setToneCheckResult] = useState<ToneCheckResult | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [smartComposeEnabled, setSmartComposeEnabled] = useState(true);
  const [smartComposeLoading, setSmartComposeLoading] = useState(false);
  const [meetCreating, setMeetCreating] = useState(false);
  const [driveQuickAttach, setDriveQuickAttach] = useState(true);

  // Confidential mode
  const [confidentialEnabled, setConfidentialEnabled] = useState(false);
  const [confidentialExpiresAt, setConfidentialExpiresAt] = useState('');
  const [confidentialRequirePasscode, setConfidentialRequirePasscode] = useState(false);
  const [confidentialPasscode, setConfidentialPasscode] = useState('');
  const [confidentialDisableForward, setConfidentialDisableForward] = useState(true);
  const [confidentialDisableCopy, setConfidentialDisableCopy] = useState(true);
  const [confidentialDisablePrint, setConfidentialDisablePrint] = useState(true);
  const [confidentialDisableDownload, setConfidentialDisableDownload] = useState(true);

  // Attachment state
  const [attachments, setAttachments] = useState<File[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);

  // Schedule send state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  // Templates state
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Convert File array to EmailAttachment array
  const filesToAttachments = async (files: File[]): Promise<EmailAttachment[]> => {
    const attachmentPromises = files.map(async (file) => {
      const content = await fileToBase64(file);
      return {
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        content,
        size: file.size,
      };
    });
    return Promise.all(attachmentPromises);
  };

  // Focus textarea on mount
  useEffect(() => {
    if (!isMinimized && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isMinimized]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [enabled, driveEnabled] = await Promise.all([
          settingsService.get('aiSuggestionsEnabled'),
          settingsService.get('emailDriveQuickAttach'),
        ]);
        setSmartComposeEnabled(enabled);
        setDriveQuickAttach(driveEnabled);
      } catch (error) {
        console.error('Error loading AI settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  // Parse emails string to array
  const parseEmails = (emailStr: string): string[] => {
    return emailStr
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0);
  };

  // Handle send
  const handleSend = async () => {
    if (!to.trim()) {
      toast.error('Please enter a recipient');
      return;
    }

    // Validate all email addresses
    const toEmails = parseEmails(to);
    const invalidEmails = toEmails.filter(e => !isValidEmail(e));

    if (invalidEmails.length > 0) {
      toast.error(`Invalid email address: ${invalidEmails[0]}. Please include the full email (e.g., name@example.com)`);
      return;
    }

    if (toEmails.length === 0) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!subject.trim() && !body.trim()) {
      toast.error('Please enter a subject or message');
      return;
    }

    if (confidentialEnabled && confidentialRequirePasscode && !confidentialPasscode.trim()) {
      toast.error('Enter a passcode for confidential mode');
      return;
    }

    setSending(true);
    try {
      // Convert File attachments to EmailAttachment format
      const emailAttachments = attachments.length > 0
        ? await filesToAttachments(attachments)
        : undefined;

      await onSend({
        to: toEmails,
        cc: cc ? parseEmails(cc).filter(e => isValidEmail(e)) : undefined,
        bcc: bcc ? parseEmails(bcc).filter(e => isValidEmail(e)) : undefined,
        subject: subject || '(No Subject)',
        body,
        isHtml: false,
        threadId: replyTo?.thread_id,
        attachments: emailAttachments,
      });

      if (confidentialEnabled) {
        try {
          await confidentialEmailService.create({
            thread_id: replyTo?.thread_id || null,
            expires_at: confidentialExpiresAt ? new Date(confidentialExpiresAt).toISOString() : null,
            require_passcode: confidentialRequirePasscode,
            passcode: confidentialRequirePasscode ? confidentialPasscode : null,
            disable_forward: confidentialDisableForward,
            disable_copy: confidentialDisableCopy,
            disable_print: confidentialDisablePrint,
            disable_download: confidentialDisableDownload,
          });
        } catch (error) {
          console.error('Error saving confidential settings:', error);
          toast.error('Email sent, but confidential settings failed to save.');
        }
      }
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setSending(false);
    }
  };

  const handleOpenDrive = () => {
    window.open('https://drive.google.com', '_blank');
  };

  // Generate AI draft
  const handleGenerateAiDraft = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please describe what you want to say');
      return;
    }

    if (!emailAIService.isAvailable()) {
      toast.error('AI features require a Gemini API key. Add it in Settings.');
      return;
    }

    setAiGenerating(true);
    try {
      const draft = await emailAIService.generateDraft({
        intent: aiPrompt,
        tone: selectedTone,
        replyTo: replyTo || undefined,
      });

      // If replying, keep the quoted reply at the bottom
      const quotedReply = replyTo
        ? `\n\n---\nOn ${new Date(replyTo.received_at).toLocaleString()}, ${replyTo.from_name || replyTo.from_email} wrote:\n\n${replyTo.body_text}`
        : '';

      setBody(draft + quotedReply);
      setShowAiPanel(false);
      setAiPrompt('');
      toast.success('Draft generated!');
    } catch (error) {
      console.error('Draft generation error:', error);
      toast.error('Failed to generate draft');
    } finally {
      setAiGenerating(false);
    }
  };

  // Check tone before sending
  const handleToneCheck = async () => {
    if (!body.trim()) {
      toast.error('Please write something first');
      return;
    }

    if (!emailAIService.isAvailable()) {
      toast.error('AI features require a Gemini API key. Add it in Settings.');
      return;
    }

    setShowToneCheck(true);
    setToneCheckResult(null);

    try {
      const recipientContext = replyTo
        ? `Replying to ${replyTo.from_name || replyTo.from_email} about: ${replyTo.subject}`
        : to ? `Sending to: ${to}` : undefined;

      const result = await emailAIService.checkTone(body, recipientContext);
      setToneCheckResult(result);
    } catch (error) {
      console.error('Tone check error:', error);
      toast.error('Failed to check tone');
      setShowToneCheck(false);
    }
  };

  // Enhance email (shorten, elaborate, fix grammar, etc.)
  const handleEnhanceEmail = async (action: 'shorten' | 'elaborate' | 'formalize' | 'casualize' | 'fix_grammar') => {
    if (!body.trim()) {
      toast.error('Please write something first');
      return;
    }

    if (!emailAIService.isAvailable()) {
      toast.error('AI features require a Gemini API key. Add it in Settings.');
      return;
    }

    setEnhancing(true);
    try {
      // Get body without the quoted reply part
      const quotedReplyStart = body.indexOf('\n\n---\n');
      const mainBody = quotedReplyStart > -1 ? body.substring(0, quotedReplyStart) : body;
      const quotedPart = quotedReplyStart > -1 ? body.substring(quotedReplyStart) : '';

      const enhanced = await emailAIService.enhanceEmail(mainBody, action);
      setBody(enhanced + quotedPart);

      const actionNames = {
        shorten: 'shortened',
        elaborate: 'elaborated',
        formalize: 'formalized',
        casualize: 'made casual',
        fix_grammar: 'grammar fixed'
      };
      toast.success(`Email ${actionNames[action]}!`);
    } catch (error) {
      console.error('Enhancement error:', error);
      toast.error('Failed to enhance email');
    } finally {
      setEnhancing(false);
    }
  };

  // Smart compose suggestion
  const handleSmartCompose = async () => {
    if (!smartComposeEnabled) {
      toast.error('Smart Compose is disabled in settings');
      return;
    }
    if (!smartComposeService.isAvailable()) {
      toast.error('AI features require a Gemini API key. Add it in Settings.');
      return;
    }
    setSmartComposeLoading(true);
    try {
      const quotedReplyStart = body.indexOf('\n\n---\n');
      const mainBody = quotedReplyStart > -1 ? body.substring(0, quotedReplyStart) : body;
      const quotedPart = quotedReplyStart > -1 ? body.substring(quotedReplyStart) : '';

      const suggestions = await smartComposeService.getSuggestions({
        partialText: mainBody,
        replyTo: replyTo || undefined,
        recipientEmail: to || undefined,
        tone: selectedTone,
      });

      if (suggestions.length === 0) {
        toast('No suggestions available right now');
        return;
      }

      const suggestion = suggestions[0].text;
      const separator = mainBody && !mainBody.endsWith(' ') ? ' ' : '';
      setBody(mainBody + separator + suggestion + quotedPart);
      toast.success('Suggestion added');
    } catch (error) {
      console.error('Smart Compose error:', error);
      toast.error('Failed to generate suggestion');
    } finally {
      setSmartComposeLoading(false);
    }
  };

  // Create Google Meet link and insert into email body
  const handleInsertMeetLink = async () => {
    if (meetCreating) return;
    setMeetCreating(true);
    try {
      const title = subject?.trim() || 'Pulse Meeting';
      const start = new Date(Date.now() + 60 * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const attendees = parseEmails(to).filter(e => isValidEmail(e));

      const { meetLink } = await emailMeetService.createMeetLink({
        title,
        start,
        end,
        attendees,
        description: `Meeting created from Pulse email composer.`,
      });

      const insertion = `\n\nGoogle Meet: ${meetLink}\n`;
      setBody(prev => prev + insertion);
      toast.success('Meet link added');
    } catch (error) {
      console.error('Meet link error:', error);
      toast.error('Failed to create Meet link. Connect Google Calendar first.');
    } finally {
      setMeetCreating(false);
    }
  };

  // Text formatting helpers
  const insertFormatting = useCallback((prefix: string, suffix: string = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end);

    const newText = body.substring(0, start) + prefix + selectedText + suffix + body.substring(end);
    setBody(newText);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      } else {
        textarea.setSelectionRange(start + prefix.length, start + prefix.length);
      }
    }, 0);
  }, [body]);

  const handleBold = () => insertFormatting('**');
  const handleItalic = () => insertFormatting('*');
  const handleUnderline = () => insertFormatting('<u>', '</u>');

  const handleLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = body.substring(start, end) || 'link text';

      const linkMarkdown = `[${selectedText}](${url})`;
      const newText = body.substring(0, start) + linkMarkdown + body.substring(end);
      setBody(newText);
    }
  };

  // Handle file attachment
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    const totalSize = [...attachments, ...newFiles].reduce((sum, f) => sum + f.size, 0);

    // Gmail attachment limit is 25MB
    if (totalSize > 25 * 1024 * 1024) {
      toast.error('Total attachment size cannot exceed 25MB');
      return;
    }

    setAttachments(prev => [...prev, ...newFiles]);
    toast.success(`Added ${newFiles.length} attachment(s)`);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Save draft
  const handleSaveDraft = async () => {
    if (!to.trim() && !subject.trim() && !body.trim()) {
      toast.error('Nothing to save');
      return;
    }

    setSavingDraft(true);
    try {
      const gmail = getGmailService();
      const toEmails = parseEmails(to).filter(e => isValidEmail(e));

      await gmail.createDraft({
        to: toEmails.length > 0 ? toEmails : [''],
        cc: cc ? parseEmails(cc).filter(e => isValidEmail(e)) : undefined,
        bcc: bcc ? parseEmails(bcc).filter(e => isValidEmail(e)) : undefined,
        subject: subject || '(No Subject)',
        body,
        isHtml: false,
      });

      toast.success('Draft saved!');
    } catch (error) {
      console.error('Save draft error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  // Schedule send
  const handleScheduleSend = async (scheduledFor: Date) => {
    if (!to.trim()) {
      toast.error('Please enter a recipient');
      setShowScheduleModal(false);
      return;
    }

    const toEmails = parseEmails(to);
    const invalidEmails = toEmails.filter(e => !isValidEmail(e));

    if (invalidEmails.length > 0) {
      toast.error(`Invalid email address: ${invalidEmails[0]}`);
      setShowScheduleModal(false);
      return;
    }

    setScheduling(true);
    try {
      await emailSyncService.scheduleEmail({
        to: toEmails,
        cc: cc ? parseEmails(cc).filter(e => isValidEmail(e)) : undefined,
        bcc: bcc ? parseEmails(bcc).filter(e => isValidEmail(e)) : undefined,
        subject: subject || '(No Subject)',
        body,
        isHtml: false,
        threadId: replyTo?.thread_id,
        scheduledFor,
      });

      const formattedDate = scheduledFor.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const formattedTime = scheduledFor.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });

      toast.success(`Email scheduled for ${formattedDate} at ${formattedTime}`);
      setShowScheduleModal(false);
      onClose();
    } catch (error) {
      console.error('Schedule send error:', error);
      toast.error('Failed to schedule email');
    } finally {
      setScheduling(false);
    }
  };

  // Handle template selection
  const handleSelectTemplate = (template: EmailTemplate) => {
    // If template has variables, show the variables modal
    if (template.variables && template.variables.length > 0) {
      setSelectedTemplate(template);
    } else {
      // Apply directly
      applyTemplateContent(template.subject, template.body);
    }
    setShowTemplatesModal(false);
  };

  // Apply template content to the composer
  const applyTemplateContent = (templateSubject: string | undefined, templateBody: string) => {
    // Set subject if template has one and we don't already have a subject
    if (templateSubject && !subject.trim()) {
      setSubject(templateSubject);
    }

    // Append or replace body content
    if (body.trim()) {
      // Ask if user wants to replace or append
      const shouldReplace = confirm('Replace current content with template? Click Cancel to append instead.');
      if (shouldReplace) {
        setBody(templateBody);
      } else {
        setBody(templateBody + '\n\n' + body);
      }
    } else {
      setBody(templateBody);
    }

    setSelectedTemplate(null);
    toast.success('Template applied');
  };

  // Animation state for slide-in
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation on mount
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // Handle close with animation
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to complete
  };

  // Minimized view - bottom right mini bar
  if (isMinimized) {
    return (
      <div
        className="fixed bottom-4 right-4 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-lg shadow-2xl w-72 z-50 transition-all duration-300 ease-out"
        style={{
          transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
          opacity: isVisible ? 1 : 0
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium text-white truncate flex-1">
            {subject || 'New Message'}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(false)}
              className="w-6 h-6 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
            >
              <i className="fa-solid fa-window-maximize text-xs"></i>
            </button>
            <button
              onClick={handleClose}
              className="w-6 h-6 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-red-400 transition"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Panel width classes based on state
  const getPanelClasses = () => {
    if (isMaximized) {
      // Full screen minus sidebar (64px) and some padding
      return 'w-[calc(100vw-80px)] h-[calc(100vh-32px)] top-4 right-4 rounded-xl';
    }
    // Default: 1/3 screen width, Gmail-style
    return 'w-[480px] h-[600px] bottom-4 right-4 rounded-xl';
  };

  return (
    <>
      {/* Backdrop - only show when maximized */}
      {isMaximized && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
          style={{ opacity: isVisible ? 1 : 0 }}
          onClick={handleClose}
        />
      )}

      {/* Composer Panel */}
      <div
        className={`fixed z-50 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/80 shadow-2xl flex flex-col transition-all duration-300 ease-out ${getPanelClasses()}`}
        style={{
          transform: isVisible
            ? 'translateX(0) scale(1)'
            : 'translateX(100%) scale(0.95)',
          opacity: isVisible ? 1 : 0,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 rounded-t-xl bg-zinc-900/80">
          <span className="text-sm font-semibold text-white">
            {replyTo ? 'Reply' : 'New Message'}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="w-7 h-7 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-all duration-200"
              title="Minimize"
            >
              <i className="fa-solid fa-window-minimize text-xs"></i>
            </button>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="w-7 h-7 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-all duration-200"
              title={isMaximized ? 'Restore' : 'Expand'}
            >
              <i className={`fa-solid ${isMaximized ? 'fa-compress' : 'fa-expand'} text-xs`}></i>
            </button>
            <button
              onClick={handleClose}
              className="w-7 h-7 rounded hover:bg-red-500/20 flex items-center justify-center text-zinc-400 hover:text-red-400 transition-all duration-200"
              title="Close"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Recipients */}
          <div className="px-4 py-2 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500 w-12">To:</span>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Recipients"
                className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-zinc-600"
              />
              <div className="flex items-center gap-2 text-xs">
                {!showCc && (
                  <button
                    onClick={() => setShowCc(true)}
                    className="text-zinc-500 hover:text-white transition"
                  >
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button
                    onClick={() => setShowBcc(true)}
                    className="text-zinc-500 hover:text-white transition"
                  >
                    Bcc
                  </button>
                )}
              </div>
            </div>
          </div>

          {showCc && (
            <div className="px-4 py-2 border-b border-zinc-800/50">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500 w-12">Cc:</span>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="Carbon copy"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-zinc-600"
                />
              </div>
            </div>
          )}

          {showBcc && (
            <div className="px-4 py-2 border-b border-zinc-800/50">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500 w-12">Bcc:</span>
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="Blind carbon copy"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-zinc-600"
                />
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="px-4 py-2 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500 w-12">Subject:</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-zinc-600"
              />
            </div>
          </div>

          {/* AI Assistant Panel */}
          {showAiPanel && (
            <div className="mx-4 mt-3 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30">
              <div className="flex items-center gap-2 text-purple-400 text-sm font-medium mb-3">
                <i className="fa-solid fa-wand-magic-sparkles"></i>
                <span>AI Draft Assistant</span>
                <button
                  onClick={() => setShowAiPanel(false)}
                  className="ml-auto text-zinc-500 hover:text-white"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder='Describe what you want to say, e.g., "confirm meeting attendance", "decline politely"'
                className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />

              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs text-zinc-500">Tone:</span>
                <div className="flex items-center gap-2">
                  {(['professional', 'friendly', 'formal', 'concise'] as ToneType[]).map((tone) => (
                    <button
                      key={tone}
                      onClick={() => setSelectedTone(tone)}
                      className={`text-xs px-3 py-1 rounded-full transition ${
                        selectedTone === tone
                          ? 'bg-purple-500 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {tone.charAt(0).toUpperCase() + tone.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerateAiDraft}
                disabled={aiGenerating || !aiPrompt.trim()}
                className="mt-3 flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-zinc-700 text-white rounded-lg text-sm font-medium transition"
              >
                {aiGenerating ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    Generating...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-magic"></i>
                    Generate Draft
                  </>
                )}
              </button>
            </div>
          )}

          {/* Tone Check Results */}
          {showToneCheck && (
            <div className="mx-4 mt-3 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
              {toneCheckResult ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <i className={`fa-solid ${toneCheckResult.appropriate ? 'fa-circle-check text-green-500' : 'fa-exclamation-triangle text-yellow-500'}`}></i>
                    <span className="text-sm font-medium text-white">
                      {toneCheckResult.appropriate ? 'Tone looks good!' : 'Consider reviewing'}
                    </span>
                    <span className="text-xs text-zinc-500 ml-2">
                      Current tone: {toneCheckResult.currentTone}
                    </span>
                    <button
                      onClick={() => setShowToneCheck(false)}
                      className="ml-auto text-zinc-500 hover:text-white"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>

                  {toneCheckResult.issues.length > 0 && (
                    <div className="text-xs text-orange-400 mt-2">
                      <span className="text-orange-500 font-medium">Issues: </span>
                      {toneCheckResult.issues.join('. ')}
                    </div>
                  )}

                  {toneCheckResult.suggestions.length > 0 && (
                    <div className="text-xs text-zinc-400 mt-2">
                      <span className="text-zinc-500">Suggestions: </span>
                      {toneCheckResult.suggestions.join('. ')}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-zinc-400">
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  <span className="text-sm">Analyzing tone...</span>
                </div>
              )}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-hidden relative">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Compose your email..."
              className="w-full h-full p-4 pr-14 bg-transparent text-white text-sm focus:outline-none resize-none placeholder-zinc-600"
            />
            <div className="absolute right-4 top-4">
              <VoiceTextButton
                onTranscript={(text) => setBody(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text)}
                size="sm"
                className="bg-zinc-800 hover:bg-zinc-700"
              />
            </div>
          </div>

          {/* Attachments display */}
          {attachments.length > 0 && (
            <div className="px-4 py-2 border-t border-zinc-800/50">
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-1.5 text-sm"
                  >
                    <i className="fa-solid fa-paperclip text-zinc-500"></i>
                    <span className="text-zinc-300 max-w-[150px] truncate">{file.name}</span>
                    <span className="text-zinc-500 text-xs">
                      ({(file.size / 1024).toFixed(0)}KB)
                    </span>
                    <button
                      onClick={() => removeAttachment(index)}
                      className="text-zinc-500 hover:text-red-500 transition ml-1"
                    >
                      <i className="fa-solid fa-xmark text-xs"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {confidentialEnabled && (
            <div className="px-4 py-3 border-t border-zinc-800/50 bg-zinc-950/40">
              <div className="text-xs text-zinc-400 uppercase tracking-wide mb-2">Confidential Mode</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Expiration</label>
                  <input
                    type="datetime-local"
                    value={confidentialExpiresAt}
                    onChange={(e) => setConfidentialExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm text-zinc-400 mt-6">
                    <input
                      type="checkbox"
                      checked={confidentialRequirePasscode}
                      onChange={(e) => setConfidentialRequirePasscode(e.target.checked)}
                    />
                    Require passcode
                  </label>
                  {confidentialRequirePasscode && (
                    <input
                      type="password"
                      value={confidentialPasscode}
                      onChange={(e) => setConfidentialPasscode(e.target.value)}
                      placeholder="Enter passcode"
                      className="mt-2 w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200"
                    />
                  )}
                </div>
                <div className="md:col-span-2 flex flex-wrap gap-4 text-xs text-zinc-400">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={confidentialDisableForward}
                      onChange={(e) => setConfidentialDisableForward(e.target.checked)}
                    />
                    Disable forward
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={confidentialDisableCopy}
                      onChange={(e) => setConfidentialDisableCopy(e.target.checked)}
                    />
                    Disable copy
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={confidentialDisablePrint}
                      onChange={(e) => setConfidentialDisablePrint(e.target.checked)}
                    />
                    Disable print
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={confidentialDisableDownload}
                      onChange={(e) => setConfidentialDisableDownload(e.target.checked)}
                    />
                    Disable download
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={sending}
                className="bg-red-500 hover:bg-red-600 disabled:bg-zinc-700 text-white px-6 py-2 rounded-lg font-bold text-sm uppercase tracking-wider transition-all flex items-center gap-2"
              >
                {sending ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i>
                    Send
                  </>
                )}
              </button>

              {/* Schedule send dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowScheduleModal(!showScheduleModal)}
                  disabled={scheduling}
                  className="w-8 h-8 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-blue-400 transition"
                  title="Schedule send"
                >
                  {scheduling ? (
                    <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                  ) : (
                    <i className="fa-solid fa-clock"></i>
                  )}
                </button>
                {showScheduleModal && (
                  <ScheduleSendModal
                    onSchedule={handleScheduleSend}
                    onClose={() => setShowScheduleModal(false)}
                  />
                )}
              </div>

              <button
                onClick={() => setConfidentialEnabled(!confidentialEnabled)}
                className={`w-8 h-8 rounded flex items-center justify-center transition ${
                  confidentialEnabled ? 'bg-red-500/20 text-red-400' : 'hover:bg-zinc-800 text-zinc-500 hover:text-red-400'
                }`}
                title="Confidential mode"
              >
                <i className="fa-solid fa-lock text-xs"></i>
              </button>

              {/* Formatting toolbar */}
              <div className="flex items-center gap-1 ml-2 border-l border-zinc-800 pl-2">
                <button
                  onClick={handleInsertMeetLink}
                  disabled={meetCreating}
                  className="w-8 h-8 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-emerald-400 transition disabled:opacity-50"
                  title="Insert Google Meet link"
                >
                  {meetCreating ? (
                    <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                  ) : (
                    <i className="fa-solid fa-video text-xs"></i>
                  )}
                </button>
                <button
                  onClick={handleBold}
                  className="w-8 h-8 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition"
                  title="Bold (**text**)"
                >
                  <i className="fa-solid fa-bold text-xs"></i>
                </button>
                <button
                  onClick={handleItalic}
                  className="w-8 h-8 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition"
                  title="Italic (*text*)"
                >
                  <i className="fa-solid fa-italic text-xs"></i>
                </button>
                <button
                  onClick={handleUnderline}
                  className="w-8 h-8 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition"
                  title="Underline"
                >
                  <i className="fa-solid fa-underline text-xs"></i>
                </button>
                <button
                  onClick={handleLink}
                  className="w-8 h-8 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition"
                  title="Insert link"
                >
                  <i className="fa-solid fa-link text-xs"></i>
                </button>
                {driveQuickAttach && (
                  <button
                    onClick={handleOpenDrive}
                    className="w-8 h-8 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-emerald-400 transition"
                    title="Attach from Drive"
                  >
                    <i className="fa-brands fa-google-drive text-xs"></i>
                  </button>
                )}
              </div>

              {/* AI features */}
              <div className="flex items-center gap-1 ml-2 border-l border-zinc-800 pl-2">
                <button
                  onClick={handleSmartCompose}
                  disabled={smartComposeLoading || !smartComposeEnabled}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-white transition disabled:opacity-50"
                  title={smartComposeEnabled ? 'Smart Compose suggestion' : 'Enable Smart Compose in Settings'}
                >
                  {smartComposeLoading ? (
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                  ) : (
                    <i className="fa-solid fa-pen"></i>
                  )}
                  Smart
                </button>
                <button
                  onClick={() => setShowAiPanel(!showAiPanel)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    showAiPanel
                      ? 'bg-purple-500 text-white'
                      : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                  }`}
                  title="AI Draft Assistant"
                >
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  AI Draft
                </button>

                {/* Enhancement tools dropdown */}
                <div className="relative group">
                  <button
                    disabled={enhancing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-white transition disabled:opacity-50"
                    title="Enhance email with AI"
                  >
                    {enhancing ? (
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                    ) : (
                      <i className="fa-solid fa-pen-fancy"></i>
                    )}
                    Enhance
                    <i className="fa-solid fa-chevron-down text-[10px] ml-0.5"></i>
                  </button>
                  <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-20">
                    <div className="bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 py-1 text-xs min-w-[140px]">
                      <button
                        onClick={() => handleEnhanceEmail('shorten')}
                        className="w-full px-3 py-2 text-left text-zinc-300 hover:bg-zinc-700 hover:text-white flex items-center gap-2"
                      >
                        <i className="fa-solid fa-compress w-4"></i>
                        Shorten
                      </button>
                      <button
                        onClick={() => handleEnhanceEmail('elaborate')}
                        className="w-full px-3 py-2 text-left text-zinc-300 hover:bg-zinc-700 hover:text-white flex items-center gap-2"
                      >
                        <i className="fa-solid fa-expand w-4"></i>
                        Elaborate
                      </button>
                      <button
                        onClick={() => handleEnhanceEmail('formalize')}
                        className="w-full px-3 py-2 text-left text-zinc-300 hover:bg-zinc-700 hover:text-white flex items-center gap-2"
                      >
                        <i className="fa-solid fa-user-tie w-4"></i>
                        Make Formal
                      </button>
                      <button
                        onClick={() => handleEnhanceEmail('casualize')}
                        className="w-full px-3 py-2 text-left text-zinc-300 hover:bg-zinc-700 hover:text-white flex items-center gap-2"
                      >
                        <i className="fa-solid fa-face-smile w-4"></i>
                        Make Casual
                      </button>
                      <div className="border-t border-zinc-700 my-1"></div>
                      <button
                        onClick={() => handleEnhanceEmail('fix_grammar')}
                        className="w-full px-3 py-2 text-left text-zinc-300 hover:bg-zinc-700 hover:text-white flex items-center gap-2"
                      >
                        <i className="fa-solid fa-spell-check w-4"></i>
                        Fix Grammar
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleToneCheck}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-white transition"
                  title="Check tone before sending"
                >
                  <i className="fa-solid fa-gauge"></i>
                  Tone Check
                </button>

                {/* Templates button */}
                <button
                  onClick={() => setShowTemplatesModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition"
                  title="Use email template"
                >
                  <i className="fa-solid fa-file-lines"></i>
                  Templates
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition relative"
                title="Attach file (max 25MB total)"
              >
                <i className="fa-solid fa-paperclip"></i>
                {attachments.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {attachments.length}
                  </span>
                )}
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="w-8 h-8 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition disabled:opacity-50"
                title="Save draft"
              >
                {savingDraft ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                ) : (
                  <i className="fa-solid fa-floppy-disk"></i>
                )}
              </button>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded hover:bg-red-500/20 flex items-center justify-center text-zinc-500 hover:text-red-500 transition"
                title="Discard"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Templates Modal */}
      {showTemplatesModal && (
        <TemplatesModal
          onSelectTemplate={handleSelectTemplate}
          onClose={() => setShowTemplatesModal(false)}
        />
      )}

      {/* Template Variables Modal */}
      {selectedTemplate && (
        <TemplateVariablesModal
          template={selectedTemplate}
          onApply={applyTemplateContent}
          onClose={() => setSelectedTemplate(null)}
        />
      )}
    </>
  );
};

export default EmailComposerModal;
