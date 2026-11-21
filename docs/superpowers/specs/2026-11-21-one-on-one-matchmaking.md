# 1-on-1 races, release 4a: Find a race

Status: built on 2026-11-21 on the branch `one-on-one-matchmaking`, in this repo and in iyt-test. It is the first slice of
release 4 of the 1-on-1 plan, matchmaking ("the blue lane").

## How it goes

1. **Find a race** (`/duel`, `components/duel-finder.tsx`). Signed in, the page asks `POST /connect/seek` every 3 s. A
   visitor is asked to sign in, since a rated race needs an account on both sides, or can challenge a friend instead.
2. **Looking.** The page shows how long you've waited, the band and how many others are looking. The database pairs
   the nearest rating within both sailors' bands. The band is ±100 at first, ±200 from 0:20 and ±350 from 0:45.
   Provisional sailors are paired with each other first, and the longest waiting go first among equals. Everything
   happens in one step under one lock, so two seekers can't both take a third (`regatta_seek`, in iyt-test
   `supabase/migrations/20261121200000_regatta_seek.sql`). After 1:30 with nobody, the page offers a friend's link instead.
3. **Match found.** Ten seconds to say Ready, asked every second.
   - **The short version,** for a sailor with fewer than five rated races: who, their level, about how long.
   - **The full version,** for everyone else, adds the chance and what a win or a loss would do.
   - **Decline:** the decliner stops looking and the other sailor goes on.
   - **Nobody says Ready within 12 s:** the pair expires. Whoever didn't say Ready is dropped and told so. Whoever did goes
     on looking, and is told the other didn't answer.
4. **Both Ready.** Each screen is told "go", however late it asks, for two minutes.
   - The host, the one who waited longer, gets the race's code and settings, as `/match/new` would give them.
   - Both open the race's link. The host's has `&auto`, so the game starts the race by itself once the guest is in
     (`public/game/match-ui.js`). A signed-in guest joins the room by herself already.
5. **Easy first matches.** If either sailor has had fewer than three rated races, the race is easy:
   - one lap of a short windward–leeward, in a medium breeze, in a J/70;
   - at one of the five lightest venues to load: Phuket, Antigua, Muscat, St Barths or Porto Cervo (each under 290 KB of
     scene).

   Otherwise the host's wishes are used, then the guest's, then the same defaults.

## Left for the next slices of release 4

- **Ready now:** who is looking or ready, read every 10 s, with a challenge button beside each.
- **The full 1-on-1 page:** the settings, your rating and last races, and links from the race hub and the header.
- **The block on a returning sailor's home page.**
- **The venue loading during the accept,** for a start line that shows each screen's progress.
