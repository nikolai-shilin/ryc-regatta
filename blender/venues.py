# The land of every venue a race goes to, Göcek bay and the famous regatta venues, baked into
# public/game/venues/<id>.bin and <id>.json (Göcek's into public/game/skopea.bin and .json): the real hills from the
# Terrarium elevation tiles, the mountains far beyond them, and from OpenStreetMap (the Overpass API) the coast, the
# woods, fields, towns and beaches, the pontoons and the buildings.
#
#   python3 blender/venues.py [work dir] [--fetch] [id ...]      (all of them when no id is given)
#
# Downloads are kept in <work dir>/<id> (~/.cache/ryc-regatta/venues when no work dir is given), so a second run only
# bakes; --fetch only downloads. Needs numpy and Pillow.
#
# The frame: metres, x east and z south, from the middle of the venue's race area (`home`), turned so that its
# prevailing wind (`wind`, the compass direction it blows from) comes from the game's north (−z), since every race is
# laid with the wind from there. A race in Cowes beats into the Solent's south-westerly, one in Sydney into the
# north-easterly sea breeze, one in Göcek into the afternoon breeze funnelled up the bay from the south-south-west. `turn` in the json
# is that angle, so the game can turn the sun with the land. Göcek's frame is from the town (`origin`), with the race
# area's middle `mid` metres off it (x east, z south, turned with the rest into the json's `home`).
#
# The json holds the small things (the marinas, the piers, the towns, the landmarks) and `parts`: what the .bin holds,
# in order, each padded to 4 bytes. The .bin is gzipped (a host serves a .bin as it is, so it is packed here and
# land.js unpacks it), little-endian. A part marked `rows` is stored as each row's differences from the point before
# it (the first from 0), `seq` as differences along the whole of it, `grad` as each point less its left and upper
# neighbours' prediction of it (left + up − upper-left); all pack far smaller than the values:
#   room     Int8, the sea room on an even grid (`room`): how far to the shore in steps of 4 m, + at sea, − on land
#   tree     bits: the terrain's quadtree, depth first, 1 for a square split in four (children by rows, then columns)
#   drawn    bits: for each leaf of it in the same order, 1 if it has land in it (the rest is under the sea, not drawn)
#   heights  Int16, decimetres: the height at each corner the leaves use, by the lattice's rows and columns (see
#            land.js, which finds the same corners again from the two bit strings)
#   cover    Uint8, on the `grid`: what is on the ground, its class (CLASSES) in the low four bits, a variant of it in the
#            high four (variant(): a field's crop, what a wood's trees are)
#   ao       Uint8, on a grid of twice the cells (`ao`): how much of the sky is open (`ao.k` × 63 all of it), for the
#            shade in valleys
#   depth    Uint8, on the `grid`: the water's depth in decimetres (255 deeper than 25.4 m, 0 ashore)
#   far      Int16, in steps of `far.k` metres: the land beyond, out to `far.ext`, on its own even grid
#   roads    Uint8, on the `near` grid (8 m cells round the race area): 255 on a road
#   shore    Uint8, on the `near` grid: how far out from the shore, in quarters of a metre (0 ashore, 255 past 63 m)
#   calm     Uint8, on the `near` grid: 255 by a built shore (a town's, a port's, the piers), where there is no surf
#   bn, bh, broof, bxz   the buildings: how many corners each has, its height in decimetres (0 unknown), its roof
#            (0 unknown, 1 flat, 2 pitched; or what it is: 3 a church, 4 a mosque, 5 a fortress's ramparts), and all the
#            corners, in metres, as x, z pairs
#   bwall, broofc   each building's walls' and roof's colours as the map has them (building:colour, roof:colour), r g b
#            each; 0 0 0 where it has none
#   pn, pk, pw, pxz   the piers, pontoons, quays and breakwaters: how many points each has, what it is (PIERS, + 8 if it
#            is an area, + 16 if it floats), its width in decimetres (0 unknown), and the points, in half metres
#   tk, txz  the trees the map has one by one (`trees`: its rows of them along the streets and the promenades, and its
#            single trees): what each is (0 a broad-leaved tree, 1 a palm, 2 a conifer), and where, in half metres
import gzip, json, math, os, subprocess, sys, time
import numpy as np
from PIL import Image, ImageColor, ImageDraw, ImageFilter

