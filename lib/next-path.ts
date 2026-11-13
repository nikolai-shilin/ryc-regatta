// Where to go after signing in: only a path on this site.
export const safeNext = (v: string | null | undefined, fallback = '/race') =>
  v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : fallback;
