# Regatta

Up and down is a 3D sailing game at https://upandown.rycrentals.com. You race round the marks against computer boats, under the
racing rules. It is a Next.js app (App Router) around a static Three.js game, deployed by the Vercel project
`ryc-regatta` on every push to `main`.

## The pages

| Address | What it is | Where |
| --- | --- | --- |
| `/` | Home: the game described in detail | `app/[lang]/page.tsx` |
| `/race` | The race hub: today's race, today's fastest and a free race, in the pause-menu card over today's venue in the game's own scene (`components/game-scene.tsx`) | `app/[lang]/race/page.tsx` |
| `/race/free` | Set up a free race (venue, wind, fleet, course shape — up and down, triangle, trapezoid or up and down with an upwind finish — length, laps, start, current), in the pause-menu card over the game's own scene at the chosen venue (`/boat-view?venue=&wind=`), which fades to each new place | `components/free-setup.tsx` |
| `/match/new` | Set up a match race against a friend (venue, wind, yacht, length: the free race's set-up cut to a match's choices); it makes the match's code and opens the game's waiting room | `app/[lang]/match/new/page.tsx`, `components/free-setup.tsx` |
| `/match/<code>?v=&b=` | The match's link, sent to the friend: Join opens the game at the match, in the host's venue and yacht (never indexed) | `app/[lang]/match/[code]/page.tsx` |
| `/race/result/[id]` | The result and debrief after a race, in the pause-menu card over the finish as it was: the game's own scene at the race's venue (`/boat-view?finish=1`), the line, the marks and every boat where she was as you crossed it | `components/result-view.tsx`, `lib/finish.ts` |
| `/boat` | Your boat: colours (a gennaker in up to three), bottom paint, deck (non-skid, teak or the hull's colour), her name on the quarters, logo, sail number and team, in the race's pause-menu card over the game's own scene: your yacht on Lake Garda on a summer evening (`/boat-view`) | `components/boat-editor.tsx` |
| `/settings` | Account, sailing, screen and sound, language | `components/settings-form.tsx` |
| `/admin` | For the site's admins: the ad on every boat's jib, uploaded or removed (not linked from anywhere, not indexed) | `components/admin-form.tsx` |
| `/help` | How to play, with screenshots | `app/[lang]/help/page.tsx` |
| `/faq` | Questions: 32 in five groups | `lib/faq.ts`, `components/faq-list.tsx` |
| `/iyt` | The IYT sailing certification test, as rycrentals.com/iyt has it | `app/[lang]/iyt/page.tsx` |
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
      on the rating page, each day's best placed against that day's ranked times. It keeps the badges too
      (`lib/badges.ts`, `/race/badges`), at the race that first earned each: a race's own from every result the device
      has (a clean race, a start on the gun, tacking on headers…), the log's from the streak, the venues and the drills.
      Each is drawn as a pennant in its family's colour (`components/badge-pennant.tsx`: gold a result, blue a skill,
      green the season), on the badges page, a result's banner, the hub's rows, a shared passport and its card.
    - `regatta-drills` holds the drills' best stars (`/race/drills`, `lib/drills.ts`).
