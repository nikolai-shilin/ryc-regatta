# Match Race Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A host sets up a match, sends one friend a link, and the two sail a best-of-three match race against each
other live, under Appendix C's rules, with the host's browser running the race.

**Architecture:** `sim.js` learns two human boats (exactly as the club race plan's Task 1 describes, so the club race
can build on it later) and a `match` mode: blue and yellow, the entry, penalties owed and taken by choice, the
two-length zone, an umpire that calls a failure to keep clear without contact, and a winner. A dependency-free
Supabase Realtime client (`net.js`, the club plan's) carries a DOM-free match protocol (`match.js`: the waiting room,
the score, the host and the guest), with the generic input and snapshot code in `wire.js`. `match-ui.js` and small
changes to `main.js` and `world.js` put it on screen; Next.js adds `/match/new`, `/match/<code>` and `/connect`.

**Tech Stack:** Plain ES modules in `public/game/` (no build step), Supabase Realtime over a raw WebSocket (Phoenix
JSON protocol v1), Next.js 16 App Router, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-15-match-race-design.md` (read it first; it is the reason for every rule
below). Shared pieces follow `docs/superpowers/plans/2026-11-14-club-race.md`, Tasks 1, 2 (`stepView` only) and 4.

## Global Constraints

- Work on `main` in the main checkout; no worktrees or branches (the owner's standing preference). Others commit to
  `main` too: refer to `sim.js` and `main.js` by function name, not line number, and commit only your own files.
- `public/game/` stays build-free ES modules. No `@supabase/*` package in the game; `net.js` speaks the protocol
  itself, and only a match imports it (dynamic `import()`), with `match.js`, `wire.js` and `match-ui.js`.
- Today's race and the free race behave exactly as before: the golden test (Task 1) stays green after every task.
- Supabase project `iyt-test` (`xpdhkahgvusuicynssxq`), Pro: 500 messages/s, 500 connections per project. A match
  stays under 30 messages a second.
- Rates: snapshots 10 Hz; inputs on change, at most 10/s, at least 2/s; waiting-room hello every 3 s.
- Times: guest silent 3 s → her boat holds course; 30 s → the race goes to the host. Host silent 3 s → the guest's
  screen freezes with "Waiting for <host>"; 60 s → the race is abandoned, not scored. Between races: both Ready, or
  60 s with both present; never with one missing. Leave, or 300 s gone, ends the match.
- Match: best of three, first to two. Host blue in race 1, swapping each race. Course `wl`, 2 laps, length `short` or
  `medium`, no current, the five-minute sequence, preparatory flag P, no general recall.
- Codes: 6 characters of `ABCDEFGHJKMNPQRSTUVWXYZ23456789`. The link is `/match/<code>?v=<venue>&b=<yacht>`.
- Every user-facing string in English and Russian (`t('…', '…')` on pages; the `T` tables in `main.js`).
- Nothing is posted to the scores server from a match (`stats.js` skips it).
- `npm test`, `npm run typecheck` and `npm run build` pass at the end of every task.

## Review Focus

1. **Both boats over the line at the gun.** Expected: each is recalled on her own (X flag) and must come back; no
   general recall with two boats. → Task 2, `test: both over at the gun are each recalled, no general recall`.
2. **A penalty turned before the start.** Expected: a penalty given in the pre-start stays owed until a qualifying
   turn after the gun; circling in the box doesn't pay it. → Task 2, `test: a penalty can't be paid before the start`.
3. **Crossing the finish with a penalty owed.** Expected: it doesn't count, she's told, and her finish is when she
   recrosses after taking it; if the other boat finishes meanwhile, she loses. → Task 2, `test: a finish with a
   penalty owed counts only after the turn`.
4. **The guest's phone sleeps between races.** Expected: the next race waits for her, the score is untouched, and the
   match ends only after 300 s gone or Leave. → Task 5, `test: between races the match waits for a missing player`.
5. **The guest reloads mid-race, or a third person opens the link.** Expected: the guest's same id comes back as the
   guest and steers again from the next snapshot; anyone else sees "This match is full". → Task 5, `test: a third
   person is told the match is full`, and Task 6, `test: a guest who reloads steers her boat again`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `public/game/sim.js` (modify) | Two human boats (club plan Task 1); `stepView` (club plan Task 2); `match` mode: sides, entry, penalties owed, Appendix C turns, the zone, the umpire, the winner. |
| `public/game/net.js` (create) | The club plan's Realtime broadcast client. |
| `public/game/wire.js` (create) | `controlsOf`, `applyControls`, `encodeSnap`, `applySnap`: generic, for the club race to reuse. |
| `public/game/match.js` (create) | DOM-free: `makeLink`, `Room`, `Match` (score and states), `Host`, `Guest`. |
| `public/game/match-ui.js` (create) | The waiting room, the between-race card, the match card, the waiting overlay, the umpire debug overlay. |
| `public/game/main.js`, `world.js`, `stats.js` (modify) | The match branch: race creation, loop, inputs, messages to your boat, no pause; the other human's look and her blue or yellow flag; no scores posted. |
| `lib/code.ts` (create) | `CODE_ALPHABET`, `newCode()`, `CODE_RE` (the club plan's `lib/club.ts` would re-export these). |
| `app/connect/route.ts` (create) | `GET` → `{ url, key, name }` for the game's Realtime connection. |
| `app/[lang]/match/new/page.tsx`, `app/[lang]/match/[code]/page.tsx` (create) | The set-up and the link's page. |
| `components/free-setup.tsx`, `components/hub-client.tsx`, `app/[lang]/race/page.tsx`, `app/sitemap.ts`, `app/robots.ts` (modify) | Match mode of the set-up; the hub card; `/match/` kept out of the index. |
| `test/sim.test.mjs` (modify), `test/match-rules.test.mjs`, `test/net.test.mjs`, `test/match.test.mjs` (create), `test/hub.mjs` (create) | Tests; `hub.mjs` is the in-memory stand-in for Realtime. |
| `scripts/realtime-smoke.mjs` (create) | A manual check of `net.js` against the live project. |
| `README.md` (modify) | The match race, described like the other parts. |

---

### Task 1: Two human boats in the sim

This is the club race plan's Task 1, built exactly to its Interfaces block (read it there:
`docs/superpowers/plans/2026-11-14-club-race.md`, "Task 1: Several human boats in the sim"), with its golden test. Its
line numbers are stale; find the places by name (`record`, `step`, `progress`, `hails`, `foul`, `collide`, `drive`,
`roomToTack`, `youCanHail`, `hail`, and `handleMessages` in `main.js`).

**Files:**
- Modify: `public/game/sim.js`, `public/game/main.js` (`handleMessages`)
- Test: `test/sim.test.mjs`

**Interfaces:**
- Produces: `new Race({ …, humans?, me? })`, `race.humans`, `b.human`, `b.id`, `b.log`, `race.player`,
  `race.log` (getter), `race.say(key, arg, to = null)` with messages `{ key, arg, to }`, `race.youCanHail(P)`,
  `race.hail(P)`, as the club plan defines them. The `club` option is not needed here.

- [ ] **Step 1: Record the golden race before changing anything** (the club plan's Step 1: seed 4242, fleet 5, the
  scripted human), pasting the finishing times into the test as literals.
- [ ] **Step 2: Write the failing tests** — the club plan's `golden`, `three humans` and `a human hails a human`
  tests, plus:

```js
test('two humans and no computer boats', () => {
  const r = new sim.Race({ seed: 7, fleet: 2, humans: [{ id: 'h', name: 'Host' }, { id: 'g', name: 'Guest' }], me: 'g' });
  assert.equal(r.boats.length, 2);
  assert.equal(r.boats.filter((b) => b.ai).length, 0);
  assert.equal(r.player.id, 'g');
});
```

- [ ] **Step 3: Run them and see them fail** — `node --test test/sim.test.mjs` → golden passes, the new ones fail.
- [ ] **Step 4: Implement the club plan's Task 1 interfaces in `sim.js`**; in `main.js` `handleMessages`, skip
  messages with `m.to && m.to !== race.player`.
- [ ] **Step 5: Run all tests** — `npm test` → PASS, golden included.
- [ ] **Step 6: Commit** — `git commit -m "Several human boats in one race"`

---

### Task 2: Match mode in the sim: sides, entry, penalties, the zone, the winner

**Files:**
- Modify: `public/game/sim.js` (`Race` constructor, `step`, `progress`, `rightOfWay`, `zones` and the gate's zone in
  `zoneOf`, `foul`, the mark-touch in `collide`, the penalty-turn detection in `Boat.step`)
- Test: `test/match-rules.test.mjs`

**Interfaces:**
- Consumes: Task 1's `humans`, `say(…, to)`.
- Produces:
  - `new Race({ preset, length, seed, humans: [host, guest], me, match: true, blue: id })`. With `match` the race
    forces `fleet: 2, course: 'wl', laps: 2, start: 5, current: false`, `prepFlag = 'P'` (the seed's draw is still
    made, so `rand()` stays in step), and `race.match = true`. Without `match`, nothing changes.
  - `race.zone`: `2 * HULL` in a match, `ZONE` otherwise; every use of `ZONE` in `sim.js` reads `this.zone`.
    (`world.js` draws the ring from `race.zone`, Task 8.)
  - `b.side`: `'blue'` for the human whose id is `blue` (default `humans[0]`), `'yellow'` for the other. Blue's end
    is the committee boat (`lineT` 1), yellow's the pin (`lineT` 0).
  - Placing at the race's first moment (`clock = −308`): each boat outside the line at 90° to the starting line
    through her own end (blue `lineT > 1`, yellow `lineT < 0`), on the course side (`lineD > 0`), some 40 m out from
    her end, blue heading on port and yellow on starboard, both pointed to reach their end in about a minute.
  - `b.entered`, `b.owed` (penalties owed, an integer), `b.pen` (a penalty turn **in progress**, or null),
    `b.forcedT` (seconds with two owed and no turn started).
  - Entry, checked in `step`:
    - At the preparatory signal (`clock` crossing −240), a boat not outside her line (blue `lineT ≤ 1`, yellow
      `lineT ≥ 0`): `owed++`, `say('entryEarly', null, b)`.
    - From −240 to −120, her first crossing of the starting line or its extension from the course side to the
      pre-start side (`lastD > 0 && d ≤ 0`) at her own end (blue `lineT ≥ 0.5`, yellow `lineT ≤ 0.5`) sets `entered`
      and says `'entered'` to her. Check this against the text of RRS 2025–2028 Appendix C rule C3.2: if it requires
      crossing the extension beyond the mark, use blue `lineT > 1`, yellow `lineT < 0`, and note it in the commit.
    - At −120, a boat not `entered`: `owed++`, `say('entryLate', null, b)`.
  - Penalties in a match:
    - `foul()` and the mark touch give `owed++` (and `pens++`, and the existing messages, plus `'theyOwe'` to the
      other boat) instead of setting `b.pen`.
    - Appendix C's turn, detected in `Boat.step` when `owed > 0` and the race is past the gun and she has started:
      on a beat leg (`isBeat(course, leg)`), her stern crossing the wind (a gybe) starts it (`pen = { mr: true }`,
      `say('penStart')`), and it's done when she's back close-hauled (`|twa| ≤ beatAngle(tws) + 10°`); on a run, her
      bow crossing the wind (a tack) starts it, done at `|twa| ≥ 90°`. Done: `owed--`, `pen = null`,
      `events.push('penaltyDone')`. Check the form against Appendix C's penalty rule and follow the book.
    - With `owed ≥ 2`, she's told `'penNow'` once; `forcedT` counts while she hasn't started a turn; at 20 s the race
      goes to the other boat (`forfeit`).
    - `rightOfWay`: in a match, only a turn in progress (`pen`) makes a boat give way under rule 44; owing one
      doesn't. (Today's `p.pen` test already reads that way once `pen` means "turning".)
  - Recalls: in a match there is no general recall; each boat over at the gun is `ocs` with the X flag, as under P.
  - Finishing in a match: a boat crossing the finish with `owed > 0` doesn't finish (`say('finishOwed', null, b)`);
    she must take it and cross again from the course side. The first to finish is `race.winner`. `race.over` is true
    when both have finished or 60 s after the winner. `race.margin`: the loser's finish minus the winner's, or null.
  - `race.forfeit(b)`: the other boat is `race.winner`, `race.over = true`, `race.margin = null`,
    `race.forfeited = b`.
  - `race.stepView(dt, b)`: the club plan's Task 2 `stepView`, exactly.

- [ ] **Step 1: Write the failing tests** in `test/match-rules.test.mjs`, with a helper `matchRace(opts)` (two humans,
  `match: true`, seed 11) and a `steer(b, fn)` script driver.

```js
test('a match is two boats, blue at the committee boat, yellow at the pin, each outside her end', () => {
  const r = matchRace(); const [h, g] = r.humans;
  assert.equal(r.boats.length, 2); assert.equal(h.side, 'blue'); assert.equal(g.side, 'yellow');
  assert.ok(sim.lineT(r.course, h) > 1 && sim.lineT(r.course, g) < 0);
  assert.equal(r.zone, 2 * sim.HULL);
});
test('a boat that enters through her own end in the window owes nothing; one that doesn\'t owes one', () => {
  /* h scripted to her entry point and across by −150; g sits still → at −120: h.entered, h.owed 0; g.owed 1, 'entryLate' to g */
});
test('inside her end at the preparatory signal: a penalty', () => { /* place g at lineT 0.3 at −245 → g.owed 1, 'entryEarly' */ });
test('both over at the gun are each recalled, no general recall', () => { /* both lineD > 0 at 0 → both ocs, flags.X, r.recalls 0 */ });
test('a penalty can\'t be paid before the start', () => { /* g.owed = 1 at −60; script two full circles before the gun → still owed 1 */ });
test('on a beat a gybe and back to close-hauled pays one; a tack doesn\'t', () => { /* after the start, leg 1: a tack → owed 1; a gybe then up to close-hauled → owed 0, event penaltyDone */ });
test('on a run a tack and back to a run pays one', () => { /* leg 2 (downwind): tack, bear away past 90° → owed 0 */ });
test('owing a penalty keeps her right of way; turning one gives it away', () => {
  /* rightOfWay(g on starboard owing 1, h on port) → giver h; with g.pen set → giver g, rule '44' */
});
test('two owed and no turn for 20 s: the race goes to the other boat', () => { /* g.owed = 2 after the start → 'penNow'; 20.5 s → r.winner === h, r.forfeited === g */ });
test('a finish with a penalty owed counts only after the turn', () => {
  /* g crosses the finish owing 1 → !g.done, 'finishOwed'; takes it, recrosses → g.done, r.winner g if h hasn't finished */
});
test('the first to finish wins; the margin is the gap', () => { /* script both round → r.winner, r.margin > 0 */ });
test('a free race is unchanged by the match code', () => { /* golden from Task 1 still deepEquals */ });
```

- [ ] **Step 2: Run them and see them fail** — `node --test test/match-rules.test.mjs` → FAIL (`match` unknown).
- [ ] **Step 3: Implement the interfaces above in `sim.js`**
- [ ] **Step 4: Run all tests** — `npm test` → PASS, golden included.
- [ ] **Step 5: Commit** — `git commit -m "Match racing in the sim: blue and yellow, the entry, penalties when you choose, the winner"`

---

### Task 3: The umpire calls a failure to keep clear

**Files:**
- Modify: `public/game/sim.js` (a new `umpire()` called from `step` in a match, after `collide`)
- Test: `test/match-rules.test.mjs`

**Interfaces:**
- Consumes: Task 2's `owed`, `foul()`, `judge()`, `cpa()`, `turnedAt()`, `hullGap()`.
- Produces:
  - `race.umpire()`, in a match only, from 30 s before the preparatory signal to the finish. For the pair, with
    `r = judge(p, q)` naming the boat that must keep clear (`giver`) and the right-of-way boat (`row`):
    - **Failure to keep clear:** if both holding their course and speed would bring their hulls (`hullGap`) within
      `KEEP_CLEAR` m inside `LOOK` s, and `row` hasn't changed course in the last `HUNT_T` s, `giver` owes one
      (rule `r.rule`).
    - **Rule 16.1:** if that closing comes from `row` having changed course within `HUNT_T` s, and before her turn
      the pair was clear by more than `KEEP_CLEAR` over `LOOK` s, `row` owes one (rule `'16.1'`).
    - Starting values to tune: `KEEP_CLEAR = 1.0`, `LOOK = 1.5`, `HUNT_T = 2`; one call per pair per 6 s; a contact
      still calls through `foul()` as today, never twice for one incident.
  - `race.calls: { t, on: id, rule, why: { gap, look, rowTurned: boolean, rowTurnT } }[]`, every call with its
    reasons, for the debug overlay (Task 8).
  - Each call says `'umpire'` `{ rule, on: id }` to both boats.

- [ ] **Step 1: Write the failing tests**, scripted situations each named for the standard case it follows, with the
  expected call:

```js
test('port crosses clear ahead of starboard: no call', () => { /* 6 m clear at the crossing → r.calls.length 0 */ });
test('port aims at starboard, who bears away at the last moment: port penalised', () => { /* starboard turns at 1 s to go; port owes 1, rule '10' */ });
test('port ducks starboard close astern: no call', () => { /* port bears away 3 s out and passes 2 m astern → none */ });
test('leeward luffs slowly, windward answers: no call', () => { /* overlapped, leeward luffs 3°/s, windward keeps 3 m off → none */ });
test('leeward luffs, windward doesn\'t answer: windward penalised', () => { /* rule '11' */ });
test('leeward luffs hard with no room for windward to keep clear: leeward penalised', () => { /* 25° in 1 s at 2 m → rule '16.1' on leeward */ });
test('the dial-up: head to wind side by side, no closing: no call', () => { /* both stopped head to wind 4 m apart → none */ });
test('the zone is two lengths: the inside boat gets room, the outside one that shuts her out is penalised', () => { /* rule '18' */ });
test('one incident, one call', () => { /* a near-miss then a contact within 6 s → one call */ });
```

- [ ] **Step 2: Run them and see them fail** — `node --test test/match-rules.test.mjs` → the new tests FAIL.
- [ ] **Step 3: Implement `umpire()` and `race.calls`**, then tune the three values until every case above passes;
  if a case needs a fourth value, name it beside the others.
- [ ] **Step 4: Run all tests** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "The match umpire calls a failure to keep clear, not only contact"`

