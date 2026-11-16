# Regatta: the second committee boat's moulded parts (game/lagoon.js), modelled here and exported to
# game/lagoon42.glb, as the yachts' and the motor cruiser's are: a Lagoon 42 cruising catamaran (VPLP, 2016), 12.80 m
# long, 7.70 m in the beam, 1.25 m draft, lying to her anchor with her sails stowed.
#
# Drawn from Lagoon's own deck plan (to scale: the hulls' plan, the saloon, the helm, the cockpit, the forward lounge,
# the hatches), its side profile (the flat sheer, the roof sloping down forward, the hull windows and ports, the raked
# transoms, the mast's place and the forestay's), and the yard's photographs (the helm's hard top, the steps).
#
# Each hull: its sheer dead flat at 1.6 m; its deck full for most of its length and rounding in to a blunt, plumb bow;
# the topsides near upright over a chine low down that runs her length, a reverse chine flat under it; a round, then
# vee'd, canoe body, deepest amidships; a mini keel and a spade rudder. Two short windows a side with a square port by
# each. Aft, the transom raked: its outer and inner walls curve down from the deck to the swim platform, and between
# them three steps are let into it. Between the hulls the bridgedeck, its underside clear of the water; on it, the
# saloon, narrower than the hulls' spread, its front straight with its corners rounded, the glass deep at its front and
# round its corners, a band of it down its sides between pillars and most of its aft face. One roof over the saloon and
# the cockpit together, its front a visor over the windscreen, sloping up aft to its highest over the cockpit, on two
# posts at its aft end; the helm to port at the saloon's aft corner, raised, under a hard top of its own over a gap cut
# in the roof, with its console, its bench for two and its steps up from the cockpit. The cockpit teak: the table and
# its L of seats to starboard, a seat to port, the bench on the aft beam and a locker in each aft corner. Forward of the
# saloon, the lounge on the bridgedeck; the two trampolines, the crossbeam under the forestay and the longeron down the
# middle out to its bowsprit. The tender hangs on the davits between the sterns.
# The rig, the stowed sails, the rails, the flags, the fittings, the officers stay in lagoon.js (they move, or are
# made per boat).
#
# lagoon.js follows these lines (sheer, half-breadth, roof, helm, cockpit), so its fittings stand where this puts the
# decks.
#
# Materials by name, which lagoon.js swaps for its own: hull (the paint, boot-top and antifouling drawn by yacht.js's
# shader), deck (non-skid: the hulls' decks and the bridgedeck forward of the saloon), roof (non-skid: the roof's top),
# teak (the cockpit, the hulls' aft decks, the steps, the helm station), gel, glass, net (the trampolines), cushion,
# tube (the tender's hypalon), dark. No UVs: lagoon.js lays the decks', the teak's and the net's out from the plan.
#
#   blender -b --factory-startup -P blender/lagoon42.py
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'public', 'game', 'lagoon42.glb'))

# ---------- her lines (game frame: +x starboard, +y up, -z forward, the waterline at y = 0) ----------
L, ZS = 12.8, 6.4          # her length; the sterns at z = ZS, the stems at -ZS
XC = 2.95                  # each hull's centreline, off hers (the plan: the hulls' outer edges 3.8 out)
def clamp(v, a, b): return max(a, min(b, v))
def lerp(a, b, t): return a + (b - a) * t
def smooth(e0, e1, x): t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def t_at(z): return clamp((ZS - z) / L, 0, 1)    # 0 at the transom ... 1 at the stem
BOW0 = t_at(-2.0)
def hb_d(t):     # a hull's half-breadth at the deck: 0.86 to 2 m short of the bow, then rounding in to a blunt nose
    if t <= BOW0: return 0.84 + 0.02 * smooth(0, 0.2, t)
    u = (t - BOW0) / (1 - BOW0)
    return 0.86 * max(0.0, 1 - u ** 2.1) ** 0.5 + 0.006
def sheer(t): return 1.6 + 0.04 * t * t
def knuckle(t): return 0.72 + 0.16 * t                 # the chine: low down, a little higher forward
def hb_k(t): return hb_d(t) * 0.92                     # the topsides flare out a little above it
def depth(t):    # the canoe body's depth under the waterline
    if t < 0.5: return 0.4 + 0.26 * math.sin((t / 0.5) * math.pi / 2)
    return 0.66 - 0.2 * ((t - 0.5) / 0.5) ** 2
def n_of(t): return lerp(2.5, 1.7, smooth(0.35, 1.0, t))   # round sections aft, vee'd forward
CROWN, RC, FULL = 0.015, 0.04, 0.02
def deck_y(z): return sheer(t_at(z))
# the transoms: an outer and an inner wall a side, raked, curving down from the deck to the swim platform; the steps let
# in between them
RAKE0, RAKE1, PLAT, WALL = 5.3, 6.25, 0.5, 0.15
def wall_top(z):
    if z <= RAKE0: return deck_y(z)
    u = clamp((z - RAKE0) / (RAKE1 - RAKE0), 0, 1)
    return PLAT + (deck_y(RAKE0) - PLAT) * (1 - u ** 1.6)
STEPS = ((5.33, None), (5.35, 1.24), (5.62, 1.24), (5.64, 0.88), (5.92, 0.88), (5.94, PLAT), (6.4, PLAT))
def step_top(z):
    if z <= 5.33 + 1e-6: return deck_y(z)
    for (z0, h0), (z1, h1) in zip(STEPS, STEPS[1:]):
        if z0 + 1e-6 < z <= z1 + 1e-6: return h1
    return PLAT

def G(x, y, z): return Vector((x, -z, y))  # game -> Blender (Z up, +Y forward); the glTF export turns it back

