import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query and return whether it currently matches.
 *
 * Used to drive JS-side responsive layout where Tailwind responsive *variants*
 * are unreliable (e.g. the Contacts panes, whose `lg:`/arbitrary utilities the
 * dev-server JIT doesn't always regenerate). Static classes still work, so the
 * pattern is: read a boolean here, then pick between two STATIC class strings.
 *
 * SSR/first-paint safe: returns `false` until the effect runs on the client.
 *
 *   const isDesktop = useMediaQuery('(min-width: 768px)');
 */
export function useMediaQuery(query: string): boolean {
  // Read synchronously on first render so the value is correct from the start
  // (no desktop->mobile flash that could mis-fire mount effects keyed on it).
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export default useMediaQuery;
