# Regatta

Up and down is a 3D sailing game at https://regatta.rycrentals.com. You race round the marks against computer boats, under the
racing rules. It is a Next.js app (App Router) around a static Three.js game, deployed by the Vercel project
`ryc-regatta` on every push to `main`.

## The pages

| Address | What it is | Where |
| --- | --- | --- |
| `/` | Home: the game described in detail | `app/[lang]/page.tsx` |
| `/race` | The race hub: today's race, today's fastest and a free race, in the pause-menu card over today's venue in the game's own scene (`components/game-scene.tsx`) | `app/[lang]/race/page.tsx` |
| `/race/free` | Set up a free race (venue, wind, fleet, course shape — up and down, triangle, trapezoid or up and down with an upwind finish — length, laps, start, current), in the pause-menu card over the game's own scene at the chosen venue (`/boat-view?venue=&wind=`), which fades to each new place | `components/free-setup.tsx` |
| `/race/result/[id]` | The result and debrief after a race, in the pause-menu card over the finish as it was: the game's own scene at the race's venue (`/boat-view?finish=1`), the line, the marks and every boat where she was as you crossed it | `components/result-view.tsx`, `lib/finish.ts` |
| `/boat` | Your boat: colours, logo, sail number and team, in the race's pause-menu card over the game's own scene: your yacht on Lake Garda on a summer evening (`/boat-view`) | `components/boat-editor.tsx` |
| `/settings` | Account, sailing, screen and sound, language | `components/settings-form.tsx` |
| `/admin` | For the site's admins: the ad on every boat's jib, uploaded or removed (not linked from anywhere, not indexed) | `components/admin-form.tsx` |
| `/help` | How to play, with screenshots | `app/[lang]/help/page.tsx` |
| `/faq` | Questions: 32 in five groups | `lib/faq.ts`, `components/faq-list.tsx` |
| `/iyt` | The IYT sailing certification test, as rycrentals.com/iyt has it | `app/[lang]/iyt/page.tsx` |
| `/sign-in`, `/sign-in/code`, `/sign-in/name` | Supabase sign-in: Google or a 6-digit email code, then a name for the ranking | `components/sign-in-forms.tsx` |
| `/play?race=today` or `?race=free` | The game itself, a static page | `public/play/index.html`, `public/game/` |

- **The game:** it lives in `public/`, and `next.config.ts` rewrites `/play` to `/play/index.html`.
  - The game and the pages share this origin, so they share localStorage:
    - `regatta` holds the options the free-race set-up and Settings write.
    - `regatta-pb` holds personal bests. For a signed-in player `components/bests-sync.tsx` merges it, on every page, with
      the copy in their account (`user_metadata.pb`), so their bests follow them to any device.
    - `regatta-result-<id>` holds each finished race. The game keeps the last 20, then opens `/race/result/<id>`. With it go
      the venue, where the course lay there, and each boat's position, heading and sails the moment you finished, for the
      result page's scene; an older result has only the tracks, and `lib/finish.ts` puts each boat where hers had her then.
  - The game also posts each finished race to the scores server (below), so a result link opens on any device; there
    it reads as "this boat", not "you", and the page has a Share button for your own races.
- **The ad on the jib:** every boat in the game (yours, the computer boats, the previews) carries one sponsor's logo
  low on the jib, at most 2 × 1 m, set on `/admin`. The picture is in the public Supabase Storage bucket `regatta-ads`,
  its address in `public.regatta_settings` (key `jib_ad`); `/sponsor` hands it to the game (`jibAd()` in
  `public/game/yacht.js`), cached a minute. Admins are the emails in `public.regatta_admins`, which only the database's
  owner edits (in the Supabase dashboard's SQL editor: `insert into public.regatta_admins values ('name@example.com')`,
  lower case); row-level security lets only them write the setting and the bucket. These live in the same Supabase
  project as the IYT test's tables, so their names start with `regatta_`.
- **Scores:** `public/game/stats.js` posts every race's start, finish and result to `https://iyt.rycrentals.com/api/game`
  (`api/game.mjs` in the `iyt-test` repo, table `public.game_races`). It names the player by Telegram's launch data inside
  Telegram, or else by the site account's access token, which the game gets from `/auth/token` on this origin. The
  server drops a time faster than the course allows (0.45 s a metre of beat a lap); `npm test` checks that the
  computer boats stay well above that floor.
- **Three.js** 0.160.0 is served from `public/vendor/` (the build and the three addons the game uses), not a CDN. To
  upgrade, copy the same files from the new `three` package into a folder named for its version and change the import
  maps in `public/play`, `public/hero-view` and `public/boat-view`.