# ---------- a hull: one ring a station, from its deck's edge down its side, under her, up the other, across the deck ----------
KT, KB, KD = 9, 14, 5
def topsides_x(t, y):
    sy, yk = sheer(t), knuckle(t)
    v = clamp((y - yk) / (sy - yk), 0, 1)
    return lerp(hb_k(t), hb_d(t), v) + FULL * math.sin(math.pi * v) * (hb_d(t) / 0.86)
def profile(t, top):
    """The half section (x >= 0 about the hull's centreline) from the deck's edge down to the keel; top: the deck's
    height at its edge (the sheer, or a transom wall's top aft)."""
    yk = knuckle(t)
    r = min(0.06 if top >= sheer(t) - 1e-6 else 0.035, hb_d(t) * 0.3)
    xr = topsides_x(t, top - r)
    pts = [(xr - r + r * math.cos(a), top - r + r * math.sin(a)) for a in (math.pi / 2 * k / 4 for k in range(4, 0, -1))]
    for j in range(KT + 1):  # the topsides, down to the chine
        y = lerp(top - r, yk, j / KT); pts.append((topsides_x(t, y), y))
    k = hb_d(t) / 0.86
    x0, y0 = (hb_k(t) - RC * k - 0.003) * (1 - 0.25 * smooth(0.75, 1.0, t)), yk - 0.025   # the reverse chine's flat
    pts.append((x0, y0))
    d, n = depth(t), n_of(t)
    for j in range(1, KB + 1):  # the canoe body
        ph = (math.pi / 2) * (j / KB) ** 0.9
        c, s = math.cos(ph), math.sin(ph)
        pts.append((x0 * max(c, 0) ** (2 / n) if j < KB else 0.0, y0 - (y0 + d) * s ** (2 / n)))
    return pts
def ring(t, top_out, top_in, sx):
    """the ring at t: its sides up to top_out; across its deck, a wall WALL wide at either side at top_out and the
    tread between them at top_in (the same, but for the steps aft). Returns the points, the sides' count, and each
    across point's part: 'w' a wall's top, 'i' the tread"""
    side = profile(t, top_out)
    full = side + [(-x, y) for x, y in reversed(side[:-1])]  # the keel point once
    xd = side[0][0]
    xi = max(xd - WALL, xd * 0.4)
    across = [(-xi, top_out, 'w'), (-xi + 0.012, top_in, 'i')]
    for kk in range(-(KD - 1), KD):
        x = (xi - 0.03) * kk / KD; across.append((x, top_in, 'i'))
    across += [(xi - 0.012, top_in, 'i'), (xi, top_out, 'w')]
    parts = []
    for x, y, p in across:
        full.append((x, y + CROWN * (1 - (x / xd) ** 2))); parts.append(p)
    return [(sx * (XC + x), y) for x, y in full], len(side) * 2 - 1, parts
def hull_stations():
    zs = [6.4, 6.33, 6.25]
    z = 6.25
    while z > RAKE0 + 1e-6:  # the rake, closely, with the steps' risers in it
        z = round(z - 0.05, 4); zs.append(z)
    for zr in (5.94, 5.92, 5.64, 5.62, 5.35, 5.33): zs.append(zr)
    zs = sorted(set(zs), reverse=True)
    N = 72
    for i in range(1, N + 1):
        t = t_at(RAKE0) + (0.9994 - t_at(RAKE0)) * (i / N) ** 0.92
        zs.append(ZS - t * L)
    return zs
TEAK_AFT = 4.1  # the hulls' decks aft of the cockpit are teak
def build_hull(bm, M, sx):
    zs = hull_stations()
    rings, meta = [], []
    for z in zs:
        t = t_at(z)
        pts, nh, parts = ring(t, wall_top(z), step_top(z), sx)
        rings.append([bm.verts.new(G(x, y, z)) for x, y in pts]); meta.append((pts, parts))
    R = len(rings[0])
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        (pa, parts), (pb, _) = meta[i], meta[i + 1]
        zc = (zs[i] + zs[i + 1]) / 2
        for j in range(R):
            q = (a[j], a[(j + 1) % R], b[(j + 1) % R], b[j])
            if j < nh - 1: m = M['hull']
            else:
                k0, k1 = j - nh + 1, (j + 1) % R
                k1 = None if k1 < nh else k1 - nh
                ys = [pa[j][1], pa[(j + 1) % R][1], pb[j][1], pb[(j + 1) % R][1]]
                flat = max(ys) - min(ys) < 0.03 + 2 * CROWN
                pk = parts[k0] if 0 <= k0 < len(parts) else 'w'
                pk1 = parts[k1] if k1 is not None else 'w'
                if zc <= RAKE0: m = M['teak'] if zc > TEAK_AFT else M['deck']
                elif not flat: m = M['gel']                                       # a riser, a wall's inner face
                elif pk == 'i' and pk1 == 'i': m = M['teak']                        # a tread, the platform
                else: m = M['gel']                                                  # a wall's top
            bm.faces.new(q if sx > 0 else tuple(reversed(q))).material_index = m
    for rr in (rings[0], rings[-1]):  # under the platform, and the stem's narrow face: a fan from each one's middle
        c = sum((v.co for v in rr), Vector()) / len(rr); cv = bm.verts.new(c)
        for k in range(len(rr)):
            bm.faces.new((cv, rr[k], rr[(k + 1) % len(rr)])).material_index = M['hull']
    # the chine and the reverse chine's flat are hard edges all the way to the stem
    ns = nh // 2
    for j in (4 + KT, 5 + KT, 2 * ns - 4 - KT, 2 * ns - 5 - KT):
        for i in range(len(rings) - 1):
            e = bm.edges.get((rings[i][j], rings[i + 1][j]))
            if e: e.smooth = False

