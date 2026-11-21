// The race's files, fetched while Match found waits for Ready (components/duel-finder.tsx), so the game opens on a
// browser that already has them. The game is /play (public/play/index.html): its modules, three.js, the land round the
// course and the yachts' models. On Vercel each is served at an address with its content's hash, kept for good
// (scripts/stamp-game.mjs, next.config.ts), and /play's import map names those addresses; fetched at the same address
// here, the game takes them from the cache without asking again. Off Vercel the map has only three.js and the files
// are asked for again, answered "not modified". The land first (the biggest wait on a slow line), then the yachts,
// three.js and the modules, six at a time; progress is the share of files done.

// the yachts' own models (public/game/<id>.glb, loaded by boats3d.js for its class); every race also loads yacht.glb
// (yacht.js, the hull other boats share) and committee.glb (the committee boat). A yacht without one is built in code.
export const MODELS = ['ac75', 'bavaria46', 'dragon', 'j70', 'jclass', 'laser', 'optimist', 'rs21'];
const LAND = (venue: string) => (venue === 'gocek' ? ['/game/skopea.json', '/game/skopea.bin'] : [`/game/venues/${venue}.json`, `/game/venues/${venue}.bin`]);
const AT_ONCE = 6;

// what /play loads for this race, in the order to fetch it, at the addresses its import map gives
export function raceFiles(html: string, venue: string, yacht: string): string[] {
  let map: Record<string, string> = {};
  try { map = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '{}').imports ?? {}; } catch { /* no map: bare addresses */ }
  const at = (p: string) => map[p] ?? p;
  const modules = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1].replace(/\?v=[0-9a-f]+$/, ''));
  const three = map.three ? [map.three] : [];
  const files = [...LAND(venue), ...(MODELS.includes(yacht) ? [`/game/${yacht}.glb`] : []), '/game/yacht.glb', '/game/committee.glb'].map(at);
  return [...new Set([...files, ...three, ...modules.map(at)])];
}

// fetches them, telling onProgress the share done (0–1) after each; stops when `signal` aborts. Never throws: a file
// that fails is the game's to fetch again
export async function preloadRace(venue: string, yacht: string, onProgress: (done: number) => void, signal?: AbortSignal) {
  let html = '';
  try { html = await (await fetch('/play', { credentials: 'same-origin', signal })).text(); } catch { return; }
  const files = raceFiles(html, venue, yacht);
  let next = 0, done = 0;
  onProgress(0);
  const worker = async () => {
    while (next < files.length && !signal?.aborted) {
      const f = files[next++];
      try { await (await fetch(f, { credentials: 'same-origin', signal, priority: 'low' } as RequestInit)).arrayBuffer(); } catch { /* the game asks again */ }
      if (signal?.aborted) return;
      onProgress(++done / files.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, files.length) }, worker));
}
