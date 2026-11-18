# The 1-on-1 race: two friends, today's rules

Status: draft for approval, 2026-11-18. Replaces the match race in `2026-11-15-match-race-design.md`.

## Intent

The match race is a special mode: blue and yellow, Appendix C, an umpire of its own, best of three. None of that
carries over to a race with more than two people. This change turns it into an ordinary race that happens to have two
human boats, sailed by the same rules as today's race. It is the first step towards multiplayer races with more
participants: after it, the race code knows only one set of rules, and adding sailors is a matter of opening up the
waiting room and the host.

Success: two friends on phones, in different places, sail one race by a link. Every foul, penalty, flag and recall works
as it does in today's race, both screens agree on all of it, and both see the same result.

## Goals

- One race between two people, with no computer boats.
- The rules of today's race, with no exceptions (see "The rules").
- The host sets the race up with the free race's choices, pre-filled with today's settings.
- A results card on both screens, a Rematch, and the usual result page with the debrief.
- English and Russian, like the rest of the game.

## Non-goals (this version)

- More than two sailors. The waiting room, the host and the guest stay two-seat.
- Computer boats filling out the fleet.
- Rankings, ratings or personal bests from a 1-on-1 race. Nothing goes to the scores server.
- A running score across rematches. Each race stands alone.
- Showing the feature to everyone. The `?match` gate on the hub stays until the owner has sailed it with a friend.
- Renaming code and addresses. `/match/<code>`, `?match=`, `match.js`, `match-ui.js`, the channels and the local-storage
  keys keep their names, so this change stays about behaviour. The rename belongs to the many-boats step.

## Anti-goals (a failure even if it works)

- Today's race or the free race changing in any way, or downloading more. The golden tests must pass untouched.
- The two screens disagreeing: a penalty, a disqualification, a place or a winner on one and not the other.
- Laggy or rubbery steering on your own boat.
- A second set of rules left in the race code behind a switch.

## Approaches considered

1. **Replace match mode (chosen).** The Appendix C rules come out of `sim.js`, and the 1-on-1 race is a plain `Race` with
   two humans. One set of rules to maintain, and every improvement to today's race reaches multiplayer too. The tuned
   umpire is lost, but stays in git history.
2. **Keep both rule sets behind a switch.** Nothing lost, but every foul, penalty and finish keeps two code paths, one of
   them reachable from no screen.
3. **Replace match mode and build for any number of sailors now.** Closest to the end goal, but a much bigger change, and
   the rules and the player count would be tested at the same time.

The owner chose 1.

## Decided by the owner

- The whole format of today's race, not only its on-water rules.
- The host chooses the settings.
- Match mode is replaced, not kept behind a switch.

## How a race goes

1. The host opens the set-up (`/match/new`), chooses the race, and gets a link. Copy and Share work as now.
2. The friend opens the link, types a name if the site doesn't know it, and lands in the waiting room.
3. The host presses Start, and both go into the start sequence the host chose.
4. They race. A boat that finishes first stays on the water, and her screen shows who is still racing and the time left.
5. When the race is over, each screen shows the results card: the places and the gap, with **Rematch** (host), **Full
   result** and **Done**. The guest sees that the host can start a rematch.

## The rules

Exactly today's, because they are the same code:

- **Fouls** are called on contact only. A boat touching a mark is penalised as in today's race.
- **Penalty:** one tack and one gybe, turning the same way, begun straight away. A boat that finishes with it unserved is
  disqualified.
