// src/components/Email/Campaigns/EmailCampaignBuilder.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  EmailCampaign,
  CampaignInput,
  emailCampaignService,
} from '../../../services/emailCampaignService';
import { EmailTemplate, emailTemplateService } from '../../../services/emailTemplateService';
import { emailAIService, DraftGenerationParams } from '../../../services/emailAIService';
import { supabase } from '../../../services/supabase';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type WizardStep = 'setup' | 'compose' | 'review';

const STEPS: { key: WizardStep; label: string; icon: string }[] = [
  { key: 'setup',   label: 'Setup',          icon: 'fa-gear'       },
  { key: 'compose', label: 'Compose',        icon: 'fa-pen-to-square' },
  { key: 'review',  label: 'Review & Send',  icon: 'fa-paper-plane' },
];

const SEGMENTS = [
  { value: 'All Contacts',             label: 'All Contacts' },
  { value: 'Recent (30 days)',         label: 'Recent (30 days)' },
  { value: 'Newsletter Subscribers',   label: 'Newsletter Subscribers' },
  { value: 'VIP Contacts',             label: 'VIP Contacts' },
];

type SaveStatus = 'idle' | 'saving' | 'saved';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  campaign?: EmailCampaign | null;
  onSave: (c: EmailCampaign) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const EmailCampaignBuilder: React.FC<Props> = ({
  campaign,
  onSave,
  onCancel,
}) => {
  const isNew = campaign == null; // covers both null and undefined

  // ----- Form state -----
  const [name, setName]               = useState(campaign?.name ?? '');
  const [subject, setSubject]         = useState(campaign?.subject ?? '');
  const [previewText, setPreviewText] = useState(campaign?.preview_text ?? '');
  const [fromName, setFromName]       = useState(campaign?.from_name ?? '');
  const [segmentName, setSegmentName] = useState(campaign?.segment_name ?? SEGMENTS[0].value);
  const [bodyHtml, setBodyHtml]       = useState(campaign?.body_html ?? '');
  const [bodyText, setBodyText]       = useState(campaign?.body_text ?? '');
  const [recipientsRaw, setRecipientsRaw] = useState('');
  const [scheduleAt, setScheduleAt]   = useState('');

  // ----- Wizard -----
  const [step, setStep] = useState<WizardStep>('setup');

  // ----- Auto-save -----
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(
    campaign?.id ?? null,
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ----- Template picker -----
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates]         = useState<EmailTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // ----- AI generator -----
  const [aiPrompt, setAiPrompt]     = useState('');
  const [aiTone, setAiTone]         = useState<DraftGenerationParams['tone']>('professional');
  const [aiLoading, setAiLoading]   = useState(false);
  const aiAvailable = emailAIService.isAvailable();

  // ----- Send -----
  const [sending, setSending] = useState(false);

  // ---------------------------------------------------------------------------
  // Auto-save logic
  // ---------------------------------------------------------------------------

  const buildInput = useCallback((): CampaignInput => ({
    name:         name || 'Untitled Campaign',
    subject:      subject || null,
    preview_text: previewText || null,
    from_name:    fromName || null,
    segment_name: segmentName,
    body_html:    bodyHtml || null,
    body_text:    bodyText || null,
    schedule_at:  scheduleAt ? new Date(scheduleAt).toISOString() : null,
  }), [name, subject, previewText, fromName, segmentName, bodyHtml, bodyText, scheduleAt]);

  const doSave = useCallback(async (): Promise<void> => {
    setSaveStatus('saving');
    try {
      const input = buildInput();
      let result: EmailCampaign;
      if (savedCampaignId) {
        result = await emailCampaignService.update(savedCampaignId, input);
      } else {
        result = await emailCampaignService.create(input);
        setSavedCampaignId(result.id);
      }
      setSaveStatus('saved');
      // Reset to idle after 2 s
      setTimeout(() => setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev)), 2000);
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Auto-save failed';
      toast.error(msg);
      setSaveStatus('idle');
    }
  }, [buildInput, savedCampaignId]);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void doSave();
    }, 3000);
  }, [doSave]);

  const isMountedRef = useRef(false);

  // Clear on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  // Trigger auto-save whenever form fields change
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    scheduleAutoSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, subject, previewText, fromName, segmentName, bodyHtml, bodyText, scheduleAt]);

  // ---------------------------------------------------------------------------
  // Step navigation with validation
  // ---------------------------------------------------------------------------

  const canGoToCompose = name.trim().length > 0 && subject.trim().length > 0;
  const canGoToReview  = bodyHtml.trim().length > 0 || bodyText.trim().length > 0;

  const goToStep = (target: WizardStep) => {
    if (target === 'compose' && !canGoToCompose) {
      toast.error('Campaign name and subject line are required.');
      return;
    }
    if (target === 'review' && !canGoToReview) {
      toast.error('Email body content is required.');
      return;
    }
    setStep(target);
  };

  // ---------------------------------------------------------------------------
  // Load templates
  // ---------------------------------------------------------------------------

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const result = await emailTemplateService.getTemplates(user.id);
      setTemplates(result.data ?? []);
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const handleToggleTemplates = () => {
    if (!showTemplates && templates.length === 0) {
      void loadTemplates();
    }
    setShowTemplates((v) => !v);
  };

  const applyTemplate = (tpl: EmailTemplate) => {
    setBodyHtml(tpl.body_html ?? tpl.body ?? '');
    setBodyText(tpl.body ?? '');
    if (!subject && tpl.subject) setSubject(tpl.subject);
    setShowTemplates(false);
    scheduleAutoSave();
  };

  // ---------------------------------------------------------------------------
  // AI content generation
  // ---------------------------------------------------------------------------

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a prompt for AI generation.');
      return;
    }
    setAiLoading(true);
    try {
      const params: DraftGenerationParams = {
        intent: aiPrompt,
        tone:   aiTone,
      };
      const draft = await emailAIService.generateDraft(params);
      setBodyText(draft);
      // Wrap in simple HTML
      const htmlDraft = `<div>${draft.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>`;
      setBodyHtml(htmlDraft);
      // Fill subject if empty — pull first line as rough subject
      if (!subject) {
        const firstLine = aiPrompt.trim().split(/[.!?\n]/)[0].trim().slice(0, 60);
        if (firstLine) setSubject(firstLine);
      }
      toast.success('AI draft generated!');
      scheduleAutoSave();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI generation failed';
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Send Now / Schedule
  // ---------------------------------------------------------------------------

  const handleSend = async (schedule: boolean) => {
    // Ensure campaign is saved first
    let campaignId = savedCampaignId;
    if (!campaignId) {
      setSaveStatus('saving');
      try {
        const created = await emailCampaignService.create(buildInput());
        setSavedCampaignId(created.id);
        campaignId = created.id;
        setSaveStatus('saved');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save campaign';
        toast.error(msg);
        setSaveStatus('idle');
        return;
      }
    }

    if (!subject.trim()) {
      toast.error('Subject line is required before sending.');
      return;
    }
    if (!bodyHtml.trim() && !bodyText.trim()) {
      toast.error('Email body is required before sending.');
      return;
    }

    const recipients = parseRecipients(recipientsRaw);
    if (recipients.length === 0) {
      toast.error('At least one recipient is required.');
      return;
    }

    setSending(true);
    try {
      if (schedule && scheduleAt) {
        // Schedule flow — update schedule_at and status
        const scheduled = await emailCampaignService.update(campaignId, {
          status:      'scheduled',
          schedule_at: new Date(scheduleAt).toISOString(),
        });
        toast.success(`Campaign scheduled for ${new Date(scheduleAt).toLocaleString()}`);
        onSave(scheduled);
      } else {
        // Send immediately
        await emailCampaignService.send(campaignId, recipients);
        const updated = await emailCampaignService.getById(campaignId);
        toast.success(`Sent to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}!`);
        onSave(updated);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Send failed';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const inputClass =
    'w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-zinc-100 placeholder-stone-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors';

  const labelClass = 'block text-xs font-medium text-stone-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wide';

  const recipientCount = parseRecipients(recipientsRaw).length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-zinc-100">

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-3 px-6 py-4 bg-stone-50 dark:bg-zinc-950 border-b border-stone-200 dark:border-zinc-800 shrink-0">
        {/* Back */}
        <button
          onClick={onCancel}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
          title="Back to campaigns"
        >
          <i className="fa-solid fa-arrow-left text-sm" />
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold tracking-tight truncate">
            {isNew ? 'New Campaign' : (campaign?.name ?? 'Edit Campaign')}
          </h2>
        </div>

        {/* Auto-save status */}
        <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-zinc-500">
          {saveStatus === 'saving' && (
            <>
              <i className="fa-solid fa-spinner animate-spin text-rose-500" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <i className="fa-solid fa-circle-check text-green-500" />
              <span className="text-green-600 dark:text-green-400">Saved</span>
            </>
          )}
        </div>

        {/* Save Draft button */}
        <button
          onClick={() => void doSave()}
          disabled={saveStatus === 'saving'}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
        >
          <i className="fa-solid fa-floppy-disk" />
          Save Draft
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Step tabs                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-0 px-6 py-0 bg-stone-50 dark:bg-zinc-950 border-b border-stone-200 dark:border-zinc-800 shrink-0">
        {STEPS.map(({ key, label, icon }, idx) => {
          const isActive = step === key;
          const isPast   = STEPS.findIndex((s) => s.key === step) > idx;
          return (
            <button
              key={key}
              onClick={() => goToStep(key)}
              className={`
                flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all
                ${isActive
                  ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                  : isPast
                    ? 'border-transparent text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100'
                    : 'border-transparent text-stone-400 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-zinc-300'
                }
              `}
            >
              <i className={`fa-solid ${icon} text-xs`} />
              {label}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Step content                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 overflow-auto">

        {/* ========================= STEP 1: SETUP ======================== */}
        {step === 'setup' && (
          <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

            {/* Campaign Name */}
            <div>
              <label className={labelClass}>
                Campaign Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. March Newsletter"
                className={inputClass}
              />
            </div>

            {/* Subject Line */}
            <div>
              <label className={labelClass}>
                Subject Line <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Write a compelling subject line…"
                  maxLength={100}
                  className={`${inputClass} pr-16`}
                />
                <span
                  className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums ${
                    subject.length > 60
                      ? 'text-amber-500'
                      : 'text-stone-400 dark:text-zinc-500'
                  }`}
                >
                  {subject.length}/60
                </span>
              </div>
              {subject.length > 60 && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Subject exceeds 60 characters — may be truncated in some email clients.
                </p>
              )}
            </div>

            {/* Preview Text */}
            <div>
              <label className={labelClass}>Preview Text</label>
              <input
                type="text"
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Short text shown after the subject in inbox…"
                className={inputClass}
              />
            </div>

            {/* From Name */}
            <div>
              <label className={labelClass}>From Name</label>
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="e.g. The Pulse Team"
                className={inputClass}
              />
            </div>

            {/* Audience Segment */}
            <div>
              <label className={labelClass}>Audience Segment</label>
              <select
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
                className={inputClass}
              >
                {SEGMENTS.map((seg) => (
                  <option key={seg.value} value={seg.value}>
                    {seg.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Next */}
            <div className="pt-2">
              <button
                onClick={() => goToStep('compose')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-red-500 text-white text-sm font-medium shadow-sm hover:opacity-90 transition-opacity"
              >
                Continue to Compose
                <i className="fa-solid fa-arrow-right text-xs" />
              </button>
            </div>
          </div>
        )}

        {/* ======================== STEP 2: COMPOSE ======================= */}
        {step === 'compose' && (
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

            {/* AI Content Generator */}
            <div className="rounded-xl border-2 border-transparent bg-gradient-to-r from-violet-500/20 to-purple-500/20 p-0.5">
              <div className="rounded-[10px] bg-stone-50 dark:bg-zinc-950 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow">
                    <i className="fa-solid fa-wand-magic-sparkles text-white text-xs" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                      AI Content Generator
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-zinc-400">
                      {aiAvailable ? 'Powered by Gemini' : 'AI content generation coming soon'}
                    </p>
                  </div>
                </div>

                {aiAvailable ? (
                  <div className="space-y-3">
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Describe what you want the email to say… e.g. 'Announce our spring sale with 20% off all products'"
                      rows={3}
                      className={`${inputClass} resize-none`}
                    />
                    <div className="flex items-center gap-3">
                      <select
                        value={aiTone}
                        onChange={(e) => setAiTone(e.target.value as DraftGenerationParams['tone'])}
                        className="px-3 py-1.5 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      >
                        <option value="professional">Professional</option>
                        <option value="friendly">Friendly</option>
                        <option value="formal">Formal</option>
                        <option value="concise">Concise</option>
                      </select>
                      <button
                        onClick={() => void handleAIGenerate()}
                        disabled={aiLoading || !aiPrompt.trim()}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-medium shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {aiLoading ? (
                          <>
                            <i className="fa-solid fa-spinner animate-spin text-xs" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-wand-magic-sparkles text-xs" />
                            Generate
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-stone-500 dark:text-zinc-400 italic">
                    AI content generation coming soon. Configure a Gemini API key to enable this feature.
                  </p>
                )}
              </div>
            </div>

            {/* Use Template toggle */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={labelClass}>Email Body</span>
                <button
                  onClick={handleToggleTemplates}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    showTemplates
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                      : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-zinc-300 hover:border-rose-500/40'
                  }`}
                >
                  <i className="fa-solid fa-layer-group text-xs" />
                  {showTemplates ? 'Hide Templates' : 'Use Template'}
                </button>
              </div>

              {/* Template grid */}
              {showTemplates && (
                <div className="mb-4 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
                  {templatesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <i className="fa-solid fa-spinner animate-spin text-xl text-rose-500" />
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="text-center py-8 text-stone-500 dark:text-zinc-400">
                      <i className="fa-solid fa-file-circle-xmark text-2xl mb-2 opacity-40 block" />
                      <p className="text-sm">No templates found. Create templates in the Templates section.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {templates.map((tpl) => (
                        <button
                          key={tpl.id}
                          onClick={() => applyTemplate(tpl)}
                          className="text-left p-3 rounded-lg border border-stone-200 dark:border-zinc-700 hover:border-rose-500/50 hover:bg-rose-500/5 transition-all group"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-stone-900 dark:text-zinc-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 line-clamp-1 transition-colors">
                              {tpl.name}
                            </span>
                            {tpl.category && (
                              <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-400">
                                {tpl.category}
                              </span>
                            )}
                          </div>
                          {tpl.description && (
                            <p className="text-xs text-stone-500 dark:text-zinc-400 line-clamp-2">
                              {tpl.description}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* HTML body */}
              <div className="mb-4">
                <label className="block text-xs text-stone-500 dark:text-zinc-400 mb-1.5">
                  HTML Body
                </label>
                <textarea
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  rows={16}
                  placeholder="<html>…</html>"
                  spellCheck={false}
                  className={`${inputClass} font-mono text-xs resize-y`}
                />
              </div>

              {/* Plain text body */}
              <div>
                <label className="block text-xs text-stone-500 dark:text-zinc-400 mb-1.5">
                  Plain Text Body
                </label>
                <textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={6}
                  placeholder="Plain text version for email clients that don't support HTML…"
                  className={`${inputClass} resize-y`}
                />
              </div>
            </div>

            {/* Continue button */}
            <div className="pt-2">
              <button
                onClick={() => goToStep('review')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-red-500 text-white text-sm font-medium shadow-sm hover:opacity-90 transition-opacity"
              >
                Continue to Review
                <i className="fa-solid fa-arrow-right text-xs" />
              </button>
            </div>
          </div>
        )}

        {/* ======================= STEP 3: REVIEW & SEND ================== */}
        {step === 'review' && (
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

            {/* Campaign summary card */}
            <div className="rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
              <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                <i className="fa-solid fa-clipboard-list text-rose-500" />
                Campaign Summary
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-xs font-medium text-stone-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                    Campaign Name
                  </dt>
                  <dd className="text-stone-900 dark:text-zinc-100 font-medium truncate">
                    {name || <span className="italic text-stone-400">Untitled</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-stone-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                    Segment
                  </dt>
                  <dd className="text-stone-900 dark:text-zinc-100">{segmentName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-stone-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                    Subject
                  </dt>
                  <dd className="text-stone-900 dark:text-zinc-100 truncate">
                    {subject || <span className="italic text-stone-400">—</span>}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Email preview */}
            {bodyHtml && (
              <div>
                <label className={labelClass}>Email Preview</label>
                <div className="rounded-xl border border-stone-200 dark:border-zinc-700 overflow-hidden bg-white">
                  <iframe
                    srcDoc={bodyHtml}
                    sandbox="allow-same-origin"
                    title="Email preview"
                    className="w-full"
                    style={{ minHeight: '320px', border: 'none', display: 'block' }}
                  />
                </div>
              </div>
            )}

            {/* Recipients */}
            <div>
              <label className={labelClass}>
                Recipients
                {recipientCount > 0 && (
                  <span className="ml-2 normal-case text-rose-600 dark:text-rose-400 font-medium">
                    {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
                  </span>
                )}
              </label>
              <textarea
                value={recipientsRaw}
                onChange={(e) => setRecipientsRaw(e.target.value)}
                rows={4}
                placeholder="Enter email addresses separated by commas or new lines…"
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Schedule */}
            <div>
              <label className={labelClass}>Schedule (optional)</label>
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className={inputClass}
              />
              {scheduleAt && (
                <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">
                  Campaign will be scheduled for {new Date(scheduleAt).toLocaleString()}.
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {scheduleAt && (
                <button
                  onClick={() => void handleSend(true)}
                  disabled={sending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm disabled:opacity-50 transition-colors"
                >
                  {sending ? (
                    <i className="fa-solid fa-spinner animate-spin text-xs" />
                  ) : (
                    <i className="fa-solid fa-clock text-xs" />
                  )}
                  Schedule
                </button>
              )}
              <button
                onClick={() => void handleSend(false)}
                disabled={sending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-red-500 text-white text-sm font-medium shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {sending ? (
                  <i className="fa-solid fa-spinner animate-spin text-xs" />
                ) : (
                  <i className="fa-solid fa-paper-plane text-xs" />
                )}
                Send Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailCampaignBuilder;
