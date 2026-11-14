# Club race: friends on one course, by a link

Status: draft for approval, 2026-11-14.

## Intent

Up and down is a single-player game today: you race the computer boats. Clubs want to race **each other** on club
evenings. An organiser sets up a race, sends the members a link, and everyone sails the same race at the same moment,
with computer boats making up the rest of the fleet. The first version is **one shared race per evening**, with
nothing carried over between evenings.

Success is a club evening where five or six members race without anyone needing help to join, the race doesn't
stall or split into different versions of events, and everyone ends up looking at the same results sheet.

## Goals

- An organiser can set up a race (the same choices as the free race), get a link, and share it however they like
  (WhatsApp, Telegram, email).
- A member who opens the link joins with a name. Signing in is optional, and it also works in Telegram's built-in browser.
- Before the start, everyone waits together in a waiting room that shows who has joined. The organiser presses Start.
- Everyone sails the same course in the same wind, against each other and the computer boats that fill the fleet.
- The racing rules are judged once, the same way for everyone: a foul between two members is called on the spot, and
  the give-way boat does her turns, just as against a computer boat today.
- It works on phones on ordinary mobile connections, not just on good wifi.
- If a member drops out, the race goes on: their boat holds course briefly, then a computer skipper takes it until they
  return.
- If the organiser drops out, another member's game takes over the race, and it goes on.
- After the finish, everyone sees one shared results sheet, and each member also gets their own debrief, as today.
- English and Russian, like the rest of the game.

## Non-goals (for this version)

- Seasons, series, points or club tables. Each evening stands alone.
- Clubs or member lists that the site keeps. A race exists only while it is being sailed.
- Matchmaking or public lobbies with strangers.
- Text or voice chat.
- Spectating as a feature in its own right. A late joiner into a full fleet may watch, but there's no special view
  for it.
- Protests and a jury after the race. The umpire calls fouls on the water, as now.

## Anti-goals (would make it a failure even if it works)

- Two members seeing different outcomes: a foul on one screen and not on the other, or different finishing orders.
- Steering that feels laggy or rubbery on your own boat. Your helm must answer at once, as it does today.
- The whole race dying because one phone went to sleep.
- Making joining feel like signing up for something.
- Making today's race or the free race worse, slower or bigger to download for people who never use the club race.

## How an evening goes

1. The organiser opens **Club race** from the race hub, picks the venue, wind, fleet size, course, laps, start
   sequence and current (the free-race choices), and gets a link: `regatta.rycrentals.com/club/<code>`, where the code
   is short and easy to read aloud.
2. They share it. Members open it and see the waiting room: the race settings and who's in, each with their boat
   colours from `/boat`. A member types a name if the site doesn't already know it.
3. The organiser presses **Start**. Everyone goes straight into the start sequence (one, three or five minutes, as
   chosen). No one can join as a sailor after the warning signal; anyone who opens the link later watches.
4. They race. Members' boats and computer boats sail together; hails, fouls, penalties, recalls and the start flags
   apply to everyone.
5. Each member finishes and sees the results sheet fill in as the others finish, then their own debrief.

## Constraints from the existing code

- `public/game/sim.js` runs the whole race (wind, waves, boats, rules, start sequence) in fixed steps from a seed.
  It runs headless in Node (`npm test`). It has **one human boat**, `race.player`, and about 45 places treat that
  boat specially: the messages it hears (`say`), hails (`youCanHail`, `hail`), the debrief log (`record`, `log`), the
  start flags, and the chop of the waves, which follows the wind at the player's position.
- Computer boats draw on the race's shared random numbers (`race.rand`). So two copies of the race can't simply be
  kept in step: one copy has to be in charge.
- `public/game/main.js` is the game's page: input, HUD, sound, the skipper's voice, the pause menu, and the fixed-step
  loop (`race.step(STEP)`).
- The game is a static page under `public/`, with no build step. It must not pull the Supabase client in for people
  who don't race a club race (see commit `8d3827d`).
- Supabase (project `iyt-test`, shared with the IYT app) already provides sign-in. Supabase Realtime (broadcast and
  presence) is available on the same project.
- Finished races go to the scores server (`stats.js` → `iyt.rycrentals.com/api/game`, in the `iyt-test` repo), and a
  result page `/race/result/<id>` opens from the server's copy on any device.