# ---------- the hull windows: two a side in the outer topsides with a square port by each, tinted, on the hull ----------
HULL_WINDOWS = ((3.45, 3.87, 1.04, 1.27), (1.82, 3.0, 0.98, 1.39), (-3.2, -2.04, 0.95, 1.36), (-4.1, -3.7, 1.04, 1.27))
def build_hull_windows(bm, M, sx):
    for z0, z1, y0, y1 in HULL_WINDOWS:
        NZ, NY, r = 24, 6, 0.05
        grid = []
        for i in range(NZ + 1):
            u = i / NZ; z = lerp(z0, z1, u); t = t_at(z)
            dz = min(z - z0, z1 - z) + 1e-4
            cut = r - math.sqrt(max(0.0, r * r - (r - dz) ** 2)) if dz < r else 0  # the corners rounded
            row = []
            for j in range(NY + 1):
                y = lerp(y0 + cut, y1 - cut, j / NY)
                row.append(bm.verts.new(G(sx * (XC + topsides_x(t, y) + 0.006), y, z)))
            grid.append(row)
        for i in range(NZ):
            for j in range(NY):
                q = (grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1])
                bm.faces.new(tuple(reversed(q)) if sx > 0 else q).material_index = M['glass']  # facing out

# ---------- lofting ----------
def loft(bm, levels, mats, cap_lo=None, cap_hi=None, closed=True):
    """levels: rings of game points, bottom to top (or one end to the other), the same count; mats(i, k): the band
    i's face k's material."""
    vs = [[bm.verts.new(G(*p)) for p in ring] for ring in levels]
    n = len(levels[0])
    for i in range(len(vs) - 1):
        for k in range(n if closed else n - 1):
            bm.faces.new((vs[i][k], vs[i][(k + 1) % n], vs[i + 1][(k + 1) % n], vs[i + 1][k])).material_index = mats(i, k)
    if cap_lo is not None: bm.faces.new(list(reversed(vs[0]))).material_index = cap_lo
    if cap_hi is not None: bm.faces.new(vs[-1]).material_index = cap_hi
    return vs
def area(o): return sum(o[k][0] * o[(k + 1) % len(o)][1] - o[(k + 1) % len(o)][0] * o[k][1] for k in range(len(o)))
def ccw(o): return list(reversed(o)) if area(o) > 0 else list(o)   # (x, z) plan: counter-clockwise seen from above
def offset(o, d):
    """the plan outline o (ccw seen from above) moved out by d, mitred at its corners (concave ones too)"""
    s = 1 if area(o) < 0 else -1
    out = []
    for k, (x, z) in enumerate(o):
        (xa, za), (xb, zb) = o[k - 1], o[(k + 1) % len(o)]
        n1 = (z - za, -(x - xa)); l1 = math.hypot(*n1) or 1; n1 = (s * n1[0] / l1, s * n1[1] / l1)
        n2 = (zb - z, -(xb - x)); l2 = math.hypot(*n2) or 1; n2 = (s * n2[0] / l2, s * n2[1] / l2)
        nx, nz = n1[0] + n2[0], n1[1] + n2[1]; ln = math.hypot(nx, nz) or 1; nx, nz = nx / ln, nz / ln
        c = max(0.35, nx * n1[0] + nz * n1[1])
        out.append((x + nx * d / c, z + nz * d / c))
    return out
def edged_slab(bm, outline, y0, y1, mat_side, mat_lo, mat_hi, ins_lo=0.03, ins_hi=0.04, r=0.05):
    """a slab in plan with its edges rounded: drawn in at its foot and its top, full width between"""
    o = ccw(outline)
    levels = []
    for d, y in ((ins_lo, y0), (ins_lo * 0.3, y0 + r * 0.35), (0, y0 + r), (0, y1 - r), (ins_hi * 0.3, y1 - r * 0.35), (ins_hi, y1)):
        levels.append([(x, y, z) for x, z in offset(o, -d)])
    loft(bm, levels, lambda i, k: mat_side, mat_lo, mat_hi)
def rounded_rect(x0, x1, z0, z1, r, seg=6):
    """r: one radius, or the four corners' (x1 z0, x1 z1, x0 z1, x0 z0)"""
    rs = r if isinstance(r, (tuple, list)) else (r, r, r, r)
    pts = []
    for (cx, cz, a0), rr in zip(((x1, z0, -math.pi / 2), (x1, z1, 0), (x0, z1, math.pi / 2), (x0, z0, math.pi)), rs):
        sxx = -1 if cx == x1 else 1; szz = 1 if cz == z0 else -1
        if rr < 1e-3: pts.append((cx, cz)); continue
        ox, oz = cx + sxx * rr, cz + szz * rr
        for i in range(seg + 1):
            a = a0 + (math.pi / 2) * i / seg
            pts.append((ox + rr * math.cos(a), oz + rr * math.sin(a)))
    return pts

# ---------- the bridgedeck between the hulls ----------
BD_F, BD_A, BD_UNDER = -3.2, 5.2, 0.85   # its front (at the deck), its aft face (the aft beam's), its underside
def floor_y(z): return deck_y(z) + 0.03    # the bridgedeck's top: just over the hulls' decks, which it hides between them
def build_bridgedeck(bm, M):
    zs = [BD_F, BD_F + 0.04] + [lerp(BD_F + 0.3, BD_A, i / 24) for i in range(25)]
    secs = []
    for z in zs:
        top = floor_y(z)
        if z < BD_F + 0.3:  # the front face, sloping back down to the underside
            u = (z - BD_F) / 0.3; lo = lerp(top - 0.08, BD_UNDER, smooth(0, 1, u)) if z > BD_F + 1e-6 else top - 0.06
        else: lo = BD_UNDER + 0.08 * smooth(BD_A - 0.4, BD_A, z)
        secs.append([(-XC, lo, z), (XC, lo, z), (XC, top, z), (-XC, top, z)])
    vs = [[bm.verts.new(G(*p)) for p in s] for s in secs]
    for i in range(len(vs) - 1):
        zc = (zs[i] + zs[i + 1]) / 2
        topm = M['teak'] if zc > CR_A else M['deck']
        mats = [M['gel'], M['gel'], topm, M['gel']]
        for k in range(4):
            bm.faces.new((vs[i][k], vs[i][(k + 1) % 4], vs[i + 1][(k + 1) % 4], vs[i + 1][k])).material_index = mats[k]
    bm.faces.new(vs[0]).material_index = M['gel']; bm.faces.new(list(reversed(vs[-1]))).material_index = M['gel']

