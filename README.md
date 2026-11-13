# Regatta

Up and down is a 3D sailing game at https://regatta.rycrentals.com. You race a windward–leeward course against computer boats, under the
racing rules. It is a Next.js app (App Router) around a static Three.js game, deployed by the Vercel project
`ryc-regatta` on every push to `main`.

## The pages

| Address | What it is | Where |
| --- | --- | --- |
| `/` | Home: the game described in detail | `app/page.tsx` |
| `/race` | The race hub: today's race, today's fastest, a free race | `app/race/page.tsx` |
| `/race/free` | Set up a free race (wind, fleet, course, laps, start, current) | `components/free-setup.tsx` |
| `/race/result/[id]` | The result and debrief after a race | `components/result-view.tsx` |
| `/boat` | Your boat: colours, logo, sail number and team, beside the game's own yacht in 3D (`/boat-view`) | `components/boat-editor.tsx` |
| `/settings` | Account, sailing, screen and sound, language | `components/settings-form.tsx` |
| `/help` | How to play, with screenshots | `app/help/page.tsx` |
| `/faq` | Questions: 32 in five groups | `lib/faq.ts`, `components/faq-list.tsx` |
| `/iyt` | The IYT sailing certification test, as rycrentals.com/iyt has it | `app/iyt/page.tsx` |
| `/sign-in`, `/sign-in/code`, `/sign-in/name` | Supabase sign-in: Google or a 6-digit email code, then a name for the ranking | `components/sign-in-forms.tsx` |
| `/play?race=today` or `?race=free` | The game itself, a static page | `public/play/index.html`, `public/game/` |

- **The game:** it lives in `public/`, and `next.config.ts` rewrites `/play` to `/play/index.html`.
  - The game and the pages share this origin, so they share localStorage:
    - `regatta` holds the options the free-race set-up and Settings write.
    - `regatta-pb` holds personal bests. For a signed-in player `components/bests-sync.tsx` merges it, on every page, with
      the copy in their account (`user_metadata.pb`), so their bests follow them to any device.
    - `regatta-result-<id>` holds each finished race. The game keeps the last 20, then opens `/race/result/<id>`.
  - The game also posts each finished race to the scores server (below), so a result link opens on any device; there
    it reads as "this boat", not "you", and the page has a Share button for your own races.
- **Scores:** `public/game/stats.js` posts every race's start, finish and result to `https://iyt.rycrentals.com/api/game`
  (`api/game.mjs` in the `iyt-test` repo, table `public.game_races`). It names the player by Telegram's launch data inside
  Telegram, or else by the site account's access token, which the game gets from `/auth/token` on this origin. The
  server drops a time faster than the course allows (0.45 s a metre of beat a lap); `npm test` checks that the
  computer boats stay well above that floor.
- **Three.js** 0.160.0 is served from `public/vendor/` (the build and the three addons the game uses), not a CDN. To
  upgrade, copy the same files from the new `three` package into a folder named for its version and change the import
  maps in `public/play`, `public/hero-view` and `public/boat-view`.
- **Languages:** English and Russian.
  - The `lang` cookie decides, set by `/lang?to=ru&back=/somewhere`; without it, the browser's Accept-Language does.
  - The game reads the same cookie.
  - The copy is inline as `t('English', 'Русский')` pairs (`lib/lang.ts`).
- **Today's race:** `lib/race.ts` is a copy of the game's `dailyRace()` and must stay in step with `public/game/sim.js`;
  `npm test` compares the two over 500 days. Its day is the UTC date, so it changes at 03:00 in Moscow and Türkiye.
  Today's fastest comes from `https://iyt.rycrentals.com/api/game` (the `iyt-test` repo).
- **Styles:** `styles/tokens.css` is the RYC design system's tokens and `styles/ryc.css` holds the pages. Layouts follow
  the screen through container queries: phone sideways, phone upright, desktop.
- **The yacht:** `public/game/yacht.glb` is made by `blender/yacht.py`. Run it in Blender; it writes the file in place.
- **The land:** every race is sailed in Göcek bay, off Skopea Marina. `public/game/skopea.bin` and `skopea.json` (the
  hills, the coast, the marinas' pontoons and the town) are made by `python3 blender/skopea.py <work dir>`, from the
  Terrarium elevation tiles and OpenStreetMap; it needs numpy and Pillow and keeps its downloads in the work dir.
  `land.js` lays each course in clear water there, `skopea.js` draws the land.
- **The skipper's voice:** in the Russian game, a recorded skipper from Odessa shouts at the crew when something goes
  wrong (a sheet left out or in too hard, a broach, a foul, a collision, aground, stopped after the gun, now and then a
  tack) and through the start (the signals, a boat too close, the line far off, over early, a quick or a late start).
  His 27 lines (three ElevenLabs recordings) are one after another in `public/game/skipper-ru.mp3`, with silence between them;
  `skipper.clips` in `main.js` says where each one starts and how long it is, `skipper.pools` which lines go with which
  situation.

## Run it locally

```bash
npm install
```

```bash
npm run dev
```

The app runs at http://localhost:5193 (the game is at http://localhost:5193/play?race=today). `npm run typecheck` and `npm run build`
check it; `npm test` sails the game's race headless in Node (about 10 seconds).

## Environment

`.env.local` (and the Vercel project) need:

```
NEXT_PUBLIC_SUPABASE_URL=https://xpdhkahgvusuicynssxq.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
```

In the Supabase project (`iyt-test`), Authentication needs:

- **Google:** the Google provider is on, with the web client "Supabase sign-in (regatta.rycrentals.com)" from the Google Cloud
  project **RYC Regatta** (`ryc-regatta`). Its consent screen, "Up and down", is published. The client's only redirect URI is
  `https://xpdhkahgvusuicynssxq.supabase.co/auth/v1/callback`. Google never shows a secret again: to replace it, add a new secret to
  the client, paste it into Supabase, then disable and delete the old one.
- **Redirect URLs:**
  - `http://localhost:5193/**`
  - `https://regatta.rycrentals.com/**`
  - The Site URL stays at its default, because the project is shared with the iyt app.
- **Email code:** the "Magic link" email template must include `{{ .Token }}`, so the email carries the 6-digit code. The link in the
  default template also works: it goes through `/auth/callback`.

The display name is kept in the user's `user_metadata.display_name`.

**Telegram:** the IYT mini app opens the site with Telegram's launch data in the hash. `components/telegram-sign-in.tsx` posts it to
`/auth/telegram`, which asks `https://iyt.rycrentals.com/api/regatta-session` (the `iyt-test` repo, which holds the bot token and the
Supabase secret key) for a one-time token and turns it into the session. The player's account is
`tg-<telegram id>@telegram.rycrentals.com` with `app_metadata.telegram_id`; that address is never mailed or shown. `IYT_API_URL`
points the route at another iyt server when testing.
