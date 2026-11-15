# Match race: you and a friend, by a link

Status: approved 2026-11-15; built the same day. This text says what was built, including where the build refined
the first draft.

## Intent

Up and down is a single-player game: you race the computer boats. A match race is the other classic format of
sailing: **two boats, nobody else**, where only who is ahead matters. The host sets up a match, sends one friend a
link, and the two of them sail it live against each other, under the match-racing rules (Appendix C of the Racing
Rules of Sailing 2025–2028): blue and yellow, entry into the start box from opposite ends, the pre-start dial-up,
penalties taken when the boat chooses, and a best-of-three match.

The pre-start fight is the reason to do it properly rather than as "the game's race with two boats": circling,
hunting, pushing the other boat away from the line and forcing her into a foul. That only exists with the entry
rule and an umpire that calls a failure to keep clear, not just a collision.

Success: two friends on phones, in different places, sail a best-of-three without help, every foul is the same call
on both screens, and the dial-up feels like match racing.

This is separate from the club race (`2026-11-14-club-race-design.md`, not built): a different format, two humans
and no computer boats. It reuses that design's transport (a dependency-free Supabase Realtime client) and its
"one browser runs the race" model, and drops the parts a two-boat match doesn't need (handover between members,
computer boats taking over, the fleet results sheet).

## Goals

- The host picks the venue, the wind, the yacht class and the course length, gets a link, and shares it however
  they like (WhatsApp, Telegram, email).
- The friend opens the link, types a name if the site doesn't know it, and is in. No sign-in needed; it works in
  Telegram's built-in browser.
- Both wait in a small waiting room that shows who is there. The host presses Start.
- They sail a match: best of three races, first to two wins.
- The match-racing rules (below) are judged once, on the host's game, and both see the same calls.
- Your own helm answers at once on your screen, host and guest alike.
- English and Russian, like the rest of the game.

## Non-goals (this version)

- Computer boats in a match, or a match against the computer.
- More than two sailors, spectators, or a third person joining the link.
- Players protesting with the Y flag. The game's umpire watches everything and calls it on its own, as now.
- Matches kept anywhere after they end: no ranking, no match history, no result page. Nothing goes to the scores
  server.
- A direct browser-to-browser link (WebRTC). Considered and left for later (see Approaches).
- Handing the race to the guest's game if the host's stops.
- Pausing a match.

## Anti-goals (a failure even if it works)

- The two players seeing different calls: a penalty on one screen and not on the other, a different winner.
- Laggy or rubbery steering on your own boat.
- Making today's race or the free race slower, bigger to download, or different in any way. The networking code is
  loaded only when a match is opened.
- Joining feeling like signing up for something.
- An umpire that calls fouls a sailor wouldn't (a penalty when the boats were clearly clear) or misses the obvious
  ones. In a match the umpire's calls are the game.

## Approaches considered

1. **The host's game runs the race, over Supabase Realtime (chosen).** The host's browser runs `sim.js` as the only
   copy of the race that counts. The guest sends their inputs and gets both boats back about 10 times a second
   through Supabase Realtime broadcast. *Gain:* one transport, works on every network and in Telegram's browser, no
   new hosting, no cost at two players, and the same transport the club race plan chose. *Cost:* each message goes
   through Supabase's servers, so the guest sees the host's boat roughly 0.1–0.15 s late (about 0.3–0.5 m at
   dial-up speeds), and a very close call is judged on the host's copy.
2. **Same, over a direct browser-to-browser link (WebRTC), Realtime only to introduce them.** About half the delay,
   but it fails on some mobile and office networks without a paid relay, so Realtime is still needed as the fallback:
   two transports to build and test. Left for later; the host's side is built so it could be swapped in.
3. **A server of our own runs the race.** A race outlasts a Vercel function's time limit, so it needs always-on
   hosting elsewhere with its own bill, and for two players it isn't fairer than 1. Not chosen.
4. **Both games run the race in step, exchanging only inputs.** Ruled out, as in the club race: browsers compute
   `Math.sin` and the like slightly differently, the copies drift, and the two players would see different fouls.

The host chose 1.

## Decided by the host (you)

- A match race: two human boats, no computer fleet.
- Real match racing: blue and yellow, entry from opposite ends, penalties taken when the boat chooses, the
  two-length zone, a best-of-three match.
- The host's game runs the race, over Supabase Realtime.
- The host invites one competitor by a link.
- The club race may still come later, so the parts the two share are built as the club race plan
  (`docs/superpowers/plans/2026-11-14-club-race.md`) describes them: `sim.js` with several human boats (`humans`,
  messages addressed to a boat, a log per boat), `net.js`, the link codes (`newCode()`), and the in-memory stand-in
  for Realtime in the tests. `sim.js` is reworked once, for both.
- The umpire's calls are checked two ways: scripted cases of the standard match-racing situations (port and
  starboard in the box, the hunt and the luff, the dial-up, a mark rounding), each checked by `npm test`; and test
  matches the host sails with a friend before it goes live, with a Debug switch that shows the umpire's reasoning for
  each call. The host signs off the calls.

