# Regatta: the second committee boat's moulded parts (game/lagoon.js), modelled here and exported to
# game/lagoon42.glb, as the yachts' and the motor cruiser's are: a Lagoon 42 cruising catamaran (VPLP, 2016), 12.80 m
# long, 7.70 m in the beam, 1.25 m draft, lying to her anchor with her sails stowed.
#
# Each hull: plumb at the stem, its deck edge turned round a radius; the topsides flaring out over a knuckle that runs
# her length, low aft and rising forward, a reverse chine flat under it; a round, then vee'd, canoe body below, deepest
# amidships; a mini keel and a spade rudder; the transom cut into four steps down to a swim platform; two long tinted
# windows a side in the outer topsides. Between the hulls the bridgedeck, its underside clear of the water, its front
# face sloping back from the trampoline; on it, the saloon: its plan wide (its sides on the hulls' decks), its front
# bowed and rounded at the corners, its walls nearly upright, the glass wrapping round its front and down its sides
# between dark pillars, under a roof that overhangs the windscreen as a visor. Aft of it the cockpit, teak, under a
# hardtop with a notch cut out of it over the helm; the helm station raised on the starboard side against the saloon,
# its console, its seat and its steps; the cockpit's benches and table. Forward, the trampoline between the hulls, the
# crossbeam and the longeron down the middle to the bows. The tender hangs on the davits between the sterns.
# The rig, the stowed sails, the rails, the flags, the fittings, the officers stay in lagoon.js (they move, or are
# made per boat).
#
# lagoon.js follows these lines (sheer, half-breadth, the stations of the saloon, hardtop and helm), so its fittings
# stand where this puts the decks.
#
# Materials by name, which lagoon.js swaps for its own: hull (the paint, boot-top and antifouling drawn by yacht.js's
# shader), deck (non-skid: the hulls' decks and the bridgedeck forward of the saloon), roof (non-skid: the saloon's
# roof, the hardtop's top), teak (the cockpit, the helm station, the transom steps), gel, glass, net (the trampoline),
# cushion, tube (the tender's hypalon), dark. No UVs: lagoon.js lays the decks', the teak's and the net's out from
# the plan.
#
#   blender -b --factory-startup -P blender/lagoon42.py
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'public', 'game', 'lagoon42.glb'))

# ---------- her lines (game frame: +x starboard, +y up, -z forward, the waterline at y = 0) ----------
L, ZS = 12.8, 6.4          # her length; the sterns at z = ZS, the stems at -ZS
XC = 2.9                   # each hull's centreline, off hers
def clamp(v, a, b): return max(a, min(b, v))
def lerp(a, b, t): return a + (b - a) * t
def smooth(e0, e1, x): t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def t_at(z): return clamp((ZS - z) / L, 0, 1)    # 0 at the transom ... 1 at the stem
def hb_d(t):     # a hull's half-breadth at the deck: full for most of her length, fine at the plumb stem
    if t < 0.55: return 0.86 + 0.08 * math.sin((t / 0.55) * math.pi / 2)
    return 0.94 * max(0.0, math.cos(((t - 0.55) / 0.45) * math.pi / 2)) ** 0.85 + 0.008
def sheer(t): return 1.5 + 0.28 * t ** 2
def knuckle(t): return 0.46 + 0.32 * t ** 1.2          # the knuckle's height: low aft, rising to the bow
def hb_k(t): return hb_d(t) * 0.86                     # and its half-breadth: the topsides flare out above it
def depth(t):    # the canoe body's depth under the waterline
    if t < 0.5: return 0.4 + 0.26 * math.sin((t / 0.5) * math.pi / 2)
    return 0.66 - 0.2 * ((t - 0.5) / 0.5) ** 2
def n_of(t): return lerp(2.5, 1.7, smooth(0.35, 1.0, t))   # round sections aft, vee'd forward
CROWN, RC, FULL = 0.015, 0.045, 0.03
def deck_y(z): return sheer(t_at(z))
# the transom's steps: the hull's top down from the deck to each step's tread and on to the swim platform
STEPS = ((5.45, None), (5.47, 1.18), (5.70, 1.18), (5.72, 0.92), (5.93, 0.92), (5.95, 0.70), (6.15, 0.70), (6.17, 0.52), (6.40, 0.52))
def cut_at(z):
    if z <= 5.45 + 1e-6: return None
    for (z0, h0), (z1, h1) in zip(STEPS, STEPS[1:]):
        if z0 + 1e-6 < z <= z1 + 1e-6: return h1
    return 0.52

