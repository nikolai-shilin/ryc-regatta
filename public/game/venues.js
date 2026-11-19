// Where a race is sailed: Göcek bay and the famous regatta venues. Today's race goes to one of them each day
// (dailyVenue); a free race goes where the set-up chose. Numbers and colours only (no three.js, nothing fetched), so the race, the light and the land can all ask.
//
// The land of each is baked from real elevation and OpenStreetMap by blender/venues.py (Göcek's into skopea.json/.bin,
// the others' into venues/<id>.json/.bin), which keeps the same lat, lon and wind as here.
// wind: the compass direction the venue's prevailing wind blows from. The baked land is turned so it comes from the
// game's north, where every race's wind is. tz: the clock's hours ahead of UTC in the sailing season.
// stream: the water's own run there, in a race with the current on (sim.js): ['tide', compass direction the flood
// runs to, knots] runs one way or the other along that line, the flood or the ebb, and builds, eases and swings with
// the tide; ['flow', direction, knots] always runs that way (a river, an ocean current), slower near the banks. None:
// a sea without a real tide (the Med, the Baltic, a lake), where the current is the wind's own light surface drift.
//
// The set-up page's list of them, with what each is, is lib/venues.ts; npm test keeps the two in step.
// runs: true, a river or a strait, whose stream runs in every race and not only with the current on (a match excepted)
// anchored: how many ships lie at anchor in the roads off its port, 1.6 to 4.5 km out, most upwind (ships.js)
// thermal: false, no sea breeze here: the venue's wind is a gradient wind, or blows off the land (sim.js seaBreeze)
// look: how the land is drawn (skopea.js)
//   ground: the colours of the hillsides: forest (dark, mid, light), scrub, rock (light, dark), town, shore; sand
//     (beaches) and grass (lawns, parks, meadows), when not the defaults (skopea.js)
//   fields: farmland colours, for the low, gentle land outside the woods (none: woods and scrub all over)
//   trees: [kind, share, dark colour, light colour]; kinds: pine, stone (umbrella pine), broad, conifer, cypress,
//     palm, eucalypt, olive, shrub
//   clearing: what is between the woods where the venue has no fields: 'scrub' (the maquis, garrigue or fynbos;
//     when not given), 'grass' (a city's parks, a northern meadow) or 'rock' (bare, glacier-smoothed, heath in its
//     hollows)
//   coast: what the shore is along the water where the map has no beach: shingle when not given, 'rock' (bare,
//     wave-washed: a granite or limestone coast; always so where the clearings are rock)
//   treeTop: how high the trees go, metres; woods: how much of the land is wooded (0 to 1); snow: the snow line on
//     the mountains beyond, metres (2900 when not given)
//   walls, roofs: the houses; flat: the share of flat roofs; towers: the walls of the tall ones (20 m and up, or
//     tall: from how many metres), when not glass and concrete (skopea.js); fill: 0, no houses made up where the map
//     has none
//   boats: the moored boats' shares (sail, motor, big) and what the big ones are (gulet or super)
//   haze: how clear the venue's air is, how far its land is seen through the haze (1 as usual, more is clearer)
//   water: the sea's own colours (deep, scatter) and how far towards them (0 to 1); over the shallows, the colour
//     the bed gives it (shallow) and how clearly (clear, 0 to 1)
const MED = { walls: ['#f3eee4', '#efe6d2', '#f6f2ea', '#e9dcc0', '#f1e3c8', '#ffffff'], roofs: ['#b4603e', '#a5543a', '#c0704a', '#9c4f37'] };

