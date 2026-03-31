// src/store/emailComposeStore.ts
// Zustand store for email compose state — reply, forward, send with undo

import { create } from 'zustand';
import { CachedEmail } from '../services/emailSyncService';
import { SendEmailParams } from '../services/gmailService';

interface RestoredComposer {
  to?: string;
  subject?: string;
  cc?: string;
  bcc?: string;
}

interface PendingSend {
  params: SendEmailParams;
  timeoutId: ReturnType<typeof setTimeout>;
  startTime: number;
}

interface EmailComposeState {
  showComposer: boolean;
  replyToEmail: CachedEmail | null;
  prefilledBody: string | undefined;
  restoredComposer: RestoredComposer | null;
  pendingSends: Map<string, PendingSend>;

  // Actions
  openCompose: () => void;
  openReply: (email: CachedEmail, prefilled?: string) => void;
  openReplyAll: (email: CachedEmail, userEmail: string) => void;
  openForward: (email: CachedEmail) => void;
  openFollowUp: (to: string, subject: string, originalEmail: CachedEmail) => void;
  restoreComposer: (params: SendEmailParams) => void;
  closeComposer: () => void;
  addPendingSend: (id: string, send: PendingSend) => void;
  removePendingSend: (id: string) => void;
}

export const useEmailComposeStore = create<EmailComposeState>()((set, get) => ({
  showComposer: false,
  replyToEmail: null,
  prefilledBody: undefined,
  restoredComposer: null,
  pendingSends: new Map(),

  openCompose: () => set({
    showComposer: true,
    replyToEmail: null,
    prefilledBody: undefined,
    restoredComposer: null,
  }),

  openReply: (email, prefilled) => set({
    showComposer: true,
    replyToEmail: email,
    prefilledBody: prefilled,
    restoredComposer: null,
  }),

  openReplyAll: (email, userEmail) => {
    const allRecipients = [
      ...(email.to_emails || []),
      ...(email.cc_emails || []),
    ];
    const ccList = allRecipients
      .map((r) => r.email)
      .filter((e) => e && e.toLowerCase() !== userEmail.toLowerCase() && e.toLowerCase() !== email.from_email?.toLowerCase());

    set({
      showComposer: true,
      replyToEmail: email,
      prefilledBody: undefined,
      restoredComposer: {
        to: email.from_email,
        subject: email.subject?.startsWith('Re:') ? email.subject : `Re: ${email.subject || ''}`,
        cc: ccList.join(', '),
      },
    });
  },

  openForward: (email) => {
    const fwdSubject = email.subject?.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject || ''}`;
    const fwdBody = `\n\n---------- Forwarded message ----------\nFrom: ${email.from_name || email.from_email} <${email.from_email}>\nDate: ${new Date(email.received_at).toLocaleString()}\nSubject: ${email.subject || '(No Subject)'}\nTo: ${email.to_emails?.map((t) => t.email).join(', ') || ''}\n\n${email.body_text || email.snippet || ''}`;

    set({
      showComposer: true,
      replyToEmail: null,
      prefilledBody: fwdBody,
      restoredComposer: { to: '', subject: fwdSubject },
    });
  },

  openFollowUp: (to, subject, originalEmail) => set({
    showComposer: true,
    replyToEmail: originalEmail,
    prefilledBody: '\n\nJust following up on my previous email. Please let me know if you have any questions.\n\nBest regards',
    restoredComposer: { to, subject },
  }),

  restoreComposer: (params) => set({
    showComposer: true,
    replyToEmail: null,
    prefilledBody: params.body,
    restoredComposer: {
      to: params.to.join(', '),
      subject: params.subject,
      cc: params.cc?.join(', '),
      bcc: params.bcc?.join(', '),
    },
  }),

  closeComposer: () => set({
    showComposer: false,
    replyToEmail: null,
    prefilledBody: undefined,
    restoredComposer: null,
  }),

  addPendingSend: (id, send) => {
    const next = new Map(get().pendingSends);
    next.set(id, send);
    set({ pendingSends: next });
  },

  removePendingSend: (id) => {
    const next = new Map(get().pendingSends);
    next.delete(id);
    set({ pendingSends: next });
  },
}));
