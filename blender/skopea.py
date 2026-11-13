# Skopea: the land round Göcek bay for the game, baked into public/game/skopea.bin and skopea.json.
#
#   python3 blender/skopea.py <work dir>
#   python3 blender/skopea.py <work dir> --buildings     (only the buildings, in the json as it is)
#
# OpenStreetMap has few of Göcek's buildings mapped, so the town is filled from Microsoft's Global ML Building
# Footprints (ODbL, as OSM): the file for quadkey 122101223 in the Turkey region (dataset-links.csv at
# minedbuildings.z5.web.core.windows.net/global-buildings), downloaded as <work dir>/footprints.csv.gz. OSM's own
# buildings come first; a footprint is added where OSM has none, if it is ashore, sure (confidence) and house-sized.
#
# The heights come from the Terrarium elevation tiles (AWS open data, SRTM on land); the coastline, the marinas'
# pontoons and the town's buildings from OpenStreetMap (the Overpass API). Both are downloaded into <work dir> once,
# with curl, and kept there. Needs numpy and Pillow.
#
# The frame: metres from 36.7525 N 28.9395 E (Göcek), x east and z south, as the game's own (the wind from the north
# blows towards +z). skopea.bin is gzipped (a host serves a .bin as it is, so it is packed here and land.js unpacks
# it), and holds, little-endian, each row as differences from the point before it (the first from 0), which pack far
# smaller than the values:
#   the terrain: nx × nz Int16 heights in decimetres, on the uneven grid whose axes skopea.json lists (fine round the
#     bay, coarse far off)
#   the sea room: mx × mz Int8 in steps of 4 m, on an even grid of `cell` metres: how far it is to the shore, + at
#     sea, − on land (as far as 508 m)
import gzip, json, math, os, subprocess, sys, time
import numpy as np
from PIL import Image, ImageDraw

WORK = sys.argv[1] if len(sys.argv) > 1 else '/tmp/skopea'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'game')
LAT0, LON0 = 36.7525, 28.9395
MLAT, MLON = 110574.0, 111320 * math.cos(math.radians(LAT0))
os.makedirs(WORK, exist_ok=True)

def to_xz(lat, lon): return (np.asarray(lon) - LON0) * MLON, -(np.asarray(lat) - LAT0) * MLAT

# ---------- OpenStreetMap: the query, and the buildings ----------
def overpass(name, q):
    p = os.path.join(WORK, name + '.json')
    for k in range(10):  # the main server turns a busy minute away (502, 504) but answers a retry
        try:
            with open(p) as f: return json.load(f)['elements']
        except (OSError, ValueError, KeyError): pass
        u = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'][k % 4 == 3]
        subprocess.run(['curl', '-s', '-m', '200', '-A', 'regatta-map-build/1.0', '-o', p, '--data-urlencode', f'data=[out:json][timeout:180];{q}', u])
        time.sleep(min(60, 8 * (k + 1)) if k else 0)
    raise SystemExit('Overpass gave nothing for ' + name)

def poly(el):
    g = el.get('geometry') or []
    if len(g) < 2: return None
    x, z = to_xz([p['lat'] for p in g], [p['lon'] for p in g])
    return [[round(float(a), 1), round(float(b), 1)] for a, b in zip(x, z)]

# the buildings: the town and the villas all round the bay, OSM's and the footprints; the 5000 nearest the town
def footprints(ashore):
    p = os.path.join(WORK, 'footprints.csv.gz')
    if not os.path.exists(p): print('no', p, ': OSM buildings only'); return []
    out = []
    with gzip.open(p, 'rt') as f:
        for ln in f:
            el = json.loads(ln); ring = el['geometry']['coordinates'][0]
            lon = [c[0] for c in ring]; lat = [c[1] for c in ring]
            if not (36.705 < lat[0] < 36.795 and 28.875 < lon[0] < 29.005) or el['properties'].get('confidence', 1) < 0.75: continue
            x, z = to_xz(lat, lon); r = [[round(float(a), 1), round(float(b), 1)] for a, b in zip(x, z)]
            r = r[:-1] if r[0] == r[-1] else r
            area = abs(sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r)))) / 2
            cx = sum(a for a, _ in r) / len(r); cz = sum(b for _, b in r) / len(r)
            if area < 25 or area > 4000 or not ashore(cx, cz): continue
            h = el['properties'].get('height', -1)
            out.append((cx, cz, r, round(h, 1) if h and h > 0 else 0))
    return out

