/**
 * SourceContext — surfaces where a task/decision came from ("Extracted from
 * Email" + the original quote), making the cross-surface AI provenance
 * first-class (handoff §4.6, elevated). Renders nothing when there's no source.
 */
import { ArrowRight } from 'lucide-react';
import { resolveSource, SourceTag } from '../sources';

interface SourceContextProps {
  source?: string;
  /** Short provenance meta, e.g. sender / channel / meeting title. */
  meta?: string;
  /** The original excerpt the item was extracted from. */
  quote?: string;
  onOpen?: () => void;
}

export function SourceContext({ source, meta, quote, onOpen }: SourceContextProps) {
  const resolved = resolveSource(source);
  if (!resolved) return null;

  return (
    <div className="ck-source-context">
      <div className="ck-source-context-head">
        <SourceTag source={source} />
        {meta && <span className="ck-source-context-meta">· {meta}</span>}
        {onOpen && (
          <button type="button" className="ck-source-context-open" onClick={onOpen}>
            Open <ArrowRight size={11} />
          </button>
        )}
      </div>
      {quote && <p className="ck-source-context-quote">“{quote}”</p>}
    </div>
  );
}
