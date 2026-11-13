# Regatta

The 3D sailing game at https://regatta.rycrentals.com — a static site, deployed by the Vercel project `ryc-regatta`
(root directory `ryc-regatta/` of this repo; a push that changes nothing here skips the build).

- `index.html` — the page; `game/` — the game (Three.js from jsDelivr); `game/yacht.glb` from
  `docs/design/blender/game_yacht.py`.
- From the app on iyt.rycrentals.com it uses: the fonts, the Racing Rules articles linked from the debrief, and
  `api/game.mjs` for the race scores (all allow cross-origin reads). The app's Home card opens the game and, inside
  Telegram, hands it the launch data in the hash.
- Locally: `python3 -m http.server 5193 --directory ryc-regatta` (the `regatta` entry in `.claude/launch.json`).