- **Supabase plan (checked 2026-11-14):** the `ryc` organisation is on **Pro**. Realtime limits are per project:
  500 concurrent connections, 500 messages a second, and 50 presence messages a second. Every message sent and every
  delivery to each client counts. The organisation has 5 million messages a month included across all its projects,
  then $2.50 per million (or a grace period, if the spend cap is on). For a budget, a six-member race at 10 snapshots a
  second, with inputs on a channel only the referee listens to, comes to about 110 messages a second: roughly
  130,000 for a 20-minute evening, waiting room included. A ten-boat fleet of members is about 190 a second. So
  `iyt-test` carries two to four club races at once, and about 35 evenings a month fit in the included messages if
  nothing else in the organisation uses Realtime. Going over the per-second limit drops the Realtime connections
  only (they reconnect), not sign-in or the database.
- Phones throttle or stop timers and animation frames when the page is in the background, for example when the
  organiser switches to WhatsApp to send the link. Any browser can stop at any moment.

## Approaches considered

1. **The organiser's browser is the referee (chosen).** The organiser's game runs the race from `sim.js`. Members
   send their inputs and get the fleet back through Supabase Realtime. Each member's own boat responds on their screen
   at once and is corrected to the referee's. *Gain:* the race code is reused, with no new server and little or no
   running cost. *Cost:* the race depends on one browser, so if the organiser drops, another member's game must take
   over. That handover is part of the first version.
2. **A server of our own is the referee.** The same `sim.js` runs on an always-on server (Fly.io or similar, since a
   Vercel function's time limit is shorter than a race). *Gain:* the most robust option. *Cost:* new hosting outside
   Vercel, with its own bill and upkeep. Not chosen.
3. **Every browser runs the whole race in step, exchanging only inputs.** Ruled out: browsers can compute `Math.sin`
   and the like slightly differently, so the copies drift apart and members see different fouls.

The organiser chose 1.

## The design

### Who is who

- **Referee:** the one game that runs the race. At first that's the organiser's.
- **Members:** every human sailor, the organiser included. Each sees the race through their own boat.
- **Watchers:** people who opened the link with no boat to sail (the fleet was full, or they came after the warning
  signal).

### The race on the referee

- `sim.js` changes so that a race can have **several human boats**. `race.player` becomes one of `race.humans`, and
  everything now done for "you" is done for each human boat: messages, hails, the debrief log, and penalties and
  recalls as they're announced. Messages carry the boat they're meant for.
- The single-player game keeps working exactly as now. It's a race with one human boat.
- Computer boats (`drive`) treat member boats as other boats. Where they currently react to "you" specifically
  (for example, covering the player), they react to the nearest human boat.
- The wave chop that follows the wind at the player's position is computed from the fleet's middle, or simply from
  the course's wind. It must be the same for everyone.
- A dropped member's boat (no input for about 3 seconds) holds course. After about 10 seconds, a computer skipper takes
  her over, and gives her back when the member reconnects.
- The club race has no pause.

### What travels between games

It goes over Supabase Realtime broadcast: one channel per race (`club:<code>`), and one input channel per member
(`club:<code>:in:<id>`) that only that member and the referee join. A broadcast reaches everyone on its channel, so
this keeps inputs from being delivered to every member. Realtime Presence isn't used: its limit is 50 a second.

- **Who's here:** in the waiting room, each game says hello every 3 seconds, with its member id, name, boat colours,
  join time and whether it's the organiser's. During the race, the referee's snapshots carry the list of members it
  still hears from.
- **Lobby:** the organiser's settings travel with its hello. Start broadcasts the fleet: who sails which boat, and
  which are computer boats.
- **Inputs, member → referee:** the member's helm, sheets, tack or gybe, kite, reef, jib change and hail, sent as they
  change, and at least a few times a second.
- **Snapshots, referee → all:** about 10 times a second, every boat's position, heading, speed, heel, sails and
  state (leg, penalty, over the line, finished), plus the race clock, flags and wind.
- **Events, referee → all:** fouls, hails, recalls, penalties, roundings and finishes, each named for the boat it's
  about, so each member's game can speak and show its own.
- **Handover state, referee → all, every few seconds:** a full copy of the race, enough for another game to carry on
  from it (see Handover).

### The member's screen

- Each member's game builds the same course, venue and scenery from the race settings, as it does now.
- **Your own boat** is stepped locally from your own inputs, so the helm answers at once. It's eased back toward the
  referee's position whenever they differ, softly so it never visibly jumps, except after a penalty or a collision,
  where the referee's version is taken as it is.
- **The other boats** are drawn a little behind real time, smoothed between snapshots.
- The HUD, sound, voice, hails and toasts come from the referee's events for your boat, so the umpire's calls are the
  same for everyone.

### Handover

- The referee sends a full copy of the race every few seconds. Every member keeps the latest copy.
- If the referee's presence disappears, or its snapshots stop for a few seconds, the member who has been in the race
  longest (or another clear rule that every game agrees on without talking) loads the latest copy and becomes the
  referee. They carry on, replaying inputs since the copy if they have them.
- If the organiser comes back, they rejoin as a member. They don't take the referee role back.
- A short freeze or a small jump at handover is acceptable. Two referees at once is not; the rule for choosing one
  must make that impossible, or must settle it quickly.

### Results

- When the last boat finishes (or a time limit after the first finisher), the referee writes **one results sheet**
  for the whole fleet and posts it to the scores server, the way `stats.js` posts a result today. Its link,
  `/race/result/<id>`, shows every member's place and time.
- Each member's debrief (start, speed against target, dirty air, tacks, fouls) is built from their own boat's log and
  kept as their own result, as today.
- Each member's race also counts as their own race on the scores server (start and finish), so it shows up for them.
  It should not enter the daily ranking.

### Entry points

- The race hub (`/race`) gets a **Club race** card next to today's race and the free race.
- `/club/new` is the set-up page (`free-setup.tsx` reused), which creates the code and opens the waiting room.
- `/club/<code>` is the link members open. It leads into the game with the code (for example `/play?club=<code>`),
  where the waiting room and the race happen.

## Decided by the organiser (you)

- Members are invited by a link from an organiser. It's private, with no matchmaking.
- It's for club evenings.
- Computer boats fill out the fleet.
- One shared race per evening for now. No seasons or tables.
- The organiser's browser is the referee.
- **A boat the computer brings home is DNF.** If a member drops out and is back sailing before their boat finishes,
  the place stands. If the computer skipper is sailing her when she crosses the line, she's scored DNF. The computer
  keeps sailing her meanwhile, so she stays out of the other boats' way.
- **Telegram:** the club link opens in Telegram's built-in browser like any other link, and the member types a name.
  The IYT mini app and its Telegram sign-in aren't part of this version, so nothing changes in `iyt-test` for joining.

## My calls (Claude's, open to correction)

- The organiser sails too, and presses Start. There's no separate committee screen.
- The fleet size is set by the organiser. Members replace computer boats, and late joiners into a full fleet watch.
- No one joins as a sailor after the warning signal.
- No sign-in is needed to join. A name is enough, and signing in is optional.
- The same on-the-water umpire applies between members as against computer boats.
- A dropped member's boat holds course, then a computer skipper takes over until they're back.
- Handover to another member if the referee drops is in the first version.
- No pause in a club race.
- Club races use the existing `iyt-test` project's Realtime. No new project and no extra cost at club scale (see the
  budget under Constraints).