export const VENUES = [
  {
    id: 'gocek', name: ['Göcek', 'Гёчек', 'Göcek', 'Göcek', 'Göcek'], lat: 36.7525, lon: 28.9395, wind: 195, tz: 3,
    look: {
      haze: 1.1,
      ground: { forest: ['#283d21', '#36502b', '#4e6535'], scrub: '#7b7d55', rock: ['#9a917c', '#7b7465'], town: '#a19a84', shore: '#a39a86' },
      trees: [['pine', 1, '#2c4224', '#566d3a']], treeTop: 650, woods: 1, coast: 'rock', ...MED, flat: 0.45,
      water: { shallow: '#3fae9e', clear: 0.55 },
      boats: { sail: 0.65, motor: 0.28, big: 0.07, bigKind: 'gulet' },
    },
  },
  {
    id: 'cowes', name: ['Cowes', 'Каус', 'Cowes', 'Cowes', 'Cowes'], lat: 50.788, lon: -1.306, wind: 225, tz: 1, stream: ['tide', 75, 1.1],
    look: {
      haze: 0.85,
      ground: { forest: ['#2f4a26', '#3e5d2e', '#557a3a'], scrub: '#6f8a4a', rock: ['#a59d86', '#8a8473'], town: '#9c8f80', shore: '#b9ab8a' },
      fields: ['#6f9a45', '#7fa64e', '#8fae55', '#a8b866', '#c2b46a', '#5f8c3e'],
      trees: [['broad', 0.85, '#2f4a26', '#5d7f3a'], ['conifer', 0.15, '#243b22', '#3a5530']], treeTop: 400, woods: 0.45,
      walls: ['#a0573f', '#b5684c', '#ece3cf', '#f2efe8', '#d8cdb8', '#8f4c38'], roofs: ['#4f565c', '#5c6266', '#6b4a3e', '#7a4636'], flat: 0.15,
      boats: { sail: 0.78, motor: 0.22, big: 0 },
      water: { deep: '#0d2c33', scatter: '#2e7f72', k: 0.55, shallow: '#5f8a6c', clear: 0.25 },
    },
  },
  {
    id: 'newport', name: ['Newport', 'Ньюпорт', 'Newport', 'Newport', 'Newport'], lat: 41.457, lon: -71.36, wind: 210, tz: -4, stream: ['tide', 340, 0.8],
    look: {
      haze: 0.95,
      ground: { forest: ['#2b4526', '#3a5a2f', '#557539'], scrub: '#7a8a52', rock: ['#8e8a80', '#6f6c66'], town: '#9a968c', shore: '#a8a090' },
      fields: ['#6a9446', '#7a9f4c', '#8aa858', '#9cae62'],
      trees: [['broad', 0.75, '#2b4526', '#58793a'], ['conifer', 0.25, '#22381f', '#36502c']], treeTop: 400, woods: 0.55,
      walls: ['#e8e8e2', '#c9ccc8', '#8e9ea8', '#b8ab92', '#f3f1ea', '#7a8a96'], roofs: ['#4a4d50', '#5b5249', '#3f4448', '#6a5e52'], flat: 0.1,
      boats: { sail: 0.75, motor: 0.25, big: 0 },
      water: { deep: '#0a2a38', scatter: '#24806f', k: 0.45, shallow: '#4f8a7a', clear: 0.3 },
    },
  },
  {
    id: 'sydney', name: ['Sydney', 'Сидней', 'Sídney', 'Sydney', 'Sidney'], lat: -33.848, lon: 151.256, wind: 45, tz: 11, stream: ['tide', 225, 0.6],
    look: {
      haze: 1.15,
      ground: { forest: ['#3a4a2c', '#4d5c37', '#6b7547'], scrub: '#7f7f58', rock: ['#c9a878', '#a8865c'], town: '#a8988a', shore: '#d8c49a' },
      trees: [['eucalypt', 0.7, '#4a5a3a', '#7d8a62'], ['broad', 0.2, '#304a28', '#557038'], ['palm', 0.1, '#3d5a2c', '#5f7a3a']], treeTop: 300, woods: 0.7,
      walls: ['#e6d6bd', '#b0644a', '#f2eee6', '#d9c3a0', '#c8785a', '#ffffff'], roofs: ['#a84f36', '#93452f', '#7b8287', '#5f666b'], flat: 0.3,
      boats: { sail: 0.7, motor: 0.3, big: 0 },
      water: { deep: '#062c46', scatter: '#1a8fa0', k: 0.4, shallow: '#3f9e94', clear: 0.4 },
    },
  },
  {
    id: 'kiel', name: ['Kiel', 'Киль', 'Kiel', 'Kiel', 'Kiel'], lat: 54.43, lon: 10.205, wind: 250, tz: 2, thermal: false,
    look: {
      haze: 0.9,
      ground: { forest: ['#2a4424', '#38582c', '#4f7236'], scrub: '#6f8a48', rock: ['#a49c88', '#8c8676'], town: '#8f7f74', shore: '#cbbd98' },
      fields: ['#6f9a45', '#87a94d', '#b9b25c', '#d1bb5e', '#5d8a3c', '#9cb256'],
      trees: [['broad', 0.8, '#2a4424', '#557a3a'], ['conifer', 0.2, '#203a20', '#34502c']], treeTop: 300, woods: 0.35,
      walls: ['#9a4a3a', '#b5654a', '#eeeae2', '#a85c45', '#d9d2c4', '#8a4334'], roofs: ['#5a3a33', '#7a3b2e', '#555a5e', '#8a4a38'], flat: 0.25,
      boats: { sail: 0.85, motor: 0.15, big: 0 },
      water: { deep: '#0b2a33', scatter: '#2a7a6e', k: 0.6, shallow: '#5a8a70', clear: 0.25 },
    },
  },
  {
    id: 'trieste', name: ['Trieste', 'Триест', 'Trieste', 'Triest', 'Trieste'], lat: 45.672, lon: 13.728, wind: 70, tz: 2, anchored: 4, thermal: false,
    look: {
      haze: 1.1,
      ground: { forest: ['#33482a', '#46602f', '#5f7a3c'], scrub: '#7f8656', rock: ['#c8c2b2', '#a7a090'], town: '#b0a48e', shore: '#c9c1ad' },
      trees: [['broad', 0.6, '#33482a', '#62803e'], ['conifer', 0.2, '#28401f', '#3c5a2c'], ['cypress', 0.2, '#25391f', '#3a5230']], treeTop: 600, woods: 0.75,
      walls: ['#efe3c8', '#e6d2a8', '#f2ebe0', '#d9c39b', '#eadbc0', '#f6f1e6'], roofs: ['#b4603e', '#a5543a', '#9a5a44', '#c0704a'], flat: 0.2,
      boats: { sail: 0.8, motor: 0.2, big: 0 },
      water: { deep: '#07304a', scatter: '#1d9496', k: 0.3, shallow: '#3fa49a', clear: 0.45 },
    },
  },
  {
    id: 'porto-cervo', name: ['Porto Cervo', 'Порто-Черво', 'Porto Cervo', 'Porto Cervo', 'Porto Cervo'], lat: 41.152, lon: 9.565, wind: 315, tz: 2, thermal: false,
    look: {
      haze: 1.35,
      ground: { forest: ['#3e4d2c', '#4f5f34', '#68743f'], scrub: '#7c7a50', rock: ['#c4a58c', '#a08670'], town: '#c2a88a', shore: '#d8c3a4' },
      trees: [['shrub', 0.75, '#3e4d2c', '#6a7640'], ['olive', 0.15, '#56603e', '#7f8660'], ['stone', 0.1, '#33482a', '#4f6634']], treeTop: 700, woods: 0.6, coast: 'rock',
      walls: ['#e8c7a0', '#e3b58f', '#efe2cc', '#f2d9b8', '#d9a87c', '#f6efe2'], roofs: ['#b4603e', '#a5543a', '#c0704a', '#9c4f37'], flat: 0.15,
      boats: { sail: 0.55, motor: 0.3, big: 0.15, bigKind: 'super' },
      water: { deep: '#03304e', scatter: '#14b3aa', k: 0.5, shallow: '#38c4b4', clear: 0.75 },
    },
  },
  {
    id: 'saint-tropez', name: ['Saint-Tropez', 'Сен-Тропе', 'Saint-Tropez', 'Saint-Tropez', 'Saint-Tropez'], lat: 43.29, lon: 6.67, wind: 280, tz: 2, thermal: false,
    look: {
      haze: 1.15,
      ground: { forest: ['#2e4626', '#3f5a2e', '#5a733a'], scrub: '#7a7c52', rock: ['#a69a84', '#857b6a'], town: '#b3a088', shore: '#cdbb98' },
      fields: ['#6a7f3c', '#7c8a44', '#8c9a4c', '#9a8e52'],
      trees: [['stone', 0.45, '#2e4626', '#4f6834'], ['pine', 0.25, '#2c4224', '#566d3a'], ['cypress', 0.1, '#25391f', '#3a5230'], ['shrub', 0.2, '#3e4d2c', '#6a7640']], treeTop: 700, woods: 0.75,
      walls: ['#efd9b0', '#f0c99a', '#e9b98f', '#f6efe2', '#f2e2c4', '#e3c28e'], roofs: MED.roofs, flat: 0.1,
      boats: { sail: 0.55, motor: 0.3, big: 0.15, bigKind: 'super' },
      water: { deep: '#05304a', scatter: '#1aa3a0', k: 0.2, shallow: '#3fb2a6', clear: 0.55 },
    },
  },
  {
    id: 'antigua', name: ['Antigua', 'Антигуа', 'Antigua', 'Antigua', 'Antigua'], lat: 16.989, lon: -61.77, wind: 95, tz: -4, stream: ['flow', 290, 0.5],
    look: {
      haze: 1.6,
      ground: { forest: ['#3c5a2a', '#4f7032', '#6a8a3e'], scrub: '#8a8a52', rock: ['#a8957a', '#86765f'], town: '#b9a88e', shore: '#eadcb8' },
      trees: [['shrub', 0.45, '#3c5a2a', '#6f8c40'], ['broad', 0.3, '#335226', '#5a7c34'], ['palm', 0.25, '#3d5a2c', '#6a8a3a']], treeTop: 450, woods: 0.85,
      walls: ['#f2d58a', '#9fd3c7', '#f1a7a1', '#f5f0e1', '#a8c8e8', '#f6e7c6'], roofs: ['#b0412e', '#3d6b4a', '#e8e4dc', '#9a3b2a'], flat: 0.2,
      boats: { sail: 0.6, motor: 0.25, big: 0.15, bigKind: 'super' },
      water: { deep: '#033a5c', scatter: '#18c2bb', k: 0.65, shallow: '#3fd0c4', clear: 0.8 },
    },
  },
  {
    id: 'auckland', name: ['Auckland', 'Окленд', 'Auckland', 'Auckland', 'Auckland'], lat: -36.83, lon: 174.815, wind: 225, tz: 13, thermal: false, stream: ['tide', 230, 1.0],
    look: {
      haze: 1.2,
      ground: { forest: ['#24401f', '#335229', '#4a6b34'], scrub: '#6b7a44', rock: ['#5d5a55', '#45433f'], town: '#9a948a', shore: '#b8a888' },
      fields: ['#5f9a40', '#6fa648', '#7fae50', '#5a8c3a'],
      trees: [['broad', 0.6, '#24401f', '#4c6e34'], ['conifer', 0.25, '#1f381d', '#33502a'], ['palm', 0.15, '#2f4a24', '#4f6e30']], treeTop: 400, woods: 0.55,
      walls: ['#f3f1ea', '#e6e2d6', '#c9d2d6', '#e8d9b8', '#b8c4c9', '#ffffff'], roofs: ['#8a3b33', '#3d5a6b', '#5d6a5a', '#7e8489'], flat: 0.25,
      boats: { sail: 0.75, motor: 0.25, big: 0 },
      water: { deep: '#082c3c', scatter: '#228a86', k: 0.45, shallow: '#4f9a86', clear: 0.3 },
    },
  },
  {
    id: 'san-francisco', name: ['San Francisco', 'Сан-Франциско', 'San Francisco', 'San Francisco', 'San Francisco'], lat: 37.815, lon: -122.435, wind: 255, tz: -7, anchored: 2, stream: ['tide', 85, 1.2],
    look: {
      haze: 0.8,
      ground: { forest: ['#33452a', '#465a33', '#617040'], scrub: '#9a9460', rock: ['#9a9284', '#7a7366'], town: '#b0a89a', shore: '#b8ad94' },
      fields: ['#a89a5c', '#b8a868', '#8f9a58', '#c2b070'],
      trees: [['conifer', 0.4, '#26401f', '#3c5a2c'], ['eucalypt', 0.35, '#4a5a3a', '#7d8a62'], ['broad', 0.25, '#33482a', '#5a733a']], treeTop: 500, woods: 0.45,
      walls: ['#f2efe6', '#e8e0cc', '#d9d4c8', '#c9d3d8', '#efe6d2', '#e6d9c0'], roofs: ['#6f6a64', '#8a8076', '#a85a40', '#5d6266'], flat: 0.55,
      boats: { sail: 0.75, motor: 0.25, big: 0 },
      water: { deep: '#0b2f3c', scatter: '#2a7f7a', k: 0.5, shallow: '#5a8a7a', clear: 0.2 },
    },
  },
  {
    id: 'valencia', name: ['Valencia', 'Валенсия', 'Valencia', 'Valencia', 'Valensiya'], lat: 39.455, lon: -0.285, wind: 110, tz: 2, anchored: 4,
    look: {
      haze: 1.0,
      ground: { forest: ['#3a5229', '#4c6a30', '#66823c'], scrub: '#8a8a58', rock: ['#b8a888', '#9a8a6c'], town: '#bba98e', shore: '#e0cfa4' },
      fields: ['#4f7a30', '#5f8a38', '#6a9440', '#a8a060', '#8a9a50'],
      trees: [['broad', 0.45, '#335226', '#5a7c34'], ['palm', 0.3, '#3d5a2c', '#6a8a3a'], ['stone', 0.25, '#2e4626', '#4f6834']], treeTop: 600, woods: 0.35,
      walls: ['#f2e6cc', '#efd9b0', '#f6f1e6', '#e3cfa8', '#f0dfc0', '#e8d5b5'], roofs: ['#b4603e', '#a5543a', '#9c4f37', '#8a8e90'], flat: 0.6,
      boats: { sail: 0.6, motor: 0.3, big: 0.1, bigKind: 'super' },
      water: { deep: '#06304a', scatter: '#1d8a8c', k: 0.35, shallow: '#4f8e84', clear: 0.22 }, // (a sandy bed under greener water than the islands')
    },
  },
  {
    id: 'barcelona', name: ['Barcelona', 'Барселона', 'Barcelona', 'Barcelona', 'Barselona'], lat: 41.372, lon: 2.225, wind: 200, tz: 2, anchored: 3,
    look: {
      haze: 0.9,
      ground: { forest: ['#33482a', '#46602f', '#5f7a3c'], scrub: '#7f8656', rock: ['#b4a890', '#958a74'], town: '#b8a890', shore: '#dcc9a0' },
      trees: [['stone', 0.45, '#2e4626', '#4f6834'], ['broad', 0.35, '#33482a', '#5a7838'], ['palm', 0.2, '#3d5a2c', '#6a8a3a']], treeTop: 600, woods: 0.7,
      walls: ['#e8d9bc', '#dcc7a2', '#f2ebdc', '#cdb48c', '#e6d2b0', '#f6f1e6'], roofs: ['#b4603e', '#a5543a', '#8a8e90', '#9c4f37'], flat: 0.7,
      boats: { sail: 0.6, motor: 0.3, big: 0.1, bigKind: 'super' },
      water: { deep: '#05304a', scatter: '#1a9a9a', k: 0.25, shallow: '#4aa498', clear: 0.4 },
    },
  },
  {
    id: 'palma', name: ['Palma', 'Пальма', 'Palma', 'Palma', 'Palma'], lat: 39.535, lon: 2.63, wind: 220, tz: 2,
    look: {
      haze: 1.2,
      ground: { forest: ['#33482a', '#46602f', '#5f7a3c'], scrub: '#868a58', rock: ['#c4b49a', '#a3937a'], town: '#bfae92', shore: '#e2d2ac' },
      fields: ['#7a8a48', '#8c9650', '#a39a5c', '#6a7f3c'],
      trees: [['stone', 0.35, '#2e4626', '#4f6834'], ['olive', 0.35, '#56603e', '#7f8660'], ['shrub', 0.2, '#3e4d2c', '#6a7640'], ['palm', 0.1, '#3d5a2c', '#6a8a3a']], treeTop: 900, woods: 0.6,
      walls: ['#f0dfbe', '#e8cfa2', '#f6efe0', '#dcc49a', '#efe2c8', '#e9d6b2'], roofs: ['#b4603e', '#a5543a', '#c0704a', '#9c4f37'], flat: 0.45,
      boats: { sail: 0.6, motor: 0.25, big: 0.15, bigKind: 'super' },
      water: { deep: '#04324e', scatter: '#16aaa6', k: 0.4, shallow: '#3cbcb0', clear: 0.65 },
    },
  },
  {
    id: 'marstrand', name: ['Marstrand', 'Марстранд', 'Marstrand', 'Marstrand', 'Marstrand'], lat: 57.885, lon: 11.555, wind: 225, tz: 2, stream: ['flow', 15, 0.4],
    look: {
      haze: 1.15,
      // (Bohuslän granite: pinkish grey, not sand)
      ground: { forest: ['#2c4224', '#3b5530', '#566d3a'], scrub: '#6f7556', rock: ['#a09896', '#78706e'], town: '#9c8a80', shore: '#948c89' },
      trees: [['conifer', 0.55, '#22381f', '#36502c'], ['broad', 0.3, '#33502a', '#5a7838'], ['shrub', 0.15, '#4a5a34', '#6f7a48']], treeTop: 200, woods: 0.35, clearing: 'rock',
      walls: ['#8b2d23', '#a03a2c', '#f4f2ec', '#e8e2d0', '#d8c79a', '#7a2a22'], roofs: ['#3f3a38', '#5a3a33', '#8a3b2e', '#4a4d50'], flat: 0.05,
      boats: { sail: 0.85, motor: 0.15, big: 0 },
      water: { deep: '#0a2a36', scatter: '#24706c', k: 0.6, shallow: '#4f8a7c', clear: 0.3 },
    },
  },
  {
    id: 'bermuda', name: ['Bermuda', 'Бермуды', 'Bermudas', 'Bermuda', 'Bermuda'], lat: 32.305, lon: -64.84, wind: 200, tz: -3,
    look: {
      haze: 1.6,
      ground: { forest: ['#2f4a26', '#3f6030', '#5a7a3a'], scrub: '#7a8a50', rock: ['#c9bba0', '#a89a80'], town: '#c8bca8', shore: '#efdcc4' },
      trees: [['broad', 0.4, '#2f4a26', '#56783a'], ['palm', 0.3, '#3d5a2c', '#6a8a3a'], ['cypress', 0.3, '#25391f', '#3a5230']], treeTop: 100, woods: 0.7,
      walls: ['#f6c9c4', '#bfe0e8', '#f7e3a6', '#c9e6c4', '#f4f1ea', '#e8c8e0'], roofs: ['#f6f6f2', '#efefea', '#f2f2ee', '#e8e8e2'], flat: 0,
      boats: { sail: 0.7, motor: 0.25, big: 0.05, bigKind: 'super' },
      water: { deep: '#03385a', scatter: '#16c0c0', k: 0.65, shallow: '#48d6c8', clear: 0.85 },
    },
  },
  {
    id: 'enoshima', name: ['Enoshima', 'Эносима', 'Enoshima', 'Enoshima', 'Enoshima'], lat: 35.285, lon: 139.495, wind: 190, tz: 9,
    look: {
      haze: 0.85,
      ground: { forest: ['#1f3a1e', '#2c4a26', '#43622f'], scrub: '#6a7a48', rock: ['#8e8a7e', '#6f6b62'], town: '#a09c94', shore: '#a89f8c' },
      trees: [['broad', 0.55, '#1f3a1e', '#3f5e2c'], ['conifer', 0.3, '#1c331b', '#2f4a28'], ['pine', 0.15, '#26401f', '#45602f']], snow: 3300, treeTop: 400, woods: 0.9,
      walls: ['#eeece6', '#d9d6ce', '#c8c4ba', '#e6e0d2', '#b9b4aa', '#f4f2ee'], roofs: ['#3e4752', '#4a4d50', '#2f3a46', '#6a6e72'], flat: 0.35,
      boats: { sail: 0.7, motor: 0.3, big: 0 },
      water: { deep: '#062c42', scatter: '#1f8a90', k: 0.4, shallow: '#4a9a8c', clear: 0.3 },
    },
  },
  {
    id: 'weymouth', name: ['Weymouth', 'Уэймут', 'Weymouth', 'Weymouth', 'Weymouth'], lat: 50.605, lon: -2.41, wind: 225, tz: 1, stream: ['tide', 60, 0.5],
    look: {
      haze: 0.9,
      ground: { forest: ['#2f4a26', '#3e5d2e', '#557a3a'], scrub: '#7a9050', rock: ['#d4ccb4', '#b4aa92'], town: '#a8988a', shore: '#cfc2a0' },
      fields: ['#6f9a45', '#7fa64e', '#8fae55', '#a8b866', '#c2b46a', '#5f8c3e'],
      trees: [['broad', 0.9, '#2f4a26', '#5d7f3a'], ['conifer', 0.1, '#243b22', '#3a5530']], treeTop: 400, woods: 0.3,
      walls: ['#e9dfc8', '#d9ccae', '#f2efe8', '#c8b894', '#a0573f', '#ece3cf'], roofs: ['#4f565c', '#5c6266', '#6b4a3e', '#7a4636'], flat: 0.15,
      boats: { sail: 0.8, motor: 0.2, big: 0 },
      water: { deep: '#0b2e38', scatter: '#2a8278', k: 0.5, shallow: '#4f9484', clear: 0.3 },
    },
  },
  {
    id: 'marseille', name: ['Marseille', 'Марсель', 'Marsella', 'Marseille', 'Marsilya'], lat: 43.265, lon: 5.335, wind: 315, tz: 2, anchored: 2, thermal: false,
    look: {
      haze: 1.2,
      ground: { forest: ['#3a4c2c', '#4a5e34', '#647440'], scrub: '#8a8a5c', rock: ['#d8d2c2', '#b8b0a0'], town: '#c2b8a6', shore: '#d6cfbe' },
      trees: [['pine', 0.4, '#2c4224', '#566d3a'], ['shrub', 0.45, '#3e4d2c', '#6a7640'], ['stone', 0.15, '#2e4626', '#4f6834']], treeTop: 600, woods: 0.45, coast: 'rock',
      walls: ['#efe3c8', '#e6d2a8', '#f2ebe0', '#d9c39b', '#eadbc0', '#f6f1e6'], roofs: ['#b4603e', '#a5543a', '#c0704a', '#9c4f37'], flat: 0.3,
      boats: { sail: 0.75, motor: 0.25, big: 0 },
      water: { deep: '#04304c', scatter: '#18a6a8', k: 0.35, shallow: '#3cb4aa', clear: 0.6 },
    },
  },
  {
    id: 'rio', name: ['Rio de Janeiro', 'Рио-де-Жанейро', 'Río de Janeiro', 'Rio de Janeiro', 'Rio de Janeiro'], lat: -22.93, lon: -43.158, wind: 150, tz: -3, anchored: 4, stream: ['tide', 35, 0.8],
    look: {
      haze: 0.9,
      ground: { forest: ['#1c3a1a', '#284d22', '#3c642c'], scrub: '#5f7a3c', rock: ['#8a8680', '#6a6660'], town: '#b4aca0', shore: '#e4d6b0' },
      trees: [['broad', 0.7, '#1c3a1a', '#3c642c'], ['palm', 0.2, '#2f4a24', '#557a34'], ['eucalypt', 0.1, '#3a4a30', '#5f6e48']], treeTop: 900, woods: 0.95,
      walls: ['#f2efe6', '#e6dfcf', '#d6dde0', '#f1e2c4', '#e8d0c0', '#c9d6c8'], roofs: ['#a84f36', '#93452f', '#7b8287', '#5f666b'], flat: 0.6,
      boats: { sail: 0.65, motor: 0.35, big: 0 },
      water: { deep: '#073044', scatter: '#228a86', k: 0.45, shallow: '#4aa494', clear: 0.35 },
    },
  },
  {
    id: 'garda', name: ['Lake Garda', 'Озеро Гарда', 'Lago de Garda', 'Gardasee', 'Garda Gölü'], lat: 45.84, lon: 10.85, wind: 190, tz: 2,
    look: {
      haze: 1.0,
      ground: { forest: ['#2c4524', '#3c5a2c', '#557236'], scrub: '#7c8452', rock: ['#b8b2a2', '#958f80'], town: '#b0a48c', shore: '#bdb3a0' },
      trees: [['broad', 0.45, '#2c4524', '#58773a'], ['olive', 0.2, '#56603e', '#7f8660'], ['cypress', 0.2, '#25391f', '#3a5230'], ['conifer', 0.15, '#22381f', '#36502c']], snow: 2700, treeTop: 1500, woods: 0.7,
      walls: ['#efe3c8', '#f0d6a8', '#e9c9a0', '#f6f1e6', '#eedbb8', '#e2c08e'], roofs: MED.roofs, flat: 0.1,
      boats: { sail: 0.85, motor: 0.15, big: 0 },
      water: { deep: '#073046', scatter: '#249896', k: 0.45, shallow: '#4aa69a', clear: 0.45 },
    },
  },
  {
    id: 'istanbul', name: ['Istanbul', 'Стамбул', 'Estambul', 'Istanbul', 'İstanbul'], lat: 40.982, lon: 28.992, wind: 35, tz: 3, anchored: 6, thermal: false, stream: ['flow', 185, 1.0], runs: true,
    look: {
      haze: 0.8,
      ground: { forest: ['#2e4626', '#3f5a2e', '#5a733a'], scrub: '#7c7e54', rock: ['#b0a690', '#8f8674'], town: '#b2a692', shore: '#bfb39a' },
      trees: [['stone', 0.35, '#2e4626', '#4f6834'], ['broad', 0.4, '#33482a', '#5a7838'], ['cypress', 0.25, '#25391f', '#3a5230']], treeTop: 250, woods: 0.35, clearing: 'grass',
      walls: ['#efe6d2', '#e8dcc4', '#f4f1ea', '#d9c8a8', '#e6d0b8', '#c9c4ba'], roofs: ['#b4603e', '#a5543a', '#9c4f37', '#7e7f80'], flat: 0.45,
      towers: ['#e6dfd0', '#d8d0bf', '#ece6da', '#d2cbbd', '#dfd4c0', '#c8ccce'], // blocks of flats, pale concrete and cream
      boats: { sail: 0.55, motor: 0.35, big: 0.1, bigKind: 'super' },
      water: { deep: '#0a2e40', scatter: '#24868a', k: 0.45, shallow: '#4a9a8e', clear: 0.3 },
    },
  },
  {
    // the Neva under the Peter and Paul Fortress's walls, in the westerly off the Gulf of Finland; today's race comes
    // here from its `from` day (dailyVenue)
    id: 'st-petersburg', name: ['St Petersburg', 'Санкт-Петербург', 'San Petersburgo', 'Sankt Petersburg', 'Sankt Petersburg'], lat: 59.9464, lon: 30.3187, wind: 245, tz: 3, thermal: false, stream: ['flow', 235, 0.9], runs: true, from: '2026-11-20',
    // the river is too narrow for the triangle's wing mark, and the long course's beat (the medium wind's, some 900 m
    // and wide) has no reach of it between two of the bridges, too low for a mast
    skip: ['tri:medium', 'tri:long', 'long'],
    look: {
      haze: 0.8,
      ground: { forest: ['#2b4126', '#3a5530', '#4f6c3a'], scrub: '#6c7d4c', rock: ['#a0968d', '#857c74'], town: '#9a948b', shore: '#9d948b', grass: '#5f7d45' },
      trees: [['broad', 0.85, '#2b4126', '#557338'], ['conifer', 0.15, '#22371f', '#344f2b']], treeTop: 120, woods: 0.3, clearing: 'grass',
      // the city's stucco: ochre, pale pink, cream, the Winter Palace's green, grey and white; its roofs painted iron,
      // most of them, whatever their shape; and its palaces 20 to 30 m high, stucco like the rest (a tower from 45 m:
      // the few modern ones)
      walls: ['#e2c27c', '#e4b9a4', '#efe3c9', '#8fb7a0', '#c9c4ba', '#f1ede4', '#d9a77e', '#c7d0cc'], roofs: ['#7e4a3a', '#6b7672', '#5a5f60', '#4f6a5c', '#8a5440'], flat: 0.25, tall: 45,
      fill: 0, // every house is on the map: none made up in its squares and courtyards
      boats: { sail: 0.55, motor: 0.45, big: 0 },
      water: { deep: '#1b313a', scatter: '#3b625f', k: 0.55, shallow: '#4a5446', clear: 0.08 },
    },
  },
  // the five below join today's races with St Petersburg, on its `from` day
  {
    // Batumi bay in the Black Sea's afternoon breeze: the city and the Alphabetic Tower on the cape to the left, the
    // coast to Green Cape and the wooded mountains of Adjara to the right
    id: 'batumi', name: ['Batumi', 'Батуми', 'Batumi', 'Batumi', 'Batum'], lat: 41.672, lon: 41.68, wind: 290, tz: 4, anchored: 3, stream: ['flow', 55, 0.4], from: '2026-11-20',
    look: {
      haze: 0.85,
      ground: { forest: ['#264222', '#355a2c', '#4d7238'], scrub: '#6f7f4c', rock: ['#a49c8a', '#857d6e'], town: '#9c9b8c', shore: '#9b968d', sand: '#9b968d', grass: '#5a7a38' }, // the beaches are grey pebbles; the subtropical town green round its houses
      trees: [['broad', 0.6, '#264222', '#4f7a36'], ['palm', 0.15, '#2f4a26', '#5a7a3a'], ['conifer', 0.1, '#22381f', '#36502c'], ['cypress', 0.15, '#25391f', '#3a5230']], treeTop: 1400, woods: 0.75, snow: 2600,
      walls: ['#efe8da', '#e6dccb', '#f4f1ea', '#d9cdb6', '#e9d8c2', '#c9c4ba'], roofs: ['#a5543a', '#8c4a36', '#6f7478', '#7e7f80'], flat: 0.6,
      boats: { sail: 0.3, motor: 0.6, big: 0.1, bigKind: 'super' },
      water: { deep: '#0e2c3c', scatter: '#2a6e78', k: 0.5, shallow: '#4a7f78', clear: 0.15 },
    },
  },
  {
    // the North Sea off Scheveningen's beach, the pier and the Kurhaus, in the south-westerly along the dunes
    id: 'scheveningen', name: ['Scheveningen', 'Схевенинген', 'Scheveningen', 'Scheveningen', 'Scheveningen'], lat: 52.1228, lon: 4.2662, wind: 225, tz: 2, anchored: 4, stream: ['tide', 30, 1.0], from: '2026-11-20',
    look: {
      haze: 0.8,
      ground: { forest: ['#2e4428', '#3f5a32', '#57703f'], scrub: '#7d8058', rock: ['#a49e90', '#87827a'], town: '#9a9088', shore: '#d8cba8', sand: '#e0d3b0', grass: '#6f8a4a' },
      fields: ['#6f9a45', '#7fa64e', '#8fae55', '#5f8c3e'],
      trees: [['broad', 0.6, '#2e4428', '#5a7a3c'], ['conifer', 0.4, '#243b22', '#3a5530']], treeTop: 40, woods: 0.25,
      walls: ['#8a4a36', '#9c5a42', '#a86c50', '#7d4232', '#ece6da', '#c9b9a0'], roofs: ['#4a4e52', '#5a5e62', '#a5543a', '#7e4a3a'], flat: 0.55,
      boats: { sail: 0.5, motor: 0.4, big: 0.1, bigKind: 'super' },
      water: { deep: '#2a4044', scatter: '#4f7468', k: 0.6, shallow: '#7a8a6c', clear: 0.05 },
    },
  },
  {
    // Victoria Harbour between Wan Chai and Tsim Sha Tsui, in the easterly: the towers on both shores, the Peak above
    id: 'hong-kong', name: ['Hong Kong', 'Гонконг', 'Hong Kong', 'Hongkong', 'Hong Kong'], lat: 22.2884, lon: 114.1781, wind: 80, tz: 8, anchored: 3, stream: ['tide', 80, 1.0], from: '2026-11-20',
    look: {
      haze: 0.7,
      ground: { forest: ['#24401f', '#33572a', '#4b7034'], scrub: '#5f7a42', rock: ['#9a9488', '#7b766c'], town: '#9c9890', shore: '#a29c90' },
      trees: [['broad', 0.85, '#24401f', '#4b7a34'], ['palm', 0.15, '#2f4a26', '#5a7a3a']], treeTop: 950, woods: 0.9, coast: 'rock',
      walls: ['#dcdad4', '#cfcac0', '#e8e4dc', '#bfc4c6', '#d6cfc0', '#e6e0d0'], roofs: ['#7e7f80', '#6f7478'], flat: 0.95,
      fill: 0, // every tower is on the map: none made up
      boats: { sail: 0.3, motor: 0.6, big: 0.1, bigKind: 'super' },
      water: { deep: '#123a44', scatter: '#2f6e6a', k: 0.55, shallow: '#4f7a6a', clear: 0.08 },
    },
  },
  {
    // Table Bay off the V&A Waterfront, in the south-easterly Cape Doctor, Table Mountain to windward
    id: 'cape-town', name: ['Cape Town', 'Кейптаун', 'Ciudad del Cabo', 'Kapstadt', 'Cape Town'], lat: -33.8978, lon: 18.4556, wind: 160, tz: 2, anchored: 4, thermal: false, from: '2026-11-20',
    look: {
      haze: 1.15,
      ground: { forest: ['#2f4428', '#41583a', '#5a7046'], scrub: '#7a7a52', rock: ['#a39d92', '#7f7a72'], town: '#aaa498', shore: '#d9d0bc', sand: '#e6dcc4' },
      trees: [['stone', 0.4, '#2f4428', '#55703f'], ['eucalypt', 0.3, '#4a5a3a', '#7d8a62'], ['shrub', 0.3, '#5a6a42', '#7f8a5c']], treeTop: 700, woods: 0.3, coast: 'rock',
      walls: ['#f3eee4', '#efe6d2', '#ffffff', '#e9dcc0', '#d9d0c0', '#c9c4ba'], roofs: ['#7e7f80', '#a5543a', '#5a5f60', '#9c4f37'], flat: 0.5,
      boats: { sail: 0.55, motor: 0.35, big: 0.1, bigKind: 'super' },
      water: { deep: '#0b2f45', scatter: '#1f7a86', k: 0.45, shallow: '#3f8f8a', clear: 0.3 },
    },
  },
  {
    // the 2004 Olympic waters in Faliro Bay, in the meltemi off the land, the Parthenon on the Acropolis to windward
    id: 'athens', name: ['Athens', 'Афины', 'Atenas', 'Athen', 'Atina'], lat: 37.9115, lon: 23.6765, wind: 30, tz: 3, anchored: 5, thermal: false, from: '2026-11-20',
    look: {
      haze: 1.2, // the meltemi's clear air: the Acropolis and Hymettus seen across the bay
      ground: { forest: ['#3a4a2c', '#4c5e36', '#66763f'], scrub: '#8a8458', rock: ['#c2b8a2', '#a09684'], town: '#c4bba8', shore: '#c8bca2' },
      trees: [['pine', 0.6, '#33472a', '#5a6e3a'], ['olive', 0.25, '#56603e', '#7f8660'], ['cypress', 0.15, '#25391f', '#3a5230']], treeTop: 1000, woods: 0.35,
      walls: ['#f3eee4', '#efe9dc', '#f6f2ea', '#e9dcc0', '#e6e2da', '#ffffff'], roofs: MED.roofs, flat: 0.85,
      boats: { sail: 0.55, motor: 0.35, big: 0.1, bigKind: 'super' },
      water: { deep: '#06304a', scatter: '#1d7f9a', k: 0.45, shallow: '#3faab0', clear: 0.45 },
    },
  },
  {
    // Marmaris bay in the westerly over İçmeler, the castle above the old town and Netsel's pontoons to leeward, the
    // red-pine mountains all round
    id: 'marmaris', name: ['Marmaris', 'Мармарис', 'Marmaris', 'Marmaris', 'Marmaris'], lat: 36.83, lon: 28.262, wind: 265, tz: 3, from: '2026-11-20',
    look: {
      haze: 1.15,
      ground: { forest: ['#2b4123', '#3a5430', '#536b39'], scrub: '#78794f', rock: ['#a09684', '#7f776a'], town: '#a89f8a', shore: '#b3a88f' },
      trees: [['pine', 0.8, '#2b4123', '#536b39'], ['cypress', 0.08, '#25391f', '#3a5230'], ['olive', 0.07, '#56603e', '#7f8660'], ['palm', 0.05, '#3d5a2c', '#5f7a3a']], treeTop: 750, woods: 0.95,
      ...MED, flat: 0.6,
      water: { shallow: '#3fb0a0', clear: 0.6 },
      boats: { sail: 0.6, motor: 0.26, big: 0.14, bigKind: 'gulet' },
    },
  },
  {
    // Fethiye's bay inside Şövalye island in the afternoon westerly: the town all round to leeward, the castle, the
    // theatre and the Lycian tombs over the harbour, Babadağ above
    id: 'fethiye', name: ['Fethiye', 'Фетхие', 'Fethiye', 'Fethiye', 'Fethiye'], lat: 36.634, lon: 29.11, wind: 275, tz: 3, from: '2026-11-20',
    look: {
      haze: 1.1,
      ground: { forest: ['#2d4325', '#3d5631', '#586f3c'], scrub: '#7d7c52', rock: ['#a89e8c', '#857c6e'], town: '#a89f8a', shore: '#b9ae96', sand: '#cdbfa0' },
      fields: ['#6f8a42', '#7f9548', '#5f7f3c', '#8f9a52', '#a8a466', '#c9c9c0'], // the plain's fields, citrus groves and greenhouses
      trees: [['pine', 0.7, '#2d4325', '#586f3c'], ['olive', 0.12, '#56603e', '#7f8660'], ['cypress', 0.08, '#25391f', '#3a5230'], ['palm', 0.05, '#3d5a2c', '#5f7a3a'], ['broad', 0.05, '#33482a', '#5f7a3c']],
      treeTop: 1150, woods: 0.75, snow: 3200, // (Babadağ's top bare limestone above the pines)
      ...MED, flat: 0.65,
      water: { shallow: '#40ac9e', clear: 0.5 },
      boats: { sail: 0.5, motor: 0.28, big: 0.22, bigKind: 'gulet' },
    },
  },
  // the four below join today's races with the others, on the same day
  {
    // the Black Sea off Sochi's sea terminal and its spire, in the afternoon south-westerly off the sea: the town along
    // the shore to leeward, its sanatoria, palms and cypresses, the wooded foothills and the Caucasus behind
    id: 'sochi', name: ['Sochi', 'Сочи', 'Sochi', 'Sotschi', 'Soçi'], lat: 43.564, lon: 39.697, wind: 225, tz: 3, anchored: 2, stream: ['flow', 310, 0.4], from: '2026-11-20',
    look: {
      haze: 0.9,
      ground: { forest: ['#243f20', '#33552a', '#4a6e35'], scrub: '#6c7d4a', rock: ['#a09886', '#80786a'], town: '#a09c90', shore: '#a49e93', sand: '#a49e93', grass: '#5a7a3a' }, // grey pebble beaches
      trees: [['broad', 0.6, '#243f20', '#4c7834'], ['cypress', 0.15, '#25391f', '#3a5230'], ['palm', 0.15, '#2f4a26', '#5a7a3a'], ['conifer', 0.1, '#22381f', '#36502c']], treeTop: 1300, woods: 0.85, snow: 2700,
      walls: ['#f2ede2', '#ece4d2', '#f6f3ec', '#e3d6bc', '#efe2c8', '#d6d2c8'], roofs: ['#a5543a', '#8c4a36', '#6f7478', '#5f666b'], flat: 0.55,
      boats: { sail: 0.4, motor: 0.5, big: 0.1, bigKind: 'super' },
      water: { deep: '#0d2c3e', scatter: '#287482', k: 0.5, shallow: '#4a8680', clear: 0.25 },
    },
  },
  {
    // Port Phillip off St Kilda, the waters of the 1956 Olympic regatta, in the afternoon sea breeze off Bass Strait:
    // the beaches of St Kilda and Port Melbourne to leeward, the city's towers beyond
    id: 'melbourne', name: ['Melbourne', 'Мельбурн', 'Melbourne', 'Melbourne', 'Melbourne'], lat: -37.88, lon: 144.945, wind: 200, tz: 11, anchored: 2, from: '2026-11-20',
    look: {
      haze: 1.0,
      ground: { forest: ['#3a4a2c', '#4b5c36', '#66734a'], scrub: '#7e7c56', rock: ['#a89c86', '#877d6c'], town: '#a49a8c', shore: '#d6c6a0', sand: '#ddcca4', grass: '#6f8a48' },
      fields: ['#8a9a52', '#a3a35e', '#7a8f4a', '#b8ac6a'],
      trees: [['eucalypt', 0.45, '#4a5a3a', '#7d8a62'], ['broad', 0.4, '#304a28', '#5a7a3a'], ['palm', 0.15, '#3d5a2c', '#5f7a3a']], treeTop: 200, woods: 0.25, clearing: 'grass',
      walls: ['#a85c45', '#c9b08a', '#efe9dc', '#e6dcc6', '#8f4c38', '#d9d2c4'], roofs: ['#7b8287', '#5f666b', '#a84f36', '#93452f'], flat: 0.4,
      boats: { sail: 0.75, motor: 0.25, big: 0 },
      water: { deep: '#0b3340', scatter: '#2a8a86', k: 0.45, shallow: '#5a9a88', clear: 0.3 },
    },
  },
  {
    // the Pacific off Surfers Paradise, in the easterly sea breeze: the beach and its towers to leeward, the Broadwater
    // behind them, the East Australian Current running south along the coast
    id: 'gold-coast', name: ['Gold Coast', 'Голд-Кост', 'Gold Coast', 'Gold Coast', 'Gold Coast'], lat: -28.0, lon: 153.455, wind: 90, tz: 10, stream: ['flow', 175, 0.6], from: '2026-11-20',
    look: {
      haze: 1.3,
      ground: { forest: ['#2f4a26', '#3f6030', '#5a7a3a'], scrub: '#7a8a50', rock: ['#a89a80', '#86786a'], town: '#b0a898', shore: '#eadcb8', sand: '#efe2c0', grass: '#6a8a40' },
      trees: [['palm', 0.35, '#3d5a2c', '#6a8a3a'], ['eucalypt', 0.35, '#4a5a3a', '#7d8a62'], ['broad', 0.3, '#2f4a26', '#56783a']], treeTop: 400, woods: 0.5, clearing: 'grass',
      walls: ['#f4f1ea', '#ebe5d8', '#ffffff', '#e6dccb', '#d9d4c8', '#efe6d2'], roofs: ['#7e7f80', '#a5543a', '#5a5f60', '#e8e4dc'], flat: 0.65,
      towers: ['#e8eaea', '#d8dcde', '#f2f2ee', '#c9d3d8', '#dfe4e6', '#b8c8d0'], // the beachfront's white concrete and pale glass
      boats: { sail: 0.4, motor: 0.5, big: 0.1, bigKind: 'super' },
      water: { deep: '#033a5a', scatter: '#1aa4b0', k: 0.5, shallow: '#4cc0b4', clear: 0.6 },
    },
  },
  {
    // the Upper Bay by the Statue of Liberty, in the summer's south-south-westerly up the Narrows: Lower Manhattan,
    // the Brooklyn Bridge and Jersey City to leeward, the Verrazzano-Narrows Bridge to windward
    id: 'new-york', name: ['New York', 'Нью-Йорк', 'Nueva York', 'New York', 'New York'], lat: 40.675, lon: -74.035, wind: 200, tz: -4, anchored: 3, stream: ['tide', 15, 1.2], from: '2026-11-20',
    look: {
      haze: 0.85,
      ground: { forest: ['#2b4526', '#3a5a2f', '#557539'], scrub: '#7a8a52', rock: ['#8e8a80', '#6f6c66'], town: '#8f8a82', shore: '#9a948a', grass: '#5f8040' },
      trees: [['broad', 0.85, '#2b4526', '#58793a'], ['conifer', 0.15, '#22381f', '#36502c']], treeTop: 120, woods: 0.3, clearing: 'grass',
      // brownstone, red brick, limestone and the grey of the warehouses; the city's roofs flat and tarred
      walls: ['#7a4a3a', '#9a5a44', '#d9d0bc', '#c9c4ba', '#e6e0d2', '#8a6a5a', '#b0735a'], roofs: ['#4a4d50', '#5a5f60', '#6b6e70', '#3f4448'], flat: 0.85,
      fill: 0, // every building is on the map: none made up
      boats: { sail: 0.5, motor: 0.4, big: 0.1, bigKind: 'super' },
      water: { deep: '#1d3a40', scatter: '#3a6e66', k: 0.55, shallow: '#4f6e5c', clear: 0.08 },
    },
  },
  // the ten below join today's races with the others, on the same day
  {
    // the Bay of Naples off Posillipo and the Via Caracciolo, the America's Cup's waters of 2027, in the afternoon sea
    // breeze: Castel dell'Ovo and the city climbing to Sant'Elmo to leeward, Vesuvius beyond
    id: 'naples', name: ['Naples', 'Неаполь', 'Nápoles', 'Neapel', 'Napoli'], lat: 40.806, lon: 14.232, wind: 230, tz: 2, anchored: 2, from: '2026-11-20',
    look: {
      haze: 0.95,
      ground: { forest: ['#2f4427', '#3f5831', '#5a7040'], scrub: '#78794f', rock: ['#8f8778', '#6d665c'], town: '#b0a48e', shore: '#8a8275', sand: '#6f6a60', grass: '#66803f' }, // the volcanic coast's dark sand
      fields: ['#6f8a42', '#7f9548', '#8f9a52', '#5f7f3c'],
      trees: [['stone', 0.45, '#2f4427', '#5a7040'], ['broad', 0.3, '#33482a', '#5f7a3c'], ['olive', 0.15, '#56603e', '#7f8660'], ['palm', 0.1, '#3d5a2c', '#5f7a3a']], treeTop: 1000, woods: 0.45, snow: 3200,
      // the city's yellow tufo and faded ochre, pink and pale plaster, its flat terraces
      walls: ['#e3c98f', '#dcb27e', '#e8d7b4', '#d99a78', '#efe6d2', '#c9b48e', '#e5bfa0'], roofs: ['#a5543a', '#b4603e', '#8f8a7e', '#9c4f37'], flat: 0.7,
      boats: { sail: 0.45, motor: 0.4, big: 0.15, bigKind: 'super' },
      water: { deep: '#07304c', scatter: '#1b7796', k: 0.45, shallow: '#3a9a9a', clear: 0.4 },
    },
  },
  {
    // San Pedro Bay outside the Federal Breakwater, the 2028 Olympic waters, in the afternoon westerly: the Port of Los
    // Angeles's cranes, the Queen Mary and Long Beach's towers to leeward, the Palos Verdes hills to windward
    id: 'los-angeles', name: ['Los Angeles', 'Лос-Анджелес', 'Los Ángeles', 'Los Angeles', 'Los Angeles'], lat: 33.7, lon: -118.195, wind: 255, tz: -7, anchored: 6, stream: ['tide', 290, 0.4], from: '2026-11-20',
    look: {
      haze: 0.8,
      ground: { forest: ['#46502f', '#58623a', '#6f7747'], scrub: '#8d8558', rock: ['#a89a80', '#857a68'], town: '#aaa294', shore: '#d4c7a6', sand: '#ddd0ae', grass: '#71843f' },
      trees: [['palm', 0.35, '#3d5a2c', '#6a8a3a'], ['eucalypt', 0.3, '#4a5a3a', '#7d8a62'], ['shrub', 0.2, '#5a6a42', '#7f8a5c'], ['broad', 0.15, '#3a5230', '#5f7a3c']], treeTop: 450, woods: 0.2, clearing: 'scrub',
      walls: ['#efe6d2', '#e6dac0', '#f3eee4', '#d9c9a8', '#c9c4ba', '#e8d8c0'], roofs: ['#a5543a', '#8f8678', '#6f7478', '#b4603e'], flat: 0.65,
      boats: { sail: 0.55, motor: 0.35, big: 0.1, bigKind: 'super' },
      water: { deep: '#123c4c', scatter: '#35807f', k: 0.5, shallow: '#5a9488', clear: 0.2 },
    },
  },
  {
    // the Bay of Biscay off Les Sables-d'Olonne, where the Vendée Globe starts and ends, in the westerly: the channel
    // between La Chaume's tower and the Remblai's long beach to leeward
    id: 'les-sables', name: ['Les Sables-d’Olonne', 'Ле-Сабль-д’Олон', 'Les Sables-d’Olonne', 'Les Sables-d’Olonne', 'Les Sables-d’Olonne'], lat: 46.475, lon: -1.835, wind: 285, tz: 2, anchored: 1, stream: ['tide', 330, 0.5], from: '2026-11-20',
    look: {
      haze: 0.95,
      ground: { forest: ['#2e4428', '#3f5a32', '#57703f'], scrub: '#7d8058', rock: ['#a59c8a', '#857d6e'], town: '#b3ab9c', shore: '#dccfa9', sand: '#e6d9b4', grass: '#6f8a4a' },
      fields: ['#6f9a45', '#7fa64e', '#a8a85e', '#5f8c3e', '#b9ac68'],
      trees: [['stone', 0.45, '#2e4428', '#57703f'], ['pine', 0.3, '#2b4123', '#536b39'], ['broad', 0.25, '#33482a', '#5f7a3c']], treeTop: 60, woods: 0.2, clearing: 'grass',
      // the Vendée's whitewash under low terracotta roofs, the fishermen's blue shutters' town
      walls: ['#f6f3ea', '#efe9dc', '#ffffff', '#ece4d2', '#e6dfd0'], roofs: ['#b4603e', '#c0704a', '#a5543a', '#9c4f37'], flat: 0.3,
      boats: { sail: 0.72, motor: 0.23, big: 0.05, bigKind: 'super' },
      water: { deep: '#1e4250', scatter: '#3f7f7c', k: 0.55, shallow: '#6f9a84', clear: 0.12 },
    },
  },
  {
    // the Gulf off Jumeirah in the shamal: the Burj Al Arab on its island, the Palm and the Marina's towers along the
    // shore, the World's islands offshore and the Burj Khalifa over the city
    id: 'dubai', name: ['Dubai', 'Дубай', 'Dubái', 'Dubai', 'Dubai'], lat: 25.168, lon: 55.175, wind: 315, tz: 4, anchored: 3, stream: ['tide', 230, 0.5], from: '2026-11-20',
    look: {
      haze: 0.75,
      ground: { forest: ['#4a5a34', '#5c6c3e', '#74824c'], scrub: '#b3a274', rock: ['#c7b28e', '#a8946f'], town: '#cfc3a8', shore: '#eadcb8', sand: '#e9d7ae', grass: '#7f9448' },
      trees: [['palm', 0.8, '#3d5a2c', '#6a8a3a'], ['shrub', 0.2, '#6a7446', '#8d9460']], treeTop: 80, woods: 0.05,
      walls: ['#f1ebdc', '#e8dfca', '#f6f2e8', '#d9cdb0', '#e0d4ba', '#ffffff'], roofs: ['#d8cdb4', '#c9bea4', '#b4603e', '#e8e4dc'], flat: 0.92,
      towers: ['#9fb6c4', '#b9c9d2', '#d8dee0', '#7f9bad', '#e4e4de', '#a9bcc6'], // glass and pale stone
      boats: { sail: 0.2, motor: 0.55, big: 0.25, bigKind: 'super' },
      water: { deep: '#0a4a62', scatter: '#20a4a8', k: 0.5, shallow: '#58c8b4', clear: 0.6 },
    },
  },
  {
    // Biscayne Bay off Coconut Grove, of the Bacardi Cup, in the south-easterly trade wind: Key Biscayne and Cape
    // Florida's light to windward, Stiltsville on the flats, the towers of Brickell and downtown up the bay
    id: 'miami', name: ['Miami', 'Майами', 'Miami', 'Miami', 'Miami'], lat: 25.695, lon: -80.205, wind: 110, tz: -4, anchored: 1, stream: ['tide', 320, 0.4], from: '2026-11-20',
    look: {
      haze: 0.95,
      ground: { forest: ['#2f4d28', '#3f6430', '#5a7f3a'], scrub: '#70874a', rock: ['#b8ae94', '#968c76'], town: '#b5ae9e', shore: '#e8dcbc', sand: '#efe4c6', grass: '#5f8a3e' },
      trees: [['palm', 0.5, '#3d5a2c', '#6a8a3a'], ['broad', 0.5, '#2f4d28', '#587f38']], treeTop: 40, woods: 0.45, clearing: 'grass',
      walls: ['#f6f3ec', '#efe6d2', '#ffffff', '#f2d9c0', '#d9e6e0', '#ece4d2'], roofs: ['#c0704a', '#d8d4c8', '#a5543a', '#e8e4dc'], flat: 0.6,
      towers: ['#a8c0cc', '#c8d6dc', '#eeeeea', '#8fabba', '#dfe6e8', '#b6c8d0'],
      boats: { sail: 0.5, motor: 0.42, big: 0.08, bigKind: 'super' },
      water: { deep: '#0f5a66', scatter: '#2fb0a4', k: 0.6, shallow: '#7cd0b0', clear: 0.7 },
    },
  },
  {
    // the Split Channel in the summer's maestral: the Riva and Diocletian's palace behind Marjan's wooded hill, Mosor
    // over the city, Brač and Šolta across the water
    id: 'split', name: ['Split', 'Сплит', 'Split', 'Split', 'Split'], lat: 43.465, lon: 16.42, wind: 300, tz: 2, from: '2026-11-20',
    look: {
      haze: 1.2,
      ground: { forest: ['#2f4427', '#41582f', '#5c7040'], scrub: '#7f7f58', rock: ['#d2cbb8', '#aaa390'], town: '#bfb6a2', shore: '#cfc6b0', sand: '#d9d0ba' }, // the Dalmatian coast's white limestone
      trees: [['pine', 0.55, '#2f4427', '#5c7040'], ['cypress', 0.15, '#25391f', '#3a5230'], ['olive', 0.25, '#56603e', '#7f8660'], ['palm', 0.05, '#3d5a2c', '#5f7a3a']], treeTop: 700, woods: 0.45, coast: 'rock',
      walls: ['#ece6d6', '#e4dcc8', '#f3eee2', '#d9d0bc', '#e8dfcc'], roofs: ['#b4603e', '#a5543a', '#c0704a', '#9c4f37'], flat: 0.25,
      boats: { sail: 0.7, motor: 0.22, big: 0.08, bigKind: 'gulet' },
      water: { deep: '#053454', scatter: '#157fa8', k: 0.45, shallow: '#35b0b4', clear: 0.65 },
    },
  },
  {
    // the Ligurian Sea off Port Hercule in the sea breeze: the Rock and its palace, Monte Carlo's towers stacked up
    // the mountain, the Liguro-Provençal current running west along the coast
    id: 'monaco', name: ['Monaco', 'Монако', 'Mónaco', 'Monaco', 'Monako'], lat: 43.72, lon: 7.44, wind: 135, tz: 2, stream: ['flow', 250, 0.3], from: '2026-11-20',
    look: {
      haze: 1.1,
      ground: { forest: ['#30452a', '#425a33', '#5d7242'], scrub: '#7c7b55', rock: ['#bdb4a0', '#968e7c'], town: '#b9ae9a', shore: '#a89f8c', sand: '#bdb29c' },
      trees: [['pine', 0.4, '#30452a', '#5d7242'], ['olive', 0.25, '#56603e', '#7f8660'], ['cypress', 0.15, '#25391f', '#3a5230'], ['palm', 0.2, '#3d5a2c', '#5f7a3a']], treeTop: 1100, woods: 0.45, coast: 'rock', snow: 3000,
      walls: ['#f0e4cc', '#ecd6b4', '#f4ecdc', '#e8c9a8', '#e6dcc8', '#f7f2e6'], roofs: ['#b4603e', '#a5543a', '#c0704a', '#8f8a7e'], flat: 0.6,
      towers: ['#e6dfd0', '#d9d3c6', '#c9d3d8', '#efe9dc', '#b8c6cc', '#e0d8c8'],
      boats: { sail: 0.2, motor: 0.45, big: 0.35, bigKind: 'super' },
      water: { deep: '#04304e', scatter: '#127aa4', k: 0.45, shallow: '#2fa8b4', clear: 0.6 },
    },
  },
  {
    // Gage Roads off Fremantle, of the 1987 America's Cup, in the south-westerly Fremantle Doctor: the port's moles and
    // cranes and the long white beaches to leeward, Rottnest on the horizon
    id: 'fremantle', name: ['Fremantle', 'Фримантл', 'Fremantle', 'Fremantle', 'Fremantle'], lat: -32.045, lon: 115.7, wind: 225, tz: 8, anchored: 4, from: '2026-11-20',
    look: {
      haze: 1.25,
      ground: { forest: ['#3f4f30', '#52633a', '#6c7a4a'], scrub: '#88865a', rock: ['#c8bb9c', '#a59878'], town: '#b8ad9a', shore: '#f0e6cc', sand: '#f4ecd6', grass: '#7a8f48' },
      trees: [['eucalypt', 0.55, '#4a5a3a', '#7d8a62'], ['shrub', 0.25, '#5a6a42', '#7f8a5c'], ['stone', 0.2, '#3f4f30', '#6c7a4a']], treeTop: 120, woods: 0.2, clearing: 'scrub',
      // the port's limestone and red brick, and its pale tin roofs
      walls: ['#e6d9bc', '#d9c8a4', '#a85c45', '#efe9dc', '#c9b08a', '#f3eee4'], roofs: ['#8f9498', '#a84f36', '#7b8287', '#c9c6bc'], flat: 0.3,
      boats: { sail: 0.65, motor: 0.3, big: 0.05, bigKind: 'super' },
      water: { deep: '#044a70', scatter: '#14a0bc', k: 0.5, shallow: '#5cd0c0', clear: 0.75 },
    },
  },
  {
    // the Caribbean off Simpson Bay in the easterly trade wind: the airliners coming in over Maho Beach, Cupecoy's
    // cliffs and the island's green hills ashore
    id: 'sint-maarten', name: ['Sint Maarten', 'Синт-Мартен', 'Sint Maarten', 'Sint Maarten', 'Sint Maarten'], lat: 18.012, lon: -63.105, wind: 95, tz: -4, stream: ['flow', 285, 0.5], from: '2026-11-20',
    look: {
      haze: 1.2,
      ground: { forest: ['#2f4f28', '#3f6a30', '#5c8a3c'], scrub: '#6f8a48', rock: ['#a89a80', '#857a68'], town: '#c0b8a6', shore: '#efe4c4', sand: '#f4ead0', grass: '#5f8f3e' },
      trees: [['palm', 0.35, '#3d5a2c', '#6a8a3a'], ['broad', 0.4, '#2f4f28', '#5c8a3c'], ['shrub', 0.25, '#55703a', '#7a8f4e']], treeTop: 420, woods: 0.6,
      // the islands' painted houses
      walls: ['#f6f3ec', '#f2d7a8', '#f0b8a0', '#a8d8d0', '#f8e8b0', '#ffffff', '#c8dcec'], roofs: ['#b4603e', '#c23a30', '#3f7f8f', '#d8d4c8'], flat: 0.45,
      boats: { sail: 0.55, motor: 0.3, big: 0.15, bigKind: 'super' },
      water: { deep: '#024a78', scatter: '#10a8c4', k: 0.55, shallow: '#54d4c4', clear: 0.8 },
    },
  },
  {
    // the Andaman Sea off Kata and Karon, of the King's Cup, in the winter's north-easterly monsoon: the beaches, the
    // jungle hills and the Big Buddha on Nakkerd Hill to windward
    id: 'phuket', name: ['Phuket', 'Пхукет', 'Phuket', 'Phuket', 'Puket'], lat: 7.785, lon: 98.255, wind: 60, tz: 7, thermal: false, stream: ['tide', 350, 0.4], from: '2026-11-20',
    look: {
      haze: 0.95,
      ground: { forest: ['#234a22', '#2f602a', '#4a7f36'], scrub: '#5f8a42', rock: ['#9a9080', '#786f62'], town: '#b5ad9c', shore: '#efe4c6', sand: '#f4ecd2', grass: '#5a8f3a' },
      fields: ['#4f8a3a', '#5f9a42', '#3f7a34'], // rubber and oil-palm plantations
      trees: [['broad', 0.65, '#234a22', '#4f8638'], ['palm', 0.35, '#3d5a2c', '#6a8a3a']], treeTop: 530, woods: 0.85,
      walls: ['#f4f0e6', '#ece4d2', '#ffffff', '#f0dcc0', '#dfe6dc', '#e8d8c0'], roofs: ['#b4603e', '#c0704a', '#8f4a36', '#6f7478'], flat: 0.45,
      boats: { sail: 0.4, motor: 0.5, big: 0.1, bigKind: 'super' },
      water: { deep: '#06486a', scatter: '#16a0b0', k: 0.55, shallow: '#58ccb8', clear: 0.65 },
    },
  },
  {
    // the Tbilisi Sea, the reservoir in the dry hills over Georgia's capital, in the north-westerly that blows down its
    // length: the Chronicle of Georgia's bronze pillars on the hill at its head, the city's blocks of flats along its banks
    id: 'tbilisi-sea', name: ['Tbilisi Sea', 'Тбилисское море', 'Mar de Tiflis', 'Tiflis-See', 'Tbilisi Denizi'], lat: 41.75, lon: 44.8405, wind: 305, tz: 4, thermal: false, from: '2026-11-20',
    look: {
      haze: 1.0,
      ground: { forest: ['#39482a', '#4b5a32', '#69703f'], scrub: '#9b8f5e', rock: ['#bbab8c', '#95876c'], town: '#aca18d', shore: '#b9aa8b', grass: '#a59b63' }, // the steppe's dry grass
      fields: ['#a89c62', '#9a9458', '#b3a56e'],
      trees: [['pine', 0.5, '#2f4226', '#55683a'], ['broad', 0.35, '#3c4f2b', '#6a7a40'], ['cypress', 0.15, '#26391f', '#3a5230']], treeTop: 1500, woods: 0.2,
      walls: ['#d8d2c4', '#c9c4b8', '#e4dccb', '#d2c2a8', '#bfbcb2'], roofs: ['#8c5a44', '#7e7f80', '#9c5f42', '#6f7274'], flat: 0.6,
      towers: ['#cfcabd', '#bdb9ae', '#d9d3c5', '#c6bfae', '#b4b2a9'], // the Soviet years' concrete blocks of flats
      boats: { sail: 0.7, motor: 0.3, big: 0 },
      water: { deep: '#0a3c4a', scatter: '#2a9088', k: 0.45, shallow: '#58a892', clear: 0.35 },
    },
  },
  {
    // Malta's north-east coast off Valletta and the Grand Harbour, where the Rolex Middle Sea Race starts, in the
    // north-westerly majjistral: the honey limestone bastions and the Carmelite dome to leeward
    id: 'malta', name: ['Malta', 'Мальта', 'Malta', 'Malta', 'Malta'], lat: 35.915, lon: 14.53, wind: 315, tz: 2, anchored: 3, thermal: false, from: '2026-11-20',
    look: {
      haze: 1.15,
      ground: { forest: ['#46542f', '#5a683a', '#747c4a'], scrub: '#9a9166', rock: ['#dcc99e', '#b9a67c'], town: '#cdb98f', shore: '#d8c69c', sand: '#e0c98f', grass: '#7f8a4c' },
      fields: ['#8f9456', '#a39c5e', '#b5a768', '#7f8a4c'],
      trees: [['olive', 0.35, '#56603e', '#7f8660'], ['stone', 0.3, '#3f4f2c', '#62703f'], ['shrub', 0.25, '#66703f', '#878a55'], ['palm', 0.1, '#3d5a2c', '#5f7a3a']], treeTop: 260, woods: 0.08, coast: 'rock',
      // Globigerina limestone, the whole island's one colour, its roofs flat
      walls: ['#dcc596', '#e3cfa4', '#d3b985', '#ead9b4', '#cfb27c', '#e6d3a8'], roofs: ['#cdb68a', '#bda67a', '#d6c298'], flat: 0.92,
      boats: { sail: 0.5, motor: 0.3, big: 0.2, bigKind: 'super' },
      water: { deep: '#033a62', scatter: '#1092bc', k: 0.5, shallow: '#3cc4c4', clear: 0.75 },
    },
  },
  {
    // the Bay of Saint-Malo off the walled city, the start of the Route du Rhum, in the westerly: granite ramparts, the
    // cathedral's spire, the islets and forts that the great tides cover and uncover
    id: 'saint-malo', name: ['Saint-Malo', 'Сен-Мало', 'Saint-Malo', 'Saint-Malo', 'Saint-Malo'], lat: 48.668, lon: -2.045, wind: 280, tz: 2, stream: ['tide', 80, 1.0], from: '2026-11-20',
    look: {
      haze: 0.95,
      ground: { forest: ['#2d4629', '#3f5c36', '#5b7848'], scrub: '#7a8258', rock: ['#8f8a7e', '#6d6a60'], town: '#a8a296', shore: '#cbbfa4', sand: '#dccfb0', grass: '#688a48' },
      fields: ['#6f9a45', '#7fa64e', '#8fae55', '#a8b866', '#5f8c3e'],
      trees: [['broad', 0.65, '#2d4629', '#5b7848'], ['conifer', 0.2, '#243b22', '#3a5530'], ['pine', 0.15, '#2b4123', '#536b39']], treeTop: 200, woods: 0.22, clearing: 'grass', coast: 'rock',
      // Breton granite under slate
      walls: ['#9b968a', '#a9a497', '#8b867b', '#bdb7a9', '#d8d2c4', '#e6e1d4'], roofs: ['#4a4f55', '#55595f', '#3f444a', '#5f6368'], flat: 0.05,
      boats: { sail: 0.82, motor: 0.18, big: 0 },
      water: { deep: '#0b3a47', scatter: '#2a7a76', k: 0.55, shallow: '#5a8a7c', clear: 0.14 }, // (the Channel's, stirred by the tide)
    },
  },
  {
    // the Derwent off Sandy Bay, the finish of the Sydney to Hobart, in the afternoon sea breeze up the river:
    // kunanyi/Mount Wellington over the city, the Tasman Bridge upstream
    id: 'hobart', name: ['Hobart', 'Хобарт', 'Hobart', 'Hobart', 'Hobart'], lat: -42.9, lon: 147.37, wind: 170, tz: 11, from: '2026-11-20',
    look: {
      haze: 1.15,
      ground: { forest: ['#2c3e2a', '#3e5138', '#566a48'], scrub: '#7d7f58', rock: ['#8b857a', '#6b665c'], town: '#a79d8b', shore: '#bfb49c', sand: '#d8cca8', grass: '#7c8a4c' },
      fields: ['#8a9450', '#a3a25c', '#b9ac68', '#76863f'],
      trees: [['eucalypt', 0.8, '#2f3f2c', '#65735a'], ['broad', 0.12, '#2c3e2a', '#566a48'], ['conifer', 0.08, '#22381f', '#36502c']], treeTop: 1150, woods: 0.7, snow: 1250,
      // weatherboard and Georgian sandstone under iron roofs
      walls: ['#d9d2c2', '#c9a88a', '#e6e1d5', '#b78a6a', '#d1c6b4', '#f0ece2'], roofs: ['#6a6e72', '#8a4a3c', '#55595e', '#a0553f', '#7f8488'], flat: 0.12,
      boats: { sail: 0.85, motor: 0.15, big: 0 },
      water: { deep: '#08303f', scatter: '#1f7f83', k: 0.5, shallow: '#4a9a90', clear: 0.3 },
    },
  },
  {
    // the Petit-Lac above Geneva, the start of the Bol d'Or, in the bise blowing down the lake: the Jet d'Eau at its foot,
    // the Jura to one side and the Alps to the other
    id: 'lake-geneva', name: ['Lake Geneva', 'Женевское озеро', 'Lago Lemán', 'Genfersee', 'Cenevre Gölü'], lat: 46.27, lon: 6.2, wind: 40, tz: 2, thermal: false, from: '2026-11-20',
    look: {
      haze: 1.1,
      ground: { forest: ['#2c4524', '#3c5a2c', '#557236'], scrub: '#7c8452', rock: ['#a9a89e', '#87867c'], town: '#b4ab98', shore: '#b9b09c', grass: '#6f9048' },
      fields: ['#6f9a45', '#7fa64e', '#8fae55', '#a8b866', '#5f8c3e', '#c2b46a'],
      trees: [['broad', 0.6, '#2c4524', '#58773a'], ['conifer', 0.3, '#22381f', '#36502c'], ['cypress', 0.1, '#25391f', '#3a5230']], treeTop: 1800, woods: 0.4, snow: 2700, clearing: 'grass',
      walls: ['#efe8d8', '#e6dcc6', '#f3efe6', '#d8cdb6', '#e9d9bb', '#ffffff'], roofs: ['#9c5a42', '#8a4e3a', '#6e6a68', '#a8644a'], flat: 0.25,
      boats: { sail: 0.85, motor: 0.15, big: 0 },
      water: { deep: '#0a3b52', scatter: '#2a93a0', k: 0.5, shallow: '#5aa9a6', clear: 0.45 },
    },
  },
  {
    // the Pacific off Point Loma, of the America's Cups of 1988, 1992 and 1995, in the sea breeze: the old lighthouse on the
    // ridge, the Hotel del Coronado on its beach, the city's towers behind North Island
    id: 'san-diego', name: ['San Diego', 'Сан-Диего', 'San Diego', 'San Diego', 'San Diego'], lat: 32.6725, lon: -117.195, wind: 290, tz: -7, from: '2026-11-20',
    look: {
      haze: 0.95,
      ground: { forest: ['#46502f', '#58623a', '#6f7747'], scrub: '#8d8558', rock: ['#b0a184', '#8a7e68'], town: '#b0a898', shore: '#d9cca8', sand: '#e2d5b2', grass: '#71843f' },
      trees: [['palm', 0.35, '#3d5a2c', '#6a8a3a'], ['eucalypt', 0.25, '#4a5a3a', '#7d8a62'], ['shrub', 0.3, '#5a6a42', '#7f8a5c'], ['broad', 0.1, '#3a5230', '#5f7a3c']], treeTop: 450, woods: 0.15, clearing: 'scrub',
      walls: ['#f3eee2', '#e9dec6', '#f7f3ea', '#dccdb0', '#d0ccc2', '#ffffff'], roofs: ['#b4603e', '#a5543a', '#8f8678', '#6f7478'], flat: 0.55,
      boats: { sail: 0.6, motor: 0.3, big: 0.1, bigKind: 'super' },
      water: { deep: '#0f4258', scatter: '#2f8a8c', k: 0.5, shallow: '#5aa894', clear: 0.28 },
    },
  },
  {
    // the mouth of Cork Harbour off Roches Point, home of the Royal Cork Yacht Club and Cork Week, in the south-westerly:
    // green headlands, the white lighthouse, the old forts either side of the entrance
    id: 'cork', name: ['Cork', 'Корк', 'Cork', 'Cork', 'Cork'], lat: 51.7825, lon: -8.27, wind: 225, tz: 1, anchored: 2, stream: ['tide', 350, 0.8], from: '2026-11-20',
    look: {
      haze: 0.9,
      ground: { forest: ['#2b4a26', '#3a5f2e', '#538039'], scrub: '#6f9048', rock: ['#8b897c', '#6c6a60'], town: '#a8a294', shore: '#a9a08a', sand: '#cfc3a0', grass: '#5f9440' },
      fields: ['#5f9a40', '#6fa648', '#7fb050', '#559038', '#8fb455', '#4f8a36'],
      trees: [['broad', 0.75, '#2b4a26', '#5a803a'], ['conifer', 0.25, '#243b22', '#3a5530']], treeTop: 300, woods: 0.14, clearing: 'grass', coast: 'rock',
      // Ireland's painted terraces, the slate roofs over them
      walls: ['#f2efe6', '#e8d9b8', '#d9e0dc', '#efc9a8', '#c8d8d8', '#f6ead0', '#ffffff'], roofs: ['#4f565c', '#5c6266', '#464c52', '#6b6f72'], flat: 0.05,
      boats: { sail: 0.85, motor: 0.15, big: 0 },
      water: { deep: '#0c3238', scatter: '#2a7f76', k: 0.5, shallow: '#4f9080', clear: 0.2 },
    },
  },
  {
    // the bay off Cascais in the summer's nortada, the Sintra hills to windward: the striped Santa Marta light on the rocks,
    // the Citadel over the marina, the Tagus's tide running along the coast
    id: 'cascais', name: ['Cascais', 'Кашкайш', 'Cascais', 'Cascais', 'Cascais'], lat: 38.68, lon: -9.4, wind: 340, tz: 1, stream: ['tide', 95, 0.5], thermal: false, from: '2026-11-20',
    look: {
      haze: 1.1,
      ground: { forest: ['#2e4428', '#40582f', '#5c703f'], scrub: '#7f7f58', rock: ['#c9bfa6', '#a39880'], town: '#bdb4a2', shore: '#d8cba8', sand: '#e8d9ae', grass: '#748a48' },
      trees: [['stone', 0.4, '#2e4428', '#587040'], ['pine', 0.25, '#2b4123', '#536b39'], ['eucalypt', 0.2, '#4a5a3a', '#7d8a62'], ['palm', 0.15, '#3d5a2c', '#5f7a3a']], treeTop: 530, woods: 0.3, coast: 'rock',
      // whitewash with Portugal's yellow and blue bands, under terracotta
      walls: ['#f7f4ec', '#ffffff', '#f2dfa6', '#efe8d8', '#e9c98a', '#d8e2ea'], roofs: ['#b4603e', '#c0704a', '#a5543a', '#9c4f37'], flat: 0.3,
      boats: { sail: 0.7, motor: 0.25, big: 0.05, bigKind: 'super' },
      water: { deep: '#07405e', scatter: '#1a8ca6', k: 0.5, shallow: '#4ab8b0', clear: 0.5 },
    },
  },
  {
    // Lake Michigan off Monroe Harbor, the start of the Race to Mackinac, in the lake breeze: fresh water, the breakwater
    // and its light, Navy Pier's wheel and the Loop's towers to leeward
    id: 'chicago', name: ['Chicago', 'Чикаго', 'Chicago', 'Chicago', 'Şikago'], lat: 41.88, lon: -87.583, wind: 60, tz: -5, from: '2026-11-20',
    look: {
      haze: 0.85,
      ground: { forest: ['#2b4526', '#3a5a2f', '#557539'], scrub: '#7a8a52', rock: ['#a8a598', '#85837a'], town: '#8f8a82', shore: '#b5ad98', sand: '#d9cda8', grass: '#5f8040' },
      trees: [['broad', 0.9, '#2b4526', '#58793a'], ['conifer', 0.1, '#22381f', '#36502c']], treeTop: 120, woods: 0.2, clearing: 'grass',
      // Chicago common brick, limestone and terracotta, the roofs flat
      walls: ['#a8704e', '#8a5a44', '#d9d0bc', '#c9c4ba', '#e6e0d2', '#b98a64', '#6f6a64'], roofs: ['#4a4d50', '#5a5f60', '#6b6e70', '#3f4448'], flat: 0.9,
      fill: 0, // every building is on the map: none made up
      boats: { sail: 0.7, motor: 0.3, big: 0 },
      water: { deep: '#0d4258', scatter: '#2c8f9c', k: 0.55, shallow: '#62a8a0', clear: 0.3 },
    },
  },
  {
    // the Caribbean off Gustavia, of Les Voiles de St Barth and the Bucket, in the trade wind: red roofs round the harbour,
    // the green hills and the rocks offshore
    id: 'st-barths', name: ['St Barths', 'Сен-Бартелеми', 'St Barths', 'St. Barths', 'St Barths'], lat: 17.885, lon: -62.86, wind: 95, tz: -4, stream: ['flow', 285, 0.5], thermal: false, from: '2026-11-20',
    look: {
      haze: 1.25,
      ground: { forest: ['#34522a', '#466e32', '#628c40'], scrub: '#76904c', rock: ['#a89a80', '#857a68'], town: '#c6bdaa', shore: '#efe4c4', sand: '#f6edd4', grass: '#669440' },
      trees: [['shrub', 0.45, '#55703a', '#7a8f4e'], ['palm', 0.3, '#3d5a2c', '#6a8a3a'], ['broad', 0.25, '#34522a', '#628c40']], treeTop: 290, woods: 0.55, coast: 'rock',
      // white walls and shutters, the red roofs the island is known for
      walls: ['#ffffff', '#f8f5ee', '#f6f0e0', '#eef2f0', '#f4e6c8'], roofs: ['#b8392e', '#c23a30', '#a8352c', '#c8503c'], flat: 0.1,
      boats: { sail: 0.45, motor: 0.25, big: 0.3, bigKind: 'super' },
      water: { deep: '#024a7c', scatter: '#0fa8c8', k: 0.55, shallow: '#54d8c8', clear: 0.85 },
    },
  },
  {
    // Fushan Bay off the Olympic Sailing Center of 2008, in the summer's south-easterly: the May Wind's red spiral on its
    // square, the towers along the seafront, the old town's red roofs to the west
    id: 'qingdao', name: ['Qingdao', 'Циндао', 'Qingdao', 'Qingdao', 'Qingdao'], lat: 36.04, lon: 120.395, wind: 135, tz: 8, anchored: 4, stream: ['tide', 70, 0.6], from: '2026-11-20',
    look: {
      haze: 0.75,
      ground: { forest: ['#2a4524', '#3a5a2e', '#55733a'], scrub: '#74804e', rock: ['#a8a090', '#857e70'], town: '#a39e94', shore: '#c9bea0', sand: '#ddd0aa', grass: '#5f8040' },
      trees: [['pine', 0.5, '#2a4524', '#55733a'], ['broad', 0.5, '#2f4a26', '#5f7a3c']], treeTop: 900, woods: 0.55, coast: 'rock',
      walls: ['#dcdad4', '#cfcac0', '#e8e4dc', '#bfc4c6', '#d6cfc0', '#e6e0d0'], roofs: ['#b4553e', '#7e7f80', '#a5483a', '#6f7478'], flat: 0.75,
      boats: { sail: 0.55, motor: 0.4, big: 0.05, bigKind: 'super' },
      water: { deep: '#123f4c', scatter: '#2f7c78', k: 0.55, shallow: '#558a78', clear: 0.15 },
    },
  },
  {
    id: 'aarhus', name: ['Aarhus', 'Орхус', 'Aarhus', 'Aarhus', 'Aarhus'], lat: 56.148, lon: 10.27, wind: 250, tz: 2, anchored: 2, thermal: false, from: '2026-11-21',
    look: {
      haze: 0.95,
      ground: { forest: ['#2a4424', '#38582c', '#4f7236'], scrub: '#6f8a48', rock: ['#a49c88', '#8c8676'], town: '#8f7f74', shore: '#cbbd98', grass: '#6a9444' },
      fields: ['#6f9a45', '#87a94d', '#b9b25c', '#d1bb5e', '#5d8a3c', '#9cb256'],
      trees: [['broad', 0.75, '#2a4424', '#557a3a'], ['conifer', 0.25, '#203a20', '#34502c']], treeTop: 120, woods: 0.3, clearing: 'grass',
      // Danish red and yellow brick, white render, red tile and black glazed roofs; the harbour's new white blocks
      walls: ['#a04a38', '#b8644a', '#e8d9a8', '#f2efe8', '#d9d2c4', '#8a4334'], roofs: ['#8a3b2e', '#3a3a3c', '#5a3a33', '#555a5e'], flat: 0.35,
      tall: 50, // (ARoS's brick cube is no glass tower)
      fill: 0, // every building is on the map: none made up
      boats: { sail: 0.85, motor: 0.15, big: 0 },
      water: { deep: '#0b2a33', scatter: '#2a7a6e', k: 0.6, shallow: '#5a8a70', clear: 0.3 },
    },
  },
  {
    id: 'helsinki', name: ['Helsinki', 'Хельсинки', 'Helsinki', 'Helsinki', 'Helsinki'], lat: 60.125, lon: 24.95, wind: 225, tz: 3, from: '2026-11-21',
    look: {
      haze: 1.1,
      // Finnish granite, red-grey and smoothed by the ice, birch and pine on the islands
      ground: { forest: ['#243d22', '#34502c', '#4c6a36'], scrub: '#6f7a50', rock: ['#a8948c', '#7d6e68'], town: '#9a948a', shore: '#9a8c84', grass: '#6a8a44' },
      trees: [['conifer', 0.55, '#1f381d', '#33502a'], ['broad', 0.45, '#2e4a26', '#5f7f3c']], treeTop: 120, woods: 0.45, clearing: 'rock', coast: 'rock',
      // the city's ochre, cream and pale render, the copper roofs green, the sheet roofs grey and red
      walls: ['#e8d9a8', '#f2ebdc', '#d9c49a', '#c9b8a0', '#f4f2ec', '#b07a5a'], roofs: ['#4a4d50', '#5f7f6a', '#8a3b2e', '#3f4448'], flat: 0.3,
      boats: { sail: 0.75, motor: 0.25, big: 0 },
      water: { deep: '#0b2833', scatter: '#24706a', k: 0.6, shallow: '#4f7f72', clear: 0.25 },
    },
  },
  {
    id: 'gdynia', name: ['Gdynia', 'Гдыня', 'Gdynia', 'Gdynia', 'Gdynia'], lat: 54.52, lon: 18.6, wind: 250, tz: 2, anchored: 4, thermal: false, from: '2026-11-21',
    look: {
      haze: 0.95,
      ground: { forest: ['#2a4424', '#38582c', '#4f7236'], scrub: '#6f8a48', rock: ['#b0a48a', '#8c8676'], town: '#9a9088', shore: '#d8c9a0', sand: '#e2d4ae', grass: '#6a9444' },
      fields: ['#6f9a45', '#87a94d', '#b9b25c', '#d1bb5e', '#5d8a3c'],
      trees: [['broad', 0.6, '#2a4424', '#557a3a'], ['conifer', 0.4, '#203a20', '#34502c']], treeTop: 200, woods: 0.45, clearing: 'grass',
      // Gdynia's white modernism of the 1930s, Sopot's villas, the newer blocks pale
      walls: ['#f2efe8', '#e6e2d6', '#d9d2c4', '#c9c4ba', '#e8d9bc', '#a85c45'], roofs: ['#5a3a33', '#8a4a38', '#555a5e', '#4a4d50'], flat: 0.5,
      boats: { sail: 0.8, motor: 0.2, big: 0 },
      water: { deep: '#0c2a30', scatter: '#2a7468', k: 0.6, shallow: '#5a8a70', clear: 0.25 },
    },
  },
  {
    id: 'kingston', name: ['Kingston', 'Кингстон', 'Kingston', 'Kingston', 'Kingston'], lat: 44.205, lon: -76.525, wind: 225, tz: -4, from: '2026-11-21',
    look: {
      haze: 1.05,
      ground: { forest: ['#2b4526', '#3a5a2f', '#557539'], scrub: '#7a8a52', rock: ['#a8a598', '#85837a'], town: '#8f8a82', shore: '#a8a294', grass: '#5f8040' },
      fields: ['#6a9446', '#7a9f4c', '#8aa858', '#9cae62', '#b9b25c'],
      trees: [['broad', 0.75, '#2b4526', '#58793a'], ['conifer', 0.25, '#22381f', '#36502c']], treeTop: 150, woods: 0.35, clearing: 'grass', coast: 'rock',
      // the Limestone City's grey stone, red brick and white siding
      walls: ['#b8b4a8', '#a8a49a', '#a8704e', '#8a5a44', '#f2efe8', '#d9d0bc'], roofs: ['#4a4d50', '#5a5f60', '#3f4448', '#6b4a3e'], flat: 0.3,
      boats: { sail: 0.8, motor: 0.2, big: 0 },
      water: { deep: '#0d3a4a', scatter: '#2c8090', k: 0.55, shallow: '#5a9a90', clear: 0.35 },
    },
  },
  {
    id: 'tivat', name: ['Tivat', 'Тиват', 'Tivat', 'Tivat', 'Tivat'], lat: 42.425, lon: 18.675, wind: 315, tz: 2, from: '2026-11-21',
    look: {
      haze: 1.2,
      ground: { forest: ['#33482a', '#46602f', '#5f7a3c'], scrub: '#7f8656', rock: ['#c8c2b2', '#a7a090'], town: '#b0a48e', shore: '#c9c1ad' },
      trees: [['broad', 0.35, '#33482a', '#62803e'], ['cypress', 0.2, '#25391f', '#3a5230'], ['olive', 0.2, '#56603e', '#7f8660'], ['stone', 0.1, '#2e4626', '#4f6834'], ['palm', 0.15, '#3d5a2c', '#6a8a3a']], treeTop: 900, woods: 0.7, coast: 'rock', snow: 2600,
      walls: ['#efe3c8', '#e6d2a8', '#f2ebe0', '#d9c39b', '#eadbc0', '#f6f1e6'], roofs: MED.roofs, flat: 0.25,
      boats: { sail: 0.45, motor: 0.3, big: 0.25, bigKind: 'super' },
      water: { deep: '#06304a', scatter: '#1a8a94', k: 0.4, shallow: '#3fa49a', clear: 0.5 },
    },
  },
  {
    id: 'balaton', name: ['Lake Balaton', 'Озеро Балатон', 'Lago Balatón', 'Balaton', 'Balaton Gölü'], lat: 46.937, lon: 17.932, wind: 330, tz: 2, from: '2026-11-21',
    look: {
      haze: 1.0,
      ground: { forest: ['#2e4626', '#3f5a2e', '#5a733a'], scrub: '#7c8250', rock: ['#b0a68e', '#8c846e'], town: '#a8a08e', shore: '#b8b098', grass: '#6a9046' },
      fields: ['#6f9a45', '#7fa64e', '#a8b866', '#c2b46a', '#d1bb5e', '#5f8c3e'],
      trees: [['broad', 0.85, '#2e4626', '#5a7838'], ['conifer', 0.15, '#22381f', '#36502c']], treeTop: 400, woods: 0.35, clearing: 'grass',
      // white and cream villas, red tile roofs
      walls: ['#f2efe6', '#efe3c8', '#e6dcc6', '#f6f1e6', '#e8d5b5', '#d9cdb0'], roofs: ['#a5543a', '#b4603e', '#8a4e3a', '#6e6a68'], flat: 0.15,
      boats: { sail: 0.85, motor: 0.15, big: 0 },
      // the lake's milky green, its fine limestone silt stirred up in the shallows
      water: { deep: '#2a6a62', scatter: '#5aa898', k: 0.7, shallow: '#7ab8a4', clear: 0.15 },
    },
  },
  {
    id: 'singapore', name: ['Singapore', 'Сингапур', 'Singapur', 'Singapur', 'Singapur'], lat: 1.26, lon: 103.875, wind: 30, tz: 8, anchored: 8, thermal: false, stream: ['tide', 75, 1.0], from: '2026-11-21',
    look: {
      haze: 0.75,
      ground: { forest: ['#24401f', '#335229', '#4a6b34'], scrub: '#5f7a3c', rock: ['#a8957a', '#86765f'], town: '#a8a49a', shore: '#d8c9a0', sand: '#e2d2a8', grass: '#5f8a3a' },
      trees: [['broad', 0.7, '#24401f', '#4c6e34'], ['palm', 0.3, '#2f4a24', '#4f6e30']], treeTop: 120, woods: 0.4, clearing: 'grass',
      walls: ['#f2efe8', '#e6e2d6', '#d9d4c8', '#f6f1e6', '#e8dcc6', '#c9d2d6'], roofs: ['#8a4e3a', '#a5543a', '#7e8489', '#5d6266'], flat: 0.8,
      towers: ['#9fb6c4', '#b9c9d2', '#d8dee0', '#7f9bad', '#e4e4de', '#a9bcc6'],
      boats: { sail: 0.4, motor: 0.4, big: 0.2, bigKind: 'super' },
      water: { deep: '#0d3a40', scatter: '#2a8070', k: 0.55, shallow: '#5a9480', clear: 0.15 },
    },
  },
  {
    id: 'muscat', name: ['Muscat', 'Маскат', 'Mascate', 'Maskat', 'Maskat'], lat: 23.65, lon: 58.27, wind: 10, tz: 4, anchored: 3, from: '2026-11-21',
    look: {
      haze: 2.0, // (the Hajar's ridges 20 to 30 km inland show over the plain, as they do from the water)
      // the Hajar's dark ophiolite, brown and grey, over the gravel plain
      ground: { forest: ['#4a5a34', '#5c6c3e', '#74824c'], scrub: '#a89a72', rock: ['#7a6a5a', '#5a4e44'], town: '#cfc3a8', shore: '#e2d2ac', sand: '#e6d4ac', grass: '#7f9448' },
      trees: [['palm', 0.6, '#3d5a2c', '#6a8a3a'], ['shrub', 0.4, '#6a7446', '#8d9460']], treeTop: 60, woods: 0.04,
      // Muscat's white, flat-roofed and low by law
      walls: ['#f6f4ee', '#f1ebdc', '#ffffff', '#e8dfca', '#efe6d2', '#e0d4ba'], roofs: ['#e8e4dc', '#d8cdb4', '#f2efe8', '#c9bea4'], flat: 0.97,
      boats: { sail: 0.4, motor: 0.4, big: 0.2, bigKind: 'super' },
      water: { deep: '#06405a', scatter: '#1aa4a0', k: 0.5, shallow: '#4cc0b0', clear: 0.6 },
    },
  },
  {
    id: 'buenos-aires', name: ['Buenos Aires', 'Буэнос-Айрес', 'Buenos Aires', 'Buenos Aires', 'Buenos Aires'], lat: -34.5015, lon: -58.454, wind: 90, tz: -3, anchored: 2, stream: ['tide', 300, 0.5], from: '2026-11-21',
    look: {
      haze: 0.85,
      ground: { forest: ['#33482a', '#46602f', '#5f7a3c'], scrub: '#7f8656', rock: ['#a89c84', '#857b6a'], town: '#a8a090', shore: '#b8a888', grass: '#6a8a44' },
      trees: [['broad', 0.85, '#33482a', '#5a7838'], ['palm', 0.15, '#3d5a2c', '#6a8a3a']], treeTop: 60, woods: 0.3, clearing: 'grass',
      walls: ['#efe6d2', '#e8d9bc', '#f2ebdc', '#b5684c', '#d9c3a0', '#f6f1e6'], roofs: ['#a5543a', '#8a8e90', '#b4603e', '#6e6a68'], flat: 0.65,
      boats: { sail: 0.75, motor: 0.25, big: 0 },
      // the river's brown, silt from the Paraná and the Uruguay
      water: { deep: '#5e4c32', scatter: '#a88c5c', k: 0.85, shallow: '#a68c5e', clear: 0.05 },
    },
  },
  {
    id: 'busan', name: ['Busan', 'Пусан', 'Busan', 'Busan', 'Busan'], lat: 35.133, lon: 129.148, wind: 315, tz: 9, anchored: 3, thermal: false, from: '2026-11-21',
    look: {
      haze: 0.9,
      ground: { forest: ['#24401f', '#335229', '#4a6b34'], scrub: '#6b7a44', rock: ['#9a9284', '#7a7366'], town: '#9a948a', shore: '#c9bb98', sand: '#e2d4ae' },
      trees: [['conifer', 0.5, '#1f381d', '#33502a'], ['broad', 0.5, '#2e4a26', '#557038']], treeTop: 600, woods: 0.7, coast: 'rock',
      walls: ['#f2efe8', '#e6e2d6', '#d9d4c8', '#c9d2d6', '#e8dcc6', '#b8c4c9'], roofs: ['#4a5a6a', '#5d6266', '#7e8489', '#8a4e3a'], flat: 0.85,
      towers: ['#9fb6c4', '#b9c9d2', '#d8dee0', '#7f9bad', '#e4e4de', '#a9bcc6'],
      boats: { sail: 0.6, motor: 0.4, big: 0 },
      water: { deep: '#0a2c40', scatter: '#227f86', k: 0.45, shallow: '#4f9a8c', clear: 0.35 },
    },
  },
];