# ---------- the roof over the saloon and the cockpit ----------
# its top: 3.05 m over the water at the saloon's front, rising aft to 3.58 over the helm, a little lower again at its
# aft end; 0.2 thick. Its plan: a visor out over the windscreen, its sides out beyond the saloon's, its corners rounded;
# a gap cut out of it to port over the helm
RF_F, RF_A, RF_W, RF_T = -2.27, 4.9, 2.92, 0.2
RF_RF, RF_RA = 1.1, 0.7
GAP = dict(x=-1.3, z0=1.5, z1=3.08)
def roof_top(z):
    if z < 2.6: return 3.58 - 0.53 * clamp((2.6 - z) / 4.5, 0, 1) ** 1.35
    return 3.58 - 0.08 * ((z - 2.6) / 2.3) ** 2
def roof_halfw(z):
    if z < RF_F + RF_RF: d = RF_RF - (z - RF_F); return RF_W - RF_RF + math.sqrt(max(0.0, RF_RF ** 2 - d * d))
    if z > RF_A - RF_RA: d = z - (RF_A - RF_RA); return RF_W - RF_RA + math.sqrt(max(0.0, RF_RA ** 2 - d * d))
    return RF_W
def build_roof(bm, M):
    zs = [RF_F + RF_RF * (1 - math.cos(math.pi / 2 * i / 10)) for i in range(11)]
    zs += [lerp(RF_F + RF_RF, RF_A - RF_RA, i / 30) for i in range(1, 31)]
    zs += [RF_A - RF_RA + RF_RA * math.sin(math.pi / 2 * i / 8) for i in range(1, 9)]
    zs += [GAP['z0'] - 0.01, GAP['z0'], GAP['z1'], GAP['z1'] + 0.01]
    zs = sorted(set(round(z, 4) for z in zs))
    zs[0] += 0.0
    NX, e = 16, 0.05  # points across its top; its edge's radius
    rings = []
    for z in zs:
        w = max(roof_halfw(z), 0.3)
        xl = GAP['x'] if GAP['z0'] <= z <= GAP['z1'] else -w
        xr = w
        yt, yb = roof_top(z), roof_top(z) - RF_T
        crown = lambda x: 0.04 * (1 - ((x - (xl + xr) / 2) / ((xr - xl) / 2)) ** 2)
        top = [(lerp(xl + e, xr - e, i / NX), yt + crown(lerp(xl + e, xr - e, i / NX))) for i in range(NX + 1)]
        right = [(xr - e + e * math.cos(a), yt - e + e * math.sin(a)) for a in (math.pi / 2 * (1 - k / 3) for k in range(1, 4))]
        right += [(xr, yb + e)] + [(xr - e + e * math.cos(a), yb + e - e * math.sin(a)) for a in (math.pi / 2 * k / 3 for k in range(1, 4))]
        bot = [(lerp(xr - e, xl + e, i / 6), yb) for i in range(1, 6)]
        left = [(xl + e - e * math.cos(a), yb + e - e * math.sin(a)) for a in (math.pi / 2 * (1 - k / 3) for k in range(0, 3))]
        left += [(xl, yt - e)] + [(xl + e - e * math.cos(a), yt - e + e * math.sin(a)) for a in (math.pi / 2 * k / 3 for k in range(1, 3))]
        rings.append([(x, y, z) for x, y in top + right + bot + left])
    ntop = NX + 1
    loft(bm, rings, lambda i, k: M['roof'] if k < ntop - 1 else M['gel'], M['gel'], M['gel'])
    # its two posts aft, white, from the cockpit's corners up under it
    for sx in (-1, 1):
        x, z = sx * 2.2, 4.62
        secs = []
        for y in (floor_y(z) - 0.02, floor_y(z) + 0.1, roof_top(z) - RF_T - 0.1, roof_top(z) - RF_T + 0.02):
            r = 0.075 if floor_y(z) + 0.05 < y < roof_top(z) - RF_T - 0.05 else 0.09
            secs.append([(x + r * math.cos(a), y, z + r * 1.25 * math.sin(a)) for a in (2 * math.pi * k / 16 for k in range(16))])
        loft(bm, secs, lambda i, k: M['gel'], M['gel'], M['gel'])