# home: the middle of the race area, in clear water; wind: the prevailing wind's compass direction (from);
# towns: (lat, lon, radius m) where the houses the map lacks are filled in; landmarks: drawn by the game (skopea.js), each
# along `dir` (its compass bearing), the map's own buildings within `clear` metres of it left out, the ground within
# `level`'s radius laid down to its height;
# bathy: where the sea floor's survey comes from, finer than the elevation tiles' own (EMODnet's in Europe, some 115 m;
# NOAA's on the US coasts, down to a few metres): the depths the sea is lighter over; flat: the land laid flat at so
# many metres (a city whose tiles have its roofs for its ground); bank: how many metres across the shore slopes into the
# water (12 when not given; a city's quays, a few, and no surf along them); most: how many buildings at the most (8,000
# when not given); keep: [(lat, lon, metres)], where every building is kept before any other (an island's fort or
# lighthouse by the course, further off than a big city's middle, which would fill the count first); height_of: {name:
# metres}, the height of a building the map names but gives none (or a wrong one); parts: the tall parts of buildings mapped in three dimensions
# (building:part) drawn too, where a city's towers are mapped so (the building's own outline the podium's height); quays: (metres, slope), the land along the
# shore no higher than so many metres at the water, rising at most so much a metre inland (a port whose tiles keep its piers' sheds and
# terminals as ground, which the map's narrow piers would make cones of); plain: (low, high) metres, a coastal plain whose tiles have its roofs and trees for its ground
# (SRTM's radar): the land up to `low` laid down on the shore's floor and from there back up to the tiles' own at `high`,
# the hills above it as they are; paved: the map's paved squares and promenades drawn as paving; trees: the map's rows
# of trees and its single trees planted where they stand; palms: (streets, metres), a seafront's palms the map lacks, along
# those of its streets that run within so many metres of the water; gulets: (streets, metres), a town quay the gulets lie
# along stern-to, the shore by those streets; routes: the ferries' and the water taxis' ways across the bay, (lat, lon)
# each; kites: the line off a beach the kitesurfers ride along, and how many; footbox: where the footprints are taken
# when it isn't the buildings' own box (`build`); aprons: (south, west, north, east) boxes of a container port's yards, paved
# erode: how much of the gullies erode() cuts back into the hills (1 when not given; 0 where the tiles carry a fine
# survey of their own, whose gullies are already there)
VENUES = {
    'gocek': dict(bathy='emodnet', origin=(36.7525, 28.9395), mid=(-400, 700), wind=195, zoom=14, out='skopea', towns=[(36.7564, 28.9402, 650)],
                  build=(36.705, 28.875, 36.795, 29.005), footprints=('Turkey', '122101223')),
    'cowes': dict(bathy='emodnet', zoom=14, home=(50.7880, -1.3060), wind=225, towns=[(50.7600, -1.2980, 900), (50.7570, -1.2880, 700)]),
    'newport': dict(erode=0, bathy='noaa', zoom=14, home=(41.4570, -71.3600), wind=210, towns=[(41.4850, -71.3150, 1300), (41.4960, -71.3700, 700)],
                    keep=[(41.4777, -71.3405, 450)],  # Fort Adams
                    landmarks=[dict(kind='suspension', a=(41.5052, -71.3598), b=(41.5046, -71.3318), h=122, span=488, deck=58)]),
    'sydney': dict(erode=0, home=(-33.8480, 151.2560), wind=45, towns=[(-33.8700, 151.2550, 1500), (-33.8330, 151.2420, 1300), (-33.8380, 151.2830, 1000), (-33.8650, 151.2150, 1200)],
                   landmarks=[dict(kind='arch', a=(-33.8562, 151.2093), b=(-33.8486, 151.2114), h=134, span=503, deck=49),
                              dict(kind='opera', at=(-33.85730, 151.21513), h=67, clear=95, level=(150, 3.5))]),  # the Opera House on Bennelong Point, its shells' mouths to the harbour
    'kiel': dict(bathy='emodnet', home=(54.4300, 10.2050), wind=250, towns=[(54.4150, 10.1570, 900), (54.4100, 10.2250, 900), (54.4310, 10.1760, 600), (54.3700, 10.1500, 1500)],
                 landmarks=[dict(kind='lighthouse', at=(54.3887, 10.1906), h=32, ground=0),
                            dict(kind='tower', style='laboe', at=(54.41216, 10.23078), h=72, dir=340, clear=14)]),  # the naval memorial, its curved stem to the fjord
    'trieste': dict(bathy='emodnet', home=(45.6720, 13.7280), wind=70, towns=[(45.6500, 13.7700, 1600), (45.6750, 13.7500, 700), (45.6960, 13.7070, 500)],
                    landmarks=[dict(kind='lighthouse', style='vittoria', at=(45.67563, 13.75698), h=68, clear=15)]),  # the Faro della Vittoria on Gretta's hill
    'porto-cervo': dict(bathy='emodnet', home=(41.1520, 9.5650), wind=315, towns=[(41.1340, 9.5340, 600), (41.1050, 9.5150, 500)]),
    'saint-tropez': dict(bathy='emodnet', home=(43.2900, 6.6700), wind=280, towns=[(43.2710, 6.6390, 800), (43.3090, 6.6360, 1000), (43.2930, 6.5870, 600)]),
    'antigua': dict(home=(16.9890, -61.7700), wind=95, towns=[(17.0080, -61.7640, 500), (17.0180, -61.7820, 700)]),
    'auckland': dict(erode=0, zoom=14, home=(-36.8300, 174.8150), wind=225, towns=[(-36.8480, 174.7650, 1500), (-36.8280, 174.7980, 900), (-36.8500, 174.8100, 1300), (-36.8000, 174.7900, 1500)],
                     landmarks=[dict(kind='tower', at=(-36.84846, 174.76218), h=328, style='sky')]),
    'san-francisco': dict(erode=0, bathy='noaa', zoom=14, home=(37.8150, -122.4350), wind=255, towns=[(37.8020, -122.4400, 1100), (37.7960, -122.4120, 1100), (37.8580, -122.4850, 800), (37.8730, -122.4570, 700)],
                          keep=[(37.8267, -122.4230, 300)],  # Alcatraz
                          landmarks=[dict(kind='suspension', style='golden-gate', a=(37.8077, -122.4750), b=(37.8288, -122.4813), h=227, span=1280, deck=67, color='#c0362c'),
                                     dict(kind='tower', style='pyramid', at=(37.79519, -122.40265), h=260, clear=30)]),  # the Transamerica Pyramid
    'valencia': dict(bathy='emodnet', home=(39.4550, -0.2850), wind=110, towns=[(39.4700, -0.3700, 1200), (39.4700, -0.3250, 1000), (39.4300, -0.3300, 800)]),
    'barcelona': dict(bathy='emodnet', home=(41.3720, 2.2250), wind=200, towns=[(41.3850, 2.1800, 1100), (41.3950, 2.2050, 1100), (41.3780, 2.1900, 700), (41.4100, 2.2250, 900),
                                                                    (41.4036, 2.1744, 450)],  # the Eixample's blocks round the Sagrada Família
                      landmarks=[dict(kind='spires', at=(41.4036, 2.1744), h=172.5, dir=135),  # the Sagrada Família: its nave to the Glory façade, south-east
                                 dict(kind='tower', style='glories', at=(41.40351, 2.18952), h=144, clear=20)]),  # the Torre Glòries
    'palma': dict(bathy='emodnet', home=(39.5350, 2.6300), wind=220, towns=[(39.5700, 2.6500, 1200), (39.5350, 2.7200, 800), (39.5550, 2.6000, 700)],
                  landmarks=[dict(kind='cathedral', at=(39.56760, 2.64832), h=44, dir=120, clear=40)]),  # La Seu, its apse to the east-south-east
    'marstrand': dict(bathy='emodnet', home=(57.8850, 11.5550), wind=225, towns=[(57.8860, 11.5850, 500), (57.8900, 11.6000, 500), (57.8650, 11.6000, 400)],
                      landmarks=[dict(kind='fort', at=(57.88624, 11.57767), h=28, clear=[(57.88624, 11.57767, 30), (57.88630, 11.57885, 75)])]),  # Carlsten's round keep at the fortress's south-west corner
    'bermuda': dict(home=(32.3050, -64.8400), wind=200, towns=[(32.2930, -64.7830, 900), (32.3250, -64.8350, 500), (32.3100, -64.8650, 600), (32.2850, -64.8150, 700)]),
    'enoshima': dict(home=(35.2850, 139.4950), wind=190, keep=[(35.2990, 139.4805, 500)], towns=[(35.3100, 139.4800, 1200), (35.3100, 139.5300, 1200), (35.3050, 139.5000, 800)],
                     landmarks=[dict(kind='lighthouse', at=(35.2997, 139.4796), h=60, style='candle')]),
    'weymouth': dict(bathy='emodnet', zoom=14, home=(50.6050, -2.4100), wind=225, towns=[(50.6100, -2.4550, 1100), (50.5550, -2.4400, 900), (50.6300, -2.4400, 700)]),
    'marseille': dict(bathy='emodnet', home=(43.2650, 5.3350), wind=315, keep=[(43.2805, 5.3080, 1100), (43.2799, 5.3254, 200)], towns=[(43.2950, 5.3750, 1200), (43.2750, 5.3650, 900), (43.2600, 5.3800, 700), (43.3100, 5.3650, 1000)],
                      landmarks=[dict(kind='basilica', at=(43.28400, 5.37116), h=60, dir=130, clear=22)]),  # its belfry at the north-west end, the apse to the south-east
    'rio': dict(home=(-22.9300, -43.1580), wind=150, towns=[(-22.9250, -43.1750, 1200), (-22.9000, -43.1150, 1200), (-22.9450, -43.1800, 900), (-22.9700, -43.1850, 1000)],
                landmarks=[dict(kind='statue', at=(-22.95168, -43.21181), h=38, dir=100)]),  # facing the bay; on the tiles' summit of Corcovado, 135 m west of its own
    'garda': dict(home=(45.8400, 10.8500), wind=190, lake='Lago di Garda', towns=[(45.8860, 10.8410, 800), (45.8750, 10.8760, 600), (45.7650, 10.8100, 600), (45.8730, 10.8560, 500)]),
    'istanbul': dict(bathy='emodnet', home=(40.9820, 28.9920), wind=35, keep=[(41.0063, 28.9855, 150), (41.0024, 28.9768, 150)], towns=[(40.9900, 29.0270, 1200), (41.0250, 29.0180, 1200), (41.0080, 28.9650, 1500), (41.0330, 28.9800, 1200), (40.9720, 29.0400, 1000),
                                                                 (41.0430, 29.0060, 900), (41.0480, 29.0250, 700), (41.0365, 29.0310, 600), (41.0440, 29.0440, 700)],  # Beşiktaş, Ortaköy, Kuzguncuk, Beylerbeyi: round the bridge
                     landmarks=[dict(kind='suspension', a=(41.0510, 29.0287), b=(41.0400, 29.0401), h=165, span=1074, deck=64),
                                dict(kind='mosque', at=(41.0054, 28.9767), h=43, minarets=6, mh=64),  # the Blue Mosque
                                dict(kind='mosque', at=(41.0085, 28.9799), h=55, minarets=4, mh=60, semis=2, wall='#c99272'),  # Hagia Sophia
                                dict(kind='mosque', at=(41.0162, 28.9638), h=53, minarets=4, mh=72),  # Süleymaniye
                                dict(kind='tower', at=(41.0256, 28.9741), h=63, style='galata'),
                                dict(kind='lighthouse', style='maiden', at=(41.02108, 29.00412), h=23, clear=18)]),  # the Maiden's Tower on its rock off Üsküdar
    # the Neva under the Peter and Paul Fortress's walls, between the Trinity and Palace bridges; the city's heights in
    # the tiles are its roofs, not its ground (and the river stands 12 to 20 m up in them), so the land is laid flat
    'st-petersburg': dict(zoom=14, flat=2.2, bank=2.5, most=11000, relations=True, home=(59.9464, 30.3187), wind=245,
                          height_of={'Адмиралтейство': 20},  # (the map has none: its two tall storeys over the basement)
                          towns=[(59.9420, 30.2850, 1000), (59.9580, 30.3050, 900), (59.9370, 30.3250, 1100), (59.9590, 30.3420, 800), (59.9480, 30.3500, 700)],
                          landmarks=[dict(kind='spire', style='peter-paul', at=(59.95010, 30.31603), b=(59.95024, 30.31700), h=122.5),  # the cathedral's belfry, the apse to the east
                                     dict(kind='spire', style='admiralty', at=(59.93757, 30.30862), h=72.5),
                                     dict(kind='column', at=(59.94310, 30.30690), h=32, clear=12), dict(kind='column', at=(59.94467, 30.30503), h=32, clear=12),  # the rostral columns
                                     # what stands over the roofs from the river, each in the map's building's place: St Isaac's, its west–east
                                     # axis to the south-east as the city's grid runs; the Saviour on the Spilled Blood, its belfry to the canal
                                     # (west); the Kazan Cathedral's dome, its colonnade's portico to the north-north-east; the Exchange, its front
                                     # to the Strelka; the Kunstkamera's tower over its front to the Neva; the mosque, its portal and minarets to
                                     # the north; the Alexander Column
                                     dict(kind='isaac', at=(59.93408, 30.30616), dir=144, h=101.5, clear=55),
                                     dict(kind='saviour', at=(59.94009, 30.32884), dir=100, h=81, clear=32),
                                     dict(kind='kazan', at=(59.93416, 30.32434), dir=26, h=71.6, clear=[(59.93446, 30.32477, 70)]),
                                     dict(kind='bourse', at=(59.94349, 30.30460), dir=59, h=31.9, clear=55),
                                     dict(kind='kunstkamera', at=(59.94154, 30.30451), dir=46, h=44),
                                     dict(kind='mosque', style='petersburg', at=(59.95519, 30.32392), dir=164, h=39, mh=48, clear=26),
                                     dict(kind='column', style='alexander', at=(59.93904, 30.31582), h=47.5, clear=9),
                                     # the bridges, their spans open for the yachts (n spans, `open` the ones raised, `leaves` each)
                                     dict(kind='drawbridge', a=(59.94649, 30.32951), b=(59.95103, 30.32544), deck=9, w=24, n=7, open=[1], leaves=1, color='#5a6863'),  # Trinity: raised by the left bank
                                     dict(kind='drawbridge', a=(59.94024, 30.30935), b=(59.94214, 30.30682), deck=7, w=28, n=5, open=[2], leaves=2, color='#56645f'),  # Palace
                                     dict(kind='drawbridge', a=(59.94522, 30.30317), b=(59.94735, 30.30362), deck=7, w=24, n=3, open=[1], leaves=2, color='#5d625f'),  # Exchange
                                     dict(kind='drawbridge', a=(59.95012, 30.34896), b=(59.95358, 30.34979), deck=10, w=34, n=6, open=[1], leaves=1, color='#4f5a57'),  # Liteyny
                                     dict(kind='drawbridge', a=(59.93340, 30.29095), b=(59.93612, 30.28831), deck=9, w=37, n=8, open=[6], leaves=2, color='#4f5653')]),  # Blagoveshchensky: raised by Vasilievsky Island
    # Batumi bay, north-east of the cape, in the Black Sea's afternoon breeze: the city, its towers and the Alphabetic
    # Tower on the cape to the left, the coast to Green Cape and the wooded mountains of Adjara to the right
    'batumi': dict(bathy='emodnet', zoom=14, most=11000, relations=True, plain=(12, 30), paved=True, trees=True, home=(41.6720, 41.6800), wind=290,
                   towns=[(41.6480, 41.6400, 1000), (41.6400, 41.6250, 1100), (41.6280, 41.6150, 1000), (41.6500, 41.6560, 700), (41.6700, 41.7080, 900), (41.6900, 41.7180, 800)],
                   landmarks=[dict(kind='tower', at=(41.65596, 41.63935), h=130, style='alphabet'),
                              dict(kind='wheel', at=(41.65535, 41.64260), b=(41.65560, 41.64420), h=55),  # the Batumi Wheel, turning along the shore
                              dict(kind='lighthouse', at=(41.65590, 41.64107), h=21)]),  # the lighthouse of 1882 beside it
    # the North Sea off Scheveningen's beach, the pier and the Kurhaus, in the south-westerly along the shore
    'scheveningen': dict(bathy='emodnet', zoom=14, most=11000, relations=True, home=(52.1228, 4.2662), wind=225, towns=[(52.1110, 4.2840, 1000), (52.1000, 4.2700, 900), (52.0900, 4.3000, 1300)],
                         landmarks=[dict(kind='lighthouse', at=(52.10414, 4.26828), h=49),
                                    dict(kind='wheel', at=(52.11734, 4.28104), b=(52.11760, 4.28066), h=40, base=8)]),  # the pier's big wheel, on its deck
    # Victoria Harbour between Wan Chai and Tsim Sha Tsui, in the easterly; every tower on the map, none made up. The
    # tiles' land is the towers' roofs (SRTM's radar), so the ground is Hong Kong's own survey's (`dtm`, hk_dtm)
    'hong-kong': dict(dtm='hk', zoom=14, most=11000, relations=True, home=(22.2884, 114.1781), wind=80, towns=[(22.2830, 114.1580, 1200), (22.2960, 114.1700, 1000), (22.3030, 114.1620, 900), (22.2800, 114.1800, 1000), (22.2900, 114.1950, 900)],
                      landmarks=[dict(kind='tower', style='boc', at=(22.279265, 114.16157), b=(22.27956, 114.16139), h=367, clear=40),  # the Bank of China Tower, `b` a corner
                                 dict(kind='wheel', at=(22.28530, 114.16175), b=(22.28538, 114.16200), h=60)]),  # the Observation Wheel on Central's waterfront, facing the harbour
    # Table Bay off the V&A Waterfront, in the south-easterly Cape Doctor off Table Mountain
    'cape-town': dict(zoom=14, most=11000, relations=True, plain=(15, 45), paved=True, trees=True, home=(-33.8978, 18.4556), wind=160, towns=[(-33.9050, 18.4200, 1000), (-33.9150, 18.3950, 900), (-33.9230, 18.4250, 1200)],
                      landmarks=[dict(kind='lighthouse', style='green-point', at=(-33.90142, 18.39992), h=16),
                                 dict(kind='wheel', at=(-33.90268, 18.41929), b=(-33.90238, 18.41924), h=40)]),  # the Cape Wheel at the V&A Waterfront, facing the bay
    # the 2004 Olympic waters in Faliro Bay, in the meltemi off the land, the Acropolis upwind
    'athens': dict(bathy='emodnet', zoom=14, most=11000, relations=True, home=(37.9115, 23.6765), wind=30, towns=[(37.9300, 23.6900, 1200), (37.9400, 23.6450, 1200), (37.9120, 23.7080, 1000)],
                   landmarks=[dict(kind='temple', at=(37.97150, 23.72662), b=(37.97158, 23.72738), h=14)]),  # the Parthenon, its long axis to the east
    # Marmaris bay, of the Race Week and the winter series, in the westerly over İçmeler: the castle on its hill above
    # the old town and Netsel's pontoons to leeward, the pine mountains all round the bay
    'marmaris': dict(bathy='emodnet', zoom=14, most=15000, relations=True, footprints=('Turkey', '122101222'), footbox=(36.790, 28.210, 36.870, 28.330),
                     gulets=(['Barbaros Caddesi'], 30),
                     routes=[dict(kind='ferry', pts=[(36.84051, 28.28226), (36.83471, 28.27726), (36.82178, 28.27416), (36.81245, 28.27066), (36.80327, 28.26524), (36.78466, 28.26275)]),  # to Rhodes, out by the bay's south mouth
                             dict(kind='taxi', pts=[(36.80186, 28.23892), (36.81487, 28.24697), (36.83002, 28.24938), (36.84038, 28.25468), (36.84694, 28.26016), (36.84919, 28.27152)]),  # İçmeler to the old town, along the west shore
                             dict(kind='taxi', pts=[(36.84624, 28.27601), (36.83613, 28.28195), (36.82149, 28.28940)])],  # to the island in the bay
                     paved=True, trees=True, palms=(['Atatürk Caddesi', 'Kordon Caddesi', 'Gezi Yolu Caddesi', 'Barbaros Caddesi', '207. Sokak'], 45),
                     home=(36.8300, 28.2620), wind=265,  # (Windfinder's station: W June to September, WSW in May and October)
                     towns=[(36.8530, 28.2720, 1100), (36.8560, 28.2500, 900), (36.8460, 28.2950, 900), (36.8060, 28.2370, 900), (36.8230, 28.3080, 500)],
                     landmarks=[dict(kind='castle', at=(36.85056, 28.27426), h=9, clear=40, ring=[(36.850350, 28.274480), (36.850353, 28.274388), (36.850414, 28.274388), (36.850417, 28.274168), (36.850378, 28.274168), (36.850374, 28.274072), (36.850696, 28.274016), (36.850730, 28.274265), (36.850777, 28.274273), (36.850769, 28.274375), (36.850724, 28.274375), (36.850711, 28.274477), (36.850468, 28.274463), (36.850436, 28.274504)]),  # its walls, the map's outline of it
                                dict(kind='monument', at=(36.852946, 28.270857), h=4.5),  # Atatürk's statue on the seafront square
                                dict(kind='flag', at=(36.85062, 28.27424), h=18, w=8),  # the flag over the castle
                                dict(kind='flag', at=(36.84639, 28.25444), h=12, w=4), dict(kind='flag', at=(36.84641, 28.25443), h=12, w=4),
                                dict(kind='boatyard', at=(36.81760, 28.30700), ring=[(36.818695, 28.305466), (36.818786, 28.307823), (36.818134, 28.309541), (36.817230, 28.308048), (36.816452, 28.306005), (36.817528, 28.303861)])]),  # the yachts ashore on their cradles at Adaköy
    # Fethiye's bay inside Şövalye island, in the afternoon westerly (Windfinder's station: W March to October): the town all round to leeward, its castle and the
    # Lycian tombs cut in the hill over the harbour, Babadağ above
    'fethiye': dict(bathy='emodnet', zoom=14, most=15000, relations=True, gulets=(['Fevzi Çakmak Caddesi'], 30),
                    routes=[dict(kind='ferry', pts=[(36.62286, 29.10318), (36.62754, 29.09863), (36.63650, 29.10038), (36.64486, 29.09769), (36.65015, 29.08703), (36.65682, 29.06977), (36.66137, 29.05678)]),  # to Rhodes, out between the island and the point
                            dict(kind='taxi', pts=[(36.62286, 29.10318), (36.63738, 29.10070), (36.64732, 29.10133), (36.65343, 29.10873), (36.65946, 29.10939), (36.66282, 29.10806)]),  # the harbour to Çalış, round the north of the bay
                            dict(kind='taxi', pts=[(36.62321, 29.10209), (36.62750, 29.09918), (36.63738, 29.10070), (36.64739, 29.10044)])],  # to Şövalye's jetties
                    kites=dict(a=(36.65600, 29.10750), b=(36.67660, 29.09400), n=7),  # off Çalış beach
                    paved=True, trees=True, palms=(['Fevzi Çakmak Caddesi', 'Yürüyüş Yolu Caddesi', 'Cahit Gündüz Caddesi', 'Mustafa Kemal Bulvarı'], 45),
                    home=(36.6340, 29.1100), wind=275, build=(36.600, 29.060, 36.680, 29.150), footprints=('Turkey', '122101223'),  # (Göcek's quadkey)
                    towns=[(36.6220, 29.1130, 1100), (36.6250, 29.0950, 700), (36.6650, 29.1100, 1000), (36.6380, 29.1300, 900)],
                    landmarks=[dict(kind='castle', at=(36.61860, 29.11340), h=7, ruin=True, clear=75, keep=(36.61862, 29.11358),  # the tower's stump at `keep`
                                    ring=[(36.618457, 29.112578), (36.618810, 29.112657), (36.618909, 29.112813), (36.618954, 29.113082), (36.619072, 29.113295), (36.619126, 29.113697), (36.619090, 29.114011), (36.618963, 29.114179), (36.618412, 29.114067), (36.618150, 29.113798), (36.618222, 29.113216), (36.618240, 29.112892)]),
                               dict(kind='tombs', at=(36.61869, 29.11814), h=11),  # the Tomb of Amyntas, the others beside it
                               dict(kind='theatre', at=(36.621162, 29.105859), b=(36.620750, 29.105880), r=31, clear=[(36.620900, 29.105870, 38)]),  # Telmessos's theatre on the harbour front, its seats up the slope from `at` towards `b`
                               dict(kind='sarcophagus', at=(36.622588, 29.111847), dir=20),  # the Lycian sarcophagus in the street by the town hall
                               dict(kind='sarcophagus', at=(36.620413, 29.117517), dir=70), dict(kind='sarcophagus', at=(36.620051, 29.117267), dir=150),
                               dict(kind='sarcophagus', at=(36.620678, 29.116730), dir=110),  # and those on the slope under the rock tombs
                               dict(kind='monument', at=(36.623932, 29.112759), h=4.5),  # Atatürk's statue on the harbour front
                               dict(kind='flag', at=(36.618043, 29.112548), h=25, w=12)]),  # the great flag on the castle's hill
    # the Black Sea off Sochi's sea terminal, in the afternoon south-westerly off the sea, the town along the shore to
    # leeward and the Caucasus behind it
    'sochi': dict(bathy='emodnet', zoom=14, most=15000, relations=True, parts=True, paved=True, trees=True, home=(43.5640, 39.6970), wind=225,
                  palms=(['Несебрская улица', 'улица Круизная гавань'], 45),  # the palms by the sea terminal and the marina
                  towns=[(43.5850, 39.7230, 1200), (43.6000, 39.7150, 900), (43.5650, 39.7450, 900)],
                  landmarks=[dict(kind='spire', style='sochi', at=(43.58045, 39.71061), h=71, dir=225)]),  # the sea terminal's tower and spire over the map's building, its front to the sea
    # Port Phillip off St Kilda, of the 1956 Olympic regatta, in the afternoon sea breeze off Bass Strait; the city's
    # towers to leeward. The bay's shores are low and the tiles' radar has their roofs and trees for the ground
    'melbourne': dict(zoom=14, most=15000, relations=True, parts=True, plain=(10, 30), paved=True, trees=True, home=(-37.8800, 144.9450), wind=200,
                      palms=(['Jacka Boulevard', 'Marine Parade', 'Beaconsfield Parade', 'Fitzroy Street'], 45),  # St Kilda's Canary Island palms
                      kites=dict(a=(-37.87300, 144.97900), b=(-37.88600, 144.98350), n=6),  # off St Kilda and Elwood beaches in the sea breeze
                      towns=[(-37.8650, 144.9820, 1000), (-37.8400, 144.9400, 1000), (-37.8610, 144.8990, 900), (-37.8820, 144.9880, 900), (-37.8350, 144.9600, 900)]),
    # the Pacific off Surfers Paradise's beach and towers, in the easterly sea breeze; the coastal plain's ground in the
    # tiles is its roofs and trees (`plain`)
    'gold-coast': dict(zoom=14, most=15000, relations=True, parts=True, plain=(10, 30), paved=True, trees=True, home=(-28.0000, 153.4550), wind=90,
                       palms=(['The Esplanade', 'Esplanade', 'Main Beach Parade'], 140),  # (behind the wide beach)
                       landmarks=[dict(kind='tower', style='q1', at=(-28.006235, 153.429706), h=322.5, dir=141, la=24.5, lb=18, clear=30)],  # Q1, its glass crown and spire (the map has it 2 storeys high, or a 323 m block)
                       towns=[(-28.0000, 153.4280, 1000), (-27.9750, 153.4270, 900), (-28.0300, 153.4320, 1000), (-27.9700, 153.4050, 1100)]),
    # the Upper Bay by the Statue of Liberty, in the summer's south-south-westerly up the Narrows: Lower Manhattan, the
    # Brooklyn Bridge and Jersey City to leeward, the Verrazzano-Narrows Bridge to windward. The tiles here are the
    # USGS's bare earth, so the ground is the ground (erode=0)
    'new-york': dict(erode=0, bathy='noaa', zoom=14, most=15000, relations=True, parts=True, paved=True, quays=(2.5, 0.15), home=(40.6750, -74.0350), wind=200,
                     routes=[dict(kind='si', pts=[(40.70050, -74.01350), (40.68800, -74.02300), (40.65600, -74.05900), (40.64350, -74.07150)])],  # the Staten Island Ferry, Whitehall to St George
                     height_of={'2 World Trade Center': 6},  # (the map has the tower it will be; its site is still only the podium's base)
                     keep=[(40.7100, -74.0120, 900), (40.6990, -74.0397, 250), (40.6895, -74.0168, 600)],  # Lower Manhattan, Ellis Island, Governors Island
                     towns=[(40.7080, -74.0100, 1200), (40.7150, -74.0400, 1200), (40.6800, -74.0050, 1200), (40.6650, -74.1000, 1000), (40.6430, -74.0770, 1000)],
                     landmarks=[dict(kind='statue', style='liberty', at=(40.68925, -74.04454), h=93, dir=135, clear=60),  # on Fort Wood's star, facing the Narrows
                                dict(kind='suspension', a=(40.60242, -74.05724), b=(40.61058, -74.03206), h=211, span=1298, deck=69),  # the Verrazzano-Narrows
                                dict(kind='tower', style='owtc', at=(40.713044, -74.013208), b=(40.713394, -74.013356), h=541, clear=40),  # One World Trade Center, `b` a corner of its base
                                dict(kind='suspension', style='brooklyn', a=(40.70908, -74.00073), b=(40.70222, -73.99211), h=84, span=486, deck=41)]),
    # the Bay of Naples off Posillipo and the Via Caracciolo, the America's Cup's waters of 2027, in the afternoon sea
    # breeze: Castel dell'Ovo and the city up its hill to leeward, Vesuvius beyond
    'naples': dict(bathy='emodnet', zoom=14, most=15000, relations=True, parts=True, paved=True, trees=True, home=(40.8060, 14.2320), wind=230,
                   palms=(['Via Francesco Caracciolo', 'Via Partenope'], 70),  # the seafront's palms, where the race village of 2027 stands
                   height_of={"Castel dell'Ovo": 24, "Castel Sant'Elmo": 22, 'Castel Nuovo': 32},  # (the map has them with no height)
                   keep=[(40.8283, 14.2478, 300), (40.8437, 14.2388, 300), (40.8384, 14.2533, 250)],  # Castel dell'Ovo, Sant'Elmo over the city, Castel Nuovo
                   routes=[dict(kind='ferry', pts=[(40.83850, 14.26000), (40.83650, 14.27600), (40.82800, 14.27900), (40.80000, 14.27000), (40.75500, 14.25200)])],  # the hydrofoils from the Molo Beverello to Capri
                   landmarks=[dict(kind='lighthouse', style='plain', at=(40.83285, 14.27213), h=22, ground=0, foot=4, tower='#e9e4d8', band='#b5362c')],  # the light on the end of the Molo San Vincenzo
                   towns=[(40.8350, 14.2450, 1300), (40.8450, 14.2650, 1200), (40.8250, 14.2100, 1000), (40.8200, 14.3000, 1200)]),
    # San Pedro Bay outside the Federal Breakwater, the 2028 Olympic waters, in the afternoon westerly: the Port of Los
    # Angeles, Long Beach and the Queen Mary to leeward, the Palos Verdes hills to windward
    'los-angeles': dict(erode=0, bathy='noaa', zoom=14, most=15000, relations=True, parts=True, paved=True, trees=True, quays=(3, 0.15), home=(33.7000, -118.1950), wind=255,
                        aprons=[(33.7325, -118.2100, 33.7480, -118.1835), (33.7220, -118.2650, 33.7440, -118.2380), (33.7440, -118.2650, 33.7650, -118.2150), (33.7440, -118.2150, 33.7700, -118.1960)],  # Pier J, Piers 300 and 400, Terminal Island, Piers F to T
                        palms=(['East Ocean Boulevard', 'West Ocean Boulevard', 'Shoreline Drive', 'Harbor Boulevard'], 150),
                        kites=dict(a=(33.75350, -118.14400), b=(33.74900, -118.11700), n=8),  # off Belmont Shore, the 2028 Games' kite and windsurfing beach
                        routes=[dict(kind='ferry', pts=[(33.74960, -118.27450), (33.73000, -118.27000), (33.71450, -118.25400), (33.69000, -118.27500), (33.66500, -118.31000)])],  # the Catalina Express out by Angels Gate
                        landmarks=[dict(kind='liner', at=(33.75280, -118.18960), dir=350, clear=[(33.75280, -118.18960, 175)]),  # the Queen Mary at Pier J
                                   dict(kind='suspension', a=(33.74960, -118.27900), b=(33.74930, -118.26650), h=111, span=457, deck=56, color='#4f8f78', cable='#4a7f6c'),  # the Vincent Thomas Bridge, in its green
                                   dict(kind='cablestay', a=(33.76483, -118.22245), b=(33.76483, -118.21915), h=157, deck=62),  # the Long Beach International Gateway
                                   dict(kind='cranes', a=(33.73640, -118.19480), b=(33.73640, -118.18680), n=8, color='#2e6da4'),  # Pier J's container quay, facing the breakwater
                                   dict(kind='cranes', a=(33.72800, -118.24406), b=(33.73700, -118.24406), n=8, color='#c8452f'),  # Pier 400
                                   dict(kind='lighthouse', style='plain', at=(33.72323, -118.18688), h=13, ground=0, sides=4, tower='#eeeee8', foot=6),  # the Long Beach Light, on the breakwater
                                   dict(kind='lighthouse', style='plain', at=(33.70855, -118.25162), h=22, ground=0, sides=8, tower='#efefe9', band='#25282b', foot=9)],  # the Angels Gate Light
                        towns=[(33.7700, -118.1900, 1300), (33.7450, -118.2900, 1200), (33.7650, -118.1400, 1200), (33.7300, -118.3100, 1000)]),
    # the Bay of Biscay off Les Sables-d'Olonne, where the Vendée Globe starts and ends, in the westerly: the channel
    # between La Chaume and the Remblai's long beach to leeward
    'les-sables': dict(bathy='emodnet', zoom=14, most=15000, relations=True, plain=(8, 25), paved=True, trees=True, home=(46.4750, -1.8350), wind=285,
                       keep=[(46.4939, -1.7957, 300), (46.4899, -1.7947, 250)],  # La Chaume's keep and the Prieuré Saint-Nicolas
                       routes=[dict(kind='taxi', pts=[(46.49285, -1.79342), (46.49460, -1.79380), (46.49612, -1.79487)])],  # le passeur, across the channel to La Chaume
                       landmarks=[dict(kind='lighthouse', style='arundel', at=(46.49390, -1.79572), h=26, clear=14),  # the Tour d'Arundel
                                  dict(kind='lighthouse', style='plain', at=(46.49505, -1.84166), h=25, ground=0, tower='#b8b2a4', foot=10),  # the Phare des Barges on its reef
                                  dict(kind='lighthouse', style='plain', at=(46.48983, -1.80477), h=39, sides=6, tower='#f4f2ea', cap='#b5362c', clear=12),  # l'Armandèche
                                  dict(kind='lighthouse', style='plain', at=(46.48723, -1.79199), h=9, ground=0, foot=3, tower='#f0eee6', band='#2e8a4f'),  # the channel's two jetty lights, green
                                  dict(kind='lighthouse', style='plain', at=(46.49065, -1.79176), h=9, ground=0, foot=3, tower='#f0eee6', band='#c23a30')],  # and red
                       towns=[(46.4980, -1.7850, 1000), (46.5000, -1.7980, 700), (46.5050, -1.7700, 1000)]),
    # the Gulf off Jumeirah in the shamal: the Burj Al Arab, the Palm and the towers of the Marina on one side, the
    # World's islands on the other, the Burj Khalifa over the city
    'dubai': dict(zoom=14, most=15000, relations=True, parts=True, plain=(8, 25), paved=True, trees=True, home=(25.1680, 55.1750), wind=315,
                  palms=(['Jumeirah Beach Road', 'Al Mina Street', 'Palm Jumeirah Road'], 400),
                  kites=dict(a=(25.15650, 55.19900), b=(25.17000, 55.21300), n=8),  # Kite Beach in the shamal
                  routes=[dict(kind='ferry', pts=[(25.14050, 55.19300), (25.19500, 55.23000), (25.24500, 55.26500), (25.26500, 55.27500)])],  # the Dubai Ferry along the coast to the old creek
                  keep=[(25.1412, 55.1853, 300), (25.1383, 55.1278, 400)],  # the Burj Al Arab's island, Atlantis The Royal
                  landmarks=[dict(kind='tower', style='burj-al-arab', at=(25.14119, 55.18555), h=321, dir=135, clear=80),  # the sail bellying towards the shore
                             dict(kind='tower', style='khalifa', at=(25.19704, 55.27421), h=828, dir=20, clear=90),
                             dict(kind='wheel', at=(25.08005, 55.12379), b=(25.08030, 55.12550), h=250, base=2)],  # Ain Dubai on Bluewaters
                  towns=[(25.1350, 55.2000, 1300), (25.1900, 55.2500, 1400), (25.0800, 55.1400, 1200)]),
    # Biscayne Bay off Coconut Grove, of the Bacardi Cup, in the south-easterly trade wind: Key Biscayne to windward, the
    # towers of Brickell and downtown up the bay
    'miami': dict(erode=0, bathy='noaa', zoom=14, most=15000, relations=True, parts=True, paved=True, trees=True, home=(25.6950, -80.2050), wind=110,
                  palms=(['South Bayshore Drive', 'Bayshore Drive', 'Brickell Avenue', 'Crandon Boulevard'], 300),
                  kites=dict(a=(25.74450, -80.17850), b=(25.74250, -80.16900), n=7),  # off Hobie Beach on the Rickenbacker Causeway
                  routes=[dict(kind='taxi', pts=[(25.72650, -80.23100), (25.72200, -80.22650), (25.71900, -80.22000)])],  # the launch out to Dinner Key's mooring field
                  landmarks=[dict(kind='lighthouse', style='plain', at=(25.66659, -80.15596), h=29, tower='#f6f4ec', clear=10),  # the Cape Florida Light of 1825
                             dict(kind='stilt', at=(25.65350, -80.17520), dir=40, color='#e8d9b8'), dict(kind='stilt', at=(25.65200, -80.17380), dir=120, color='#d9e4dc'),  # Stiltsville, on the flats
                             dict(kind='stilt', at=(25.65080, -80.17220), dir=75, color='#efe4c8'), dict(kind='stilt', at=(25.64900, -80.17120), dir=10, color='#cfdde6'),
                             dict(kind='stilt', at=(25.64720, -80.17000), dir=150, color='#e6cdb8')],
                  towns=[(25.7300, -80.2400, 1300), (25.7600, -80.1950, 1200), (25.6900, -80.1650, 900)]),
    # the Split Channel in the summer's maestral: the Riva and Diocletian's palace behind Marjan's wooded hill, Mosor
    # over the city, Brač and Šolta across the water
    'split': dict(bathy='emodnet', zoom=14, most=15000, relations=True, paved=True, trees=True, home=(43.4650, 16.4200), wind=300,
                  palms=(['Obala hrvatskog narodnog preporoda', 'Obala Lazareta'], 60),  # the Riva's palms
                  keep=[(43.5083, 16.4400, 320)],  # Diocletian's palace
                  routes=[dict(kind='ferry', pts=[(43.50370, 16.43960), (43.49500, 16.44500), (43.44000, 16.50000), (43.39200, 16.55200)])],  # the ferry to Supetar on Brač
                  landmarks=[dict(kind='tower', style='domnius', at=(43.50809, 16.44027), h=60, dir=268, clear=32),  # the cathedral's bell tower, the mausoleum to its east
                             dict(kind='lighthouse', style='plain', at=(43.50114, 16.43622), h=13, ground=0, foot=4, tower='#f0eee6', band='#2e8a4f')],  # the harbour breakwater's light
                  towns=[(43.5100, 16.4450, 1300), (43.5100, 16.4800, 1200), (43.4300, 16.6900, 800), (43.3800, 16.3500, 600)]),
    # the Ligurian Sea off Port Hercule in the sea breeze: the Rock, Monte Carlo's towers and the Alps' last cliffs
    'monaco': dict(bathy='emodnet', zoom=14, most=15000, relations=True, parts=True, paved=True, trees=True, home=(43.7200, 7.4400), wind=135,
                   palms=(['Boulevard Albert 1er', 'Quai Albert 1er', 'Avenue de la Porte Neuve'], 90),
                   height_of={'Tour Odéon': 170},
                   keep=[(43.7315, 7.4230, 520), (43.7392, 7.4280, 300), (43.7480, 7.4302, 200)],  # the Rock, the Casino's square, the Tour Odéon
                   routes=[dict(kind='taxi', pts=[(43.73400, 7.42050), (43.73520, 7.42250), (43.73650, 7.42450)])],  # the bateau-bus across Port Hercule
                   landmarks=[dict(kind='oceano', at=(43.73066, 7.42553), dir=150, h=85, clear=48),  # the Oceanographic Museum's front, on the cliff over the sea
                              dict(kind='casino', at=(43.73916, 7.42802), dir=130, clear=48)],  # its twin towers to the sea
                   towns=[(43.7350, 7.4200, 700), (43.7420, 7.4300, 800), (43.7500, 7.4450, 800)]),
    # Gage Roads off Fremantle, of the 1987 America's Cup, in the south-westerly Fremantle Doctor: the port's moles and
    # cranes to leeward, Rottnest on the horizon
    'fremantle': dict(zoom=14, most=15000, relations=True, plain=(10, 30), paved=True, trees=True, home=(-32.0450, 115.7000), wind=225,
                      aprons=[(-32.0475, 115.7385, -32.0385, 115.7520)],  # North Quay's container yard
                      kites=dict(a=(-32.03000, 115.74800), b=(-32.01800, 115.75000), n=7),  # off Leighton Beach in the Doctor
                      keep=[(-32.0560, 115.7414, 420)],  # the West End and the Round House
                      routes=[dict(kind='ferry', pts=[(-32.05281, 115.74043), (-32.05500, 115.72900), (-32.02500, 115.70500), (-31.99500, 115.56000)])],  # the Rottnest ferry from B Shed, north of the race area
                      landmarks=[dict(kind='cranes', a=(-32.04560, 115.74310), b=(-32.04090, 115.74770), n=6, color='#2f77b5'),  # North Quay's container cranes
                                 dict(kind='lighthouse', style='plain', at=(-32.05388, 115.72455), h=14, ground=0, foot=5, tower='#c23a30'),  # the North Mole's red light
                                 dict(kind='lighthouse', style='plain', at=(-32.05587, 115.73253), h=14, ground=0, foot=5, tower='#2e8a4f')],  # the South Mole's green one
                      towns=[(-32.0550, 115.7500, 1200), (-32.0200, 115.7550, 1100), (-32.0900, 115.7600, 1000)]),
    # the Caribbean off Simpson Bay in the easterly trade wind: Maho's runway and Cupecoy's cliffs to leeward, the
    # island's green hills ashore
    'sint-maarten': dict(zoom=14, most=15000, relations=True, paved=True, trees=True, home=(18.0120, -63.1050), wind=95,
                         palms=(['Front Street', 'Waterfront Road', 'Airport Road', 'Welfare Road'], 120),
                         routes=[dict(kind='taxi', pts=[(18.02300, -63.04800), (18.01900, -63.05200), (18.01700, -63.05500)])],  # Great Bay's water taxis to the cruise pier
                         landmarks=[dict(kind='runway', a=(18.03952, -63.11876), b=(18.04245, -63.09822), w=45),  # Princess Juliana's, the airliners coming in over Maho Beach
                                    dict(kind='castle', at=(18.01540, -63.05930), h=5, ruin=True, clear=40)],  # Fort Amsterdam's walls, on the point between Great Bay and Little Bay
                         towns=[(18.0350, -63.0950, 900), (18.0250, -63.0500, 900), (18.0400, -63.1200, 600)]),
    # the Andaman Sea off Kata and Karon, of the King's Cup, in the winter's north-easterly monsoon: the beaches and
    # the Big Buddha's hill to windward
    'phuket': dict(zoom=14, most=15000, relations=True, paved=True, trees=True, home=(7.7850, 98.2550), wind=60,
                   palms=(['Patak Road', 'Kata Noi Road', 'Karon Soi 2 Road'], 300),
                   routes=[dict(kind='taxi', pts=[(7.81850, 98.29500), (7.81500, 98.29200), (7.81300, 98.28900)])],  # the longtails from Kata Beach out to Ko Pu
                   landmarks=[dict(kind='statue', style='buddha', at=(7.82768, 98.31324), h=45, dir=90, clear=120),  # the Big Buddha on Nakkerd Hill, facing Chalong Bay
                              dict(kind='lighthouse', style='plain', at=(7.76220, 98.30560), h=12, tower='#f4f2ea', clear=10)],  # Promthep Cape's light
                   towns=[(7.8200, 98.3000, 800), (7.8450, 98.2950, 900), (7.8900, 98.2950, 1000)]),
    # the Tbilisi Sea, the reservoir in the dry hills over the city, its length laid along the north-westerly that blows
    # down it: the Chronicle of Georgia's pillars on the hill at its head, the TV tower on Mtatsminda beyond the ridge
    'tbilisi-sea': dict(zoom=14, most=15000, relations=True, paved=True, trees=True, home=(41.7500, 44.8405), wind=305, lake='თბილისის წყალსაცავი',
                        landmarks=[dict(kind='chronicle', at=(41.77059, 44.81039), h=35, ring=[(41.77040, 44.81082), (41.77033, 44.81026), (41.77047, 44.80998), (41.77057, 44.80996), (41.77076, 44.81014), (41.77084, 44.81072)]),  # its sixteen pillars, along the map's outline of them, open to the east
                                   dict(kind='tower', style='tbilisi-tv', at=(41.69582, 44.78495), h=274.5, clear=30)],  # the lattice tower of 1972
                        towns=[(41.7568, 44.8505, 800), (41.7779, 44.8474, 900), (41.7357, 44.8159, 900), (41.7119, 44.8658, 900)]),
}