---

### Task 4: The Realtime client

The club race plan's Task 4, the `net.js` and `test/hub.mjs` parts only, to its Interfaces block (`realtime()`,
`channel()`, the wire format, the heartbeat and reconnect; `memoryRealtime()`), with its `net.test.mjs` tests and its
smoke script on topic `match:SMOKE1`. Its `Lobby` and `club.js` are not built here. The code helpers go in
`lib/code.ts` instead of `lib/club.ts`.

**Files:**
- Create: `public/game/net.js`, `test/hub.mjs`, `test/net.test.mjs`, `lib/code.ts`, `scripts/realtime-smoke.mjs`

**Interfaces:**
- Produces: `realtime({ url, key, WebSocket })`, `channel(topic, { self })` with `join/send/on/leave`,
  `memoryRealtime()`, as the club plan defines them; `lib/code.ts`: `CODE_ALPHABET`, `newCode(): string`, `CODE_RE`.

- [ ] **Step 1: Write the failing tests** — the club plan's two `net.test.mjs` tests, and in `test/net.test.mjs`
  `newCode()` matching `CODE_RE` 1,000 times (importing `lib/code.ts` the way the existing tests import `lib/` files).
- [ ] **Step 2: Run them and see them fail** — `node --test test/net.test.mjs` → FAIL.
- [ ] **Step 3: Implement `net.js`, `test/hub.mjs`, `lib/code.ts`**
- [ ] **Step 4: Run all tests** — `npm test` → PASS.
- [ ] **Step 5: Check against the live project** — `node scripts/realtime-smoke.mjs` → `received 20/20`, median
  under 300 ms.
