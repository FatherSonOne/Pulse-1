import { describe, it, expect } from 'vitest';
import { channelsFor } from './channelsFor';
import { Contact } from '../../../../types';

// Minimal Contact factory — only the fields channelsFor reads matter.
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

describe('channelsFor (INVARIANT 1 — reach matches identity)', () => {
  it('Pulse user → Message / Vox / Meet, regardless of the email flag', () => {
    const c = make({ pulseUserId: 'u1' });
    expect(channelsFor(c, { emailEnabled: false }).map((x) => x.kind)).toEqual([
      'message',
      'vox',
      'meet',
    ]);
    expect(channelsFor(c, { emailEnabled: true }).map((x) => x.kind)).toEqual([
      'message',
      'vox',
      'meet',
    ]);
  });

  it('external + email ON + phone → Email / Call / Note (no Slack when unlinked)', () => {
    const c = make({ phone: '+1 555 0100' });
    expect(channelsFor(c, { emailEnabled: true }).map((x) => x.kind)).toEqual([
      'email',
      'call',
      'note',
    ]);
  });

  it('external + email OFF → Email hidden (D6), never a dead button', () => {
    const c = make({ phone: '+1 555 0100' });
    expect(channelsFor(c, { emailEnabled: false }).map((x) => x.kind)).toEqual(['call', 'note']);
  });

  it('external slack-linked (Priya parity) → Slack present but DISABLED until send is wired', () => {
    const c = make({ phone: '+1 555 0100' });
    const channels = channelsFor(c, { emailEnabled: true, slackLinked: true });
    expect(channels.map((x) => x.kind)).toEqual(['email', 'slack', 'call', 'note']);
    expect(channels.find((x) => x.kind === 'slack')?.disabled).toBe(true);
  });

  it('slack-linked + slackSendEnabled (Phase 8) → Slack enabled', () => {
    const c = make({ phone: '+1 555 0100' });
    const slack = channelsFor(c, {
      emailEnabled: true,
      slackLinked: true,
      slackSendEnabled: true,
    }).find((x) => x.kind === 'slack');
    expect(slack?.disabled).toBe(false);
  });

  it('external without a phone → Call rendered but disabled (risk #10)', () => {
    const c = make({ phone: undefined });
    const call = channelsFor(c, { emailEnabled: true }).find((x) => x.kind === 'call');
    expect(call?.disabled).toBe(true);
    expect(call?.disabledReason).toMatch(/phone/i);
  });
});