# what is on the ground (the cover part), from OpenStreetMap's land use; 0 where the map has nothing, which the game
# fills in from the venue's own look. A later class in LAYERS is laid over an earlier one.
CLASSES = ['unknown', 'forest', 'scrub', 'grass', 'farmland', 'orchard', 'town', 'industry', 'sand', 'rock', 'wetland', 'water', 'mud', 'paved']
LAYERS = [  # (class, tags)
    ('farmland', {'landuse': ['farmland', 'meadow', 'farmyard', 'greenhouse_horticulture', 'plant_nursery']}),
    ('grass', {'landuse': ['grass', 'village_green', 'recreation_ground', 'cemetery', 'allotments'], 'natural': ['grassland'], 'leisure': ['park', 'golf_course', 'garden', 'pitch']}),
    ('orchard', {'landuse': ['orchard', 'vineyard']}),
    ('scrub', {'natural': ['scrub', 'heath']}),
    ('forest', {'landuse': ['forest'], 'natural': ['wood']}),
    ('wetland', {'natural': ['wetland']}),
    ('town', {'landuse': ['residential', 'retail', 'commercial', 'garages']}),
    ('industry', {'landuse': ['industrial', 'port', 'railway', 'construction', 'brownfield', 'quarry', 'military']}),
    ('paved', {'paved': ['yes']}),  # (the `paved` venues' squares and promenades, tagged so as they are fetched)
    ('rock', {'natural': ['bare_rock', 'scree', 'rock', 'shingle']}),
    ('sand', {'natural': ['sand', 'beach']}),
    ('mud', {'natural': ['mud'], 'wetland': ['tidalflat']}),
    ('water', {'natural': ['water'], 'waterway': ['riverbank'], 'landuse': ['reservoir', 'basin']}),
]
# each cover cell's high four bits: a variant of its class, the same over each of the map's areas (a field's crop, a
# town's tint); for a wood, what its trees are (1 needle-leaved, 2 broad-leaved, 3 mixed)
LEAF = {'needleleaved': 1, 'broadleaved': 2, 'mixed': 3}
def variant(cls, el):
    if cls == 'forest': return LEAF.get(el.get('tags', {}).get('leaf_type'), 0)
    return (el['id'] * 2654435761 >> 9) % 15 + 1

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
WORK = ARGS.pop(0) if ARGS and ARGS[0] not in VENUES else os.path.expanduser('~/.cache/ryc-regatta/venues')
GAME = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'game')
ZOOM = 13  # some 19 m a pixel at the equator: finer than the SRTM under most of it
EXTENT = 8500.0  # the terrain reaches this far each way
N = 2048  # the terrain's lattice: N × N cells of some 8.3 m
LC = 2 * EXTENT / N
SC, R = 20, 508  # the sea room's cell and reach
CC = 20.0  # the cover, the open sky and the depth: 20 m cells over the terrain's square
NCC = int(2 * EXTENT / CC)
FZOOM, FEXT, FCELL = 9, 64000.0, 400.0  # the land beyond: out to 64 km, 400 m cells
NE, EC = 1250, 8.0  # the roads and the distance out from the shore (for the surf): 8 m cells, 5 km each way
NF = int(2 * FEXT / FCELL) + 1


