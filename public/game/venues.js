// Where a race is sailed: Göcek bay and the famous regatta venues. Today's race goes to one of them each day
// (dailyVenue); a free race goes where the set-up chose. Numbers and colours only (no three.js, nothing fetched), so the race, the light and the land can all ask.
//
// The land of each is baked from real elevation and OpenStreetMap by blender/venues.py (Göcek's into skopea.json/.bin,
// the others' into venues/<id>.json/.bin), which keeps the same lat, lon and wind as here.
// wind: the compass direction the venue's prevailing wind blows from. The baked land is turned so it comes from the
// game's north, where every race's wind is. tz: the clock's hours ahead of UTC in the sailing season.
//
// The set-up page's list of them, with what each is, is lib/venues.ts; npm test keeps the two in step.
// look: how the land is drawn (skopea.js)
//   ground: the colours of the hillsides: forest (dark, mid, light), scrub, rock (light, dark), town, shore; sand
//     (beaches) and grass (lawns, parks, meadows), when not the defaults (skopea.js)
//   fields: farmland colours, for the low, gentle land outside the woods (none: woods and scrub all over)
//   trees: [kind, share, dark colour, light colour]; kinds: pine, stone (umbrella pine), broad, conifer, cypress,
//     palm, eucalypt, olive, shrub
//   treeTop: how high the trees go, metres; woods: how much of the land is wooded (0 to 1); snow: the snow line on
//     the mountains beyond, metres (2900 when not given)
//   walls, roofs: the houses; flat: the share of flat roofs
//   boats: the moored boats' shares (sail, motor, big) and what the big ones are (gulet or super)
//   water: the sea's own colours (deep, scatter) and how far towards them (0 to 1); over the shallows, the colour
//     the bed gives it (shallow) and how clearly (clear, 0 to 1)
const MED = { walls: ['#f3eee4', '#efe6d2', '#f6f2ea', '#e9dcc0', '#f1e3c8', '#ffffff'], roofs: ['#b4603e', '#a5543a', '#c0704a', '#9c4f37'] };

