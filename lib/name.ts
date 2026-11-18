// A player's name carries no emoji: a keycap (1️⃣), a flag, a pictograph with its skin tone, joiners and variation
// selectors. Letters and digits of any script stay. lib/me.ts and public/game/match-ui.js keep their own copy of this
// pattern, since neither can import it (test/name.test.mjs holds the three together).
export const EMOJI = /[#*0-9]️?⃣|[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}][︎️‍\u{E0020}-\u{E007F}]*/gu;
export const noEmoji = (s: string) => s.replace(EMOJI, '').replace(/\s+/g, ' ').trim();
// a name as the scores API or an account holds it, saved before emoji were taken out: null when nothing else was in it,
// so the page says "No name" as it does for anyone without one
export const plainName = (name: string | null | undefined) => noEmoji(String(name || '')) || null;
export const plainRows = <T extends { name?: string | null }>(rows: T[]) => rows.map((r) => ({ ...r, name: plainName(r.name) }));

// The name on the ranking (user_metadata.display_name), as the sign-in step and Settings save it.
export const NAME_MAX = 24;
export const cleanName = (s: string) => noEmoji(s).slice(0, NAME_MAX);

// A name as the plain API's top three give it (api/game.mjs shortName): the first word, then the second's first letter
// ("Anna Petrova" → "Anna P."), so the home page and the hub show the top five as they showed the top three. The day's
// rating has the names as their sailors saved them.
export const shortName = (name: string | null) => {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  return w.length ? `${w[0].slice(0, 20)}${w[1] ? ` ${[...w[1]][0]}.` : ''}` : null;
};

// the avatar's letters: the first of the ranking name's first two words, else of the address's
export const initials = (name: string, email: string) => {
  const w = (name || email).trim().split(/[\s.@]+/).filter(Boolean);
  return ((w[0]?.[0] || '') + (w[1]?.[0] || '')).toUpperCase() || '·';
};