- **Languages:** English and Russian.
  - The address's `?lang=ru` decides (the address search engines index each language by, `lib/seo.ts`), else the `lang`
    cookie (set by `?lang=` and by `/lang?to=ru&back=/somewhere`), else the browser's Accept-Language.
  - Every page lives under `app/[lang]/`, a segment no address shows: `proxy.ts` picks the language and rewrites `/help`
    to `/ru/help`. So the content pages (Home, `/help`, `/faq`, `/learn`, `/iyt`) are built once per language and served
    from the CDN; Home is rebuilt every five minutes for today's fastest. `/ru/help` typed in redirects to `/help?lang=ru`.
  - Those pages don't know who is signed in: the avatar, the footer's account link and "Sign in to get on it" are drawn
    from the session cookie in the browser (`lib/me.ts`, then CSS `.if-me` / `.if-guest`).
  - The game reads the same cookie.
  - The copy is inline as `t('English', 'Русский')` pairs (`lib/lang.ts`).
- **Today's race:** `lib/race.ts` is a copy of the game's `dailyRace()` and must stay in step with `public/game/sim.js`;
  `npm test` compares the two over 546 days. From `SHAPES_FROM` today's race picks one of the four shapes each day. Its day is the UTC date, so it changes at 03:00 in Moscow and Türkiye.
  Today's fastest comes from `https://iyt.rycrentals.com/api/game` (the `iyt-test` repo).
- **Styles:** `styles/tokens.css` is the RYC design system's tokens and `styles/ryc.css` holds the pages. Layouts follow
  the screen through container queries: phone sideways, phone upright, desktop.
- **The yacht:** `public/game/yacht.glb` is made by `blender/yacht.py`. Run it in Blender; it writes the file in place.
- **The venues:** today's race goes to a venue a day (`dailyVenue()` in `public/game/venues.js`, copied in
  `lib/race.ts` and in `public/play/index.html`'s preloader, which `npm test` checks): the days go round all of them
  in a shuffled order, so each comes once every 22 days and none two days running. A new venue goes in all three
  lists in the same place; it reshuffles the rotation, so add it close to midnight UTC, or today's venue changes mid-day. The home page's live view (`/hero-view`) stays in Göcek, to match its
  photos. A free race goes to the venue the set-up chose (`venue`
  in the `regatta` options; `?venue=<id>` in the game's address overrides it): Göcek, Cowes, Newport, Sydney, Kiel,
  Trieste, Porto Cervo, Saint-Tropez, Antigua, Auckland, San Francisco, Valencia, Barcelona, Palma, Marstrand, Bermuda,
  Enoshima, Weymouth, Marseille, Rio de Janeiro, Lake Garda or Istanbul. `public/game/venues.js` holds each one's position,
  prevailing wind, clock and look (its woods, farmland, houses, moored boats and water); `lib/venues.ts` is the set-up
  page's list of them, and `npm test` keeps the two in step. Each venue's land, Göcek's too, is baked by
  `python3 blender/venues.py [work dir] [id ...]` (needs numpy and Pillow; `--fetch` only downloads; the downloads are
  kept in the work dir, `~/.cache/ryc-regatta/venues` when none is given, where a second run finds them) into
  `public/game/venues/<id>.json` and `.bin` (Göcek's into `public/game/skopea.json`
  and `.bin`), from the Terrarium elevation tiles and OpenStreetMap: centred on the race area and turned so the venue's
  prevailing wind comes from the game's north, where every race's wind is; the sun turns with it, and stands where it
  does at that latitude in the sailing season. Göcek's keeps its older frame, from the town and not turned.
  What the .bin holds, `land.js` unpacks (the terrain's mesh too, so `npm test` checks every venue's) and `skopea.js`
  draws:
  - the terrain as a quadtree, some 8 m cells on the coast and round the race area, coarser where the hills are far or
    smooth, from elevation tiles some 10 m a pixel (Cowes, Weymouth, Newport, San Francisco and Auckland, where they
    carry survey data) or 20 m; the shore meets the water on OpenStreetMap's coastline to the metre, the map's water
    ashore down at the sea's level (an estuary, a lagoon) is water too, and the bed under the water is as steep as the
    land above it (deep under a cliff, gently shelving off a beach); further out, the sea floor's survey where there is
    one (EMODnet's round the European venues, Göcek and Istanbul; NOAA's at Newport and San Francisco), else the
    tiles' own depths where deeper;
  - what is on the ground, on a 20 m grid: OpenStreetMap's woods (needle-leaved or broad-leaved, for the trees in
    them), scrub, grass, fields (each its own crop), orchards, towns, industry, beaches, bare rock, wetland, lakes and
    tidal mud, and a town wherever buildings stand close; the ground's colour is worked out for each pixel from it, and
    where the map has nothing, from the venue's look, its woods in the same stands the trees are scattered in;
  - the roads round the race area, how far out from the shore each point is (the surf: none by quays and piers, and
    less the less open water there is upwind, where the waves come from), how
    much of the sky each point sees (the shade in valleys), and the water's depth (the sea is lighter over the
    shallows);
  - the land beyond, out to 64 km on a 400 m grid, drawn pulled in to just inside the view and lowered by the earth's
    curve, coloured as the venue's own land mostly is: the Alps round Garda, Fuji from Enoshima;
  - the buildings, up to 8,000, the far ones only if tall (pitched roofs where the map or the venue's look has them,
    on near-convex footprints too; windows spaced each building its own way, glass towers, and the churches and
    mosques with their bell towers, domes and minarets), and the piers and pontoons.
  The shadows on the land, of the hills, the far mountains, the buildings and the trees, are worked out on the GPU
  from where the sun is (`shadows()` in `skopea.js`), and fall on the water, the yachts and the marks too. The terrain
  and the towns are drawn in tiles, so what is out of view isn't; the trees far off as plain crowns. Cliffs are
  coloured from the side, in strata; lakes mirror the sky; each venue's air is as clear as its look's `haze` says.
  The json lists the marinas' pontoons, the towns where the houses the map lacks are filled in, and the landmarks
  `skopea.js` draws: the Harbour Bridge, the Newport Bridge, the Golden Gate, the Sky Tower, Laboe's memorial, the
  Sagrada Família, Palma's cathedral, Carlsten fortress, Notre-Dame de la Garde, Christ the Redeemer, Enoshima's Sea
  Candle, the lighthouses of Kiel and Trieste, and Istanbul's Bosphorus Bridge, Galata Tower, Blue Mosque, Hagia
  Sophia and Süleymaniye. `land.js` lays each course in clear water; `npm test` sails every
  course shape at every venue and checks its marks are in clear water; a shape a venue has no room for at a length
  goes in its `skip`, and the set-up offers only the shapes `shapeOffered()` (`lib/venues.ts`) allows there. Moving between today's race and a free race in the
  game reloads the page when the venue changes. OpenStreetMap has few of Göcek's buildings, so its town also comes
  from Microsoft's Global ML Building Footprints (ODbL), which `venues.py` downloads with the rest.
