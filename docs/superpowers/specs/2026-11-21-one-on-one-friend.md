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

## Left for the next slices of release 3

- **The start that waits for both screens:** 60 s before the gun, then both back unrated.
- **The race screen's own pieces:** the HUD's gun clock on the start line, the order panel cut to two rows, and the
  four set phrases.
- **The four cards before a first 1-on-1.**
- **The result page with the other sailor's line in the debrief and replay,** a rematch on a new code, and the share
  card at `/og/page/duel`.
- **Head-to-head with one sailor** ("Anna 7–4"), now that a guest's races can be kept.
