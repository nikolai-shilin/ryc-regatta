// The name on the ranking (user_metadata.display_name), as the sign-in step and Settings save it.
export const NAME_MAX = 24;
export const cleanName = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);

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
