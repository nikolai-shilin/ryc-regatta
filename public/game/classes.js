// The yachts you can race: the JPK 1050 offshore racer (the default), the Bavaria 46
// cruiser, the J/70 and RS21 sportboats, the Dragon classic keelboat, the J Class America's Cup yacht of the 1930s, the Laser (ILCA) single-handed dinghy, the Optimist children's pram and the AC75 foiling monohull. A race is one-design: every boat in it is the same class, so the class is chosen for
// the page, as the venue is (venues.js pageVenue): ?boat= in the address wins; a free race sails what its set-up chose
// (localStorage 'regatta', yacht); today's race the day's (dailyYacht, below); every other page the JPK 1050.
// lib/yachts.ts has the same ids and the words the site shows about them.

// a polar: knots by true wind speed (tws, the columns) and true wind angle (twa, the rows); beat: the close-hauled
// angle and beatV the speed there, for each tws. It is the speed with the sails trimmed, depowered and reefed as well
// as a crew can (sim.js bestTrim): a good crew sails it in a blow as in a breeze.
// How she turns, against the JPK 1050: turn, her rate of turn for the helm put over (a dinghy spins round, a 14-tonne
// cruiser takes her time), and yawLag, the seconds she takes to start turning and to stop (sim.js YAW_LAG).
// The sea, the gybe and the heel, against the JPK where a class doesn't say (sim.js): chopK, how much a short sea stops
// her upwind (by her size); surfK, how readily she rides a sea downwind; gybeT and gybeK, the seconds her kite takes to
// gybe and the drive she keeps meanwhile; heelMax, the heel her crew eases her at; latG, the sideways g a hard turn can
// hold her to at speed (the AC75's).
// heelShow: how much of her heel is drawn (a dinghy is sailed flat, her sailor's weight out over the side holding her up)
// frame: how big she stands against the JPK 1050, her masthead's height over the water against the JPK's 16.2 m: every
// camera that watches one boat stands that much further off or nearer and aims that much higher or lower on her
// (world.js), so each yacht fills the screen as the JPK does (measured on the boat page: the Laser, the Optimist and the
// J Class within a few per cent of her)
const TWS = [4, 6, 8, 10, 12, 14, 16, 20, 24];
const TWA = [52, 60, 75, 90, 110, 120, 135, 150, 165, 180];

