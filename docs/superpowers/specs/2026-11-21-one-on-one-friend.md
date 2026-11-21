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

## Left for the next slices of release 3

- **The race screen's own pieces:** the HUD's gun clock on the start line, the order panel cut to two rows, and the
  four set phrases.
- **The four cards before a first 1-on-1.**
- **Head-to-head with one sailor** ("Anna 7–4"), now that a guest's races can be kept.