def town_buildings(ashore=lambda x, z: True):
    build = overpass('build2', '(way["building"](36.705,28.875,36.795,29.005););out geom tags;')
    out = []
    for el in build:
        p = poly(el)
        if not p or len(p) < 4: continue
        t = el.get('tags', {})
        lv = t.get('building:levels'); hh = t.get('height')
        try: h = float(str(hh).split()[0]) if hh else (float(lv) * 3.1 + 1.0 if lv else 0)
        except ValueError: h = 0
        r = p[:-1] if p[0] == p[-1] else p
        out.append((math.hypot(sum(a for a, _ in r) / len(r), sum(b for _, b in r) / len(r)), {'r': [[round(a), round(b)] for a, b in r], 'h': round(h, 1)}))
    # a footprint where OSM has no building: none of OSM's within 12 m of its middle
    taken = set()
    for _, b in out:
        for a, c in b['r']: taken.add((int(a // 12), int(c // 12)))
    added = 0
    for cx, cz, r, h in footprints(ashore):
        if (int(cx // 12), int(cz // 12)) in taken: continue
        out.append((math.hypot(cx, cz), {'r': [[round(a), round(b)] for a, b in r], 'h': h})); added += 1
    print('osm', len(out) - added, '| footprints added', added)
    out.sort(key=lambda o: o[0])
    return [b for _, b in out[:5000]]

if '--buildings' in sys.argv:
    path = os.path.join(OUT, 'skopea.json')
    with open(path) as f: meta = json.load(f)
    M = meta['room']; T = meta['terrain']
    with open(os.path.join(OUT, 'skopea.bin'), 'rb') as f: raw = gzip.decompress(f.read())
    room = np.frombuffer(raw[T['nx'] * T['nz'] * 2:], np.int8).reshape(M['nz'], M['nx']).astype(np.int32).cumsum(1).astype(np.int8)
    def ashore(x, z):  # at least 8 m in from the water, by the sea room (4 m steps); off its grid, let it be
        i = round((z - M['z0']) / M['cell']); j = round((x - M['x0']) / M['cell'])
        return not (0 <= i < M['nz'] and 0 <= j < M['nx']) or room[i, j] <= -2
    before = len(meta['buildings']); meta['buildings'] = town_buildings(ashore)
    with open(path, 'w') as f: json.dump(meta, f, separators=(',', ':'))
    print('buildings', before, '->', len(meta['buildings'])); sys.exit()

# ---------- the heights ----------
Z14 = 14
def tile_xy(lat, lon, z):
    n = 2 ** z; r = np.radians(lat)
    return (np.asarray(lon) + 180) / 360 * n, (1 - np.log(np.tan(r) + 1 / np.cos(r)) / math.pi) / 2 * n

def mosaic(km=9.5):
    dlat, dlon = km * 1000 / MLAT, km * 1000 / MLON
    x0, y0 = tile_xy(LAT0 + dlat, LON0 - dlon, Z14); x1, y1 = tile_xy(LAT0 - dlat, LON0 + dlon, Z14)
    tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)
    img = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256), np.float32)
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            p = os.path.join(WORK, f'{Z14}_{tx}_{ty}.png')
            if not os.path.exists(p):
                subprocess.run(['curl', '-sf', '-o', p, f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z14}/{tx}/{ty}.png'], check=True)
            a = np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
            img[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    return img, tx0, ty0

IMG, TX0, TY0 = mosaic()
def height(x, z):
    lat = LAT0 - np.asarray(z) / MLAT; lon = LON0 + np.asarray(x) / MLON
    tx, ty = tile_xy(lat, lon, Z14)
    px = np.clip((tx - TX0) * 256 - 0.5, 0, IMG.shape[1] - 1.001); py = np.clip((ty - TY0) * 256 - 0.5, 0, IMG.shape[0] - 1.001)
    x0 = np.floor(px).astype(int); y0 = np.floor(py).astype(int); fx = px - x0; fy = py - y0
    return (IMG[y0, x0] * (1 - fx) + IMG[y0, x0 + 1] * fx) * (1 - fy) + (IMG[y0 + 1, x0] * (1 - fx) + IMG[y0 + 1, x0 + 1] * fx) * fy

# ---------- OpenStreetMap ----------
shore = overpass('marina', '(way["leisure"="marina"](36.73,28.92,36.765,28.96);relation["leisure"="marina"](36.73,28.92,36.765,28.96);'
                 'way["man_made"~"pier|breakwater|groyne|quay"](36.73,28.92,36.765,28.96);way["natural"="coastline"](36.70,28.88,36.80,29.00);); out geom tags;')
coast = [w for w in shore if w.get('tags', {}).get('natural') == 'coastline']
marina = [w for w in shore if w.get('tags', {}).get('natural') != 'coastline']
names = overpass('mar2', '(nwr["leisure"="marina"](36.72,28.90,36.78,28.99););out center tags;')

def line(el): x, z = to_xz([p['lat'] for p in el['geometry']], [p['lon'] for p in el['geometry']]); return np.stack([x, z], 1)

# ---------- land and sea, on an even 10 m grid ----------
# The coastline ways, joined end to end into rings (land on their left, as OSM draws them), are filled into a mask;
# where they leave the box the elevation decides. Without them, the elevation alone (SRTM's sea is 0).
CELL = 10.0
GX0, GX1, GZ0, GZ1 = -9000.0, 9000.0, -9000.0, 9000.0
GW, GH = int((GX1 - GX0) / CELL), int((GZ1 - GZ0) / CELL)
gx = GX0 + (np.arange(GW) + 0.5) * CELL; gz = GZ0 + (np.arange(GH) + 0.5) * CELL
HX, HZ = np.meshgrid(gx, gz)
H = height(HX, HZ)
land = H > 1.0

def rings(ways):
    segs = [line(w) for w in ways if len(w.get('geometry', [])) > 1]
    out, used = [], [False] * len(segs)
    for i in range(len(segs)):
        if used[i]: continue
        used[i] = True; r = [segs[i]]
        while True:
            end = r[-1][-1]; best = None
            for j in range(len(segs)):
                if not used[j] and np.hypot(*(segs[j][0] - end)) < 1.0: best = j; break
            if best is None: break
            used[best] = True; r.append(segs[best][1:])
        out.append(np.concatenate(r))
    return out

if coast:
    img = Image.new('L', (GW, GH), 0); d = ImageDraw.Draw(img)
    closed, opened = [], []
    for r in rings(coast): (closed if np.hypot(*(r[0] - r[-1])) < 1.0 else opened).append(r)
    pix = lambda r: [((x - GX0) / CELL, (z - GZ0) / CELL) for x, z in r]
    # closed rings: islands and the mainland's loops inside the box, filled; the mainland's open run is left to the
    # elevation, then cut by a line along it: whatever the elevation calls land on its sea side within 150 m is sea
    for r in closed: d.polygon(pix(r), fill=255)
    m = np.asarray(img) > 127
    for r in opened: d.line(pix(r), fill=128, width=1)
    osm = np.asarray(img)
    # land: inside a closed ring, or the elevation says land and it isn't across an open coastline from it
    seed = (H > 1.0) | m
    land = seed.copy()
    # the open coast: each sample of it pushes the nearer side to agree with OSM — sea within 25 m on its right
    for r in opened:
        for k in range(len(r) - 1):
            a, b = r[k], r[k + 1]; n = max(1, int(np.hypot(*(b - a)) / 5))
            for t in np.linspace(0, 1, n, endpoint=False):
                p = a + (b - a) * t; tx, tz = (b - a) / (np.hypot(*(b - a)) + 1e-9)
                rx, rz = -tz, tx  # the right of the way: the sea
                for s in (5, 15, 25):
                    i, j = int((p[1] + rz * s - GZ0) / CELL), int((p[0] + rx * s - GX0) / CELL)
                    if 0 <= i < GH and 0 <= j < GW: land[i, j] = False
                    i, j = int((p[1] - rz * s - GZ0) / CELL), int((p[0] - rx * s - GX0) / CELL)
                    if 0 <= i < GH and 0 <= j < GW: land[i, j] = True
    land |= m
    print('coast rings', len(closed), 'open', len(opened))

# ---------- the sea room: distance to the shore, on a 20 m grid round the bay ----------
# a chamfer distance, relaxed over the eight neighbours until it reaches 508 m (as far as the file's 4 m steps go)
SC, R = 20, 508
k0 = int((-5000 - GZ0) / CELL); k1 = int((5000 - GZ0) / CELL)  # the grid's middle 10 km
# the marinas count as shore too: a pontoon and the yachts moored stern-to on each side of it, 14 m out
obst = Image.fromarray((land * 255).astype(np.uint8))
od = ImageDraw.Draw(obst)
for el in marina:
    t = el.get('tags', {}); kind = t.get('man_made')
    if kind not in ('pier', 'breakwater', 'groyne'): continue
    pts = [((x - GX0) / CELL, (z - GZ0) / CELL) for x, z in line(el)]
    od.line(pts, fill=255, width=max(1, round((6 if kind != 'pier' else 2.5 + 2 * 14) / CELL)))
land_o = np.asarray(obst) > 127
sub = land_o[k0:k1:2, k0:k1:2]
MX0, MZ0 = gx[k0] + CELL / 2, gz[k0] + CELL / 2  # the centre of the first 20 m cell
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
room = np.where(sub, -dist(~sub), dist(sub)).astype(np.int16)  # at sea: to the nearest land; on land: to the sea

# ---------- the terrain grid: 12 m cells round the bay, growing to some 90 m at the edge ----------
def axis(c, lo, hi):
    pts = [c]; p = c
    while p < hi: p += 12 + 0.013 * (p - c); pts.append(min(p, hi))
    p = c; neg = []
    while p > lo: p -= 12 + 0.013 * (c - p); neg.append(max(p, lo))
    return np.array(neg[::-1] + pts)
ax = axis(-400.0, -8500.0, 8500.0); az = axis(700.0, -8500.0, 8500.0)
TX, TZ = np.meshgrid(ax, az)
# heights from the 10 m grid's mask and the elevation: land at least 1.2 m up and rising off the beach, the sea floor
# shelving down from the shore so the water meets the land along the coastline
def at(a, x, z):
    j = np.clip(((x - GX0) / CELL).astype(int), 0, GW - 1); i = np.clip(((z - GZ0) / CELL).astype(int), 0, GH - 1); return a[i, j]
th = height(TX, TZ)
L = at(land, TX, TZ)
ri = np.round((TZ - MZ0) / SC).astype(int); rj = np.round((TX - MX0) / SC).astype(int)
inside = (ri >= 0) & (ri < MH) & (rj >= 0) & (rj < MW)
rm = np.where(inside, room[np.clip(ri, 0, MH - 1), np.clip(rj, 0, MW - 1)], np.where(L, -R, R)).astype(np.float32)
th = np.where(L, np.maximum(th, 1.2 + np.clip(-rm, 0, 60) * 0.06), -np.clip(2.5 + rm * 0.12, 2.5, 30))
heights = np.clip(np.round(th * 10), -32000, 32000).astype(np.int16)

# ---------- the marinas, the pontoons and the town ----------
marinas = []
for el in names:
    if el.get('tags', {}).get('leisure') != 'marina': continue
    c = el.get('center') or {'lat': el.get('lat'), 'lon': el.get('lon')}
    if c['lat'] is None: continue
    x, z = to_xz(c['lat'], c['lon'])
    marinas.append({'name': el.get('tags', {}).get('name', ''), 'at': [round(float(x), 1), round(float(z), 1)]})
piers = []
for el in marina:
    t = el.get('tags', {})
    if t.get('man_made') in ('pier', 'breakwater', 'groyne', 'quay') or t.get('leisure') == 'slipway':
        p = poly(el)
        if p: piers.append({'kind': t.get('man_made') or 'slipway', 'pts': p, 'area': t.get('area') == 'yes' or p[0] == p[-1] and len(p) > 3,
                            'floating': t.get('floating') == 'yes' or 'pontoon' in t.get('name', '').lower(), 'w': float(str(t.get('width', '0')).split()[0] or 0) if str(t.get('width', '0')).replace('.', '', 1).split()[0].isdigit() else 0})
buildings = town_buildings()

with open(os.path.join(OUT, 'skopea.bin'), 'wb') as f:
    rows = lambda a: np.diff(a.astype(np.int32), axis=1, prepend=0)  # wraps the same way the sums wrap in land.js
    room8 = np.clip(np.round(room / 4), -127, 127).astype(np.int8)
    raw = rows(heights).astype('<i2').tobytes() + rows(room8).astype(np.int8).tobytes()
    f.write(gzip.compress(raw, 9, mtime=0))
meta = {
    'origin': [LAT0, LON0],
    'terrain': {'nx': len(ax), 'nz': len(az), 'x': [round(float(v), 1) for v in ax], 'z': [round(float(v), 1) for v in az]},
    'room': {'x0': MX0, 'z0': MZ0, 'cell': SC, 'nx': MW, 'nz': MH},
    'marinas': marinas, 'piers': piers, 'buildings': buildings,
}
with open(os.path.join(OUT, 'skopea.json'), 'w') as f: json.dump(meta, f, separators=(',', ':'))
print('terrain', len(ax), 'x', len(az), '| room', MW, 'x', MH, '| marinas', [m['name'] for m in marinas], '| piers', len(piers), '| buildings', len(buildings))
