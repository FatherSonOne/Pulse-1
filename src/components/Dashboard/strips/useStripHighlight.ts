import { useEffect, useRef, useState } from 'react';

/**
 * Tracks which rows in a strip just arrived via Realtime so the consumer can
 * paint them with the Coral Heartbeat animation once, then let them rest.
 *
 * Pass the current list of row IDs each render. On the *first* observation
 * the highlight set stays empty (initial paint is not "new"). After that,
 * any ID that wasn't previously seen becomes a highlight for 700ms.
 */
export function useStripHighlight(ids: string[]): Set<string> {
  const seenRef = useRef<Set<string> | null>(null);
  const [highlight, setHighlight] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const idSet = new Set(ids);

    if (seenRef.current === null) {
      seenRef.current = idSet;
      return;
    }

    const fresh: string[] = [];
    idSet.forEach(id => {
      if (!seenRef.current!.has(id)) fresh.push(id);
    });

    if (fresh.length === 0) {
      seenRef.current = idSet;
      return;
    }

    setHighlight(prev => {
      const next = new Set(prev);
      fresh.forEach(id => next.add(id));
      return next;
    });
    seenRef.current = idSet;

    const t = window.setTimeout(() => {
      setHighlight(prev => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        fresh.forEach(id => next.delete(id));
        return next;
      });
    }, 700);

    return () => window.clearTimeout(t);
  }, [ids]);

  return highlight;
}