## How a match goes

1. The host opens **Match race** from the race hub (`/race`), picks the venue, wind, yacht class and course length,
   and gets a link, `upandown.rycrentals.com/match/<code>`, with Copy and Share.
2. The friend opens it and lands in the waiting room: the match settings, the host's name and boat, their own. They
   type a name if needed. The host sees them arrive.
3. The host presses **Start**. Both go into race 1's five-minute sequence.
4. They race. Between races, a short card shows the score (1–0) and who's blue next; the next race starts when both
   press **Ready** (or after 60 s).
5. When one has two wins, the match card shows the winner and each race's margin, with **Rematch** (a new match on
   the same link, same settings) and **Done**.

## The rules of a match (Appendix C, as the game judges them)

The builder checks each point against the text of Appendix C in the RRS 2025–2028 and follows the book where it
differs; these are the behaviours the match must have.

- **Course:** windward-leeward (`wl`), two laps, finishing downwind. The host picks the length (short or medium);
  shapes, laps and current aren't offered.
- **Sequence:** the game's existing five-minute sequence: warning at 5:00, preparatory at 4:00, one minute, start.
- **Blue and yellow:** blue is assigned the starboard end (the committee boat), yellow the port end (the pin). The
  host is blue in race 1; they swap each race.
- **Entry:** at the preparatory signal each boat must be outside the extension of the line at her own end. Within
  two minutes after it (4:00 to 2:00) she must cross the starting line through her own end from the course side to
  the pre-start side. The boats start where they can make it: each 40 m beyond her own end on the course side, nearly
  stopped and luffing, as match boats wait outside their ends, so a boat left alone stays afloat and outside her line
  (and owes one for not entering). Late or wrong entry: a penalty.
- **The umpire calls a failure to keep clear, not only contact.** Today the game penalises only a collision. In a
  match, a boat that must keep clear and makes the right-of-way boat alter course to avoid her is penalised, contact
  or not. This is the part that makes the dial-up work and the part most likely to be judged wrong; the builder
  tunes it on recorded pre-starts so it calls the clear fouls and lets the clearly-clear ones go.
- **Rule 16 with the hunt:** a right-of-way boat that changes course must still give the other room to keep clear;
  the game already judges this and keeps doing so.
- **The zone** is two hull lengths, not three.
- **Penalties:** a penalised boat may take her penalty any time after starting and before finishing. If she gets a
  second one while the first is outstanding, she must take one at once. The turn's form is Appendix C's (on a beat,
  a gybe and back to close-hauled; on a run, a tack and back to a run), replacing the game's tack-and-gybe in a
  match. She can't finish with one outstanding: crossing the line, she must take it and finish again. Your own
  boat's outstanding penalties show in the HUD, and so do hers.
- **Winning a race:** first across the finish. A boat still with a penalty at the finish loses. If one boat breaks
  down (her sailor gone, below), the other wins the race.
- **Winning the match:** first to two race wins.

## Who's who, and what travels

- **Host:** the browser that made the match. It marks the code as its own (local storage), runs the race, and is the
  only one that can press Start. If the host closes the tab and opens the link again, the mark makes it the host again.
- **Guest:** the one other browser to join. The host's game decides who that is and keeps her, even while she is
  briefly unheard; a third person opening the link sees "This match is full".
- **The same build:** both screens must run the same deployment of the game (`/connect` says which); a screen on
  another build is asked to reload before it can start or join a race.
- Over Supabase Realtime broadcast, on channel `match:<code>`, and a second one only the host listens on for the
  guest's inputs (as in the club race design, so inputs aren't echoed back to the sender).
  - **Waiting room:** each says hello every 3 s with its name, boat colours and whether it's the host; the host's
    hello carries the settings.
  - **Start:** the host sends the race's settings and seed; both build the same course and scenery from them.
  - **Inputs, guest → host:** helm, sheets, tack or gybe, kite, reef, jib, hail, sent as they change (at most five a
    second, at once for a tack, a gybe or a big helm change, never more than ten) and at least twice a second. There
    is no take-penalty button: a penalty turn is the boat's own gybe or tack, which the game recognises.
  - **Snapshots, host → guest:** about 10 times a second: both boats' position, heading, speed, heel, sails and state
    (leg, entry done, penalties outstanding, finished), the clock, the flags and the wind.
  - **Events, host → guest:** each call the umpire makes, each signal, each rounding and finish, named for the boat
    it's about, so the guest's game speaks and shows its own.
- **The guest's screen:** your own boat is stepped locally from your inputs, so the helm answers at once. Each
  snapshot's copy of her is compared with where she herself was at the same moment (her own recent past, matched to
  when her input reached the host), and the difference is eased away softly, so the network's delay never pulls her
  helm; after a penalty, a contact or a jump of more than 20 m, the host's copy is taken as it is. The host's boat is
  drawn where it is now, carried on from the last snapshot by half the measured round trip.
- **The host's screen:** both boats from its own race; the guest's moves as the guest's inputs arrive.

## When someone drops

