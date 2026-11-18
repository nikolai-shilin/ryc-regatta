# 1-on-1 race stats, and an admin page for them

Status: draft for approval, 2026-11-18.

## Intent

The 1-on-1 race records nothing today, so the owner can't see whether anyone sails it, who they are, or how the races
end. This change records every 1-on-1 race and adds an admin page with **overall numbers for all 1-on-1 races** and a
**detailed table with one row per race**: who, where, when, in which settings, and how it ended.

## Goals

- Every 1-on-1 race that starts is recorded, including ones that are abandoned or never report an end.
- `/admin/duels` shows the overall numbers and the table, in English and Russian, to admins alone.
- A signed-in player's identity is confirmed by the server, not taken from what the game says.

## Non-goals

- Races before this ships: they were never recorded, and can't be recovered.
- Links created but never started. A row begins when the host presses Start.
- Anything public: no ranking, rating, player card or personal best uses this data.
- Moving the existing scores API. It stays on `iyt.rycrentals.com`.

## Anti-goals (a failure even if it works)

- 1-on-1 races reaching `game_races`, or any ranking or rating.
- A slow or failed report delaying, stopping or changing a race.
- A player or a visitor being able to read this data.
- Today's race and the free race changing in any way.

## Approaches considered

1. **A small API on sailupdown.com (chosen by the owner).** The game and its stats stay in this repo and deploy together.
   The existing scores API isn't touched.
2. **Add it to the scores server in `iyt-test`.** The pattern already exists, but the work spans two deployed repos.
3. **Move the whole scores API to sailupdown.com first.** A large, risky job for live rankings, and not needed for this.
4. **Add the races to `game_races` with a flag.** Rejected: every ranking query reads that table, and one missed filter
   would put 1-on-1 races in the rankings.

## How a race is recorded

The game posts to a new route on this site, `POST /connect/log` (beside `/connect`, which the race already uses). It is
same-origin, so the player's session cookie comes with it. Reports never block the game: they are sent in the background,
and a failure is ignored after up to three tries a few seconds apart. As in `stats.js`, nothing is posted on localhost
unless the address has `?scores`.

| Report | Sent by | When | Says |
|---|---|---|---|
| `start` | Host | The host's screen enters the race, and at each rematch | Code, seed, the host's write token, the settings, both names |
| `join` | Guest | Her screen has the race | Code, seed, her name |
| `end` | Host | The race is over or abandoned, by any path on the host's screen | Code, seed, the write token, how it ended, each boat's result |

- **Who sailed:** the route calls `supabase.auth.getUser()` on each `start` and `join`, as `/connect` does, and a route
  handler can refresh an expired session. An account therefore comes from the server. A sailor with no valid session is
  recorded as a guest under the name they typed. A Telegram player has a session once `components/telegram-sign-in` has
  signed them in; one who opens `/play` directly without it is a guest, by design.
- **Only the host can report the end:** the host's screen makes a random write token for each race and sends it with
  `start` and `end`. The server keeps only its hash. The guest never sees it, so she can't write her own result. The token
  is kept with the host's saved race, so a reloaded host can still report the race as abandoned.
- **Reports may arrive in any order:** `join` before `start` is kept, and `start` then sets the write hash on that row. Once
  a row has a write hash, a `start` with a different token changes nothing. `start` and `join` are safe to repeat. The first
  valid `end` stands.
- **A Start whose guest never loads the race** is a row, reported as abandoned. An abandonment only the guest's screen sees
  has no `end`, so it becomes **No result**.
- **A race that never reports an end** stays `racing` in the table. After two hours the page shows it as **No result**.
- **The route checks everything:** code format, seed, known venue and yacht, allowed settings, name length, numbers in
  range. It answers 204 either way. It limits each address (the first value of `x-forwarded-for`) to 60 reports in 10
  minutes, counted in memory per server instance as `api/game.mjs` does, so the limit is a brake and not a guarantee.
- **What this protects against:** a player can't claim an account that isn't theirs or rewrite a race they don't host.
  Someone determined could still post made-up races as a guest. This is an admin-only page, so that is accepted.

## What is kept

A new table `public.regatta_duels`, one row a race, unique on `(code, seed)`:

- **Race:** `id`, `code`, `seed`, `started_at`, `ended_at`, `state` (`racing`, `finished`, `abandoned`), `write_hash`.
- **Settings:** `venue`, `yacht`, `wind`, `length`, `course`, `laps`, `start_min`, `current`, `daytime`.
- **Each sailor (`host_`, `guest_`):** `name`, `user` (account id or null), `place`, `secs`, `mark` (`DSQ`, `DNF` or null),
  `pens`.
- **Outcome:** `winner` (`host`, `guest` or null), `margin`, `forfeited` (`host`, `guest` or null), `recalls`, `prep_flag`.

