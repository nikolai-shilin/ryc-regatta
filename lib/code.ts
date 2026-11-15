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