# ---------- the saloon ----------
# its foot from z = -2.0 (its front) to 1.65 (its aft face), 2.62 out at the sides (2.56 at the top); its walls up under
# the roof; the glass deep at its front and round its front corners, a band of it down the sides between pillars, most
# of its aft face but where the helm stands against it
CR_F, CR_A, CR_W = -2.0, 1.65, 2.62
WIN_F, WIN0 = 2.02, 2.32
def cr_outline(u):
    w, f, a = lerp(CR_W, 2.56, u), lerp(CR_F, -1.96, u), CR_A
    rc, ra = 0.5, 0.1
    pts, tags = [], []
    for x in [x for x in (0.0, 0.4, 0.82, 0.92, 1.4, 1.72, 1.82) if x <= w - rc] + [w - rc]:
        pts.append((x, f + 0.08 * (x / w) ** 2)); tags.append('front')
    zf = f + 0.08 * ((w - rc) / w) ** 2
    for i in range(1, 7):
        ph = (math.pi / 2) * i / 6
        pts.append((w - rc + rc * math.sin(ph), zf + rc * (1 - math.cos(ph)))); tags.append('corner')
    for z in (-1.05, -0.95, 0.05, 0.15, 0.95, 1.05, a - ra - 0.15, a - ra):
        pts.append((w, z)); tags.append('side')
    for i in range(1, 4):
        ph = (math.pi / 2) * i / 3
        pts.append((w - ra + ra * math.cos(ph), a - ra + ra * math.sin(ph))); tags.append('acorner')
    nf = len(pts)
    for x in (2.35, 1.25, 1.15, 0.2, -0.2, -1.15, -1.25, -1.32, -2.0):
        pts.append((x, a)); tags.append('aft')
    star, stags = pts[:nf], tags[:nf]
    aft, atags = pts[nf:], tags[nf:]
    port = [(-x, z) for x, z in reversed(star[1:])]
    return star + aft + port, stags + atags + list(reversed(stags[1:]))
def build_saloon(bm, M):
    win1 = lambda z: roof_top(z) - RF_T - 0.1
    hs = [lambda x, z: 1.5, lambda x, z: floor_y(z) + 0.06, lambda x, z: 1.95, lambda x, z: WIN_F, lambda x, z: 2.25,
          lambda x, z: WIN0, lambda x, z: (WIN0 + win1(z)) / 2, lambda x, z: win1(z), lambda x, z: roof_top(z) - RF_T + 0.03]
    levels, tags0 = [], None
    for li, h in enumerate(hs):
        u = li / (len(hs) - 1)
        out, tags = cr_outline(u); tags0 = tags0 or tags
        levels.append([(x, h(x, z), z) for x, z in out])
    n = len(levels[0])
    o = [(p[0], p[2]) for p in levels[0]]
    if area(o) > 0: levels = [list(reversed(l)) for l in levels]; tags0 = list(reversed(tags0))
    def mat(i, k):
        if not (3 <= i <= 6): return M['gel']
        a, b = levels[i][k], levels[i][(k + 1) % n]
        xm, zm = (a[0] + b[0]) / 2, (a[2] + b[2]) / 2
        ta, tb = tags0[k], tags0[(k + 1) % n]
        tag = ta if ta == tb else ('corner' if 'corner' in (ta, tb) else ta)
        ax = abs(xm)
        if tag == 'front': return M['gel'] if 0.82 < ax < 0.92 or 1.72 < ax < 1.82 else M['glass']
        if tag == 'corner': return M['glass']
        if i < 5: return M['gel']  # the sides' and the aft face's glass from WIN0 up
        if tag == 'side': return M['gel'] if (-1.05 < zm < -0.95) or (0.05 < zm < 0.15) or (0.95 < zm < 1.05) or zm > CR_A - 0.25 else M['glass']
        if tag == 'aft': return M['glass'] if (-1.15 < xm < -0.2 or 0.2 < xm < 1.15 or 1.25 < xm < 2.35) else M['gel']
        return M['gel']
    loft(bm, levels, mat, M['gel'], M['gel'])

# ---------- the helm: raised to port against the saloon's aft face, under its own hard top ----------
HELM = dict(x0=-2.76, x1=-1.38, z0=1.66, z1=2.96, y=2.5)
HT = dict(x0=-3.02, x1=-1.18, z0=1.36, z1=3.2, y0=4.5, y1=4.63)
def build_helm(bm, M):
    h = HELM
    edged_slab(bm, rounded_rect(h['x0'], h['x1'], h['z0'], h['z1'], (0.02, 0.08, 0.08, 0.02), 3), 1.5, h['y'], M['gel'], M['gel'], M['teak'], 0.0, 0.02, 0.03)
    # its steps up from the cockpit, inboard of it
    for z0, z1, y in ((2.62, 2.96, 1.92), (2.26, 2.62, 2.21)):
        edged_slab(bm, rounded_rect(-1.4, -0.82, z0, z1, 0.04, 3), 1.5, y, M['gel'], M['gel'], M['teak'], 0.0, 0.012, 0.03)
    # the console against the saloon, its dash sloping down aft to the wheel
    cz0, cz1 = h['z0'] - 0.01, 1.98
    o = ccw(rounded_rect(-2.62, -1.5, cz0, cz1, (0.06, 0.06, 0.02, 0.02), 3))
    dash = lambda z: 3.28 - 0.22 * clamp((z - cz0) / (cz1 - cz0), 0, 1)
    xm, zm = -2.06, (cz0 + cz1) / 2
    levels = [[(x, h['y'] - 0.02, z) for x, z in o], [(x, dash(z) - 0.05, z) for x, z in o]]
    levels.append([(lerp(xm, x, 0.97), dash(z) - 0.012, lerp(zm, z, 0.96)) for x, z in o])
    levels.append([(lerp(xm, x, 0.9), dash(z), lerp(zm, z, 0.88)) for x, z in o])
    loft(bm, levels, lambda i, k: M['gel'], None, M['gel'])
    # the bench for two aft of the wheel: a moulded box, its cushions, its back
    edged_slab(bm, rounded_rect(-2.72, -1.44, 2.62, 2.94, 0.05, 3), h['y'] - 0.01, h['y'] + 0.42, M['gel'], M['gel'], M['gel'], 0.0, 0.02, 0.03)
    edged_slab(bm, rounded_rect(-2.7, -1.46, 2.6, 2.92, 0.06, 3), h['y'] + 0.42, h['y'] + 0.52, M['cushion'], M['cushion'], M['cushion'], 0.01, 0.035, 0.035)
    edged_slab(bm, rounded_rect(-2.7, -1.46, 2.86, 2.95, 0.04, 3), h['y'] + 0.55, h['y'] + 0.95, M['cushion'], M['cushion'], M['cushion'], 0.01, 0.03, 0.03)
    # its hard top, over the gap in the roof, on posts: two outboard down to the hull's deck, two inboard on the roof
    t = HT
    edged_slab(bm, rounded_rect(t['x0'], t['x1'], t['z0'], t['z1'], (0.35, 0.35, 0.5, 0.5), 6), t['y0'], t['y1'], M['gel'], M['gel'], M['roof'], 0.03, 0.04, 0.045)
    for x, z, y0 in ((-2.86, 1.5, deck_y(1.5)), (-2.86, 3.06, deck_y(3.06)), (-1.22, 1.5, roof_top(1.5)), (-1.22, 3.06, roof_top(3.06))):
        secs = [[(x + 0.045 * math.cos(a), y, z + 0.045 * math.sin(a)) for a in (2 * math.pi * k / 12 for k in range(12))] for y in (y0 - 0.02, t['y0'] + 0.02)]
        loft(bm, secs, lambda i, k: M['gel'], M['gel'], M['gel'])

