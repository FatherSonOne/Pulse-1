// CategoryOverflowHint — quiet Cockpit strip surfacing unread mail that lives
// OUTSIDE Primary (Promotions / Updates / Social). The Cockpit and the default
// Inbox tab both show Primary only, so promotional/notification mail is
// otherwise invisible here — the page looks frozen even while mail is arriving
// (the 2026-06-14 "sync isn't pulling fresh email" report was exactly this).
// Each count jumps to that Inbox category tab.
//
// Neutral chrome only — coral/rose is reserved for AI surfaces (CLAUDE.md §4),
// and this is navigation, not AI output.
import React from 'react';
import { Inbox } from 'lucide-react';
import { useEmailStore } from '../../../../store/emailStore';
import { useEmailUIStore } from '../../../../store/emailUIStore';
import type { EmailCategory } from '../../../../services/emailSyncService';

const OVERFLOW: { key: EmailCategory; label: string }[] = [
  { key: 'promotions', label: 'Promotions' },
  { key: 'updates', label: 'Updates' },
  { key: 'social', label: 'Social' },
];

export const CategoryOverflowHint: React.FC = () => {
  const categoryCounts = useEmailStore((s) => s.categoryCounts);
  const setCurrentFolder = useEmailStore((s) => s.setCurrentFolder);
  const setActiveCategory = useEmailStore((s) => s.setActiveCategory);
  const setMode = useEmailUIStore((s) => s.setEmailHybridMode);

  const items = OVERFLOW
    .map((o) => ({ ...o, count: categoryCounts?.[o.key] ?? 0 }))
    .filter((o) => o.count > 0);

  if (items.length === 0) return null;

  const total = items.reduce((n, o) => n + o.count, 0);

  const jump = (cat: EmailCategory) => {
    // setCurrentFolder resets activeCategory to 'primary', so set the target
    // category AFTER it; then switch the shell to the Inbox list view.
    setCurrentFolder('inbox');
    setActiveCategory(cat);
    setMode('inbox');
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-6 md:px-10 pt-4">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono-pulse tracking-wide-mono uppercase pulse-ink-3-color">
        <Inbox className="w-3 h-3" />
        {total} also waiting
      </span>
      <span className="pulse-ink-3-color opacity-50">·</span>
      {items.map((o, i) => (
        <React.Fragment key={o.key}>
          {i > 0 && <span className="pulse-ink-3-color opacity-40">·</span>}
          <button
            type="button"
            onClick={() => jump(o.key)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] pulse-ink-2-color hover:pulse-surface-raised hover:pulse-ink-color transition-transform active:scale-[0.97]"
            title={`View ${o.count} unread in ${o.label}`}
          >
            <span className="font-semibold tnum">{o.count}</span>
            <span>{o.label}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

export default CategoryOverflowHint;
