# 1-on-1 Race Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record every 1-on-1 race and show the overall numbers and one row per race on a new admin page, `/admin/duels`.

**Architecture:** The game's two screens post short reports to a new same-origin route, `POST /connect/log`. The route validates them, adds the sailor's account from the session, and writes through a key-protected database function into a new table, `public.regatta_duels`. The admin page reads it through an admin-only database function.

**Tech Stack:** Next.js 16 route handlers and server components, Supabase Postgres (project `iyt-test`, id `xpdhkahgvusuicynssxq`), static ES modules under `public/game/`, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-18-one-on-one-stats-design.md`

## Global Constraints

- 1-on-1 races never reach `game_races`, or any ranking or rating. Today's race and the free race don't change.
- A slow or failed report never delays, stops or changes a race.
- Nothing is posted on localhost unless the address has `?scores`, as in `public/game/stats.js`.
- `match-ui`, `match`, `net`, `wire` and the new `duel-log` module stay out of `main.js`'s static imports.
- Every new string exists in English and Russian. The page's name is **1-on-1 races** / **Гонки один на один**.
- Limits: 60 reports per address in 10 minutes; three tries a few seconds apart; a race with no end after two hours is **No result**; at most 1,000 races in the table.
- The secret's value never appears in git, a migration, SQL text, a log or a tool's output.
- **Commits:** straight to `main` through a private index, only this task's hunks: `GIT_INDEX_FILE=<scratch>/index git read-tree HEAD`, `git update-index --add --cacheinfo 100644,<blob>,<path>` with a blob of HEAD's file plus this task's change alone, `git diff --cached` under that index to read it, commit, then `git reset -q HEAD -- <paths>`. Other sessions work in this checkout. Never push.
- Commit messages are plain sentences saying what changed, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A host who closes the page the moment the race ends must still have the `end` report delivered (`keepalive`). Pinned in Task 3.
2. A retried or repeated `end` must leave the first result standing. Pinned in Task 1.
3. A name with emoji, markup or 500 characters must be cleaned by the route and drawn as plain text on the page. Pinned in Tasks 2 and 4.
4. A host's race saved before this ships has no write token: reopening it must send no `end` and throw nothing. Pinned in Task 3.
5. A missing `DUEL_LOG_KEY` or a database failure must answer 204 and leave the race alone. Pinned in Task 2.

---

### Task 1: The table, the database functions and the secret

**Files:**
- Create: `/Users/shilin/Developer/iyt-test/supabase/migrations/20261118180000_regatta_duels.sql`

**Interfaces:**
- Produces, in the database:
  - `public.regatta_duels` with the spec's columns: `id uuid pk default gen_random_uuid()`, `code text`, `seed int`, `started_at timestamptz default now()`, `ended_at timestamptz`, `state text default 'racing'` (`racing|finished|abandoned`), `write_hash text`, `venue`, `yacht`, `wind`, `length`, `course`, `laps smallint`, `start_min smallint`, `current boolean`, `daytime`, `host_name`, `host_user uuid`, `host_place smallint`, `host_secs real`, `host_mark text`, `host_pens smallint`, the same six for `guest_`, `winner text`, `margin real`, `forfeited text`, `recalls smallint`, `prep_flag text`; `unique (code, seed)`; an index on `started_at desc`; RLS on, no policies.
  - `regatta_duel_apply(p_report jsonb) returns void`: security definer, `search_path ''`, execute revoked from `public, anon, authenticated`.
  - `regatta_duel_log(p_key text, p_report jsonb) returns void`: security definer, `search_path ''`, execute granted to `anon, authenticated`. Raises `42501` unless `encode(sha256(convert_to(p_key, 'UTF8')), 'hex')` equals the vault secret named `regatta_duel_key_hash`, then calls `regatta_duel_apply`.
  - `regatta_admin_duels(days int default null) returns jsonb`: security definer, `search_path ''`, raises `42501` unless `is_regatta_admin()`. Returns the `Duels` shape below.
- `p_report` shapes, written by the route in Task 2:
  - `{ kind: 'start', code, seed, write_hash, host_user, host_name, guest_name, venue, yacht, wind, length, course, laps, start_min, current, daytime }`
  - `{ kind: 'join', code, seed, guest_user, guest_name }`
  - `{ kind: 'end', code, seed, write_hash, state, winner, margin, forfeited, recalls, prep_flag, host: { place, secs, mark, pens }, guest: { place, secs, mark, pens } }`
- `Duels` shape, read by Task 4:
  `{ since: string | null, more: boolean, totals: { races, finished, abandoned, no_result, sailors, seats, signed, rematches, median }, days: [{ d, n, fin }], endings: { forfeit, no_winner, dnf, dsq, both }, groups: [{ k: 'venue'|'yacht'|'wind'|'course'|'start', v, n, fin }], races: [{ id, code, race_no, at, ended, state, venue, yacht, wind, length, course, laps, start_min, current, daytime, winner, margin, forfeited, recalls, prep_flag, length_s, host: Sailor, guest: Sailor }] }` with `Sailor = { name, who, kind: 'tg'|'acct'|'guest', handle, place, secs, mark, pens }`.

**Ruling on the spec:** the vault holds the SHA-256 hash of the key, not the key. The key is then never written in SQL text, so it can't reach a tool's output or the database's logs. The spec's guarantee is unchanged.

- [ ] **Step 1: Write the migration**

Rules for `regatta_duel_apply`:
- `start`: insert. On conflict, when the row's `write_hash` is null, set the hash and every start field but keep a `guest_user` and `guest_name` already joined. When the hash is set, change nothing.
- `join`: insert a row if none exists; otherwise set `guest_user` and `guest_name` only while `guest_user` is null.
- `end`: update only `where write_hash = report's hash and state = 'racing'`, with `ended_at = now()`.

