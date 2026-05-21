/**
 * ShareCardModal — happy path (R-1) + rate-limit error variant.
 *
 * The modal sends through contactCardService.createCard. We mock the
 * service module so the test does not touch Supabase.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'contacts.cards.share.modal_title': `Share ${params?.name ?? ''}'s card`,
        'contacts.cards.share.modal_subtitle': 'Send a copy of this contact to someone.',
        'contacts.cards.share.recipient_label': 'To',
        'contacts.cards.share.recipient_placeholder': 'Pulse user or email',
        'contacts.cards.share.recipient_helper': 'e.g. priya@example.com',
        'contacts.cards.share.note_label': 'Add a note (optional)',
        'contacts.cards.share.note_placeholder': 'Why this contact, in one or two lines.',
        'contacts.cards.share.note_counter_format': `${params?.count ?? 0} / 500`,
        'contacts.cards.share.more_options_toggle': 'More options',
        'contacts.cards.share.cancel_cta': 'Cancel',
        'contacts.cards.share.send_cta': 'Send',
        'contacts.cards.share.sending_state': 'Sending…',
        'contacts.cards.share.success_toast_format': `Card sent to ${params?.recipient ?? ''}`,
        'contacts.cards.share.error_invalid_recipient': 'Please enter a valid email or Pulse username.',
        'contacts.cards.share.error_rate_limit': "You've sent your daily limit. Try again tomorrow.",
        'contacts.cards.share.error_generic': 'Send failed. Check your connection and try again.',
      };
      return map[key] ?? key;
    },
  }),
}));

const { createCardMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  createCardMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('../../../../services/contactCardService', () => ({
  default: { createCard: createCardMock },
}));

vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), {
    success: toastSuccessMock,
    error: toastErrorMock,
  });
  return { default: toast };
});

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

import { ShareCardModal } from '../ShareCardModal';

const makeContact = () =>
  ({
    id: 'contact-1',
    name: 'Priya Khan',
    role: 'Designer',
    email: 'priya@example.com',
    avatarColor: '#6366f1',
    status: 'online',
    source: 'local',
  }) as unknown as Parameters<typeof ShareCardModal>[0]['contact'];

describe('ShareCardModal', () => {
  beforeEach(() => {
    createCardMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('sends a card with the recipient + note and shows the success toast', async () => {
    createCardMock.mockResolvedValue({
      id: 'card-1',
      share_url: 'https://go.pulse.logosvision.org/c/card-1',
      recipient_user_id: null,
      email_sent: true,
    });
    const onSent = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ShareCardModal open contact={makeContact()} onCancel={onCancel} onSent={onSent} />,
    );

    const recipientInput = screen.getByPlaceholderText('Pulse user or email');
    await user.type(recipientInput, 'maya@example.com');
    const noteArea = screen.getByPlaceholderText('Why this contact, in one or two lines.');
    await user.type(noteArea, 'Great brand thinker.');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() => expect(createCardMock).toHaveBeenCalledTimes(1));
    expect(createCardMock.mock.calls[0][0]).toMatchObject({
      contact_id: 'contact-1',
      recipient_hint: 'maya@example.com',
      intro_note: 'Great brand thinker.',
      token_policy: 'multi_use',
      is_forwardable: true,
      expires_at: null,
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Card sent to maya@example.com');
    expect(onSent).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows the rate-limit toast and keeps the modal open on a 403 rate_limit_exceeded', async () => {
    const err = new Error('rate limit') as Error & { server: { error: string } };
    err.server = { error: 'rate_limit_exceeded' };
    createCardMock.mockRejectedValueOnce(err);
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ShareCardModal open contact={makeContact()} onCancel={onCancel} onSent={() => undefined} />,
    );
    await user.type(screen.getByPlaceholderText('Pulse user or email'), 'maya@example.com');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        "You've sent your daily limit. Try again tomorrow.",
      ),
    );
    // Modal stays open — onCancel must NOT be called on rate-limit error.
    expect(onCancel).not.toHaveBeenCalled();
  });
});
