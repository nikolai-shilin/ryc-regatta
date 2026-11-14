# New course shapes: the trapezoid, and up and down with an upwind finish

Status: draft for approval, 2026-11-14. This is Project 1 of 2. Project 2 is the coastal course at each venue, a
separate design to follow, built on the course model this one introduces.

## Intent

The game has two courses: up and down (windward–leeward) and the triangle. Every race of the day is up and down. More
shapes give players races that feel different (other points of sail, other mark roundings, another kind of finish),
both in the free race and in today's race, which now rotates through the shapes.

This project also sets up the course model that the coastal courses (Project 2) need. A course becomes a list of
rounding marks, which makes a hand-laid course with many marks just a longer list.

## Goals

- Two new shapes, offered in the free-race set-up next to the two existing ones, in English and Russian:
  - **Trapezoid**: a beat to mark 1, a reach to mark 2, a run down to the leeward gate (mark 3), and a reach to a
    finish line off to the side. Every lap after the first beats from the gate back up to mark 2 and runs down again.
  - **Up and down, upwind finish**: up and down as fleets race it, with an offset mark a short reach to the left of
    the windward mark, the gate at the bottom, and the finish line at the top of the last beat, not back at the start.
- **Today's race rotates through all four shapes**, chosen from the date like the rest of today's race. The hub shows
  today's shape and draws its course.
- Every place that shows a course shows the new ones correctly:
  - the set-up's course map, distance and time estimate
  - the hub's course map
  - the HUD's next-mark tag
  - the minimap, laylines and distance ladder
  - the 3D marks and the finish boat
  - the result page and its share card
  - the debrief's legs
- The computer boats sail the new shapes well: they round every mark properly and keep well above the scores server's
  time floor.
- Up and down and the triangle sail exactly as they do today.

## Non-goals

- Coastal courses at the venues (Project 2).
- An inner-loop trapezoid, or other trapezoid variants. There's one trapezoid.
- New recorded voice lines. The new marks reuse the existing calls and toasts ("Bear away!", "Jibe!", "Mark rounded").
- Changing the rules the umpire applies.

## Anti-goals

- Up and down or the triangle behaving differently after the refactor: other roundings, other computer-boat tracks,
  other times.
- Two players seeing different races on the same day: the hub, the game and the result page must all agree on today's
  shape.
- Today's race changing partway through the day the change is deployed.
- A shape whose marks end up on land, or tangled with the start line, at any venue it's offered at.

## How the course works today (what changes)

- `makeCourse` (`public/game/sim.js`) returns fixed fields:
  - `windward`, `wing` with `wingOut`, `gate`, `pin`, `committee`
  - `legs`, a list of `'start' | 'mark' | 'wing' | 'gate' | 'finish'`
- The finish is always the start line.
- The windward mark and the wing mark already share one idea: a mark plus its outside direction, which a boat crosses
  to round it to port. `progress()` and `aiTarget()` duplicate that code for each of them.
- About a dozen places check the leg names:
  - `sim.js`: progress, nextMark, aiTarget, the zone code, proper course, the code zero
  - `hud-next.js`
  - `main.js`: the minimap, the coach lines, the result record
  - `world.js`: the ladder and the laylines
  - `land.js`: the clear-water check
  - `lib/race.ts`: plannedCourse, courseLegs, legDistances
  - `components/course-map.tsx`
  - `components/result-view.tsx`
  - `lib/result.ts`
- `dailyRace()` exists twice, in `sim.js` and `lib/race.ts`, and `npm test` compares the two copies over 500 days.

## Approaches considered

1. **Rounding marks (chosen).** Merge the windward and wing code into one kind of rounding mark: a position, an
   outside direction, a name, and how it is approached (after a beat, or after a reach or run). A course becomes:
   - a list of rounding marks
   - the gate
   - the start line
   - a finish line (the start line, or a line of its own)

   The legs point into the list. The gate and the lines keep their own code, because they're different on the water.
   - For: this generalises code that is already generic; both new shapes are entries in a list; Project 2 appends to
     it.
   - Against: it's a moderate refactor through every file above.
2. **More branches.** `wing2`, `offset` and `finishTop` as new leg kinds, each with its own branch.
   - For: it's the fastest way to get two shapes, with the least risk to today's racing.
   - Against: it's the worst base for coastal courses.
3. **A full generic mark list**, gates and lines included.
   - For: it's the cleanest base for Project 2.
   - Against: it rewrites the gate, the start, the finish and the rule-18 zone code, so it carries the most risk to the
     races people sail every day.

The owner chose 1.

## The design

### The course model