export const venueById = (id) => VENUES.find((v) => v.id === id) || VENUES[0];
// whether a course shape is laid at the venue at that length: its `skip` lists the '<shape>:<length>' that don't fit
// its water, and a length none fits (never a short course, where today's race goes); lib/venues.ts has the same lists
export const shapeOffered = (v, shape, length) => !(v.skip || []).includes(`${shape}:${length}`);
export const lengthOffered = (v, length) => !(v.skip || []).includes(length);
// the length a race asked for is sailed at: that, or the longest the venue has shorter
export const laidLength = (v, length) => ['long', 'medium', 'short'].slice(['long', 'medium', 'short'].indexOf(length)).find((l) => lengthOffered(v, l)) || 'short';

// Today's race: a venue a day, from the date (UTC), the same for everyone. The days go round all of them in a shuffled
// order, a new one every len days, so each venue comes once in that time and none two days running. lib/race.ts has
// a copy (npm test keeps them in step).
// A venue added later joins on its `from` day: the days before it go round the venues there were then, as they always
// did; from it the rounds start again with it among them. ROUNDS: each such stretch, its first day (n0) and its venues.
const dayRng = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const dayN = (s) => Math.floor(Date.parse(s) / 864e5);
export const ROUNDS = [0, ...new Set(VENUES.filter((v) => v.from).map((v) => dayN(v.from)))].sort((a, b) => a - b)
  .map((n0) => ({ n0, ids: VENUES.filter((v) => !v.from || dayN(v.from) <= n0).map((v) => v.id) }));