Rules for `regatta_admin_duels`, from the spec's counting table:
- A row counts as **No result** when `state = 'racing' and started_at < now() - interval '2 hours'`. Finished and Abandoned go by `state`.
- `sailors`: distinct accounts plus distinct `lower(name)` of guests. `seats`: two per race with a guest name, else one. `signed`: seats with an account. `rematches`: races beyond the first per `code`. `race_no`: `row_number()` per `code` by `started_at`.
- `median`: `percentile_cont(0.5)` of `greatest(host_secs, guest_secs)` over finished races with a time. That value is also each race's `length_s`.
- `endings`, finished races only, the first that fits: `forfeited is not null` → forfeit; `winner is null` → no_winner; a `DNF` mark → dnf; a `DSQ` mark → dsq; else both.
- `days` are `started_at::date` in UTC.
- A sailor's `who` is `coalesce(raw_app_meta_data->>'telegram_id', id::text)` from `auth.users`. Her name is the account's `display_name`, else the typed name. `handle` is her email, none for Telegram. No account: `kind: 'guest'`, `who: null`.
- `races`: newest first, `limit 1000`; `more` says whether the period has more.

- [ ] **Step 2: Apply the migration** with the Supabase MCP tool `apply_migration` on project `xpdhkahgvusuicynssxq`, name `regatta_duels`.

- [ ] **Step 3: Create the secret without showing it**

Run in one shell command: `KEY=$(openssl rand -hex 32)`; print only `printf %s "$KEY" | shasum -a 256 | cut -d' ' -f1`; `printf %s "$KEY" | vercel env add DUEL_LOG_KEY production --sensitive`; append `DUEL_LOG_KEY=$KEY` to `.env.local` without echoing it. Then store the printed hash: `select vault.create_secret('<hash>', 'regatta_duel_key_hash', 'SHA-256 of the 1-on-1 race reports key')`.
Expected: `vercel env ls production` lists `DUEL_LOG_KEY`, and `git status --short .env.local` prints nothing.

- [ ] **Step 4: Verify on the real database, leaving nothing behind**

