'use client';
import { useEffect, useRef, useState } from 'react';
import { readMe } from './me';

// The key of your own card on /players (?p=<k>), for the menu's row and for knowing a card is yours. The scores server
// makes it from a secret of its own, so it is asked for (app/auth/player, with the session) once you are signed in, when
// it is needed, not on every page load; null until then, and for a guest or an account that has never raced (not a
// player yet). A key found is kept for the tab, under who it is for (as lib/me.ts reads the session), so the next page
// has it at once; Sign out forgets it. Not having one is not kept: it is asked again on the next page, so a first race
// shows the card soon after.
const CARD = 'regatta-card';
const cardWho = () => { const m = readMe(); return m ? `${m.provider}|${m.email}|${m.name}` : null; };
export const forgetCard = () => { try { sessionStorage.removeItem(CARD); } catch {} };
export function useCardKey(): [string | null, () => void] {
  const [k, setK] = useState<string | null>(null);
  const asked = useRef(false);
  useEffect(() => {
    try {
      const c = JSON.parse(sessionStorage.getItem(CARD) || 'null');
      if (c && typeof c.k === 'string' && c.who === cardWho()) { setK(c.k); asked.current = true; }
    } catch {}
  }, []);
  const ask = () => {
    const who = cardWho();
    if (asked.current || !who) return;
    asked.current = true;
    fetch('/auth/player', { cache: 'no-store' }).then((r) => (r.status === 200 ? r.json() : null)).catch(() => null).then((j) => {
      const key = typeof j?.k === 'string' ? j.k : null;
      setK(key);
      if (key) try { sessionStorage.setItem(CARD, JSON.stringify({ who, k: key })); } catch {}
    });
  };
  return [k, ask];
}
