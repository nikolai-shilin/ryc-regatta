# New Course Shapes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the trapezoid (`'trap'`) and up and down with an upwind finish (`'wlu'`) to the game, the free-race
set-up, today's race rotation, the result page and the scores server and mini app, on a course model of rounding marks.

**Architecture:** `makeCourse` in `public/game/sim.js` returns rounding marks keyed by leg name, plus per-leg info
(beat or not, the outside direction) and an optional finish line of its own. Three helpers in `sim.js` answer "where is
this leg going", and every consumer (rules, computer skippers, world, HUD, minimap, land) reads them instead of
checking `'mark'`/`'wing'` by name. Leg names stay strings, so result records and labels keep working. `lib/race.ts`
mirrors the geometry for the site, and `npm test` keeps the two copies equal.

**Tech Stack:** plain ES modules with no build (`public/game`), Three.js 0.160, Next.js App Router + TypeScript (site),
`node --test` (`npm test`). The `iyt-test` repo has Vercel functions (`api/*.mjs`), a Supabase SQL migration, and the
mini app (`miniapp/app.js`, built by `npm run build`).

**Spec:** `docs/superpowers/specs/2026-11-14-course-shapes-design.md`

## Global Constraints

- Shape ids: `'wl'` up and down, `'tri'` triangle, `'trap'` trapezoid, `'wlu'` up and down with upwind finish.
- Leg names: `'start' | 'mark' | 'wing' | 'mark2' | 'offset' | 'gate' | 'finish'`. `'mark'` is always the windward mark
  (trapezoid mark 1).
- `'wl'` and `'tri'` must sail exactly as before: the golden fixture from Task 1 must match bit for bit after every
  task.
- All marks are left to port.
- **Trapezoid:**
  - mark 2 is reached from mark 1 on a leg 110–120° off the wind, out to the left
  - the gate is straight downwind of mark 2
  - the finish is a line of its own, reached from the gate on a beam reach (80–100° off the wind)
  - legs: `start, mark, mark2, gate, (mark2, gate)×(laps−1), finish`
- **Upwind finish:**
  - the offset mark is 50–60 m to the left of the windward mark, a little below it
  - the finish line is at the top, a little below and to the right of the windward mark, with its own committee boat
    flying the blue flag
  - legs: `start, (mark, offset, gate)×laps, finish`
- Rule 18 zone: a leg into a mark that's a beat has no zone; any other leg into a mark or the gate has one.
- **Today's race:**
  - the shape is one more draw **after** the existing preset and current draws
  - weights: `wl` 0.4, `tri` 0.2, `trap` 0.2, `wlu` 0.2
  - days before `SHAPES_FROM` are always `'wl'`
  - `SHAPES_FROM = '2026-11-20'` in both copies; set it to the day after the deploy when shipping
- Personal-best key suffixes: `|tri` (existing), `|trap`, `|wlu`. Existing keys are unchanged.
- Every shape fits every venue's short course, since today's race rotates through venues and shapes. Free-race
  combinations that don't fit are listed in a venue's `skip` field and aren't offered.
- No new voice recordings. All new copy goes in English and Russian (`t('…', '…')` on the site, the `STR` tables in
  `main.js`, the mini app's string tables).
- Scores server time floor: `FLOOR * BEAT * LEN * laps`, with `FLOOR = 0.45`. The computer boats' fastest time on every
  shape must stay above 1.5× that floor.

## Review Focus

1. **A boat crossing the upwind-finish line before her last leg** (it sits next to the windward mark she rounds every
   lap) must not finish. The test is in Task 3.
2. **Trapezoid mark 2 rounded twice with different outsides**: from the reach on lap 1, and from the beat on lap 2.
   Circling it, or crossing on the wrong side, must not count as a rounding. The test is in Task 3.
3. **A saved result from before this change** (no `type`, `marks` or `finish`) must open and draw as before on
   `/race/result/[id]`. The test is in Task 8.
4. **Stale or unknown `course` in localStorage `regatta`**, including a shape a venue skips:
   - the set-up keeps a valid new shape
   - it falls back to `'wl'` for anything unknown or skipped
   - the game does the same instead of laying a course on land

   The tests are in Tasks 4 and 8.
5. **The deploy day**: today's race must stay `'wl'` until `SHAPES_FROM`, and each day's wind and current must not move
   at all. The test is in Task 5.

---

### Task 0: Preconditions

- [ ] **Step 1:** The working tree has the owner's uncommitted venue work (`public/game/venues.js`, `venues/`,
  `lib/venues.ts`, `land.js` and others). Ask the owner to commit it, or confirm it may be committed as it is, before
  starting. Don't start on top of uncommitted work you didn't write.
