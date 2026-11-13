# The famous regatta venues for the free race, each baked like Göcek (skopea.py) into public/game/venues/<id>.bin and
# <id>.json: the real hills from the Terrarium elevation tiles, the coast, the pontoons and the buildings from
# OpenStreetMap (the Overpass API).
#
#   python3 blender/venues.py <work dir> [id ...]      (all of them when no id is given)
#
# Downloads are kept in <work dir>/<id>, so a second run only bakes. Needs numpy and Pillow.
#
# The frame differs from skopea.py's in two ways:
#   - its origin is the middle of the venue's race area (`home`), not a town;
#   - it is turned so that the venue's prevailing wind (`wind`, the compass direction it blows from) comes from the
#     game's north (−z), since every race is laid with the wind from there. A race in Cowes beats into the Solent's
#     south-westerly, one in Sydney into the north-easterly sea breeze. `turn` in the json is that angle, so the game
#     can turn the sun with the land.
# The files are laid out as skopea.py's (see there), with these more in the json: home, turn, towns, landmarks, lake.
import gzip, json, math, os, subprocess, sys, time
import numpy as np
from PIL import Image, ImageDraw

# home: the middle of the race area, in clear water; wind: the prevailing wind's compass direction (from);
# towns: (lat, lon, radius m) where the houses the map lacks are filled in; landmarks: drawn by the game (skopea.js)
VENUES = {
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
    'garda': dict(home=(45.8400, 10.8500), wind=190, lake='Lago di Garda', towns=[(45.8860, 10.8410, 800), (45.8750, 10.8760, 600), (45.7650, 10.8100, 600), (45.8730, 10.8560, 500)]),
}

WORK = sys.argv[1] if len(sys.argv) > 1 else '/tmp/venues'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'game', 'venues')
os.makedirs(OUT, exist_ok=True)
ZOOM = 13  # some 19 m a pixel at the equator: finer than the SRTM under most of it
EXTENT = 8500.0  # the terrain reaches this far each way
SC, R = 20, 508  # the sea room's cell and reach


