// A match's link code: six characters with no look-alikes (no I, L, O, 0, 1), safe to read out over a call.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-HJ-KM-NP-Z2-9]{6}$/;

export function newCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return s;
}

// The code in a link's address (/match/k7m2qz, /match/%4B7M2QZ), or null: never a throw for a malformed escape (/match/%)
export function parseCode(raw: string): string | null {
  let c: string;
  try { c = decodeURIComponent(raw); } catch { return null; }
  c = c.toUpperCase();
  return CODE_RE.test(c) ? c : null;
}