Row-level security is on with no policies, so nobody reads or writes the table directly.

**Writing:** a security-definer function `regatta_duel_log(p_key, p_report)`, callable with the public key, compares `p_key`
with the vault secret named `regatta_duel_key` (`vault.decrypted_secrets`), exactly as `regatta_push_due` does with
`regatta_push_key`. The site holds the same value as `DUEL_LOG_KEY`. This needs no Supabase service key on the site, and the
secret can do nothing but write these reports. The value is generated once at build time, stored with `vault.create_secret`
run directly against the database and with `vercel env add`, and never appears in git, a migration or a log.

**Reading:** `regatta_admin_duels(days)`, for a regatta admin alone (`is_regatta_admin()`), like `regatta_admin_players`.
`days` null means all time. It returns the totals and at most 1,000 races, newest first, and says when there are more.
Account names and emails are joined in here, as on `/admin/players`.

The migration goes in `iyt-test/supabase/migrations`, where every other `regatta_` table is kept, and is applied to the
`iyt-test` database.

## The admin page

A new entry in `ADMIN_PAGES` (`components/admin-shell.tsx`): **1-on-1 races** / **Гонки один на один**, at `/admin/duels`. The
period filter offers **All time** (the default here), 90, 30 and 7 days.

```
1-ON-1 RACES                                    All time · 90 · 30 · 7 days

Races   Finished   Abandoned   No result   Sailors   Signed in   Rematches   Median race
  128      104 81%       17          7        86         61%          39       11:42

Races per day   ▂▅▃▁▇▂▄▅▃▂▆▃▂▁▄▆▇▃▂▄
Endings         Both home 71 · Forfeit 22 · DSQ 8 · DNF 3
By venue · yacht · wind · course · start     (a table each: races, finished %)

EVERY RACE
When          Where / settings              Host       Guest     Winner  Result                 Margin  Length  State
18 Nov 14:02  Enoshima · RS21 · Light       Anna P.    Boris ·g  Anna    1st 8:41 / 2nd 8:53     12.0 s  8:53    Finished
              Triangle · Short · 1 lap · 1 min
18 Nov 13:40  Cowes · JPK 1050 · Medium     Boris ·g   Max       Max     DSQ / 1st 7:02          –       7:02    Finished
```

**How the numbers are counted:**

| Number | Meaning |
|---|---|
| Races | Every row in the period, by `started_at` |
| Finished, Abandoned, No result | By state; `racing` older than two hours is No result. Percentages are of all races in that group |
| Sailors | Distinct accounts plus distinct guest names, ignoring case. A guest who changes name counts twice |
| Signed in | The share of seats (two per race with a guest) sailed with an account |
| Rematches | Races beyond the first on each code |
| Median race | Over finished races with a time: the slower boat's time |
| Endings | Finished races, each counted once, the first that fits: Forfeit, No winner, DNF, DSQ, Both home |
| Per day | UTC days, as on the other admin pages |

- Every column sorts on click, reusing `components/admin-players-table.tsx`'s behaviour.
- A signed-in sailor links to their log on `/admin/players`. A guest is marked as a guest.
- The Rematch number shows when a code has sailed more than one race.

## Constraints

- `public/game/` is static ES modules. The reporting code loads only with the 1-on-1 race (`match-ui.js`), never in
  `main.js`'s imports.
- Several sessions work in this checkout at once. Commit only this work's hunks, through a private index.

## How it is checked

- Tests of the route: a good report of each kind, every kind of bad report, the rate limit, a session against no session,
  a wrong write token, reports out of order and repeated, and a failed database write.
- Tests of the screens: each ending sends the right `end` once, a failed report changes nothing in the race, and localhost
  posts nothing.
- Tests of the page: totals, each state and mark, empty data, an admin against a non-admin, both languages.
- The migration on the real database: a test race written through the function and read through the admin function, a
  non-admin refused, and the test rows removed.
- A real race in two tabs with `?scores`, seen on the admin page.

## My calls (Claude's, open to correction)

- The page's name and address, and **All time** as its default period.
- A race counts from the moment the host presses Start.
- A race with no end after two hours shows as **No result**.
- Up to 1,000 races in the table at once.
- Rows are kept until someone deletes them.
- A new secret, `DUEL_LOG_KEY`, created at build time and stored in the Supabase vault and in this site's Vercel project,
  in place of the two keys discussed earlier.
- How each overall number is counted (the table above).
- A Telegram player who opens `/play` directly, with no session, is recorded as a guest.
- The rate limit is per server instance, as on the scores API.

## Left to the builder

- Exact payload field names, and the look of the page within the admin's existing styles.
- The wording of new strings in both languages.