function round(ids, k) { // the order of the venues in round k
  const a = ids.slice(), r = dayRng((k + 1) * 40503 + 977);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function venueOn(n) {
  let e = ROUNDS.length - 1; while (e > 0 && n < ROUNDS[e].n0) e--;
  const { n0, ids } = ROUNDS[e], len = ids.length, k = Math.floor((n - n0) / len), a = round(ids, k);
  if (a[0] === (k > 0 || e === 0 ? round(ids, k - 1)[len - 1] : venueOn(n0 - 1))) [a[0], a[1]] = [a[1], a[0]]; // not the same place as yesterday
  return a[n - n0 - k * len];
}
export const dailyVenue = (date = new Date()) => venueOn(Math.floor(Date.parse(date.toISOString().slice(0, 10)) / 864e5));

// The venue of the race on this page: ?venue= in the address wins; a free race goes where the set-up chose
// (localStorage 'regatta', venue); today's race (any other /play) to the day's venue. The home page's view
// (/hero-view) and Node's tests are in Göcek.
export function pageVenue() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('venue')) return venueById(q.get('venue'));
    if (q.get('race') === 'free') return venueById(JSON.parse(localStorage.getItem('regatta') || '{}').venue);
    if (/^\/play/.test(location.pathname)) return venueById(dailyVenue());
  } catch (e) {}
  return VENUES[0];
}
export const VENUE = pageVenue();
// the files of its land
export const landFiles = (v = VENUE) => (v.id === 'gocek' ? ['skopea.json', 'skopea.bin'] : [`venues/${v.id}.json`, `venues/${v.id}.bin`]);