export const CLASSES = {
  // the JPK 1050: JPK Composites' 34-foot offshore racer (Jacques Valer and Jean-Baptiste Dejeanty, 2025), built for
  // IRC and two-handed racing — a scow-inspired hull with a wide transom and twin rudders, a T-keel, a tiller, a carbon
  // rig with a square-top main, a gennaker on a fixed bowsprit and a code zero. Some 3.5 tonnes: quicker to get going
  // and to lose way than a heavier 40-footer, and from about 16 knots of wind she planes on the reaches and runs.
  // She sails to the ORC certificate of SOLENN (FRA 53516, 2026, GPH 581.4): its speeds at each angle; close-hauled,
  // its beat angle (10 knots' smoothed to 40°) at its beat VMG; 165° and 180° from its downwind VMGs there.
  jpk1050: {
    id: 'jpk1050', loa: 10.45, beam: 3.54, drawnL: 10.45, crew: 4, frame: 1,
    kite: true, zero: true, reef: true, j3: true,
    tau: 4.5, coast: 32, hullV: 12, heelK: 1, awsK: 1, heelShow: 1, turn: 1, yawLag: 0.55, courseK: 1, lineK: 1, startK: 1,
    tws: TWS, twa: TWA,
    beat: [45.8, 43, 40.4, 40, 39.2, 38.5, 38.4, 39.2, 40],
    beatV: [3.92, 5.22, 6.01, 6.53, 6.71, 6.77, 6.84, 6.94, 7.0],
    v: [
      [4.28, 4.61, 4.86, 4.77, 4.44, 4.3, 3.81, 3.15, 2.35, 1.97],
      [5.78, 6.06, 6.26, 6.17, 6.16, 6.03, 5.38, 4.53, 3.56, 2.99],
      [6.74, 6.96, 7.1, 7.12, 7.25, 7.16, 6.68, 5.68, 4.67, 3.97],
      [7.23, 7.43, 7.6, 7.71, 7.95, 7.86, 7.46, 6.7, 5.66, 4.87],
      [7.43, 7.69, 8.01, 8.18, 8.56, 8.58, 8.12, 7.43, 6.58, 5.71],
      [7.53, 7.82, 8.28, 8.52, 9.03, 9.44, 8.9, 8.01, 7.28, 6.46],
      [7.61, 7.92, 8.42, 8.92, 9.69, 10.23, 9.96, 8.64, 7.77, 7.03],
      [7.71, 8.04, 8.64, 9.42, 10.99, 11.74, 12.8, 10.56, 8.84, 7.94],
      [7.74, 8.11, 8.81, 9.95, 11.84, 13.41, 15.25, 14.62, 10.21, 8.95],
    ],
  },
  // the Bavaria 46: the Farr-designed Cruiser 46, the charter fleets' boat — some fourteen tonnes as she sails, a
  // furling genoa and an in-mast furling main, a cruising gennaker tacked to a short sprit at the bow. Slow to get
  // going and slow to lose way; a reef (a few turns of the main rolled away) for a blow, no code zero and no J3. Her
  // courses are the JPK 1050's length, laid 1.3 times as wide (the line, the room at the marks) for a fleet of 14 m
  // boats that turn and stop slowly.
  bavaria46: {
    id: 'bavaria46', loa: 14.27, beam: 4.35, drawnL: 14.27, crew: 5, frame: 1.3,
    kite: true, zero: false, reef: true, j3: false,
    tau: 7, coast: 50, hullV: 8.6, heelK: 1.1, awsK: 1, heelShow: 1, turn: 0.85, yawLag: 0.7, courseK: 1, lineK: 1.3, startK: 1.3,
    surfK: 0.25, // fourteen tonnes on a displacement hull: a sea lifts her along now and then, no more
    gybeT: 9, gybeK: 0.7, // a cruising crew takes the gennaker round the forestay in its own time
    heelMax: 20, // a cruising crew eases her at 20°, where a racing crew holds the JPK to 24°
    tws: TWS, twa: TWA,
    // the median of 29 ORC Club certificates of the Farr-designed Cruiser 46 (data.orc.org, 2026), all with a
    // gennaker; 4 and 24 knots extended from 6 and 20
    beat: [49, 47.1, 45.7, 44.1, 43.0, 41.9, 41.3, 41.2, 41.5],
    beatV: [2.9, 4.16, 5.15, 5.85, 6.41, 6.83, 7.11, 7.29, 7.35],
    v: [
      [3.05, 3.3, 3.45, 3.7, 3.8, 3.7, 3.3, 2.8, 2.45, 2.25],
      [4.48, 4.85, 5.08, 5.45, 5.63, 5.47, 4.86, 4.09, 3.6, 3.3],
      [5.61, 5.98, 6.23, 6.73, 6.96, 6.78, 6.15, 5.28, 4.65, 4.25],
      [6.44, 6.8, 7.08, 7.66, 7.9, 7.75, 7.2, 6.3, 5.6, 5.1],
      [7.08, 7.42, 7.69, 8.24, 8.46, 8.36, 7.96, 7.16, 6.4, 5.85],
      [7.56, 7.86, 8.1, 8.56, 8.88, 8.81, 8.48, 7.83, 7.1, 6.5],
      [7.88, 8.15, 8.4, 8.72, 9.26, 9.23, 8.9, 8.3, 7.8, 7.2],
      [8.1, 8.41, 8.79, 8.96, 9.81, 10.06, 9.78, 9.01, 8.4, 7.7],
      [8.2, 8.55, 8.95, 9.15, 10.2, 10.6, 10.5, 9.7, 9.0, 8.3],
    ],
  },
  // the J/70: a 22-foot sportboat with a retractable bowsprit and an asymmetric spinnaker, sailed by three to five and
  // hiked hard; light (some 800 kg with her crew), quick to accelerate and to lose way, and planing off the wind from
  // about 12 knots
  j70: {
    id: 'j70', loa: 6.93, beam: 2.25, drawnL: 6.93, crew: 4, frame: 0.61,
    kite: true, zero: false, reef: false, j3: false,
    tau: 2.6, coast: 18, hullV: 15, heelK: 1.1, awsK: 1, heelShow: 1, turn: 1.2, yawLag: 0.45, courseK: 0.8, lineK: 0.8, startK: 0.8,
    surfK: 2.5, // light and flat-run aft: she catches a sea and rides it, some 7% quicker downwind in a blow and a seaway
    gybeT: 5, gybeK: 0.75, // a small gennaker, quick round the forestay
    heelMax: 17, // sailed flat, the crew hiked hard: they ease her from some 17°
    tws: TWS, twa: TWA,
    beat: [45, 43, 41, 40, 39.5, 39.5, 40, 41, 42],
    beatV: [3.3, 4.4, 5.2, 5.7, 6.0, 6.15, 6.25, 6.4, 6.45],
    // from 16 knots she planes downwind: hotter, at 135–150°, she goes so much quicker that it pays over sailing deep
    // (her best way down 145–150° in a blow, where she had soaked to 160°), as the RS21 does
    v: [ // a row per tws, a speed per twa above
      [3.9, 4.2, 4.4, 4.4, 4.3, 4.2, 3.7, 3.1, 2.7, 2.4],
      [5.1, 5.4, 5.7, 5.8, 5.8, 5.7, 5.2, 4.4, 3.8, 3.4],
      [5.9, 6.2, 6.5, 6.7, 6.9, 6.8, 6.4, 5.6, 4.9, 4.4],
      [6.4, 6.7, 7.0, 7.3, 7.7, 7.7, 7.4, 6.6, 5.9, 5.4],
      [6.6, 6.95, 7.4, 7.8, 8.6, 8.7, 8.3, 7.4, 6.8, 6.3],
      [6.75, 7.1, 7.7, 8.4, 9.8, 10.0, 9.4, 8.2, 7.6, 7.0],
      [6.85, 7.2, 8.0, 9.2, 11.0, 11.4, 11.6, 9.9, 8.5, 7.8],
      [7.0, 7.4, 8.6, 10.6, 13.0, 13.6, 14.4, 12.6, 10.6, 9.6],
      [7.1, 7.6, 9.2, 11.8, 14.6, 15.4, 16.6, 14.8, 12.8, 11.6],
    ],
  },
  // the RS21: RS Sailing's 21-foot one-design keelboat — a wide-open cockpit, a lifting bulb keel, a sprit and a big
  // gennaker, raced by two to four. A little lighter (about 650 kg) and a touch slower upwind than the J/70, quicker to
  // plane off the wind in a moderate breeze
  rs21: {
    id: 'rs21', loa: 6.67, beam: 2.2, drawnL: 6.67, crew: 3, frame: 0.6,
    kite: true, zero: false, reef: false, j3: false,
    tau: 2.4, coast: 17, hullV: 15, heelK: 1.15, awsK: 1, heelShow: 1, turn: 1.2, yawLag: 0.45, courseK: 0.8, lineK: 0.8, startK: 0.8,
    surfK: 2.5, // as the J/70
    gybeT: 5, gybeK: 0.75,
    heelMax: 17,
    tws: TWS, twa: TWA,
    beat: [45, 43.5, 41.5, 40.5, 40, 40, 40.5, 41.5, 42.5],
    beatV: [3.2, 4.3, 5.1, 5.55, 5.85, 6.0, 6.1, 6.25, 6.3],
    v: [
      [3.8, 4.1, 4.3, 4.35, 4.3, 4.2, 3.7, 3.1, 2.7, 2.4],
      [5.0, 5.3, 5.6, 5.75, 5.8, 5.7, 5.25, 4.45, 3.85, 3.4],
      [5.8, 6.1, 6.45, 6.7, 7.0, 6.95, 6.55, 5.7, 5.0, 4.5],
      [6.25, 6.55, 6.95, 7.35, 7.95, 8.0, 7.7, 6.8, 6.05, 5.5],
      [6.45, 6.8, 7.35, 7.95, 9.0, 9.2, 8.8, 7.7, 7.0, 6.4],
      [6.6, 6.95, 7.65, 8.6, 10.2, 10.5, 9.9, 8.5, 7.8, 7.1],
      [6.7, 7.05, 7.95, 9.3, 11.3, 11.8, 11.9, 10.2, 8.7, 7.9],
      [6.85, 7.25, 8.5, 10.6, 13.1, 13.8, 14.6, 12.8, 10.7, 9.7],
      [6.9, 7.4, 9.0, 11.7, 14.5, 15.3, 16.5, 14.9, 12.8, 11.6],
    ],
  },
  // the Dragon: Johan Anker's 1929 three-man keelboat, Olympic from 1948 to 1972 and raced in fleets round the world
  // since — 8.9 m with long overhangs, a tonne of iron in her keel (some 1,700 kg as she sails), a genoa overlapping
  // the mast and a symmetric spinnaker set from a pole. Narrow and deep: she points high and holds her way through a
  // tack, heels readily to her lines and never planes; off the wind she sails at her hull's speed, surfing a little in a
  // blow. Her courses are laid 0.75 times as long, her line and the room at the marks the sportboats'.
  // How she carries her way and heels, against the JPK 1050 (tau 4.5, coast 32, heelK 1): heavy for her power (27.7 m²
  // on 1.7 tonnes, a sail area to displacement of 19 to the JPK's 30 and the J/70's 43), she gathers way slowly (tau
  // 5); narrow and slippery for her weight, she carries it far (coast 38): luffed head to wind from close-hauled in 12
  // knots, some 22 m, two and a half of her lengths (the JPK 24 m, 2.3 of hers; the J/70 2.0); a tonne of iron 1.2 m down
  // lets her heel to some 13° in 8 knots and 21° in 12 (the JPK 18° and 28°), rail down and easing her main
  // from about 15 knots (heelK 0.8); above 6.8 knots, her hull's speed on her waterline lengthened by her overhangs as
  // she heels, the waves hold her back at once (hullV)
  dragon: {
    id: 'dragon', loa: 8.9, beam: 1.96, drawnL: 8.9, crew: 3, frame: 0.67,
    kite: true, zero: false, reef: false, j3: false,
    tau: 5, coast: 38, hullV: 6.8, heelK: 0.8, awsK: 1, heelShow: 1, turn: 0.85, yawLag: 0.65, courseK: 0.75, lineK: 0.8, startK: 0.8,
    surfK: 0.45, // a heavy narrow hull: a sea lifts her now and then, no more
    gybeT: 8, gybeK: 0.7, // a symmetric spinnaker: the pole comes off the old guy and goes on the new, end for end
    tws: TWS, twa: TWA,
    // from her Portsmouth Number (RYA 986, against the ILCA 7's 1103): round a windward-leeward course some 1.12 times
    // as quick as the Laser in 8–14 knots, and 5% slower than the J/70; upwind VMG some 4.5 kn in 12 knots at 38°
    beat: [43, 41, 39.5, 38.5, 38, 38, 38.5, 39.5, 41],
    beatV: [3.15, 4.25, 5.0, 5.5, 5.8, 5.95, 6.05, 6.15, 6.2],
    v: [
      [3.45, 3.65, 3.8, 3.8, 3.75, 3.65, 3.35, 2.95, 2.55, 2.35],
      [4.55, 4.8, 5.05, 5.1, 5.15, 5.05, 4.7, 4.15, 3.6, 3.35],
      [5.3, 5.55, 5.85, 6.0, 6.1, 6.05, 5.75, 5.15, 4.65, 4.35],
      [5.7, 5.95, 6.25, 6.5, 6.65, 6.65, 6.45, 5.95, 5.5, 5.15],
      [5.9, 6.15, 6.5, 6.75, 7.0, 7.05, 6.9, 6.55, 6.1, 5.8],
      [6.0, 6.25, 6.65, 6.9, 7.25, 7.35, 7.25, 6.95, 6.6, 6.25],
      [6.05, 6.3, 6.75, 7.05, 7.45, 7.65, 7.6, 7.3, 6.95, 6.65],
      [6.1, 6.35, 6.85, 7.25, 7.85, 8.1, 8.15, 7.9, 7.5, 7.2],
      [6.15, 6.45, 6.9, 7.35, 8.1, 8.45, 8.6, 8.4, 8.05, 7.7],
    ],
  },
  // the Laser (ILCA 7): the 14-foot single-handed Olympic dinghy — one sail on an unstayed mast, no jib (jib: false: one
  // sheet, never split), no kite. Some 60 kg of hull and one sailor hiking: she stops in a tack and goes again at once,
  // and from about 12 knots planes on the reaches. Slow upwind beside the keelboats: her courses are laid 0.6 times as
  // long.
  laser: {
    id: 'laser', loa: 4.19, beam: 1.39, drawnL: 4.19, crew: 1, frame: 0.38,
    kite: false, zero: false, reef: false, j3: false, jib: false,
    tau: 1.8, coast: 11, hullV: 13, heelK: 1.2, awsK: 1, heelShow: 0.35, turn: 1.5, yawLag: 0.3, courseK: 0.6, lineK: 0.6, startK: 0.6,
    surfK: 2.5, // pumped onto a wave and riding it: some 7% quicker downwind in a blow and a seaway
    tws: TWS, twa: TWA,
    // from measured speeds: GPS tracks of World Cup and Olympic races (Pan & Sun 2022), the tank-validated VPP of
    // Day (2017) and Binns' measured polars (2002) — upwind VMG some 3.2 kn in 8 knots, 3.7 in 12; downwind she surfs
    beat: [44, 43, 41.5, 41, 41, 42, 43, 44, 45],
    beatV: [2.75, 3.65, 4.35, 4.8, 4.95, 5.1, 5.2, 5.3, 5.25],
    v: [
      [3.0, 3.15, 3.3, 3.35, 3.25, 3.15, 2.95, 2.7, 2.5, 2.4],
      [3.95, 4.15, 4.35, 4.45, 4.4, 4.25, 4.0, 3.7, 3.45, 3.35],
      [4.65, 4.9, 5.2, 5.4, 5.4, 5.3, 5.0, 4.75, 4.45, 4.3],
      [5.1, 5.4, 5.85, 6.3, 6.5, 6.35, 5.9, 5.5, 5.2, 5.0],
      [5.35, 5.7, 6.3, 7.2, 7.5, 7.3, 6.9, 6.6, 6.2, 6.0],
      [5.5, 5.9, 6.8, 8.1, 8.6, 8.4, 7.9, 7.4, 6.9, 6.6],
      [5.6, 6.05, 7.3, 9.0, 9.7, 9.5, 8.9, 8.3, 7.6, 7.2],
      [5.7, 6.2, 8.0, 10.3, 11.4, 11.2, 10.5, 9.6, 8.7, 8.2],
      [5.7, 6.25, 8.4, 11.0, 12.6, 12.5, 11.8, 10.8, 9.8, 9.2],
    ],
  },
  // the Optimist: the 2.3 m single-handed pram most racing sailors learn in, raced up to the age of 15 — a flat-floored
  // box with a transom at the bow too, one spritsail on a short unstayed mast, no jib (jib: false: one sheet) and no
  // kite. Some 35 kg of hull and a child aboard: she stops in a tack and goes again at once, slow but nimble. A short
  // waterline holds her to some 3½ knots upwind and 5–6 on a broad reach in a blow, where her sailor, overpowered,
  // eases and hikes to keep her flat; she lifts onto a plane only on the biggest reaching gusts. Her courses are laid
  // 0.3 times as long, as many of her lengths as the Laser's are of hers; her start line as long as the Laser's (a
  // fleet of them starts in a crowd, and the computer skippers need the room to come through it).
  optimist: {
    id: 'optimist', loa: 2.31, beam: 1.13, drawnL: 2.31, crew: 1, frame: 0.16,
    kite: false, zero: false, reef: false, j3: false, jib: false,
    tau: 1.4, coast: 6, hullV: 4.2, heelK: 1.1, awsK: 1, heelShow: 0.4, turn: 1.6, yawLag: 0.25, courseK: 0.3, lineK: 0.6, startK: 0.6,
    surfK: 0.6, // a pram's bluff bow: she rides a sea only a little
    tws: TWS, twa: TWA,
    // a displacement hull 1.9 m on the waterline (2.18 m of floor): upwind VMG some 2.25 kn in 8 knots, 2.5 in 12,
    // falling off as she is overpowered; downwind no faster than her hull lets her, but for a reach in a breeze. Round a
    // course she takes some 1.5 times the Laser's time in 8–12 knots, as the Portsmouth Yardstick has it (Optimist
    // 1640, ILCA 7 1103)
    beat: [47, 46, 45, 45, 45, 46, 47, 48, 50],
    beatV: [2.0, 2.7, 3.2, 3.45, 3.55, 3.5, 3.45, 3.25, 3.0],
    v: [
      [2.15, 2.3, 2.5, 2.5, 2.4, 2.25, 2.05, 1.85, 1.6, 1.5],
      [2.9, 3.1, 3.25, 3.3, 3.2, 3.1, 2.8, 2.5, 2.25, 2.15],
      [3.4, 3.55, 3.8, 3.9, 3.85, 3.75, 3.45, 3.15, 2.85, 2.75],
      [3.65, 3.85, 4.1, 4.25, 4.3, 4.2, 3.95, 3.6, 3.35, 3.25],
      [3.8, 4.0, 4.3, 4.6, 4.75, 4.7, 4.45, 4.05, 3.75, 3.6],
      [3.75, 4.0, 4.35, 4.75, 5.1, 5.05, 4.75, 4.35, 4.05, 3.85],
      [3.75, 3.95, 4.35, 4.95, 5.45, 5.4, 5.15, 4.65, 4.3, 4.15],
      [3.5, 3.75, 4.2, 5.05, 5.85, 5.85, 5.55, 5.05, 4.65, 4.45],
      [3.25, 3.55, 4.1, 5.0, 6.0, 6.1, 5.8, 5.3, 4.9, 4.6],
    ],
  },
  // the AC75: the America's Cup's 75-foot foiling monohull. Two canting foil arms lift her clear of the water from
  // some 16 knots of boat speed, and then she sails at three times the wind's speed and more, the apparent wind always
  // ahead: no spinnaker, only the double-skinned main and a jib. Below some 13 knots she comes down off her foils (a
  // tack in a lull, a stop), and is a heavy displacement boat until she builds the speed to take off again: on a beam
  // reach, where the hull lifts first, in 7 knots of wind and more (the 37th Cup raced in 6.5 to 21; in Barcelona the
  // boats took off at 14–20 knots of boat speed, and a tack below 7 knots of wind seldom stayed up). Upwind or deep
  // downwind in a lull she can't; the computer skippers bear away or come up to fly again. Courses for her are laid
  // longer.
  // the J Class: the America's Cup's yachts of 1930–1937 (the Universal Rule's 76-foot rating), a generic one between
  // Velsheda, Endeavour and Ranger as the J Class Association lists them: 39.3 m over all on 27 m of waterline, some
  // 175 tonnes, near half of it lead, and 860 m² of sail upwind. A train under sail: she takes a long time to gather
  // way (tau 11 s, the Bavaria's 7, from the drive her sails have for her mass) and carries it far (coast 190: luffed
  // head to wind from close-hauled in 12 knots she shoots some 70 m, 1.8 of her lengths), so a tack costs her no more
  // of her way than the JPK's does, though it takes three times as long (some 11 s), and getting it back takes her some 20 s
  // to the JPK's 8; she turns slowly (a third of the JPK's rate, and a second before she answers the helm: her full-helm circle
  // some three quarters of her length across each way, as the JPK's) and heels to some
  // 18° in 12 knots, her hull speed 12.6 knots on her waterline. Her polar is the
  // reconstruction in the J Class simulator reference (from the class's geometry, its 1930s tank tests and the J Class
  // Association's VPP): close-hauled at 44–46°, a tacking angle of 88–93°, her best on a beam reach, 7.3 knots at 42°
  // and 10.5 on the beam in 12 knots; 120° between its 110° and 135°, 165° and 180° from its 150°, 4 and 24 knots
  // carried on from 6 and 20. Her courses are laid 1.6 times as long and the line 2.2 times as wide, for 39 m boats.
  // The sea: she lies across the short seas, feeling their slope as its mean along her 27 m waterline (waveL), so she
  // can't be steered through each one as a light boat is, and 175 tonnes don't surf (surfK 0: downwind in a blow she
  // carries her sail at her hull's pace, the polar's); 175 tonnes on a 27 m waterline punch through a short sea that
  // stops a 10 m boat, so it costs her upwind half what it costs the JPK (chopK by her size).
  jclass: {
    id: 'jclass', loa: 39.3, beam: 6.55, drawnL: 39.3, crew: 30, frame: 2.9,
    kite: true, zero: false, reef: false, j3: false,
    tau: 11, coast: 190, hullV: 12.6, heelK: 0.6, awsK: 1, heelShow: 1, turn: 0.35, yawLag: 1.1, courseK: 1.6, lineK: 2.2, startK: 2.5,
    waveL: 27, surfK: 0,
    gybeT: 20, gybeK: 0.6, // a dip-pole gybe of a 1,000 m² spinnaker by thirty crew
    tws: TWS, twa: TWA,
    beat: [48, 46.5, 45.5, 45, 44.5, 44, 44, 45, 46],
    beatV: [3.59, 5.3, 6.15, 6.93, 7.6, 8.22, 8.82, 9.56, 9.97],
    v: [
      [3.83, 4.16, 4.49, 4.62, 4.49, 4.33, 4.09, 3.76, 3.44, 3.23],
      [5.8, 6.3, 6.8, 7, 6.8, 6.56, 6.2, 5.7, 5.22, 4.9],
      [6.8, 7.4, 8, 8.3, 8.1, 7.78, 7.3, 6.8, 6.22, 5.85],
      [7.7, 8.4, 9.1, 9.5, 9.2, 8.8, 8.2, 7.5, 6.86, 6.45],
      [8.5, 9.2, 10.1, 10.5, 10.1, 9.62, 8.9, 8, 7.32, 6.88],
      [9.1, 10, 11, 11.5, 11, 10.44, 9.6, 8.6, 7.87, 7.4],
      [9.7, 10.6, 11.8, 12.4, 11.8, 11.16, 10.2, 9, 8.23, 7.74],
      [10.4, 11.4, 12.8, 13.6, 12.8, 12.08, 11, 9.6, 8.78, 8.26],
      [10.71, 11.74, 13.18, 14.01, 13.18, 12.44, 11.33, 9.89, 9.05, 8.51],
    ],
  },
  ac75: {
    id: 'ac75', loa: 20.7, beam: 5.0, drawnL: 20.7, crew: 8, frame: 1.7, // the rule's hull length: no bowsprit since the 37th Cup
    kite: false, zero: false, reef: false, j3: false,
    tau: 3.2, coast: 420, hullV: 60, heelK: 0.35, awsK: 2.6, heelShow: 0.45, turn: 1, yawLag: 0.55, courseK: 2.5, lineK: 1.8, startK: 4,
    surfK: 0, chopK: 0.3, // flying, her hull is clear of the sea: it neither checks her upwind nor carries her down
    latG: 0.6, // a hard turn at 45 knots holds her crew at 0.6 g: a bear-away is an arc of some 100 m, no pirouette
    foil: { takeoff: 16, land: 13, dispCoast: 30, disp: [[28, 0], [40, 1.5], [60, 1.9], [90, 2.6], [120, 2.5], [150, 1.6], [180, 0.9]] },
    tws: TWS, twa: TWA,
    beat: [48, 46, 44, 43, 42, 42, 42, 43, 44],
    beatV: [14, 22, 28, 32, 35, 37, 39, 41, 42],
    v: [
      [15, 16, 17, 17, 17, 16, 15, 12, 9, 7],
      [24, 26, 28, 28, 28, 27, 25, 21, 16, 13],
      [30, 32, 34, 35, 35, 34, 32, 28, 22, 18],
      [34, 36, 38, 39, 40, 39, 37, 33, 27, 22],
      [37, 39, 41, 42, 43, 42, 40, 36, 30, 25],
      [39, 41, 43, 44, 45, 44, 42, 38, 32, 27],
      [41, 43, 45, 46, 47, 46, 44, 40, 34, 29],
      [43, 45, 47, 48, 49, 48, 46, 42, 36, 31],
      [44, 46, 48, 49, 50, 49, 47, 43, 37, 32],
    ],
  },
};
export const CLASS_IDS = Object.keys(CLASSES);
export const DEFAULT_CLASS = 'jpk1050';
export const classById = (id) => CLASSES[id] || CLASSES[DEFAULT_CLASS];