- [ ] **Step 6: Commit** — `git commit -m "A Realtime client for the game"`

---

### Task 5: The waiting room and the match's score

**Files:**
- Create: `public/game/match.js` (`makeLink`, `Room`, `Match`), `test/match.test.mjs`

**Interfaces:**
- Consumes: Task 4's `channel`, `memoryRealtime()`.
- Produces:
  - `makeLink(rt, code) → { all: Channel /* 'match:'+code */, input: Channel /* 'match:'+code+':in' */ }`.
  - `new Room({ link, me: { id, name, look }, host: boolean, settings: object | null, now = Date.now })`:
    - sends `hello { id, name, look, host, settings, joinedAt }` on joining and every 3 s; `bye { id }` on `leave()`.
    - `room.host`, `room.guest`: the host's hello, and the first non-host by `joinedAt` then `id`; each null until
      heard, and dropped after 10 s unheard. `room.full`: true on a client that is neither of them.
    - `room.settings`: the host's.
    - `room.canStart()`: host only, with a guest present.
    - `room.start(): StartMsg` broadcasts and returns `start { settings, seed, race: 1, blue: host.id, host, guest }`;
      `room.onStart(fn)`.
  - `new Match({ start: StartMsg, now = Date.now })`, pure state:
    - `state`: `'race' | 'between' | 'over'`; `raceN` (1…3); `score: { [id]: number }`;
      `races: { winner: id | null, margin: number | null, abandoned: boolean }[]`.
    - `blueOf(n)`: the host in odd races, the guest in even ones. `seedOf(n)`: `(start.seed + n * 7919) % 100000`.
    - `endRace({ winner, margin, abandoned })`: records it; first to 2 → `'over'`, else `'between'`.
    - `ready(id)`, `present(id, on)`, `tick()`: in `'between'`, `nextRace()` when both ready, or 60 s after it opened
      with both present; never with one absent.
    - `leave(id)` → `'over'`. `tick()` → `'over'` once either has been absent 300 s.
    - `toJSON()` / `Match.from(json)`: the host keeps it in `localStorage['regatta-match-' + code]` and restores it
      after a reload, with the race in progress recorded as abandoned.
  - `HOST_KEY = 'regatta-match-host'`: `localStorage`, `{ code }` of the match this browser hosts.