def G(x, y, z): return Vector((x, -z, y))  # game -> Blender (Z up, +Y forward); the glTF export turns it back

# ---------- a hull: one ring a station, from its deck's edge down its side, under her, up the other, across the deck ----------
KT, KB, KD = 9, 14, 6
def topsides_x(t, y):
    sy, yk = sheer(t), knuckle(t)
    v = clamp((y - yk) / (sy - yk), 0, 1)
    return lerp(hb_k(t), hb_d(t), v) + FULL * math.sin(math.pi * v) * (hb_d(t) / 0.94)
def profile(t, top):
    """The half section (x >= 0 about the hull's centreline) from the deck's edge down to the keel; top: the deck's
    height there (the sheer, or a step's tread aft)."""
    yk = knuckle(t)
    r = 0.05 if top >= sheer(t) - 1e-6 else 0.025
    r = min(r, hb_d(t) * 0.3)
    xr = topsides_x(t, top - r)
    pts = [(xr - r + r * math.cos(a), top - r + r * math.sin(a)) for a in (math.pi / 2 * k / 4 for k in range(4, 0, -1))]
    for j in range(KT + 1):  # the topsides, flaring out, down to the knuckle
        y = lerp(top - r, yk, j / KT); pts.append((topsides_x(t, y), y))
    k = hb_d(t) / 0.94
    x0, y0 = hb_k(t) - RC * k - 0.003, yk - 0.025   # the reverse chine's flat, turned down a touch
    pts.append((x0, y0))
    d, n = depth(t), n_of(t)
    for j in range(1, KB + 1):  # the canoe body
        ph = (math.pi / 2) * (j / KB) ** 0.9
        c, s = math.cos(ph), math.sin(ph)
        pts.append((x0 * max(c, 0) ** (2 / n) if j < KB else 0.0, y0 - (y0 + d) * s ** (2 / n)))
    return pts
def ring(t, top, sx):
    side = profile(t, top)
    full = side + [(-x, y) for x, y in reversed(side[:-1])]  # the keel point once
    xd = side[0][0]
    for kk in range(-(KD - 1), KD):
        x = xd * kk / KD
        full.append((x, top + CROWN * (1 - (x / xd) ** 2)))
    return [(sx * (XC + x), y) for x, y in full], len(side) * 2 - 1
def hull_stations():
    zs = [6.40, 6.28, 6.17, 6.15, 6.05, 5.95, 5.93, 5.82, 5.72, 5.70, 5.58, 5.47]
    N = 76
    for i in range(N + 1):
        t = 0.074 + (0.9992 - 0.074) * (i / N) ** 0.92  # 5.45 forward to just short of the stem
        zs.append(ZS - t * L)
    return zs
def build_hull(bm, M, sx):
    zs = hull_stations()
    rings, nh = [], None
    for z in zs:
        t = t_at(z); c = cut_at(z)
        pts, nh = ring(t, sheer(t) if c is None else c, sx)
        rings.append([bm.verts.new(G(x, y, z)) for x, y in pts])
    R = len(rings[0])
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        ca, cb = cut_at(zs[i]), cut_at(zs[i + 1])
        za = (zs[i] + zs[i + 1]) / 2
        if ca is None and cb is None: dm = M['deck']
        elif ca == cb: dm = M['teak']                         # a step's tread, the swim platform
        else: dm = M['gel']                                   # its riser
        for j in range(R):
            q = (a[j], a[(j + 1) % R], b[(j + 1) % R], b[j])
            bm.faces.new(q if sx > 0 else tuple(reversed(q))).material_index = M['hull'] if j < nh - 1 else dm
    bm.faces.new(rings[0]).material_index = M['hull']                 # the transom under the platform
    bm.faces.new(list(reversed(rings[-1]))).material_index = M['hull']  # the stem's narrow face
    # the knuckle and the reverse chine's flat are hard edges all the way to the stem, however shallow they get there
    ns = nh // 2  # the keel's index: the half section's length
    for j in (4 + KT, 5 + KT, 2 * ns - 4 - KT, 2 * ns - 5 - KT):
        for i in range(len(rings) - 1):
            e = bm.edges.get((rings[i][j], rings[i + 1][j]))
            if e: e.smooth = False

