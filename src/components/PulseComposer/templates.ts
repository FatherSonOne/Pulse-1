// src/components/PulseComposer/templates.ts
// PR 1 — Messages Tools Redesign · Surface 1 · Compose bar.
//
// Stub catalogues for the `/t` template autocomplete and the `/` generic
// slash autocomplete. Real template CRUD lives in App Settings (out of
// scope for PR 1). These exports are deliberately shallow so a future
// PR can swap the data source without touching the UI components.

import type { SlashItem } from './types';

/** STUB templates — replaced by a real provider once App Settings ships. */
export const STUB_TEMPLATES: ReadonlyArray<SlashItem> = [
  {
    id: 'tmpl-fri-update',
    label: 'Friday Update',
    hint: 'Weekly status template',
    body:
      "Friday update:\n\n• Wins this week:\n• In flight:\n• Need help with:\n\nHave a good weekend!",
  },
  {
    id: 'tmpl-friendly-hello',
    label: 'Friendly Hello',
    hint: 'Casual intro',
    body: "Hey! Hope you're doing well — wanted to follow up on this.",
  },
  {
    id: 'tmpl-friday-recap',
    label: 'Friday Recap (team)',
    hint: 'Team digest',
    body:
      "Team — quick Friday recap:\n\n1. Shipped:\n2. Blocked:\n3. Next week:\n\nPing me if anything's off.",
  },
  {
    id: 'tmpl-meeting-followup',
    label: 'Meeting Follow-up',
    hint: 'Post-call summary',
    body:
      "Thanks for the call earlier. Quick recap of what we agreed:\n\n• \n• \n• \n\nLet me know if I missed anything.",
  },
  {
    id: 'tmpl-intro',
    label: 'Intro between two people',
    hint: 'Warm intro',
    body:
      "{Name A}, meet {Name B}. {Name B} runs {context}. I'll let you two take it from here.",
  },
  {
    id: 'tmpl-decline',
    label: 'Polite decline',
    hint: 'Soft no',
    body:
      "Really appreciate the offer — going to pass on this one. Let's keep in touch though.",
  },
  {
    id: 'tmpl-availability',
    label: 'Share availability',
    hint: 'Scheduling',
    body: "I'm free Tuesday or Thursday between 1–4pm ET. What works on your side?",
  },
];

/** STUB generic slash commands. Real command registry lives elsewhere. */
export const STUB_SLASH_COMMANDS: ReadonlyArray<SlashItem> = [
  {
    id: 'cmd-help',
    label: '/help',
    hint: 'Show available compose commands',
    body: '/help',
  },
  {
    id: 'cmd-shrug',
    label: '/shrug',
    hint: 'Append ¯\\_(ツ)_/¯',
    body: '¯\\_(ツ)_/¯',
  },
];

/**
 * Case-insensitive prefix + substring filter, capped to 7 results for
 * keyboard ergonomics. Templates rank prefix matches above substring.
 */
export function filterSlashItems(
  items: ReadonlyArray<SlashItem>,
  query: string,
  limit = 7,
): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice(0, limit);
  const prefix: SlashItem[] = [];
  const substring: SlashItem[] = [];
  for (const it of items) {
    const label = it.label.toLowerCase();
    if (label.startsWith(q)) {
      prefix.push(it);
    } else if (label.includes(q)) {
      substring.push(it);
    }
  }
  return [...prefix, ...substring].slice(0, limit);
}