- No pause in a match.
- **Guest drops** (no input for 3 s): their boat holds her course. If they're back within 30 s they carry on. After
  30 s the race goes to the host; the guest can reconnect for the next race.
- **Host's game stops** (no snapshot for 3 s, e.g. the host switched apps and the phone froze the tab): the guest's
  screen says "Waiting for <host>" and freezes. When the host's game comes back, the race carries on from where the
  host's copy was. After 60 s the host's game abandons the race, not scored, and the next race can start when both
  are back; the guest's screen waits for the host's word rather than deciding on its own, so the two never disagree.
- **A dead connection** (a network switch, a half-open socket) is noticed within about 10 s, and the game reconnects
  at once when the phone comes back online, the tab becomes visible, or the race channel has gone quiet for 3 s. The
  host's own outage never counts against the guest.
- **The host's tab is reloaded or closed and opened again** (the mark brings it back as host): the race that was
  on is abandoned and not scored, since it lived only in that tab. The score and the settings are kept in the host's
  local storage (for six hours, removed on Leave or Done), so the match goes on with the next race. No save and
  restore of the race itself.
- **Back** (the browser's, or Telegram's) asks before it leaves a match, at any point.
- **Between races** the next race starts when both have pressed Ready, or 60 s after the card opens *if both are
  there*. It never starts with one of them missing; it waits.
- **Either leaves for good:** pressing **Leave** ends the match at the score it had, on both screens. So does being
  gone (no hello, input or snapshot) for 5 minutes.

## Entry points

- The race hub (`/race`) gets a **Match race** card next to today's race and the free race. Until the host has
  signed off the umpire's calls in test matches, it shows only with `?match` in the hub's address.
- `/match/new` is the set-up (the free race's set-up, cut to the match's choices: venue, wind, yacht class, length),
  which makes the code and opens the waiting room.
- `/match/<code>` is the link. It opens the game with the code (`/play?match=<code>`), where the waiting room, the
  races and the match card happen.

## Constraints from the existing code

- `public/game/sim.js` runs the whole race in fixed 1/60 s steps from a seed and runs headless in Node (`npm test`).
  It has **one human boat**, `race.player`, treated specially in about 26 places (messages, hails, the debrief log,
  penalties). A match needs two human boats and no computer boats; `Race` today always builds the player plus
  `fleet − 1` computer boats.
- The fouls today come only from contact (`foul()` from the collision check); computer boats hail the player before
  it. The rules (`judge()`: 10, 11, 12, 13, 15, 16, 17, 18, 21) are already there and are reused.
- `public/game/main.js` holds input, the HUD, sound, the voices and the fixed-step loop. The game is static ES
  modules under `public/`, with no build step, and must not load the Supabase client for anyone who isn't in a match.
- Supabase project `iyt-test` (shared with the IYT app), Pro plan: Realtime limits are per project (500 connections,
  500 messages a second). A match at 10 snapshots a second plus inputs is about 25 messages a second, so it fits
  many matches at once.
- Phones throttle or stop a background tab's timers and animation frames.

## My calls (Claude's, open to correction)

- Best of three, first to two; the host is blue in race 1 and the colours swap each race.
- Course always windward-leeward, two laps, finishing downwind; the host picks short or medium.
- The five-minute sequence, always.
- Each boat keeps her own livery from `/boat`, with a blue or yellow flag on her stern and her colour in the HUD.
- Auto-trim and the steering helps stay each player's own setting, as today.
- No sign-in needed; a name is enough. Signed in, the name comes from the account.
- Nothing is posted to the scores server and nothing is kept after the match.
- The drop-out rules and times under "When someone drops".
- The code: six characters from an alphabet without look-alikes (as the club race plan's `newCode()`), with no
  database: the code is the channel's name.
- The between-race card waits for both to press Ready, or 60 s with both there; a reloaded host loses the race in
  progress but not the match; Leave, or 5 minutes gone, ends the match.
- "Bigger to download" means the networking and the match's screens: those load only for a match. The match rules
  themselves (entry, Appendix C penalties, the umpire's no-contact call) live in `sim.js`, behind a match flag, as
  the rest of the rules do.

## Left to the builder

- Message formats and rates within the budget above; the guest's inputs on their own channel.
- How the game page gets the Supabase URL and publishable key without loading the Supabase client (the club race
  plan's `net.js`, a raw WebSocket client of Realtime, is the intended route).
- The smoothing and correction of the guest's own boat and of the other boat.
- How `sim.js` takes two human boats and no computer boats, and a match mode for the rules above, keeping `npm test`
  green and the single-player race exactly as it is (a golden test of today's race before any change).
- The exact test for "failed to keep clear" without contact, tuned on recorded pre-starts.
- The wording of the umpire's new calls (entry, penalty outstanding) in English and Russian, in the existing voices
  where a recorded line fits and as text where none does.
- Tests: at least a headless match with two scripted boats (an entry, a forced foul in the box, a penalty taken
  later, a win), and the waiting room and the drop-out rules over an in-memory stand-in for Realtime.