# ---------- the hull windows: two long slots a side in the outer topsides, tinted, on the hull's own surface ----------
def build_hull_windows(bm, M, sx):
    # the long window aft, the forward cabin's window, and a small portlight each in the forepeak and the aft cabin
    for z0, z1, h0, h1, y0 in ((-1.35, 2.75, 0.22, 0.2, 1.06), (-4.15, -2.25, 0.14, 0.2, 1.17), (-5.35, -4.85, 0.1, 0.1, 1.33), (3.25, 3.75, 0.1, 0.1, 1.1)):
        NZ, NY = 40, 4
        grid = []
        for i in range(NZ + 1):
            u = i / NZ; z = lerp(z0, z1, u); t = t_at(z)
            hh = lerp(h0, h1, u) / 2 * (1 - abs(2 * u - 1) ** 8) ** 0.5  # its ends rounded
            yc = y0 + (deck_y(z) - 1.55) * 0.6
            row = []
            for j in range(NY + 1):
                y = yc + hh * (2 * j / NY - 1)
                row.append(bm.verts.new(G(sx * (XC + topsides_x(t, y) + 0.006), y, z)))
            grid.append(row)
        for i in range(NZ):
            for j in range(NY):
                q = (grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1])
                bm.faces.new(tuple(reversed(q)) if sx > 0 else q).material_index = M['glass']  # facing out

# ---------- lofting ----------
def loft(bm, levels, mats, cap_lo=None, cap_hi=None, closed=True):
    """levels: rings of game points, bottom to top (or one end to the other), the same count; mats(i, k): the band
    i's face k's material. Faces wound for a counter-clockwise ring seen from its top."""
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
BD_F, BD_A, BD_UNDER = -3.25, 5.5, 0.98   # its front (at the deck), its aft face, its underside's height
def floor_y(z): return deck_y(z) + 0.03    # the bridgedeck's top: just over the hulls' decks, which it hides between them
def build_bridgedeck(bm, M):
    # sections across, from the front face aft: the underside, the front face sloping back down from the deck
    zs = [BD_F, BD_F + 0.04] + [lerp(BD_F + 0.3, BD_A, i / 24) for i in range(25)]
    X = XC
    secs = []
    for z in zs:
        top = floor_y(z)
        if z < BD_F + 0.3:  # the front face
            u = (z - BD_F) / 0.3; lo = lerp(top - 0.08, BD_UNDER, smooth(0, 1, u)) if z > BD_F + 1e-6 else top - 0.06
        else: lo = BD_UNDER + 0.07 * smooth(BD_A - 0.4, BD_A, z)
        secs.append([(-X, lo, z), (X, lo, z), (X, top, z), (-X, top, z)])
    vs = [[bm.verts.new(G(*p)) for p in s] for s in secs]
    for i in range(len(vs) - 1):
        zc = (zs[i] + zs[i + 1]) / 2
        topm = M['teak'] if zc > 1.85 else M['deck']
        mats = [M['gel'], M['gel'], topm, M['gel']]
        for k in range(4):
            bm.faces.new((vs[i][k], vs[i][(k + 1) % 4], vs[i + 1][(k + 1) % 4], vs[i + 1][k])).material_index = mats[k]
    bm.faces.new(vs[0]).material_index = M['gel']; bm.faces.new(list(reversed(vs[-1]))).material_index = M['gel']