def fetch(path, url, data=None, tries=6):
    """curl into path once, retrying with a growing wait; the servers (Overpass above all) turn away a busy minute"""
    if os.path.exists(path) and os.path.getsize(path) > 200: return path
    wait = 8
    for k in range(tries):
        cmd = ['curl', '-s', '-L', '-m', '300' if data is not None else '120', '-A', 'regatta-venue-build/1.0', '-o', path, '-w', '%{http_code}']
        if data is not None: cmd += ['--data-urlencode', 'data=' + data]
        r = subprocess.run(cmd + [url], capture_output=True, text=True)
        if r.stdout == '200' and os.path.getsize(path) > 0: return path
        if os.path.exists(path): os.remove(path)
        print('  failed', url[:60], r.stdout, flush=True)
        if k + 1 < tries: time.sleep(wait); wait = min(wait * 2, 90)
    raise SystemExit('could not fetch ' + url)


# the main server turns a busy minute away (502, 504) but answers a retry; VK's mirror answers when it is at capacity
# for hours; the other is slower to fail, so tried less
MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'] * 2 + ['https://overpass.private.coffee/api/interpreter']


def overpass(work, name, q):
    p = os.path.join(work, name + '.json')
    if not (os.path.exists(p) and os.path.getsize(p) > 200):
        for i in range(12):
            try:
                fetch(p, MIRRORS[i % len(MIRRORS)], f'[out:json][timeout:240];{q}', tries=1)
                with open(p) as f: json.load(f)['elements']
                print('  got', name, os.path.getsize(p) // 1024, 'kB', flush=True)
                break
            except (SystemExit, ValueError, KeyError):
                if os.path.exists(p): os.remove(p)
                time.sleep(min(10 * (i + 1), 60))
        else: raise SystemExit('Overpass gave nothing for ' + name)
    with open(p) as f: return json.load(f)['elements']


def hk80(lat, lon):
    """WGS 84 to the HK1980 Grid (easting, northing): the datum's shift as the Lands Department gives it, then the
    transverse Mercator on the International 1924 ellipsoid from its origin by the Hong Kong Observatory"""
    a, f = 6378388.0, 1 / 297.0; e2 = 2 * f - f * f; ep2 = e2 / (1 - e2)
    p = np.radians(np.asarray(lat, float) + 5.5 / 3600); l = np.radians(np.asarray(lon, float) - 8.8 / 3600)
    p0, l0 = math.radians(22 + 18 / 60 + 43.68 / 3600), math.radians(114 + 10 / 60 + 42.80 / 3600)
    def M(q): return a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * q - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * np.sin(2 * q)
                          + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * np.sin(4 * q) - 35 * e2 ** 3 / 3072 * np.sin(6 * q))
    N = a / np.sqrt(1 - e2 * np.sin(p) ** 2); T = np.tan(p) ** 2; C = ep2 * np.cos(p) ** 2; A = (l - l0) * np.cos(p)
    x = N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120)
    y = M(p) - M(p0) + N * np.tan(p) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24)
    return 836694.05 + x, 819069.80 + y

def hk_dtm(work, fetch_only, to_ll, tiles, reach):
    """Hong Kong's own 5 m terrain model (Lands Department, from DATA.GOV.HK): its ground under the city's towers,
    where the tiles (SRTM's radar) have their roofs. The heights are metres above Principal Datum, some 1.2 m under the
    mean sea; 0 is the sea, where the tiles' heights (their depths) stay. Cut once to the venue's square, kept as .npy."""
    zp = fetch(os.path.join(work, 'Whole_HK_DTM_5m.zip'), 'https://www.landsd.gov.hk/landsd_psi_data/SMO/data/Whole_HK_DTM_5m.zip')
    if fetch_only: return tiles
    cut = os.path.join(work, 'dtm.npz')
    if not os.path.exists(cut):
        import io, zipfile
        lat, lon = to_ll(np.array([-reach, reach, reach, -reach]), np.array([-reach, -reach, reach, reach]))
        E_, N_ = hk80(lat, lon); e0, e1, n0, n1 = E_.min() - 50, E_.max() + 50, N_.min() - 50, N_.max() + 50
        with zipfile.ZipFile(zp) as z, io.TextIOWrapper(z.open('Whole_HK_DTM_5m.asc')) as f:
            hd = {}
            for _ in range(6): k, v = f.readline().split(); hd[k.lower()] = float(v)
            nc, nr, cs = int(hd['ncols']), int(hd['nrows']), hd['cellsize']
            x0, y0 = hd['xllcorner'] + cs / 2, hd['yllcorner'] + cs / 2  # the first cell's middle
            j0, j1 = max(0, int((e0 - x0) / cs)), min(nc, int((e1 - x0) / cs) + 2)
            i0, i1 = max(0, int((y0 + (nr - 1) * cs - n1) / cs)), min(nr, int((y0 + (nr - 1) * cs - n0) / cs) + 2)  # rows from the north
            rows = [np.array(line.split()[j0:j1], np.float32) for i, line in enumerate(f) if i0 <= i < i1]
        G = np.where(np.array(rows) <= -9998, np.nan, np.array(rows))
        np.savez_compressed(cut, g=G, e=x0 + j0 * cs, n=y0 + (nr - 1 - i0) * cs, cs=cs)
    d = np.load(cut); G, ge, gn, cs = d['g'], float(d['e']), float(d['n']), float(d['cs'])
    print('  the ground from Hong Kong\'s own survey, its highest', round(float(np.nanmax(G)), 1), 'm', flush=True)
    def height(x, z):
        E_, N_ = hk80(*to_ll(x, z))
        fx = (E_ - ge) / cs; fy = (gn - N_) / cs
        inside = (fx >= 0) & (fy >= 0) & (fx < G.shape[1] - 1) & (fy < G.shape[0] - 1)
        j = np.clip(fx, 0, G.shape[1] - 1.001).astype(int); i = np.clip(fy, 0, G.shape[0] - 1.001).astype(int); u = fx - j; v = fy - i
        h = (G[i, j] * (1 - u) + G[i, j + 1] * u) * (1 - v) + (G[i + 1, j] * (1 - u) + G[i + 1, j + 1] * u) * v
        land = inside & np.isfinite(h) & (h > 1.5)
        return np.where(land, np.nan_to_num(h) - 1.2, tiles(x, z)).astype(np.float32)
    return height

def shift(a, di, dj, fill):
    o = np.full_like(a, fill)
    si = slice(max(0, di), a.shape[0] + min(0, di)); sj = slice(max(0, dj), a.shape[1] + min(0, dj))
    ti = slice(max(0, -di), a.shape[0] + min(0, -di)); tj = slice(max(0, -dj), a.shape[1] + min(0, -dj))
    o[ti, tj] = a[si, sj]; return o


