/**
 * Source provenance helpers — maps a task/decision `metadata.source` to a
 * label + icon, and renders a small SourceTag. Shared by the focal panes and
 * (eventually) the property table. The "multi-surface AI core" made visible.
 */
import { Mail, MessageSquare, Video, Mic, Pencil, type LucideIcon } from 'lucide-react';

export interface SourceMeta { key: string; label: string; Icon: LucideIcon; }

const SOURCE_MAP: Record<string, SourceMeta> = {
  email: { key: 'email', label: 'Email', Icon: Mail },
  messages: { key: 'messages', label: 'Messages', Icon: MessageSquare },
  meeting: { key: 'meeting', label: 'Meeting', Icon: Video },
  relay: { key: 'relay', label: 'Relay', Icon: Mic },
  manual: { key: 'manual', label: 'Manual', Icon: Pencil },
};

export function resolveSource(source?: string): SourceMeta | undefined {
  return source ? SOURCE_MAP[source] : undefined;
}

export function SourceTag({ source, withLabel = true }: { source?: string; withLabel?: boolean }) {
  const meta = resolveSource(source);
  if (!meta) return null;
  return (
    <span className="ck-source-tag" title={meta.label}>
      <meta.Icon size={12} />
      {withLabel && <span className="ck-source-tag-label">{meta.label}</span>}
    </span>
  );
}