# ---------- the saloon ----------
# its foot from z = -2.42 (the front, on the centreline) to 1.85 (its aft face), its sides 3.02 out at the foot, 2.94 at
# the top; the glass from WIN0 to WIN1 round its front and down its sides between pillars; its top at CR_TOP, under
# the roof slab (3.12 - 3.26) that overhangs it
CR_F, CR_A, CR_W, CR_TOP, WIN_F, WIN0, WIN1 = -2.42, 1.85, 3.02, 3.14, 2.0, 2.3, 2.96
ROOF0, ROOF1 = 3.12, 3.26
def cr_front(x, w, f): return f + 0.34 * (x / w) ** 2      # the front bowed: its corners further aft
def cr_outline(u):
    w, f, a = lerp(CR_W, 2.94, u), lerp(CR_F, -2.28, u), CR_A
    rc, ra = 0.5, 0.18
    pts, tags = [], []
    # the front, from the centreline out (its samples on the pillars' edges)
    xs = sorted(set([0.0, 0.3, 0.6, 0.86, 0.98, 1.3, 1.62, 1.86, 1.98, 2.25] + [w - rc]))
    xs = [x for x in xs if x <= w - rc + 1e-6]
    for x in xs: pts.append((x, cr_front(x, w, f))); tags.append('front')
    zf = cr_front(w - rc, w, f)
    for i in range(1, 7):  # the corner, round to the side
        ph = (math.pi / 2) * i / 6
        pts.append((w - rc + rc * math.sin(ph), zf + rc * (1 - math.cos(ph)))); tags.append('corner')
    z0 = zf + rc
    for z in [v for v in (-1.3, -1.18, -0.42, -0.3, 0.55, 0.67, 1.38, 1.5) if z0 < v < a - ra] + [a - ra]:
        pts.append((w, z)); tags.append('side')
    for i in range(1, 4):
        ph = (math.pi / 2) * i / 3
        pts.append((w - ra + ra * math.cos(ph), a - ra + ra * math.sin(ph))); tags.append('acorner')
    for x in (2.55, 2.0, 1.45, 1.3, -0.2, -0.3, -1.0, -1.8, -2.55):
        if abs(x) < w - ra: pts.append((x, a)); tags.append('aft')
    # and the port half, mirrored (the aft face is already across her)
    nf = len([t for t in tags if t != 'aft'])
    star, stags = pts[:nf], tags[:nf]
    aft, atags = pts[nf:], tags[nf:]
    port = [(-x, z) for x, z in reversed(star[1:])]
    full = star + aft + port
    ftag = stags + atags + list(reversed(stags[1:]))
    return full, ftag
def build_saloon(bm, M):
    hs = [1.45, None, 1.93, WIN_F, 2.2, WIN0, 2.63, WIN1, 3.05, CR_TOP]
    levels, tags0 = [], None
    for li, h in enumerate(hs):
        u = (CR_TOP - 1.45) and ((h or 1.62) - 1.45) / (CR_TOP - 1.45)
        out, tags = cr_outline(clamp(u, 0, 1)); tags0 = tags0 or tags
        levels.append([(x, h if h is not None else max(floor_y(z), deck_y(z)) + 0.06, z) for x, z in out])
    n = len(levels[0])
    o = [(p[0], p[2]) for p in levels[0]]
    if area(o) > 0: levels = [list(reversed(l)) for l in levels]; tags0 = list(reversed(tags0))
    def mat(i, k):
        if not (3 <= i <= 6): return M['gel']  # the bands between WIN_F (the front's) or WIN0 (the sides') and WIN1 are the glass
        a, b = levels[i][k], levels[i][(k + 1) % n]
        xm, zm = (a[0] + b[0]) / 2, (a[2] + b[2]) / 2
        ta, tb = tags0[k], tags0[(k + 1) % n]
        tag = ta if ta == tb else ('corner' if 'corner' in (ta, tb) else ta)
        ax = abs(xm)
        if tag == 'front': return M['gel'] if (0.86 < ax < 0.98) or (1.86 < ax < 1.98) else M['glass']
        if tag == 'corner': return M['glass']
        if i < 5: return M['gel']  # the sides' and the aft face's glass from WIN0 up
        if tag == 'side': return M['gel'] if (-1.3 < zm < -1.18) or (-0.42 < zm < -0.3) or (0.55 < zm < 0.67) or zm > 1.38 else M['glass']
        if tag == 'aft': return M['glass'] if (1.45 < xm < 2.55) or (-2.55 < xm < -0.3) else M['gel']
        return M['gel']
    loft(bm, levels, mat, M['gel'], M['gel'])
    # the roof over it, a visor over the windscreen and a lip over the sides
    top, _ = cr_outline(1.0)
    roof = offset(ccw(top), 0.08)  # out further at the front, the windscreen's visor
    roof = [(x, z - 0.2 * smooth(0.6, -1.6, z) * (1 - (abs(x) / 3.1) ** 4)) for x, z in roof]
    roof = [(x, min(z, CR_A + 0.06)) for x, z in roof]
    edged_slab(bm, roof, ROOF0, ROOF1, M['gel'], M['gel'], M['roof'], 0.02, 0.05, 0.05)

