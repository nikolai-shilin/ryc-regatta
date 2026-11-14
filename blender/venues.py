# The land of every venue a race goes to, Göcek bay and the famous regatta venues, baked into
# public/game/venues/<id>.bin and <id>.json (Göcek's into public/game/skopea.bin and .json): the real hills from the
# Terrarium elevation tiles, the mountains far beyond them, and from OpenStreetMap (the Overpass API) the coast, the
# woods, fields, towns and beaches, the pontoons and the buildings.
#
#   python3 blender/venues.py <work dir> [--fetch] [id ...]      (all of them when no id is given)
#
# Downloads are kept in <work dir>/<id>, so a second run only bakes; --fetch only downloads. Needs numpy and Pillow.
#
# The frame: metres, x east and z south, from the middle of the venue's race area (`home`), turned so that its
# prevailing wind (`wind`, the compass direction it blows from) comes from the game's north (−z), since every race is
# laid with the wind from there. A race in Cowes beats into the Solent's south-westerly, one in Sydney into the
# north-easterly sea breeze. `turn` in the json is that angle, so the game can turn the sun with the land. Göcek's
# frame is older: from the town (`origin`), not turned, and its json has no `home` (land.js lays its course its own way).
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
#   cover    Uint8, on the `grid`: what is on the ground (CLASSES)
#   ao       Uint8, on a grid of twice the cells (`ao`): how much of the sky is open (`ao.k` × 63 all of it), for the
#            shade in valleys
#   depth    Uint8, on the `grid`: the water's depth in decimetres (255 deeper than 25.4 m, 0 ashore)
#   far      Int16, in steps of `far.k` metres: the land beyond, out to `far.ext`, on its own even grid
#   bn, bh, broof, bxz   the buildings: how many corners each has, its height in decimetres (0 unknown), its roof
#            (0 unknown, 1 flat, 2 pitched), and all the corners, in metres, as x, z pairs
import gzip, json, math, os, subprocess, sys, time
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# home: the middle of the race area, in clear water; wind: the prevailing wind's compass direction (from);
# towns: (lat, lon, radius m) where the houses the map lacks are filled in; landmarks: drawn by the game (skopea.js)
VENUES = {
    'gocek': dict(origin=(36.7525, 28.9395), mid=(-400, 700), wind=0, zoom=14, out='skopea', towns=[(36.7564, 28.9402, 650)],
                  build=(36.705, 28.875, 36.795, 29.005), footprints=('Turkey', '122101223')),
    'cowes': dict(home=(50.7880, -1.3060), wind=225, towns=[(50.7600, -1.2980, 900), (50.7570, -1.2880, 700)]),
    'newport': dict(home=(41.4570, -71.3600), wind=210, towns=[(41.4850, -71.3150, 1300), (41.4960, -71.3700, 700)],
                    landmarks=[dict(kind='suspension', a=(41.5052, -71.3598), b=(41.5046, -71.3318), h=122, span=488, deck=58)]),
    'sydney': dict(home=(-33.8480, 151.2560), wind=45, towns=[(-33.8700, 151.2550, 1500), (-33.8330, 151.2420, 1300), (-33.8380, 151.2830, 1000), (-33.8650, 151.2150, 1200)],
                   landmarks=[dict(kind='arch', a=(-33.8562, 151.2093), b=(-33.8486, 151.2114), h=134, span=503, deck=49)]),
    'kiel': dict(home=(54.4300, 10.2050), wind=250, towns=[(54.4150, 10.1570, 900), (54.4100, 10.2250, 900), (54.4310, 10.1760, 600), (54.3700, 10.1500, 1500)],
                 landmarks=[dict(kind='lighthouse', at=(54.3887, 10.1906), h=32, ground=0), dict(kind='tower', at=(54.4103, 10.2273), h=85, style='memorial')]),
    'trieste': dict(home=(45.6720, 13.7280), wind=70, towns=[(45.6500, 13.7700, 1600), (45.6750, 13.7500, 700), (45.6960, 13.7070, 500)],
                    landmarks=[dict(kind='lighthouse', at=(45.6626, 13.7586), h=68)]),
    'porto-cervo': dict(home=(41.1520, 9.5650), wind=315, towns=[(41.1340, 9.5340, 600), (41.1050, 9.5150, 500)]),
    'saint-tropez': dict(home=(43.2900, 6.6700), wind=280, towns=[(43.2710, 6.6390, 800), (43.3090, 6.6360, 1000), (43.2930, 6.5870, 600)]),
    'antigua': dict(home=(16.9890, -61.7700), wind=95, towns=[(17.0080, -61.7640, 500), (17.0180, -61.7820, 700)]),
    'auckland': dict(home=(-36.8300, 174.8150), wind=225, towns=[(-36.8480, 174.7650, 1500), (-36.8280, 174.7980, 900), (-36.8500, 174.8100, 1300), (-36.8000, 174.7900, 1500)],
                     landmarks=[dict(kind='tower', at=(-36.84846, 174.76218), h=328, style='sky')]),
    'san-francisco': dict(home=(37.8150, -122.4350), wind=255, towns=[(37.8020, -122.4400, 1100), (37.7960, -122.4120, 1100), (37.8580, -122.4850, 800), (37.8730, -122.4570, 700)],
                          landmarks=[dict(kind='suspension', a=(37.8077, -122.4750), b=(37.8288, -122.4813), h=227, span=1280, deck=67, color='#c0362c')]),
    'valencia': dict(home=(39.4550, -0.2850), wind=110, towns=[(39.4700, -0.3700, 1200), (39.4700, -0.3250, 1000), (39.4300, -0.3300, 800)]),
    'barcelona': dict(home=(41.3720, 2.2250), wind=200, towns=[(41.3850, 2.1800, 1100), (41.3950, 2.2050, 1100), (41.3780, 2.1900, 700), (41.4100, 2.2250, 900)],
                      landmarks=[dict(kind='spires', at=(41.4036, 2.1744), h=172)]),
    'palma': dict(home=(39.5350, 2.6300), wind=220, towns=[(39.5700, 2.6500, 1200), (39.5350, 2.7200, 800), (39.5550, 2.6000, 700)],
                  landmarks=[dict(kind='cathedral', at=(39.5675, 2.6483), h=44)]),
    'marstrand': dict(home=(57.8850, 11.5550), wind=225, towns=[(57.8860, 11.5850, 500), (57.8900, 11.6000, 500), (57.8650, 11.6000, 400)],
                      landmarks=[dict(kind='fort', at=(57.8866, 11.5806), h=24)]),
    'bermuda': dict(home=(32.3050, -64.8400), wind=200, towns=[(32.2930, -64.7830, 900), (32.3250, -64.8350, 500), (32.3100, -64.8650, 600), (32.2850, -64.8150, 700)]),
    'enoshima': dict(home=(35.2850, 139.4950), wind=190, towns=[(35.3100, 139.4800, 1200), (35.3100, 139.5300, 1200), (35.3050, 139.5000, 800)],
                     landmarks=[dict(kind='lighthouse', at=(35.2997, 139.4796), h=60, style='candle')]),
    'weymouth': dict(home=(50.6050, -2.4100), wind=225, towns=[(50.6100, -2.4550, 1100), (50.5550, -2.4400, 900), (50.6300, -2.4400, 700)]),
    'marseille': dict(home=(43.2650, 5.3350), wind=315, towns=[(43.2950, 5.3750, 1200), (43.2750, 5.3650, 900), (43.2600, 5.3800, 700), (43.3100, 5.3650, 1000)],
                      landmarks=[dict(kind='basilica', at=(43.2840, 5.3713), h=52)]),
    'rio': dict(home=(-22.9300, -43.1580), wind=150, towns=[(-22.9250, -43.1750, 1200), (-22.9000, -43.1150, 1200), (-22.9450, -43.1800, 900), (-22.9700, -43.1850, 1000)],
                landmarks=[dict(kind='statue', at=(-22.9519, -43.2105), h=38)]),
    'garda': dict(home=(45.8400, 10.8500), wind=190, lake='Lago di Garda', towns=[(45.8860, 10.8410, 800), (45.8750, 10.8760, 600), (45.7650, 10.8100, 600), (45.8730, 10.8560, 500)]),
    'istanbul': dict(home=(40.9820, 28.9920), wind=35, towns=[(40.9900, 29.0270, 1200), (41.0250, 29.0180, 1200), (41.0080, 28.9650, 1500), (41.0330, 28.9800, 1200), (40.9720, 29.0400, 1000),
                                                                 (41.0430, 29.0060, 900), (41.0480, 29.0250, 700), (41.0365, 29.0310, 600), (41.0440, 29.0440, 700)],  # Beşiktaş, Ortaköy, Kuzguncuk, Beylerbeyi: round the bridge
                     landmarks=[dict(kind='suspension', a=(41.0510, 29.0287), b=(41.0400, 29.0401), h=165, span=1074, deck=64),
                                dict(kind='mosque', at=(41.0054, 28.9767), h=43, minarets=6, mh=64),  # the Blue Mosque
                                dict(kind='mosque', at=(41.0085, 28.9799), h=55, minarets=4, mh=60, semis=2, wall='#c99272'),  # Hagia Sophia
                                dict(kind='mosque', at=(41.0162, 28.9638), h=53, minarets=4, mh=72),  # Süleymaniye
                                dict(kind='tower', at=(41.0256, 28.9741), h=63, style='galata')]),
}

