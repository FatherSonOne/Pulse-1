// EmailComposerModal.tsx — Focal Canvas + Sidecar composer
//
// Two views from a single component, switched by `isMaximized`:
//   • Focal Canvas (full-page): new messages, forwards, expanded replies.
//     Editorial serif subject, two-column layout with AI rail on right.
//   • Sidecar (slide-out): default reply view. Opaque slide-in from right;
//     no backdrop so the source thread stays readable behind it.
//
// Locked spec: _design-playground/email-composer-final.html (2026-05-28).
// Handoff: docs/email-composer-redesign.md.
//
// Every state, handler, and useEffect from the pre-redesign composer is
// preserved verbatim. The rewrite is visual + structural only.
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
import { useAIErrorHandler } from '../../hooks/useAIErrorHandler';
import toast from 'react-hot-toast';
import './email-composer.css';

import { Bold, Check, ChevronDown, Clock, FileText, Gauge, HardDrive, Italic, Link, Loader2, Lock, Maximize2, Minimize2, Minus, Paperclip, Plus, RotateCcw, Save, Send, Smile, SpellCheck, Trash2, Type, Underline, UserCog, Video, Wand2, X } from 'lucide-react';

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

  // AI-router error handler (cap exceeded / provider down → toast + CTA)
  const handleAIError = useAIErrorHandler();

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
  // Default new messages + forwards + undo-restored drafts to fullscreen
  // (no replyTo means we're starting from a blank-ish slate); replies +
  // reply-all open in the smaller bottom-right panel because the user is
  // mid-conversation and probably wants the original visible behind.
  const [isMaximized, setIsMaximized] = useState(!replyTo);

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

  // Sidecar-only "Suggested reply" card flow. When a draft is generated
  // from the Sidecar (replyTo present), the result lands here for review
  // instead of being inserted directly into body — Accept commits it,
  // Edit-first commits then dismisses, Regenerate re-runs the prompt.
  // Focal Canvas continues to insert directly into body (the AI rail
  // there owns the same role visually).
  const [pendingAiDraft, setPendingAiDraft] = useState<string | null>(null);
  const [aiDraftAccepted, setAiDraftAccepted] = useState(false);

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

  // Pre-send guards (inline, never modal)
  const [missingAttachmentWarning, setMissingAttachmentWarning] = useState(false);

  // Draft persistence (localStorage, debounced 800ms)
  const DRAFT_KEY = 'pulse-email-composer-draft';
  const isInitialMountRef = useRef(true);
  const [restoredDraft, setRestoredDraft] = useState<{ savedAt: number } | null>(null);
  // Live autosave readout for the header — set by the debounced save
  // effect below. Renders as the spec's inline `DRAFT · SAVED HH:MM`
  // indicator next to NEW MESSAGE.
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // Restore draft on first mount (only if composer is opening fresh, no replyTo / restored params)
  useEffect(() => {
    if (!isInitialMountRef.current) return;
    isInitialMountRef.current = false;
    if (replyTo || initialTo || initialSubject) return; // not a blank compose
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || (!draft.body && !draft.subject && !draft.to)) return;
      setRestoredDraft({ savedAt: draft.savedAt ?? Date.now() });
    } catch { /* corrupt JSON; ignore */ }
  }, []);

  const applyRestoredDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) { setRestoredDraft(null); return; }
      const draft = JSON.parse(raw);
      if (draft.to) setTo(draft.to);
      if (draft.cc) { setCc(draft.cc); setShowCc(true); }
      if (draft.bcc) { setBcc(draft.bcc); setShowBcc(true); }
      if (draft.subject) setSubject(draft.subject);
      if (typeof draft.body === 'string') setBody(draft.body);
    } catch { /* ignore */ }
    setRestoredDraft(null);
  };

  const dismissRestoredDraft = () => {
    setRestoredDraft(null);
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  };

  // Auto-save draft on change (debounced 800ms). Skips empty drafts and non-blank composes.
  useEffect(() => {
    if (replyTo || initialTo || initialSubject) return;
    const hasContent = Boolean(to.trim() || subject.trim() || body.trim() || cc.trim() || bcc.trim());
    if (!hasContent) return;
    const timer = setTimeout(() => {
      const savedAt = Date.now();
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          to, cc, bcc, subject, body, savedAt,
        }));
        setLastSavedAt(savedAt);
      } catch { /* quota or unavailable */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [to, cc, bcc, subject, body, replyTo, initialTo, initialSubject]);

  // Dismiss the restored-draft prompt the moment the user types real
  // content in this new composer. The prior draft was a passive "want
  // to recover?" offer; if the user is actively writing instead, the
  // prompt should disappear so it stops competing with the autosave
  // readout in the header. The autosave loop above will overwrite the
  // localStorage slot on the next debounce, which is the implicit "I
  // chose to write fresh" outcome.
  useEffect(() => {
    if (!restoredDraft) return;
    const hasUserContent = Boolean(to.trim() || subject.trim() || body.trim() || cc.trim() || bcc.trim());
    if (hasUserContent) setRestoredDraft(null);
  }, [restoredDraft, to, cc, bcc, subject, body]);

  // Schedule send state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  // Templates state
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);

  // Action bar popovers (round 5 — Format ▾ and Insert ▾ collapse the
  // round-1 13-button toolbar to ~8 controls). Click-outside closes both;
  // mousedown-preventDefault on the inner items keeps the body textarea's
  // selection alive so insertFormatting() can still target the cursor
  // position when Format actions run.
  const [showFormatPopover, setShowFormatPopover] = useState(false);
  const [showInsertPopover, setShowInsertPopover] = useState(false);
  const formatPopoverRef = useRef<HTMLDivElement>(null);
  const insertPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showFormatPopover && !showInsertPopover) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showFormatPopover && formatPopoverRef.current && !formatPopoverRef.current.contains(target)) {
        setShowFormatPopover(false);
      }
      if (showInsertPopover && insertPopoverRef.current && !insertPopoverRef.current.contains(target)) {
        setShowInsertPopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFormatPopover, showInsertPopover]);
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

    // Attachment-keyword guard: body mentions attachment, none attached. Inline warning, not modal.
    const mentionsAttachment = /\b(attach(ed|ment|ing)?|enclosed|see\s+attached|please\s+find)\b/i.test(body);
    if (mentionsAttachment && attachments.length === 0 && !missingAttachmentWarning) {
      setMissingAttachmentWarning(true);
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
      // Successful send: clear persisted draft.
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
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

      if (isMaximized) {
        // Focal Canvas — direct insert into body. The AI rail's coral
        // "Draft for me" card IS the provenance UI here.
        const quotedReply = replyTo
          ? `\n\n---\nOn ${new Date(replyTo.received_at).toLocaleString()}, ${replyTo.from_name || replyTo.from_email} wrote:\n\n${replyTo.body_text}`
          : '';
        setBody(draft + quotedReply);
        setShowAiPanel(false);
        setAiPrompt('');
        toast.success('Draft generated!');
      } else {
        // Sidecar — hold in pending state so the user can review the
        // suggested-reply card before it touches the body. aiPrompt is
        // preserved so Regenerate can re-run the same intent.
        setPendingAiDraft(draft);
        setAiDraftAccepted(false);
        setShowAiPanel(false);
        toast.success('Draft ready. Review below.');
      }
    } catch (error) {
      console.error('Draft generation error:', error);
      if (!handleAIError(error)) {
        toast.error('Failed to generate draft');
      }
    } finally {
      setAiGenerating(false);
    }
  };

  // Suggested-reply card action handlers (Sidecar only). Accept commits the
  // pending draft into body and shows the "Accepted draft" pill; Edit-first
  // commits and immediately dismisses the card to let the user edit freely;
  // Reopen brings the pre-accept card back; Discard clears everything.
  const acceptPendingAiDraft = () => {
    if (!pendingAiDraft) return;
    const quotedReply = replyTo
      ? `\n\n---\nOn ${new Date(replyTo.received_at).toLocaleString()}, ${replyTo.from_name || replyTo.from_email} wrote:\n\n${replyTo.body_text}`
      : '';
    setBody(pendingAiDraft + quotedReply);
    setAiDraftAccepted(true);
  };

  const editPendingAiDraft = () => {
    if (!pendingAiDraft) return;
    const quotedReply = replyTo
      ? `\n\n---\nOn ${new Date(replyTo.received_at).toLocaleString()}, ${replyTo.from_name || replyTo.from_email} wrote:\n\n${replyTo.body_text}`
      : '';
    setBody(pendingAiDraft + quotedReply);
    setPendingAiDraft(null);
    setAiDraftAccepted(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const reopenPendingAiDraft = () => {
    setAiDraftAccepted(false);
  };

  const discardPendingAiDraft = () => {
    setPendingAiDraft(null);
    setAiDraftAccepted(false);
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
      setShowToneCheck(false);
      if (!handleAIError(error)) {
        toast.error('Failed to check tone');
      }
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
      if (!handleAIError(error)) {
        toast.error('Failed to enhance email');
      }
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
    setMissingAttachmentWarning(false);
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

  // Minimized view — collapsed bottom-right bar with subject + restore/close.
  if (isMinimized) {
    return (
      <div
        className="composer-minimized"
        style={{
          transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
          opacity: isVisible ? 1 : 0,
          transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease',
        }}
      >
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--pulse-ink)' }} className="truncate">
          {subject || 'New Message'}
        </span>
        <button
          onClick={() => setIsMinimized(false)}
          className="composer-icon-btn"
          title="Restore"
          aria-label="Restore composer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleClose}
          className="composer-icon-btn"
          title="Close"
          aria-label="Close composer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Recipient summary line for the header (compressed format mirrors
  // TriageCard). Falls back to null on a blank new compose — the spec's
  // inline DRAFT · SAVED HH:MM autosave readout above already conveys
  // the drafting state, so a "Drafting…" placeholder would be redundant.
  const recipientList = parseEmails(to);
  const recipientSummary: string | null = recipientList.length === 0
    ? (replyTo ? `to ${replyTo.from_name || replyTo.from_email}` : null)
    : recipientList.length === 1
      ? `to ${recipientList[0]}`
      : `to ${recipientList[0]} +${recipientList.length - 1} other${recipientList.length > 2 ? 's' : ''}`;

  const isReplying = !!replyTo;
  const headerLabel = isReplying
    ? (isMaximized ? 'REPLY · FULLSCREEN' : 'REPLYING · IN CONTEXT')
    : 'NEW MESSAGE';

  return (
    <>
      {/* Focal Canvas mounts an opaque dimmed backdrop; Sidecar mounts a
          transparent no-pointer-events scrim so the source thread stays
          visible AND clickable behind the slide-out. */}
      {isMaximized ? (
        <div
          className="composer-focal-backdrop"
          onClick={handleClose}
          style={{ opacity: isVisible ? 1 : 0 }}
        />
      ) : (
        <div className="composer-sidecar-backdrop" aria-hidden="true" />
      )}

      <div
        className={isMaximized ? 'composer-focal' : 'composer-sidecar'}
        role="dialog"
        aria-modal={isMaximized}
        aria-label={replyTo ? `Reply to ${replyTo.from_name || replyTo.from_email}` : 'Compose email'}
        style={{ opacity: isVisible ? 1 : 0, transition: 'opacity 240ms ease' }}
      >
        {/* Header — editorial label + autosave readout + recipient summary +
            minimize/maximize/close. Matches the locked playground spec
            (_design-playground/email-composer-final.html:760-771): pen-rose
            icon, NEW MESSAGE label, inline DRAFT · SAVED HH:MM autosave
            indicator, then a quiet recipient summary. */}
        <div className={isMaximized ? 'composer-focal-header' : 'composer-sidecar-header'}>
          <Wand2 className="w-4 h-4" style={{ color: 'var(--pulse-rose)', flexShrink: 0 }} aria-hidden />
          <span className="composer-mono-label" style={{ color: 'var(--pulse-rose)' }}>
            {headerLabel}
          </span>
          {lastSavedAt !== null && (
            <span
              className="composer-mono-label"
              style={{ color: 'var(--pulse-ink-3)', marginLeft: 4 }}
              title="Last autosave"
            >
              DRAFT · SAVED {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {recipientSummary && (
            <>
              <span style={{ fontSize: 11, color: 'var(--pulse-ink-3)' }} aria-hidden>·</span>
              <span style={{ fontSize: 11, color: 'var(--pulse-ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {recipientSummary}
              </span>
            </>
          )}

          <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => setIsMinimized(true)}
              className="composer-icon-btn"
              title="Minimize"
              aria-label="Minimize composer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="composer-icon-btn"
              title={isMaximized ? 'Restore to sidecar' : 'Expand to fullscreen'}
              aria-label={isMaximized ? 'Restore to sidecar' : 'Expand to fullscreen'}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleClose}
              className="composer-icon-btn"
              title="Close (Esc)"
              aria-label="Close composer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Restored-draft strip — shown only on first mount when a saved draft exists */}
        {restoredDraft && (
          <div className="composer-restored-strip">
            <Save className="w-3.5 h-3.5" style={{ color: 'var(--pulse-rose)', flexShrink: 0 }} aria-hidden />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="composer-mono-label" style={{ color: 'var(--pulse-rose)' }}>
                Draft · Saved {new Date(restoredDraft.savedAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
              </div>
            </div>
            <button
              onClick={applyRestoredDraft}
              className="composer-send-pill"
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              Restore
            </button>
            <button
              onClick={dismissRestoredDraft}
              className="composer-quiet-btn"
              style={{ padding: '6px 10px', fontSize: 12 }}
            >
              Discard
            </button>
          </div>
        )}

        {/* Body region — Focal Canvas (two-column with AI rail) vs Sidecar
            (single-column). Both share the same state/handlers so switching
            isMaximized mid-compose preserves every field. */}
        {isMaximized ? (
          <div className="composer-focal-body">
            {/* Editorial canvas */}
            <div className="composer-focal-canvas">
              <div className="composer-focal-canvas-inner">
                <div className="composer-field-row">
                  <span className="composer-field-label">To</span>
                  <input
                    type="text"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="Recipients (comma-separated)"
                    className="composer-field-input"
                    aria-label="To"
                  />
                  <div style={{ display: 'inline-flex', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
                    {!showCc && <button onClick={() => setShowCc(true)} className="composer-quiet-btn">Cc</button>}
                    {!showBcc && <button onClick={() => setShowBcc(true)} className="composer-quiet-btn">Bcc</button>}
                  </div>
                </div>
                {showCc && (
                  <div className="composer-field-row">
                    <span className="composer-field-label">Cc</span>
                    <input type="text" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Carbon copy" className="composer-field-input" aria-label="Cc" />
                  </div>
                )}
                {showBcc && (
                  <div className="composer-field-row">
                    <span className="composer-field-label">Bcc</span>
                    <input type="text" value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="Blind carbon copy" className="composer-field-input" aria-label="Bcc" />
                  </div>
                )}

                <div style={{ marginTop: 24, marginBottom: 12 }}>
                  <div className="composer-mono-label" style={{ marginBottom: 8 }}>SUBJECT</div>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="What's this about?"
                    className="composer-editorial-subject"
                    aria-label="Subject"
                  />
                </div>

                <div style={{ position: 'relative', marginTop: 16 }}>
                  <textarea
                    ref={textareaRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={replyTo ? `Reply to ${replyTo.from_name || replyTo.from_email}…` : 'Compose your email…'}
                    className="composer-body"
                    rows={14}
                    style={{ minHeight: 280, paddingRight: 56 }}
                  />
                  <div style={{ position: 'absolute', top: 4, right: 4 }}>
                    <VoiceTextButton
                      onTranscript={(text) => setBody(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text)}
                      size="sm"
                    />
                  </div>
                </div>

                {replyTo && (
                  <details style={{ marginTop: 32 }}>
                    <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }} className="composer-mono-label">
                      <ChevronDown className="w-3 h-3" />
                      <span>SHOW QUOTED REPLY</span>
                    </summary>
                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--pulse-canvas-soft)', borderRadius: 8, fontSize: 13, fontStyle: 'italic', color: 'var(--pulse-ink-2)', whiteSpace: 'pre-wrap' }}>
                      On {new Date(replyTo.received_at).toLocaleString()}, {replyTo.from_name || replyTo.from_email} wrote:
                      {'\n\n'}
                      {(replyTo.body_text || '').slice(0, 1500)}{(replyTo.body_text || '').length > 1500 ? '…' : ''}
                    </div>
                  </details>
                )}
              </div>
            </div>

            {/* AI rail — coral cluster + neutral helpers. Calls the existing
                handleGenerateAiDraft / handleEnhanceEmail / handleToneCheck /
                handleSmartCompose handlers verbatim. */}
            <aside className="composer-focal-rail">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Wand2 className="w-4 h-4" style={{ color: 'var(--pulse-rose)' }} aria-hidden />
                <span className="composer-mono-label" style={{ color: 'var(--pulse-rose)' }}>PULSE AI · ASSIST</span>
              </div>

              {/* Card 1 — Draft (helps you write: from scratch via prompt OR
                  inline completion via Smart Compose). Card had a decorative
                  coral gradient background pre-round-5; gradient dropped to
                  honor coral-as-signal; the rose-tinted border still earns
                  the .coral class by signaling "this is the AI surface." */}
              <div className="composer-rail-card coral">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="composer-rail-card-title">Draft</span>
                  <span className="composer-keycap">⌘J</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--pulse-ink-2)', lineHeight: 1.5, marginBottom: 12 }}>
                  Describe what to say. Claude drafts in your voice using {replyTo ? 'this thread' : 'recipient and calendar context'}.
                </div>
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. accept, push back on timeline, ask for a call…"
                  className="composer-rail-prompt"
                  aria-label="AI draft intent"
                />
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {(['professional','friendly','formal','concise'] as ToneType[]).map(tone => (
                    <button
                      key={tone}
                      onClick={() => setSelectedTone(tone)}
                      className={`composer-tone-pill ${selectedTone === tone ? 'is-active' : ''}`}
                    >
                      {tone.charAt(0).toUpperCase() + tone.slice(1)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleGenerateAiDraft}
                  disabled={aiGenerating || !aiPrompt.trim()}
                  className="composer-send-pill"
                  style={{ marginTop: 12, width: '100%', justifyContent: 'center', padding: '8px 14px', fontSize: 12.5 }}
                >
                  {aiGenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating…</> : <><Wand2 className="w-3.5 h-3.5" />Generate draft</>}
                </button>

                {/* Smart Compose — was its own card in the 4-card layout
                    (round 1-4). Merged here in round 5 because it's the
                    "continuing what you've started" sibling of "drafting
                    from scratch": same job (AI helps you write), different
                    starting point. Demoted to a quiet secondary action so
                    Generate draft stays the card's primary surface. */}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--pulse-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <button onClick={handleSmartCompose} disabled={smartComposeLoading || !smartComposeEnabled} className="composer-quiet-btn" style={{ padding: '4px 8px', fontSize: 11.5 }}>
                    {smartComposeLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Suggest inline
                  </button>
                  <span className="composer-mono-label" style={{ fontSize: 10 }}>{smartComposeEnabled ? 'ON' : 'OFF'}</span>
                </div>
              </div>

              {/* Card 2 — Refine (looks at what you wrote: transform via
                  Enhance actions, evaluate via Tone check). Was two cards
                  in the 4-card layout; merged in round 5 because both jobs
                  start from "you have a draft" and end with "Claude
                  responds to it." */}
              <div className="composer-rail-card">
                <div style={{ marginBottom: 8 }}>
                  <span className="composer-rail-card-title">Refine</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button onClick={() => handleEnhanceEmail('shorten')}     disabled={enhancing} className="composer-rail-action">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Minimize2 className="w-3.5 h-3.5" />Shorten</span>
                    <span className="meta">⌘1</span>
                  </button>
                  <button onClick={() => handleEnhanceEmail('elaborate')}   disabled={enhancing} className="composer-rail-action">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Maximize2 className="w-3.5 h-3.5" />Elaborate</span>
                    <span className="meta">⌘2</span>
                  </button>
                  <button onClick={() => handleEnhanceEmail('formalize')}   disabled={enhancing} className="composer-rail-action">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><UserCog className="w-3.5 h-3.5" />Make formal</span>
                    <span className="meta">⌘3</span>
                  </button>
                  <button onClick={() => handleEnhanceEmail('casualize')}   disabled={enhancing} className="composer-rail-action">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Smile className="w-3.5 h-3.5" />Make casual</span>
                    <span className="meta">⌘4</span>
                  </button>
                  <button onClick={() => handleEnhanceEmail('fix_grammar')} disabled={enhancing} className="composer-rail-action">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><SpellCheck className="w-3.5 h-3.5" />Fix grammar</span>
                    <span className="meta">⌘G</span>
                  </button>
                  {enhancing && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--pulse-ink-3)', fontSize: 11, padding: '4px 10px' }}>
                      <Loader2 className="w-3 h-3 animate-spin" /> Working…
                    </div>
                  )}
                </div>

                {/* Tone check — was its own card; folded in here as a
                    "second movement" of Refine: same input (existing
                    draft), different output (analysis vs transformation). */}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--pulse-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--pulse-ink)', fontWeight: 500 }}>Tone check</span>
                    {toneCheckResult && (
                      <span className={`composer-ai-chip ${toneCheckResult.appropriate ? 'positive' : 'muted'}`}>
                        {toneCheckResult.currentTone}
                      </span>
                    )}
                  </div>
                  {showToneCheck && !toneCheckResult ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--pulse-ink-2)', fontSize: 12.5, marginBottom: 8 }}>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing tone…
                    </div>
                  ) : toneCheckResult ? (
                    <div style={{ fontSize: 12.5, color: 'var(--pulse-ink-2)', lineHeight: 1.55, marginBottom: 8 }}>
                      {toneCheckResult.appropriate ? 'Reads naturally for the recipient context.' : 'Consider reviewing.'}
                      {toneCheckResult.issues.length > 0 && (
                        <div style={{ marginTop: 6, color: 'var(--pulse-tone-warning)' }}>{toneCheckResult.issues.join('. ')}</div>
                      )}
                      {toneCheckResult.suggestions.length > 0 && (
                        <div style={{ marginTop: 6, color: 'var(--pulse-ink-3)' }}>{toneCheckResult.suggestions.join('. ')}</div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--pulse-ink-3)', lineHeight: 1.5, marginBottom: 8 }}>
                      Claude flags presumptive or curt phrasing before you send.
                    </div>
                  )}
                  <button onClick={handleToneCheck} className="composer-quiet-btn" style={{ padding: '6px 10px', fontSize: 12 }}>
                    <Gauge className="w-3.5 h-3.5" />{toneCheckResult ? 'Re-check' : 'Run tone check'}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          /* Sidecar: stacked fields + body. AI/Tone panels appear inline above
              the action bar when toggled from the toolbar. Suggested-reply
              card sits between the chrome and fields when a draft is pending
              (Sidecar-only — Focal's rail "Draft for me" card is the
              equivalent provenance UI there). */
          <>
            {pendingAiDraft && !aiDraftAccepted && (
              <div className="composer-ai-panel" role="region" aria-label="Suggested reply">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className="composer-ai-chip">SUGGESTED REPLY</span>
                  <span style={{ fontSize: 11, color: 'var(--pulse-ink-3)' }}>
                    {replyTo ? `based on ${replyTo.from_name || replyTo.from_email}'s note` : 'based on your prompt'}
                  </span>
                  <button onClick={discardPendingAiDraft} className="composer-icon-btn" style={{ marginLeft: 'auto', width: 24, height: 24 }} aria-label="Discard suggestion">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--pulse-ink)', lineHeight: 1.55, fontStyle: 'italic', whiteSpace: 'pre-wrap', marginBottom: 12 }}>
                  {pendingAiDraft}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={acceptPendingAiDraft} className="composer-send-pill" style={{ padding: '6px 12px', fontSize: 12 }}>
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept</span>
                  </button>
                  <button onClick={editPendingAiDraft} className="composer-quiet-btn" style={{ padding: '6px 10px', fontSize: 12 }}>
                    Edit first
                  </button>
                  <button
                    onClick={handleGenerateAiDraft}
                    disabled={aiGenerating || !aiPrompt.trim()}
                    className="composer-quiet-btn"
                    style={{ padding: '6px 10px', fontSize: 12 }}
                    title={aiPrompt.trim() ? 'Regenerate with the same prompt' : 'Open AI panel to enter a new prompt'}
                  >
                    {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>Regenerate</span>
                  </button>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--pulse-ink-3)', fontFamily: 'var(--pulse-font-mono)', letterSpacing: '0.08em' }}>⌘J</span>
                </div>
              </div>
            )}

            <div className="composer-sidecar-fields">
              <div className="composer-field-row">
                <span className="composer-field-label">To</span>
                <input
                  type="text"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="Recipients"
                  className="composer-field-input"
                  aria-label="To"
                />
                <div style={{ display: 'inline-flex', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
                  {!showCc && <button onClick={() => setShowCc(true)} className="composer-quiet-btn" style={{ padding: '5px 8px' }}>Cc</button>}
                  {!showBcc && <button onClick={() => setShowBcc(true)} className="composer-quiet-btn" style={{ padding: '5px 8px' }}>Bcc</button>}
                </div>
              </div>
              {showCc && (
                <div className="composer-field-row">
                  <span className="composer-field-label">Cc</span>
                  <input type="text" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Carbon copy" className="composer-field-input" aria-label="Cc" />
                </div>
              )}
              {showBcc && (
                <div className="composer-field-row">
                  <span className="composer-field-label">Bcc</span>
                  <input type="text" value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="Blind carbon copy" className="composer-field-input" aria-label="Bcc" />
                </div>
              )}
              <div className="composer-field-row">
                <span className="composer-field-label">{replyTo ? 'Re' : 'Sub'}</span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="composer-field-input"
                  aria-label="Subject"
                />
              </div>
            </div>

            <div className="composer-sidecar-body">
              {pendingAiDraft && aiDraftAccepted && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span className="composer-ai-chip positive">ACCEPTED DRAFT</span>
                  <span style={{ fontSize: 11, color: 'var(--pulse-ink-3)' }}>edit freely below</span>
                  <button onClick={reopenPendingAiDraft} className="composer-quiet-btn" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 11 }}>
                    Reopen suggestion
                  </button>
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={replyTo ? `Reply to ${replyTo.from_name || replyTo.from_email}…` : 'Compose your email…'}
                className="composer-body"
                rows={10}
                style={{ minHeight: 200 }}
              />
              <div style={{ marginTop: 8 }}>
                <VoiceTextButton
                  onTranscript={(text) => setBody(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text)}
                  size="sm"
                />
              </div>
            </div>

            {/* Sidecar AI-draft inline panel — popped from toolbar's Wand2 button */}
            {showAiPanel && (
              <div className="composer-ai-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className="composer-ai-chip">DRAFT FOR ME</span>
                  <span style={{ fontSize: 11, color: 'var(--pulse-ink-3)' }}>tone-aware, in your voice</span>
                  <button onClick={() => setShowAiPanel(false)} className="composer-icon-btn" style={{ marginLeft: 'auto', width: 24, height: 24 }} aria-label="Close AI panel">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe what to say…"
                  className="composer-rail-prompt"
                  aria-label="AI draft intent"
                />
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {(['professional','friendly','formal','concise'] as ToneType[]).map(tone => (
                    <button
                      key={tone}
                      onClick={() => setSelectedTone(tone)}
                      className={`composer-tone-pill ${selectedTone === tone ? 'is-active' : ''}`}
                    >
                      {tone.charAt(0).toUpperCase() + tone.slice(1)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleGenerateAiDraft}
                  disabled={aiGenerating || !aiPrompt.trim()}
                  className="composer-send-pill"
                  style={{ marginTop: 10, padding: '7px 12px', fontSize: 12.5 }}
                >
                  {aiGenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating…</> : <><Wand2 className="w-3.5 h-3.5" />Generate draft</>}
                </button>
              </div>
            )}

            {/* Sidecar tone-check inline panel */}
            {showToneCheck && (
              <div className="composer-tone-panel">
                {toneCheckResult ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span className={`composer-ai-chip ${toneCheckResult.appropriate ? 'positive' : 'muted'}`}>
                        {toneCheckResult.appropriate ? 'TONE OK' : 'REVIEW'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--pulse-ink-3)' }}>Current: {toneCheckResult.currentTone}</span>
                      <button onClick={() => setShowToneCheck(false)} className="composer-icon-btn" style={{ marginLeft: 'auto', width: 24, height: 24 }} aria-label="Close tone check">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {toneCheckResult.issues.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--pulse-tone-warning)', marginTop: 4 }}>{toneCheckResult.issues.join('. ')}</div>
                    )}
                    {toneCheckResult.suggestions.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--pulse-ink-3)', marginTop: 4 }}>{toneCheckResult.suggestions.join('. ')}</div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--pulse-ink-2)', fontSize: 12.5 }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing tone…
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Attachments ── */}
        {attachments.length > 0 && (
          <div style={{ padding: '10px 20px', borderTop: '1px solid var(--pulse-border)', display: 'flex', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
            {attachments.map((file, index) => (
              <div key={index} className="composer-attachment-chip">
                <Paperclip className="w-3.5 h-3.5" style={{ color: 'var(--pulse-ink-3)' }} aria-hidden />
                <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                <span style={{ fontSize: 11, color: 'var(--pulse-ink-3)' }}>{(file.size / 1024).toFixed(0)}KB</span>
                <button
                  onClick={() => removeAttachment(index)}
                  className="composer-icon-btn"
                  style={{ width: 20, height: 20 }}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Confidential mode panel ── */}
        {confidentialEnabled && (
          <div className="composer-confidential-panel">
            <div className="composer-mono-label" style={{ marginBottom: 10 }}>CONFIDENTIAL MODE</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--pulse-ink-3)', marginBottom: 4 }}>Expiration</label>
                <input
                  type="datetime-local"
                  value={confidentialExpiresAt}
                  onChange={(e) => setConfidentialExpiresAt(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--pulse-border)', background: 'var(--pulse-surface)', color: 'var(--pulse-ink)', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--pulse-ink-2)', marginTop: 18 }}>
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
                    style={{ marginTop: 8, width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--pulse-border)', background: 'var(--pulse-surface)', color: 'var(--pulse-ink)', fontSize: 13 }}
                  />
                )}
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12.5, color: 'var(--pulse-ink-2)' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={confidentialDisableForward} onChange={(e) => setConfidentialDisableForward(e.target.checked)} />
                  Disable forward
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={confidentialDisableCopy} onChange={(e) => setConfidentialDisableCopy(e.target.checked)} />
                  Disable copy
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={confidentialDisablePrint} onChange={(e) => setConfidentialDisablePrint(e.target.checked)} />
                  Disable print
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={confidentialDisableDownload} onChange={(e) => setConfidentialDisableDownload(e.target.checked)} />
                  Disable download
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── Inline pre-send warnings ── */}
        {missingAttachmentWarning && (
          <div className="composer-warning-strip">
            <Paperclip className="w-3.5 h-3.5" style={{ color: 'var(--pulse-tone-warning)', flexShrink: 0 }} aria-hidden />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="composer-mono-label" style={{ color: 'var(--pulse-tone-warning)' }}>ATTACHMENT · MISSING</div>
              <div style={{ fontSize: 12, color: 'var(--pulse-ink-2)', marginTop: 2 }}>Body mentions an attachment but none added.</div>
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="composer-quiet-btn" style={{ padding: '6px 10px', fontSize: 12 }}>Add file</button>
            <button onClick={() => { setMissingAttachmentWarning(false); handleSend(); }} className="composer-send-pill" style={{ padding: '7px 12px', fontSize: 12 }}>
              Send anyway
            </button>
          </div>
        )}

        {/* ── Action bar ── */}
        <div className={isMaximized ? 'composer-focal-actions' : 'composer-sidecar-actions'}>
          <button onClick={handleSend} disabled={sending} className="composer-send-pill">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>{sending ? 'Sending…' : 'Send'}</span>
            {!sending && <span className="kbd-hint">⌘↵</span>}
          </button>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowScheduleModal(!showScheduleModal)}
              disabled={scheduling}
              className="composer-quiet-btn"
              title="Schedule send"
            >
              {scheduling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
              {isMaximized && <span>Schedule</span>}
            </button>
            {showScheduleModal && (
              <ScheduleSendModal
                onSchedule={handleScheduleSend}
                onClose={() => setShowScheduleModal(false)}
              />
            )}
          </div>

          {isMaximized && (
            <button onClick={handleSaveDraft} disabled={savingDraft} className="composer-quiet-btn" title="Save draft (⌘S)">
              {savingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save draft</span>
            </button>
          )}

          {/* AI cluster — Sidecar only (Focal has the right rail) */}
          {!isMaximized && (
            <>
              <span className="composer-toolbar-sep" />
              <button
                onClick={() => { setShowAiPanel(p => !p); if (showToneCheck) setShowToneCheck(false); }}
                className={`composer-icon-btn ${showAiPanel ? 'is-active' : ''}`}
                title="AI draft"
                aria-label="AI draft"
              >
                <Wand2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleToneCheck}
                className={`composer-icon-btn ${showToneCheck ? 'is-active' : ''}`}
                title="Tone check"
                aria-label="Tone check"
              >
                <Gauge className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* Format ▾ — Focal only. Round 5 consolidation: was 5 individual
              icon buttons (B/I/U/Link/Templates) in a flat strip; now one
              popover anchored on the toolbar. mousedown-preventDefault on
              every popover button keeps the textarea selection alive so
              insertFormatting() can still wrap the cursor's range. */}
          {isMaximized && (
            <>
              <span className="composer-toolbar-sep" />
              <div ref={formatPopoverRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setShowFormatPopover(p => !p); setShowInsertPopover(false); }}
                  className={`composer-icon-btn ${showFormatPopover ? 'is-active' : ''}`}
                  title="Format"
                  aria-label="Format"
                  aria-haspopup="menu"
                  aria-expanded={showFormatPopover}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>Format</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showFormatPopover && (
                  <div
                    role="menu"
                    style={{
                      position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 10,
                      display: 'flex', gap: 2, padding: 4,
                      background: 'var(--pulse-surface)',
                      border: '1px solid var(--pulse-border)',
                      borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    }}
                  >
                    <button role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => { handleBold();      setShowFormatPopover(false); }} className="composer-icon-btn" title="Bold (**text**)"   aria-label="Bold"><Bold className="w-3.5 h-3.5" /></button>
                    <button role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => { handleItalic();    setShowFormatPopover(false); }} className="composer-icon-btn" title="Italic (*text*)"  aria-label="Italic"><Italic className="w-3.5 h-3.5" /></button>
                    <button role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => { handleUnderline(); setShowFormatPopover(false); }} className="composer-icon-btn" title="Underline"         aria-label="Underline"><Underline className="w-3.5 h-3.5" /></button>
                    <button role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => { handleLink();      setShowFormatPopover(false); }} className="composer-icon-btn" title="Insert link"       aria-label="Insert link"><Link className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Insert ▾ — both modes. Collapses Templates + Pulse Meeting +
              Drive (when enabled) into a single menu. Drive's conditional
              visibility is preserved inside the menu item list. */}
          <div ref={insertPopoverRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => { setShowInsertPopover(p => !p); setShowFormatPopover(false); }}
              className={`composer-icon-btn ${showInsertPopover ? 'is-active' : ''}`}
              title="Insert"
              aria-label="Insert"
              aria-haspopup="menu"
              aria-expanded={showInsertPopover}
            >
              <Plus className="w-3.5 h-3.5" />
              {isMaximized && <span>Insert</span>}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showInsertPopover && (
              <div
                role="menu"
                style={{
                  position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 10,
                  display: 'flex', flexDirection: 'column', gap: 2, padding: 4, minWidth: 180,
                  background: 'var(--pulse-surface)',
                  border: '1px solid var(--pulse-border)',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                }}
              >
                <button
                  role="menuitem"
                  onClick={() => { setShowTemplatesModal(true); setShowInsertPopover(false); }}
                  className="composer-rail-action"
                  style={{ justifyContent: 'flex-start', gap: 8 }}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Template</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => { handleInsertMeetLink(); setShowInsertPopover(false); }}
                  disabled={meetCreating}
                  className="composer-rail-action"
                  style={{ justifyContent: 'flex-start', gap: 8 }}
                >
                  {meetCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                  <span>Pulse Meeting link</span>
                </button>
                {driveQuickAttach && (
                  <button
                    role="menuitem"
                    onClick={() => { handleOpenDrive(); setShowInsertPopover(false); }}
                    className="composer-rail-action"
                    style={{ justifyContent: 'flex-start', gap: 8 }}
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Drive file</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Utility cluster — both views */}
          <span className="composer-toolbar-sep" />
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            multiple
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="composer-icon-btn"
            title="Attach file (max 25MB total)"
            aria-label="Attach file"
            style={{ position: 'relative' }}
          >
            <Paperclip className="w-3.5 h-3.5" />
            {attachments.length > 0 && (
              <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 14, height: 14, padding: '0 3px', borderRadius: 999, background: 'var(--pulse-rose)', color: 'white', fontSize: 9, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {attachments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setConfidentialEnabled(!confidentialEnabled)}
            className={`composer-icon-btn ${confidentialEnabled ? 'is-active' : ''}`}
            title="Confidential mode"
            aria-label="Confidential mode"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>

          <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {!isMaximized && (
              <button onClick={handleSaveDraft} disabled={savingDraft} className="composer-icon-btn" title="Save draft (⌘S)" aria-label="Save draft">
                {savingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              </button>
            )}
            <button onClick={handleClose} className="composer-icon-btn" title="Discard" aria-label="Discard draft">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
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
