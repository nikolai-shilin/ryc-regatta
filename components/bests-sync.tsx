'use client';
import { useEffect } from 'react';
import { BOAT_EVENT, BOAT_KEY, mergeBoat, saveBoat } from '@/lib/boat';
import { cleanLog, harvest, LOG_EVENT, mergeLog, saveLog, sameLog } from '@/lib/log';

// A signed-in player's personal bests and boat follow them to any device, and to any address of the site (the
// browser keeps localStorage per address). The game keeps both on the device; the account keeps a copy in its
// user_metadata, pb and boat.
//
// Personal bests: localStorage regatta-pb ({ course key: seconds }, public/game/main.js personalBest). The two are
// merged, the faster time of each course winning, and each side gets what it lacks. Daily bests older than a week are
// dropped, as the game drops them.
//
// The boat: localStorage regatta-boat (lib/boat.ts). The one changed last wins (mergeBoat); the boat page tells this
// to run again after every change, so a boat set on one device is the other's by its next page.
//
// The log (lib/log.ts: the days you finished today's race, the venues you've raced): gathered on every page from what
// the game keeps, signed in or not, and for a signed-in player merged with the account's (user_metadata.log).
//
// It runs on every page, and the race is always reached through these pages (the hub, the free race, a result).
const KEY = 'regatta-pb', WEEK = 7 * 864e5;
type Bests = Record<string, number>;

const clean = (b: unknown): Bests => {
  const out: Bests = {}, cut = `daily|${new Date(Date.now() - WEEK).toISOString().slice(0, 10)}`;
  if (!b || typeof b !== 'object') return out;
  for (const [k, v] of Object.entries(b)) if (typeof v === 'number' && v > 0 && k.length < 60 && !(k.startsWith('daily|') && k < cut)) out[k] = v;
  return out;
};
const same = (a: Bests, b: Bests) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => a[k] === b[k]);
const read = (key: string) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };

// Only a signed-in player has anything to sync, and the session lives in the sb-…-auth-token cookie: without it
// there's nothing to do, and the Supabase client (~70 KB gzipped) isn't even downloaded. Most visitors are guests.
export async function syncAccount() {
  const log = harvest();
  if (!/(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/.test(document.cookie)) return;
  const { supabaseBrowser } = await import('@/lib/supabase/client');
  const supabase = supabaseBrowser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const data: Record<string, unknown> = {};

  const local = clean(read(KEY)), remote = clean(user.user_metadata?.pb), merged: Bests = { ...remote };
  for (const [k, v] of Object.entries(local)) if (!(merged[k] <= v)) merged[k] = v;
  if (!same(merged, local)) try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch {}
  if (!same(merged, remote)) data.pb = merged;

  const boat = mergeBoat(read(BOAT_KEY), user.user_metadata?.boat);
  if (boat.local) { saveBoat(boat.local, boat.local.at); dispatchEvent(new Event(BOAT_EVENT)); }
  if (boat.remote) data.boat = boat.remote;

  const remoteLog = cleanLog(user.user_metadata?.log), both = mergeLog(log, remoteLog);
  if (!sameLog(both, log)) { saveLog(both); dispatchEvent(new Event(LOG_EVENT)); }
  if (!sameLog(both, remoteLog)) data.log = both;

  if (Object.keys(data).length) await supabase.auth.updateUser({ data }); // merged into the metadata, the name kept
}

export function BestsSync() {
  useEffect(() => { syncAccount().catch(() => {}); }, []);
  return null;
}
