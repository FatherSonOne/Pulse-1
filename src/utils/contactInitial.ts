// ============================================
// CONTACT INITIAL
// Unicode-safe initial extraction for avatar badges.
//
// Display names in Pulse can legitimately contain leading punctuation,
// emoji, or symbols (e.g. `{Lucca} Messana`, `#BAL - Check Balance`,
// `🎉 Party`). `name.charAt(0)` renders the literal `{`/`#`/emoji surrogate,
// which looks broken in a circular avatar.
//
// This helper scans for the first Unicode letter and returns its uppercase
// form. If no letter is found, it falls back to the first non-whitespace
// char, and finally to `?` so the avatar never renders empty.
//
// DO NOT use this for the rendered name — display names stay verbatim
// (see MEMORY: "Pulse Contact Name Braces"). This is purely the avatar
// initial logic.
// ============================================

export function getContactInitial(name: string | null | undefined): string {
  if (!name) return '?';

  // `\p{L}` matches any Unicode letter — Latin, Cyrillic, CJK, etc.
  // The `u` flag is required for Unicode property escapes.
  const letterMatch = name.match(/\p{L}/u);
  if (letterMatch) {
    return letterMatch[0].toUpperCase();
  }

  // No letter at all (e.g. `#### marker`, `🎉 Party` without trailing letters
  // already covered above, or pure punctuation). Fall back to first
  // non-whitespace char so the badge is non-empty.
  const nonWhitespace = name.match(/\S/);
  if (nonWhitespace) {
    return nonWhitespace[0];
  }

  return '?';
}