def fetch(path, url, data=None, tries=6):
    """curl into path once, retrying with a growing wait; the servers (Overpass above all) turn away a busy minute"""
    if os.path.exists(path) and os.path.getsize(path) > 200: return path
    wait = 8
    for k in range(tries):
        cmd = ['curl', '-s', '-m', '240' if data is not None else '60', '-A', 'regatta-venue-build/1.0', '-o', path, '-w', '%{http_code}']
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
                fetch(p, MIRRORS[i % len(MIRRORS)], f'[out:json][timeout:180];{q}', tries=1)
                print('  got', name, os.path.getsize(p) // 1024, 'kB', flush=True)
                with open(p) as f: json.load(f)['elements']
                break
            except (SystemExit, ValueError, KeyError):
                if os.path.exists(p): os.remove(p)
                time.sleep(min(10 * (i + 1), 60))
        else: raise SystemExit('Overpass gave nothing for ' + name)
    with open(p) as f: return json.load(f)['elements']


def bake(vid, V):
    work = os.path.join(WORK, vid); os.makedirs(work, exist_ok=True)
    LAT0, LON0 = V['home']
    MLAT, MLON = 110574.0, 111320 * math.cos(math.radians(LAT0))
    TH = math.radians(V['wind']); CO, SI = math.cos(TH), math.sin(TH)

    # the frame: compass metres (x east, z south) turned so the wind's direction lands on −z
    def to_xz(lat, lon):
        x = (np.asarray(lon, float) - LON0) * MLON; z = -(np.asarray(lat, float) - LAT0) * MLAT
        return x * CO + z * SI, z * CO - x * SI
    def to_ll(x, z):
        x = np.asarray(x, float); z = np.asarray(z, float)
        e = x * CO - z * SI; s = z * CO + x * SI
        return LAT0 - s / MLAT, LON0 + e / MLON
    def bbox(m):  # south, west, north, east round home, m metres each way
        return f'{LAT0 - m / MLAT:.5f},{LON0 - m / MLON:.5f},{LAT0 + m / MLAT:.5f},{LON0 + m / MLON:.5f}'

    # ---------- the heights ----------
    def tile_xy(lat, lon, z):
        n = 2 ** z; r = np.radians(lat)
        return (np.asarray(lon) + 180) / 360 * n, (1 - np.log(np.tan(r) + 1 / np.cos(r)) / math.pi) / 2 * n
    reach = EXTENT * 1.45  # the turned square's corners
    x0, y0 = tile_xy(LAT0 + reach / MLAT, LON0 - reach / MLON, ZOOM); x1, y1 = tile_xy(LAT0 - reach / MLAT, LON0 + reach / MLON, ZOOM)
    TX0, TY0, TX1, TY1 = int(x0), int(y0), int(x1), int(y1)
    IMG = np.zeros(((TY1 - TY0 + 1) * 256, (TX1 - TX0 + 1) * 256), np.float32)
    for tx in range(TX0, TX1 + 1):
        for ty in range(TY0, TY1 + 1):
            p = fetch(os.path.join(work, f'{ZOOM}_{tx}_{ty}.png'), f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{ZOOM}/{tx}/{ty}.png')
            a = np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
            IMG[(ty - TY0) * 256:(ty - TY0 + 1) * 256, (tx - TX0) * 256:(tx - TX0 + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    def height(x, z):
        lat, lon = to_ll(x, z); tx, ty = tile_xy(lat, lon, ZOOM)
        px = np.clip((tx - TX0) * 256 - 0.5, 0, IMG.shape[1] - 1.001); py = np.clip((ty - TY0) * 256 - 0.5, 0, IMG.shape[0] - 1.001)
        a = np.floor(px).astype(int); b = np.floor(py).astype(int); fx = px - a; fy = py - b
        return (IMG[b, a] * (1 - fx) + IMG[b, a + 1] * fx) * (1 - fy) + (IMG[b + 1, a] * (1 - fx) + IMG[b + 1, a + 1] * fx) * fy
    # a lake: its surface is the frame's 0
    level = 0.0
    if V.get('lake'): level = float(np.median(height(np.linspace(-300, 300, 9), np.zeros(9)))); print('  the lake stands at', round(level, 1), 'm')

    # ---------- OpenStreetMap ----------
    coastQ = f'way["natural"="coastline"]({bbox(EXTENT * 1.5)});' if not V.get('lake') else f'relation["natural"="water"]["name"="{V["lake"]}"];'
    # (a relation's members, with their geometry, need `out geom` alone: `out geom tags` leaves them out)
    shore = overpass(work, 'shore' if not V.get('lake') else 'lake', f'({coastQ}); out geom;')
    piersQ = f'(way["man_made"~"^(pier|breakwater|groyne|quay)$"]({bbox(5500)});way["leisure"="slipway"]({bbox(5500)}););out geom tags;'
    marina = overpass(work, 'piers', piersQ)
    names = overpass(work, 'marinas', f'(nwr["leisure"="marina"]({bbox(7000)}););out center tags;')
    # the buildings round the race area and in each town (the race area is water: its towns are often further off)
    def box_at(lat, lon, m): return f'{lat - m / MLAT:.5f},{lon - m / MLON:.5f},{lat + m / MLAT:.5f},{lon + m / MLON:.5f}'
    boxes = [bbox(2300)] + [box_at(lat, lon, r * 1.2) for lat, lon, r in V.get('towns', [])]
    build = overpass(work, 'buildings', '(' + ''.join(f'way["building"]({b});' for b in boxes) + ');out geom tags;')
    tall = overpass(work, 'tall', f'(way["building"]["building:levels"~"^([89]|[1-9][0-9])$"]({bbox(8500)});way["building"]["height"~"^([3-9][0-9]|[1-9][0-9][0-9])(\\\\.[0-9]+)?( m)?$"]({bbox(8500)}););out geom tags;')

    def line(pts):
        x, z = to_xz([p['lat'] for p in pts], [p['lon'] for p in pts]); return np.stack([x, z], 1)

    # ---------- land and water on an even 10 m grid ----------
    CELL = 10.0; G = 9000.0
    GW = GH = int(2 * G / CELL)
    gx = -G + (np.arange(GW) + 0.5) * CELL; gz = -G + (np.arange(GH) + 0.5) * CELL
    HX, HZ = np.meshgrid(gx, gz)
    H = height(HX, HZ) - level
    pix = lambda r: [((x + G) / CELL, (z + G) / CELL) for x, z in r]

    def rings(segs):  # ways joined end to end (by their end points, to the metre)
        segs = [s for s in segs if len(s) > 1]
        starts = {}
        for i, s in enumerate(segs): starts.setdefault((round(s[0][0]), round(s[0][1])), []).append(i)
        used = [False] * len(segs); out = []
        for i in range(len(segs)):
            if used[i]: continue
            used[i] = True; r = [segs[i]]
            while True:
                e = r[-1][-1]; k = (round(e[0]), round(e[1])); nxt = None
                for dx in (-1, 0, 1):
                    for dz in (-1, 0, 1):
                        for j in starts.get((k[0] + dx, k[1] + dz), []):
                            if not used[j] and np.hypot(*(segs[j][0] - e)) < 1.5: nxt = j; break
                        if nxt is not None: break
                    if nxt is not None: break
                if nxt is None: break
                used[nxt] = True; r.append(segs[nxt][1:])
            out.append(np.concatenate(r))
        return out

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
        print('  lake', water.mean().round(3), 'of the grid')
    else:
        coast = [line(w['geometry']) for w in shore if w.get('geometry')]
        land = H > 1.0
        if coast:
            # The coastline decides, not the elevation (whose sandbanks and seabed would come up as islands): every
            # coast way is drawn as a wall, and the sea is flooded in from the water side of each (OSM draws the land
            # on a way's left), up to the walls. What the flood doesn't reach is land: the mainland, and the islands
            # inside their rings. A flood that comes up into the hills started on the wrong side, and is put back
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
                if new.any() and np.median(H[new]) > 8: print('  put back a flood of', int(new.sum()), 'cells at median', round(float(np.median(H[new]))), 'm'); img.paste(Image.fromarray(np.where(new, 64, np.asarray(img)).astype(np.uint8))); continue
                filled = now; regions += 1
            # and water wherever the elevation is at the sea's level too: the waters OSM maps inside its coastline
            # (Sydney's coastline crosses the Heads; the harbour behind them is a water area of its own)
            land = ~filled & (H > 1.0)
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
    def shift(a, di, dj, fill):
        o = np.full_like(a, fill)
        si = slice(max(0, di), a.shape[0] + min(0, di)); sj = slice(max(0, dj), a.shape[1] + min(0, dj))
        ti = slice(max(0, -di), a.shape[0] + min(0, -di)); tj = slice(max(0, -dj), a.shape[1] + min(0, -dj))
        o[ti, tj] = a[si, sj]; return o
    def dist(src):
        d = np.where(src, 0.0, float(R)).astype(np.float32)
        for _ in range(R // SC + 2):
            for di, dj in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
                d = np.minimum(d, shift(d, di, dj, float(R)) + SC * math.hypot(di, dj))
        return np.minimum(d, R)
    room = np.where(sub, -dist(~sub), dist(sub)).astype(np.int16)

    # ---------- the terrain: 12 m cells round the race area, growing to some 90 m at the edge ----------
    def axis(c, lo, hi):
        pts = [c]; p = c
        while p < hi: p += 12 + 0.013 * (p - c); pts.append(min(p, hi))
        p = c; neg = []
        while p > lo: p -= 12 + 0.013 * (c - p); neg.append(max(p, lo))
        return np.array(neg[::-1] + pts)
    ax = axis(0.0, -EXTENT, EXTENT); az = axis(0.0, -EXTENT, EXTENT)
    TX, TZ = np.meshgrid(ax, az)
    def at(a, x, z):
        j = np.clip(((x + G) / CELL).astype(int), 0, GW - 1); i = np.clip(((z + G) / CELL).astype(int), 0, GH - 1); return a[i, j]
    th = height(TX, TZ) - level
    Lm = at(land, TX, TZ)
    ri = np.round((TZ - MZ0) / SC).astype(int); rj = np.round((TX - MX0) / SC).astype(int)
    inside = (ri >= 0) & (ri < MH) & (rj >= 0) & (rj < MW)
    rm = np.where(inside, room[np.clip(ri, 0, MH - 1), np.clip(rj, 0, MW - 1)], np.where(Lm, -R, R)).astype(np.float32)
    # the land at least 1.2 m up and rising off the beach; the bed shelving from the shore (the elevation's own depths
    # where they are deeper: the tiles carry the sea floor)
    th = np.where(Lm, np.maximum(th, 1.2 + np.clip(-rm, 0, 60) * 0.06), -np.clip(2.5 + rm * 0.12, 2.5, 30))
    heights = np.clip(np.round(th * 10), -32000, 32000).astype(np.int16)

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
    seen, buildings = set(), []
    for el in build + tall:
        if el.get('id') in seen: continue
        seen.add(el.get('id'))
        p = poly(el.get('geometry'))
        if not p or len(p) < 4: continue
        t = el.get('tags', {}); h = num(t.get('height')) or (num(t.get('building:levels')) * 3.1 + 1.0 if t.get('building:levels') else 0)
        r = p[:-1] if p[0] == p[-1] else p
        cx = sum(a for a, _ in r) / len(r); cz = sum(b for _, b in r) / len(r)
        near = min([math.hypot(cx, cz)] + [math.hypot(cx - tx, cz - tz) * 1.5 for tx, tz in TOWN_XZ])
        buildings.append({'r': r, 'h': round(min(h, 400), 1), 'd': near - min(h, 200) * 20})
    # the nearest, and the tall ones from further: the town round the race area and the skyline beyond it
    buildings.sort(key=lambda b: b['d'])
    buildings = [{'r': [[round(a), round(b)] for a, b in b['r']], 'h': b['h']} for b in buildings[:5000]]
    towns = []
    for lat, lon, r in V.get('towns', []):
        x, z = to_xz(lat, lon); towns.append({'at': [round(float(x)), round(float(z))], 'r': r})
    landmarks = []
    for lm in V.get('landmarks', []):
        o = {k: v for k, v in lm.items() if k not in ('a', 'b', 'at')}
        for k in ('a', 'b', 'at'):
            if k in lm: x, z = to_xz(*lm[k]); o[k] = [round(float(x), 1), round(float(z), 1)]
        landmarks.append(o)

    with open(os.path.join(OUT, vid + '.bin'), 'wb') as f:
        rows = lambda a: np.diff(a.astype(np.int32), axis=1, prepend=0)
        room8 = np.clip(np.round(room / 4), -127, 127).astype(np.int8)
        f.write(gzip.compress(rows(heights).astype('<i2').tobytes() + rows(room8).astype(np.int8).tobytes(), 9, mtime=0))
    meta = {
        'origin': [LAT0, LON0], 'turn': V['wind'], 'home': [0, 0], 'lake': bool(V.get('lake')),
        'terrain': {'nx': len(ax), 'nz': len(az), 'x': [round(float(v), 1) for v in ax], 'z': [round(float(v), 1) for v in az]},
        'room': {'x0': MX0, 'z0': MZ0, 'cell': SC, 'nx': MW, 'nz': MH},
        'marinas': marinas, 'piers': piers, 'buildings': buildings, 'towns': towns, 'landmarks': landmarks,
    }
    with open(os.path.join(OUT, vid + '.json'), 'w') as f: json.dump(meta, f, separators=(',', ':'))
    sea = (room > 0).mean()
    print(f'{vid}: terrain {len(ax)}x{len(az)} | sea {sea:.0%} of the middle | marinas {len(marinas)} | piers {len(piers)} | buildings {len(buildings)}', flush=True)


if __name__ == '__main__':
    want = sys.argv[2:] or list(VENUES)
    for vid in want:
        print('==', vid, flush=True)
        bake(vid, VENUES[vid])