// Today's race's yacht, a new one every day: from the day each joins today's races (DAILY_YACHTS) the days go round
// them in a shuffled order, every one of them in turn and never the same two days running; the days before the first
// joined, the JPK 1050. A class not in DAILY_YACHTS sails only free races. lib/race.ts dailyYacht does the
// same, and npm test keeps the two in step.
// The AC75 joins on 18 November: she sails a course in under half the JPK 1050's time, and the scores server
// (api/game.mjs in the iyt-test repo) checks her times against her own share of its floor (YACHT_FLOOR) from then on.
// The Dragon and the Optimist join on 17 November, the day after the first, so its Laser stays the Laser: every class
// sails today's races from then on. The Optimist's course is sized to her, so short that in 12 knots her computer boats
// sail it in 1.16 times the 40-footer's floor: the server keeps 0.6 of it for her.
// The J Class joins on 18 November with the AC75, so today's Optimist and tomorrow's RS21 stay as they were: she
// first sails on the 22nd. She is slower round her course than the JPK round hers, so the server's floor for the JPK
// serves her as it is.
// npm test sails every one of them well above the floor the server keeps for her.
export const DAILY_YACHTS = { jpk1050: '2026-11-16', bavaria46: '2026-11-16', j70: '2026-11-16', rs21: '2026-11-16', laser: '2026-11-16', dragon: '2026-11-17', optimist: '2026-11-17', ac75: '2026-11-18', jclass: '2026-11-18' };
const dayN = (s) => Math.floor(Date.parse(s) / 864e5);
export const YACHT_ROUNDS = [...new Set(Object.values(DAILY_YACHTS).map(dayN))].sort((a, b) => a - b)
  .map((n0) => ({ n0, ids: Object.keys(DAILY_YACHTS).filter((id) => dayN(DAILY_YACHTS[id]) <= n0) }));