- A course has:
  - `marks`: rounding marks, each `{ id, x, z, out, after: 'beat' | 'free', label }`. `out` is the unit outside
    direction, which is upwind for a windward mark.
  - `gate` (unchanged)
  - the start line (`pin`, `committee`, unchanged)
  - `finish`: either the start line or `{ a, b }`, a line of its own
  - `legs`: `'start'`, then `{ mark: i }` or `'gate'` entries, then `'finish'`
- Rounding a mark is today's crossing test, run against that mark's position and `out`.
- The computer boats round a mark with today's `aiTarget` code, parametrised the same way. The "tangled up at the
  mark" detour and the "owes room" wide rounding come along unchanged.
- Rule 18 at a mark follows its `after` field, which encodes the game's existing simplification:
  - `'free'` (reached on a reach or a run): it has a zone, like the wing mark.
  - `'beat'` (reached on a beat): no mark-room, like the windward mark.

  A mark reached both ways, such as trapezoid mark 2 (reach on lap 1, beat on lap 2), takes the leg's own kind. So
  `after` sits on the leg entry, not on the mark.
- The finish is crossed from the course side of whichever line it is, between its ends, as now.
- `'wl'` and `'tri'` are rebuilt on the new model with the same positions, the same leg order and the same messages.
  A seeded race of each must give the same finishing times and tracks as before the refactor (see Tests).

### The trapezoid

Marks are left to port. Laid out for the race's beat B (`x` across, `z` down the wind, wind from −z), the same frame as
today.

- **Mark 1:** the windward mark, as today.
- **Mark 2:** out to the left of mark 1 and some 100–115 m below it, straight up from the gate. The reach from mark 1
  makes the standard 60–70° angle with the beat, so it's sailed about 115° off the wind: a broad reach under the kite.
  That's broader than the triangle's tight reach to its wing mark (about 100°, code-zero weather in light air), so the
  two shapes sail differently.
- **Mark 3:** the leeward gate, two buoys, straight downwind of mark 2. The run from mark 2 is dead downwind. The gate
  is level with the start line (20 m above it), out to the left: its middle 1.2 times the start line's half-length and
  125 m beyond the line's middle, so it stays clear of the start and the left side of the first beat in any fleet.
- **Finish:** a short line of its own, 40 m long, 50 m to the right of the gate's middle and across the wind, laid
  from the start line's half-length as the gate is. It's crossed on a beam reach from the gate, so the last leg is a
  reach.
- **Legs:**
  - lap 1: start, mark 1, mark 2, gate 3
  - each further lap: beat from the gate to mark 2, run back to gate 3
  - last: reach to the finish

  So one lap is: beat, reach, run, reach home.

  The beat from the gate back up to mark 2 is shorter than the first beat, since mark 2 is below mark 1 and the gate is
  above the start line: on a short course about 66–163 m (a third to three fifths of the beat), by the wind and the
  fleet; on the longer courses two thirds of the beat or more.

### Up and down with an upwind finish

- **Windward mark:** as today.
- **Offset mark:** a short reach to the left, about 50–60 m across the wind and a little below the windward mark.
- **Gate:** as today.
- **Finish line:** at the top, 60 m long and across the wind, 15 m below the windward mark, running from 5 m to 65 m
  to its right, so boats finishing don't meet boats rounding. Its middle is within 15° of dead upwind from the gate's,
  so the last leg is a beat. It has its own committee boat, flying the blue flag, a little beyond its right-hand end,
  and its own pin.
- **Legs:**
  - each lap: start, windward mark, offset mark, gate
  - last: beat to the finish

  So a 1-lap race is up, down and up again.

### Today's race

- `dailyRace()` gets one more draw for the shape, made **after** the existing draws, so a day's wind and current stay
  as they would have been.
- The rotation starts on a fixed launch date (a constant). Days before it are always `'wl'`, so today's race doesn't
  change on the day the change is deployed.
- **Weights:**
  - up and down: 40%
  - triangle: 20%
  - trapezoid: 20%
  - upwind finish: 20%
- `lib/race.ts` gets the same change, and the 500-day comparison in `npm test` covers it.
- Today's race is short, 1 lap, with 5 boats, and goes round all the venues (`dailyVenue` in `venues.js`). So every
  shape must fit every venue's short course.

### The site

- **Set-up (`components/free-setup.tsx`):** the Shape choice gets the two new shapes, each with a one-line hint like the
  triangle's.
  - The time estimate gets a factor per shape; the upwind finish's extra beat makes it the longest.
  - The personal-best key gets a suffix per shape (`|trap`, `|wlu`). Existing keys stay as they are.
- **Hub (`app/race/page.tsx`):** today's shape in its tiles and chips, and its course in the course map.
- **`lib/race.ts`:** `Shape` gains `'trap' | 'wlu'`, and `plannedCourse`, `courseLegs` and `legDistances` follow the new
  model. It must keep matching `sim.js`; the existing "the site's course numbers are the game's" test extends to the new
  shapes.
