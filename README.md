# Regatta

Up and down is a 3D sailing game at https://www.sailupdown.com. You race round the marks against computer boats, under the
racing rules. It is a Next.js app (App Router) around a static Three.js game, deployed by the Vercel project
`ryc-regatta` on every push to `main`.

## The pages

| Address | What it is | Where |
| --- | --- | --- |
| `/` | Home: the game described in detail | `app/[lang]/page.tsx` |
| `/race` | The race hub: today's race, today's fastest and a free race, in the pause-menu card over today's venue in the game's own scene (`components/game-scene.tsx`) | `app/[lang]/race/page.tsx` |
| `/race/free` | Set up a free race (venue, wind, fleet, course shape — up and down, triangle, trapezoid or up and down with an upwind finish — length, laps, start, current), in the pause-menu card over the game's own scene at the chosen venue (`/boat-view?venue=&wind=`), which fades to each new place | `components/free-setup.tsx` |
| `/match/new` | Set up a 1-on-1 race against a friend (the free race's set-up without the number of boats, opening with today's settings); it makes the race's code and opens the game's waiting room | `app/[lang]/match/new/page.tsx`, `components/free-setup.tsx` |
| `/match/<code>?v=&b=` | The 1-on-1 race's link, sent to the friend: Join opens the game at the race, in the host's venue and yacht (never indexed) | `app/[lang]/match/[code]/page.tsx` |
| `/race/result/[id]` | The result and debrief after a race, in the pause-menu card over the finish as it was: the game's own scene at the race's venue (`/boat-view?finish=1`), the line, the marks and every boat where she was as you crossed it | `components/result-view.tsx`, `lib/finish.ts` |
| `/boat` | Your boat: colours (a gennaker in up to three), bottom paint, deck (non-skid, teak or the hull's colour), her name on the quarters, flag, sail number and team, in the race's pause-menu card over the game's own scene: your yacht on Lake Garda on a summer evening (`/boat-view`) | `components/boat-editor.tsx` |
| `/players` | The players: everyone who races signed in, the most points first (the rating's, every day of today's race added up), 20 a page, in the card over the game's own scene (`/boat-view`, a JPK 1050 on Lake Garda); a player (`?p=<k>`, the rating's key) turns the card to their points, races, wins, podiums, today's race, yachts and venues, and dresses the yacht in their colours as their account keeps them. From the scores API's `?players` and `?player=` (`lib/players.ts`) | `components/players-view.tsx` |
| `/settings` | Account, sailing, screen and sound, language | `components/settings-form.tsx` |
| `/admin` | For the site's admins: the ad on every boat's jib, uploaded or removed (not linked from anywhere, not indexed) | `components/admin-form.tsx` |
| `/help` | How to play, with screenshots | `app/[lang]/help/page.tsx` |
| `/faq` | Questions: 32 in five groups | `lib/faq.ts`, `components/faq-list.tsx` |
| `/iyt` | The IYT sailing certification test, as rycrentals.com/iyt has it | `app/[lang]/iyt/page.tsx` |
| `/sponsorship` | What a sponsor can have: the jib's logo, the plane's banner, both, a post on the game's channel, a race film, and what would be built to order. No prices; enquiries go by Telegram | `app/[lang]/sponsorship/page.tsx`, `styles/sponsorship.css` |
| `/sign-in`, `/sign-in/code`, `/sign-in/name` | Supabase sign-in: Google or a 6-digit email code, then a name for the ranking | `components/sign-in-forms.tsx` |
| `/play?race=today`, `?race=free` or `?match=<code>` | The game itself, a static page | `public/play/index.html`, `public/game/` |
| Any other address | The site's 404, with its header and a way back, in the reader's language; `proxy.ts` sends a rating day the API can't have (`/race/rating/not-a-day`, a day to come) here too. A document of its own, as the root layout is under `[lang]` (`experimental.globalNotFound`) | `app/global-not-found.tsx`, `components/not-found-view.tsx` |

