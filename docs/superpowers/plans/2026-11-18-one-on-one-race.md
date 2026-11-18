# The 1-on-1 Race Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Appendix C match race with an ordinary race between two human boats, sailed by the same rules as today's race.

**Architecture:** The new two-human rules go into `sim.js` beside match mode, then the screens learn to follow them, then the feature flips over, and only then does match mode come out. Every commit leaves a working game. The host's browser still runs the race over Supabase Realtime, and the guest's still follows it.

**Tech Stack:** Static ES modules under `public/game/` (no build step), Next.js 16 pages, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-18-one-on-one-race-design.md`

## Global Constraints

- A race with one human must not change: `npm test` keeps its single-player golden values (`GOLDEN_4242 = [null, 243.4, 274.6, 271.2, 216.7]`, `test/fixtures/*`) untouched.
- Networking stays out of `main.js`'s imports: `match-ui`, `match`, `net` and `wire` load only for a 1-on-1 race (`test/match-ui.test.mjs` checks this).
- Addresses, file names, channels and local-storage keys keep their `match` names.
- User-facing name: **1-on-1 race** / **Гонка один на один**. Every new string exists in English and Russian.
- `FINISH_LIMIT_S = 180`. The forfeit stays at 30 s of silence, a sleeping host's abandon at 60 s.
- **Commits:** straight to `main`, never staging in the shared index, because other sessions commit from this checkout. Use a private index: `GIT_INDEX_FILE=<scratch>/index git read-tree HEAD`, add only this task's paths, commit with `GIT_INDEX_FILE` set, then `git reset -q HEAD -- <paths>`, including any new files. If a path also holds another session's uncommitted hunks, `git hash-object -w` a version with only this task's hunks and use `git update-index --cacheinfo`.
- Commit messages are plain sentences saying what changed for the player, and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A guest whose page is reloaded after a general recall must pick up the host's flag, clock and recall count from the first snapshot. Pinned in Task 2.
2. A general recall under 150 ms of latency must leave the guest's clock on the host's, not stalled ahead of it. Pinned in Task 2.
3. A results message lost to a connection blink at the finish must still reach the guest. Pinned in Task 2.
4. A rematch started at once must ignore the last race's late results. Pinned in Task 2.
5. A host's saved match or settings in the old format, still on a phone after this ships, must open cleanly with defaults rather than throw. Pinned in Task 4.

---

### Task 1: The rules of a race with two humans

**Files:**
- Modify: `public/game/sim.js`
- Create: `test/one-on-one-rules.test.mjs`

**Interfaces:**
- Produces, in `sim.js`: `export const FINISH_LIMIT_S = 180`; `race.multi` (plain field, `humans.length > 1 && !match`); `race.validAt` (clock of the first valid finish, or `null`); `boat.dnf` (boolean); `race.forfeit(b)` as specified below.

- [ ] **Step 1: Write the failing tests**

Build races with `const duel = (o = {}) => new sim.Race({ preset: 'medium', length: 'short', seed: 11, fleet: 2, start: 1, humans: HUMANS, me: 'h', ...o })`, and copy `put`, `said` and `runUntil` from `test/match-rules.test.mjs`. To finish a boat, put her just on the course side of the line on the `finish` leg and sail her across. `seed` picks the flag: find a P, a U and a black seed with `['P','P','P','U','B'][seed % 5]`.

```js
test('two humans and no computer boats, on today\'s rules', () => {
  const r = duel();
  assert.equal(r.multi, true); assert.equal(r.boats.length, 2); assert.ok(r.boats.every((b) => b.human));
  assert.equal(r.zone, sim.ZONE);
  assert.equal(new sim.Race({ seed: 11 }).multi, false);
});
test('a contact foul starts a turn at once: one tack and one gybe', () => { /* collide port and starboard after the gun */
  assert.deepEqual(g.pen, { tack: false, gybe: false, dir: 0 }); assert.equal(said(r, 'fouled', g).length, 1); assert.equal(said(r, 'theyFouled', h).length, 1);
});
test('home with a penalty unserved is disqualified, and starts no limit', () => { assert.equal(g.dsq, true); assert.equal(r.validAt, null); assert.equal(r.winner, null); assert.equal(r.over, false); });
test('a boat out under the black flag starts no limit when she crosses first', () => { assert.equal(r.validAt, null); assert.equal(r.over, false); });
test('the race is over when both are home; the winner, her margin and the places', () => {
  assert.equal(r.winner, h); assert.equal(r.margin, g.finish - h.finish); assert.equal(h.place, 1); assert.equal(g.place, 2); assert.equal(r.over, true);
});
test('3 minutes after the first valid finish the other boat is DNF', () => {
  r.clock = h.finish + sim.FINISH_LIMIT_S - 0.01; r.step(1 / 60); r.step(1 / 60);
  assert.equal(g.dnf, true); assert.equal(g.done, false); assert.equal(r.over, true); assert.equal(r.winner, h); assert.equal(r.margin, null);
});
test('crossing first does not end the race for the boat still sailing', () => { assert.equal(r.over, false); });
test('a finished boat can\'t touch the other or take her wind', () => {
  /* h done, g placed overlapping her, then directly downwind of her */
  assert.equal(g.v, vBefore); assert.equal(said(r, 'bump', g).length, 0); assert.equal(r.windAt(g).shadow, 0);
});
test('a finished boat can\'t forfeit', () => { r.forfeit(h); assert.equal(r.over, false); assert.equal(r.forfeited, null); });
test('a forfeit gives the race to the other boat, unless she is out', () => {
  r.forfeit(g); assert.equal(r.winner, h); assert.equal(r.forfeited, g); assert.equal(r.over, true);
  r2H.bfd = true; r2.forfeit(r2G); assert.equal(r2.winner, null); assert.equal(r2.over, true);
});
test('the other boat hails a boat that must keep clear', () => { assert.equal(said(r, 'hail', port).length, 1); });
test('both over at the gun is a general recall', () => { assert.equal(r.recalls, 1); assert.equal(r.prepFlag, 'U'); });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/one-on-one-rules.test.mjs`
Expected: FAIL, with `r.multi` undefined.

- [ ] **Step 3: Implement in `public/game/sim.js`**

- Constructor: `this.multi = humans.length > 1 && !match; this.validAt = null;` before any boat is built.
- `progress()` finish branch: replace `else if (b === this.player) this.over = true` with a call to `homeMulti(b)` when `this.multi`, keeping the single-human line otherwise. `homeMulti(b)`: if `!b.dsq`, the first such boat sets `winner` and `validAt`, the next sets `margin`; `over` when every human is `done`.
- `step()`: after the `progress` loop, when `multi && validAt !== null && !over && clock >= validAt + FINISH_LIMIT_S`, mark every unfinished human `dnf` and set `over`.
- `forfeit(b)` when `multi`: return if `b.done`. `forfeited = b`, `over = true`, `margin = null`. Keep an existing `winner`; otherwise the other human wins unless she has `ufd`, `bfd` or `dsq`, in which case `winner = null`.
- `windAt()`, both boat loops: skip `o` when `this.multi && o.done`.
- `collide()`, the pair loop: skip the pair when `this.multi && (p.done || q.done)`.
- `hails()`: a human `o` hails too when `this.multi`, rate-limited by `o.hailT` as a computer boat is by `o.ai.hailT`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all pass, the golden values untouched.

- [ ] **Step 5: Commit** `public/game/sim.js` and `test/one-on-one-rules.test.mjs`.

---

### Task 2: The guest's screen follows today's rules

**Files:**
- Modify: `public/game/wire.js`, `public/game/match.js` (`Host`, `Guest` only)
- Create: `test/one-on-one.test.mjs`

**Interfaces:**
- Consumes: `race.multi`, `boat.dnf`, `race.forfeit` from Task 1.
- Produces, in `wire.js`: `thinTrack(track) -> [x, z][]` (at most 160 points, the last always kept, whole metres); `resultsOf(race) -> { seed, boats: [{ id, done, dsq, dnf, place, finish, pens, legT, track, log }] }`. Snapshots gain `p` (prepFlag) and `r` (recalls). Rows gain, after the last column, `[n+22]` bits `ufd, bfd, dnf, penTack, penGybe, penMr` and `[n+23]` the turn's direction.
- Produces, in `match.js`: `Host.guestLeft()`; `Host.acked` (boolean); `Host.flush()` (sends the results once a second until acked); `Guest.results` (the payload or `null`); `Guest.onResults(fn)`. Messages: `results` host → guest on `link.all`; `resultsOk { id, seed }` guest → host on `link.input`. `resultsOf` takes the seed from `race.seed`, so the `Race` constructor stores `this.seed = seed`.

- [ ] **Step 1: Write the failing tests**

Reuse `duel()`'s shape from `test/match.test.mjs`, with two plain races: `new Race({ ...SETTINGS, seed, fleet: 2, start: 1, humans: [h, g], me })`. Each test names the screen it checks.

```js
test('a foul: the turn\'s progress shows on the guest\'s screen, and the host alone pays it', () => { assert.deepEqual(d.me.pen, d.Gh.pen); assert.equal(d.heard.filter((m) => m === 'penaltyDone').length, 0); });
test('the turn paid on the host\'s copy is told to the guest once', () => { assert.equal(d.me.events.filter((e) => e === 'penaltyDone').length, 1); });
test('the U and black flags reach the guest: flag and disqualification', () => { assert.equal(d.grace.prepFlag, d.hrace.prepFlag); assert.equal(d.me.ufd, true); });
test('a general recall: the guest takes the host\'s clock, backwards, and her tracks start again', () => {
  assert.equal(d.grace.recalls, 1); assert.ok(Math.abs(d.grace.clock - d.hrace.clock) < 0.5); assert.equal(d.grace.prepFlag, 'U');
});
test('a general recall under 150 ms each way leaves the two clocks together', () => { assert.ok(Math.abs(d.grace.clock - d.hrace.clock) < 0.5); });
test('a guest reloaded after a recall reads the flag, clock and count from the first snapshot', () => { assert.equal(fresh.race.recalls, 1); assert.equal(fresh.race.prepFlag, 'U'); });
test('a guest finished, then silent: no forfeit; the race runs out to its end', () => { assert.equal(d.hrace.forfeited, null); assert.equal(d.hrace.over, false); });
test('a guest silent 30 s before her finish forfeits', () => { assert.equal(d.hrace.forfeited, d.Gh); assert.equal(d.hrace.winner, d.H); });
test('guestLeft before her finish forfeits at once; after it the race runs on', () => {});
test('DNF reaches the guest with the race\'s end', () => { assert.equal(d.me.dnf, true); assert.equal(d.grace.over, true); });
test('the results reach the guest, and go on until she answers', () => {
  // drop the first results message
  assert.ok(d.guest.results); assert.equal(d.host.acked, true);
  assert.deepEqual(d.guest.results.boats.find((b) => b.id === 'g').log.fouls, d.Gh.log.fouls.map(plain));
});
test('results of another seed are ignored', () => { assert.equal(d.guest.results, null); });
test('thinTrack keeps the last point and at most 160', () => {});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/one-on-one.test.mjs`
Expected: FAIL, with `thinTrack` missing.

- [ ] **Step 3: Implement `wire.js`**

Add the fields above to `rowOf`, `readBoat`, `setBoat` and `encodeSnap`. In `setBoat`, `b.pen` becomes `o.penOn ? (o.penMr ? b.pen || { mr: true } : { tack: o.penTack, gybe: o.penGybe, dir: o.penDir }) : null`, a fresh object each time, so the guest's own step can't change the host's word. `applySnap` takes `race.prepFlag = s.p ?? race.prepFlag`.

- [ ] **Step 4: Implement `Host` and `Guest` in `match.js`**

- `Host.tick`: `race.forfeit(g)` and the holding of her course apply only while `!g.done`. `guestLeft()` calls `race.forfeit(this.guest)`, which does nothing once she has finished. `_end()` builds `resultsOf(race)` once and `flush()` sends it.
- `Guest._onSnap`: before `applySnap`, when `s.r !== undefined && s.r !== race.recalls`, call `_recalled(s)`: take `s.r`, set `race.clock = s.c`, set `race.trackT = s.c - race.clock0`, clear every boat's `track` and `legT`, and clear `_offs`, `_hist` and `_err`, with `_trackC = -Infinity` and `_stamp = true`.
- `Guest._onSnap`'s turn-paid test: `pen && !me.pen && (race.multi || me.owed < owed)`.
- `Guest.frame`: keep a copy of `me.pen` across her own step, so that step can't change the host's turn.
- `Guest` listens for `results`, ignores a different `seed`, keeps the first, always answers `resultsOk`, and calls `onResults`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: all pass, including `test/match.test.mjs` unchanged.

- [ ] **Step 6: Commit** `public/game/wire.js`, `public/game/match.js`, `public/game/sim.js` (for `this.seed`) and `test/one-on-one.test.mjs`.

---

### Task 3: The game's screens know a shared race

**Files:**
- Modify: `public/game/main.js`, `public/game/stats.js`, `public/game/world.js`
- Test: `test/match-ui.test.mjs`

**Interfaces:**
- Consumes: `race.multi`, `resultsOf`'s payload.
- Produces, in `main.js`: `resultRecord(race) -> Result` (today's record, extracted from `finishToPage` with no change to its output for a single human); `keepResult(res)` (the twenty-race local store); `keepOneOnOne(race, results) -> id`, which builds the record with `oneOnOne: true`, `pb: null`, the boats' `track`, `legT`, `pens`, `dnf` and the sailor's own `log` from `results`, and saves it without posting. `openResult(id)` goes to `/race/result/<id>`. Both are handed to `startMatch` as options.

- [ ] **Step 1: Write the failing tests** in `test/match-ui.test.mjs`, as source checks in the file's style:

```js
test('a shared race posts nothing and never jumps to the result page at the finish', () => {
  const stats = read('../public/game/stats.js'), main = read('../public/game/main.js');
  assert.equal((stats.match(/race\.multi/g) || []).length, 5);
  assert.match(main, /if \(!race\.multi\) setTimeout\(finishToPage/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/match-ui.test.mjs`
Expected: FAIL on the count.

- [ ] **Step 3: Implement**

- `stats.js`: the five `race.match` guards become `(race.match || race.multi)`.
- `main.js`: the `finished` branch of `handleMessages` skips `raceFinished` and `finishToPage` when `race.multi`. `personalBest` is never called for one. `paintPause`'s label uses `race.multi ? t('timeOne')`, with `timeOne: '1-on-1 race'` / `'гонка один на один'`.
- `world.js`: `boatView`'s `other` and the label at the penalty turn read `race.match || race.multi`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit** the three game files and the test.

---

### Task 4: The 1-on-1 race goes live

**Files:**
- Modify: `public/game/match.js` (`Room.start`, `Match`, `Keeper`, `raceFor`), `public/game/match-ui.js`, `public/game/main.js` (`matchView`, the loader's card)
- Modify: `test/match.test.mjs`, `test/match-ui.test.mjs`

**Interfaces:**
- Consumes: everything from Tasks 1 to 3.
- Produces, in `match.js`:
  - `cleanSettings(s, { venue, yacht }) -> { venue, yacht, preset, length, course, laps, start, current, daytime }`. Defaults: `medium`, `short`, `wl`, `1`, `1`, `0`, `any`. Allowed: preset `light|medium|strong`; length `short|medium|long`; course `wl|tri|trap|wlu`; laps `1|2`; start `1|3|5`; current `0|1`; daytime `any|morning|midday|afternoon|evening|sunset`.
  - `Match`: `state` is `'race'` or `'over'`; `result` is `{ winner, margin, forfeited, abandoned }` or `null`; `endRace(result)`, `leave(id)`, `present(id, on)`, `tick()`, `toJSON()`, `static from(json, now)`. It has no score, `races`, `raceN`, `blueOf`, `ready` or `nextRace`.
  - `raceFor(match, myId)`: a plain `Race` from the settings with `seed: start.seed`, `fleet: 2`, `current: !!s.current`, and humans ordered `[host, guest]` on an even seed and `[guest, host]` on an odd one.
  - `Keeper` keeps who is present and `loaded`, and loses `ready`, `readyMe`, `left` and `cardOpenAt`.

- [ ] **Step 1: Rewrite the failing tests in `test/match.test.mjs`**

Delete the best-of-three, colours, Ready and between-races tests, and change `duel()` and `underWay()` to the plain race. Add:

```js
test('cleanSettings keeps a good race and repairs a bad or old one', () => {
  assert.deepEqual(cleanSettings({ preset: 'strong', length: 'long', course: 'trap', laps: 2, start: 5, current: 1, daytime: 'sunset' }, here), { ...here, preset: 'strong', length: 'long', course: 'trap', laps: 2, start: 5, current: 1, daytime: 'sunset' });
  assert.deepEqual(cleanSettings({ preset: 'x', length: 'short', course: 'zz', laps: 9 }, here), { ...here, preset: 'medium', length: 'short', course: 'wl', laps: 1, start: 1, current: 0, daytime: 'any' });
});
test('both screens build the same race from the settings', () => { assert.deepEqual(a.boats.map((b) => b.id), b.boats.map((b) => b.id)); assert.equal(a.course.type, 'tri'); assert.equal(a.seq.length, 3); });
test('the seed decides who has which start position', () => { assert.equal(raceFor(even, 'h').boats[0].id, 'h'); assert.equal(raceFor(odd, 'h').boats[0].id, 'g'); });
test('a reloaded host: the race on the water is abandoned', () => { assert.equal(m.state, 'over'); assert.equal(m.result.abandoned, true); });
test('a host\'s match saved in the old format opens as no race at all, without a throw', () => {
  const m = Match.from({ start: oldStart, state: 'between', raceN: 2, score: { h: 1, g: 0 }, races: [{ winner: 'h' }] });
  assert.equal(m.state, 'over'); assert.equal(m.result.abandoned, true);
});
test('gone five minutes: the race is over', () => {});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/match.test.mjs`
Expected: FAIL, with `cleanSettings` missing.

- [ ] **Step 3: Implement `match.js`** to the interfaces above. `Room.start`'s message drops `race` and `blue`.

- [ ] **Step 4: Implement `match-ui.js`**

- Take `hostSettings` from `M.cleanSettings(store(SETTINGS_KEY), { venue: venue.id, yacht: cls.id })`, and give `enterRace` `race.settings = { ...match.start.settings, fleet: 2, daily: null }`.
- Remove the HUD strip, `SIDE_HEX`, blue and yellow, the umpire debug panel, the Ready button and the score.
- **While a finished boat waits:** a note with the other's name and the time left (`FINISH_LIMIT_S` less the time since `race.validAt`). For the host it adds "keep this screen open".
- **Leaving during the race:** a guest's `leave` before the end calls `cur.H.guestLeft()`. A host's Leave sends `abandon` and `leave`, and the guest's card says abandoned.
- **The card:** first and second with the gap, DSQ or DNF in place of a place, and an abandoned state with no Full result. Buttons: Rematch (host, both present), Full result (once this screen's results are in), Done.
- **Results:** the host keeps its `Host` alive after the card opens and calls `flush()` from the `beat` until `acked` or 30 s. Each screen calls `keepOneOnOne` once as soon as it has the results.
- Rewrite `MATCH_STRINGS` to match, in both languages.

- [ ] **Step 5: Implement `main.js`**

`matchView` builds a plain two-human `Race` from the saved `regatta-match-settings`, applying `cleanSettings`' defaults by hand, because `main.js` must not import `match.js`. The loader's card shows one race and its laps.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: all pass, including `test/match-rules.test.mjs`, since match mode is still in `sim.js`.

- [ ] **Step 7: Commit** the listed files.

---

### Task 5: Match mode comes out

**Files:**
- Modify: `public/game/sim.js`, `public/game/wire.js`, `public/game/main.js`, `public/game/world.js`, `public/game/stats.js`, `test/weather.test.mjs`, `test/match-ui.test.mjs`, `test/one-on-one-rules.test.mjs`
- Delete: `test/match-rules.test.mjs`

- [ ] **Step 1: Move the golden test, and write the replacement river test**

Move `sailScripted`, `GOLDEN_4242` and its test into `test/one-on-one-rules.test.mjs`, renamed `'a free race is unchanged by the 1-on-1 race'`, with the values as they stand. In `test/weather.test.mjs`, replace the match test with `'a 1-on-1 race on a river has the river\'s current'`, asserting `> 0`. Add to `test/match-ui.test.mjs`:

```js
test('no Appendix C is left in the game', () => {
  for (const f of ['sim', 'wire', 'main', 'world', 'stats']) assert.doesNotMatch(read(`../public/game/${f}.js`), /race\.match|this\.match|\.owed|placeMatch|matchTurn|matchPens|umpire\(\)|UMPIRE|sternFlag|penMr/, f);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/match-ui.test.mjs test/weather.test.mjs`
Expected: FAIL on both new tests.

- [ ] **Step 3: Delete**

- `sim.js`: `match`, `blue`, `placeMatch`, `entry`, `matchPens`, `matchTurn`, `umpire`, `closing`, `UMPIRE`, `calls`, `incidents`, `pairKey`, `inIncident`, `owed`, every `if (this.match)`, and `this.zone`'s two-length case. `this.multi = humans.length > 1`. Keep `b.hist` (rule 16 reads it) and the seed's draw before `prepFlag`.
- `wire.js`: `owed`, `side`, `entered` and `penMr`, renumbering the row columns and the comment above them.
- `main.js`: `matchMessage` and its strings, `P.pen.mr`, the `ump` line.
- `world.js`: `sternFlag`. `stats.js`: the `race.match ||` halves. `test/match-rules.test.mjs`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all pass, with `GOLDEN_4242` and `test/fixtures/*` untouched.

- [ ] **Step 5: Commit** the listed files, including the deletion.

---

### Task 6: The set-up, the result page and the words

**Files:**
- Modify: `components/free-setup.tsx`, `components/result-view.tsx`, `components/hub-client.tsx`, `components/home-back.tsx`, `components/home-client.tsx`, `app/[lang]/match/new/page.tsx`, `app/[lang]/match/[code]/page.tsx`, `app/og/page/[key]/route.tsx`, `README.md`, `docs/superpowers/specs/2026-11-15-match-race-design.md`
- Test: `test/site.test.mjs`, `test/log.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// test/log.test.mjs
test('a 1-on-1 race finished earns the venue\'s stamp, and one not finished doesn\'t', () => {
  addResult(l, { at: 70, daily: null, oneOnOne: true, venue: 'kiel', boats: [{ me: true, done: true, dsq: false, secs: 300 }] });
  assert.equal(l.v.kiel, 70);
  addResult(l, { at: 80, daily: null, oneOnOne: true, venue: 'sydney', boats: [{ me: true, done: false, dsq: false, dnf: true, secs: null }] });
  assert.equal(l.v.sydney, undefined);
});
// test/site.test.mjs
test('the 1-on-1 race is named as such, and its set-up offers all but the fleet', () => {
  for (const f of ['components/hub-client.tsx', 'components/home-back.tsx', 'components/home-client.tsx', 'app/og/page/[key]/route.tsx', 'app/[lang]/match/[code]/page.tsx']) {
    assert.match(read(f), /1-on-1 race|1-on-1/, f); assert.doesNotMatch(read(f), /Match race|Матчевая/, f);
  }
  const setup = read('components/free-setup.tsx');
  assert.doesNotMatch(setup, /!match && l === 'long'|!match && tags\('(course|laps|start|current|daytime)'/);
  assert.match(setup, /!match && tags\('fleet'/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/site.test.mjs test/log.test.mjs`
Expected: the site test FAILS. The log test may already pass, since `addResult` needs no change: it pins the decision.

- [ ] **Step 3: Implement the set-up**

In `free-setup.tsx`, a `match` set-up opens with today's settings (the `fromToday` branch of the first `useEffect`). Remove the "never long" effect and every `!match &&` except the fleet's. `go()` saves `{ venue, yacht, preset, length, course, laps, start, current, daytime }` to `regatta-match-settings`.

- [ ] **Step 4: Implement the result page**

In `result-view.tsx`, `Result` gains `oneOnOne?: boolean`, and boats gain `dnf?: boolean`. For a `oneOnOne` record: the kicker reads `1-on-1 race · …`, the title reads "Did not finish" for a DNF, the place column shows DNF, the main button goes to `/match/new`, and the share button, ghost, target and personal-best notes are hidden.

- [ ] **Step 5: Change the words**

Replace the match-race wording in the listed pages and the README. Update the `?match` note in the README: the gate now waits for the owner's test race. Add `Status: replaced by 2026-11-18-one-on-one-race-design.md.` to the top of the old spec. The venue guides stay as they are.

- [ ] **Step 6: Run the tests and the type check**

Run: `npm test && npm run typecheck`
Expected: all pass, no type errors.

- [ ] **Step 7: Commit** the listed files.

---

### Task 7: Sail it in two tabs

**Files:** none, unless a fault is found.

- [ ] **Step 1: Start the dev server** with `preview_start` (the project's `.claude/launch.json` entry), and open `/match/new` in one tab and the link it gives in a second.

- [ ] **Step 2: Sail a race, checking each of these on both screens**

The set-up's options and today's defaults; the waiting room; the chosen start sequence; a contact foul and its penalty turn; the finish, the wait note and the time left; the results card; Rematch with new start positions; Full result with both boats and no ghost or share; Leave by each side during a race. Read the console with `read_console_messages` after each.

Expected: both screens agree on every call, with no console errors.

- [ ] **Step 3: Fix any fault found**, with a test where the fault is in `sim.js`, `wire.js` or `match.js`, and commit it.