- [ ] **Step 2:** Run `npm test` and `npm run typecheck`. Expected: all pass. Record the time `npm test` takes.

### Task 1: Golden fixture for the existing shapes

**Files:**
- Create: `test/golden.mjs`, a script that writes the fixture
- Create: `test/fixtures/courses-golden.json`
- Modify: `test/sim.test.mjs`

**Interfaces:**
- Produces: `goldenRuns()`, exported from `test/golden.mjs`. It returns
  `{ key: string, finish: (number|null)[], legs: number[][], track: number[][] }[]`, built by sailing these cases:
  - shape `wl` and `tri`
  - preset `light` and `strong`
  - laps 1 and 2
  - current 0 and 1
  - fleet 7, seed 31

  Each entry holds every boat's finish time (rounded to 0.1), every boat's leg-change times, and every 30th track point
  of every boat (rounded to 0.1 m).

- [ ] **Step 1: Write the test** `the existing shapes sail exactly as before the course refactor`. It asserts
  `deepEqual(goldenRuns(), JSON.parse(fixture))`.
- [ ] **Step 2: Run** `node test/golden.mjs --write` on the **unchanged** code to create the fixture. Then run
  `npm test`. Expected: PASS.
- [ ] **Step 3: Commit:** `git add test/ && git commit -m "A golden fixture of up and down and the triangle, before the course refactor"`.

### Task 2: The course model (refactor, no new shapes)

**Files:**
- Modify: `public/game/sim.js`, in these places:
  - `makeCourse` (≈496)
  - `progress` (≈737)
  - `nextMark`, `distToNext`
  - the zone code (≈912)
  - the proper-course check (≈900)
  - the mark-room code (≈833, ≈861)
  - `aiTarget` (≈1012)
  - the gybe choice `pastWing` (≈1158)
  - kites and code zero (≈1209)
  - shooting the mark (≈1292)
  - `hardMarks`, `obstacles`
- Test: `test/sim.test.mjs`

**Interfaces:**
- Produces, on the object `makeCourse` returns, in addition to every existing field (`windward`, `wing`, `wingOut`,
  `gate`, `pin`, `committee`, `dir`, `normal`, `len`, `laps`, `type`, `legs`, all kept with the same values):
  - `marks: Record<legName, {x, z}>`: today `{ mark: windward }`, plus `{ wing }` on the triangle
  - `legInfo: { beat: boolean, out: {x, z} | null }[]`, parallel to `legs`. `out: null` means "upwind by the wind now",
    which is how the windward mark is rounded today. For a free leg, `out` is the geometric outside, as `wingOut` is
    today.
  - `finish: null | { a: {x, z}, b: {x, z}, through: {x, z} }`. `null` means the start line, crossed downwind as today.
- Produces these exported functions in `sim.js`:
  - `legTargets(course, i) -> {x, z}[]`: the points the leg is going to:
    - a mark leg: `[mark]`
    - `'gate'`: both buoys
    - `'finish'` or `'start'`: the line's two ends
  - `legAim(course, i) -> {x, z}`: one point to steer and measure to: the mark, the gate's middle, or the finish line's
    middle. `nextMark` returns `legAim(c, b.leg)`.
  - `isBeat(course, i) -> boolean`, which is `legInfo[i].beat`
  - `hasZone(course, i) -> boolean`: true for `'gate'` and for mark legs that aren't beats

