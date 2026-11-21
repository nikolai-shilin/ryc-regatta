# 1-on-1 races, release 3a: the invite and the signed-out friend

Status: built on 2026-11-21 on the branch `one-on-one-friend`, in this repo and in iyt-test. It is the first slice of
release 3 of the 1-on-1 plan, the friend challenge ("the gold lane"). It follows the rating
(`2026-11-21-one-on-one-rating.md`).

## What it does

- **The invite page says who is asking.** The host's screen reports the link as its waiting room opens: the host's
  name, from a signed-in session only, and the race's settings (`public/game/duel-log.js` `inviteBody`, a report of kind
  `invite` through `POST /connect/log`). The page `/match/<code>` reads it back in the browser (`GET /connect/invite`,
  `components/invite-info.tsx`), so the page stays built once per language for the CDN. It shows:
  - the host's name, level and rating, or "New to 1-on-1" while the rating is provisional;
  - about how long the race takes: the start, plus the median finished race of that yacht, length and laps (or of that
    length and laps), once three have been sailed;
  - one button, "Race Alex", and a note that no account is needed.
- **A friend who races signed out can keep the race.** Her screen keeps the token it sent with its join on her result
  record (`match-ui.js` `markDuel`). Her result page then shows the first race's sign-in block, "Keep your win over Alex"
  (or "Keep this race"), with Google first and a code by email beside it (`components/duel-keep.tsx`). Signed in, the page
  calls `POST /connect/claim` once, with the session's account and the token's hash only. The database's
  `regatta_duel_claim` sets her account on the race when it has none and isn't the host's. The race joins her history,
  never the rating: `regatta_duel_unrated` says "claimed".
- **Your card on /players lists every 1-on-1 race,** rated or not (`regatta_my_rating` `recent`): won or lost, against
  whom, where and in what, and the rating change, or "For fun" or "Abandoned".

## 3b: the start that waits (built after 3a)

Before the gun the start waits for both screens (`public/game/match.js` Host.tick, `START_WAIT_MS`, and `match-ui.js`).
A screen that goes quiet, a phone flipped to Telegram say, stops the start sequence and its clock. Each screen says
"Anna stepped away · the start waits · 0:24", in every language the game speaks.

- **Back within the minute:** the sequence goes on where it stood.
- **Gone longer:** the race is abandoned and both screens name the one who left. It was before the gun, so nothing
  counts. When the guest is the one who left, the host's abandon message names her (`left`), so her screen agrees.
- **A host gone quiet:** the guest's screen waits the minute and a few seconds more for the host's own word, then ends the
  race, naming the host.
- **After the gun:** the 30 s forfeit stands as before. Before this change, it also applied before the gun, so a guest
  who flipped apps during the start lost a race that hadn't begun.

## 3c: the 1-on-1 result (built after 3b)

- **Leg by leg** (`components/result-view.tsx` `LegGap`): each mark shows how far ahead of the other boat you rounded
  it, "+3.2 s on Anna", or behind her, from both boats' leg times, and the finish your margin. The track's key names her
  too. The replay already drew both boats.
- **Rematch Anna:** back to the race's own link (`/play?match=<code>`), whose waiting room either sailor can start
  again from.
- **Share:** the race's own invite link, with who won, who lost and the margin in its address (`lib/duel-share.ts`).
  Its card says "Alex P. won · 1.8 s ahead of Anna K." over the venue and the yacht, with "Race the winner"
  (`/og/page/duel`). The invite page's title says it too. Whoever opens the link can race the sharer next.

## 3d: the four cards and quick chat (built after 3c)

- **Four things before your first 1-on-1** (`public/play/index.html`, beside the first race's own four). They show
  over the loading screen while the race loads, drawn as the HUD draws its pieces:
  - the order panel, cut to the two of you, with the gap;
  - leaving: the start waits a minute, and after the gun leaving loses;
  - what a race is worth: about +33 or −31 for a first rated race, the first five counting double;
  - the rematch, one tap at the finish.

  They're shown once on a device (`regatta-duel-intro`; `?intro` shows them again), and "On to the race" goes on to
  the waiting room once the race has loaded. In every language the game speaks.
- **Quick chat** (`public/game/match-ui.js`): four set phrases, "Good luck!", "Nice start", "Rematch?" and "GG", with no
  typing.
  - Where: on the waiting room's card and the end-of-race card, while the other sailor is there.
  - What goes over the link: only the phrase's number, at most every 3 s.
  - What the other screen shows: a toast in its own language, "Anna: Good luck!", even during the race.
  - Why not during the race: the race screen's corners are the HUD's and the steering's, so there are no buttons there.
- **The race screen's own pieces** were already the HUD's: its gun clock runs the 1-on-1 start, and its order board has
  a row for each of the two boats. Nothing new was drawn for them.

## Left after release 3

- **Head-to-head with one sailor** ("Anna 7–4"), now that a guest's races can be kept.
- **Phrases to send during the race**, if a place is found for them that the HUD doesn't need.
