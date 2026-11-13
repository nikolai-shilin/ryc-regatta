'use client';
import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

// Personal bests follow a signed-in player to any device. The game keeps them on the device, in localStorage under
// regatta-pb ({ course key: seconds }, public/game/main.js personalBest); the account keeps a copy in its
// user_metadata.pb. On every page the two are merged, the faster time of each course winning, and each side gets what
// it lacks. The race is always reached through these pages (the hub, the free race, a result), so a best set on one
// device is on the other by its next race. Daily bests older than a week are dropped, as the game drops them.
const KEY = 'regatta-pb', WEEK = 7 * 864e5;
type Bests = Record<string, number>;

const clean = (b: unknown): Bests => {
  const out: Bests = {}, cut = `daily|${new Date(Date.now() - WEEK).toISOString().slice(0, 10)}`;
  if (!b || typeof b !== 'object') return out;
  for (const [k, v] of Object.entries(b)) if (typeof v === 'number' && v > 0 && k.length < 60 && !(k.startsWith('daily|') && k < cut)) out[k] = v;
  return out;
};
const same = (a: Bests, b: Bests) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => a[k] === b[k]);

export function BestsSync() {
  useEffect(() => {
    let local: Bests = {};
    try { local = clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const remote = clean(user.user_metadata?.pb), merged: Bests = { ...remote };
      for (const [k, v] of Object.entries(local)) if (!(merged[k] <= v)) merged[k] = v;
      if (!same(merged, local)) try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch {}
      if (!same(merged, remote)) await supabase.auth.updateUser({ data: { pb: merged } }); // merged into the metadata, the name kept
    }).catch(() => {});
  }, []);
  return null;
}