# ---------- the cockpit: the table and its seats to starboard, a seat to port, the aft beam's bench, the lockers ----------
def build_cockpit(bm, M):
    f = floor_y(3.5)
    slab = lambda o, y0, y1, m, r=0.03: edged_slab(bm, o, y0, y1, m, m, m, 0.0, 0.02, r)
    cush = lambda o, y0, y1: edged_slab(bm, o, y0, y1, M['cushion'], M['cushion'], M['cushion'], 0.01, 0.035, 0.035)
    # to starboard, an L of seats round the table
    slab(rounded_rect(1.32, 2.04, 2.32, 4.36, (0.02, 0.12, 0.02, 0.02), 4), f - 0.02, f + 0.38, M['gel'])
    slab(rounded_rect(0.42, 1.34, 3.98, 4.36, (0.02, 0.02, 0.08, 0.02), 4), f - 0.02, f + 0.38, M['gel'])
    cush(rounded_rect(1.34, 2.0, 2.35, 4.32, 0.05, 3), f + 0.38, f + 0.47)
    cush(rounded_rect(0.45, 1.36, 4.0, 4.32, 0.05, 3), f + 0.38, f + 0.47)
    cush(rounded_rect(1.9, 2.02, 2.4, 4.3, 0.03, 3), f + 0.5, f + 0.9)
    edged_slab(bm, rounded_rect(0.48, 1.26, 2.42, 3.92, 0.12, 5), f + 0.68, f + 0.73, M['teak'], M['teak'], M['teak'], 0.005, 0.012, 0.015)
    slab(rounded_rect(0.77, 0.97, 3.0, 3.3, 0.05, 3), f - 0.02, f + 0.69, M['gel'], 0.02)
    # to port, a seat facing in
    slab(rounded_rect(-2.02, -1.4, 3.02, 4.14, 0.06, 4), f - 0.02, f + 0.38, M['gel'])
    cush(rounded_rect(-2.0, -1.42, 3.05, 4.1, 0.05, 3), f + 0.38, f + 0.47)
    cush(rounded_rect(-2.06, -1.94, 3.08, 4.08, 0.03, 3), f + 0.5, f + 0.9)
    # the bench along the aft beam, open to the sterns
    slab(rounded_rect(-2.0, 2.0, 4.66, 5.18, 0.18, 6), f - 0.02, f + 0.4, M['gel'])
    cush(rounded_rect(-1.94, 1.94, 4.7, 5.12, 0.15, 5), f + 0.4, f + 0.48)
    # a locker in each aft corner, on the hulls' decks: the sink to port, the grill to starboard
    for sx in (-1, 1):
        slab(rounded_rect(min(sx * 2.12, sx * 2.76), max(sx * 2.12, sx * 2.76), 3.1, 3.92, 0.06, 4), deck_y(3.5) - 0.02, deck_y(3.5) + 0.86, M['gel'], 0.035)

# ---------- forward: the lounge on the bridgedeck, the trampolines, the crossbeam, the longeron ----------
BEAM_Z, LONG_F = -5.8, -6.5
def build_forward(bm, M):
    f = floor_y(-2.6)
    # the lounge ahead of the saloon: a sunpad across, its backrest against the windscreen's sill
    edged_slab(bm, rounded_rect(-1.55, 1.55, -3.12, -2.12, 0.2, 5), f - 0.02, f + 0.22, M['gel'], M['gel'], M['gel'], 0.0, 0.02, 0.03)
    edged_slab(bm, rounded_rect(-1.5, 1.5, -3.08, -2.16, 0.18, 5), f + 0.22, f + 0.34, M['cushion'], M['cushion'], M['cushion'], 0.01, 0.04, 0.04)
    edged_slab(bm, rounded_rect(-1.5, 1.5, -2.14, -2.02, 0.05, 3), f + 0.36, f + 0.72, M['cushion'], M['cushion'], M['cushion'], 0.01, 0.03, 0.03)
    # the nets: one a side of the longeron, from each hull's inner deck edge in, a little under the decks
    for sx in (-1, 1):
        NZ, NX = 10, 6
        grid = []
        for i in range(NZ + 1):
            z = lerp(BEAM_Z + 0.12, BD_F + 0.02, i / NZ); t = t_at(z)
            xi = XC - hb_d(t) + 0.03
            y = sheer(t) - 0.08
            grid.append([bm.verts.new(G(sx * lerp(0.14, xi, j / NX), y - 0.035 * math.sin(math.pi * j / NX) * math.sin(math.pi * i / NZ), z)) for j in range(NX + 1)])
        for i in range(NZ):
            for j in range(NX):
                bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j])).material_index = M['net']
    # the crossbeam under the forestay: an oval section from hull to hull
    yb = sheer(t_at(BEAM_Z)) - 0.16
    secs = [[(x, yb + 0.11 * math.sin(a), BEAM_Z + 0.17 * math.cos(a)) for a in (2 * math.pi * k / 14 for k in range(14))] for x in [lerp(-XC, XC, i / 16) for i in range(17)]]
    loft(bm, secs, lambda i, k: M['gel'], M['gel'], M['gel'])
    # the longeron down the middle, from the bridgedeck out past the crossbeam to its bowsprit
    secs = []
    for i in range(15):
        z = lerp(BD_F + 0.4, LONG_F, i / 14); u = i / 14
        yc = lerp(floor_y(BD_F) - 0.18, sheer(1.0) - 0.12, u)
        r = 0.13 * (1 - 0.45 * u ** 2)
        secs.append([(r * 0.85 * math.cos(a), yc + r * 0.8 * math.sin(a), z) for a in (2 * math.pi * k / 14 for k in range(14))])
    loft(bm, list(reversed(secs)), lambda i, k: M['gel'], M['gel'], M['gel'])