- [ ] **Step 1: Write a failing test** `the course lists its marks and legs`:
  - for `makeCourse(2, 260, 0, 5, 'tri')`:
    - `Object.keys(c.marks)` equals `['mark', 'wing']`
    - `c.legInfo.map(l => l.beat)` equals `[false, true, false, false, true, false, false]`
    - `c.finish` is `null`
  - for `legAim(c, c.legs.indexOf('gate'))`: `x` is `(gate[0].x + gate[1].x) / 2`
- [ ] **Step 2: Run** `npm test`. Expected: FAIL (`legAim is not a function`).
- [ ] **Step 3: Implement** the fields and helpers in `makeCourse`, then make each consumer above read them:
  - **Rounding** in `progress()` and in `aiTarget()`: one code path for any key found in `c.marks`. Its outside
    direction comes from `legInfo[i].out`, or from the live wind (`progress`) or `{x: 0, z: -1}` (`aiTarget`) when that
    is `null`, exactly as today.
  - **The rounding message:** comes from a new map, `ROUNDED`, keyed by mark leg and shape. Today's values are
    `mark` → `rounded` / `roundedTri`, and `wing` → `roundedWing`.
  - **The gate:** in `aiTarget` it aims relative to `legAim`, not `x = 0`.
  - **The finish:** uses `c.finish` when it's set (Task 3), otherwise today's start-line test.
  - **Beat checks:** proper course, no kite, and shooting the mark use `isBeat`.
  - **The code zero:** any non-beat mark leg.
  - **`pastWing`:** "the previous leg was a non-beat mark leg".
  - **Zone checks:** use `hasZone`.
  - **`hardMarks` and `obstacles`:** every entry in `c.marks`, the gate, the pin, the committee boat, and the finish
    line's two ends when it's set.
- [ ] **Step 4: Run** `npm test`. Expected: PASS, including the golden fixture unchanged.
- [ ] **Step 5: Commit:** `"The course as a list of rounding marks; up and down and the triangle unchanged"`.

### Task 3: The trapezoid and the upwind finish in the sim

**Files:**
- Modify: `public/game/sim.js`, in these places:
  - `makeCourse`
  - the `Race` constructor (≈566: accept the four shapes, and anything else → `'wl'`)
  - the `Wind` "wide" argument
  - the `ROUNDED` messages
- Modify: the `STR` tables in `public/game/main.js`: the new message keys in English and Russian, worded as the
  existing `roundedTri` and `roundedWing` are
- Test: `test/sim.test.mjs`

**Interfaces:**
- Consumes: Task 2's `marks`, `legInfo`, `finish`, `legTargets`, `legAim`, `isBeat`.
- Produces:
  - `makeCourse(laps, beat, bias, fleet, type)` for `type` `'trap'`: `marks.mark2`
  - for `type` `'wlu'`: `marks.offset`, and `finish = { a, b, through }` (with `through` pointing upwind)
  - for `'trap'`, `finish` is a line crossed towards +x
  - `c.finishBoat: {x, z} | null`: where the finish line's committee boat lies, for drawing
  - new message keys: `roundedTrap` (mark 1 → bear away for mark 2), `roundedMark2` (→ the run), `roundedOffset`
    (→ the run), `gateFinish` (through the last gate → the finish)

- [ ] **Step 1: Write the failing geometry tests** `the trapezoid is laid as the spec says` and `the upwind finish is
  laid as the spec says`. They cover each preset's beat (`BEAT_LEN × 1`) with bias 0:
  - **Trapezoid:**
    - the leg from mark to mark2 is 110–120° off the wind (the wind comes from −z)
    - `|gate mid.x − mark2.x| < 1`
    - the gate's middle to the finish line's middle is 80–100° off the wind
  - **Upwind finish:**
    - `offset.x` is between −60 and −50 off `windward.x`
    - `offset.z` is between 0 and +20 m below the windward mark
    - the finish's middle has `x > windward.x` and `z > windward.z`
    - `legs` equals `['start', 'mark', 'offset', 'gate', 'finish']` for 1 lap