# what is on the ground (the cover part), from OpenStreetMap's land use; 0 where the map has nothing, which the game
# fills in from the venue's own look. A later class in LAYERS is laid over an earlier one.
CLASSES = ['unknown', 'forest', 'scrub', 'grass', 'farmland', 'orchard', 'town', 'industry', 'sand', 'rock', 'wetland']
LAYERS = [  # (class, tags)
    ('farmland', {'landuse': ['farmland', 'meadow', 'farmyard', 'greenhouse_horticulture', 'plant_nursery']}),
    ('grass', {'landuse': ['grass', 'village_green', 'recreation_ground', 'cemetery', 'allotments'], 'natural': ['grassland'], 'leisure': ['park', 'golf_course', 'garden', 'pitch']}),
    ('orchard', {'landuse': ['orchard', 'vineyard']}),
    ('scrub', {'natural': ['scrub', 'heath']}),
    ('forest', {'landuse': ['forest'], 'natural': ['wood']}),
    ('wetland', {'natural': ['wetland']}),
    ('town', {'landuse': ['residential', 'retail', 'commercial', 'garages']}),
    ('industry', {'landuse': ['industrial', 'port', 'railway', 'construction', 'brownfield', 'quarry', 'military']}),
    ('rock', {'natural': ['bare_rock', 'scree', 'rock', 'shingle']}),
    ('sand', {'natural': ['sand', 'beach']}),
]