# ---------- under the water: the mini keels, the rudders ----------
def build_keel(bm, M, sx):
    N = 26; secs = []
    for i in range(N + 1):
        z = lerp(-1.1, 3.55, i / N); t = t_at(z)
        k = 0.6 * smooth(-1.1, 0.7, z) * (1 - smooth(3.2, 3.55, z)) + 0.01
        y0 = -depth(t) + 0.08
        w = 0.1 * (1 - 0.2 * smooth(0, 1, (z - 0.7) / 2.8))
        prof = [(w, y0), (w * 0.9, y0 - k * 0.6), (w * 0.55, y0 - k * 0.95), (0.0, y0 - k - 0.01)]
        ring_ = [G(sx * XC + x, y, z) for x, y in prof] + [G(sx * XC - x, y, z) for x, y in reversed(prof[:-1])]
        secs.append([bm.verts.new(p) for p in ring_])
    R = len(secs[0])
    for i in range(N):
        for j in range(R - 1):
            bm.faces.new((secs[i][j], secs[i][j + 1], secs[i + 1][j + 1], secs[i + 1][j])).material_index = M['hull']
    for r in (secs[0], secs[-1]): bm.faces.new(r).material_index = M['hull']
def foil(c, n=14):  # a NACA 00xx-ish section, chord c along z from its nose at 0, both sides: (x, z) round it
    pts = []
    for k in range(n + 1):
        u = (1 - math.cos(math.pi * k / n)) / 2
        th = 0.6 * (0.2969 * math.sqrt(u) - 0.126 * u - 0.3516 * u ** 2 + 0.2843 * u ** 3 - 0.1036 * u ** 4) * c
        pts.append((th, u * c))
    return pts + [(-x, z) for x, z in reversed(pts[1:-1])]
def build_rudder(bm, M, sx):
    z0 = 4.95
    secs = []
    for y in (-0.25, -0.5, -0.8, -1.05):
        c = lerp(0.52, 0.4, (-0.25 - y) / 0.8)
        zl = z0 + 0.06 * (-0.25 - y)  # its leading edge swept back a touch
        secs.append([(sx * XC + x, y, zl + z) for x, z in foil(c)])
    vs = loft(bm, list(reversed(secs)), lambda i, k: M['hull'], M['hull'], M['hull'])

