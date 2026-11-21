# 1-on-1 races, release 1: trusted results and today's figures

Status: built 2026-11-21. This is the first release of the 1-on-1 plan, on the design canvas "1-on-1 races", page
"Development plan". The rating itself (plain Elo) comes in release 2.

## Today's figures, before anything changes

From `public.regatta_duels`, which has recorded races since 18 Nov 2026 19:55 UTC. The data covers 18 Nov to 20 Nov 2026:
three days, not the plan's 30. These are the numbers the later targets are measured against.

| What | Figure |
|---|---|
| Races started | 51, on 31 links (12 links had rematches, at most 7 races on one) |
| Finished | 36 (71%) |
| Abandoned | 9 (18%) |
| No result (no end reported) | 6 (12%) |
| How the finished races ended | 5 forfeits, 6 with a DNF, 2 with a DSQ, the rest both home |
| Sailors with an account | 8 accounts; 44 of 51 races had two accounts, and 7 guest seats |
| Finished between two accounts | 34 |
| Median race (slower boat, finished) | 7:17 (437 s), though 44 of 51 races were on the short course |
| Start sequence | 46 races with a 1-minute start, 5 with a 3-minute start |
| Screens that ran slow | 56 of the 82 screens that reported (68%): the slow end under 20 fps, or two or more stalls a minute |

What these figures can't say yet:

- **Whether a race reached the gun.** Nothing recorded it until this release, so an abandoned race can't be split into
  before the gun and after it. From now on both screens report it.
- **Whether the two screens agree.** Only the host's screen reported the end, so every result so far rests on one screen.
- **Who the sailors are.** Eight accounts is a small group, probably testers. Treat the shares as a first reading, not as
  the baseline the targets are set against.

Two things the figures suggest for the plan:

- **"About 4 min" isn't true today.** The median race on the short course is over 7 minutes. Release 3's easy first
  races need a course that really takes about 4 minutes, or the "~4 min" labels need changing.
- **Most screens run slow.** Two in three screens dropped under 20 fps at the slow end, or stalled. This is lesson 2 of
  the first race (light venues, loading during the accept), and it needs fixing before many strangers race each other.

## What this release adds

The game reports the end of a race from both screens, and the database says whether the two agree.

- **The guest's own token.** When the guest's screen joins a race it makes a random token and sends it with the join
  (`public/game/match-ui.js` `tellJoin`, `duel-log.js` `joinBody`). The site keeps only its SHA-256, as `guest_hash`.
  The first join that brings a hash keeps it, and a join with a different hash changes nothing.
- **The guest's end.** When the race is over on her screen, and the host's results have come (or 30 s have passed, or
  the race was abandoned), the guest's screen sends its own end with `side: 'guest'` and her token. The site keeps her
  state, winner and gun beside the host's result (`guest_state`, `guest_winner`, `guest_gun`). It never changes the
  race's result, which stays the host's.
- **The gun.** Each end says whether the race reached the gun: the race clock is past nought, or there has been a
  recall. A page reopened without its race sends "unknown" for an abandoned race and "yes" for a finished one.
- **Agreed or disputed.** `agreed` is a generated column. It is null until both ends are in, and then true when both
  name the same state and the same winner. A trusted result is a finished race between two accounts that is agreed.
  Release 2 rates only trusted results.
- **The admin page.** `/admin/duels` gets four tiles, each shown once there is data for it: Reached the gun, Screens
  agree, Disputed and Trusted results. Each race's state now says what the guest's screen said of the end (Both screens
  agree, Guest's screen: …, or Host's screen only). An abandoned race also says whether it ended before or after the gun.
- **Builds from before this release.** Their reports still parse. A join with no token and an end with no side or gun
  count as the host's end with the gun unknown. If the site deploys before the migration is applied, the old database
  function ignores the new fields, and a guest's end matches no row and writes nothing.

The migration is `iyt-test/supabase/migrations/20261121120000_regatta_duel_agree.sql`. It was checked on the real
database inside a transaction that was rolled back. Checked there:

- an agreed race and a disputed one;
- a guest's end with the wrong token, and one sent with the host's token;
- a second guest end for the same race;
- a join with no token, followed by one with a token;
- a stray join with another token.

## Left for later releases

- **The player page.** The plan puts "your own 1-on-1 races, with the result" on the player page in this release. It
  needs a reading function for a sailor's own races and strings in every language the site speaks, so it is left for
  release 2, where the result page and player page change anyway.
- **A host who forges the guest's join.** A host could post a join with their own token before the guest's arrives.
  It would come from the host's own session, so `guest_user` would equal `host_user`. Release 2 rates no race where the
  two accounts are the same.
- **The match-found time.** There is no matchmaking yet, so there is no time a match was found. Release 4 adds it.