- **The zone** is three hull lengths.
- **The start:** the boats start from below the line in the normal fleet positions. The preparatory flag is P, U or black,
  drawn from the seed as in any race. A boat over at the gun is recalled on her own; both over is a general recall
  (today's threshold gives this at two boats).
- **The hail:** the other boat hails you when you must keep clear, as a computer boat does today. `hails()` extends to
  human boats. A race with one human is unaffected.
- **Current:** the venue's and the setting's, as in any race, including rivers.

## The finish (the only rules a two-human race adds)

Today's race ends the moment the player finishes, and the computer boats are sailed home unseen. With a second person
still racing, that can't work. For a race with more than one human:

- The race is over when every human boat has finished, or **3 minutes** after the first **valid** finish, whichever is
  first. A valid finish is one that isn't disqualified. A boat out under the U or black flag, or home with a penalty
  unserved, doesn't start the limit, and the other boat sails on to her own finish.
- A boat still racing at that limit is **DNF** (did not finish).
- **Winner:** the first boat home that is not disqualified. **Margin:** the time to the next boat that finished and is
  not disqualified; none if there is no such boat. With neither boat a valid finisher there is no winner.
- **A finished boat is out of the race.** She can't touch the boat still racing and casts her no wind shadow, on either
  screen, so she can't block the line or slow her rival. This applies only with more than one human, so a single-player
  race is unchanged.
- **A boat that has finished can't forfeit.** The guest's silence after her own finish costs her nothing, and the race
  simply runs out to its end. Before her finish the existing rule stands: silent for 30 s and the race is the host's.
- **A forfeit wins nothing for a boat already out.** If the boat left on the water is out under the U or black flag, the
  race has no winner.

## When someone leaves or stops

The race lives in the host's tab, so the two sailors can't be treated alike.

- **The guest presses Leave before her finish:** she forfeits at once, as if she had been silent for 30 s.
- **The guest presses Leave after her finish:** her place stands, and the race runs on to its end for the host.
- **The host presses Leave while the race is on,** before or after her own finish: the race is abandoned and not scored,
  on both screens.
- **The host's tab stops** (a phone hides a tab and stops its frames): the existing rules stand. The guest sees "Waiting
  for the host", the race carries on if the host is back within 60 s, and after that it is abandoned and not scored, even
  if the host had already finished. While a finished host waits, her screen tells her to keep it open.
- **An abandoned race's card** says so, has no Full result, and offers Rematch if both are there.

## Who sets up the race

`/match/new` offers everything the free race offers except the number of boats: venue, yacht, wind, time of day, shape,
length, laps, start sequence and current. It opens pre-filled with today's settings. The host's choices travel in the
hello and the start message as the settings do now, and `match-ui.js` validates each of them. Both screens build the race
from the same settings and seed.

The two start positions are not identical, so which sailor gets which is decided by the race's seed. A rematch has a new
seed, and neither sailor is always on the better spot.

## What travels between the screens

The host's game still runs the race, the guest's still follows it, and the transport is unchanged. Today's rules need
four things the snapshot doesn't carry yet:

- **The preparatory flag and the recall count**, on every snapshot. The count is the single source of truth for a general
  recall: when it changes, the guest takes the host's clock as it is, backwards too, and resets her own legs, tracks and
  recent poses. Her clock today only ever moves forward, so without this she would stall for the length of the sequence.
- **U and black-flag disqualifications** and **DNF**, per boat.
- **The penalty turn's progress** (tack done, gybe done, direction), per boat, so the HUD shows it on the guest's screen.
  The host stays the only judge of it. The guest's own step must not change the host's copy of the turn.
- **The result data.** Only the host records the race (`record()` runs in `step()`), so the guest has no debrief of her
  own. When the race ends the host sends each boat's log, leg times, penalties and thinned track in a new message,
  repeated every second until the guest acknowledges it.

The fields only a match used (`owed`, `side`, `entered`) leave the snapshot. Both screens must already run the same build,
so the row format can change freely.

## After the race

- **The card** lists first and second with the gap, or DSQ or DNF for a boat without a place. It replaces the between-races
  card, the Ready button and the score.
- **Rematch** is the host's, with both present: same settings, new seed, the same guest.
- **Full result** opens the usual result page in the same tab and leaves the race, like Done. The other screen is told,
  and keeps her own card and her own Full result. Same-tab is deliberate: the result lives on this device only, and a new
  tab opens elsewhere in Telegram's browser.
- **The record** is saved on each screen as the race ends, whether or not Full result is pressed. A valid finish earns the
  venue's passport stamp, as a free race does: the stamp says you sailed there, not how you ranked.
- **The result page** shows a 1-on-1 race as such (a flag in the record): its own heading, both boats, DNF shown plainly.
  It offers no ghost, no personal best, no share link and no comparison with today's field. Its main button goes to
  `/match/new`.
- **A reloaded host:** the race on the water is abandoned, as now. The card says so, and Rematch is offered.

## What goes away

- From `sim.js`: `match`, `blue`, `placeMatch`, `entry`, `matchPens`, `matchTurn`, `umpire`, `closing`, `UMPIRE`, `calls`,
  `incidents`, the two-length zone, `owed`, and every `if (this.match)`.
- From `match.js`: best of three, colours, the Ready cards and the automatic next race. `Match` shrinks to one race's state
  and `Keeper` to who is present and whether the guest has the race loaded.
- From `match-ui.js`: the HUD strip, blue and yellow, the entry and penalty notes, and the umpire debug panel.
- From `main.js` and `world.js`: `matchMessage`'s Appendix C calls, their strings, and the stern flags.
- `test/match-rules.test.mjs`, replaced by tests of the rules above.

A new `race.multi` (more than one human) takes over from `race.match` wherever the game must know that the race is shared:
no time compression, the race runs on under the pause menu, nothing is posted by `stats.js`, no personal best, and no jump
to the result page at the finish.

## What people read

The feature is called **1-on-1 race** / **Гонка один на один** on the hub, the home page, the set-up, the waiting room, the
share card and the link's page. "Best of three" and the match-racing wording go. The README's description is updated. The
venue guides' passages about real match racing stay, since they are about the sport.

## Constraints

- `public/game/` is static ES modules with no build step. The networking loads only for a 1-on-1 race.
- `Race` must stay deterministic for a single human: same draws in the same order.
- Several sessions work in this checkout at once, and `sim.js`, `main.js`, `match-ui.js`, `free-setup.tsx` and
  `test/match-rules.test.mjs` have uncommitted changes from others. Commit only this work's hunks, through a private index.

## How it is checked

- `npm test`, with the single-player golden fixtures unchanged.
- Headless two-human races over the in-memory hub: a contact foul and its penalty turn on both screens, the U and black
  flags, a general recall, finish order, DSQ, the 3-minute limit and DNF, a finished boat that can't touch or shadow the
  other, a guest going silent or leaving before and after her finish, and a host leaving.
- Both start positions can reach the line in time at every venue, on the one-minute sequence.
- A real race in two browser tabs before it is called done.

## My calls (Claude's, open to correction)

- The 3-minute limit, started only by a valid finish.
- A finished boat can't touch or shadow the boat still racing.
- Leaving: the guest forfeits, the host's leaving abandons the race, and a host's tab stopped over 60 s abandons it too.
- No rankings, ratings or personal bests, but a valid finish earns the venue's passport stamp.
- The name "1-on-1 race" / "Гонка один на один".
- Full result leaves the race, in the same tab.
- The `?match` gate stays for now, and code and addresses keep their names.
- Start positions decided by the seed.
- The other boat's hail extended to human boats.

## Left to the builder

- Message formats and field layouts within the above.
- How `main.js` shares its result-record code with the 1-on-1 flow.
- The wording of the new strings, in both languages.
- What a boat's label and colour are now that blue and yellow are gone.