Run each check inside `begin; … rollback;` through `execute_sql`, calling `regatta_duel_apply` directly:
- `start` then `end` gives `finished` with the results; a second `end` with other numbers changes nothing.
- `join` before `start` keeps the guest's name and the start sets the hash; a second `start` with another hash changes nothing; `end` with a wrong hash changes nothing.
- `regatta_duel_log('wrong', '{}')` raises `42501`.
- `set local role anon`: `select regatta_admin_duels()` raises `42501`, `select * from regatta_duels` returns no rows, and `regatta_duel_apply` is refused.
- With `set local request.jwt.claims` naming an address in `regatta_admins`, `regatta_admin_duels(null)` returns the totals, endings and `No result` for a `racing` row aged three hours in the transaction.

Expected: every check as stated; `select count(*) from regatta_duels` is 0 afterwards.

- [ ] **Step 5: Commit** the migration in the `iyt-test` repo, through a private index, on its `main`. Do not push.

---

### Task 2: The route that receives the reports

**Files:**
- Create: `lib/duel-log.ts`, `app/connect/log/route.ts`
- Test: `test/duel-log-route.test.mjs`

**Interfaces:**
- Consumes: `regatta_duel_log(p_key, p_report)` and the `p_report` shapes from Task 1.
- Produces: `POST /connect/log`, always answering 204, taking these JSON bodies from the game:
  - `{ kind: 'start', code, seed, token, host, guest, settings: { venue, yacht, preset, length, course, laps, start, current, daytime } }`
  - `{ kind: 'join', code, seed, name }`
  - `{ kind: 'end', code, seed, token, state, winner, margin, forfeited, recalls, prep, host: { place, secs, mark, pens }, guest: { place, secs, mark, pens } }`
- Produces, in `lib/duel-log.ts`: `parseReport(body: unknown): Report | null` (pure; `token` hashed later) and `toRow(report: Report, userId: string | null, hash: string | null): object` (the `p_report` for the database).

- [ ] **Step 1: Write the failing tests**, mocking `@supabase/ssr` as `test/pages-admin.test.mjs` does

