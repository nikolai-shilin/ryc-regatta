// Where to go after signing in: only a path on this site. A browser's URL parser drops tabs and newlines and reads a
// backslash as a slash, so '/\t/evil.com' or '/\\evil.com' would become '//evil.com', another site: a path with any
// control character or backslash is refused, as is one that starts '//'.
export const safeNext = (v: string | null | undefined, fallback = '/race') =>
  v && v.startsWith('/') && !v.startsWith('//') && !/[\x00-\x1f\x7f\\]/.test(v) ? v : fallback;