export const VENUES = [
  {
    id: 'gocek', name: ['Göcek', 'Гёчек'], lat: 36.7525, lon: 28.9395, wind: 0, tz: 3,
    look: {
      ground: { forest: ['#2c4224', '#3c5530', '#566d3a'], scrub: '#7b7d55', rock: ['#9a917c', '#7b7465'], town: '#a19a84', shore: '#a39a86' },
      trees: [['pine', 1, '#2c4224', '#566d3a']], treeTop: 650, woods: 1, ...MED, flat: 0.45,
      water: { shallow: '#3fae9e', clear: 0.55 },
      boats: { sail: 0.65, motor: 0.28, big: 0.07, bigKind: 'gulet' },
    },
  },
  {
    id: 'cowes', name: ['Cowes', 'Каус'], lat: 50.788, lon: -1.306, wind: 225, tz: 1,
    look: {
      ground: { forest: ['#2f4a26', '#3e5d2e', '#557a3a'], scrub: '#6f8a4a', rock: ['#a59d86', '#8a8473'], town: '#9c8f80', shore: '#b9ab8a' },
      fields: ['#6f9a45', '#7fa64e', '#8fae55', '#a8b866', '#c2b46a', '#5f8c3e'],
      trees: [['broad', 0.85, '#2f4a26', '#5d7f3a'], ['conifer', 0.15, '#243b22', '#3a5530']], treeTop: 400, woods: 0.45,
      walls: ['#a0573f', '#b5684c', '#ece3cf', '#f2efe8', '#d8cdb8', '#8f4c38'], roofs: ['#4f565c', '#5c6266', '#6b4a3e', '#7a4636'], flat: 0.15,
      boats: { sail: 0.78, motor: 0.22, big: 0 },
      water: { deep: '#0d2c33', scatter: '#2e7f72', k: 0.55, shallow: '#5f8a6c', clear: 0.25 },
    },
  },
  {
    id: 'newport', name: ['Newport', 'Ньюпорт'], lat: 41.457, lon: -71.36, wind: 210, tz: -4,
    look: {
      ground: { forest: ['#2b4526', '#3a5a2f', '#557539'], scrub: '#7a8a52', rock: ['#8e8a80', '#6f6c66'], town: '#9a968c', shore: '#a8a090' },
      fields: ['#6a9446', '#7a9f4c', '#8aa858', '#9cae62'],
      trees: [['broad', 0.75, '#2b4526', '#58793a'], ['conifer', 0.25, '#22381f', '#36502c']], treeTop: 400, woods: 0.55,
      walls: ['#e8e8e2', '#c9ccc8', '#8e9ea8', '#b8ab92', '#f3f1ea', '#7a8a96'], roofs: ['#4a4d50', '#5b5249', '#3f4448', '#6a5e52'], flat: 0.1,
      boats: { sail: 0.75, motor: 0.25, big: 0 },
      water: { deep: '#0a2a38', scatter: '#24806f', k: 0.45, shallow: '#4f8a7a', clear: 0.3 },
    },
  },
  {
    id: 'sydney', name: ['Sydney', 'Сидней'], lat: -33.848, lon: 151.256, wind: 45, tz: 11,
    look: {
      ground: { forest: ['#3a4a2c', '#4d5c37', '#6b7547'], scrub: '#7f7f58', rock: ['#c9a878', '#a8865c'], town: '#a8988a', shore: '#d8c49a' },
      trees: [['eucalypt', 0.7, '#4a5a3a', '#7d8a62'], ['broad', 0.2, '#304a28', '#557038'], ['palm', 0.1, '#3d5a2c', '#5f7a3a']], treeTop: 300, woods: 0.7,
      walls: ['#e6d6bd', '#b0644a', '#f2eee6', '#d9c3a0', '#c8785a', '#ffffff'], roofs: ['#a84f36', '#93452f', '#7b8287', '#5f666b'], flat: 0.3,
      boats: { sail: 0.7, motor: 0.3, big: 0 },
      water: { deep: '#062c46', scatter: '#1a8fa0', k: 0.4, shallow: '#3f9e94', clear: 0.4 },
    },
  },
  {
    id: 'kiel', name: ['Kiel', 'Киль'], lat: 54.43, lon: 10.205, wind: 250, tz: 2,
    look: {
      ground: { forest: ['#2a4424', '#38582c', '#4f7236'], scrub: '#6f8a48', rock: ['#a49c88', '#8c8676'], town: '#8f7f74', shore: '#cbbd98' },
      fields: ['#6f9a45', '#87a94d', '#b9b25c', '#d1bb5e', '#5d8a3c', '#9cb256'],
      trees: [['broad', 0.8, '#2a4424', '#557a3a'], ['conifer', 0.2, '#203a20', '#34502c']], treeTop: 300, woods: 0.35,
      walls: ['#9a4a3a', '#b5654a', '#eeeae2', '#a85c45', '#d9d2c4', '#8a4334'], roofs: ['#5a3a33', '#7a3b2e', '#555a5e', '#8a4a38'], flat: 0.25,
      boats: { sail: 0.85, motor: 0.15, big: 0 },
      water: { deep: '#0b2a33', scatter: '#2a7a6e', k: 0.6, shallow: '#5a8a70', clear: 0.25 },
    },
  },
  {
    id: 'trieste', name: ['Trieste', 'Триест'], lat: 45.672, lon: 13.728, wind: 70, tz: 2,
    look: {
      ground: { forest: ['#33482a', '#46602f', '#5f7a3c'], scrub: '#7f8656', rock: ['#c8c2b2', '#a7a090'], town: '#b0a48e', shore: '#c9c1ad' },
      trees: [['broad', 0.6, '#33482a', '#62803e'], ['conifer', 0.2, '#28401f', '#3c5a2c'], ['cypress', 0.2, '#25391f', '#3a5230']], treeTop: 600, woods: 0.75,
      walls: ['#efe3c8', '#e6d2a8', '#f2ebe0', '#d9c39b', '#eadbc0', '#f6f1e6'], roofs: ['#b4603e', '#a5543a', '#9a5a44', '#c0704a'], flat: 0.2,
      boats: { sail: 0.8, motor: 0.2, big: 0 },
      water: { deep: '#07304a', scatter: '#1d9496', k: 0.3, shallow: '#3fa49a', clear: 0.45 },
    },
  },
  {
    id: 'porto-cervo', name: ['Porto Cervo', 'Порто-Черво'], lat: 41.152, lon: 9.565, wind: 315, tz: 2,
    look: {
      ground: { forest: ['#3e4d2c', '#4f5f34', '#68743f'], scrub: '#7c7a50', rock: ['#c4a58c', '#a08670'], town: '#c2a88a', shore: '#d8c3a4' },
      trees: [['shrub', 0.75, '#3e4d2c', '#6a7640'], ['olive', 0.15, '#56603e', '#7f8660'], ['stone', 0.1, '#33482a', '#4f6634']], treeTop: 700, woods: 0.6,
      walls: ['#e8c7a0', '#e3b58f', '#efe2cc', '#f2d9b8', '#d9a87c', '#f6efe2'], roofs: ['#b4603e', '#a5543a', '#c0704a', '#9c4f37'], flat: 0.15,
      boats: { sail: 0.55, motor: 0.3, big: 0.15, bigKind: 'super' },
      water: { deep: '#03304e', scatter: '#14b3aa', k: 0.5, shallow: '#38c4b4', clear: 0.75 },
    },
  },
  {
    id: 'saint-tropez', name: ['Saint-Tropez', 'Сен-Тропе'], lat: 43.29, lon: 6.67, wind: 280, tz: 2,
    look: {
      ground: { forest: ['#2e4626', '#3f5a2e', '#5a733a'], scrub: '#7a7c52', rock: ['#a69a84', '#857b6a'], town: '#b3a088', shore: '#cdbb98' },
      fields: ['#6a7f3c', '#7c8a44', '#8c9a4c', '#9a8e52'],
      trees: [['stone', 0.45, '#2e4626', '#4f6834'], ['pine', 0.25, '#2c4224', '#566d3a'], ['cypress', 0.1, '#25391f', '#3a5230'], ['shrub', 0.2, '#3e4d2c', '#6a7640']], treeTop: 700, woods: 0.75,
      walls: ['#efd9b0', '#f0c99a', '#e9b98f', '#f6efe2', '#f2e2c4', '#e3c28e'], roofs: MED.roofs, flat: 0.1,
      boats: { sail: 0.55, motor: 0.3, big: 0.15, bigKind: 'super' },
      water: { deep: '#05304a', scatter: '#1aa3a0', k: 0.2, shallow: '#3fb2a6', clear: 0.55 },
    },
  },
  {
    id: 'antigua', name: ['Antigua', 'Антигуа'], lat: 16.989, lon: -61.77, wind: 95, tz: -4,
    look: {
      ground: { forest: ['#3c5a2a', '#4f7032', '#6a8a3e'], scrub: '#8a8a52', rock: ['#a8957a', '#86765f'], town: '#b9a88e', shore: '#eadcb8' },
      trees: [['shrub', 0.45, '#3c5a2a', '#6f8c40'], ['broad', 0.3, '#335226', '#5a7c34'], ['palm', 0.25, '#3d5a2c', '#6a8a3a']], treeTop: 450, woods: 0.85,
      walls: ['#f2d58a', '#9fd3c7', '#f1a7a1', '#f5f0e1', '#a8c8e8', '#f6e7c6'], roofs: ['#b0412e', '#3d6b4a', '#e8e4dc', '#9a3b2a'], flat: 0.2,
      boats: { sail: 0.6, motor: 0.25, big: 0.15, bigKind: 'super' },
      water: { deep: '#033a5c', scatter: '#18c2bb', k: 0.65, shallow: '#3fd0c4', clear: 0.8 },
    },
  },
  {
    id: 'auckland', name: ['Auckland', 'Окленд'], lat: -36.83, lon: 174.815, wind: 225, tz: 13,
    look: {
      ground: { forest: ['#24401f', '#335229', '#4a6b34'], scrub: '#6b7a44', rock: ['#5d5a55', '#45433f'], town: '#9a948a', shore: '#b8a888' },
      fields: ['#5f9a40', '#6fa648', '#7fae50', '#5a8c3a'],
      trees: [['broad', 0.6, '#24401f', '#4c6e34'], ['conifer', 0.25, '#1f381d', '#33502a'], ['palm', 0.15, '#2f4a24', '#4f6e30']], treeTop: 400, woods: 0.55,
      walls: ['#f3f1ea', '#e6e2d6', '#c9d2d6', '#e8d9b8', '#b8c4c9', '#ffffff'], roofs: ['#8a3b33', '#3d5a6b', '#5d6a5a', '#7e8489'], flat: 0.25,
      boats: { sail: 0.75, motor: 0.25, big: 0 },
      water: { deep: '#082c3c', scatter: '#228a86', k: 0.45, shallow: '#4f9a86', clear: 0.3 },
    },
  },
  {
    id: 'san-francisco', name: ['San Francisco', 'Сан-Франциско'], lat: 37.815, lon: -122.435, wind: 255, tz: -7,
    look: {
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
      ground: { forest: ['#33482a', '#46602f', '#5f7a3c'], scrub: '#868a58', rock: ['#c4b49a', '#a3937a'], town: '#bfae92', shore: '#e2d2ac' },
      fields: ['#7a8a48', '#8c9650', '#a39a5c', '#6a7f3c'],
      trees: [['stone', 0.35, '#2e4626', '#4f6834'], ['olive', 0.35, '#56603e', '#7f8660'], ['shrub', 0.2, '#3e4d2c', '#6a7640'], ['palm', 0.1, '#3d5a2c', '#6a8a3a']], treeTop: 900, woods: 0.6,
      walls: ['#f0dfbe', '#e8cfa2', '#f6efe0', '#dcc49a', '#efe2c8', '#e9d6b2'], roofs: ['#b4603e', '#a5543a', '#c0704a', '#9c4f37'], flat: 0.45,
      boats: { sail: 0.6, motor: 0.25, big: 0.15, bigKind: 'super' },
      water: { deep: '#04324e', scatter: '#16aaa6', k: 0.4, shallow: '#3cbcb0', clear: 0.65 },
    },
  },
  {
    id: 'marstrand', name: ['Marstrand', 'Марстранд'], lat: 57.885, lon: 11.555, wind: 225, tz: 2,
    look: {
      ground: { forest: ['#2c4224', '#3b5530', '#566d3a'], scrub: '#7a7f56', rock: ['#a8988c', '#857870'], town: '#9c8a80', shore: '#a8988a' },
      trees: [['conifer', 0.55, '#22381f', '#36502c'], ['broad', 0.3, '#33502a', '#5a7838'], ['shrub', 0.15, '#4a5a34', '#6f7a48']], treeTop: 200, woods: 0.35,
      walls: ['#8b2d23', '#a03a2c', '#f4f2ec', '#e8e2d0', '#d8c79a', '#7a2a22'], roofs: ['#3f3a38', '#5a3a33', '#8a3b2e', '#4a4d50'], flat: 0.05,
      boats: { sail: 0.85, motor: 0.15, big: 0 },
      water: { deep: '#0a2a36', scatter: '#24706c', k: 0.6, shallow: '#4f8a7c', clear: 0.3 },
    },
  },
  {
    id: 'bermuda', name: ['Bermuda', 'Бермуды'], lat: 32.305, lon: -64.84, wind: 200, tz: -3,
    look: {
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
      ground: { forest: ['#1f3a1e', '#2c4a26', '#43622f'], scrub: '#6a7a48', rock: ['#8e8a7e', '#6f6b62'], town: '#a09c94', shore: '#a89f8c' },
      trees: [['broad', 0.55, '#1f3a1e', '#3f5e2c'], ['conifer', 0.3, '#1c331b', '#2f4a28'], ['pine', 0.15, '#26401f', '#45602f']], snow: 3300, treeTop: 400, woods: 0.9,
      walls: ['#eeece6', '#d9d6ce', '#c8c4ba', '#e6e0d2', '#b9b4aa', '#f4f2ee'], roofs: ['#3e4752', '#4a4d50', '#2f3a46', '#6a6e72'], flat: 0.35,
      boats: { sail: 0.7, motor: 0.3, big: 0 },
      water: { deep: '#062c42', scatter: '#1f8a90', k: 0.4, shallow: '#4a9a8c', clear: 0.3 },
    },
  },
  {
    id: 'weymouth', name: ['Weymouth', 'Уэймут'], lat: 50.605, lon: -2.41, wind: 225, tz: 1,
    look: {
      ground: { forest: ['#2f4a26', '#3e5d2e', '#557a3a'], scrub: '#7a9050', rock: ['#d4ccb4', '#b4aa92'], town: '#a8988a', shore: '#cfc2a0' },
      fields: ['#6f9a45', '#7fa64e', '#8fae55', '#a8b866', '#c2b46a', '#5f8c3e'],
      trees: [['broad', 0.9, '#2f4a26', '#5d7f3a'], ['conifer', 0.1, '#243b22', '#3a5530']], treeTop: 400, woods: 0.3,
      walls: ['#e9dfc8', '#d9ccae', '#f2efe8', '#c8b894', '#a0573f', '#ece3cf'], roofs: ['#4f565c', '#5c6266', '#6b4a3e', '#7a4636'], flat: 0.15,
      boats: { sail: 0.8, motor: 0.2, big: 0 },
      water: { deep: '#0b2e38', scatter: '#2a8278', k: 0.5, shallow: '#4f9484', clear: 0.3 },
    },
  },
  {
    id: 'marseille', name: ['Marseille', 'Марсель'], lat: 43.265, lon: 5.335, wind: 315, tz: 2,
    look: {
      ground: { forest: ['#3a4c2c', '#4a5e34', '#647440'], scrub: '#8a8a5c', rock: ['#d8d2c2', '#b8b0a0'], town: '#c2b8a6', shore: '#d6cfbe' },
      trees: [['pine', 0.4, '#2c4224', '#566d3a'], ['shrub', 0.45, '#3e4d2c', '#6a7640'], ['stone', 0.15, '#2e4626', '#4f6834']], treeTop: 600, woods: 0.45,
      walls: ['#efe3c8', '#e6d2a8', '#f2ebe0', '#d9c39b', '#eadbc0', '#f6f1e6'], roofs: ['#b4603e', '#a5543a', '#c0704a', '#9c4f37'], flat: 0.3,
      boats: { sail: 0.75, motor: 0.25, big: 0 },
      water: { deep: '#04304c', scatter: '#18a6a8', k: 0.35, shallow: '#3cb4aa', clear: 0.6 },
    },
  },
  {
    id: 'rio', name: ['Rio de Janeiro', 'Рио-де-Жанейро'], lat: -22.93, lon: -43.158, wind: 150, tz: -3,
    look: {
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
      ground: { forest: ['#2c4524', '#3c5a2c', '#557236'], scrub: '#7c8452', rock: ['#b8b2a2', '#958f80'], town: '#b0a48c', shore: '#bdb3a0' },
      trees: [['broad', 0.45, '#2c4524', '#58773a'], ['olive', 0.2, '#56603e', '#7f8660'], ['cypress', 0.2, '#25391f', '#3a5230'], ['conifer', 0.15, '#22381f', '#36502c']], snow: 2700, treeTop: 1500, woods: 0.7,
      walls: ['#efe3c8', '#f0d6a8', '#e9c9a0', '#f6f1e6', '#eedbb8', '#e2c08e'], roofs: MED.roofs, flat: 0.1,
      boats: { sail: 0.85, motor: 0.15, big: 0 },
      water: { deep: '#073046', scatter: '#249896', k: 0.45, shallow: '#4aa69a', clear: 0.45 },
    },
  },
  {
    id: 'istanbul', name: ['Istanbul', 'Стамбул'], lat: 40.982, lon: 28.992, wind: 35, tz: 3,
    look: {
      ground: { forest: ['#2e4626', '#3f5a2e', '#5a733a'], scrub: '#7c7e54', rock: ['#b0a690', '#8f8674'], town: '#b2a692', shore: '#bfb39a' },
      trees: [['stone', 0.35, '#2e4626', '#4f6834'], ['broad', 0.4, '#33482a', '#5a7838'], ['cypress', 0.25, '#25391f', '#3a5230']], treeTop: 250, woods: 0.35,
      walls: ['#efe6d2', '#e8dcc4', '#f4f1ea', '#d9c8a8', '#e6d0b8', '#c9c4ba'], roofs: ['#b4603e', '#a5543a', '#9c4f37', '#7e7f80'], flat: 0.45,
      boats: { sail: 0.55, motor: 0.35, big: 0.1, bigKind: 'super' },
      water: { deep: '#0a2e40', scatter: '#24868a', k: 0.45, shallow: '#4a9a8e', clear: 0.3 },
    },
  },
];

export const venueById = (id) => VENUES.find((v) => v.id === id) || VENUES[0];
// whether a course shape is laid at the venue at that length: its `skip` lists the '<shape>:<length>' that don't fit
// its water (never a short course, where today's race goes); lib/venues.ts has the same lists
export const shapeOffered = (v, shape, length) => !(v.skip || []).includes(`${shape}:${length}`);

// Today's race: a venue a day, from the date (UTC), the same for everyone. The days go round all of them in a shuffled
// order, a new one every len days, so each venue comes once in that time and none two days running. lib/race.ts has
// a copy (npm test keeps them in step).
const dayRng = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
function round(k) { // the order of the venues in round k
  const ids = VENUES.map((v) => v.id), r = dayRng((k + 1) * 40503 + 977);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids;
}
export function dailyVenue(date = new Date()) {
  const n = Math.floor(Date.parse(date.toISOString().slice(0, 10)) / 864e5), len = VENUES.length, k = Math.floor(n / len), ids = round(k);
  if (ids[0] === round(k - 1)[len - 1]) [ids[0], ids[1]] = [ids[1], ids[0]]; // not the same place as yesterday
  return ids[n - k * len];
}

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