function yachtRound(ids, k) {
  let s = ((k + 1) * 69069 + 4111) >>> 0 || 1; // the venues' generator (venues.js), seeded on its own
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const a = ids.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function yachtOn(n) {
  if (n < YACHT_ROUNDS[0].n0) return DEFAULT_CLASS;
  let e = YACHT_ROUNDS.length - 1; while (e > 0 && n < YACHT_ROUNDS[e].n0) e--;
  const { n0, ids } = YACHT_ROUNDS[e], len = ids.length, k = Math.floor((n - n0) / len), a = yachtRound(ids, k);
  if (len > 1 && a[0] === (k > 0 ? yachtRound(ids, k - 1)[len - 1] : yachtOn(n0 - 1))) [a[0], a[1]] = [a[1], a[0]];
  return a[n - n0 - k * len];
}
export const dailyYacht = (date = new Date()) => yachtOn(dayN(date.toISOString().slice(0, 10)));

// A newcomer's first race: today's race asked for on a device with no race behind it (the regatta options' played,
// counted as each race starts: main.js) becomes an easy one, an Optimist on a short course (main.js settings).
// Not a custom race, a drill, a 1-on-1 or a boat the address names, all chosen on purpose; ?nofirst skips it.
// ?race=first asks for it by name, on any device, raced before or not (the site's header, menu and home link it).
export function firstRaceHere() {
  try {
    const q = new URLSearchParams(location.search);
    if (!/^\/play/.test(location.pathname)) return false;
    if (q.get('race') === 'first') return true;
    if (q.get('race') === 'free' || q.get('boat') || q.get('drill') || q.get('match') || q.has('nofirst')) return false;
    return !(+JSON.parse(localStorage.getItem('regatta') || '{}').played > 0);
  } catch (e) { return false; }
}

export function pageClass() {
  try {
    if (firstRaceHere()) return CLASSES.optimist;
    const q = new URLSearchParams(location.search);
    if (q.get('boat')) return classById(q.get('boat'));
    if (q.get('race') === 'free') return classById(JSON.parse(localStorage.getItem('regatta') || '{}').yacht);
    if (/^\/play/.test(location.pathname) && !q.get('drill')) return classById(dailyYacht()); // a drill: the JPK 1050
  } catch (e) {}
  return CLASSES[DEFAULT_CLASS];
}
export const CLS = pageClass();
