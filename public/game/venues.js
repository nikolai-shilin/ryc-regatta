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
    id: 'gocek', name: ['Göcek', 'Гёчек'], lat: 36.7525, lon: 28.9395, wind: 195, tz: 3,
    look: {
      haze: 1.1,
      ground: { forest: ['#283d21', '#36502b', '#4e6535'], scrub: '#7b7d55', rock: ['#9a917c', '#7b7465'], town: '#a19a84', shore: '#a39a86' },
      trees: [['pine', 1, '#2c4224', '#566d3a']], treeTop: 650, woods: 1, coast: 'rock', ...MED, flat: 0.45,
      water: { shallow: '#3fae9e', clear: 0.55 },
      boats: { sail: 0.65, motor: 0.28, big: 0.07, bigKind: 'gulet' },
    },
  },
  {
    id: 'cowes', name: ['Cowes', 'Каус'], lat: 50.788, lon: -1.306, wind: 225, tz: 1, stream: ['tide', 75, 1.1],
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
    id: 'newport', name: ['Newport', 'Ньюпорт'], lat: 41.457, lon: -71.36, wind: 210, tz: -4, stream: ['tide', 340, 0.8],
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
    id: 'sydney', name: ['Sydney', 'Сидней'], lat: -33.848, lon: 151.256, wind: 45, tz: 11, stream: ['tide', 225, 0.6],
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
    id: 'kiel', name: ['Kiel', 'Киль'], lat: 54.43, lon: 10.205, wind: 250, tz: 2, thermal: false,
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
    id: 'trieste', name: ['Trieste', 'Триест'], lat: 45.672, lon: 13.728, wind: 70, tz: 2, thermal: false,
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
    id: 'porto-cervo', name: ['Porto Cervo', 'Порто-Черво'], lat: 41.152, lon: 9.565, wind: 315, tz: 2, thermal: false,
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
    id: 'saint-tropez', name: ['Saint-Tropez', 'Сен-Тропе'], lat: 43.29, lon: 6.67, wind: 280, tz: 2, thermal: false,
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
    id: 'antigua', name: ['Antigua', 'Антигуа'], lat: 16.989, lon: -61.77, wind: 95, tz: -4, stream: ['flow', 290, 0.5],
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
    id: 'auckland', name: ['Auckland', 'Окленд'], lat: -36.83, lon: 174.815, wind: 225, tz: 13, thermal: false, stream: ['tide', 230, 1.0],
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
    id: 'san-francisco', name: ['San Francisco', 'Сан-Франциско'], lat: 37.815, lon: -122.435, wind: 255, tz: -7, stream: ['tide', 85, 1.2],
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
    id: 'valencia', name: ['Valencia', 'Валенсия'], lat: 39.455, lon: -0.285, wind: 110, tz: 2,
    look: {
      haze: 1.0,
      ground: { forest: ['#3a5229', '#4c6a30', '#66823c'], scrub: '#8a8a58', rock: ['#b8a888', '#9a8a6c'], town: '#bba98e', shore: '#e0cfa4' },
      fields: ['#4f7a30', '#5f8a38', '#6a9440', '#a8a060', '#8a9a50'],
      trees: [['broad', 0.45, '#335226', '#5a7c34'], ['palm', 0.3, '#3d5a2c', '#6a8a3a'], ['stone', 0.25, '#2e4626', '#4f6834']], treeTop: 600, woods: 0.35,
      walls: ['#f2e6cc', '#efd9b0', '#f6f1e6', '#e3cfa8', '#f0dfc0', '#e8d5b5'], roofs: ['#b4603e', '#a5543a', '#9c4f37', '#8a8e90'], flat: 0.6,
      boats: { sail: 0.6, motor: 0.3, big: 0.1, bigKind: 'super' },
      water: { deep: '#06304a', scatter: '#1a9a9a', k: 0.3, shallow: '#4aa89a', clear: 0.45 },
    },
  },
  {
    id: 'barcelona', name: ['Barcelona', 'Барселона'], lat: 41.372, lon: 2.225, wind: 200, tz: 2,
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
    id: 'palma', name: ['Palma', 'Пальма'], lat: 39.535, lon: 2.63, wind: 220, tz: 2,
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
    id: 'marstrand', name: ['Marstrand', 'Марстранд'], lat: 57.885, lon: 11.555, wind: 225, tz: 2, stream: ['flow', 15, 0.4],
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
    id: 'bermuda', name: ['Bermuda', 'Бермуды'], lat: 32.305, lon: -64.84, wind: 200, tz: -3,
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
    id: 'enoshima', name: ['Enoshima', 'Эносима'], lat: 35.285, lon: 139.495, wind: 190, tz: 9,
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
    id: 'weymouth', name: ['Weymouth', 'Уэймут'], lat: 50.605, lon: -2.41, wind: 225, tz: 1, stream: ['tide', 60, 0.5],
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
    id: 'marseille', name: ['Marseille', 'Марсель'], lat: 43.265, lon: 5.335, wind: 315, tz: 2, thermal: false,
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
    id: 'rio', name: ['Rio de Janeiro', 'Рио-де-Жанейро'], lat: -22.93, lon: -43.158, wind: 150, tz: -3, stream: ['tide', 35, 0.8],
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
    id: 'garda', name: ['Lake Garda', 'Озеро Гарда'], lat: 45.84, lon: 10.85, wind: 190, tz: 2,
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
    id: 'istanbul', name: ['Istanbul', 'Стамбул'], lat: 40.982, lon: 28.992, wind: 35, tz: 3, thermal: false, stream: ['flow', 185, 1.0], runs: true,
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
    id: 'st-petersburg', name: ['St Petersburg', 'Санкт-Петербург'], lat: 59.9464, lon: 30.3187, wind: 245, tz: 3, thermal: false, stream: ['flow', 235, 0.9], runs: true, from: '2026-11-20',
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
    id: 'batumi', name: ['Batumi', 'Батуми'], lat: 41.672, lon: 41.68, wind: 290, tz: 4, stream: ['flow', 55, 0.4], from: '2026-11-20',
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
    id: 'scheveningen', name: ['Scheveningen', 'Схевенинген'], lat: 52.1228, lon: 4.2662, wind: 225, tz: 2, stream: ['tide', 30, 1.0], from: '2026-11-20',
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
    id: 'hong-kong', name: ['Hong Kong', 'Гонконг'], lat: 22.2884, lon: 114.1781, wind: 80, tz: 8, stream: ['tide', 80, 1.0], from: '2026-11-20',
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
    id: 'cape-town', name: ['Cape Town', 'Кейптаун'], lat: -33.8978, lon: 18.4556, wind: 160, tz: 2, thermal: false, from: '2026-11-20',
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
    id: 'athens', name: ['Athens', 'Афины'], lat: 37.9115, lon: 23.6765, wind: 30, tz: 3, thermal: false, from: '2026-11-20',
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
    id: 'marmaris', name: ['Marmaris', 'Мармарис'], lat: 36.83, lon: 28.262, wind: 265, tz: 3, from: '2026-11-20',
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
    id: 'fethiye', name: ['Fethiye', 'Фетхие'], lat: 36.634, lon: 29.11, wind: 275, tz: 3, from: '2026-11-20',
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
    id: 'sochi', name: ['Sochi', 'Сочи'], lat: 43.564, lon: 39.697, wind: 225, tz: 3, stream: ['flow', 310, 0.4], from: '2026-11-20',
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
    id: 'melbourne', name: ['Melbourne', 'Мельбурн'], lat: -37.88, lon: 144.945, wind: 200, tz: 11, from: '2026-11-20',
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
    id: 'gold-coast', name: ['Gold Coast', 'Голд-Кост'], lat: -28.0, lon: 153.455, wind: 90, tz: 10, stream: ['flow', 175, 0.6], from: '2026-11-20',
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
    id: 'new-york', name: ['New York', 'Нью-Йорк'], lat: 40.675, lon: -74.035, wind: 200, tz: -4, stream: ['tide', 15, 1.2], from: '2026-11-20',
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
    id: 'naples', name: ['Naples', 'Неаполь'], lat: 40.806, lon: 14.232, wind: 230, tz: 2, from: '2026-11-20',
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
    id: 'los-angeles', name: ['Los Angeles', 'Лос-Анджелес'], lat: 33.7, lon: -118.195, wind: 255, tz: -7, stream: ['tide', 290, 0.4], from: '2026-11-20',
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
    id: 'les-sables', name: ['Les Sables-d’Olonne', 'Ле-Сабль-д’Олон'], lat: 46.475, lon: -1.835, wind: 285, tz: 2, stream: ['tide', 330, 0.5], from: '2026-11-20',
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
    id: 'dubai', name: ['Dubai', 'Дубай'], lat: 25.168, lon: 55.175, wind: 315, tz: 4, stream: ['tide', 230, 0.5], from: '2026-11-20',
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
    id: 'miami', name: ['Miami', 'Майами'], lat: 25.695, lon: -80.205, wind: 110, tz: -4, stream: ['tide', 320, 0.4], from: '2026-11-20',
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
    id: 'split', name: ['Split', 'Сплит'], lat: 43.465, lon: 16.42, wind: 300, tz: 2, from: '2026-11-20',
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
    id: 'monaco', name: ['Monaco', 'Монако'], lat: 43.72, lon: 7.44, wind: 135, tz: 2, stream: ['flow', 250, 0.3], from: '2026-11-20',
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
    id: 'fremantle', name: ['Fremantle', 'Фримантл'], lat: -32.045, lon: 115.7, wind: 225, tz: 8, from: '2026-11-20',
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
    id: 'sint-maarten', name: ['Sint Maarten', 'Синт-Мартен'], lat: 18.012, lon: -63.105, wind: 95, tz: -4, stream: ['flow', 285, 0.5], from: '2026-11-20',
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
    id: 'phuket', name: ['Phuket', 'Пхукет'], lat: 7.785, lon: 98.255, wind: 60, tz: 7, thermal: false, stream: ['tide', 350, 0.4], from: '2026-11-20',
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