- **The ghost, the drills and the analytics in the game:** `public/game/extras.js`, which `main.js` calls as a race
  starts and every frame. The ghost is a see-through boat out of the race, sailing a finished race's track
  (`public/game/track.js`, in step with `lib/finish.ts`, which `npm test` checks): your best today on this device (off in
  Settings), or the race of a result link (`/play?race=today&ghost=<id>`, a shared result's button), with the gap to her
  on the board. A drill (`/play?race=free&drill=<id>`, the ids in `DRILL_ORDER`, four skipper levels of them, each sailed against a fleet of its own level, and a level open with two thirds of the stars of the one below) is a free race of its own; a computer skipper sails
  your boat to the moment it's about, hands her over, and it ends with stars; it's never posted as a race. The game
  sends its moments to Vercel Web Analytics (Race start, Race left, Ghost, Drill done) and the pages theirs
  (`@vercel/analytics` `track`: Race finish, Race again, Challenge taken, Replay, Share).
- **Match race:** two friends sail a best-of-three against each other, live, by a link, under the match-racing rules
  (Appendix C of the RRS). The host sets it up on `/match/new` (the code goes in `localStorage` `regatta-match-host`,
  the settings in `regatta-match-settings`) and the game opens at `/play?match=<code>`, where `public/game/match-ui.js`
  runs the waiting room, the races, the cards between them and the match card. `main.js` imports it only for a match,
  and it imports the rest only then: `net.js` (a raw-WebSocket client of Supabase Realtime broadcast, no Supabase
  package; the address and publishable key come from `GET /connect`, with the signed-in player's name), `match.js` (the
  waiting room, the score, the host's and the guest's sides of a race) and `wire.js` (a boat's controls and the race's
  snapshot as they travel). Nobody sailing today's race or a free race downloads any of it.
  - **The host's game runs the race** (`sim.js` with `match: true`, the only copy that counts) on channel
    `match:<code>`; the guest's inputs come on `match:<code>:in` as they change (2–5 a second, at once for a tack, a
    gybe or a big helm change, never more than ten), and the host sends both boats ten times a second with the race's
    news (each umpire call, signal, rounding and finish, named for its boat), so every call is the same on both screens;
    the guest's game never judges the rules itself. The guest's own boat is stepped on her own screen from her hands;
    each snapshot's copy of her is compared with where she was herself at the same moment (her own last two seconds,
    matched to when her input reached the host, on a clock smoothed against the network's jitter) and the difference
    eased away, so the delay never pulls her helm; a contact, a penalty or a jump over 20 m takes the host's copy as it
    is. The host's boat is drawn where it is now, carried on from the last snapshot by half the measured round trip.
    Both screens must be on the same build (`/connect` gives the deployment's commit; another build is asked to
    reload). The host decides who the guest is and keeps her; a third person with the link sees "This match is full".
    The host also sends the match
    (`mstate`: the score, the races, who is ready, and the race's umpire calls with their reasons), every second between
    races and every two in one; the guest's screen copies it, so a reloaded guest finds her place.
  - **The rules it judges:** blue (the committee boat end, the host in race 1, swapping each race) and yellow (the pin);
    the entry, across the line at her own end from the course side between 4:00 and 2:00 (both start 40 m beyond their
    ends, luffing, so a boat left alone stays afloat and owes one for not entering); an umpire that calls a
    failure to keep clear without contact as well as a contact (rule 16.1 when the right-of-way boat's own turn did it);
    the two-length zone; penalties owed and taken when the boat chooses (a gybe and back to close-hauled on a beat, a
    tack and back to a run), one at once with two owed, none to finish with; two laps up and down, the five-minute
    sequence; first to two wins. The HUD shows your side, the score, each boat's penalties owed (blinking while one is
    being taken) and, until 2:00, where to enter. With `&debug=umpire` in the address a small overlay lists each of the
    umpire's calls with its reasons (the projected gap, how far ahead, whether the right-of-way boat had turned), on both
    screens.
  - **When someone drops:** a guest unheard 3 s holds her course, and after 30 s the race is the host's; a host unheard
    3 s freezes the guest's screen ("Waiting for …"), and after 60 s the host's game abandons the race, not scored (the
    guest's screen waits for its word). In a match the link's heartbeat is every 5 s, so a dead socket is noticed within
    about 10 s, and it reconnects at once when the phone comes back online, the tab becomes visible or the race channel
    has gone quiet for 3 s; the host's own outage never counts against the guest. A host's reloaded or reopened tab keeps
    the match (localStorage `regatta-match-<code>`, for six hours) but loses the race that was on. Between races the
    next starts when both press Ready, or 60 s after the card opens with both there, never with one missing; Leave, or
    five minutes gone, ends the match, and Back (the browser's or Telegram's) asks first. The host's race starts only
    once the guest's screen has it built, so a slow phone isn't dropped while it loads. In a match a frame that throws
    is logged and skipped, so one error doesn't lose the race.
  - **Nothing is kept:** no result page, no ranking, nothing posted to the scores server (`stats.js` skips a match), and
    the match is gone from the host's localStorage when it's left or done.
  - **Not on the hub yet:** the race hub's Match race card shows only with `?match` in its address, until the umpire's
    calls have been signed off in test matches; `/match/new` works for anyone with the address.
- **A passport to share:** `/passport?s=&v=&b=&vs=&bb=&n=` (`lib/passport-share.ts`; its card `app/og/passport`): the
  streak, the venues raced and the badges (which, `bb`, as well as how many) as the sharer sent them, from Share on Home's
  venues and on the badges page.
  - The game also posts each finished race to the scores server (below), so a result link opens on any device; there
    it reads as "this boat", not "you", and the page has a Share button for your own races.
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
  locally (localhost, `*.localhost`) it posts nothing, so test races stay off the rankings (nor does a match race, anywhere); `?scores` in the game's
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
  The Bavaria 46's moulded parts (hull, deck, coachroof, cockpit) are `public/game/bavaria46.glb`, made the same way by
  `blender/bavaria46.py` (`blender -b --factory-startup -P blender/bavaria46.py`); `boats3d.js` builds her from its own
  lines if the file doesn't load. The Laser's hull and deck are `public/game/laser.glb`, from `blender/laser.py`, the
  Optimist's open shell `public/game/optimist.glb`, from `blender/optimist.py`, the
  J/70's and the RS21's `public/game/j70.glb` and `rs21.glb`, from `blender/sportboats.py`, and the AC75's
  `public/game/ac75.glb`, from `blender/ac75.py`, likewise.
- **The venues:** today's race goes to a venue a day (`dailyVenue()` in `public/game/venues.js`, copied in
  `lib/race.ts` and in `public/play/index.html`'s preloader, which `npm test` checks): the days go round all of them
  in a shuffled order, so each comes once a round and none two days running. A new venue goes in all three lists in
  the same place, with the day it joins (`from`, a day still to come): the days before it keep the venues they had,
  and from it the rounds start again with the new one among them. The home page's live view (`/hero-view`) stays in Göcek, to match its
  photos. A free race goes to the venue the set-up chose (`venue`
  in the `regatta` options; `?venue=<id>` in the game's address overrides it): Göcek, Cowes, Newport, Sydney, Kiel,
  Trieste, Porto Cervo, Saint-Tropez, Antigua, Auckland, San Francisco, Valencia, Barcelona, Palma, Marstrand, Bermuda,
  Enoshima, Weymouth, Marseille, Rio de Janeiro, Lake Garda, Istanbul, St Petersburg (the Neva under the
  Peter and Paul Fortress, its bridges raised), Batumi, Scheveningen, Hong Kong, Cape Town, Athens, Marmaris or Fethiye (the last eight join
  today's races together, on 20 November 2026). `public/game/venues.js` holds each one's position,
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
    one (EMODnet's round the European venues, Göcek, Istanbul, Batumi, Marmaris and Fethiye; NOAA's at Newport and San Francisco), else the
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
  Tower, the big wheels on Batumi's shore, Scheveningen's pier, Hong Kong's Central and Cape Town's V&A Waterfront, the Bank of China Tower, the Parthenon, Marmaris castle on the map's outline of it, the Knights' castle in Fethiye on walls traced from the air (`ring`), Fethiye's Lycian rock tombs, Telmessos's theatre and the sarcophagi in its streets, Atatürk's statues on both seafronts, the great Turkish flags over both castles and the yachts ashore on their cradles in Marmaris's Adaköy yard (a
  landmark with `clear` leaves out the map's own building in its place). `land.js` lays each course in clear water (its marks, its line, the water below it where the
  fleet waits, the beat out towards the laylines, and every leg from end to end, all on the baked map of the sea
  room), and not across a bridge too low for a mast (St Petersburg's drawbridges). An AC75's course, 2.5 times as
  long, that has no room as asked is laid up and down, then shorter, then smaller, its fleet starting nearer the line
  where the water below it runs out (`sim.js` Race); and the computer skippers keep off the shore, tacking or gybing
  away from land a few seconds' sailing ahead. `npm test` sails every course shape at every venue, in the JPK 1050, the
  Bavaria 46, the Laser, the Optimist and the AC75, and checks its marks and legs are in clear water and on one side of every such bridge; a shape a venue has no room for at a length goes in its `skip`, as does
  a length it has no room for at all (St Petersburg's long course: a long request is sailed at the longest it has), and
  the set-up offers only the shapes and lengths `shapeOffered()` and `lengthOffered()` (`lib/venues.ts`) allow there. Moving between today's race and a free race in the
  game reloads the page when the venue changes. OpenStreetMap has few of Göcek's, Fethiye's and Marmaris's buildings, so their towns also come
  from Microsoft's Global ML Building Footprints (ODbL), which `venues.py` downloads with the rest. Hong Kong's
  ground is its own 5 m terrain model (`dtm`), not the tiles, whose radar has the towers' roofs for the city's ground:
  the Digital Terrain Model of the Lands Department, Hong Kong SAR Government, from DATA.GOV.HK (free to use with
  this attribution), which `venues.py` downloads (29 MB) and cuts to the venue. Batumi's, Cape Town's, Marmaris's and Fethiye's shores have
  more of the map in them: its paved promenades and squares drawn as paving (`paved`), its palm avenues and other rows of trees planted
  tree by tree where they stand (`trees`, the .bin's `tk` and `txz`; Marmaris's and Fethiye's seafront palms, which the map
  lacks, planted every 8 m along the streets `palms` names where they run by the water), and their plains, whose tiles carry the roofs and
  trees some 4 to 8 m up, laid down on the shore's floor below the hills (`plain`; in Cape Town that lets the V&A's
  basins and Milnerton's lagoon down to the sea's level as water). Marmaris and Fethiye have their gulets moored
  stern-to along the town quays (`gulets`: the shore by the streets it names, the json's `moor`), and boats that come
  and go, moved by `skopea.js` on the race's clock, all picture: the fast ferries to Rhodes and the water taxis on their
  `routes` (each found on the water by the bake, the cheapest way on the sea room's grid that keeps off the shore and
  skirts the race area) and Fethiye's kitesurfers off Çalış beach (`kites`).
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

Every picture of the game on the site (`public/images/*-v7.jpg`: the race screen `hud-*` and its close-ups `h-start`,
`h-steer`, `h-trim`, `h-tack`; the home's hero `drone-*`, the fleet from above `top`, the three views `h-view-*`, the
wind ring `h-wind`, the run under the gennaker `h-run` and the share card `og`) is the game's own, taken in headless Chrome with the site running: `node
scripts/shots.mjs http://localhost:5193` (or a few by name after the address). It prints where each part of the HUD sits
on the two numbered pictures, for the marks in `app/[lang]/help/page.tsx`. A picture changed is a new file name (`-v8`),
as the image optimiser caches by name; the race page's loader names the hero's files too (`public/play/index.html`).

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
  - `https://regatta.rycrentals.com/**` (the old address, still served)
  - `https://upandown.rycrentals.com/**`
  - **Site URL:** `https://upandown.rycrentals.com`. Supabase sends a sign-in here when its return address isn't on the list
    above, and email templates read it as `{{ .SiteURL }}`. The project is shared with the iyt app, so this affects it too.
- **Email code:** the "Magic link" email template must include `{{ .Token }}`, so the email carries the 6-digit code. The link in the
  default template also works: it goes through `/auth/callback`.

The display name is kept in the user's `user_metadata.display_name`.

**Telegram:** the IYT mini app opens the site with Telegram's launch data in the hash. `components/telegram-sign-in.tsx` posts it to
`/auth/telegram`, which asks `https://iyt.rycrentals.com/api/regatta-session` (the `iyt-test` repo, which holds the bot token and the
Supabase secret key) for a one-time token and turns it into the session. The player's account is
`tg-<telegram id>@telegram.rycrentals.com` with `app_metadata.telegram_id`; that address is never mailed or shown. `IYT_API_URL`
points the route at another iyt server when testing.