# ---------- the tender on the davits between the sterns: a RIB, athwartships, her bow to port ----------
TD = dict(x=0.0, y=1.2, z=6.0, L=2.9, B=1.5)
def build_tender(bm, M):
    cx, cy, cz, Lt, Bt = TD['x'], TD['y'], TD['z'], TD['L'], TD['B']
    rt = 0.2
    # the tubes: round her from one quarter of the transom (+x) to the other, through her bow (-x)
    path = []
    for i in range(13):
        x = lerp(Lt / 2 - 0.05, -Lt / 2 + Bt / 2, i / 12); path.append((x, -(Bt / 2 - rt)))
    for i in range(1, 16):
        ph = -math.pi / 2 - math.pi * i / 16
        path.append((-Lt / 2 + Bt / 2 + (Bt / 2 - rt) * math.cos(ph) * 1.25, (Bt / 2 - rt) * math.sin(ph)))
    for i in range(13):
        x = lerp(-Lt / 2 + Bt / 2, Lt / 2 - 0.05, i / 12); path.append((x, (Bt / 2 - rt)))
    rings_ = []
    for k, (x, z) in enumerate(path):
        a, b = path[max(0, k - 1)], path[min(len(path) - 1, k + 1)]
        tx, tz = b[0] - a[0], b[1] - a[1]; l = math.hypot(tx, tz) or 1; nx, nz = tz / l, -tx / l
        rr = rt * (0.85 + 0.15 * smooth(Lt / 2 - 0.4, Lt / 2 - 1.2, x))  # the tubes' cones aft
        yy = cy + 0.06 * smooth(-Lt / 2 + 1.0, -Lt / 2, x)  # rising at her bow
        rings_.append([(cx + x + nx * rr * math.cos(a_), yy + rr * math.sin(a_), cz + z + nz * rr * math.cos(a_)) for a_ in (2 * math.pi * j / 12 for j in range(12))])
    loft(bm, rings_, lambda i, k: M['tube'], M['tube'], M['tube'])
    # her hull under the tubes and her floor, and the transom with the outboard on it
    o = [(x + cx, z + cz) for x, z in path]
    o = ccw(offset(ccw(o), -0.12))
    vs = loft(bm, [[(x, cy - 0.24, z) for x, z in offset(o, -0.25)], [(x, cy - 0.12, z) for x, z in o], [(x, cy - 0.05, z) for x, z in o]], lambda i, k: M['gel'], M['gel'], M['dark'])
    edged_slab(bm, rounded_rect(cx + Lt / 2 - 0.12, cx + Lt / 2 - 0.02, cz - Bt / 2 + 0.2, cz + Bt / 2 - 0.2, 0.02, 2), cy - 0.25, cy + 0.12, M['gel'], M['gel'], M['gel'], 0, 0, 0.02)
    # the outboard on her transom: its cowling, rounded, over the midsection and the clamp bracket; the leg, a foil,
    # down to the cavitation plate, the gearcase's torpedo and the skeg under it
    ox = cx + Lt / 2 + 0.02
    def sect(xc, y, ax, az, p=2.6, n=16):
        return [(xc + ax * math.copysign(abs(math.cos(a)) ** (2 / p), math.cos(a)), y, cz + az * math.copysign(abs(math.sin(a)) ** (2 / p), math.sin(a))) for a in (2 * math.pi * k / n for k in range(n))]
    cow = [(0.06, 0.15, 0.12, 2.2), (0.1, 0.19, 0.15, 2.8), (0.32, 0.22, 0.16, 3.0), (0.43, 0.2, 0.15, 2.8), (0.49, 0.15, 0.115, 2.4), (0.515, 0.08, 0.06, 2.2)]
    loft(bm, [sect(ox + 0.2 + 0.02 * (y > 0.3), cy + y, ax, az, p) for y, ax, az, p in cow], lambda i, k: M['dark'], M['dark'], M['dark'])
    loft(bm, [sect(ox + 0.17, cy + y, ax, az, 2.4) for y, ax, az in ((-0.06, 0.08, 0.06), (0.08, 0.1, 0.075))], lambda i, k: M['dark'], M['dark'], M['dark'])
    edged_slab(bm, rounded_rect(ox - 0.03, ox + 0.06, cz - 0.09, cz + 0.09, 0.02, 2), cy - 0.02, cy + 0.14, M['dark'], M['dark'], M['dark'], 0.0, 0.0, 0.015)
    loft(bm, [sect(ox + 0.17, cy + y, 0.075, 0.028, 2.0, 12) for y in (-0.47, -0.05)], lambda i, k: M['dark'], M['dark'], M['dark'])
    edged_slab(bm, rounded_rect(ox + 0.04, ox + 0.33, cz - 0.11, cz + 0.11, (0.02, 0.02, 0.08, 0.08), 3), cy - 0.405, cy - 0.39, M['dark'], M['dark'], M['dark'], 0.0, 0.0, 0.006)
    tor = []
    for i in range(9):
        u = i / 8; x = lerp(ox + 0.05, ox + 0.36, u); r = 0.05 * math.sin(math.pi * clamp(u * 1.15, 0.05, 1)) ** 0.5 + 0.004
        tor.append([(x, cy - 0.5 + r * math.cos(a), cz + r * math.sin(a)) for a in (2 * math.pi * k / 10 for k in range(10))])
    loft(bm, tor, lambda i, k: M['dark'], M['dark'], M['dark'])
    edged_slab(bm, rounded_rect(ox + 0.1, ox + 0.26, cz - 0.01, cz + 0.01, 0.005, 1), cy - 0.6, cy - 0.5, M['dark'], M['dark'], M['dark'], 0.0, 0.0, 0.005)

def material(name, color, rough=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1); p.inputs['Roughness'].default_value = rough
    return m

for o in list(bpy.data.objects): bpy.data.objects.remove(o)
MAT = {'hull': material('hull', (0.92, 0.92, 0.9), 0.2), 'deck': material('deck', (0.8, 0.79, 0.75), 0.85),
       'gel': material('gel', (0.9, 0.89, 0.86), 0.3), 'teak': material('teak', (0.45, 0.28, 0.13), 0.7),
       'glass': material('glass', (0.03, 0.04, 0.05), 0.05), 'roof': material('roof', (0.86, 0.86, 0.84), 0.85),
       'net': material('net', (0.1, 0.11, 0.12), 0.8), 'cushion': material('cushion', (0.85, 0.84, 0.8), 0.8),
       'tube': material('tube', (0.5, 0.52, 0.54), 0.6), 'dark': material('dark', (0.12, 0.13, 0.14), 0.5)}
ORDER = ['hull', 'deck', 'gel', 'teak', 'glass', 'roof', 'net', 'cushion', 'tube', 'dark']
IDX = {m: i for i, m in enumerate(ORDER)}

me = bpy.data.meshes.new('lagoon42'); ob = bpy.data.objects.new('lagoon42', me); bpy.context.scene.collection.objects.link(ob)
for m in ORDER: me.materials.append(MAT[m])
bm = bmesh.new()
for sx in (-1, 1): build_hull(bm, IDX, sx); build_keel(bm, IDX, sx); build_rudder(bm, IDX, sx)
build_bridgedeck(bm, IDX); build_saloon(bm, IDX); build_roof(bm, IDX); build_helm(bm, IDX); build_cockpit(bm, IDX)
build_forward(bm, IDX); build_tender(bm, IDX)
bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if f.material_index != IDX['net']])
for sx in (-1, 1): build_hull_windows(bm, IDX, sx)  # open patches: wound facing out, after the solids' normals are settled
for f in bm.faces:  # the nets face up
    if f.material_index == IDX['net']:
        f.normal_update()
        if f.normal.z < 0: f.normal_flip()
bm.to_mesh(me); bm.free()

bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(32))
print('verts', len(me.vertices), 'tris', sum(len(p.vertices) - 2 for p in me.polygons), 'mats', [m.name for m in me.materials])
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                          export_texcoords=False, export_normals=True, export_materials='EXPORT', export_extras=False,
                          export_animations=False, export_skins=False, export_morph=False, export_cameras=False, export_lights=False)
print('wrote', OUT, os.path.getsize(OUT))