- [ ] **Step 1: Write the failing tests** (over `memoryRealtime()`, with a fake clock)

```js
test('the host sees the guest arrive and only then may start', () => { /* host.canStart() false, guest joins → true */ });
test('a third person is told the match is full', () => { /* three rooms → the third's room.full, the first two not */ });
test('first to two wins the match', () => { /* endRace h, endRace g, endRace h → state 'over', score { h: 2, g: 1 } */ });
test('colours swap each race', () => { /* blueOf(1) host, blueOf(2) guest, blueOf(3) host */ });
test('between races the match waits for a missing player', () => { /* present(g, false), 120 s → still 'between'; 300 s → 'over' */ });
test('both ready starts the next race at once; one ready waits 60 s with both present', () => { /* … */ });
test('a reloaded host keeps the score and loses the race in progress', () => { /* Match.from(json) mid-race → races[last].abandoned, score kept, state 'between' */ });
```

- [ ] **Step 2: Run them and see them fail** — `node --test test/match.test.mjs` → FAIL.
- [ ] **Step 3: Implement `makeLink`, `Room`, `Match`, `HOST_KEY`**
- [ ] **Step 4: Run all tests** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "The match's waiting room and score"`

---

### Task 6: The host runs the race and the guest follows it

**Files:**
- Create: `public/game/wire.js`
- Modify: `public/game/match.js` (`Host`, `Guest`), `test/match.test.mjs`

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces:
  - `wire.js`: `controlsOf(b)`, `applyControls(race, b, c)`, `encodeSnap(race)`, `applySnap(race, s, skip)` as the
    club plan's Task 5 defines them, with each boat's snapshot also carrying `side`, `entered`, `owed`, `pen` (turning
    or not), and the race's `winner` id once there is one.
  - `raceFor(match: Match, myId: string): Race`: for `n = match.raceN`, `new Race({ ...match.start.settings,
    seed: match.seedOf(n), match: true, humans: [host, guest], me: myId, blue: match.blueOf(n) })`, setting each
    human's `look`.
  - `new Host({ race, link, guestId, now })`:
    - `tick(dt)`: applies the guest's latest controls; after 3 s without input, rudder 0 and `auto = null`; after
      30 s, `race.forfeit(guest)`. If more than 60 s of wall time have passed since the previous `tick` (the tab was
      asleep), it sends `abandon` and stops instead. Then `race.step(dt)`; sends `snap` every 0.1 s, `ev { list: [{
      key, arg, to: id | null }] }` for each step's messages, and `end { winner, margin, forfeited }` once
      `race.over`.
    - It listens on `link.input`; its own boat is driven by the local UI.
  - `new Guest({ race, link, me, now })`: the club plan's `Follower` (the other boat drawn at `now − 150 ms`;
    `stepView` for `me`; eased to the host's pose with a 0.5 s time constant, snapping beyond 20 m or after a
    `bump`, `aground`, `touched`, `fouled` or `umpire` event on her; `input(controls)` at most every 0.1 s, at
    least every 0.5 s; events kept for `to === me` or `null`), plus:
    - `guest.hostSilent`: true after 3 s without a snapshot; while true `frame` doesn't step `me`.
    - after 60 s silent, or on `abandon`: `guest.abandoned = true`.
    - `guest.onEnd(fn({ winner, margin, forfeited }))`.

- [ ] **Step 1: Write the failing tests** (two clients over `memoryRealtime()`, a fake clock driving `tick`/`frame`)

```js
test('the guest steers and the host\'s copy turns; each sees the other within 1 m after 1 s', () => {});
test('a call is made once, on the host, and each hears her own', () => { /* force a Task 3 port–starboard foul; the host's race.calls has one; the guest's events have 'umpire' once */ });
test('a silent guest holds course, then the race goes to the host', () => { /* 3.5 s → rudder 0; 30.5 s → end { winner: host, forfeited: guest } */ });
test('a host asleep for over a minute abandons the race', () => { /* skip 61 s between ticks → 'abandon', guest.abandoned */ });
test('a guest who reloads steers her boat again', () => { /* new Guest with the same id mid-race → after the next snap her inputs move the host's copy */ });
test('the message budget: one minute of racing under 30 a second', () => { /* count sends and deliveries through the hub */ });
```

- [ ] **Step 2: Run them and see them fail** — `node --test test/match.test.mjs` → FAIL.
- [ ] **Step 3: Implement `wire.js`, `raceFor`, `Host`, `Guest`**
- [ ] **Step 4: Run all tests** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "The host runs the match race and the guest follows it"`