- **Organiser and referee are separate roles.** The organiser's browser keeps a private token from `/club/new`, and
  only the organiser can press Start. Being the referee is just which game runs the race. In the waiting room, the
  referee role hands over like it does in the race, so an organiser who goes off to WhatsApp doesn't close the room.
  If the organiser has been gone from the waiting room for two minutes, anyone there can press Start, so the evening
  can't get stuck.
- **Steering and trim help stay each member's own setting** (auto-trim, split sheets), as they are today. They travel
  with that member's inputs, and the results sheet marks who sailed with auto-trim.
- **Time limit:** 10 minutes after the first boat finishes, any boat still racing is scored DNF. The single-player
  game's fast-forward of the fleet after you finish (`finishToPage`) doesn't apply to a club race. Members who finish
  wait for the sheet to complete, and watch the others in the meantime.
- The race exists only while it's being sailed, with no database for races or clubs. The results sheet is the one
  thing kept, on the scores server.

## Left to the builder

- The message formats, rates and sizes, within the budget under Constraints. Members' inputs go on a channel only
  the referee listens to, so they aren't delivered to every member. Presence is for joining and leaving only, never
  per-tick state, because its limit is 50 a second.
- How the game page gets the Supabase connection (the publishable key and URL) without loading the Supabase client
  for players who never open a club race.
- The exact smoothing and correction of your own boat and of the others.
- The handover rule and how it avoids two referees.
- The code format, and how codes stay unique among the races running at once.
- How `sim.js` is refactored for several humans, keeping `npm test` green and the single-player race unchanged.
- The `iyt-test` side: what the scores server needs to accept a fleet results sheet and to keep club races out of the
  daily ranking (that's the other repo).
- Tests: at least a headless race with several human boats driven by scripted inputs, and a handover from a saved
  copy, both in `npm test`.
