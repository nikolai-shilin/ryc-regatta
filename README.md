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
| `/settings` | Account, sailing, screen and sound, language | `components/settings-form.tsx` |
| `/help` | How to play, with screenshots | `app/help/page.tsx` |
| `/sign-in`, `/sign-in/code`, `/sign-in/name` | Supabase sign-in: Google or a 6-digit email code, then a name for the ranking | `components/sign-in-forms.tsx` |
| `/play?race=today` or `?race=free` | The game itself, a static page | `public/play/index.html`, `public/game/` |

- **The game:** it lives in `public/`, and `next.config.ts` rewrites `/play` to `/play/index.html`.
  - The game and the pages share this origin, so they share localStorage:
    - `regatta` holds the options the free-race set-up and Settings write.
    - `regatta-pb` holds personal bests.
    - `regatta-result-<id>` holds each finished race. The game keeps the last 20, then opens `/race/result/<id>`.
  - A result link therefore works only on the device that sailed the race.
- **Languages:** English and Russian.
  - The `lang` cookie decides, set by `/lang?to=ru&back=/somewhere`; without it, the browser's Accept-Language does.
  - The game reads the same cookie.
  - The copy is inline as `t('English', 'Русский')` pairs (`lib/lang.ts`).
- **Today's race:** `lib/race.ts` is a copy of the game's `dailyRace()` and must stay in step with `public/game/sim.js`. Today's fastest
  comes from `https://iyt.rycrentals.com/api/game` (the `iyt-test` repo).
- **Styles:** `styles/bundle.css` is the RYC design system, `styles/ryc.css` holds the game's pages and `styles/app.css` the app's own
  additions. Layouts follow the screen through container queries: phone sideways, phone upright, desktop.
- **The yacht:** `public/game/yacht.glb` is made by `blender/yacht.py`. Run it in Blender; it writes the file in place.

## Run it locally

```bash
npm install
```

```bash
npm run dev
```

The app runs at http://localhost:5193 (the game is at http://localhost:5193/play?race=today). `npm run typecheck` and `npm run build`
check it.

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