- [ ] **Step 2: Write the failing race tests**, for each of `'trap'` and `'wlu'`, each preset, and laps 1 and 2 (fleet
  5, seed 11):
  - **`<shape> <preset> <laps>: the computer boats sail every leg in order`:** at least 3 boats finish, and every
    finisher's `leg` passed through every index in order. To show this, record `b.leg` changes in a test-only hook in
    the `sail()` helper.
  - **`<shape> <preset> <laps>: the computer boats finish well above the server's floor`:** the fastest time is greater
    than `1.5 × FLOOR × BEAT[preset] × laps`.
  - **`the upwind finish line doesn't finish a boat before her last leg`:** put a boat on leg `'mark'` just below the
    finish line, step her across it, and assert that `done` is still false.
  - **`trapezoid mark 2 counts only when rounded to port`:** on leg 4 (`'mark2'` after a beat), sail a boat round
    mark 2 clockwise, then straight past it on the wrong side. Assert her leg doesn't advance in either case. Then round
    it to port and assert that it does.
- [ ] **Step 3: Run** `npm test`. Expected: the new tests FAIL.
- [ ] **Step 4: Implement** the two shapes in `makeCourse`:
  - the positions and leg lists from Global Constraints
  - `legInfo.beat` is true for the beats into `mark`, the beats into `mark2` on laps after the first, and the `'wlu'`
    finish
  - `out` is computed for each free leg as `norm(inDir − outDir)`, the same formula as `wingOut`
  - the finish crossing: the signed distance along `finish.through` goes from negative to ≥ 0, with the crossing
    between `a` and `b`, and only on the `'finish'` leg
  - `Wind`'s `wide` covers the trapezoid's leftmost mark
- [ ] **Step 5: Run** `npm test`. Expected: PASS, with the golden fixture unchanged. Tune the mark distances only within
  the spec's ranges until the computer boats pass.
- [ ] **Step 6: Commit:** `"The trapezoid and up and down with an upwind finish, sailed headless"`.

### Task 4: Clear water at every venue, and what each venue skips

**Files:**
- Modify: `public/game/land.js`, `placeCourse` (≈59): the `need` list takes every entry in `c.marks`, the finish ends
  and `finishBoat`, and the midpoints of every free leg except the windward-mark → gate run. That keeps `'wl'` and
  `'tri'` placement unchanged.
- Modify: `public/game/venues.js` and `lib/venues.ts`: an optional `skip: string[]` per venue, of `'<shape>:<length>'`
  entries
- Modify: the `Race` constructor: a shape the venue skips at that length → `'wl'`
- Test: `test/sim.test.mjs`

**Interfaces:**
- Produces: `shapeOffered(venue, shape, length) -> boolean`, exported from `public/game/venues.js` and `lib/venues.ts`.
  It's false when `skip` lists `'<shape>:<length>'`.

- [ ] **Step 1: Write the failing tests:**
  - **The venue test (≈63):** extend it to every shape in `['wl', 'tri', 'trap', 'wlu']` for which `shapeOffered` is
    true. It measures `roomAt` over `c.marks`, the gate, the pin, the committee boat and the finish ends, and is run for
    Göcek too: drop the `x.id !== 'gocek'` filter.
  - **`no venue skips a shape on the short course`:** for every venue and shape, `shapeOffered(v, shape, 'short')` is
    true.
  - **`the set-up page's skip lists are the game's`:** the same regex comparison as the venue-name test.
  - **`a skipped shape falls back to up and down`:** give a venue a skip entry. A `new sim.Race({ course: 'trap',
    length: 'long' })` there has `course.type === 'wl'`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.** Add `skip` entries only where the clear-water test can't pass even after `placeCourse`
  searches. If a short course doesn't fit, tighten the shape's distances within the spec's ranges; never skip a short
  course.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit:** `"Every course shape in clear water at every venue it's offered at"`.

