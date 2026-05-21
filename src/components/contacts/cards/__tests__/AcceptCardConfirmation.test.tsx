/**
 * AcceptCardConfirmation tests.
 *
 * Critical magi D-2 assertions (vision spec § Layout sketches § 5):
 *   1. Secondary checkbox renders default-CHECKED on open.
 *   2. Accept button label flips between "Accept and connect" and
 *      "Accept only" based on checkbox state.
 *   3. Unchecking does NOT block the primary Accept action.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock react-i18next to return predictable strings derived from keys, so
// assertions can pin the exact label flip.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'contacts.cards.acceptModal.title_format': `Accept ${params?.name ?? ''}'s card?`,
        'contacts.cards.acceptModal.primary_row_label_format': `Add ${params?.name ?? ''} to your contacts`,
        'contacts.cards.acceptModal.primary_row_helper': 'Required to save this card.',
        'contacts.cards.acceptModal.secondary_row_label_format': `Also connect with ${params?.sender ?? ''} on Pulse`,
        'contacts.cards.acceptModal.secondary_row_helper_format': `${params?.sender ?? ''} sent this card. You can message each other directly after.`,
        'contacts.cards.acceptModal.cancel_cta': 'Cancel',
        'contacts.cards.acceptModal.accept_and_connect_cta': 'Accept and connect',
        'contacts.cards.acceptModal.accept_only_cta': 'Accept only',
        'contacts.cards.acceptModal.accepting_state': 'Accepting…',
        'contacts.cards.acceptModal.sr_announce_format': `Accept ${params?.name ?? ''}'s card. Adding to contacts is required. The option to also connect with ${params?.sender ?? ''} is currently turned on.`,
      };
      return map[key] ?? key;
    },
  }),
}));

import { AcceptCardConfirmation } from '../AcceptCardConfirmation';
import type { ContactCard } from '../../../../types/contactCard';

const makeCard = (overrides?: Partial<ContactCard>): ContactCard => ({
  id: 'card-1',
  sender_user_id: 'user-sender',
  recipient_hint: 'priya@example.com',
  recipient_user_id: 'user-recipient',
  card_snapshot: { name: 'Priya Khan' },
  intro_note: null,
  token_policy: 'multi_use',
  is_forwardable: true,
  forwarded_from_card_id: null,
  expires_at: null,
  revoked_at: null,
  consumed_at: null,
  view_count: 0,
  created_at: '2026-05-19T10:00:00Z',
  ...overrides,
});

describe('AcceptCardConfirmation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the secondary "Also connect" checkbox checked by default', () => {
    render(
      <AcceptCardConfirmation
        open
        card={makeCard()}
        senderDisplayName="Maya Chen"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    const checkbox = screen.getByRole('checkbox', { name: /also connect with maya chen/i });
    expect(checkbox).toBeChecked();
  });

  it('flips the Accept button label between "Accept and connect" and "Accept only"', async () => {
    const user = userEvent.setup();
    render(
      <AcceptCardConfirmation
        open
        card={makeCard()}
        senderDisplayName="Maya Chen"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: /accept and connect/i })).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox', { name: /also connect with maya chen/i });
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole('button', { name: /^accept only$/i })).toBeInTheDocument();
    // And no Accept-and-connect button when unchecked
    expect(screen.queryByRole('button', { name: /accept and connect/i })).toBeNull();
  });

  it('still allows the primary Accept action when the secondary checkbox is unchecked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <AcceptCardConfirmation
        open
        card={makeCard()}
        senderDisplayName="Maya Chen"
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />,
    );
    const checkbox = screen.getByRole('checkbox', { name: /also connect with maya chen/i });
    await user.click(checkbox);
    const acceptOnly = screen.getByRole('button', { name: /^accept only$/i });
    expect(acceptOnly).not.toBeDisabled();
    await user.click(acceptOnly);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith({ connectWithSender: false });
  });

  it('renders the subject display name verbatim, preserving curly braces', () => {
    render(
      <AcceptCardConfirmation
        open
        card={makeCard({ card_snapshot: { name: '{Lucca} Messana' } })}
        senderDisplayName="Maya Chen"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: /\{Lucca\} Messana/ })).toBeInTheDocument();
  });
});