```js
test('a good start is written with the account from the session, never from the body', async () => {
  const sent = await post({ ...START, host_user: 'someone-else' }, { user: 'u-1' });
  assert.equal(sent.status, 204); assert.equal(rpc.args.p_report.host_user, 'u-1'); assert.equal(rpc.args.p_key, 'k');
  assert.equal(rpc.args.p_report.write_hash, sha256(START.token)); assert.equal(JSON.stringify(rpc.args).includes(START.token), false);
});
test('no session is a guest', async () => { await post(JOIN, { user: null }); assert.equal(rpc.args.p_report.guest_user, null); });
test('a session that fails to load is a guest, and the report is still written', async () => {});
test('each bad report is dropped with a 204 and writes nothing', async () => {
  for (const bad of BAD) { rpc.calls = 0; assert.equal((await post(bad)).status, 204); assert.equal(rpc.calls, 0, JSON.stringify(bad)); }
});
test('a name is cleaned: no markup, no emoji, 16 characters at most', async () => {
  await post({ ...JOIN, name: '<b>Анна😀</b>' + 'x'.repeat(500) }); assert.doesNotMatch(rpc.args.p_report.guest_name, /[<>😀]/); assert.ok(rpc.args.p_report.guest_name.length <= 16);
});
test('the 61st report from an address in ten minutes is dropped', async () => {});
test('with no DUEL_LOG_KEY nothing is written and the answer is 204', async () => {});
test('a database failure is a 204', async () => {});
test('a body that is not JSON, or larger than 4 KB, is a 204 and writes nothing', async () => {});
test('another site\'s Origin is refused with a 204 and writes nothing', async () => {});
```
`BAD` holds at least: an unknown `kind`, a code outside `CODE_RE` (`lib/code.ts`), a seed that is negative, fractional or over 100000, an unknown venue or yacht, a preset, length, course, laps, start or daytime outside `cleanSettings`' lists, a token that isn't 32–64 hex characters, a `state` outside `finished|abandoned`, a `winner` or `forfeited` outside `host|guest|null`, a negative margin, a place outside 1–2, a mark outside `DSQ|DNF|null`, and non-finite numbers.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/duel-log-route.test.mjs`
Expected: FAIL, with `lib/duel-log.ts` missing.

- [ ] **Step 3: Implement `parseReport` and `toRow`** in `lib/duel-log.ts`, with `VENUES`, `YACHTS` and `noEmoji` from the site's own modules. `preset` becomes the row's `wind`, `start` its `start_min`, `current` a boolean.

- [ ] **Step 4: Implement `POST`** in `app/connect/log/route.ts`, in this order: same-origin check as in `app/auth/telegram/route.ts`; the in-memory limit by the first value of `x-forwarded-for`; a body of at most 4,096 bytes; `parseReport`; `supabaseServer().auth.getUser()` for `start` and `join` inside a `try`; the `sha256` of `token` with `node:crypto`; `supabase.rpc('regatta_duel_log', { p_key: process.env.DUEL_LOG_KEY, p_report: toRow(...) })` inside a `try`. Every path answers `new Response(null, { status: 204 })`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test test/duel-log-route.test.mjs test/proxy.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit** `lib/duel-log.ts`, `app/connect/log/route.ts` and the test.

---

### Task 3: The game reports its races

**Files:**
- Create: `public/game/duel-log.js`
- Modify: `public/game/match-ui.js`
- Test: `test/duel-log-game.test.mjs`, reusing `test/one-on-one-screens.mjs`

**Interfaces:**
- Consumes: the `POST /connect/log` bodies from Task 2.
- Produces, in `public/game/duel-log.js`, with no DOM:
  - `newToken(): string` (32 random bytes, hex).
  - `report(body, { fetch = globalThis.fetch, wait = setTimeout, local = isLocal() } = {}): void`: posts with `{ method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' } }`, up to three tries 3 s apart on a network failure or non-2xx, never throws, and does nothing when `local`.
  - `startBody(match, code, token)`, `joinBody(match, code, name)` and `endBody(match, code, token, race | null, results | null)`: the bodies, using `match.result` and `M.finalResults`'s rows. With no race on this page (a reload) `endBody` reports what `match.result` holds.

- [ ] **Step 1: Write the failing tests**

```js
test('the host reports the start once for each race, rematches included', async () => { assert.deepEqual(kinds(host), ['start', 'end', 'start']); });
test('the guest reports joining once a race, and never a start or an end', async () => { assert.deepEqual(kinds(guest), ['join', 'join']); });
test('both home: the end names the winner, the margin and each boat', async () => {
  assert.equal(end.state, 'finished'); assert.equal(end.winner, 'host'); assert.equal(end.host.place, 1); assert.equal(end.guest.place, 2); assert.ok(end.margin > 0);
});
for (const [name, sail, want] of ENDINGS) test(`the end of a race: ${name}`, async () => { assert.deepEqual(pick(await endOf(sail)), want); });
test('the guest never receives the write token', async () => { assert.equal(JSON.stringify(wire.sentToGuest).includes(hostToken), false); });
test('a report that fails is tried three times, 3 s apart, and the race goes on', async () => {});
test('the end is sent with keepalive, so a page closing at once still delivers it', async () => { assert.equal(calls.at(-1).init.keepalive, true); });
test('localhost posts nothing, and ?scores posts', async () => {});
test('a host back on a page with a saved token reports the abandoned race', async () => { assert.equal(end.state, 'abandoned'); assert.equal(end.token, savedToken); });
test('a race saved before this shipped has no token: no end, no throw', async () => { assert.deepEqual(kinds(host), []); });
```
`ENDINGS` covers: both home; first home disqualified; both disqualified; the limit with a DNF; the guest silent 30 s; the guest leaving before and after her finish; the host leaving; a sleeping host; a guest who never loads the race.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/duel-log-game.test.mjs`
Expected: FAIL, with `public/game/duel-log.js` missing.

- [ ] **Step 3: Implement `public/game/duel-log.js`**

- [ ] **Step 4: Wire it into `public/game/match-ui.js`**

- Host: in `enterRace`, the first time a seed is seen, make a token, keep it in `store('regatta-match-' + code, { at, m, w })` (extend `saveMatch`), and send `start`.
- Guest: in `enterRace`, send `join` once for each seed.
- Host: one choke point in `beat`, and in `leave` before the page goes: when `match.state === 'over'` and this seed's `end` hasn't been sent and a token exists, send `end`. Wait for `cur.H`'s final results when the race was sailed here.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test test/duel-log-game.test.mjs test/match-ui.test.mjs test/match-ui-flows.test.mjs test/one-on-one-endings.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit** `public/game/duel-log.js`, `public/game/match-ui.js` and the test.

---

### Task 4: The admin page

**Files:**
- Create: `app/[lang]/admin/duels/page.tsx`, `components/admin-duels.tsx`
- Modify: `components/admin-shell.tsx` (`ADMIN_PAGES`, `adminRpc`), `components/admin-players-table.tsx` (`Row.cells: ReactNode[]`), `test/pages-admin.test.mjs` (its fixture for the new page)
- Test: `test/admin-duels.test.mjs`

**Interfaces:**
- Consumes: the `Duels` shape from Task 1; `logHref(who, days)` from `components/admin-logs`; `PlayersTable`; `Tile` from `components/admin-stats`.
- Produces: `AdminDuels({ lang, data, days }: { lang: Lang; data: Duels; days: number | null })`, `export type Duels`, and `pickDuelDays(q?: string): number | null` (`7`, `30` or `90`, else `null` for all time). `adminRpc` takes `'regatta_admin_duels'` and `days: number | null`.

- [ ] **Step 1: Write the failing tests**, rendering with `renderToStaticMarkup`

```js
test('the totals: races, finished, abandoned, no result, sailors, signed in, rematches, median', () => { for (const s of ['128', '104', '81%', '17', '7', '86', '61%', '39', '11:42']) assert.match(html(), new RegExp(s)); });
test('each race shows who, where, when, the settings, the result and the state', () => {});
test('a signed-in sailor links to her log; a guest is marked and has no link', () => {});
test('DSQ, DNF, a forfeit, no winner, abandoned and no result each read as such, in both languages', () => {});
test('a name with markup is drawn as text', () => { assert.doesNotMatch(html({ name: '<img src=x>' }), /<img src=x>/); });
test('no races: the page says so', () => {});
test('more than the table holds: the page says only the newest 1,000 are shown', () => {});
test('the period links are All time, 90, 30 and 7 days, and All time is the default', () => { assert.equal(pickDuelDays(undefined), null); assert.equal(pickDuelDays('30'), 30); assert.equal(pickDuelDays('13'), null); });
test('a non-admin sees none of it', async () => {});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/admin-duels.test.mjs`
Expected: FAIL, with `components/admin-duels.tsx` missing.

- [ ] **Step 3: Implement the page**, laid out as the spec's sketch, with the admin's existing classes (`adm-range`, `adm-tab-scroll`, `adm-players`). The entry in `ADMIN_PAGES` has id `duels`, `IconCrew`, name `['1-on-1 races', 'Гонки один на один']`. Times are shown in UTC, as on `/admin/players`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/admin-duels.test.mjs test/pages-admin.test.mjs test/components-admin.test.mjs && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit** the listed files.

---

### Task 5: A real race on the real database

**Files:**
- Modify: `README.md` (what a 1-on-1 race records, and `/admin/duels`)

- [ ] **Step 1: Sail a race in two tabs** on the dev server with `?scores`, as `localhost` and `127.0.0.1`: finish it, sail a rematch, and leave during the rematch.

- [ ] **Step 2: Check the rows** with `execute_sql`: two rows for the code, the first `finished` with both boats' results, the second `abandoned` or forfeited, with no `write_hash` readable by `anon`.

- [ ] **Step 3: Check the page**: sign-in is the owner's, so if `/admin/duels` can't be opened in the browser pane, render its data by calling `regatta_admin_duels` with the admin's claims in a transaction and say what wasn't seen.

- [ ] **Step 4: Delete the test rows** by their code, after showing the owner what will go. Expected: `select count(*) from regatta_duels where code = '<code>'` is 0.

- [ ] **Step 5: Update `README.md`**, run the touched test files on a clean export of HEAD, and commit.
