# Regatta

The 3D sailing game at https://regatta.rycrentals.com: a windward–leeward race against computer boats, under the
racing rules. A static site with no build, deployed by the Vercel project `ryc-regatta` on every push to `main`.

- `index.html`: the page, words in English and Russian; `game/`: the game (Three.js from jsDelivr).
- `game/yacht.glb` is made by `blender/yacht.py` (run it in Blender; it writes the file in place).
- From the app at iyt.rycrentals.com (the `iyt-test` repo) it uses the fonts, the Racing Rules articles linked from
  the debrief, and `api/game.mjs` for the race scores; all of them allow cross-origin reads. The app's Home card opens
  the game and, inside Telegram, hands it the launch data in the hash.
- History up to the split comes from `iyt-test` (`miniapp/regatta*`, then `ryc-regatta/`).

Run it locally:

```bash
python3 -m http.server 5193
```

The scores and the Racing Rules links come from production, so they only work on regatta.rycrentals.com.