WORK = next((a for a in sys.argv[1:] if not a.startswith('--')), '/tmp/venues')
GAME = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'game')
ZOOM = 13  # some 19 m a pixel at the equator: finer than the SRTM under most of it
EXTENT = 8500.0  # the terrain reaches this far each way
N = 2048  # the terrain's lattice: N × N cells of some 8.3 m
LC = 2 * EXTENT / N
SC, R = 20, 508  # the sea room's cell and reach
CC = 20.0  # the cover, the open sky and the depth: 20 m cells over the terrain's square
NCC = int(2 * EXTENT / CC)
FZOOM, FEXT, FCELL = 9, 64000.0, 400.0  # the land beyond: out to 64 km, 400 m cells
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


# the main server turns a busy minute away (502, 504) but answers a retry; the mirrors are slower to fail, so tried less
MIRRORS = ['https://overpass-api.de/api/interpreter'] * 3 + ['https://overpass.private.coffee/api/interpreter']


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


def bilinear(A, x0, cell, x, z):
    """A sampled between its points: A[i, j] stands at (x0 + j·cell, x0 + i·cell)"""
    fx = np.clip((x - x0) / cell, 0, A.shape[1] - 1.001); fz = np.clip((z - x0) / cell, 0, A.shape[0] - 1.001)
    j = fx.astype(int); i = fz.astype(int); u = fx - j; v = fz - i
    return (A[i, j] * (1 - u) + A[i, j + 1] * u) * (1 - v) + (A[i + 1, j] * (1 - u) + A[i + 1, j + 1] * u) * v


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
    MID = np.array(V.get('mid', (0.0, 0.0)), float)

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
    def mosaic(zoom, reach):
        x0, y0 = tile_xy(LAT0 + reach / MLAT, LON0 - reach / MLON, zoom); x1, y1 = tile_xy(LAT0 - reach / MLAT, LON0 + reach / MLON, zoom)
        TX0, TY0, TX1, TY1 = int(x0), int(y0), int(x1), int(y1)
        IMG = np.zeros(((TY1 - TY0 + 1) * 256, (TX1 - TX0 + 1) * 256), np.float32)
        for tx in range(TX0, TX1 + 1):
            for ty in range(TY0, TY1 + 1):
                p = fetch(os.path.join(work, f'{zoom}_{tx}_{ty}.png'), f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{tx}/{ty}.png')
                if fetch_only: continue
                a = np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
                IMG[(ty - TY0) * 256:(ty - TY0 + 1) * 256, (tx - TX0) * 256:(tx - TX0 + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
        def height(x, z):
            lat, lon = to_ll(x, z); tx, ty = tile_xy(lat, lon, zoom)
            px = np.clip((tx - TX0) * 256 - 0.5, 0, IMG.shape[1] - 1.001); py = np.clip((ty - TY0) * 256 - 0.5, 0, IMG.shape[0] - 1.001)
            a = np.floor(px).astype(int); b = np.floor(py).astype(int); fx = (px - a).astype(np.float32); fy = (py - b).astype(np.float32)
            return (IMG[b, a] * (1 - fx) + IMG[b, a + 1] * fx) * (1 - fy) + (IMG[b + 1, a] * (1 - fx) + IMG[b + 1, a + 1] * fx) * fy
        return height
    height = mosaic(V.get('zoom', ZOOM), EXTENT * 1.45)
    far_height = mosaic(FZOOM, FEXT * 1.02)

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
    build = overpass(work, 'buildings', '(' + ''.join(f'way["building"]({b});' for b in boxes) + ');out geom tags;')
    tall = overpass(work, 'tall', f'(way["building"]["building:levels"~"^([89]|[1-9][0-9])$"]({bbox(8500)});way["building"]["height"~"^([3-9][0-9]|[1-9][0-9][0-9])(\\\\.[0-9]+)?( m)?$"]({bbox(8500)}););out geom tags;')
    cb = bbox(EXTENT * 1.45)
    coverQ = ''.join(f'{t}["{k}"~"^({"|".join(sorted(set(v for _, tags in LAYERS for v in tags.get(k, []))))})$"]({cb});'
                     for k in ('landuse', 'natural', 'leisure') for t in ('way', 'relation'))
    cover_els = overpass(work, 'cover', f'({coverQ});out geom;')
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

    # ---------- the sea room: the distance to the shore, 20 m grid over the middle 10 km ----------
    obst = Image.fromarray((land * 255).astype(np.uint8)); od = ImageDraw.Draw(obst)
    for el in marina:
        kind = el.get('tags', {}).get('man_made')
        if kind not in ('pier', 'breakwater', 'groyne') or not el.get('geometry'): continue
        od.line(pix(line(el['geometry'])), fill=255, width=max(1, round((6 if kind != 'pier' else 2.5 + 2 * 14) / CELL)))
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
    B = 12.0
    Rl = np.maximum(th, 1.2 + np.clip(S, 0, 60) * 0.06)
    Ra = np.where(S > 0, Rl, 0).astype(np.float32); Rd = Ra.copy()
    for di in (-2, -1, 0, 1, 2):
        for dj in (-2, -1, 0, 1, 2):
            if di or dj: Rd = np.maximum(Rd, shift(Ra, di, dj, 0))
    D = np.clip(Rd, 2.5, 60)
    ramp = np.clip(S / B, -1, 1)
    shelf = np.maximum(-(D + 0.08 * np.clip(-S - B, 0, None)), -40)
    sea = np.where(-S < B, D * ramp, np.minimum(shelf, np.where(th < -0.8, th, 0)))
    HL = np.where(S > 0, Rl * ramp, sea).astype(np.float32)
    del Rl, Ra, Rd, D, ramp, shelf, sea

    # ---------- the quadtree: fine on the coast and round the race area, coarse far off ----------
    # A square is split while it has land in it and: it is bigger than its distance allows; or the coast runs
    # through it and it is bigger than the coast's cells at that distance; or its four corners miss the heights
    # between them by more than its distance allows. Then any square with a neighbour more than one level finer is
    # split too, so a square's edge has at most one corner of its neighbours' between its own.
    LEV = int(math.log2(N))
    he = np.maximum(HL, -1.0)
    c4 = lambda f: f(f(HL[:-1, :-1], HL[1:, :-1]), f(HL[:-1, 1:], HL[1:, 1:]))
    cmax, cmin = c4(np.maximum), c4(np.minimum)
    want, nmax = [], []
    for Lv in range(LEV + 1):
        n = 1 << Lv; s = N >> Lv; Sz = s * LC
        mx = cmax.reshape(n, s, n, s).max((1, 3)); mn = cmin.reshape(n, s, n, s).min((1, 3)); nmax.append(mx)
        c = -EXTENT + (np.arange(n) + 0.5) * Sz
        dx = np.maximum(np.abs(c[None, :] - MID[0]) - Sz / 2, 0); dz = np.maximum(np.abs(c[:, None] - MID[1]) - Sz / 2, 0)
        d = np.hypot(dx, dz)
        w = (mx > 0) & ((Sz > np.clip(0.06 * d, 66, 1100)) | ((mn <= 0) & (Sz > np.maximum(LC, 0.0032 * d) + 0.1)))
        if s >= 2 and Lv < LEV:
            C = he[::s, ::s]; u = (np.arange(s) / s).astype(np.float32)
            blk = he[:N, :N].reshape(n, s, n, s)
            fit = (C[:-1, None, :-1, None] * (1 - u)[None, :, None, None] * (1 - u)[None, None, None, :]
                   + C[:-1, None, 1:, None] * (1 - u)[None, :, None, None] * u[None, None, None, :]
                   + C[1:, None, :-1, None] * u[None, :, None, None] * (1 - u)[None, None, None, :]
                   + C[1:, None, 1:, None] * u[None, :, None, None] * u[None, None, None, :])
            err = np.abs(blk - fit).max((1, 3))
            w |= (mx > 0) & (err > 0.4 + 0.0012 * d)
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

    # ---------- the cover, the open sky and the depth, on a 20 m grid ----------
    cx = -EXTENT + (np.arange(NCC) + 0.5) * CC
    CX, CZ = np.meshgrid(cx, cx)
    cpix = lambda r: [((x + EXTENT) / CC, (z + EXTENT) / CC) for x, z in r]
    ways = {}; rels = []
    for el in cover_els:
        t = el.get('tags', {})
        if el['type'] == 'way' and el.get('geometry'): ways[el['id']] = (t, [line(el['geometry'])], [])
        elif el['type'] == 'relation':
            o = [line(m['geometry']) for m in el.get('members', []) if m.get('type') == 'way' and m.get('geometry') and m.get('role') != 'inner']
            i = [line(m['geometry']) for m in el.get('members', []) if m.get('type') == 'way' and m.get('geometry') and m.get('role') == 'inner']
            rels.append((t, loops(o), loops(i)))
    cover = np.zeros((NCC, NCC), np.uint8)
    for cls, tags in LAYERS:
        img = Image.new('L', (NCC, NCC), 0); d = ImageDraw.Draw(img); n = 0
        for t, outer_r, inner_r in list(ways.values()) + rels:
            if not any(t.get(k) in v for k, v in tags.items()): continue
            for r in outer_r:
                if len(r) > 2: d.polygon(cpix(r), fill=255); n += 1
            for r in inner_r:
                if len(r) > 2: d.polygon(cpix(r), fill=0)
        if n: cover[np.asarray(img) > 127] = CLASSES.index(cls)
    Lc = bilinear(HL, -EXTENT, LC, CX, CZ)
    cover[Lc <= 0] = 0
    print('  cover:', ', '.join(f'{c} {np.mean(cover == k):.0%}' for k, c in enumerate(CLASSES) if np.mean(cover == k) >= 0.005), flush=True)
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

    # ---------- the land beyond: out to 64 km on a 400 m grid ----------
    fx = -FEXT + np.arange(NF) * FCELL
    FXX, FZZ = np.meshgrid(fx, fx)
    farh = (np.clip(np.round((far_height(FXX, FZZ) - level) / 2), -25, 4500) * 2).astype(np.int32)

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
    TOWN_XZ = [tuple(float(v) for v in to_xz(lat, lon)) for lat, lon, _ in V.get('towns', [])]
    ROOFS = {'flat': 1, 'gabled': 2, 'hipped': 2, 'pyramidal': 2, 'half-hipped': 2, 'gambrel': 2, 'mansard': 2, 'skillion': 1, 'dome': 1}
    seen, found = set(), []
    def add(r, h, roof):
        cx_ = sum(a for a, _ in r) / len(r); cz_ = sum(b for _, b in r) / len(r)
        near = min([math.hypot(cx_ - MID[0], cz_ - MID[1])] + [math.hypot(cx_ - tx, cz_ - tz) * 1.5 for tx, tz in TOWN_XZ])
        found.append({'r': r, 'h': round(min(h, 400), 1), 'roof': roof, 'd': near - min(h, 200) * 20, 'c': (cx_, cz_)})
    for el in build + tall:
        if el.get('id') in seen: continue
        seen.add(el.get('id'))
        p = poly(el.get('geometry'))
        if not p or len(p) < 4: continue
        t = el.get('tags', {}); h = num(t.get('height')) or (num(t.get('building:levels')) * 3.1 + 1.0 if t.get('building:levels') else 0)
        add(p[:-1] if p[0] == p[-1] else p, h, ROOFS.get(t.get('roof:shape'), 0))
    if os.path.exists(foot):
        # a footprint where OSM has no building (none of OSM's within 12 m of its middle), ashore, sure and house-sized
        taken = {(int(a // 12), int(b // 12)) for f in found for a, b in f['r']}
        s, w, n_, e = V['build']; added = 0
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
    built = (near >= 5) & (Lc > 0) & ~np.isin(cover, [CLASSES.index('sand'), CLASSES.index('rock'), CLASSES.index('industry')])
    cover[built] = CLASSES.index('town')
    print(f'  town from the buildings: {built.mean():.1%}', flush=True)
    # the nearest, and the tall ones from further: the town round the race area and the skyline beyond it
    found.sort(key=lambda b: b['d'])
    found = found[:5000]
    bn = np.array([min(len(b['r']), 255) for b in found], np.uint8)
    bh = np.array([round(b['h'] * 10) for b in found], np.uint16)
    broof = np.array([b['roof'] for b in found], np.uint8)
    bxz = np.array([v for b in found for p in b['r'][:255] for v in (round(p[0]), round(p[1]))], np.int16)
    towns = []
    for lat, lon, r in V.get('towns', []):
        x, z = to_xz(lat, lon); towns.append({'at': [round(float(x)), round(float(z))], 'r': r})
    landmarks = []
    for lm in V.get('landmarks', []):
        o = {k: v for k, v in lm.items() if k not in ('a', 'b', 'at')}
        for k in ('a', 'b', 'at'):
            if k in lm: x, z = to_xz(*lm[k]); o[k] = [round(float(x), 1), round(float(z), 1)]
        landmarks.append(o)

    # ---------- the files ----------
    rows = lambda a: np.diff(a.astype(np.int32), axis=1, prepend=0)
    seq = lambda a: np.diff(a.astype(np.int32), prepend=0)
    def grad(a):  # each point less what its left, upper and upper-left neighbours predict (left + up − upper-left)
        a = a.astype(np.int32); p = np.zeros_like(a)
        p[1:, 1:] = a[1:, :-1] + a[:-1, 1:] - a[:-1, :-1]; p[0, 1:] = a[0, :-1]; p[1:, 0] = a[:-1, 0]
        return a - p
    room8 = np.clip(np.round(room / 4), -127, 127).astype(np.int8)
    parts = [  # name, type, the bytes, how it is packed, its row length
        ('room', 'i8', rows(room8).astype(np.int8), 'rows', MW),
        ('tree', 'bits', np.packbits(np.array(tree, np.uint8)), None, len(tree)),
        ('drawn', 'bits', np.packbits(Ld.astype(np.uint8)), None, len(lv)),
        ('heights', 'i16', seq(vh).astype('<i2'), 'seq', 0),
        ('cover', 'u8', rows(cover).astype(np.uint8), 'rows', NCC),
        ('ao', 'u8', grad(ao // 4).astype(np.uint8), 'grad', NCC // 2),
        ('depth', 'u8', rows(depth_dm).astype(np.uint8), 'rows', NCC),
        ('far', 'i16', grad(farh // 2).astype('<i2'), 'grad', NF),
        ('bn', 'u8', bn, None, 0), ('bh', 'u16', bh.astype('<u2'), None, 0), ('broof', 'u8', broof, None, 0),
        ('bxz', 'i16', seq(bxz).astype('<i2'), 'seq', 0),
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
        'origin': [LAT0, LON0], 'turn': V['wind'], **({'home': [0, 0]} if V.get('home') else {}), 'mid': [float(MID[0]), float(MID[1])], 'lake': bool(V.get('lake')),
        'terrain': {'ext': EXTENT, 'n': N}, 'grid': {'x0': -EXTENT, 'cell': CC, 'n': NCC}, 'ao': {'cell': CC * 2, 'n': NCC // 2, 'k': 4}, 'far': {'ext': FEXT, 'cell': FCELL, 'n': NF, 'k': 2},
        'room': {'x0': MX0, 'z0': MZ0, 'cell': SC, 'nx': MW, 'nz': MH}, 'classes': CLASSES, 'parts': desc,
        'marinas': marinas, 'piers': piers, 'towns': towns, 'landmarks': landmarks,
    }
    with open(jpath, 'w') as f: json.dump(meta, f, separators=(',', ':'))
    print(f'{vid}: {os.path.getsize(jpath[:-5] + ".bin") // 1024} kB + {os.path.getsize(jpath) // 1024} kB | sea {(room > 0).mean():.0%} of the middle | marinas {len(marinas)} | piers {len(piers)} | buildings {len(found)}', flush=True)


if __name__ == '__main__':
    want = [a for a in sys.argv[2:] if not a.startswith('--')] or list(VENUES)
    for vid in want:
        print('==', vid, flush=True)
        bake(vid, VENUES[vid], '--fetch' in sys.argv)
