# Adopting the broadcast design: done

The design is the canvas "Regatta Broadcast HUD" (claude.ai/code/artifact/62239e66-05aa-419f-a1db-ec8449947e40).
Everything planned from it is now on `main`, in five steps, 2026-11-14/15:

| Step | What | On main |
| --- | --- | --- |
| 1 · Restyle | The HUD, the pause card and the loading screen; the race pages; the header, footer, breadcrumbs and reading pages. The leave dialog's buttons the right way round | 71ba2e8 |
| 2 · Layout | Settings and signing in over the game's live scene: three settings cards, one numbered card for each sign-in step | f5d83ce |
| 3 · Game logic | The umpire card, PEN on tags and the board, the mark split, the start's burn call, the line's square bearing and veer/back, the rivals' distance to the line, the course map, and the distance to the next mark in the pause card and the leave dialog | f01fbac |
| 4 · Data and content | Top 5 from the day's rating, each boat's penalties, the finish's four tiles and the previous best on the result, the name step's ranking preview; pictures, tips and a diagram for the guides, glossary groups, a real IYT question | fd298e0 |
| 5 · Decisions | The board's gaps in seconds (metres of course at the polar's best pace for the leg); every FAQ answer open | branch `gaps-faq` |

## Kept as the game had it, on purpose

- **The wind rose:** it turns with your bow and shows the no-go sector.
- **The finish:** a page of its own, not a card inside the race.
- **Not adopted from the canvas:** "Race 1 of 1" (there are no series), the loader's five named steps, and the burn's colours (red when late).
- **The mark split:** boats still to round it show their metres to the mark. A guessed time came out a minute early.
- **The game's wording where the canvas is stale:**
  - blue (not white) downwind;
  - the one-minute start;
  - four course shapes;
  - the venue count.
- **What players use, kept although the design drops it:**
  - the kite, reef, jib, hail and zoom buttons;
  - the tactical chips;
  - the minimap on the phone;
  - the rule cards;
  - the 3D boat thumbnails;
  - the music and sea controls.

## Known limits

- **The board's seconds** assume the polar's best pace. They read a little low for a typical boat (within about 15% in
  headless races), and well low for a boat that later takes a penalty or misses a mark.
- **The downwind guide** has no picture: no screenshot shows a run.