---

### Task 7: The pages: set-up, the link, the connection

**Files:**
- Create: `app/[lang]/match/new/page.tsx`, `app/[lang]/match/[code]/page.tsx`, `app/connect/route.ts`
- Modify: `components/free-setup.tsx`, `components/hub-client.tsx`, `app/[lang]/race/page.tsx`, `app/sitemap.ts`
  (leave `/match/*` out), `app/robots.ts` (disallow `/match/`), `proxy.ts` matcher (exclude `connect`)

**Interfaces:**
- Consumes: `lib/code.ts`; `HOST_KEY` as a string literal.
- Produces:
  - `FreeSetup` gains `match?: boolean`: only venue, yacht, wind and length (`short` | `medium`, as the venue offers)
    are shown; the button reads "Create the match" / "Создать матч"; `go()` does `code = newCode()`,
    `localStorage[HOST_KEY] = { code }`, `localStorage['regatta-match-settings'] = { venue, yacht, preset, length }`,
    then `location.href = '/play?match=' + code + '&venue=' + venue + '&boat=' + yacht`.
  - `/match/new`: like `app/[lang]/race/free/page.tsx`, titled "Match race" / "Матчевая гонка".
  - `/match/[code]`: `notFound()` unless `CODE_RE` matches the upper-cased code; not indexed; metadata "Race me:
    a match race" / "Сыграем матч: матчевая гонка" (title, description, og). It shows the code and a Join button to
    `/play?match=<code>&venue=<v>&boat=<b>` from its `v` and `b` (the tap lets the game start its sound).
  - `GET /connect` → `{ url, key, name }` from `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
    and the signed-in user's `user_metadata.display_name` (or `null`); `cache-control: no-store`.
  - The hub card "Match race" / "Матчевая гонка": "You and a friend, one on one: send a link." / "Вы и друг, один на
    один: отправьте ссылку.", linking to `/match/new`. Until the owner has signed off the umpire's calls (see the
    end of this plan), the card shows only with `?match` in the hub's address; `/match/new` itself always works.

- [ ] **Step 1: Implement the pages, the route and the card**
- [ ] **Step 2: Verify** — `npm run typecheck && npm run build` → no errors. `preview_start` the dev server and
  check: `/match/new` → Create → `/play?match=XXXXXX&venue=…&boat=…`; `/match/abc` → 404; `/match/K7M2QZ?v=cowes&b=club40`
  shows Join, which opens `/play?match=K7M2QZ&venue=cowes&boat=club40`; `curl -s localhost:5193/connect` → JSON
  with `url` and `key`; `/ru/match/new` reads in Russian.
- [ ] **Step 3: Run all tests** — `npm test` → PASS.
- [ ] **Step 4: Commit** — `git commit -m "Match race pages: set-up, link, connection"`

---

### Task 8: The match in the game, and the README

**Files:**
- Create: `public/game/match-ui.js`
- Modify: `public/game/main.js` (settings, `newRace`, the controls, `handleMessages`, `pause`, the loop,
  `visibilitychange`, the `T` tables), `public/game/world.js` (`boatViews`, the zone ring), `public/game/stats.js`,
  `public/play/index.html` (the match's markup, and its modules in `modulepreload` only if `npm test`'s preload check
  requires every module; otherwise leave them out, since only a match loads them), `README.md`

**Interfaces:**
- Consumes: `net.js`, `match.js`, `wire.js`, `/connect`.
- Produces:
  - `startMatch({ code, t, onRace(session), onEnd() }) → Promise<void>` in `match-ui.js`:
    - fetches `/connect`, imports `net.js` and `match.js` (dynamic imports, only here).
    - Id: `localStorage['regatta-match-me']`, made once. Name: the account's, else
      `localStorage['regatta-match-name']`, asked in the waiting room if empty. Look from `playerLook()`'s source,
      without `logoImg`. Host if `localStorage[HOST_KEY].code === code`.
    - The waiting room: the link (`/match/<code>?v=&b=`) with Share (`navigator.share`, else copy), the settings, the
      two players with colour chips, a name field; Start for the host once `canStart()`; "Waiting for a friend…" /
      "Ждём соперника…" for the host alone; "This match is full" / "В этом матче уже двое" when `room.full`.
    - If the host's settings' venue or yacht differ from the page's: `location.replace` with the right `venue` and
      `boat`.
    - Between races: the score, who's blue next, Ready; at the end the match card: the winner, each race's winner
      and margin, Rematch (host: a new `start` on the same code, the same settings, the score reset) and Done (Leave).
    - The overlays: "Waiting for <host>…" while `hostSilent`; "Race abandoned" when `abandoned`.
    - With `&debug=umpire` in the address, a small overlay lists `race.calls` (on the host) or the `umpire` events
      (on the guest) with their reasons.
  - `main.js` in a match (`?match=` present): skips the menu and today's race; calls `startMatch`; in `onRace`
    replaces `race` with the session's (`world.setRace`, `raceStarted`); the loop calls `host.tick(dt)` or
    `guest.frame(dt)` and `guest.input(controlsOf(P))`; tack and hail bump `P.tackN`/`P.hailN`; `pause()` opens the
    menu but the race runs on; `visibilitychange` doesn't pause; the drills, the ghost and fast-forward after the
    finish are off.
  - The HUD: your side (blue or yellow), the score, penalties owed by each boat (a mark per penalty, blinking while
    one is being taken), entered or not until −120.
  - New `T` keys in both languages, each spoken in the existing voices where a recorded line fits (`CALLS`/`VOICES`)
    and shown as text otherwise: `entered`, `entryEarly`, `entryLate`, `umpire` (with the rule, and who), `theyOwe`,
    `penStart`, `penNow`, `finishOwed`, `raceWon`, `raceLost`, `matchWon`, `matchLost`, `waitingHost`,
    `guestGone`, `abandoned`, `full`.
  - `world.js`: the other human drawn with her own look and her name, both boats with a blue or yellow flag on the
    stern; the zone ring at `race.zone`.
  - `stats.js`: posts nothing when `race.match`.
  - `README.md`: a row for `/match/new` and `/match/<code>` in the pages table, and a **Match race** bullet: how the
    host's game runs it over Realtime (`net.js`, `match.js`, `wire.js`), the rules it judges, the umpire and its
    `&debug=umpire` overlay, the drop-out times, and that nothing is kept.

- [ ] **Step 1: Implement `match-ui.js` and the changes above**
- [ ] **Step 2: Verify in two tabs** — `preview_start` the dev server. Tab A: `/match/new` → create → waiting room.
  Tab B: the shown link → Join → B appears in A. A presses Start. With `read_console_messages` (no errors) and
  screenshots, check:
  - both count down to the same gun (±1 s), blue and yellow at their ends;
  - B steering turns B's boat in A's view within half a second;
  - a forced port–starboard foul gives one `umpire` call on both screens, with the same rule;
  - closing B mid-race: after 30 s A wins the race; the between card waits for B;
  - `/play?race=free` and `/play?race=today` play as before.
- [ ] **Step 3: Run all tests** — `npm test && npm run typecheck && npm run build` → PASS.
- [ ] **Step 4: Commit** — `git commit -m "Sail a match race in the game"`

---

### After the plan: the host's test matches

Not a task for the builder: before the hub card is shown to everyone, the owner sails a few matches with a friend
with `&debug=umpire`, notes any call they'd overturn (with the overlay's reasons), and those become new cases in
Task 3's tests with the values retuned. Until the owner signs off, the hub card can stay behind `?match` in the hub's
address (the builder adds that gate in Task 7 and the owner removes it).