- **`components/course-map.tsx`:** draws any list of marks, the gate, the start line and a separate finish line. The
  suggested route covers reaches and an upwind finish.
- **Result (`lib/result.ts`, `components/result-view.tsx`):** a result's course record gains `marks` and `finish`.
  Old results, with only `windward`, `gate`, `wing`, `pin` and `committee`, still open and draw as before. The share
  card names the shape.
- **Copy:** Home, Help, the FAQ and `llms.txt` mention the new shapes where they list the courses.

### The game

- **`world.js`:**
  - draws every mark in the list, and a finish committee boat and pin when the finish is a line of its own
  - the zone ring goes on marks with `after: 'free'`
  - laylines and the distance ladder follow the current beat's target: the windward mark, mark 2 on a trapezoid's
    second beat, or the finish line on an upwind finish
- **`hud-next.js` and `main.js`:**
  - the next-mark tag and the minimap read the list
  - each mark's label is "Mark 1", "Mark 2", "Offset mark" or "Finish", in both languages
  - the coach line `cFinish` says which way the finish is
- **`land.js`:** the clear-water check takes every mark, the finish line and the legs between them.

### The scores server (`iyt-test` repo, `api/game.mjs`)

- `stats.js` posts the shape with each race's start.
- `game_races` gains a `shape` column, through a migration, written the way `player` and `daily` were added: the
  insert falls back when the column isn't there.
- The free-race "busiest course" key includes the shape. Today it mixes up and down with the triangle, and that gets
  fixed along the way. Rows stored before the column existed count as up and down. The triangle times among them drop
  out of the 30-day window within a month.
- `GET /api/game` returns the shape in `best` (the busiest course) and in `daily` (today's race).
- **The IYT mini app (`miniapp/app.js`) shows the shape wherever it names a course:**
  - the Home game card (`gameStatsHtml`): it no longer hard-codes today's race as up and down, and takes today's shape
    from `daily`
  - the course leaderboard (`gameLeaders`): its grouping key includes the shape
  - the admin Overview of `game_races`

  The shape names are in English and Russian, as the mini app's other strings are, and the mini app is rebuilt
  (`npm run build`, `miniapp/build.mjs`).
- The time floor (`FLOOR` seconds a metre of beat a lap) stays valid. Each new shape's first lap has a full beat, as up
  and down has. The trapezoid's laps after the first beat only from the gate to mark 2, which is shorter than a full
  beat (on a short course about 66–163 m, by the wind and the fleet), so a 2-lap trapezoid has less beat than the
  floor counts. The floor still holds: the fastest computer-boat times stay above 1.5 times it (tested in `npm test`).

## Tests (`npm test`)

- **Refactor guard:** before the refactor, record a seeded race of each existing shape (finishing order, times,
  roundings) as a fixture. After the refactor it must match exactly.
- **Clear water:** every shape at every venue, in every wind and length, has its marks, finish line and legs in clear
  water. This is the existing venue test with the new shapes added.
- **Computer boats:** every new shape is sailed headless to the finish, with every boat rounding every mark in order
  and staying well above the time floor.
- **Today's race:** `dailyRace` in `sim.js` and `lib/race.ts` agree over 500 days. Days before the launch date are
  `'wl'`, and each day's wind and current are unchanged from before.

## Decided by the owner

- New course shapes, not new ways of racing.
- Trapezoid, up and down with offset mark and upwind finish, and coastal per venue. Coastal is a separate project, done
  second.
- The new shapes rotate into today's race too.
- The course model is built from rounding marks (approach 1).
- The IYT mini app and the admin show each course's shape too.

## Claude's calls (open to correction)

- One trapezoid, outer loop only, ending on a reach to a finish line of its own.
- Today's race weights: 40% up and down, 20% for each of the others, starting from a launch date.
- The shape draw comes after the existing draws, so a day's wind and current don't move.
- Mark-room at a mark follows the leg into it, which keeps the game's existing simplification: none after a beat, a zone
  after a reach or run.
- No new voice recordings.
- The upwind finish's line gets its own committee boat with the blue flag.
- The course work lands before the club race (`2026-11-14-club-race-design.md`) is built. Its changes stay on the
  course side of `sim.js`, away from the player handling the club race reworks.
- If a shape can't be laid in clear water at a venue in some length, the set-up doesn't offer that combination there.
  The venue list records it, and the test checks the list. Every shape must fit every venue's short course, because of
  today's race.

## Left to the builder

- Exact mark positions and finish-line sizes within the angles and distances above, tuned so the computer boats sail
  each leg on the intended point of sail at all three wind presets.
- The time-estimate factors in the set-up.
- How the result record stays readable for both old and new results.
- The migration's timestamp and wording in `iyt-test`.
- Toast and coach-line wording for the new marks, in both languages.
