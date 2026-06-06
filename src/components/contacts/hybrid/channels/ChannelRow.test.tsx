import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChannelRow } from './ChannelRow';
import { Contact } from '../../../../types';

const base: Contact = {
  id: 'c1',
  name: 'Test Person',
  role: '',
  avatarColor: '#000000',
  status: 'offline',
  email: 'test@example.com',
  source: 'local',
};
const make = (over: Partial<Contact>): Contact => ({ ...base, ...over });

describe('ChannelRow (Phase 1 acceptance)', () => {
  it('a Pulse user shows Message / Vox / Meet and no external channels', () => {
    render(
      <ChannelRow contact={make({ pulseUserId: 'u1' })} emailEnabled={false} onAction={vi.fn()} />,
    );
    expect(screen.getByText('Message')).toBeTruthy();
    expect(screen.getByText('Vox')).toBeTruthy();
    expect(screen.getByText('Meet')).toBeTruthy();
    expect(screen.queryByText('Email')).toBeNull();
  });

  it('an external contact (email on) shows Email / Call / Note', () => {
    render(
      <ChannelRow
        contact={make({ phone: '+1 555 0100' })}
        emailEnabled
        onAction={vi.fn()}
        onNote={vi.fn()}
      />,
    );
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Call')).toBeTruthy();
    expect(screen.getByText('Note')).toBeTruthy();
    expect(screen.queryByText('Message')).toBeNull();
  });

  it('the Message button invokes onAction with the contact id', () => {
    const onAction = vi.fn();
    render(<ChannelRow contact={make({ pulseUserId: 'u1' })} emailEnabled onAction={onAction} />);
    (screen.getByText('Message').closest('button') as HTMLButtonElement).click();
    expect(onAction).toHaveBeenCalledWith('message', 'c1');
  });

  it('a slack-linked contact shows a DISABLED "Link Slack" button (until Phase 8)', () => {
    render(
      <ChannelRow
        contact={make({ phone: '+1 555 0100' })}
        emailEnabled
        slackLinked
        onAction={vi.fn()}
        onNote={vi.fn()}
      />,
    );
    const slackBtn = screen.getByText('Link Slack').closest('button') as HTMLButtonElement;
    expect(slackBtn.disabled).toBe(true);
  });

  it('Note is inert until a note handler is wired', () => {
    render(<ChannelRow contact={make({ phone: '+1 555 0100' })} emailEnabled onAction={vi.fn()} />);
    const noteBtn = screen.getByText('Note').closest('button') as HTMLButtonElement;
    expect(noteBtn.disabled).toBe(true);
  });

  it('a slack-send-enabled contact fires onSlack on click (Phase 8)', () => {
    const onSlack = vi.fn();
    render(
      <ChannelRow
        contact={make({ phone: '+1 555 0100', slackUserId: 'U1' })}
        emailEnabled
        slackLinked
        slackSendEnabled
        onAction={vi.fn()}
        onNote={vi.fn()}
        onSlack={onSlack}
      />,
    );
    const slackBtn = screen.getByText('Slack').closest('button') as HTMLButtonElement;
    expect(slackBtn.disabled).toBe(false);
    slackBtn.click();
    expect(onSlack).toHaveBeenCalledTimes(1);
  });
});