- **The game:** it lives in `public/`, and `next.config.ts` rewrites `/play` to `/play/index.html`.
  - The game and the pages share this origin, so they share localStorage:
    - `regatta` holds the options the free-race set-up and Settings write.
    - `regatta-pb` holds personal bests. For a signed-in player `components/bests-sync.tsx` merges it, on every page, with
      the copy in their account (`user_metadata.pb`), so their bests follow them to any device.
    - `regatta-result-<id>` holds each finished race. The game keeps the last 20, then opens `/race/result/<id>`. With it go
      the venue, where the course lay there, and each boat's position, heading and sails the moment you finished, for the
      result page's scene; an older result has only the tracks, and `lib/finish.ts` puts each boat where hers had her then.
    - `regatta-log` is the player's log (`lib/log.ts`): the days they finished today's race, at their best time that day,
      and the venues they've raced at, with when they first did. The game keeps a day's best a week and the last 20
      results, so the pages gather both into it on every visit (`components/bests-sync.tsx`, which merges it with the
      account's `user_metadata.log` for a signed-in player). From it: the venues stamped on Home and the hub with the
      streak (days in a row; a day missed doesn't break it, two do), a first race at a venue on its result, and your month
      on the rating page, each day's best placed against that day's ranked times.
    - `regatta-drills` holds the drills' best stars (`/race/drills`, `lib/drills.ts`).
- **The drills and the analytics in the game:** `public/game/extras.js`, which `main.js` calls as a race
  starts and every frame. A drill (`/play?race=free&drill=<id>`, the ids in `DRILL_ORDER`, four skipper levels of them, each sailed against a fleet of its own level, and a level open with two thirds of the stars of the one below) is a free race of its own; a computer skipper sails
  your boat to the moment it's about, hands her over, and it ends with stars; it's never posted as a race. The game
  sends its moments to Vercel Web Analytics (Race start, Race left, Drill done) and the pages theirs
  (`@vercel/analytics` `track`: Race finish, Race again, Challenge taken, Replay, Share).
- **1-on-1 race:** two friends sail one race against each other, live, by a link, under the same rules as today's race
  (no computer boats; the Appendix C match rules are gone). The host sets it up on `/match/new` (the free race's
  choices but the number of boats, opening with today's settings; the code goes in `localStorage` `regatta-match-host`,
  the settings in `regatta-match-settings`) and the game opens at `/play?match=<code>`, where `public/game/match-ui.js`
  runs the waiting room, the race and the results card. `main.js` imports it only for a 1-on-1 race, and it imports the
  rest only then: `net.js` (a raw-WebSocket client of Supabase Realtime broadcast, no Supabase package; the address and
  publishable key come from `GET /connect`, with the signed-in player's name), `match.js` (the waiting room and the
  host's and the guest's sides of a race) and `wire.js` (a boat's controls and the race's snapshot as they travel).
  Nobody sailing today's race or a free race downloads any of it. The addresses, `?match=` and the file names keep
  "match"; the feature's name on the site is **1-on-1 race** / **Гонка один на один**.
  - **The host's game runs the race** (`sim.js`, the only copy that counts) on channel `match:<code>`; the guest's inputs
    come on `match:<code>:in` as they change, and the host sends both boats ten times a second with the race's news, so
    every call is the same on both screens; the guest's game never judges the rules itself. The guest's own boat is
    stepped on her own screen from her hands and eased toward the host's copy of her, so the delay never pulls her helm.
    Both screens must be on the same build (`/connect` gives the deployment's commit; another build is asked to
    reload). The host decides who the guest is and keeps her; a third person with the link sees "This 1-on-1 race is full".
  - **The finish:** the race is over when both boats are home, or 3 minutes after the first valid finish; a boat still
    racing then is DNF. A finished boat can't touch or shadow the other. A guest who leaves before her finish forfeits;
    a host who leaves, or whose tab is gone over 60 s, abandons the race, not scored.
  - **After it:** a card lists the places with the gap (DSQ or DNF for a boat without a place), with Rematch (the host's,
    a new seed), Full result and Done. Each screen saves the race's record as it ends (`oneOnOne`), so Full result opens
    the usual result page (`components/result-view.tsx`) in the same tab, headed "1-on-1 race", with no personal
    best, share link or ranking; its main button goes back to `/match/new`. A valid finish earns the venue's passport
    stamp. Nothing is posted to the scores server (`stats.js` skips it).
  - **Its stats:** the screens report each race's start, the guest's joining and its end to `POST /connect/log`
    (`public/game/duel-log.js`, `app/connect/log/route.ts`), which adds the sailor's account from the session and writes
    through `regatta_duel_log` into `public.regatta_duels`, apart from the rankings. It needs `DUEL_LOG_KEY` in the site's
    environment, whose SHA-256 is the vault secret `regatta_duel_key_hash`. `/admin/duels` shows the totals and every race.
    Run locally nothing is reported unless the address has `?scores`.
  - **Trusted results:** both screens report the end. The host's end, with the write token from its start, is the
    race's result. The guest's end, with a token of her own from her join, is kept beside it. Each end says whether the
    race reached the gun. A race whose two ends name the same state and winner is `agreed`, and a finished, agreed race
    between two accounts is a trusted result, the only kind a rating will count
    (`docs/superpowers/specs/2026-11-21-one-on-one-trusted-results.md`).
  - **The rating:** plain Elo, from 1500, K 64 for the first five rated races and 32 after (`lib/elo.ts`, levels in
    `lib/levels.ts`). The database rates each trusted result once, as it becomes agreed (`regatta_rate_duel`), and at most
    three races a day for a pair. The game's card says the new rating after a race (`GET /connect/rating`), as does the
    result page (`components/duel-rating.tsx`); your own card on `/players` shows yours (`GET /connect/rating/me`)
    (`docs/superpowers/specs/2026-11-21-one-on-one-rating.md`).
  - **The invite and the signed-out friend:** the host's screen reports its link (`kind: 'invite'`), and `/match/<code>` shows
    who is asking, their level and about how long the race takes (`GET /connect/invite`, `components/invite-info.tsx`). A
    friend who raced signed out keeps the race by signing in after it (`components/duel-keep.tsx`, `POST /connect/claim`):
    it joins her history, never the rating (`docs/superpowers/specs/2026-11-21-one-on-one-friend.md`).
  - **Not on the hub yet:** the race hub's 1-on-1 race card shows only with `?match` in its address, until the owner's
    test race with a friend; `/match/new` works for anyone with the address.
- **A passport to share:** `/players?s=&v=&vs=&n=` (`lib/passport-share.ts`; its card `app/og/passport`): the streak and
  the venues raced as the sharer sent them, from Share on Home's venues and on your player card.
  - The game also posts each finished race to the scores server (below), so a result link opens on any device; there
    it reads as "this boat", not "you", and the page has a Share button for your own races.
- **Every page's own share card:** home and the race hub show today's race (`app/og/today`), a result its race
  (`app/og/result`), the passport its streak; the rest draw theirs in `app/og/page/[key]`. All are made in `lib/og.tsx`:
  a picture of the game behind (`lib/og-bg`, cropped from `public/images` by `scripts/og-bg.py`; run it again after the
  pictures are retaken), the logo large at the top left, then only what this is, one big figure or name (a guide's
  title, the day's winning time, a player's name) and the button. Sent as JPEG (through `sharp`), 50–100 KB. A page
  names its card with `card:` in `titled()` / `pageMeta()` (`lib/seo.ts`); account pages keep the site's picture.
- **The ad on the jib:** every boat in the game (yours, the computer boats, the previews) carries one sponsor's logo
  low on the jib, at most 2 × 1 m, set on `/admin`. The picture is in the public Supabase Storage bucket `regatta-ads`,
  its address in `public.regatta_settings` (key `jib_ad`); `/sponsor` hands it to the game (`jibAd()` in
  `public/game/yacht.js`), cached a minute. Admins are the emails in `public.regatta_admins`, which only the database's
  owner edits (in the Supabase dashboard's SQL editor: `insert into public.regatta_admins values ('name@example.com')`,
  lower case); row-level security lets only them write the setting and the bucket. These live in the same Supabase
  project as the IYT test's tables, so their names start with `regatta_`.
- **The plane's banner:** a light plane (`public/game/plane.js`) tows a banner across the course every minute or two,
  side-on to the camera and low enough to sit in the upper part of the picture. Its words are set on `/admin` too
  (key `plane_banner` in `public.regatta_settings`, `{ lines: ['navy words', 'red words'] }`), served by `/sponsor`
  with the jib's logo (`public/game/sponsor.js` asks once a page). Nothing set: RYCRENTALS.COM · RENT YACHTS HERE!
- **Scores:** `public/game/stats.js` posts every race's start, finish and result to `https://iyt.rycrentals.com/api/game`
  (`api/game.mjs` in the `iyt-test` repo, table `public.game_races`). It names the player by Telegram's launch data inside
  Telegram, or else by the site account's access token, which the game gets from `/auth/token` on this origin. Run
  locally (localhost, `*.localhost`) it posts nothing, so test races stay off the rankings (nor does a 1-on-1 race, anywhere); `?scores` in the game's
  address posts them all the same. The server drops a time faster than the course allows (0.45 s a metre of beat a
  lap); `npm test` checks that the computer boats stay well above that floor.
- **Three.js** 0.160.0 is served from `public/vendor/` (the build and the three addons the game uses), not a CDN. To
  upgrade, copy the same files from the new `three` package into a folder named for its version and change the import
  maps in `public/play`, `public/hero-view` and `public/boat-view`.
- **Loading the game:** those three pages list every module they load in `<link rel="modulepreload">` (and the yacht
  in a preload), so the browser asks for them all at once; a module added to the game goes in the lists, and
  `npm test` says so if it doesn't. On Vercel the build (`prebuild`, `scripts/stamp-game.mjs`) adds each module's
  content hash to its address through the import map, `/game/sim.js?v=…`, which `next.config.ts` caches for good; the
  pages in the repo stay unstamped, and the rest of `/game/` revalidates on every visit.
- **The first race is built once:** `main.js` takes the race (`?race=today` or `free`) from the address before it builds
  the first one, so the race under the preloader is the one sailed, and the start keeps it rather than building it
  again (about half a second on a phone). The exception is a race dressed before Carlito bold came in (the sail and
  bow numbers' face, which `/play` asks for from an inline script after its stylesheets): the start dresses it again.
- **Languages:** English, Russian, Spanish, German, Turkish, French, Italian and Portuguese (Brazil's).
  - The address's `?lang=ru`, `?lang=es`, `?lang=de`, `?lang=tr`, `?lang=fr`, `?lang=it` or `?lang=pt` decides (the address search engines index each language by, `lib/seo.ts`), else the `lang`
    cookie (set by `?lang=` and by `/lang?to=ru&back=/somewhere`), else the browser's Accept-Language.
  - Every page lives under `app/[lang]/`, a segment no address shows: `proxy.ts` picks the language and rewrites `/help`
    to `/ru/help`. So the content pages (Home, `/help`, `/faq`, `/learn`, `/iyt`) are built once per language and served
    from the CDN; Home is rebuilt every five minutes for today's fastest. `/ru/help` typed in redirects to `/help?lang=ru`.
  - Those pages don't know who is signed in: the avatar, the footer's account link and "Sign in to get on it" are drawn
    from the session cookie in the browser (`lib/me.ts`, then CSS `.if-me` / `.if-guest`).
  - The game reads the same cookie. Its Spanish, German, Turkish, French, Italian and Portuguese words are `public/game/strings-es.js`, `strings-de.js`,
    `strings-tr.js`, `strings-fr.js`, `strings-it.js` and `strings-pt.js`, each fetched only when the game is in that language; the spoken calls and the skipper's voice are
    recorded in English and Russian only, so the other languages hear the English ones.
  - The copy is inline as `t('English', 'Русский', 'Español', 'Deutsch', 'Türkçe', 'Français', 'Italiano', 'Português')` (`lib/lang.ts`); a line with no
    Spanish, German, Turkish, French, Italian or Portuguese reads in English there, and `test/spanish.test.mjs`, `german.test.mjs`,
    `turkish.test.mjs`, `french.test.mjs`, `italian.test.mjs` and `portuguese.test.mjs` fail until every line has all six. A name kept as `[English, Russian, Spanish, German, Turkish, French, Italian, Portuguese]`
    is read with `pick(name, lang)`. The share cards capitalise Turkish with its dotted İ (`card({ lang })` in `lib/og.tsx`).
- **Today's race:** `lib/race.ts` is a copy of the game's `dailyRace()` and must stay in step with `public/game/sim.js`;
  `npm test` compares the two over 546 days. From `SHAPES_FROM` today's race picks one of the four shapes each day. Its day is the UTC date, so it changes at 03:00 in Moscow and Türkiye.
  Today's fastest comes from `https://iyt.rycrentals.com/api/game` (the `iyt-test` repo).
- **Styles:** `styles/tokens.css` is the RYC design system's tokens and `styles/ryc.css` holds the pages. Layouts follow
  the screen through container queries: phone sideways, phone upright, desktop.
- **The yacht:** `public/game/yacht.glb` is made by `blender/yacht.py`. Run it in Blender; it writes the file in place.
  The Bavaria 46's moulded parts (hull, deck, coachroof, cockpit) are `public/game/bavaria46.glb`, made the same way by
  `blender/bavaria46.py` (`blender -b --factory-startup -P blender/bavaria46.py`); `boats3d.js` builds her from its own
  lines if the file doesn't load. The Laser's hull and deck are `public/game/laser.glb`, from `blender/laser.py`, the
  Optimist's open shell `public/game/optimist.glb`, from `blender/optimist.py`, the Dragon's hull with her keel
  moulded in, her deck, cabin, coaming and cockpit `public/game/dragon.glb`, from `blender/dragon.py`, the J Class's
  hull with her long keel moulded in, her bulwark and cap rail, laid deck, doghouse, glazed skylight and helm's well
  `public/game/jclass.glb`, from
  `blender/jclass.py` (which prints the water she displaces: some 170 t of the 175 she should), the
  J/70's and the RS21's `public/game/j70.glb` and `rs21.glb`, from `blender/sportboats.py`, and the AC75's
  `public/game/ac75.glb`, from `blender/ac75.py`, likewise. The F50's two hulls are lofted in code (`boats3d.js`
  F50View), with no model file yet.
- **The venues:** today's race goes to a venue a day (`dailyVenue()` in `public/game/venues.js`, copied in
  `lib/race.ts` and in `public/play/index.html`'s preloader, which `npm test` checks): the days go round all of them
  in a shuffled order, so each comes once a round and none two days running. A new venue goes in all three lists in
  the same place, with the day it joins (`from`, a day still to come): the days before it keep the venues they had,
  and from it the rounds start again with the new one among them. The home page's live view (`/hero-view`) stays in Göcek, to match its
  photos. A free race goes to the venue the set-up chose (`venue`
  in the `regatta` options; `?venue=<id>` in the game's address overrides it): Göcek, Cowes, Newport, Sydney, Kiel,
  Trieste, Porto Cervo, Saint-Tropez, Antigua, Auckland, San Francisco, Valencia, Barcelona, Palma, Marstrand, Bermuda,
  Enoshima, Weymouth, Marseille, Rio de Janeiro, Lake Garda, Istanbul, St Petersburg (the Neva under the
  Peter and Paul Fortress, its bridges raised), Batumi, Scheveningen, Hong Kong, Cape Town, Athens, Marmaris, Fethiye, Sochi, Melbourne, Gold Coast, New York, Naples, Los Angeles, Les Sables-d'Olonne, Dubai, Miami, Split, Monaco, Fremantle, Sint Maarten, Phuket, the Tbilisi Sea, Malta, Saint-Malo, Hobart, Lake Geneva, San Diego, Cork, Cascais, Chicago, St Barths, Qingdao, Aarhus, Helsinki, Gdynia, Kingston, Tivat, Lake Balaton, Singapore, Muscat, Buenos Aires, Busan or the Minsk Sea (thirty-three of them join
  today's races together on 20 November 2026, and the last eleven on 21 November). `public/game/venues.js` holds each one's position,
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
    carry survey data) or 20 m (Helsinki's, measured from the ellipsoid and not the sea, brought down the 17 m
    they stand too high: `datum`); the shore meets the water on OpenStreetMap's coastline to the metre, the map's water
    ashore down at the sea's level (an estuary, a lagoon) is water too, and the bed under the water is as steep as the
    land above it (deep under a cliff, gently shelving off a beach); further out, the sea floor's survey where there is
    one (EMODnet's round the European venues, Göcek, Istanbul, Batumi, Marmaris, Fethiye and Sochi; NOAA's at Newport, San Francisco and New York), else the
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
  - the buildings, up to 8,000 (a big city's more), the far ones only if tall (pitched roofs where the map or the
    venue's look has them, on near-convex footprints too; windows spaced each building its own way, glass towers, and
    the churches and mosques with their bell towers, domes and minarets), and the piers and pontoons.
  The shadows on the land, of the hills, the far mountains, the buildings and the trees, are worked out on the GPU
  from where the sun is (`shadows()` in `skopea.js`), and fall on the water, the yachts and the marks too. The terrain
  and the towns are drawn in tiles, so what is out of view isn't; the trees far off as plain crowns. Cliffs are
  coloured from the side, in strata; lakes mirror the sky; each venue's air is as clear as its look's `haze` says.
  The json lists the marinas' pontoons, the towns where the houses the map lacks are filled in, and the landmarks
  `skopea.js` draws: the Harbour Bridge, the Newport Bridge, the Golden Gate, the Sky Tower, Laboe's memorial, the
  Sagrada Família, Palma's cathedral, Carlsten fortress, Notre-Dame de la Garde, Christ the Redeemer, Enoshima's Sea
  Candle, the lighthouses of Kiel, Trieste, Batumi, Scheveningen and Green Point, Istanbul's Bosphorus Bridge, Galata
  Tower, Blue Mosque, Hagia Sophia and Süleymaniye, St Petersburg's spires, columns and bridges, Batumi's Alphabetic
  Tower, the big wheels on Batumi's shore, Scheveningen's pier, Hong Kong's Central and Cape Town's V&A Waterfront, the Bank of China Tower, the Parthenon, Marmaris castle on the map's outline of it, the Knights' castle in Fethiye on walls traced from the air (`ring`), Fethiye's Lycian rock tombs, Telmessos's theatre and the sarcophagi in its streets, Atatürk's statues on both seafronts, the great Turkish flags over both castles, the yachts ashore on their cradles in Marmaris's Adaköy yard, Sochi's sea terminal and its spire, the Statue of Liberty on Fort Wood's star, the Verrazzano-Narrows Bridge, the Brooklyn Bridge's granite towers, One World Trade Center and the Gold Coast's Q1 (a
  landmark with `clear` leaves out the map's own building in its place). `land.js` lays each course in clear water (its marks, its line, the water below it where the
  fleet waits, the beat out towards the laylines, and every leg from end to end, all on the baked map of the sea
  room), and not across a bridge too low for a mast (St Petersburg's drawbridges). An AC75's course, 2.5 times as
  long, that has no room as asked is laid up and down, then shorter, then smaller, its fleet starting nearer the line
  where the water below it runs out (`sim.js` Race); and the computer skippers keep off the shore, tacking or gybing
  away from land a few seconds' sailing ahead. `npm test` sails every course shape at every venue, in the JPK 1050, the
  Bavaria 46, the Laser, the Optimist, the AC75, the J Class and the F50, and checks its marks and legs are in clear water and on one side of every such bridge; a shape a venue has no room for at a length goes in its `skip`, as does
  a length it has no room for at all (St Petersburg's long course: a long request is sailed at the longest it has), and
  the set-up offers only the shapes and lengths `shapeOffered()` and `lengthOffered()` (`lib/venues.ts`) allow there. Moving between today's race and a free race in the
  game reloads the page when the venue changes. OpenStreetMap has few of Göcek's, Fethiye's and Marmaris's buildings, so their towns also come
  from Microsoft's Global ML Building Footprints (ODbL), which `venues.py` downloads with the rest. Hong Kong's
  ground is its own 5 m terrain model (`dtm`), not the tiles, whose radar has the towers' roofs for the city's ground:
  the Digital Terrain Model of the Lands Department, Hong Kong SAR Government, from DATA.GOV.HK (free to use with
  this attribution), which `venues.py` downloads (29 MB) and cuts to the venue. Batumi's, Cape Town's, Marmaris's, Fethiye's, Sochi's, Melbourne's and the Gold Coast's shores have
  more of the map in them (New York's its paving): its paved promenades and squares drawn as paving (`paved`), its palm avenues and other rows of trees planted
  tree by tree where they stand (`trees`, the .bin's `tk` and `txz`; Marmaris's and Fethiye's seafront palms, which the map
  lacks, planted every 8 m along the streets `palms` names where they run by the water), and their plains, whose tiles carry the roofs and
  trees some 4 to 8 m up, laid down on the shore's floor below the hills (`plain`, in Batumi, Cape Town, Melbourne and the Gold Coast; in Cape Town that lets the V&A's
  basins and Milnerton's lagoon down to the sea's level as water). Marmaris and Fethiye have their gulets moored
  stern-to along the town quays (`gulets`: the shore by the streets it names, the json's `moor`), and boats that come
  and go, moved by `skopea.js` on the race's clock, all picture: the fast ferries to Rhodes and the water taxis on their
  `routes` (each found on the water by the bake, the cheapest way on the sea room's grid that keeps off the shore and
  skirts the race area), New York's orange Staten Island ferries (`si`), and the kitesurfers off Fethiye's Çalış beach and
  St Kilda's (`kites`). Melbourne's, the Gold Coast's, New York's and Sochi's towers stand on the map's 3D parts too (`parts`:
  where a tower is mapped as `building:part`s, its outline carrying only the podium's height), and New York's piers, which the
  map's coastline makes land and the tiles give their sheds' roofs, are kept low (`quays`). Los Angeles's and Fremantle's container yards are paved (`aprons`), their cranes and stacked boxes drawn along the quays (`cranes`), and at Sint Maarten an airliner comes in low over Maho Beach to the runway every few minutes (`runway`).
- **The sounds of the boat and the sea:** made as they go, not recorded (`public/game/sfx.js`), each from what makes
  the real one: the wind a roar of brown noise and a hiss of pink in stereo, its gusts swelling on a slow random walk,
  from where the apparent wind comes, and from about 13 knots the rigging's moan; the water a rush that brightens with
  speed over a bed of bubbles, each a ringing upward chirp (Minnaert's); a sail flogging in cracks, a thump and a snap
  each time it fills the other way, with the leech's flutter between; the hull slamming onto a sea, a thud, a boom and
  the splash; the winch's pawl a struck bit of steel ringing; the sheet's rasp as it's eased; the start timer's piezo
  beep. The committee boat's horn is an air horn's reed, sliding up to pitch and sagging as it stops, heard from where
  she lies: late by the distance, duller and quieter the further off. Anything heard across the water (the horn, the
  other crews, the umpire, the gulls, the plane) has the land's echo under it; another crew's voice is late by the
  distance too, and carried to you or blown away by the wind between. Our own crew and the VHF are heard on deck.
- **The skipper's voice:** a crew's racing calls. In the Russian game a man's, recorded: the hails (Правый галс!,
  Левый галс!, Дорогу!, Подветренный!, Не мешай!, Увались на надлежащий курс!, Место у знака!), Протест!, Поворот
  оверштаг!, Поворот фордевинд!, Набивай!, Потрави!, Увались!, Приводись!, Чисто! at a mark's zone and Финиш! at the
  line; the hails he has no recording for, and the woman's, are in `calls-ru.mp3`. The other boats' crews speak in the
  same voice, each at a pitch of her own. In the English game a man's and a woman's: the hails (Starboard!, Keep
  clear!, Room at the mark!, Room to tack!), Protest!, Tacking!, Jibe!, Heads!, Trim!, Ease!, Bear away!, Head up!,
  Overlap! or Clear ahead/astern! at a mark's zone, Go, go, go!, and the count from ten to the gun in place of the
  beeps, in one voice per race.
  Each language's lines (recordings) are one after another in `public/game/skipper-<lang>.mp3`, mono 32 kbps,
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
- **The gulls:** real herring gulls, recorded on the shore and cut into calls (a mew, a call, a pair, the long call,
  the alarm as one is put up off the water) one after another in `public/game/gulls.mp3`; `GULLS` in `main.js` says
  where each starts. `scripts/gulls.py` makes the file from the recordings on Wikimedia Commons: "Gull 1" and "Gull 2"
  by avphillips (public domain) and xeno-canto XC707075 by Sonothèque ADVL (CC0).
- **The music:** `public/game/music.js` follows the race (calm before the start, building to the gun, up when it goes
  well, dark when it doesn't) with the track Settings › Music picks: Racing, Groove, Riff or Open water. Each is a
  recorded track, `public/game/music-<id>.mp3`, cut on its bar lines by `scripts/music.py` into loops for the moods,
  the build that lands its drop on the gun, its ending for a win, and accents of its own crash. `TRACKS` in
  `music.js` says where each piece and each of its bars starts.

## Run it locally

```bash
npm install
```

```bash
npm run dev
```

The app runs at http://localhost:5193 (the game is at http://localhost:5193/play?race=today). `npm run typecheck` and `npm run build`
check it; `npm test` sails the game's race headless in Node (about 10 seconds).

Every picture of the game on the site (`public/images/*-v9.jpg`: the race screen `hud-*` and its close-ups `h-start`,
`h-steer`, `h-trim`, `h-tack`; the home's hero `drone-*`, the fleet from above `top`, the three views `h-view-*`, the
wind ring `h-wind`, the run under the gennaker `h-run`, the share card `og` and the sponsorship page's `sp-*-v2`) is the game's own, taken in headless Chrome with the site running: `node
scripts/shots.mjs http://localhost:5193` (or a few by name after the address). It prints where each part of the HUD sits
on the two numbered pictures, for the marks in `app/[lang]/help/page.tsx`. A picture changed is a new file name (`-v10`),
as the image optimiser caches by name (the Learn to race guides' wide banners, `gd-*`, come from `node scripts/guide-shots.mjs`); the race page's loader names the hero's files too (`public/play/index.html`).

## Domains

The site is `https://www.sailupdown.com` (lib/seo.ts `SITE`: canonical links, the sitemap, IndexNow). Every other address
of the Vercel project redirects there with a 308, path and query kept: `sailupdown.com`, `sailupanddown.com`,
`www.sailupanddown.com`, `upandown.rycrentals.com`, `regatta.rycrentals.com` and `ud.rycrentals.com` (Settings → Domains;
`ryc-regatta.vercel.app` stays as is). The browser keeps localStorage and the sign-in cookies per address, so a guest's
bests on an old address stay there; a signed-in player's come back with the account (components/bests-sync.tsx).

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
  - `https://www.sailupdown.com/**`
  - `https://upandown.rycrentals.com/**` and `https://regatta.rycrentals.com/**` (old addresses, now redirects to the site)
  - **Site URL:** `https://www.sailupdown.com`. Supabase sends a sign-in here when its return address isn't on the list
    above, and email templates read it as `{{ .SiteURL }}`. The project is shared with the iyt app, so this affects it too.
- **Email code:** the "Magic link" email template must include `{{ .Token }}`, so the email carries the 6-digit code. The link in the
  default template also works: it goes through `/auth/callback`.

The display name is kept in the user's `user_metadata.display_name`.

**Telegram:** the IYT mini app opens the site with Telegram's launch data in the hash. `components/telegram-sign-in.tsx` posts it to
`/auth/telegram`, which asks `https://iyt.rycrentals.com/api/regatta-session` (the `iyt-test` repo, which holds the bot token and the
Supabase secret key) for a one-time token and turns it into the session. The player's account is
`tg-<telegram id>@telegram.rycrentals.com` with `app_metadata.telegram_id`; that address is never mailed or shown. `IYT_API_URL`
points the route at another iyt server when testing.