### Task 5: Today's race rotates through the shapes

**Files:**
- Modify: `dailyRace` in `public/game/sim.js` (≈551) and in `lib/race.ts` (≈27)
- Test: `test/sim.test.mjs`

**Interfaces:**
- Produces: `SHAPES_FROM = '2026-11-20'`, exported from both. `dailyRace(date).course` is in
  `'wl' | 'tri' | 'trap' | 'wlu'`.

- [ ] **Step 1: Write the failing tests:**
  - **The existing 500-day agreement test:** keep it, and extend its range to 2027-06-30.
  - **`today's wind and current don't move`:** the fixture `test/fixtures/daily-before.json` holds `{ day, seed, preset,
    current, venue }` for 2026-01-01 to 2027-06-30, written from the unchanged code first (the same way as in Task 1).
    Assert that the same fields are equal after the change.
  - **`before SHAPES_FROM every day is up and down`:** every day before it has `course === 'wl'`.
  - **`the shapes come round in about the weights`:** over 365 days from `SHAPES_FROM`, `wl` is 0.3–0.5 of the days and
    each other shape is 0.12–0.28.
- [ ] **Step 2: Write the fixture from the unchanged code.** Then run `npm test`. Expected: the shape-weight test FAILS.
- [ ] **Step 3: Implement.** Restructure the return so the draws happen in this order: `r(); r();` preset, current, then
  `shape = r()`. Map it `< 0.4` `wl`, `< 0.6` `tri`, `< 0.8` `trap`, else `wlu`. Use `wl` when `day < SHAPES_FROM`.
  Make the same change in both copies.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit:** `"Today's race goes round the four course shapes, from SHAPES_FROM"`.

### Task 6: The site's copy of the geometry

**Files:**
- Modify: `lib/race.ts`
- Test: `test/sim.test.mjs`

**Interfaces:**
- Consumes: Task 3's positions, through `sim.makeCourse`.
- Produces:
  - `type Shape = 'wl' | 'tri' | 'trap' | 'wlu'`
  - `CourseGeo` gains `marks?: Partial<Record<'mark' | 'wing' | 'mark2' | 'offset', XZ>>` and `finish?: [XZ, XZ]`
  - `plannedCourse(preset, length, fleet, shape)` fills `marks` for every shape and `finish` for `trap` and `wlu`
  - `courseLegs(laps, shape)` returns the leg lists from Global Constraints
  - `legDistances` and `courseDistance` use `marks` and `finish` (`courseDistance` reads the shape from
    `CourseGeo.type`, a new field)
  - `SHAPE_NAME: Record<Shape, [en: string, ru: string]>`:
    - `wl`: `['Up and down', 'Апвинд — даунвинд']`
    - `tri`: `['Triangle', 'Треугольник']`
    - `trap`: `['Trapezoid', 'Трапеция']`
    - `wlu`: `['Up and down, upwind finish', 'Апвинд — даунвинд, финиш наверху']`

- [ ] **Step 1: Write the failing test** `the site lays every shape where the game does`. For every shape, preset,
  length, fleet in {5, 7} and laps in {1, 2}:
  - `plannedCourse` equals `sim.makeCourse(laps, beat, 0, fleet, shape)` for every mark, the gate and the finish, to
    within 0.5 m
  - `courseLegs` equals `c.legs`
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:** `"The site lays the new shapes as the game does"`.

### Task 7: The game draws and guides the new shapes

