# 1-on-1 races, release 2: the rating

Status: built on 2026-11-21 on the branch `one-on-one-rating`, in this repo and in iyt-test. It follows release 1, trusted
results (`2026-11-21-one-on-one-trusted-results.md`), and the plan on the design canvas "1-on-1 races".

## The rating

The rating is plain Elo, and the site and the database do the same sums:

- In the site: `lib/elo.ts`.
- In the database: `regatta_elo_delta` and `regatta_rate_duel`, in iyt-test
  `supabase/migrations/20261121140000_regatta_rating.sql`.
- `test/elo.test.mjs` runs the cases the database function was run against, so the two can't drift apart unseen.

The rules:

- Everyone starts at 1500.
- Your chance against another sailor is 1 / (1 + 10^((theirs − yours) / 400)).
- A win earns round(K × (1 − chance)) and a loss costs round(K × chance).
- K is 64 for a sailor's first five rated races and 32 after. During the first five the rating is provisional and shows
  with a ~.
- Nothing decays and there is no uncertainty band.

There are seven levels, 200 apart, in `lib/levels.ts`: Novice (under 1200), Local, Fleet, Regional, National, International
and Olympian (from 2200). Each has a name in every language the site speaks.

## Which races count

A race is rated once, by a trigger on `regatta_duels`, when it becomes agreed (release 1). All of these must hold:

- it finished with a winner (a forfeit counts, and the one who gave up loses);
- both screens agree on the state and the winner;
- both seats have an account, and not the same one (this closes the forged-join gap release 1 left);
- the pair has had fewer than three rated races since midnight UTC.

A race that was abandoned, had no winner, was disputed, or was told by one screen only is never rated.
`regatta_duel_rating` says which rule stopped a race.

## Where it shows

- **The game's card after a race** (`public/game/match-ui.js` `askRating`): a line such as "1-on-1 rating 1558 (+18) ·
  Fleet", or "~1533 (+33) · race 1 of 5" while provisional, or why the race isn't rated. It is green for a gain and
  orange for a loss. A screen signed in asks `GET /connect/rating` once the race is over, again every 4 s while the
  answer is "waiting", for 90 s at the most. The line is made on the site in the sailor's language, so the game's
  string files don't change.
- **The result page** (`components/duel-rating.tsx`, under the results of your own 1-on-1 race):
  - the new rating, the change, and what it was before;
  - the level, with a bar showing how far the next one is (or, while provisional, which of the five races this was);
  - the other sailor's new rating and change.

  The game now stamps the race's code and seed on the record it keeps (`markDuel`), so the page knows which race to
  ask about.
- **Your own card on /players** (`components/my-duel-rating.tsx`, from `GET /connect/rating/me`):
  - the rating and level, and the bar to the next level;
  - the record, and your place among settled ratings;
  - best and lowest;
  - your last five rated races.

  A sailor with no rated race is told everyone starts at 1500, with a link to race someone.

## Left for later

- **Leaving after the gun** is now a loss (`20261121160000_regatta_rating_leaving.sql`). Each screen's end says who
  left: the host's Leave, her tab asleep past a minute, her page gone mid-race; on the guest's screen also the host silent
  five minutes. Rated as a loss for the leaver:
  - when both screens report the race abandoned after the gun and name the same leaver;
  - when the host's screen never reports and the guest's says the host left after the gun, a minute after her report.
    Her screen only gives up on a silent host after five minutes, so the host has had those to say otherwise. Each
    report sweeps such races (`regatta_rate_waiting`), as does the guest's screen asking after its rating.

  The guest pressing Leave before her own finish is her forfeit on both screens now. Before, her screen sent no end, so
  that forfeit went unrated as "one screen only". A race abandoned before the gun, or one where the screens name different
  leavers, is never rated.
- **The full rating page and the leaderboard tab.** The design's rating page (the chart, the spread of all sailors, the
  record by opponent) and the 1-on-1 tab on the race board are release 6 of the plan.
- **Stakes before the race.** Match found's chance and stakes come with matchmaking (release 4). `lib/elo.ts`
  `stakes()` is ready for it.