- **The skipper's voice:** in the Russian game, a recorded skipper from Odessa shouts at the crew when something goes
  wrong (a sheet left out or in too hard, a broach, a foul, a collision, aground, stopped after the gun, now and then a
  tack) and through the start (the signals, a boat too close, the line far off, over early, a quick or a late start).
  In the English game the voice is a crew's racing calls instead, a man's and a woman's: the hails (Starboard!, Keep
  clear!, Room at the mark!, Room to tack!), Protest!, Tacking!, Jibe!, Heads!, Trim!, Ease!, Bear away!, Head up!,
  Overlap! or Clear ahead/astern! at a mark's zone, Go, go, go!, and the count from ten to the gun in place of the
  beeps, in one voice per race.
  Each language's lines (ElevenLabs recordings) are one after another in `public/game/skipper-<lang>.mp3`, mono 32 kbps,
  with silence between them; `VOICES` in `main.js` says where each one starts and how long it is, and which lines go
  with which situation. The voice has its own switch, apart from Sound (`voice` in the `regatta` options: Voice in the
  pause menu, Voice on board in Settings); off, the hails and the call for a tack or a gybe are still heard, recorded,
  and the count beeps.
- **The calls, the race committee and the umpire:** what the browser's speech used to say is recorded now, with
  [Piper](https://github.com/OHF-Voice/piper1-gpl), a local neural text-to-speech: in Russian the hails by rule and the
  call for a tack or a gybe, a man's and a woman's; in English the one hail `skipper-en.mp3` lacks. The race committee
  speaks over the VHF (every signal, a clean start or an individual recall, a general recall, back from over early,
  out under the U or black flag, the forecast, the finish), and the umpire whistles and calls a penalty, a mark touched,
  no penalty or a penalty to the other boat through a loudhailer. They're in `public/game/calls-<lang>.mp3`, laid out
  like the skipper's (`CALLS` in `main.js`); the committee and the umpire are under Sound, not the Voice switch.
  `scripts/voices.py` makes the files: the lines, the voices, and the shaping (shouted, VHF radio, loudhailer); with
  `--takes N` it reads each line N times and keeps the reading faster-whisper hears back closest to the text.
- **The other boats, heard close to:** within about 70 m (`crews` in `main.js`), another boat's tack or gybe is heard
  (her sails flogging, her winch), her crew's calls in the game's language (the same voices, under the Voice switch, one
  boat at a time, never over your own crew), and the nearest one's bow wave within 40 m. Each sound comes from her side
  of the screen, quieter and duller with distance; a hail comes from the boat that hails.

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