def chamfer(src, cell, reach):
    """the distance from each cell to the nearest of src, relaxed over the eight neighbours up to reach"""
    d = np.where(src, 0.0, float(reach)).astype(np.float32)
    for _ in range(int(reach // cell) + 2):
        for di, dj in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            d = np.minimum(d, shift(d, di, dj, float(reach)) + cell * math.hypot(di, dj))
    return np.minimum(d, reach)


SEEN_EYE, SEEN_REACH, SEEN_TOP = 120.0, 5500.0, 15.0  # the highest a race's camera is, how far out a race goes, a roof's or a crown's height
def out_of_sight(H, S, mid, f=4):
    """How far below every race's line of sight the land lies, metres (0 or less where it can be seen): looked at
    from every point of the race's water within SEEN_REACH of the race area's middle (40 m off any shore, every
    400 m), SEEN_EYE up (the drone zoomed out; at the helm, and the drone lower, see less), along rays out across the
    land, on a grid f cells across (some 33 m), each cell by its highest ground under the line over everything nearer.
    Each cell then takes the least of the cells two round it too, for where the rays fan out wider than a cell."""
    n = H.shape[0] // f
    blk = np.maximum(H[:n * f, :n * f].reshape(n, f, n, f), 0)
    occ = blk.mean((1, 3)).ravel().astype(np.float32); top = blk.max((1, 3)).ravel().astype(np.float32)
    c = 2 * EXTENT / n
    step = int(400 // LC)
    vi, vj = np.mgrid[0:S.shape[0]:step, 0:S.shape[1]:step]
    vx, vz = -EXTENT + vj * LC, -EXTENT + vi * LC
    ok = (S[vi, vj] < -40) & (np.hypot(vx - mid[0], vz - mid[1]) < SEEN_REACH)
    vps = np.stack([vx[ok], vz[ok]], 1)
    rays, dstep, reach = 1440, c / 2, 2 * EXTENT * 1.2
    a = np.arange(rays) * (2 * np.pi / rays); d = np.arange(1, int(reach / dstep)) * dstep
    DX = (np.cos(a)[:, None] * d[None, :]).astype(np.float32); DZ = (np.sin(a)[:, None] * d[None, :]).astype(np.float32)
    D = d.astype(np.float32)[None, :]
    under = np.full(n * n, np.inf, np.float32)
    for x, z in vps:
        j = np.floor((x + DX + EXTENT) / c).astype(np.int32); i = np.floor((z + DZ + EXTENT) / c).astype(np.int32)
        inside = (i >= 0) & (j >= 0) & (i < n) & (j < n)
        k = np.where(inside, i * n + j, 0)
        t = np.where(inside, (occ[k] - SEEN_EYE) / D, -np.inf)
        line = SEEN_EYE + D * np.concatenate([np.full((rays, 1), -np.inf, np.float32), np.maximum.accumulate(t, 1)[:, :-1]], 1)
        np.minimum.at(under, k[inside], (line - top[k])[inside])
    u = under.reshape(n, n)
    for _ in range(2): u = np.minimum.reduce([u, shift(u, 1, 0, np.inf), shift(u, -1, 0, np.inf), shift(u, 0, 1, np.inf), shift(u, 0, -1, np.inf)])
    print(f'  looked at from {len(vps)} points of the race\'s water', flush=True)
    return np.kron(np.minimum(u, 1e4), np.ones((f, f), np.float32))


def bilinear(A, x0, cell, x, z):
    """A sampled between its points: A[i, j] stands at (x0 + j·cell, x0 + i·cell)"""
    fx = np.clip((x - x0) / cell, 0, A.shape[1] - 1.001); fz = np.clip((z - x0) / cell, 0, A.shape[0] - 1.001)
    j = fx.astype(int); i = fz.astype(int); u = fx - j; v = fz - i
    return (A[i, j] * (1 - u) + A[i, j + 1] * u) * (1 - v) + (A[i + 1, j] * (1 - u) + A[i + 1, j + 1] * u) * v


def erode(H, cell, amount=1.0, iters=8):
    """The gullies the elevation tiles are too coarse to keep. SRTM's 30 m (and the tiles' bilinear between them) lays
    a hillside down as a smooth blanket: the streams' V-cut gullies a few hundred metres apart filled in, its spurs and
    ridges rounded off. They are cut back here as water would: on a lattice of twice the cell (some 17 m, as fine as
    the quadtree's squares round the race area, so they don't split it all to 8 m), each point drains to its steepest
    neighbour down the slope, gathers the water of all the land above it, and is worn down by the square root of that
    area times the slope (the stream power), a little each time, the drainage worked out again in between. Only on the
    slopes (a plain or a valley's floor is left alone, and a big river isn't trenched: the area counts up to 0.4 km²),
    never below the point it drains to (no pits), at most CAP metres in all; then the cut is softened over its
    neighbours, so a gully is a V some 50 m across, not a slot. Ridges and spurs keep their height, sharper for the
    gullies beside them. amount: how much of it (0 for a venue whose tiles carry its own fine survey)."""
    if amount <= 0: return H
    K, A0, AMAX, CAP = 0.06, 4e3, 1e6, 28.0
    h = H[::2, ::2].astype(np.float64); h0 = h.copy(); c = 2 * cell; n0, n1 = h.shape
    OFF = ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1))
    DI = np.array([o[0] for o in OFF]); DJ = np.array([o[1] for o in OFF]); DIST = np.hypot(DI, DJ) * c
    idx = np.arange(h.size).reshape(h.shape)
    blur = lambda a: (lambda b: (shift(b, -1, 0, 0) + 2 * b + shift(b, 1, 0, 0)) / 4)((shift(a, 0, -1, 0) + 2 * a + shift(a, 0, 1, 0)) / 4)
    # (the water finds its way by the ground's own small unevenness too, a metre or so the tiles don't have: without
    # it, down a plain, even slope it runs in straight rows side by side, and cuts them as a comb)
    rough = np.random.default_rng(7).standard_normal(h.shape)
    for _ in range(3): rough = blur(rough)
    rough *= 1.2 / rough.std()
    for _ in range(iters):
        hr = h + rough
        drop = np.stack([(hr - shift(hr, di, dj, np.inf)) / d for di, dj, d in zip(DI, DJ, DIST)])
        k = drop.argmax(0); S = np.maximum((h - np.stack([shift(h, di, dj, np.inf) for di, dj in zip(DI, DJ)])[k, idx // n1, idx % n1]) / DIST[k], 0)
        has = (drop.max(0) > 1e-3) & (h > 0.5)
        rec = np.where(has, idx + DI[k] * n1 + DJ[k], idx).ravel()
        # the area each point drains, highest first (each hands what it has gathered on to the one it drains to)
        A = [1.0] * h.size; R_ = rec.tolist()
        for i in np.argsort(-hr, axis=None).tolist():
            r = R_[i]
            if r != i: A[r] += A[i]
        # (evened out over the neighbours, so the rows of water down a slope share theirs; a stream's, many times its
        # neighbours', still stands out) — and only a stream's cuts: a gully starts where 1.5 ha drains to it
        A = blur(blur(np.asarray(A).reshape(h.shape))) * c * c
        steep = np.clip((S - 0.04) / 0.14, 0, 1); steep = steep * steep * (3 - 2 * steep)
        e = K * np.clip(np.sqrt(np.minimum(A, AMAX)) - math.sqrt(A0), 0, None) * S * steep
        e = np.where(has, np.minimum(e, 0.5 * np.maximum(h - h.ravel()[rec].reshape(h.shape), 0)), 0)
        h -= e
    d = np.maximum(h - h0, -CAP)
    for _ in range(3):  # (softened: a [1 2 1] blur each way, three times)
        d = (shift(d, 0, -1, 0) + 2 * d + shift(d, 0, 1, 0)) / 4; d = (shift(d, -1, 0, 0) + 2 * d + shift(d, 1, 0, 0)) / 4
    ar = np.arange(H.shape[0]) / 2.0
    D = bilinear(d.astype(np.float32), 0.0, 1.0, *np.meshgrid(ar, ar)).astype(np.float32)
    print(f'  erosion: gullies cut up to {-D.min():.1f} m, {(D < -2).mean():.1%} of the lattice by more than 2 m', flush=True)
    return np.where(H > 0.5, H + amount * D, H).astype(np.float32)


def stretches(mask):
    """the stretches of a mask (its cells joined side to side), each as the flat indices of its cells"""
    h, w = mask.shape; m = mask.ravel(); seen = np.zeros(h * w, bool); out = []
    for s in np.flatnonzero(m):
        if seen[s]: continue
        seen[s] = True; todo = [s]; cells = []
        while todo:
            k = todo.pop(); cells.append(k); i, j = divmod(int(k), w)
            for kk, ok in ((k - w, i > 0), (k + w, i < h - 1), (k - 1, j > 0), (k + 1, j < w - 1)):
                if ok and m[kk] and not seen[kk]: seen[kk] = True; todo.append(kk)
        out.append(np.array(cells, np.int64))
    return out


def nearest(P, Q, bs=24.0):
    """for each point of Q, the index of the nearest point of P and the distance to it (only P within a bin of it)"""
    lo = min(P.min(0).min(), Q.min(0).min()) - bs
    bp = ((P - lo) // bs).astype(np.int64); nb = int(bp.max()) + 3
    key = bp[:, 1] * nb + bp[:, 0]
    order = np.argsort(key, kind='stable'); sk = key[order]
    occ, start, cnt = np.unique(sk, return_index=True, return_counts=True)
    K = int(min(cnt.max(), 256))
    table = np.full((len(occ), K), -1, np.int64)
    rank = np.arange(len(sk)) - np.repeat(start, cnt)
    keep = rank < K
    table[np.searchsorted(occ, sk[keep]), rank[keep]] = order[keep]
    bq = ((Q - lo) // bs).astype(np.int64)
    best = np.full(len(Q), -1, np.int64); bd = np.full(len(Q), np.inf)
    for c0 in range(0, len(Q), 4000):
        q = Q[c0:c0 + 4000]; b = bq[c0:c0 + 4000]
        cand = []
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                k = (b[:, 1] + dz) * nb + (b[:, 0] + dx)
                r = np.searchsorted(occ, k); r = np.clip(r, 0, len(occ) - 1)
                hit = occ[r] == k
                cand.append(np.where(hit[:, None], table[r], -1))
        cand = np.concatenate(cand, 1)
        pts = P[np.maximum(cand, 0)]
        d = np.hypot(pts[..., 0] - q[:, None, 0], pts[..., 1] - q[:, None, 1]); d[cand < 0] = np.inf
        a = d.argmin(1); best[c0:c0 + 4000] = cand[np.arange(len(q)), a]; bd[c0:c0 + 4000] = d[np.arange(len(q)), a]
    return best, bd


def bake(vid, V, fetch_only=False):
    work = os.path.join(WORK, vid); os.makedirs(work, exist_ok=True)
    LAT0, LON0 = V.get('origin') or V['home']
    MLAT, MLON = 110574.0, 111320 * math.cos(math.radians(LAT0))
    TH = math.radians(V['wind']); CO, SI = math.cos(TH), math.sin(TH)
    MX, MZ = V.get('mid', (0.0, 0.0)); MID = np.array((MX * CO + MZ * SI, MZ * CO - MX * SI), float) # turned with the frame

    # the frame: compass metres (x east, z south) turned so the wind's direction lands on −z
    def to_xz(lat, lon):
        x = (np.asarray(lon, float) - LON0) * MLON; z = -(np.asarray(lat, float) - LAT0) * MLAT
        return x * CO + z * SI, z * CO - x * SI
    def to_ll(x, z):
        x = np.asarray(x, float); z = np.asarray(z, float)
        e = x * CO - z * SI; s = z * CO + x * SI
        return LAT0 - s / MLAT, LON0 + e / MLON
    def bbox(m):  # south, west, north, east round the origin, m metres each way
        return f'{LAT0 - m / MLAT:.5f},{LON0 - m / MLON:.5f},{LAT0 + m / MLAT:.5f},{LON0 + m / MLON:.5f}'

    # ---------- the heights: the terrain's, and the far land's ----------
    def tile_xy(lat, lon, z):
        n = 2 ** z; r = np.radians(lat)
        return (np.asarray(lon) + 180) / 360 * n, (1 - np.log(np.tan(r) + 1 / np.cos(r)) / math.pi) / 2 * n
    def mosaic(zoom, reach, lone=False):
        x0, y0 = tile_xy(LAT0 + reach / MLAT, LON0 - reach / MLON, zoom); x1, y1 = tile_xy(LAT0 - reach / MLAT, LON0 + reach / MLON, zoom)
        TX0, TY0, TX1, TY1 = int(x0), int(y0), int(x1), int(y1)
        IMG = np.zeros(((TY1 - TY0 + 1) * 256, (TX1 - TX0 + 1) * 256), np.float32)
        for tx in range(TX0, TX1 + 1):
            for ty in range(TY0, TY1 + 1):
                p = fetch(os.path.join(work, f'{zoom}_{tx}_{ty}.png'), f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{tx}/{ty}.png')
                if fetch_only: continue
                a = np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
                IMG[(ty - TY0) * 256:(ty - TY0 + 1) * 256, (tx - TX0) * 256:(tx - TX0 + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
        # lone: the coarse tiles' junk pixels out, one or two together standing hundreds of metres or more above all
        # round them (gone in the next zoom out, so not the land's); a real summit has its slopes round it, so it
        # stands at most some 150 m above the second highest of its eight neighbours (Sugarloaf 123, Garda's Alps
        # 103); a pixel more than 200 m above it (the sea as 0) comes down to it, again till none is
        while lone and not fetch_only:
            C = np.maximum(IMG, 0); n_, m_ = C.shape
            nb2 = np.sort(np.stack([C[1 + di:n_ - 1 + di, 1 + dj:m_ - 1 + dj] for di in (-1, 0, 1) for dj in (-1, 0, 1) if di or dj]), 0)[-2]
            hit = C[1:-1, 1:-1] - nb2 > 200
            if not hit.any(): break
            IMG[1:-1, 1:-1][hit] = nb2[hit]
        def height(x, z):
            lat, lon = to_ll(x, z); tx, ty = tile_xy(lat, lon, zoom)
            px = np.clip((tx - TX0) * 256 - 0.5, 0, IMG.shape[1] - 1.001); py = np.clip((ty - TY0) * 256 - 0.5, 0, IMG.shape[0] - 1.001)
            a = np.floor(px).astype(int); b = np.floor(py).astype(int); fx = (px - a).astype(np.float32); fy = (py - b).astype(np.float32)
            return (IMG[b, a] * (1 - fx) + IMG[b, a + 1] * fx) * (1 - fy) + (IMG[b + 1, a] * (1 - fx) + IMG[b + 1, a + 1] * fx) * fy
        return height
    height = mosaic(V.get('zoom', ZOOM), EXTENT * 1.45)
    far_height = mosaic(FZOOM, FEXT * 1.02, lone=True)
    if V.get('flat') is not None:
        # a flat city whose tiles have its roofs for its ground: the land at `flat` metres, the sea as the tiles have it;
        # the land beyond less the roofs' 15 m or so, its real hills (Pulkovo's) still standing
        f0, raw, raw_far = float(V['flat']), height, far_height
        height = lambda x, z: (lambda h: np.where(h <= 0.5, h, f0).astype(np.float32))(raw(x, z))
        far_height = lambda x, z: (lambda h: np.where(h <= 0.5, h, f0 + np.maximum(0, h - 15)).astype(np.float32))(raw_far(x, z))

    if V.get('plain'):
        # a coastal plain whose tiles have its roofs and trees for its ground, some 4 to 8 m too high in humps: the land
        # up to `low` m brought down below the floor the land is laid on (1.2 m at the water, 4.8 m from 60 m back), so the
        # plain lies on it, and from there back up to the tiles' own at `high`, the hills' feet meeting it; the hills above
        # as they are
        lo_, hi_ = V['plain']; raw_p = height
        def height(x, z, raw_p=raw_p, lo_=float(lo_), hi_=float(hi_)):
            h = raw_p(x, z)
            return np.where((h <= 0.5) | (h >= hi_), h, np.interp(h, [0.5, lo_, hi_], [1.0, 4.5, hi_])).astype(np.float32)

    if V.get('dtm') == 'hk': height = hk_dtm(work, fetch_only, to_ll, height, EXTENT * 1.45)
    # a landmark standing where the tiles have its own roof for ground (radar's, SRTM's): `level` (radius, height), the
    # ground within the radius laid down to that height, rising back to the tiles' own over half as far again
    LEVEL = [(*(float(v) for v in to_xz(*lm['at'])), float(lm['level'][0]), float(lm['level'][1])) for lm in V.get('landmarks', []) if lm.get('level')]
    if LEVEL:
        raw_l = height
        def height(x, z, raw_l=raw_l):
            h = raw_l(x, z)
            for lx, lz, r, lv in LEVEL:
                d = np.hypot(np.asarray(x, float) - lx, np.asarray(z, float) - lz)
                h = np.minimum(h, lv + np.clip((d - r) / (0.5 * r), 0, 1) ** 2 * 400)
            return np.asarray(h, np.float32)

    # ---------- OpenStreetMap ----------
    coastQ = f'way["natural"="coastline"]({bbox(EXTENT * 1.5)});' if not V.get('lake') else f'relation["natural"="water"]["name"="{V["lake"]}"];'
    # (a relation's members, with their geometry, need `out geom` alone: `out geom tags` leaves them out)
    shore = overpass(work, 'shore' if not V.get('lake') else 'lake', f'({coastQ}); out geom;')
    marina = overpass(work, 'piers', f'(way["man_made"~"^(pier|breakwater|groyne|quay)$"]({bbox(5500)});way["leisure"="slipway"]({bbox(5500)}););out geom tags;')
    names = overpass(work, 'marinas', f'(nwr["leisure"="marina"]({bbox(7000)}););out center tags;')
    # the buildings round the race area and in each town (the race area is water: its towns are often further off)
    def box_at(lat, lon, m): return f'{lat - m / MLAT:.5f},{lon - m / MLON:.5f},{lat + m / MLAT:.5f},{lon + m / MLON:.5f}'
    boxes = [bbox(2300)] + [box_at(lat, lon, r * 1.2) for lat, lon, r in V.get('towns', [])]
    if V.get('build'): boxes = ['{:.5f},{:.5f},{:.5f},{:.5f}'.format(*V['build'])]
    if os.path.exists(os.path.join(work, 'buildings.json')): build = overpass(work, 'buildings', '(' + ''.join(f'way["building"]({b});' for b in boxes) + ');out geom tags;')
    else:  # one town at a time: a big city's all at once is more than a busy server answers
        build = [el for i, b in enumerate(boxes) for el in overpass(work, f'buildings-{i}', f'(way["building"]({b}););out geom tags;')]
    if V.get('relations'): build += overpass(work, 'buildings-rel', '(' + ''.join(f'relation["building"]({b});' for b in boxes) + ');out geom;')  # (out geom alone: see above)
    tall = overpass(work, 'tall', f'(way["building"]["building:levels"~"^([89]|[1-9][0-9])$"]({bbox(8500)});way["building"]["height"~"^([3-9][0-9]|[1-9][0-9][0-9])(\\\\.[0-9]+)?( m)?$"]({bbox(8500)}););out geom tags;')
    # the tall parts of buildings mapped in three dimensions (`parts`), where the building's own outline has only its
    # podium's height and its towers stand on the parts
    tall_parts = overpass(work, 'parts', f'(way["building:part"]["building:levels"~"^([89]|[1-9][0-9])$"]({bbox(8500)});way["building:part"]["height"~"^([3-9][0-9]|[1-9][0-9][0-9])(\\\\.[0-9]+)?( m)?$"]({bbox(8500)}););out geom tags;') if V.get('parts') else []
    cb = bbox(EXTENT * 1.45)
    coverQ = ''.join(f'{t}["{k}"~"^({"|".join(sorted(set(v for _, tags in LAYERS for v in tags.get(k, []))))})$"]({cb});'
                     for k in ('landuse', 'natural', 'leisure') for t in ('way', 'relation'))
    cover_els = overpass(work, 'cover', f'({coverQ});out geom;')
    # the paved squares and promenades (`paved`): areas only, the map's ways round them closed
    paved_els = overpass(work, 'paved', f'(way["highway"~"^(pedestrian|footway)$"]["area"="yes"]({cb});way["area:highway"]({cb});way["place"="square"]({cb}););out geom tags;') if V.get('paved') else []
    # the trees one by one (`trees`): the rows along the streets and the promenades, and the single ones, round the race area
    tree_els = overpass(work, 'trees', f'(way["natural"="tree_row"]({bbox(5000)});node["natural"="tree"]({bbox(5000)}););out geom tags;') if V.get('trees') else []
    # the water ashore (lakes, rivers, the tidal mud) and the roads round the race area
    eb, rb = bbox(EXTENT * 1.45), bbox(NE * EC * 1.05)
    ROADS = {'motorway': 14, 'trunk': 12, 'primary': 10, 'secondary': 9, 'tertiary': 8, 'unclassified': 6, 'residential': 6, 'living_street': 5,
             'pedestrian': 5, 'service': 4, 'motorway_link': 8, 'trunk_link': 8, 'primary_link': 7, 'secondary_link': 7}
    waterQ = f'way["natural"~"^(water|mud)$"]({eb});relation["natural"~"^(water|mud)$"]({eb});way["waterway"="riverbank"]({eb});way["landuse"~"^(reservoir|basin)$"]({eb});'
    roadQ = f'way["highway"~"^({"|".join(ROADS)})$"]({rb});'
    if os.path.exists(os.path.join(work, 'extra.json')): extra = overpass(work, 'extra', f'({waterQ}{roadQ});out geom;')
    else:  # the two apart: together they are more than a busy server answers for a city
        extra = overpass(work, 'water', f'({waterQ});out geom;') + overpass(work, 'roads', f'({roadQ});out geom;')
    bathy = None
    if V.get('bathy'):
        r_ = EXTENT * 1.45; s_, w_, n_, e_ = LAT0 - r_ / MLAT, LON0 - r_ / MLON, LAT0 + r_ / MLAT, LON0 + r_ / MLON
        nx_, nz_ = (260, 260) if V['bathy'] == 'emodnet' else (900, 900)
        url = (f'https://ows.emodnet-bathymetry.eu/wcs?service=WCS&version=1.0.0&request=GetCoverage&coverage=emodnet:mean&crs=EPSG:4326'
               f'&BBOX={w_:.5f},{s_:.5f},{e_:.5f},{n_:.5f}&format=image/tiff&WIDTH={nx_}&HEIGHT={nz_}') if V['bathy'] == 'emodnet' else (
               f'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_all/ImageServer/exportImage?bbox={w_:.5f},{s_:.5f},{e_:.5f},{n_:.5f}'
               f'&bboxSR=4326&imageSR=4326&size={nx_},{nz_}&format=tiff&pixelType=F32&interpolation=RSP_BilinearInterpolation&f=image')
        bpath = fetch(os.path.join(work, 'bathy.tif'), url)
        if not fetch_only:
            B_ = np.asarray(Image.open(bpath), dtype=np.float32)
            B_ = np.where(np.isfinite(B_) & (np.abs(B_) < 11000), B_, np.nan)
            def bathy(x, z):  # the survey's depth (−) or height (+) there, NaN where it has none
                lat, lon = to_ll(x, z)
                fx = np.clip((lon - w_) / (e_ - w_) * B_.shape[1] - 0.5, 0, B_.shape[1] - 1.001); fz = np.clip((n_ - lat) / (n_ - s_) * B_.shape[0] - 0.5, 0, B_.shape[0] - 1.001)
                j = fx.astype(int); i = fz.astype(int); u = fx - j; v = fz - i
                return (B_[i, j] * (1 - u) + B_[i, j + 1] * u) * (1 - v) + (B_[i + 1, j] * (1 - u) + B_[i + 1, j + 1] * u) * v
    foot = os.path.join(work, 'footprints.csv.gz')
    if V.get('footprints') and not os.path.exists(foot):
        # Microsoft's Global ML Building Footprints (ODbL): the file for one quadkey of a region
        links = fetch(os.path.join(WORK, 'dataset-links.csv'), 'https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv')
        region, qk = V['footprints']
        with open(links) as f:
            url = next(ln.split(',')[2] for ln in f if ln.startswith(region + ',') and ln.split(',')[1] == qk)
        fetch(foot, url.strip())
    if fetch_only: print(vid, 'fetched', flush=True); return

    def line(pts):
        x, z = to_xz([p['lat'] for p in pts], [p['lon'] for p in pts]); return np.stack([x, z], 1)

    # ---------- land and water on an even 10 m grid ----------
    CELL = 10.0; G = 9000.0
    GW = GH = int(2 * G / CELL)
    gx = -G + (np.arange(GW) + 0.5) * CELL; gz = -G + (np.arange(GH) + 0.5) * CELL
    HX, HZ = np.meshgrid(gx, gz)
    level = 0.0
    if V.get('lake'): level = float(np.median(height(np.linspace(-300, 300, 9), np.zeros(9)))); print('  the lake stands at', round(level, 1), 'm')
    H = height(HX, HZ) - level
    pix = lambda r: [((x + G) / CELL, (z + G) / CELL) for x, z in r]

    def loops(segs):  # a multipolygon's ways joined into rings, whichever way round each was drawn
        segs = [q for q in segs if len(q) > 1]; used = [False] * len(segs); out = []
        for i in range(len(segs)):
            if used[i]: continue
            used[i] = True; r = segs[i]
            while np.hypot(*(r[0] - r[-1])) > 1.5:
                for j in range(len(segs)):
                    if used[j]: continue
                    if np.hypot(*(segs[j][0] - r[-1])) < 1.5: r = np.concatenate([r, segs[j][1:]])
                    elif np.hypot(*(segs[j][-1] - r[-1])) < 1.5: r = np.concatenate([r, segs[j][::-1][1:]])
                    else: continue
                    used[j] = True; break
                else: break
            out.append(r)
        return out

    if V.get('lake'):
        # the lake's outline (its outer ways, and the islands' inner ones): everything outside it is land
        outer, inner = [], []
        for el in shore:
            for m in el.get('members', []):
                if m.get('type') == 'way' and m.get('geometry'): (inner if m.get('role') == 'inner' else outer).append(line(m['geometry']))
        img = Image.new('L', (GW, GH), 0); d = ImageDraw.Draw(img)
        for r in loops(outer): d.polygon(pix(r), fill=255)
        for r in loops(inner): d.polygon(pix(r), fill=0)
        water = np.asarray(img) > 127
        land = ~water if water.any() else H > 1.0
        coast = outer + inner
        print('  lake', water.mean().round(3), 'of the grid')
    else:
        coast = [line(w['geometry']) for w in shore if w.get('geometry')]
        land = H > 1.0
        if coast:
            # The coastline decides, not the elevation (whose sandbanks and seabed would come up as islands): every
            # coast way is drawn as a wall, and the sea is flooded in from the water side of each (OSM draws the land
            # on a way's left), up to the walls. What the flood doesn't reach is land: the mainland, and the islands
            # inside their rings. A flood that is mostly above the sea's level started on the wrong side, and is put back
            # (where OSM's coastline leaves a water area to one side, its land side is the bigger part of the box).
            img = Image.new('L', (GW, GH), 0); d = ImageDraw.Draw(img)
            for r in coast: d.line(pix(r), fill=128, width=2)
            seeds = []
            for r in coast:
                a, b = r[:-1], r[1:]; L = np.hypot(*(b - a).T) + 1e-9
                q = (a + b) / 2 + np.stack([-(b - a)[:, 1] / L, (b - a)[:, 0] / L], 1) * 30
                seeds.append(q[L > 20])
            seeds = np.concatenate(seeds) if seeds else np.zeros((0, 2))
            filled = np.zeros((GH, GW), bool); regions = 0
            for x, z in seeds:
                i, j = int((z + G) / CELL), int((x + G) / CELL)
                if not (0 <= i < GH and 0 <= j < GW) or img.getpixel((j, i)) != 0: continue
                ImageDraw.floodfill(img, (j, i), 255)
                now = np.asarray(img) == 255; new = now & ~filled
                if new.any() and np.mean(H[new] > 1.5) > 0.4: print('  put back a flood of', int(new.sum()), 'cells,', round(100 * float(np.mean(H[new] > 1.5))), '% above the sea'); img.paste(Image.fromarray(np.where(new, 64, np.asarray(img)).astype(np.uint8))); continue
                filled = now; regions += 1
            # and water wherever the elevation is down at the sea's level too (its water surfaces are flat, at 0 or
            # below): the waters OSM maps inside its coastline (Sydney's coastline crosses the Heads; the harbour behind
            # them is a water area of its own). Not a little above it: Valencia's rice fields are a metre or two up
            land = ~filled & (H > 0.3)
            print('  coast ways', len(coast), '| sea regions', regions)

    # the map's water ashore down at the water's own level (an estuary, a lagoon, a river's mouth) is water too; the
    # lakes up in the hills stay land, drawn as water by the cover
    wimg = Image.new('L', (GW, GH), 0); wd = ImageDraw.Draw(wimg)
    for el in extra:
        t = el.get('tags', {})
        if not (t.get('natural') == 'water' or t.get('waterway') == 'riverbank' or t.get('landuse') in ('reservoir', 'basin')): continue
        if el['type'] == 'way' and el.get('geometry'):
            r = line(el['geometry'])
            if len(r) > 2: wd.polygon(pix(r), fill=255)
        elif el['type'] == 'relation':
            for r in loops([line(m['geometry']) for m in el.get('members', []) if m.get('type') == 'way' and m.get('geometry') and m.get('role') != 'inner']):
                if len(r) > 2: wd.polygon(pix(r), fill=255)
            for r in loops([line(m['geometry']) for m in el.get('members', []) if m.get('type') == 'way' and m.get('geometry') and m.get('role') == 'inner']):
                if len(r) > 2: wd.polygon(pix(r), fill=0)
    carve = (np.asarray(wimg) > 127) & land & (H <= max(2.0, V.get('flat') or 0))  # (a flat city's rivers: all of them)
    land = land & ~carve
    print(f'  water ashore at the sea\'s level: {int(carve.sum())} cells', flush=True)
    # where the beaches are: the bed shelves gently off them
    bimg = Image.new('L', (GW, GH), 0); bd = ImageDraw.Draw(bimg)
    for el in cover_els:
        if el['type'] == 'way' and el.get('geometry') and el.get('tags', {}).get('natural') in ('beach', 'sand'):
            r = line(el['geometry'])
            if len(r) > 2: bd.polygon(pix(r), fill=255)
    beach = np.asarray(bimg.filter(ImageFilter.MaxFilter(13))) > 127

    # ---------- the sea room: the distance to the shore, 20 m grid over the middle 10 km ----------
    obst = Image.fromarray((land * 255).astype(np.uint8)); od = ImageDraw.Draw(obst)
    for el in marina:
        kind = el.get('tags', {}).get('man_made')
        if kind not in ('pier', 'breakwater', 'groyne') or not el.get('geometry'): continue
        od.line(pix(line(el['geometry'])), fill=255, width=max(1, round((6 if kind != 'pier' else 2.5 + 2 * 14) / CELL)))
    for lm in V.get('landmarks', []):  # the bridges' piers
        if lm['kind'] != 'drawbridge': continue
        a, b = np.array(to_xz(*lm['a']), float), np.array(to_xz(*lm['b']), float); u = (b - a) / np.hypot(*(b - a)); v = np.array([-u[1], u[0]])
        for i in range(1, lm['n']):
            c = a + (b - a) * i / lm['n']
            od.polygon(pix([c + u * su * 5 + v * sv * (lm['w'] / 2 + 3) for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1))]), fill=255)
    land_o = np.asarray(obst) > 127
    k0 = int((-5000 + G) / CELL); k1 = int((5000 + G) / CELL)
    sub = land_o[k0:k1:2, k0:k1:2]
    MX0, MZ0 = float(gx[k0] + CELL / 2), float(gz[k0] + CELL / 2)
    MW, MH = sub.shape[1], sub.shape[0]
    room = np.where(sub, -chamfer(~sub, SC, R), chamfer(sub, SC, R)).astype(np.int16)

    # ---------- the shore, to the metre ----------
    # The terrain's height crosses the water's level where the coast is: each corner of it near the shore stands at
    # its distance from the shore times the slope there, so that between a corner ashore and one afloat the surface
    # meets the water on OSM's line, not on a 10 m cell's edge. The distances: to points every 2 m along the coast
    # ways, the land on the side the 10 m grid has it (OSM's coast has its land on the left, a lake's outline
    # either way); and where the grid's shore has no way along it (a harbour that the elevation found), to its
    # shore smoothed and traced between the cells.
    def land_at(x, z):
        j = np.clip(((x + G) / CELL).astype(int), 0, GW - 1); i = np.clip(((z + G) / CELL).astype(int), 0, GH - 1); return land[i, j]
    SP, SN = [], []
    for r in coast:
        if len(r) < 2: continue
        a, b = r[:-1], r[1:]; L = np.hypot(*(b - a).T)
        k = np.maximum(1, np.ceil(L / 2).astype(int))
        t = np.concatenate([np.arange(n) / n for n in k]); seg = np.repeat(np.arange(len(a)), k)
        p = a[seg] + (b - a)[seg] * t[:, None]
        tan = (b - a)[seg] / (L[seg][:, None] + 1e-9); nrm = np.stack([tan[:, 1], -tan[:, 0]], 1)  # the left of the way
        inside = (np.abs(p) < EXTENT + 200).all(1)
        if not inside.any(): continue
        p, nrm = p[inside], nrm[inside]
        vote = land_at(*(p + nrm * 20).T).astype(int) - land_at(*(p - nrm * 20).T).astype(int)
        if vote.sum() < 0: nrm = -nrm
        if abs(vote).sum() == 0: continue  # no shore here on the grid (a way along the box's edge)
        SP.append(p); SN.append(nrm)
    blur = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0)), np.float32) / 255
    cont, cnrm = [], []
    for ax in (0, 1):  # between neighbours across a column, then a row, where the smoothed grid crosses one half
        A = blur[:, :-1] if ax == 0 else blur[:-1, :]; B = blur[:, 1:] if ax == 0 else blur[1:, :]
        i, j = np.nonzero((A - 0.5) * (B - 0.5) < 0)
        f = (0.5 - A[i, j]) / (B[i, j] - A[i, j])
        x = gx[j] + (f * CELL if ax == 0 else 0); z = gz[i] + (f * CELL if ax == 1 else 0)
        gxg = (blur[i, np.minimum(j + 1, GW - 1)] - blur[i, np.maximum(j - 1, 0)]); gzg = (blur[np.minimum(i + 1, GH - 1), j] - blur[np.maximum(i - 1, 0), j])
        L = np.hypot(gxg, gzg) + 1e-9
        cont.append(np.stack([x, z], 1)); cnrm.append(np.stack([gxg / L, gzg / L], 1))
    cont = np.concatenate(cont); cnrm = np.concatenate(cnrm)
    keep = (np.abs(cont) < EXTENT + 200).all(1)
    cont, cnrm = cont[keep], cnrm[keep]
    if SP:
        SP = np.concatenate(SP); SN = np.concatenate(SN)
        _, dw = nearest(SP, cont)
        cont, cnrm = cont[dw > 15], cnrm[dw > 15]
        SP = np.concatenate([SP, cont]); SN = np.concatenate([SN, cnrm])
    else: SP, SN = cont, cnrm
    print('  shore points', len(SP), flush=True)

    # ---------- the terrain's lattice: (N + 1)² corners some 8.3 m apart ----------
    LX = (-EXTENT + np.arange(N + 1) * LC).astype(np.float64)
    LXX, LZZ = np.meshgrid(LX, LX)
    th = height(LXX, LZZ).astype(np.float32) - level
    # (the gullies cut back: not in a flat city, nor where the tiles carry a fine survey of their own — the US's 3DEP,
    # Geoscience Australia's 5 m, LINZ's 8 m, Hong Kong's 5 m — whose gullies are already there; `erode` 0)
    if V.get('flat') is None and not V.get('dtm'): th = erode(th, LC, float(V.get('erode', 1.0)))
    # the signed distance to the shore, + ashore: the grid's, to the nearest cell across it, then to the metre near it
    dl = chamfer(land, CELL, 600.0); ds = chamfer(~land, CELL, 600.0)  # (far enough for the bed to shelve to its deepest)
    sd10 = np.where(land, ds - CELL / 2, -(dl - CELL / 2))
    S = bilinear(sd10, -G + CELL / 2, CELL, LXX, LZZ).astype(np.float32)
    band = np.abs(S) < 40
    qi = np.flatnonzero(band)
    Q = np.stack([LXX.flat[qi], LZZ.flat[qi]], 1)
    if len(SP):
        idx, dq = nearest(SP, Q)
        ok = idx >= 0
        sgn = np.sign(((Q - SP[np.maximum(idx, 0)]) * SN[np.maximum(idx, 0)]).sum(1)); sgn[sgn == 0] = 1
        S.flat[qi[ok]] = (sgn * dq)[ok]
    del LXX, LZZ, Q

    # the land at least 1.2 m up and rising off the beach, meeting the water on the coast; under it the bed: as steep
    # off the shore as the land above it (deep under a cliff, shallow off a beach), shelving on out, and where the
    # elevation's own sea floor is deeper (the tiles carry the depths), that
    # (a city's granite embankments: the bank `bank` metres across, not 12; a beach the map has keeps its 12)
    soft = bilinear(beach.astype(np.float32), -G + CELL / 2, CELL, *np.meshgrid(LX, LX)) > 0.5
    B = np.where(soft, 12.0, float(V.get('bank', 12.0))).astype(np.float32)
    Rl = np.maximum(th, 1.2 + np.clip(S, 0, 60) * 0.06)
    if V.get('quays'):  # a port city whose tiles keep its pier sheds and terminals as ground: no higher than q0 at the water, rising at most qs a metre inland
        q0, qs = V['quays']; Rl = np.maximum(np.minimum(Rl, q0 + np.clip(S, 0, None) * qs), 1.2 + np.clip(S, 0, 60) * 0.06)
    if V.get('flat') is not None:  # a flat city's ground all at its height, up to its quays (where the tiles have the river too)
        Rl = np.full_like(Rl, float(V['flat']))
    Ra = np.where(S > 0, Rl, 0).astype(np.float32); Rd = Ra.copy()
    for di in (-2, -1, 0, 1, 2):
        for dj in (-2, -1, 0, 1, 2):
            if di or dj: Rd = np.maximum(Rd, shift(Ra, di, dj, 0))
    D = np.clip(Rd, 2.5, 60)
    ramp = np.clip(S / B, -1, 1)
    shelf = np.maximum(-(D + np.where(soft, 0.03, 0.08) * np.clip(-S - B, 0, None)), -40)
    sea = np.where(-S < B, D * ramp, np.minimum(shelf, np.where(th < -0.8, th, 0)))
    if bathy is not None:  # the survey's depths, where it has them, past the shore's own slope
        sb = bathy(*np.meshgrid(LX, LX)).astype(np.float32)
        have = np.isfinite(sb) & (-S >= B)
        sea = np.where(have, np.clip(np.nan_to_num(sb), -60, -0.8), sea)
        print(f'  sea floor from the survey: {have.mean():.0%} of the lattice', flush=True)
    HL = np.where(S > 0, Rl * ramp, sea).astype(np.float32)
    del Rl, Ra, Rd, D, ramp, shelf, sea

    # ---------- the cover, the open sky and the depth, on a 20 m grid ----------
    cx = -EXTENT + (np.arange(NCC) + 0.5) * CC
    CX, CZ = np.meshgrid(cx, cx)
    cpix = lambda r: [((x + EXTENT) / CC, (z + EXTENT) / CC) for x, z in r]
    shapes = []  # (tags, outer rings, inner rings, the element)
    paved_areas = [dict(el, tags={'paved': 'yes'}) for el in paved_els if el['type'] == 'way' and len(el.get('geometry') or []) > 3
                   and el['geometry'][0] == el['geometry'][-1]]
    # a boatyard's ground (a `boatyard` landmark's ring) is paved too, under the yachts on their cradles
    paved_areas += [{'type': 'way', 'id': 0, 'tags': {'paved': 'yes'}, 'geometry': [{'lat': la, 'lon': lo} for la, lo in lm['ring'] + lm['ring'][:1]]}
                    for lm in V.get('landmarks', []) if lm['kind'] == 'boatyard']
    # a container port's yards the map leaves unsaid (`aprons`: (south, west, north, east) boxes), paved as they are
    paved_areas += [{'type': 'way', 'id': 0, 'tags': {'paved': 'yes'}, 'geometry': [{'lat': la, 'lon': lo} for la, lo in ((s_, w_), (s_, e_), (n_, e_), (n_, w_), (s_, w_))]} for s_, w_, n_, e_ in V.get('aprons', [])]
    for el in cover_els + [e for e in extra if 'highway' not in e.get('tags', {})] + paved_areas:
        t = el.get('tags', {})
        if el['type'] == 'way' and el.get('geometry'): shapes.append((t, [line(el['geometry'])], [], el))
        elif el['type'] == 'relation':
            o = [line(m['geometry']) for m in el.get('members', []) if m.get('type') == 'way' and m.get('geometry') and m.get('role') != 'inner']
            i = [line(m['geometry']) for m in el.get('members', []) if m.get('type') == 'way' and m.get('geometry') and m.get('role') == 'inner']
            shapes.append((t, loops(o), loops(i), el))
    cover = np.zeros((NCC, NCC), np.uint8)
    for cls, tags in LAYERS:
        if cls == 'water': under = cover.copy().ravel()  # (what the map has under its water, the last of them)
        img = Image.new('L', (NCC, NCC), 0); d = ImageDraw.Draw(img); n = 0
        for t, outer_r, inner_r, el in shapes:
            if not any(t.get(k) in v for k, v in tags.items()): continue
            vr = max(1, variant(cls, el)) if cls != 'forest' else variant(cls, el) + 1  # (0 is no area: a wood's 1 is "not said")
            for r in outer_r:
                if len(r) > 2: d.polygon(cpix(r), fill=vr); n += 1
            for r in inner_r:
                if len(r) > 2: d.polygon(cpix(r), fill=0)
        if n:
            a_ = np.asarray(img); m_ = a_ > 0
            cover[m_] = CLASSES.index(cls) | ((a_[m_] - (1 if cls == 'forest' else 0)) << 4).astype(np.uint8)
    Lc = bilinear(HL, -EXTENT, LC, CX, CZ)
    # The map's water ashore is drawn as still water, mirroring the sky (the game's lakeLight); where it isn't, it is a
    # pale patch on the land that reads as snow. So only where the water is:
    # - the sea's own polygons (a harbour, a bay, a lagoon the sea has taken, the water the map has over the sea) are
    #   the sea, and all of them that lies ashore — up the slopes of its coast, where the map's outline and the
    #   elevation's shore are apart (Sydney's harbour, Rio's lagoons) — is land, as the map has it under the water
    W_ = CLASSES.index('water'); flat = cover.ravel(); hf = Lc.ravel(); seaw = banks = 0
    for r in stretches((cover & 15) == W_):
        h = hf[r]
        if (h <= 0).any(): r = r[h > 0]; seaw += len(r); flat[r] = under[r]
    cover[Lc <= 0] = 0
    # (and the low land of a coast under a pond's polygon by the sea: its shore, not a pond)
    Sc = bilinear(S, -EXTENT, LC, CX, CZ)
    r = np.flatnonzero(((cover & 15) == W_) & (Lc > 0) & (Lc < 8) & (Sc < 200)); flat[r] = under[r]
    # - a lake's, a reservoir's, a pond's surface is level: what of its polygon stands more than 2 m above its water
    #   (the lowest quarter of it) is its banks, the land the map has there
    for r in stretches(((cover & 15) == W_) & (Lc > 0)):
        h = hf[r]; up = r[h > np.percentile(h, 25) + 2.0]; banks += len(up); flat[up] = under[up]
    print(f'  the map\'s water ashore: {seaw} cells of the sea\'s polygons, {banks} of the banks, land', flush=True)
    if V.get('flat') is not None:  # a flat city's river, its polygon over the quays' edge: the quay, not a pond
        cover[((cover & 15) == CLASSES.index('water')) & (Lc > 0)] = CLASSES.index('town')
    print('  cover:', ', '.join(f'{c} {np.mean(cover & 15 == k):.0%}' for k, c in enumerate(CLASSES) if np.mean(cover & 15 == k) >= 0.005), flush=True)
    # the open sky: how far up the land round each point stands, looking eight ways out to 3 km
    H2 = np.maximum(HL[::2, ::2], 0); h0 = bilinear(H2, -EXTENT, 2 * LC, CX, CZ)
    vis = np.zeros_like(h0)
    for k in range(8):
        a = k * math.pi / 4; ux, uz = math.cos(a), math.sin(a); top = np.zeros_like(h0)
        t = 12.0
        while t < 3000:
            top = np.maximum(top, (bilinear(H2, -EXTENT, 2 * LC, CX + ux * t, CZ + uz * t) - h0 - 1.0) / t); t *= 1.28
        vis += 1 - np.sin(np.arctan(top))
    vis = vis.reshape(NCC // 2, 2, NCC // 2, 2).mean((1, 3))  # on a 40 m grid, in steps of 4: smooth enough
    ao = (np.clip(np.round(vis / 8 * 63), 0, 63) * 4).astype(np.uint8)
    depth_dm = np.where(Lc >= 0, 0, np.where(-Lc > 25.4, 255, np.round(-Lc * 10))).astype(np.uint8)

    # ---------- the roads and the distance out from the shore, on an 8 m grid round the race area ----------
    rimg = Image.new('L', (NE, NE), 0); rd = ImageDraw.Draw(rimg)
    epix = lambda r: [((x + NE * EC / 2) / EC, (z + NE * EC / 2) / EC) for x, z in r]
    for el in extra:
        w = ROADS.get(el.get('tags', {}).get('highway'))
        if w and el.get('geometry') and el.get('tags', {}).get('tunnel') != 'yes' and el.get('tags', {}).get('bridge') != 'yes':
            rd.line(epix(line(el['geometry'])), fill=255, width=max(1, round(w / EC)))
    roads = np.asarray(rimg).copy()
    roads[(np.abs(np.arange(NE) * EC - NE * EC / 2 + EC / 2)[:, None] > 3500) | (np.abs(np.arange(NE) * EC - NE * EC / 2 + EC / 2)[None, :] > 3500)] = 0  # (round the race area: 3.5 km)
    ex = -NE * EC / 2 + (np.arange(NE) + 0.5) * EC
    EX, EZ = np.meshgrid(ex, ex)
    roads[bilinear(HL, -EXTENT, LC, EX, EZ) <= 0.3] = 0
    off = bilinear(S, -EXTENT, LC, EX, EZ)
    shore = np.where(off >= 0, 0, np.clip(np.round(-off * 4), 1, 255)).astype(np.uint8)
    # where the shore is built (a town's, a port's quays, the piers and breakwaters): sheltered water, no surf
    cimg = Image.new('L', (NE, NE), 0); cd = ImageDraw.Draw(cimg)
    for el in marina:
        if el.get('geometry'): cd.line(epix(line(el['geometry'])), fill=255, width=3)
    ci = np.clip(((EZ + EXTENT) // CC).astype(int), 0, NCC - 1); cj = np.clip(((EX + EXTENT) // CC).astype(int), 0, NCC - 1)
    built_c = np.isin(cover[ci, cj] & 15, [CLASSES.index('town'), CLASSES.index('industry')]) | (np.asarray(cimg) > 127)
    calm = (np.asarray(Image.fromarray((built_c * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 127).astype(np.uint8) * 255
    # and in the lee: the waves come with the wind, from the game's north (−z); the less open water there is that way
    # (the fetch, out to 1.5 km), the less surf
    near_sh = (off < 0) & (off > -70)
    qi_ = np.flatnonzero(near_sh); qx, qz = EX.ravel()[qi_], EZ.ravel()[qi_]
    fetch_ = np.full(len(qi_), 1500.0)
    for t_ in np.arange(30.0, 1500.0, 30.0):
        hit = land_at(qx, qz - t_) & (fetch_ >= 1500.0)
        fetch_[hit] = t_
    lee = np.zeros(NE * NE, np.float32); lee[qi_] = 1 - np.clip(fetch_ / 1200.0, 0, 1)
    calm = np.maximum(calm, np.round(lee.reshape(NE, NE) * 255)).astype(np.uint8)
    if V.get('bank') is not None:  # a city on its quays: no surf along them, only on its beaches
        calm[bilinear(beach.astype(np.float32), -G + CELL / 2, CELL, EX, EZ) < 0.5] = 255

    # ---------- the land beyond: out to 64 km on a 400 m grid ----------
    fx = -FEXT + np.arange(NF) * FCELL
    FXX, FZZ = np.meshgrid(fx, fx)
    farh = (np.clip(np.round((far_height(FXX, FZZ) - level) / 2), -25, 4500) * 2).astype(np.int32)
    # the coarse tiles have junk pixels here and there, one or two a kilometre or two up out on flat land or the sea,
    # which would stand up as needles of hill (Auckland's, Sydney's, Rio's); a real summit is at most some 150 m above
    # the highest of the eight cells round it, so a cell more than 200 m above them comes down to that, again till none
    # is (a needle of two cells goes in two goes). The game does the same to a venue baked before this (land.js).
    for _ in range(4):
        inner = farh[1:-1, 1:-1]
        top = np.max([farh[1 + di:NF - 1 + di, 1 + dj:NF - 1 + dj] for di in (-1, 0, 1) for dj in (-1, 0, 1) if di or dj], axis=0)
        spike = inner - top > 200
        if not spike.any(): break
        inner[spike] = top[spike]

    # ---------- the marinas, the piers and the buildings ----------
    def poly(g):
        if not g or len(g) < 2: return None
        x, z = to_xz([p['lat'] for p in g], [p['lon'] for p in g])
        return [[round(float(a), 1), round(float(b), 1)] for a, b in zip(x, z)]
    marinas = []
    for el in names:
        c = el.get('center') or {'lat': el.get('lat'), 'lon': el.get('lon')}
        if c.get('lat') is None: continue
        x, z = to_xz(c['lat'], c['lon']); marinas.append({'name': el.get('tags', {}).get('name', ''), 'at': [round(float(x), 1), round(float(z), 1)]})
    def num(s):
        try: return float(str(s).split()[0].replace(',', '.'))
        except (ValueError, IndexError): return 0.0
    piers = []
    for el in marina:
        t = el.get('tags', {}); p = poly(el.get('geometry'))
        if not p: continue
        piers.append({'kind': t.get('man_made') or 'slipway', 'pts': p, 'area': t.get('area') == 'yes' or (p[0] == p[-1] and len(p) > 3),
                      'floating': t.get('floating') == 'yes' or 'pontoon' in t.get('name', '').lower(), 'w': num(t.get('width', 0))})
    PIERS = ['pier', 'breakwater', 'groyne', 'quay', 'slipway']
    pn = np.array([min(len(p_['pts']), 65535) for p_ in piers], np.uint16)
    pk = np.array([PIERS.index(p_['kind']) if p_['kind'] in PIERS else 0 for p_ in piers], np.uint8) + np.array([8 * bool(p_['area']) + 16 * bool(p_['floating']) for p_ in piers], np.uint8)
    pw = np.array([min(255, round(p_['w'] * 10)) for p_ in piers], np.uint8)
    pxz = np.array([round(v * 2) for p_ in piers for q in p_['pts'][:65535] for v in q], np.int16)
    TOWN_XZ = [tuple(float(v) for v in to_xz(lat, lon)) for lat, lon, _ in V.get('towns', [])]
    ROOFS = {'flat': 1, 'gabled': 2, 'hipped': 2, 'pyramidal': 2, 'half-hipped': 2, 'gambrel': 2, 'mansard': 2, 'skillion': 1, 'dome': 1}
    seen, found = set(), []
    def colour(v):  # the map's colour (a CSS name or #hex), or none; a black one a hair lighter, black being none
        try: c = ImageColor.getrgb(v.strip()) if v else None
        except ValueError: c = None
        return tuple(max(1, x) for x in c[:3]) if c else (0, 0, 0)
    # where a landmark is drawn in the map's building's place (`clear`, metres round it), that building is left out
    # (or `clear` a list of (lat, lon, metres), for one that spreads beyond a circle round its `at`)
    CLEAR = [c for lm in V.get('landmarks', []) if lm.get('clear') for c in
             ([(*to_xz(*lm['at']), lm['clear'])] if not isinstance(lm['clear'], (list, tuple)) else [(*to_xz(la, lo), r) for la, lo, r in lm['clear']])]
    def add(r, h, roof, t=None):
        cx_ = sum(a for a, _ in r) / len(r); cz_ = sum(b for _, b in r) / len(r)
        if any(math.hypot(cx_ - float(lx), cz_ - float(lz)) < cr for lx, lz, cr in CLEAR): return
        near = min([math.hypot(cx_ - MID[0], cz_ - MID[1])] + [math.hypot(cx_ - tx, cz_ - tz) * 1.5 for tx, tz in TOWN_XZ])
        found.append({'r': r, 'h': round(min(h, 560), 1), 'roof': roof, 'd': near - min(h, 200) * 20, 'c': (cx_, cz_),
                      'wc': colour((t or {}).get('building:colour')), 'rc': colour((t or {}).get('roof:colour')), 'nm': (t or {}).get('name', '')})
    def keyhole(el):
        # a relation's outer ring with its courtyards cut in: each inner ring joined to the outer one at their nearest
        # corners and walked the other way round, so that one ring of corners draws the building with its holes
        segs = lambda role: [np.array(poly(m['geometry'])) for m in el.get('members', []) if m.get('type') == 'way' and m.get('geometry') and (m.get('role') == 'inner') == (role == 'inner')]
        outs = [r for r in loops(segs('outer')) if len(r) > 3 and np.hypot(*(r[0] - r[-1])) < 1.5]
        if not outs: return None
        area = lambda r: (r[:-1, 0] * r[1:, 1] - r[1:, 0] * r[:-1, 1]).sum() / 2
        o = max(outs, key=lambda r: abs(area(r)))[:-1]
        if area(np.vstack([o, o[:1]])) < 0: o = o[::-1]
        for h_ in sorted((r for r in loops(segs('inner')) if len(r) > 3 and np.hypot(*(r[0] - r[-1])) < 1.5), key=lambda r: -abs(area(r)))[:6]:
            h_ = h_[:-1]
            if area(np.vstack([h_, h_[:1]])) > 0: h_ = h_[::-1]
            d = np.hypot(o[:, None, 0] - h_[None, :, 0], o[:, None, 1] - h_[None, :, 1]); i, j = np.unravel_index(np.argmin(d), d.shape)
            o = np.vstack([o[:i + 1], h_[j:], h_[:j + 1], o[i:]])
        # thinned to the 255 corners a building can have
        k = 0.4
        while len(o) > 250:
            keep = [0]
            for n_ in range(1, len(o)):
                if np.hypot(*(o[n_] - o[keep[-1]])) >= k: keep.append(n_)
            o = o[keep]; k *= 1.5
        return [[round(float(a), 1), round(float(b), 1)] for a, b in o] + [[round(float(o[0][0]), 1), round(float(o[0][1]), 1)]]
    for el in build + tall:
        if (el['type'], el.get('id')) in seen: continue
        seen.add((el['type'], el.get('id')))
        p = poly(el.get('geometry')) if el['type'] == 'way' else keyhole(el)
        if not p or len(p) < 4: continue
        t = el.get('tags', {}); h = num(t.get('height')) or (num(t.get('building:levels')) * 3.1 + 1.0 if t.get('building:levels') else 0)
        h = V.get('height_of', {}).get(t.get('name'), h)  # (a building the map gives no height, or a wrong one, by its name)
        kind = 3 if t.get('building') in ('church', 'chapel', 'cathedral') else 4 if t.get('building') == 'mosque' else ROOFS.get(t.get('roof:shape'), 0)
        # a fortress's ramparts (a palace the map calls a castle, as St Petersburg's are, is a house like the rest)
        if (t.get('building') in ('castle', 'fortress') or t.get('historic') in ('castle', 'fort', 'citywalls')) and t.get('castle_type') not in ('palace', 'stately', 'manor', 'shloss', 'schloss'): kind, h = 5, h or 11.0
        add(p[:-1] if p[0] == p[-1] else p, h, kind, t)
    # a tall part, from the ground up (one standing on another, a crown or a spire's base, is left out: the shaft
    # under it carries the height), where no building already there is as high
    for el in tall_parts:
        t = el.get('tags', {}); p = poly(el.get('geometry'))
        if not p or len(p) < 4 or num(t.get('min_height')) >= 30: continue
        h = num(t.get('height')) or num(t.get('building:levels')) * 3.1 + 1.0
        cx_ = sum(a for a, _ in p) / len(p); cz_ = sum(b for _, b in p) / len(p)
        if any(f['h'] >= h - 1 and min(a for a, _ in f['r']) <= cx_ <= max(a for a, _ in f['r']) and min(b for _, b in f['r']) <= cz_ <= max(b for _, b in f['r']) for f in found): continue
        add(p[:-1] if p[0] == p[-1] else p, h, ROOFS.get(t.get('roof:shape'), 1), t)
    if os.path.exists(foot):
        # a footprint where OSM has no building (none of OSM's within 12 m of its middle), ashore, sure and house-sized
        taken = {(int(a // 12), int(b // 12)) for f in found for a, b in f['r']}
        s, w, n_, e = V.get('footbox') or V['build']; added = 0  # (the footprints' box: `footbox`, or the buildings' own)
        with gzip.open(foot, 'rt') as f:
            for ln in f:
                el = json.loads(ln); ring = el['geometry']['coordinates'][0]
                lon = [c[0] for c in ring]; lat = [c[1] for c in ring]
                if not (s < lat[0] < n_ and w < lon[0] < e) or el['properties'].get('confidence', 1) < 0.75: continue
                x, z = to_xz(lat, lon); r = [[round(float(a), 1), round(float(b), 1)] for a, b in zip(x, z)]
                r = r[:-1] if r[0] == r[-1] else r
                area = abs(sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r)))) / 2
                cx_ = sum(a for a, _ in r) / len(r); cz_ = sum(b for _, b in r) / len(r)
                if area < 25 or area > 4000 or (int(cx_ // 12), int(cz_ // 12)) in taken: continue
                if not land_at(np.array([cx_]), np.array([cz_]))[0] or bilinear(sd10, -G + CELL / 2, CELL, np.array([cx_]), np.array([cz_]))[0] < 8: continue
                hh = el['properties'].get('height', -1)
                add(r, round(hh, 1) if hh and hh > 0 else 0, 0); added += 1
        print('  footprints added', added)
    # a town wherever the buildings stand close (five or more within some 100 m), whatever the map's land use says
    # there: it often has none in an old town's middle, or a park's grass over it
    dens = np.zeros((NCC, NCC), np.float32)
    for b in found:
        i, j = int((b['c'][1] + EXTENT) // CC), int((b['c'][0] + EXTENT) // CC)
        if 0 <= i < NCC and 0 <= j < NCC: dens[i, j] += 1
    near = sum(shift(dens, di, dj, 0) for di in range(-2, 3) for dj in range(-2, 3))
    built = (near >= 5) & (Lc > 0) & ~np.isin(cover & 15, [CLASSES.index(c) for c in ('sand', 'rock', 'industry', 'water')])
    cover[built] = CLASSES.index('town')
    print(f'  town from the buildings: {built.mean():.1%}', flush=True)
    # the nearest, and the tall ones from further: the town round the race area and the skyline beyond it; and before
    # a town's back streets, what stands on the water within sight of the course — the waterfront, the islands' forts
    # and lighthouses — which is what is seen from it (an island's buildings, further off than a town's middle, were
    # the first a big city's count left out)
    if found:
        cs = np.array([b['c'] for b in found], float)
        ashore = bilinear(sd10, -G + CELL / 2, CELL, cs[:, 0], cs[:, 1])
        dm = np.hypot(cs[:, 0] - MID[0], cs[:, 1] - MID[1])
        front = 1500.0 * np.clip(1.0 - np.maximum(ashore, 0.0) / 150.0, 0.0, 1.0) * (dm < 3500.0)
        for lat, lon, r in V.get('keep', []):  # (and first of all what the venue names: an island's buildings, a lighthouse)
            kx, kz = to_xz(lat, lon); front += 6000.0 * (np.hypot(cs[:, 0] - float(kx), cs[:, 1] - float(kz)) < r)
        for b, f in zip(found, front): b['d'] -= float(f)
    found.sort(key=lambda b: b['d'])
    kept = [b for b in found if b['d'] < 6000][:V.get('most', 8000)]  # (beyond some 4 km of the race area and the towns, the tall ones only)
    # what that leaves out within 3 km of the race area, where it would be missed (an island's fort, a lighthouse): a
    # venue's `towns` can take it in
    gone = [b for b in found[len(kept):] if math.hypot(b['c'][0] - MID[0], b['c'][1] - MID[1]) < 3000]
    if gone:
        named = sorted({b['nm'] for b in gone if b['nm']})
        print(f'  left out within 3 km of the race area: {len(gone)}' + (f" (named: {', '.join(named[:12])}{' …' if len(named) > 12 else ''})" if named else ''), flush=True)
    found = kept
    bn = np.array([min(len(b['r']), 255) for b in found], np.uint8)
    bh = np.array([round(b['h'] * 10) for b in found], np.uint16)
    broof = np.array([b['roof'] for b in found], np.uint8)
    bwall = np.array([b['wc'] for b in found], np.uint8).ravel(); broofc = np.array([b['rc'] for b in found], np.uint8).ravel()
    bxz = np.array([v for b in found for p in b['r'][:255] for v in (round(p[0]), round(p[1]))], np.int16)
    towns = []
    for lat, lon, r in V.get('towns', []):
        x, z = to_xz(lat, lon); towns.append({'at': [round(float(x)), round(float(z))], 'r': r})
    landmarks = []
    for lm in V.get('landmarks', []):
        o = {k: v for k, v in lm.items() if k not in ('a', 'b', 'at', 'keep', 'ring')}
        for k in ('a', 'b', 'at', 'keep'):
            if k in lm: x, z = to_xz(*lm[k]); o[k] = [round(float(x), 1), round(float(z), 1)]
        if lm.get('ring'): o['ring'] = [[round(float(v), 1) for v in to_xz(la, lo)] for la, lo in lm['ring']]  # a wall's corners (a castle's)
        if isinstance(lm.get('clear'), (list, tuple)): o['clear'] = [[round(float(v), 1) for v in to_xz(la, lo)] + [r] for la, lo, r in lm['clear']]
        landmarks.append(o)

    # ---------- the quadtree: fine on the coast and round the race area, coarse far off ----------
    # A square is split while it has land in it and: it is bigger than its distance allows; or the coast runs
    # through it and it is bigger than the coast's cells at that distance; or its four corners miss the heights
    # between them by more than its distance allows. Then any square with a neighbour more than one level finer is
    # split too, so a square's edge has at most one corner of its neighbours' between its own.
    # (and round the race area, where the game draws a wood as high as its crowns (skopea.js LIFT_VS), every square
    # with trees or scrub in it, or ground the map says nothing of, down to 33 m, and within 3 km of the race area to
    # 17 m: corners enough for a wood's height to stand on, and its edges, without raising a tent over a coarse square)
    LEV = int(math.log2(N))
    lx = -EXTENT + (np.arange(N) + 0.5) * LC
    vc = np.isin(cover & 15, [CLASSES.index(c) for c in ('unknown', 'forest', 'scrub', 'orchard', 'wetland')])
    vi = np.clip(((lx + EXTENT) / CC).astype(int), 0, NCC - 1)
    inner = np.abs(lx) < NE * EC / 2 * 0.9
    veg = vc[vi[:, None], vi[None, :]] & inner[:, None] & inner[None, :] & (HL[:-1, :-1] > 1.0)
    he = np.maximum(HL, -1.0)
    # (where no race can see the land, behind the hills from all of the water: split for its heights alone, and only
    # where a square misses them by more than it lies under the line of sight, less what stands on it (SEEN_TOP), so the
    # coarser land stays out of sight as well)
    under = out_of_sight(HL, S, MID)
    print(f'  out of sight: {(under[HL[:-1, :-1] > 0] > SEEN_TOP).mean():.0%} of the land', flush=True)
    c4 = lambda f: f(f(HL[:-1, :-1], HL[1:, :-1]), f(HL[:-1, 1:], HL[1:, 1:]))
    cmax, cmin = c4(np.maximum), c4(np.minimum)
    want, nmax = [], []
    for Lv in range(LEV + 1):
        n = 1 << Lv; s = N >> Lv; Sz = s * LC
        mx = cmax.reshape(n, s, n, s).max((1, 3)); mn = cmin.reshape(n, s, n, s).min((1, 3)); nmax.append(mx)
        c = -EXTENT + (np.arange(n) + 0.5) * Sz
        dx = np.maximum(np.abs(c[None, :] - MID[0]) - Sz / 2, 0); dz = np.maximum(np.abs(c[:, None] - MID[1]) - Sz / 2, 0)
        d = np.hypot(dx, dz)
        low = under.reshape(n, s, n, s).min((1, 3)) - SEEN_TOP; hid = low > 0
        w = (mx > 0) & ((Sz > np.where(hid, 1100, np.clip(0.06 * d, 66, 1100))) | ((mn <= 0) & (Sz > np.maximum(LC, 0.0032 * d) + 0.1)))
        if Sz > 17: w |= (mx > 0) & ~hid & veg.reshape(n, s, n, s).any((1, 3)) & ((Sz > 34) | (d < 3000))
        if s >= 2 and Lv < LEV:
            C = he[::s, ::s]; u = (np.arange(s) / s).astype(np.float32)
            blk = he[:N, :N].reshape(n, s, n, s)
            fit = (C[:-1, None, :-1, None] * (1 - u)[None, :, None, None] * (1 - u)[None, None, None, :]
                   + C[:-1, None, 1:, None] * (1 - u)[None, :, None, None] * u[None, None, None, :]
                   + C[1:, None, :-1, None] * u[None, :, None, None] * (1 - u)[None, None, None, :]
                   + C[1:, None, 1:, None] * u[None, :, None, None] * u[None, None, None, :])
            err = np.abs(blk - fit).max((1, 3))
            w |= (mx > 0) & (err > np.maximum(low, 0.4 + 0.0012 * d))
        if Lv == LEV: w[:] = False
        want.append(w)
    def grow(split):
        exist = [np.ones((1, 1), bool)]
        for Lv in range(LEV): exist.append(np.kron(exist[Lv] & split[Lv], np.ones((2, 2), bool)))
        split = [split[Lv] & exist[Lv] for Lv in range(LEV + 1)]
        depth = np.zeros((N, N), np.int8)
        for Lv in range(LEV + 1):
            leaf = exist[Lv] & ~split[Lv]
            if leaf.any(): s = N >> Lv; depth[np.kron(leaf, np.ones((s, s), bool))] = Lv
        return split, depth
    split, depth = grow(want)
    for it in range(40):
        nb = np.maximum.reduce([shift(depth, 1, 0, 0), shift(depth, -1, 0, 0), shift(depth, 0, 1, 0), shift(depth, 0, -1, 0)])
        bad = nb > depth + 1
        if not bad.any(): break
        ii, jj = np.nonzero(bad)
        for Lv in np.unique(depth[ii, jj]):
            m = depth[ii, jj] == Lv; s = N >> int(Lv)
            split[int(Lv)][ii[m] // s, jj[m] // s] = True
        split, depth = grow(split)
    tree, leaves = [], []
    def walk(Lv, i, j):
        sp = bool(split[Lv][i, j]); tree.append(sp)
        if sp:
            for a, b in ((0, 0), (0, 1), (1, 0), (1, 1)): walk(Lv + 1, 2 * i + a, 2 * j + b)
        else: leaves.append((Lv, i, j, bool(nmax[Lv][i, j] > 0)))
    walk(0, 0, 0)
    lv = np.array(leaves, np.int64); Ls, Li, Lj, Ld = lv[:, 0], lv[:, 1], lv[:, 2], lv[:, 3].astype(bool)
    ls = N >> Ls; r0 = Li * ls; c0 = Lj * ls
    W1 = N + 1; key = lambda r, c: r * W1 + c
    corner = np.zeros(W1 * W1, bool)
    for a, b in ((0, 0), (0, 1), (1, 0), (1, 1)): corner[key(r0 + a * ls, c0 + b * ls)] = True
    used = np.zeros(W1 * W1, bool)
    dr = Ld
    for a, b in ((0, 0), (0, 1), (1, 0), (1, 1)): used[key(r0[dr] + a * ls[dr], c0[dr] + b * ls[dr])] = True
    big = dr & (ls >= 2); h2 = ls // 2
    fan = np.zeros(len(lv), bool)
    for mr, mc in ((0, 1), (2, 1), (1, 0), (1, 2)):
        k = key(r0 + mr * h2, c0 + mc * h2); has = big & corner[k]
        used[k[has]] = True; fan |= has
    used[key(r0[fan] + h2[fan], c0[fan] + h2[fan])] = True
    vkeys = np.flatnonzero(used)
    vh = np.clip(np.round(HL.ravel()[vkeys] * 10), -32000, 32000).astype(np.int16)
    print(f'  terrain: {len(lv)} leaves ({int(Ld.sum())} drawn), {len(vkeys)} corners, about {int(2 * Ld.sum() + 2 * fan.sum())} triangles', flush=True)

    # ---------- the files ----------
    rows = lambda a: np.diff(a.astype(np.int32), axis=1, prepend=0)
    seq = lambda a: np.diff(a.astype(np.int32), prepend=0)
    def grad(a):  # each point less what its left, upper and upper-left neighbours predict (left + up − upper-left)
        a = a.astype(np.int32); p = np.zeros_like(a)
        p[1:, 1:] = a[1:, :-1] + a[:-1, 1:] - a[:-1, :-1]; p[0, 1:] = a[0, :-1]; p[1:, 0] = a[:-1, 0]
        return a - p
    room8 = np.clip(np.round(room / 4), -127, 127).astype(np.int8)
    # the trees one by one: a row's every 7 m (a palm's) or 9 m, each tree a palm, a conifer or a broad-leaved one by
    # what the map says it is; those nearest the race area first, 6000 at the most, ashore
    PALMS = ('arecaceae', 'phoenix', 'washingtonia', 'trachycarpus', 'chamaerops', 'butia', 'livistona', 'syagrus', 'palm')
    def tree_kind(t):
        what = ' '.join(str(t.get(k, '')) for k in ('taxon:family', 'genus', 'species', 'taxon', 'species:en', 'name', 'leaf_type')).lower()
        return 1 if any(w in what for w in PALMS) else 2 if 'needleleaved' in what or any(w in what for w in ('pinus', 'cedrus', 'cupressus', 'abies', 'picea')) else 0
    tpts = []
    for el in tree_els:
        t = el.get('tags', {}); k = tree_kind(t)
        if el['type'] == 'node': tpts.append((*to_xz(el['lat'], el['lon']), k)); continue
        if not el.get('geometry'): continue
        r = line(el['geometry']); step = 7.0 if k == 1 else 9.0
        for a, b in zip(r[:-1], r[1:]):
            L = math.hypot(b[0] - a[0], b[1] - a[1]); m = max(1, int(L // step))
            for i in range(m): f = (i + 0.5) / m; tpts.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, k))
    if V.get('palms'):
        # the palms of a seafront the map has no trees on (`palms`: its streets' names, and how far from the water): every
        # 8 m along each such street where it runs within that of the shore, set towards the water, 4 m short of it
        names, reach = V['palms']
        C = np.array([a + (b - a) * f for r in coast for a, b in zip(r[:-1], r[1:]) for f in np.linspace(0, 1, max(2, int(np.hypot(*(b - a)) // 8) + 1))[:-1]])  # the shore every 8 m
        cand = []
        for el in extra:
            if el.get('tags', {}).get('name') not in names or not el.get('geometry'): continue
            r = line(el['geometry'])
            for a, b in zip(r[:-1], r[1:]):
                L = math.hypot(b[0] - a[0], b[1] - a[1]); m = max(1, int(L // 8))
                cand += [a + (b - a) * (i + 0.5) / m for i in range(m)]
        if cand:
            Q = np.array(cand); idx, d = nearest(C, Q, bs=float(reach)); n0 = len(tpts)
            for q, i, dd in zip(Q, idx, d):
                if i < 0 or not dd < reach: continue
                c = C[i]; s = min(6.0, max(0.0, dd - 4.0)) / max(dd, 1e-6)
                tpts.append((q[0] + (c[0] - q[0]) * s, q[1] + (c[1] - q[1]) * s, 1))
            print(f'  palms along the seafront: {len(tpts) - n0}', flush=True)
    tpts = [(float(x), float(z), k) for x, z, k in tpts if abs(x) < 5000 and abs(z) < 5000 and bilinear(HL, -EXTENT, LC, np.array([x]), np.array([z]))[0] > 0.3]
    # a town quay where the gulets lie stern-to (`gulets`: its streets' names, and how far from the water): the shore
    # along those streets, every 4 m of it within that of one, in runs (the game moors them on its water side)
    moor = []
    if V.get('gulets'):
        names, reach = V['gulets']
        S = np.array([a + (b - a) * (i + 0.5) / max(1, int(np.hypot(*(b - a)) // 6)) for el in extra if el.get('tags', {}).get('name') in names and el.get('geometry')
                      for r in [line(el['geometry'])] for a, b in zip(r[:-1], r[1:]) for i in range(max(1, int(np.hypot(*(b - a)) // 6)))])
        for r in coast:
            run = []
            for a, b in zip(r[:-1], r[1:]):
                for f in np.linspace(0, 1, max(2, int(np.hypot(*(b - a)) // 4) + 1))[:-1]:
                    q = a + (b - a) * f
                    if len(S) and np.min(np.hypot(*(S - q).T)) < reach: run.append([round(float(q[0]), 1), round(float(q[1]), 1)])
                    elif len(run) > 3: moor.append(run); run = []
                    else: run = []
            if len(run) > 3: moor.append(run)
        print(f'  quays for the gulets: {len(moor)} runs, {sum(len(m) for m in moor) * 4} m', flush=True)
    # the boats that come and go on their routes (`routes`: a ferry's, a water taxi's) and the kitesurfers off a beach
    # (`kites`: the line they ride along, and how many): the game moves them (skopea.js)
    xz = lambda la, lo: [round(float(v), 1) for v in to_xz(la, lo)]
    # Each route's way between its points found on the water: the cheapest on the sea room's grid that keeps 30 m off
    # the shore and the piers (dearer within 80 m) and goes round the race area if it can (the course's marks with 300 m to spare, from the home, the
    # course laid there as land.js lays it), then pulled straight wherever a straight line keeps to that; beyond the
    # grid (the open sea) straight
    import heapq
    AV = (-1067.0, 370.0, -776.0, 786.0)  # the race area round the home, x and z (every shape and length's marks, + 300 m)
    ok = (room > 30)
    gxs = MX0 + np.arange(MW) * SC; gzs = MZ0 + np.arange(MH) * SC
    inav = ((gxs[None, :] - MID[0] > AV[0]) & (gxs[None, :] - MID[0] < AV[1]) & (gzs[:, None] - MID[1] > AV[2]) & (gzs[:, None] - MID[1] < AV[3]))
    dx_ = gxs[None, :] - MID[0]; dz_ = gzs[:, None] - MID[1]
    depth_ = np.where(inav, np.minimum(np.minimum(dx_ - AV[0], AV[1] - dx_), np.minimum(dz_ - AV[2], AV[3] - dz_)), 0.0)  # how far into it
    cost = (1.0 + 40.0 * np.clip(depth_ / 300.0, 0, 1)) * np.where(room < 80, 2.0, 1.0)  # (dearer the deeper: no wall, a narrow bay's way skirts it)
    def cellof(q): return int(round((q[1] - MZ0) / SC)), int(round((q[0] - MX0) / SC))
    def inside(c): return 0 <= c[0] < MH and 0 <= c[1] < MW
    def nearest_ok(c):
        for rr in range(0, 40):
            best = None
            for di in range(-rr, rr + 1):
                for dj in range(-rr, rr + 1):
                    if max(abs(di), abs(dj)) != rr: continue
                    cc = (c[0] + di, c[1] + dj)
                    if inside(cc) and ok[cc] and (best is None or di * di + dj * dj < best[0]): best = (di * di + dj * dj, cc)
            if best: return best[1]
        return c
    def astar(a, b):
        D8 = [(-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1), (-1, -1, 1.414), (-1, 1, 1.414), (1, -1, 1.414), (1, 1, 1.414)]
        h = lambda c: math.hypot(c[0] - b[0], c[1] - b[1])
        g = {a: 0.0}; came = {}; pq = [(h(a), a)]
        while pq:
            _, c = heapq.heappop(pq)
            if c == b: break
            for di, dj, w in D8:
                n = (c[0] + di, c[1] + dj)
                if not inside(n) or not ok[n]: continue
                ng = g[c] + w * cost[n]
                if ng < g.get(n, 1e18): g[n] = ng; came[n] = c; heapq.heappush(pq, (ng + h(n), n))
        if b not in came and a != b: return None
        path = [b]
        while path[-1] != a: path.append(came[path[-1]])
        return path[::-1]
    def clear(p, q):
        L = math.hypot(q[0] - p[0], q[1] - p[1]); n = max(1, int(L / 10))
        for k in range(n + 1):
            c = cellof((p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n))
            if inside(c) and (not ok[c] or inav[c]): return False
        return True
    def water_way(pts):
        out = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            ca, cb = cellof(a), cellof(b)
            if not (inside(ca) and inside(cb)): out.append(b); continue
            pa, pb = nearest_ok(ca), nearest_ok(cb); path = astar(pa, pb)
            if path is None: print('  no way on the water from', a, 'to', b, flush=True); out.append(b); continue
            out += [(MX0 + j * SC, MZ0 + i * SC) for i, j in path] + [b]
        way = [out[0]]; i = 0  # pulled straight
        while i < len(out) - 1:
            j = len(out) - 1
            while j > i + 1 and not clear(out[i], out[j]): j -= 1
            way.append(out[j]); i = j
        return [[round(float(x), 1), round(float(z), 1)] for x, z in way]
    routes = [{'kind': r_['kind'], 'pts': water_way([tuple(xz(*q)) for q in r_['pts']])} for r_ in V.get('routes', [])]
    for r_ in routes:
        deep = max([0.0] + [min(x - MID[0] - AV[0], AV[1] - x + MID[0], z - MID[1] - AV[2], AV[3] - z + MID[1]) for x, z in r_['pts']])
        print(f"  a {r_['kind']}'s way: {len(r_['pts'])} points, at most {deep:.0f} m into the race area's margin", flush=True)
    kites = {'a': xz(*V['kites']['a']), 'b': xz(*V['kites']['b']), 'n': V['kites']['n']} if V.get('kites') else None
    tpts.sort(key=lambda p: math.hypot(p[0] - MID[0], p[1] - MID[1])); tpts = tpts[:6000]
    tk = np.array([k for _, _, k in tpts], np.uint8); txz = np.array([[round(x * 2), round(z * 2)] for x, z, _ in tpts], np.int32).ravel()
    if tree_els: print(f'  trees one by one: {len(tpts)} ({int((tk == 1).sum())} palms)', flush=True)
    parts = [  # name, type, the bytes, how it is packed, its row length
        ('room', 'i8', rows(room8).astype(np.int8), 'rows', MW),
        ('tree', 'bits', np.packbits(np.array(tree, np.uint8)), None, len(tree)),
        ('drawn', 'bits', np.packbits(Ld.astype(np.uint8)), None, len(lv)),
        ('heights', 'i16', seq(vh).astype('<i2'), 'seq', 0),
        ('cover', 'u8', rows(cover).astype(np.uint8), 'rows', NCC),
        ('ao', 'u8', grad(ao // 4).astype(np.uint8), 'grad', NCC // 2),
        ('depth', 'u8', rows(depth_dm).astype(np.uint8), 'rows', NCC),
        ('far', 'i16', grad(farh // 2).astype('<i2'), 'grad', NF),
        ('roads', 'u8', rows(roads).astype(np.uint8), 'rows', NE), ('shore', 'u8', rows(shore).astype(np.uint8), 'rows', NE),
        ('calm', 'u8', rows(calm).astype(np.uint8), 'rows', NE),
        ('bn', 'u8', bn, None, 0), ('bh', 'u16', bh.astype('<u2'), None, 0), ('broof', 'u8', broof, None, 0),
        ('bwall', 'u8', bwall, None, 0), ('broofc', 'u8', broofc, None, 0),
        ('bxz', 'i16', seq(bxz).astype('<i2'), 'seq', 0),
        ('pn', 'u16', pn.astype('<u2'), None, 0), ('pk', 'u8', pk, None, 0), ('pw', 'u8', pw, None, 0), ('pxz', 'i16', seq(pxz).astype('<i2'), 'seq', 0),
        ('tk', 'u8', tk, None, 0), ('txz', 'i16', seq(txz).astype('<i2'), 'seq', 0),
    ]
    raw, desc = b'', []
    for name, typ, a, pack, w in parts:
        b = a.tobytes(); raw += b + b'\0' * (-len(b) % 4)
        desc.append({'n': name, 't': typ, 'len': int(w if typ == 'bits' else a.size), **({'d': pack} if pack else {}), **({'w': int(w)} if pack in ('rows', 'grad') else {})})
    out = V.get('out')
    jpath = os.path.join(GAME, out + '.json') if out else os.path.join(GAME, 'venues', vid + '.json')
    os.makedirs(os.path.dirname(jpath), exist_ok=True)
    with open(jpath[:-5] + '.bin', 'wb') as f: f.write(gzip.compress(raw, 9, mtime=0))
    meta = {
        'origin': [LAT0, LON0], 'turn': V['wind'], 'home': [round(float(MID[0]), 1), round(float(MID[1]), 1)], 'mid': [float(MID[0]), float(MID[1])], 'lake': bool(V.get('lake')),
        'terrain': {'ext': EXTENT, 'n': N}, 'grid': {'x0': -EXTENT, 'cell': CC, 'n': NCC}, 'ao': {'cell': CC * 2, 'n': NCC // 2, 'k': 4}, 'far': {'ext': FEXT, 'cell': FCELL, 'n': NF, 'k': 2}, 'near': {'x0': -NE * EC / 2, 'cell': EC, 'n': NE},
        'room': {'x0': MX0, 'z0': MZ0, 'cell': SC, 'nx': MW, 'nz': MH}, 'classes': CLASSES, 'parts': desc,
        'marinas': marinas, 'pierKinds': PIERS, 'towns': towns, 'landmarks': landmarks, **({'moor': moor} if moor else {}), **({'routes': routes} if routes else {}), **({'kites': kites} if kites else {}),
    }
    with open(jpath, 'w') as f: json.dump(meta, f, separators=(',', ':'))
    print(f'{vid}: {os.path.getsize(jpath[:-5] + ".bin") // 1024} kB + {os.path.getsize(jpath) // 1024} kB | sea {(room > 0).mean():.0%} of the middle | marinas {len(marinas)} | piers {len(piers)} | buildings {len(found)}', flush=True)


if __name__ == '__main__':
    want = ARGS or list(VENUES)
    for vid in want:
        print('==', vid, flush=True)
        bake(vid, VENUES[vid], '--fetch' in sys.argv)