# ---------- the hardtop over the cockpit, its notch over the helm; the helm station; the cockpit's furniture ----------
HT_F, HT_A, HT_W, HT0, HT1 = 1.62, 5.55, 3.15, 3.56, 3.7
NOTCH_X, NOTCH_Z = 1.95, 2.88
def build_hardtop(bm, M):
    o = [(HT_W, NOTCH_Z)]
    for i in range(7):  # the aft corners rounded
        ph = (math.pi / 2) * i / 6
        o.append((HT_W - 0.5 + 0.5 * math.cos(ph), HT_A - 0.5 + 0.5 * math.sin(ph)))
    for i in range(7):
        ph = math.pi / 2 + (math.pi / 2) * i / 6
        o.append((-HT_W + 0.5 + 0.5 * math.cos(ph), HT_A - 0.5 + 0.5 * math.sin(ph)))
    for i in range(7):
        ph = math.pi + (math.pi / 2) * i / 6
        o.append((-HT_W + 0.35 + 0.35 * math.cos(ph), HT_F + 0.35 + 0.35 * math.sin(ph)))
    o += [(NOTCH_X - 0.12, HT_F), (NOTCH_X, HT_F + 0.12), (NOTCH_X, NOTCH_Z - 0.12), (NOTCH_X + 0.12, NOTCH_Z)]
    edged_slab(bm, o, HT0, HT1, M['gel'], M['gel'], M['roof'], 0.03, 0.04, 0.05)
    # its two posts aft, and the struts holding its front on the saloon's roof
    for sx in (-1, 1):
        x, z = sx * 2.72, 5.28
        secs = []
        for y in (floor_y(z) - 0.02, floor_y(z) + 0.08, HT0 - 0.1, HT0 + 0.02):
            r = 0.085 if y < floor_y(z) + 0.05 or y > HT0 - 0.05 else 0.07
            secs.append([(x + r * math.cos(a), y, z + r * 1.3 * math.sin(a)) for a in (2 * math.pi * k / 16 for k in range(16))])
        loft(bm, secs, lambda i, k: M['gel'], M['gel'], M['gel'])
    for x in (-2.6, -0.9, 0.9):
        edged_slab(bm, rounded_rect(x - 0.09, x + 0.09, 1.7, 1.86, 0.05, 3), ROOF1 - 0.02, HT0 + 0.01, M['gel'], M['gel'], M['gel'], 0.01, 0.01, 0.02)
HELM = dict(x0=2.12, x1=3.22, z0=1.86, z1=2.86, y=2.12)
def build_helm(bm, M):
    h = HELM
    edged_slab(bm, rounded_rect(h['x0'], h['x1'], h['z0'], h['z1'], (0.02, 0.1, 0.1, 0.02), 3), 1.45, h['y'], M['gel'], M['gel'], M['teak'], 0.0, 0.02, 0.03)
    for k, (z0, z1, y) in enumerate(((2.86, 3.12, 1.84),)):
        edged_slab(bm, rounded_rect(2.3, 3.1, z0 - 0.02, z1, 0.06, 3), 1.45, y, M['gel'], M['gel'], M['teak'], 0.0, 0.015, 0.03)
    # the console against the saloon's aft face, its dash sloping down aft to the wheel
    cz0, cz1 = h['z0'] - 0.02, 2.12
    o = ccw(rounded_rect(2.36, 3.04, cz0, cz1, (0.02, 0.06, 0.06, 0.02), 3))
    dash = lambda z: 2.98 - 0.24 * clamp((z - cz0) / (cz1 - cz0), 0, 1)
    levels = [[(x, h['y'] - 0.02, z) for x, z in o], [(x, dash(z) - 0.05, z) for x, z in o]]
    levels.append([(lerp(2.69, x, 0.97), dash(z) - 0.012, lerp((cz0 + cz1) / 2, z, 0.96)) for x, z in o])
    levels.append([(lerp(2.69, x, 0.9), dash(z), lerp((cz0 + cz1) / 2, z, 0.88)) for x, z in o])
    loft(bm, levels, lambda i, k: M['gel'], None, M['gel'])
    # the helm seat: a moulded box, its cushion
    edged_slab(bm, rounded_rect(2.28, 3.14, 2.6, 2.84, 0.05, 3), h['y'] - 0.01, h['y'] + 0.5, M['gel'], M['gel'], M['gel'], 0.0, 0.02, 0.03)
    edged_slab(bm, rounded_rect(2.3, 3.12, 2.6, 2.84, 0.06, 3), h['y'] + 0.5, h['y'] + 0.58, M['cushion'], M['cushion'], M['cushion'], 0.01, 0.03, 0.03)
