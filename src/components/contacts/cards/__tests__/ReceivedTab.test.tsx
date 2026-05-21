/**
 * ReceivedTab tests — empty / populated states + list rendering.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('react-i18next', () => {
  const tFn = (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
        'contacts.cards.receivedTab.tab_label': 'Received',
        'contacts.cards.receivedTab.header_summary_empty': 'All caught up.',
        'contacts.cards.receivedTab.header_summary_simple_format': `${params?.newCount ?? 0} new`,
        'contacts.cards.receivedTab.header_summary_format': `${params?.newCount ?? 0} new · ${params?.expiringCount ?? 0} expiring soon`,
        'contacts.cards.receivedTab.empty_title': 'No cards yet',
        'contacts.cards.receivedTab.empty_body': 'Cards friends share with you appear here.',
        'contacts.cards.receivedTab.empty_secondary_cta': 'Get a share link from a friend',
        'contacts.cards.receivedTab.sent_cards_link': 'Sent cards →',
        'contacts.cards.receivedTab.select_all': 'Select all',
        'contacts.cards.receivedTab.row_shared_by_format': `shared by ${params?.sender ?? ''} · ${params?.time ?? ''}`,
        'contacts.cards.receivedTab.row_forwarded_format': `shared by ${params?.sender ?? ''} · forwarded · ${params?.time ?? ''}`,
        'contacts.cards.receivedTab.row_open_aria': `Open card from ${params?.sender ?? ''}`,
        'contacts.cards.receivedTab.row_select_aria': `Select card from ${params?.sender ?? ''}`,
        'contacts.cards.receivedTab.row_more_aria': 'More actions',
        'contacts.cards.receivedTab.row_unread_aria': 'unread',
        'contacts.cards.receivedTab.row_expires_format_one': 'Expires in 1 day',
        'contacts.cards.receivedTab.row_expires_format_other': `Expires in ${params?.count ?? 0} days`,
        'contacts.cards.sourceChip.label': 'From card',
        'contacts.cards.sourceChip.tooltip_format': `From card · shared by ${params?.sender ?? ''} · ${params?.time ?? ''}`,
      };
      return map[key] ?? key;
  };
  const ctx = { t: tFn };
  return { useTranslation: () => ctx };
});

const { fetchReceivedMock } = vi.hoisted(() => ({ fetchReceivedMock: vi.fn() }));
vi.mock('../../../../services/contactCardService', () => ({
  default: { fetchReceived: fetchReceivedMock },
}));

import { ReceivedTab } from '../ReceivedTab';
import type { ContactCard } from '../../../../types/contactCard';

const makeCard = (overrides?: Partial<ContactCard>): ContactCard => ({
  id: 'card-1',
  sender_user_id: 'sender-1',
  recipient_hint: 'me@example.com',
  recipient_user_id: 'me-user',
  card_snapshot: { name: 'Priya Khan' },
  intro_note: null,
  token_policy: 'multi_use',
  is_forwardable: true,
  forwarded_from_card_id: null,
  expires_at: null,
  revoked_at: null,
  consumed_at: null,
  view_count: 0,
  created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  ...overrides,
});

describe('ReceivedTab', () => {
  beforeEach(() => {
    fetchReceivedMock.mockReset();
  });

  it('renders the empty state when no cards are returned', async () => {
    fetchReceivedMock.mockResolvedValueOnce([]);
    render(<ReceivedTab />);

    await waitFor(() => expect(screen.getByText('No cards yet')).toBeInTheDocument());
    expect(screen.getByText('Cards friends share with you appear here.')).toBeInTheDocument();
    // Header summary should show "All caught up." when no cards.
    expect(screen.getByText('All caught up.')).toBeInTheDocument();
  });

  it('renders one row per received card with the sender name resolved', async () => {
    fetchReceivedMock.mockResolvedValueOnce([
      makeCard({ id: 'a', sender_user_id: 'sender-a' }),
      makeCard({ id: 'b', sender_user_id: 'sender-b', card_snapshot: { name: 'Rob Diaz' } }),
    ]);
    render(<ReceivedTab senderNames={{ 'sender-a': 'Maya Chen', 'sender-b': 'Aiko Tanaka' }} />);

    await waitFor(() => expect(screen.getByText('Priya Khan')).toBeInTheDocument());
    expect(screen.getByText('Rob Diaz')).toBeInTheDocument();
    // Header should reflect the new count.
    expect(screen.getByText('2 new')).toBeInTheDocument();
  });

  it('renders the initial cards prop without invoking the service', async () => {
    const initial = [makeCard({ id: 'c1' })];
    render(<ReceivedTab initialCards={initial} />);
    expect(screen.getByText('Priya Khan')).toBeInTheDocument();
    expect(fetchReceivedMock).not.toHaveBeenCalled();
  });

  it('preserves curly braces in display names verbatim', async () => {
    fetchReceivedMock.mockResolvedValueOnce([
      makeCard({ id: 'c2', card_snapshot: { name: '{Lucca} Messana' } }),
    ]);
    render(<ReceivedTab />);
    await waitFor(() => expect(screen.getByText('{Lucca} Messana')).toBeInTheDocument());
  });
});