**Files:**
- Modify: `public/game/world.js`:
  - `setMarks` (≈906): a buoy for every `c.marks` entry
  - when `c.finish` is set: a pin buoy at `finish.a`, a dashed line, and a second `CommitteeBoat` at `c.finishBoat`
    flying the blue flag (`flagTexture('blue')`; add a `'blue'` flag to `committee.js` if there isn't one)
  - `ZoneRings` over the gate and every mark that has a non-beat leg
  - the pointers from `legTargets`
  - `Laylines` and `ladder` retargeted to `legAim` on every beat leg: give them `setTarget(point, from)` and call it on
    each leg change
  - the laylines are shown when `isBeat`
- Modify: `public/game/hud-next.js` (≈161, ≈324) and `public/game/main.js`:
  - the leg-name maps (≈1039) gain `mark2` and `offset` with labels: `mark2`: "Mark 2" / "Знак 2", `offset`: "Offset
    mark" / "Знак смещения"
  - on a trapezoid, `mark` reads "Mark 1" / "Знак 1"
  - the minimap (≈1243): its bounds from every mark and the finish; zones from `hasZone`; laylines and ladder from
    `legAim`
  - the coach line `cFinish` says which way the finish is when `c.finish` is set
  - the result record (≈1322) adds `type: c.type`, `marks` (each `[x, z]`) and `finish: [a, b]` when it's set, and
    keeps the existing fields
  - `pbKey` (≈1348) adds `|trap` and `|wlu`
- Modify: `public/game/stats.js`, `raceStarted`: the body gains `shape: opts.course`.

**Interfaces:**
- Consumes: `legTargets`, `legAim`, `isBeat` and `hasZone` (Task 2), and `finish` and `finishBoat` (Task 3).

- [ ] **Step 1:** Implement the changes above.
- [ ] **Step 2: Run** `npm test`. Expected: PASS.
- [ ] **Step 3: Verify in the browser.** Use `preview_start` and open `/play?race=free` four times, setting
  localStorage `regatta` `course` to each shape (light, short, 2 laps). Watch the course from above (the `top` camera)
  through the whole race, with the time sped up if the game allows. Check that:
  - every buoy and the finish boat are drawn
  - the pointer follows each leg
  - the zone rings show only where the spec says
  - the laylines are on for each beat, retargeted
  - the minimap matches
  - there are no console errors (`read_console_messages`)

  Screenshot each shape from above.
- [ ] **Step 4: Commit:** `"The game draws and guides the trapezoid and the upwind finish"`.

### Task 8: The site: set-up, hub, result page, copy

**Files:**
- Modify: `components/free-setup.tsx`:
  - the Shape choice gets all four shapes, with hints for `trap` and `wlu` in the style of the triangle's
  - shapes are filtered by `shapeOffered(venue, shape, length)`; when the current shape stops being offered, it
    switches to `'wl'`
  - reading the saved options keeps any valid `Shape`, and anything else → `'wl'`, replacing the current
    `o.course === 'tri' ? 'tri' : 'wl'`
  - the time factor per shape: `wl` 1, `tri` 1.3, `trap` 1.45, `wlu` 1.6 (adjust to the computer boats' times from
    Task 3, within ±0.2)
  - the PB key suffixes
- Modify: `components/course-map.tsx`: draw every `geo.marks` entry, and a separate finish line when `geo.finish` is
  set. The route guide covers reaches and the upwind finish, and the zone circles follow `hasZone`'s rule.
- Modify: the hub `app/race/page.tsx`, its tiles and chips: today's shape name from `SHAPE_NAME`, and its course map
  from `plannedCourse(…, d.course)`. Also `app/page.tsx` ≈133 names today's shape instead of a fixed "Up and down".
- Modify: `lib/result.ts` and `components/result-view.tsx`:
  - the `SharedResult` course gains `type?`, `marks?` and `finish?`
  - `describe()` names the shape from `type`, or from `wing` for old results
  - the map and the legs read `marks`, falling back to `windward`/`wing`
  - `legName` gains `mark2` and `offset`
- Modify: the copy that lists the courses in `app/help/page.tsx`, `lib/faq.ts`, `app/llms.txt` and `README.md` (the
  free-race row and the venues paragraph).
- Test: `test/site.test.mjs` (new). It imports `lib/result.ts` the way `sim.test.mjs` imports `lib/race.ts`. If
  `result.ts`'s extensionless `./lang` import doesn't resolve under Node, move the shape naming into a pure function in
  `lib/race.ts` (`shapeOf(course) -> Shape`) and test that instead.

- [ ] **Step 1: Write the failing tests:**
  - **`an old result still describes and lays out as before`:** a `SharedResult` fixture with only `windward`, `gate`,
    `pin`, `committee` and `wing`, and no `type`. `describe(res, 'en').detail` contains `triangle`.
  - **`a new result names its shape`:** for `type: 'trap'`, the detail contains `trapezoid`; for `type: 'wlu'`, it
    contains `upwind finish`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`, `npm run typecheck` and `npm run build`. Expected: PASS.
- [ ] **Step 5: Verify in the browser** in both languages (`/lang?to=ru`):
  - **`/race/free`:** each shape's map, hint, time and distance, and that skipped shapes disappear at a venue that
    skips them
  - **`/race`:** today's shape. Temporarily set `SHAPES_FROM` to a past date to see a non-`wl` day, then put it back.
  - **`/race/result/<id>`:** an old result and a new one from Task 7's races

  Check the phone width too (`resize_window` mobile), and screenshot each page.
- [ ] **Step 6: Commit:** `"The set-up, the hub and the result page know the four shapes"`.

### Task 9: The scores server and the mini app (`iyt-test` repo)

**Files (in `/Users/shilin/Developer/iyt-test`):**
- Create: `supabase/migrations/<timestamp>_game_races_shape.sql`, which runs
  `alter table public.game_races add column if not exists shape text;`
- Modify: `api/game.mjs`:
  - the start insert stores `shape` (one of the four, or else null), with the fallback loop's column list extended to
    `['player', 'daily', 'shape']`
  - the busiest-course key adds `r.shape || 'wl'`
  - `best` and `daily` in the GET response gain `sh`
- Modify: `api/admin.mjs`, `gameRaces`: select `shape`, and send it as `sh`.
- Modify: `miniapp/app.js`:
  - `gmCourse` names the shape when `sh` isn't `'wl'`, in English and Russian, with the names from Task 6's
    `SHAPE_NAME`
  - `gameStatsHtml` uses `g.daily.sh` instead of assuming up and down
  - `gameLeaders`'s key adds `g.sh || 'wl'`
  - the admin Overview shows the shape where it shows the course
- Then: rebuild with `npm run build`.

- [ ] **Step 1:** Read how the `player` and `daily` columns were added (migrations `20261112120000` and
  `20261113120000`, and their fallback in `api/game.mjs`), and follow the same pattern.
- [ ] **Step 2:** Implement, then run the repo's checks: `npm test` if it has one, otherwise
  `node --check api/game.mjs api/admin.mjs` and `npm run build`. Expected: no errors.
- [ ] **Step 3:** Ask the owner before applying the migration to the shared Supabase project (`iyt-test`) or deploying
  either repo. Order: migration, then `iyt-test`, then `ryc-regatta`. The game posts `shape` from Task 7 on, and the
  server ignores it until then.
- [ ] **Step 4: Commit** in `iyt-test`: `"Regatta races keep their course shape, and the game card names it"`.

### Task 10: Whole-branch check

- [ ] **Step 1: Run** `npm test`, `npm run typecheck` and `npm run build` in `ryc-regatta`. Expected: all pass, with
  `npm test` no more than about twice as long as in Task 0.
- [ ] **Step 2:** Sail one race of each new shape yourself in the preview, steering, to the finish. Confirm that:
  - the result page opens
  - its map matches the race
  - the PB is kept under the new key
- [ ] **Step 3:** Remind the owner to set `SHAPES_FROM` to the day after the deploy, in both copies, before shipping.