def build_cockpit(bm, M):
    f = floor_y(4.5)
    # the aft bench along the aft beam and its back, the bench down the port side, their cushions
    edged_slab(bm, rounded_rect(-2.82, 1.5, 4.92, 5.44, (0.12, 0.02, 0.02, 0.02), 4), f - 0.02, f + 0.38, M['gel'], M['gel'], M['gel'], 0.0, 0.02, 0.03)
    edged_slab(bm, rounded_rect(-2.82, 1.5, 5.3, 5.5, 0.03, 3), f + 0.38, f + 0.86, M['gel'], M['gel'], M['gel'], 0.0, 0.03, 0.04)
    edged_slab(bm, rounded_rect(-2.82, -2.3, 2.7, 4.95, (0.1, 0.02, 0.02, 0.1), 4), f - 0.02, f + 0.38, M['gel'], M['gel'], M['gel'], 0.0, 0.02, 0.03)
    edged_slab(bm, rounded_rect(-2.78, 1.46, 4.94, 5.3, 0.05, 3), f + 0.38, f + 0.47, M['cushion'], M['cushion'], M['cushion'], 0.01, 0.035, 0.035)
    edged_slab(bm, rounded_rect(-2.8, -2.32, 2.74, 4.94, 0.05, 3), f + 0.38, f + 0.47, M['cushion'], M['cushion'], M['cushion'], 0.01, 0.035, 0.035)
    edged_slab(bm, rounded_rect(-2.78, 1.46, 5.2, 5.3, 0.04, 3), f + 0.5, f + 0.84, M['cushion'], M['cushion'], M['cushion'], 0.01, 0.03, 0.03)
    # the table, teak, on its pedestal
    edged_slab(bm, rounded_rect(-2.2, -0.7, 3.0, 4.65, 0.22, 5), f + 0.68, f + 0.73, M['teak'], M['teak'], M['teak'], 0.005, 0.012, 0.015)
    edged_slab(bm, rounded_rect(-1.55, -1.35, 3.7, 3.95, 0.05, 3), f - 0.02, f + 0.69, M['gel'], M['gel'], M['gel'], 0.0, 0.0, 0.02)

# ---------- forward: the trampoline, the crossbeam, the longeron ----------
TR_F, BEAM_Z, LONG_F = -5.35, -5.45, -6.2
def build_forward(bm, M):
    # the net: a sheet across from one hull's inner deck edge to the other's, a little under them
    NZ, NX = 10, 8
    grid = []
    for i in range(NZ + 1):
        z = lerp(TR_F, BD_F + 0.02, i / NZ); t = t_at(z)
        xi = XC - hb_d(t) + 0.03
        y = sheer(t) - 0.05
        grid.append([bm.verts.new(G(lerp(-xi, xi, j / NX), y - 0.04 * math.sin(math.pi * j / NX) * math.sin(math.pi * i / NZ), z)) for j in range(NX + 1)])
    for i in range(NZ):
        for j in range(NX):
            bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j])).material_index = M['net']
    # the crossbeam: an oval section from hull to hull under the decks' edges
    yb = sheer(t_at(BEAM_Z)) - 0.14
    secs = []
    for x in [lerp(-XC, XC, i / 16) for i in range(17)]:
        secs.append([(x, yb + 0.1 * math.sin(a), BEAM_Z + 0.16 * math.cos(a)) for a in (2 * math.pi * k / 14 for k in range(14))])
    loft(bm, secs, lambda i, k: M['gel'], M['gel'], M['gel'])
    # the longeron down the middle from the bridgedeck to the bows, rising a little forward; its tip takes the forestay
    secs = []
    for i in range(13):
        z = lerp(BD_F + 0.4, LONG_F, i / 12); u = i / 12
        yc = lerp(floor_y(BD_F) - 0.16, sheer(t_at(LONG_F)) - 0.16, u)
        r = 0.13 * (1 - 0.35 * u ** 2)
        secs.append([(r * 0.85 * math.cos(a), yc + r * math.sin(a) ** 3 * 0.25 + r * 0.8 * math.sin(a), z) for a in (2 * math.pi * k / 14 for k in range(14))])
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
TD = dict(x=0.0, y=1.22, z=6.12, L=2.9, B=1.5)
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
build_bridgedeck(bm, IDX); build_saloon(bm, IDX); build_hardtop(bm, IDX); build_helm(bm, IDX); build_cockpit(bm, IDX)
build_forward(bm, IDX); build_tender(bm, IDX)
bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if f.material_index != IDX['net']])
for sx in (-1, 1): build_hull_windows(bm, IDX, sx)  # open patches: wound facing out, after the solids' normals are settled
for f in bm.faces:  # the net faces up
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
