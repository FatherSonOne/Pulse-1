/**
 * SavedViews — static view presets (handoff §4.2). v1 presets are not
 * user-persisted; selecting one applies a known filter combination upstream.
 */
import { useState } from 'react';
import { Layers, ChevronDown, Check } from 'lucide-react';

export interface SavedViewPreset {
  id: string;
  label: string;
}

interface SavedViewsProps {
  presets: SavedViewPreset[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function SavedViews({ presets, activeId, onSelect }: SavedViewsProps) {
  const [open, setOpen] = useState(false);
  const active = presets.find((p) => p.id === activeId) ?? presets[0];

  return (
    <div className="ck-sv">
      <button type="button" className="ck-pill" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <Layers size={13} className="ck-pill-icon" />
        <strong>{active.label}</strong>
        <ChevronDown size={12} className="ck-pill-icon" />
      </button>
      {open && (
        <>
          <div className="ck-menu-backdrop" onClick={() => setOpen(false)} aria-hidden />
          <div className="ck-menu" role="menu">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitemradio"
                aria-checked={p.id === activeId}
                className="ck-menu-item"
                onClick={() => { onSelect(p.id); setOpen(false); }}
              >
                {p.label}
                {p.id === activeId && <Check size={14} style={{ marginLeft: 'auto' }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
