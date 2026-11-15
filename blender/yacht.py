# Regatta: the game's JPK 1050 (game/yacht.js), the hard parts modelled here and exported to
# game/yacht.glb, to JPK's drawings (the half-breadth plan, the deck plan and the brochure's profile): the hull
# (scow-inspired: a rounded spoon bow whose forefoot lifts clear of the water, the waterline starting a metre aft of
# the stem; the beam carried aft to a wide, slightly raked transom whose bottom sits clear of the water at rest; a hard
# chine the whole length, dropping towards the stem, and a knuckle in the topsides above it), a T-keel (a slim fin under
# a long lead bulb), the deck with the cockpit cut into it behind a closed transom (a footwell narrowing forward to the
# companionway, foot braces on its floor) and the long coachroof, tapering forward and ramping down into the foredeck,
# a long smoked window in each side and the hatch garage on its top.
# The sails, rig, lifelines, winches, tiller, twin rudders, hatches and decals stay in yacht.js (they move, or are
# made per boat).
#
# The topsides above the chine follow yacht.js's own lines (halfBeam, sheerAt, canoe, section), so the logo and
# name decals it wraps onto the hull still lie on this surface; the sheer, deck outline, cockpit opening and
# the coachroof's footprint and top are where yacht.js's fittings expect them.
#
# Materials by name, which yacht.js swaps for its own: hull (paint, boot-top and antifouling drawn by its shader),
# deck (non-skid: the deck and the cockpit's floor, no teak aboard), gel, glass. No UVs: yacht.js lays the deck's
# out from the plan itself.
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/yacht.py
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'public', 'game', 'yacht.glb'))

# ---------- yacht.js's lines (game frame: +x starboard, +y up, -z forward, the waterline at y = 0) ----------
L, B = 10.45, 3.54
STERN_Z = L / 2
def clamp(v, a, b): return max(a, min(b, v))
def lerp(a, b, t): return a + (b - a) * t
def smooth(e0, e1, x): t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def spline(P, t):  # a smooth curve through the points (t, v): cubic Hermite, the slopes from the neighbours
    t = clamp(t, P[0][0], P[-1][0]); i = 0
    while i < len(P) - 2 and t > P[i + 1][0]: i += 1
    (t0, v0), (t1, v1) = P[i], P[i + 1]; h = t1 - t0; u = (t - t0) / h
    sl = lambda k: (P[min(k + 1, len(P) - 1)][1] - P[max(k - 1, 0)][1]) / (P[min(k + 1, len(P) - 1)][0] - P[max(k - 1, 0)][0])
    m0, m1 = sl(i) * h, sl(i + 1) * h
    return (2 * u ** 3 - 3 * u * u + 1) * v0 + (u ** 3 - 2 * u * u + u) * m0 + (-2 * u ** 3 + 3 * u * u) * v1 + (u ** 3 - u * u) * m1
# the deck's half-breadth as a share of the widest, t = 0 at the transom … 1 at the stem: read off JPK's half-breadth
# plan. The widest a quarter of the way forward, the transom 95% of it, and the bow full to a rounded nose
HB = [(0, 0.95), (0.05, 0.96), (0.1, 0.976), (0.15, 0.988), (0.2, 0.996), (0.25, 1), (0.3, 1), (0.35, 0.992), (0.4, 0.98),
      (0.45, 0.96), (0.5, 0.929), (0.55, 0.893), (0.6, 0.842), (0.65, 0.787), (0.7, 0.719), (0.75, 0.644), (0.8, 0.557),
      (0.85, 0.455), (0.9, 0.344), (0.95, 0.213), (0.98, 0.12), (1, 0)]
def half_beam(t): return (B / 2) * max(0.0, spline(HB, t))
def sheer(t): return 1.04 + 0.17 * t ** 1.6
# the keel line, metres below the water (− above it), off the brochure's profile: the transom's bottom 0.24 clear of
# the water, 0.4 deep amidships, the waterline starting a metre aft of the stem and the forefoot 0.32 up at the stem
CANOE = [(0, -0.24), (0.1, -0.07), (0.2, 0.04), (0.3, 0.17), (0.4, 0.33), (0.5, 0.4), (0.6, 0.38), (0.7, 0.31),
         (0.8, 0.21), (0.9, 0.0), (0.95, -0.13), (1, -0.32)]
def canoe(t): return spline(CANOE, t)
def z_at(t): return STERN_Z - t * L
def t_at(z): return clamp((STERN_Z - z) / L, 0, 1)
def deck_y(z, x=0.0):
    hb = max(half_beam(t_at(z)), 0.3)
    return sheer(t_at(z)) + 0.05 * (1 - (x / hb) ** 2)
FLARE = 0.09  # the topsides' flare: the waterline this much narrower than the deck (yacht.js's FLARE)
def n_of(t): return lerp(2.9, 2.0, clamp((t - 0.45) / 0.55, 0, 1))  # boxy aft, still full forward
def section(t, s):  # yacht.js's section(): s = 0 at the deck edge ... 1 at the keel -> (x, y, dz)
    hb, sy, d, n = half_beam(t), sheer(t), canoe(t), n_of(t)
    phi = s * math.pi / 2; c, sn = math.cos(phi), math.sin(phi); yr = sn ** (2 / n)
    x = hb * c ** (2 / n) * (1 - FLARE * sn)
    dz = 0.38 * yr ** 1.6 * ((t - 0.88) / 0.12) ** 2 if t > 0.88 else 0.0  # the spoon bow: its foot curving back under it
    if t < 0.03: dz -= 0.1 * yr * (1 - t / 0.03)  # the transom raked: its bottom 10 cm forward of its top
    return x, sy - (sy + d) * yr, dz

def G(x, y, z): return Vector((x, -z, y))  # game -> Blender (Z up, +Y forward); the glTF export turns it back

# ---------- the hull section: yacht.js's topsides down to the knuckle, a flat panel to the chine, then a flat-ish bottom ----------
SPLIT = 0.5           # share of the section's samples above the chine
KS = 2 / 3            # share of those above the knuckle
# the hard chine half a metre above the water aft, dropping to 0.3 at the stem, and the knuckle in the topsides 0.76
# above the water aft to 0.79 at the stem (the photos' lines; yacht.js's chineY, knuckleY)
def chine_y(t): return max(0.5 - 0.2 * t * t, 0.06 - canoe(t))   # (kept 6 cm above the forefoot, where they meet at the stem)
def knuckle_y(t): return 0.76 + 0.03 * t
def chine_w(t): return 1 - smooth(0.96, 1.0, t)   # 1: hard … easing only into the stem
def s_at(t, y):  # where the section formula comes down to height y
    sy, d, n = sheer(t), canoe(t), n_of(t)
    return math.asin(clamp((sy - y) / (sy + d), 0, 1) ** (n / 2)) * 2 / math.pi
def hull_point(t, s, s0=0.0):  # s0: where the topsides start, under the turn of the deck edge (edge_arc)
    hb, sy, d, n = half_beam(t), sheer(t), canoe(t), n_of(t)
    sc = s_at(t, chine_y(t))  # where the formula reaches the chine
    sk = min(s_at(t, knuckle_y(t)), sc)  # and the knuckle
    if s <= SPLIT * KS: return section(t, lerp(s0, sk, s / (SPLIT * KS)))
    if s <= SPLIT:  # the flat panel between the knuckle and the chine, turned in from the section's curve
        u = (s - SPLIT * KS) / (SPLIT * (1 - KS))
        (xk, yk, dk), (xc2, yc3, dc) = section(t, sk), section(t, sc)
        return lerp(xk, xc2, u), lerp(yk, yc3, u), lerp(dk, dc, u)
    sf = sc + (s - SPLIT) / (1 - SPLIT) * (1 - sc)
    fx, fy, dz = section(t, sf)
    w = chine_w(t)
    if w <= 0: return fx, fy, dz
    xc, yc2, _ = section(t, sc)
    u = (s - SPLIT) / (1 - SPLIT)
    d2 = d * 0.86
    dr = math.radians(lerp(10, 20, clamp(t, 0, 1)))  # deadrise at the chine: a flat run aft, a little more forward
    k = xc * 0.42
    P0 = (xc, yc2); P1 = (xc - k * math.cos(dr), yc2 - k * math.sin(dr)); P2 = (xc * 0.38, -d2); P3 = (0.0, -d2)
    a, b2, c2, e = (1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3
    bx = a * P0[0] + b2 * P1[0] + c2 * P2[0] + e * P3[0]
    by = a * P0[1] + b2 * P1[1] + c2 * P2[1] + e * P3[1]
    return lerp(fx, bx, w), lerp(fy, by, w), dz

# the deck edge isn't a knife: the topsides turn onto the deck round a radius, as a moulded hull's do
def edge_arc(t):
    """the turn of the deck edge at station t: (where the topsides start below it, the arc's points from the deck down)"""
    hb, sy, d, n = half_beam(t), sheer(t), canoe(t), n_of(t)
    r = min(0.045, hb * 0.25)
    s_r = math.asin(clamp(r / (sy + d), 0, 1) ** (n / 2)) * 2 / math.pi  # the section's s at r below the sheer
    s_r = min(s_r / SPLIT * s_at(t, chine_y(t)), 0.5 * s_at(t, knuckle_y(t)))  # (a little higher: a lip at the edge)
    x_r, y_r, dz = section(t, s_r)
    arc = [(x_r - r + r * math.cos(a), y_r + r * math.sin(a), dz) for a in (math.pi / 2 * k / 4 for k in range(4, 0, -1))]
    return s_r, arc, x_r - r

def build_hull(bm, mats):
    N, KH, KD = 112, 30, 10
    rings = []
    ss = lambda j: j / KH if j / KH <= SPLIT else SPLIT + (1 - SPLIT) * ((j / KH - SPLIT) / (1 - SPLIT)) ** 1.15
    for i in range(N + 1):
        t = min(0.995, (i / N) ** 0.85)
        z = z_at(t)
        s_r, arc, xd = edge_arc(t)
        ring = [G(x, y, z + dz) for x, y, dz in arc]  # starboard: round the deck edge
        for j in range(KH + 1):  # then deck edge -> keel
            x, y, dz = hull_point(t, ss(j), s_r); ring.append(G(x, y, z + dz))
        for j in range(KH - 1, -1, -1):  # port, keel -> deck edge
            x, y, dz = hull_point(t, ss(j), s_r); ring.append(G(-x, y, z + dz))
        ring += [G(-x, y, z + dz) for x, y, dz in reversed(arc)]  # and round onto the deck
        nh = len(ring)
        for k in range(-(KD - 1), KD):  # the deck, port -> starboard, inside the turn of its edges
            x = xd * k / KD; ring.append(G(x, sheer(t) + 0.05 * (1 - (k / KD) ** 2), z))
        rings.append([bm.verts.new(p) for p in ring])
    M = len(rings[0])
    for i in range(N):
        a, b = rings[i], rings[i + 1]
        for j in range(M):
            f = bm.faces.new((a[j], a[(j + 1) % M], b[(j + 1) % M], b[j]))
            # the deck's non-skid inside a smooth gelcoat margin along each edge (its outermost strip, some 15 cm)
            f.material_index = mats['hull'] if j < nh - 1 else mats['gel'] if j in (nh - 1, M - 1) else mats['deck']
    for r in (rings[0], rings[-1]): bm.faces.new(r).material_index = mats['hull']  # transom, stem
    return rings[0]

# ---------- foils: the keel and the rudder ----------
def naca(u, th):  # half-thickness of a NACA 00xx at chord fraction u
    return 5 * th * (0.2969 * math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4)
def foil(bm, mat, y0, y1, c0, c1, le0, le1, th, NS=8, NC=14, x0=0.0, cant=0.0):
    # x0: the foil's root off the centreline; cant: its tip that many degrees further out (a twin rudder's toe-out)
    secs = []
    for i in range(NS + 1):
        f = i / NS; y = lerp(y0, y1, f); c = lerp(c0, c1, f); le = lerp(le0, le1, f)
        xo = x0 + math.copysign((y0 - y) * math.tan(math.radians(cant)), x0 or 1)
        us = [(1 - math.cos(math.pi * k / NC)) / 2 for k in range(NC + 1)]
        pts = [(xo + naca(u, th) * c, le + u * c) for u in us] + [(xo - naca(u, th) * c, le + u * c) for u in reversed(us[1:-1])]
        secs.append([bm.verts.new(G(x, y, z)) for x, z in pts])
    M = len(secs[0])
    for i in range(NS):
        for j in range(M):
            bm.faces.new((secs[i][j], secs[i][(j + 1) % M], secs[i + 1][(j + 1) % M], secs[i + 1][j])).material_index = mat
    bm.faces.new(list(reversed(secs[0]))).material_index = mat; bm.faces.new(secs[-1]).material_index = mat
def bulb(bm, mat, z0, z1, yc, R, NL=22, NR=16):
    rings, tip0, tip1 = [], bm.verts.new(G(0, yc, z0)), bm.verts.new(G(0, yc, z1))
    for i in range(1, NL):
        u = i / NL; r = R * 1.6 * u ** 0.55 * (1 - u) ** 0.75
        z = lerp(z0, z1, u)
        rings.append([bm.verts.new(G(r * 1.18 * math.cos(2 * math.pi * k / NR), yc + r * 0.85 * math.sin(2 * math.pi * k / NR), z)) for k in range(NR)])
    for i in range(len(rings) - 1):
        for k in range(NR):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % NR], rings[i + 1][(k + 1) % NR], rings[i + 1][k])).material_index = mat
    for k in range(NR):
        bm.faces.new((tip0, rings[0][(k + 1) % NR], rings[0][k])).material_index = mat
        bm.faces.new((tip1, rings[-1][k], rings[-1][(k + 1) % NR])).material_index = mat

# ---------- the coachroof: lofted sections, aft (z = 1.96) to where it runs out on the foredeck (z = -3.15) ----------
# Off the deck plan and the profile: 2.2 m wide at its aft face, tapering forward to 0.6 m, its top 1.71 above the
# water aft and level to the mast, then ramping down into the deck. yacht.js has the same (roofTop, roofHalf).
CR_ZA, CR_ZF = 1.96, -3.15
CR_W = [(0, 1.09), (1.96, 0.85), (3.91, 0.6), (4.61, 0.52), (5.11, 0.3)]   # half-width at its foot, by metres forward of its aft face
def cr_half(z): return spline(CR_W, CR_ZA - z)
def cr_top(z):
    if z > -0.34: return lerp(1.71, 1.65, (CR_ZA - z) / 2.3)
    return lerp(1.65, deck_y(z) + 0.04, smooth(-0.34, CR_ZF, z))
# the side windows: one long smoked window a side (the specification's two 10 mm Altuglass lights), most of the side's
# height, from abreast the companionway (z = 1.8) forward to z = −0.3, its lower edge sweeping up to a point there
WIN_ZA, WIN_ZF, WIN_SWEEP = 1.8, -0.3, 1.0
def window_band(z, yd, side_top):  # the window's lower and upper edge at z (the same rows run on along the plain side)
    hi = max(side_top - 0.08, lerp(yd, side_top, 0.6))
    lo = min(yd + 0.08, lerp(yd, side_top, 0.3))
    u = clamp((WIN_ZF + WIN_SWEEP - z) / WIN_SWEEP, 0, 1)  # 0 … 1 over its forward metre
    return lerp(lo, hi - 0.004, 1 - (1 - u) ** 1.6), hi
def build_coachroof(bm, mats):
    NZ = 64
    secs, meta = [], []
    for i in range(NZ + 1):
        f = i / NZ
        z = lerp(CR_ZA, CR_ZF, f)
        w0 = cr_half(z)
        yd = deck_y(z, w0)
        ht = max(cr_top(z), yd + 0.04)
        wt = w0 - 0.11 * clamp((ht - yd) / 0.45, 0.25, 1)    # tumblehome
        rr = min(0.07, 0.4 * (ht - yd))
        ys = [0.5, yd]
        side_top = ht - rr
        lo, hi = window_band(z, yd, side_top)
        for y in (lo, hi, side_top): ys.append(y)
        prof = [(w0, ys[0]), (w0, ys[1])]
        for y in ys[2:]: prof.append((lerp(w0, wt, (y - yd) / max(1e-3, side_top - yd)), y))
        prof += [(wt - rr * 0.29, ht - rr * 0.29), (wt - rr, ht)]
        for k in (0.6, 0.3):
            prof.append((wt * k, ht + 0.03 * (1 - k * k)))
        half = prof
        ring = [G(x, y, z) for x, y in half] + [G(0, ht + 0.03, z)] + [G(-x, y, z) for x, y in reversed(half)]
        secs.append([bm.verts.new(p) for p in ring]); meta.append(z)
    M = len(secs[0])
    for i in range(NZ):
        zc = (meta[i] + meta[i + 1]) / 2
        for j in range(M):
            mat = mats['gel']
            seg = j if j <= 8 else 17 - j              # the same segment on either side: 0 below the deck, 2 the window band
            if seg == 2 and WIN_ZF < zc < WIN_ZA: mat = mats['glass']   # the long window each side
            if seg >= 7 and zc > CR_ZF + 0.6: mat = mats['deck']     # its top non-skid, inside a margin of smooth gelcoat
            bm.faces.new((secs[i][j], secs[i][(j + 1) % M], secs[i + 1][(j + 1) % M], secs[i + 1][j])).material_index = mat
    bm.faces.new(list(reversed(secs[0]))).material_index = mats['gel']
    bm.faces.new(secs[-1]).material_index = mats['gel']

# the hatch garage moulded into the roof aft of the mast, the sliding hatch running on it (yacht.js's GARAGE): a
# rounded hump 0.81 m wide and 1.48 long, 12 cm high, its sides turning onto its top round a 6 cm radius
GARAGE_X, GARAGE_Z0, GARAGE_Z1, GARAGE_H = 0.405, 0.18, 1.66, 0.12
def roof_y(x, z):  # the coachroof's top at (x, z), inside its shoulders: build_coachroof's camber
    w0 = cr_half(z); yd = deck_y(z, w0); ht = max(cr_top(z), yd + 0.04)
    wt = w0 - 0.11 * clamp((ht - yd) / 0.45, 0.25, 1)
    k = abs(x) / wt
    P = [(0, ht + 0.03), (0.3, ht + 0.03 * (1 - 0.09)), (0.6, ht + 0.03 * (1 - 0.36))]
    if k >= 0.6: return P[2][1]
    i = 0 if k < 0.3 else 1
    return lerp(P[i][1], P[i + 1][1], (k - P[i][0]) / 0.3)
def build_garage(bm, mat):
    R, SEG = 0.25, 6
    prof = [(0, -0.04), (0, 0), (0.01, 0.06)] + [(0.07 + 0.06 * math.cos(a), 0.06 + 0.06 * math.sin(a))
                                                for a in (math.pi * (1 - 0.5 * i / 4) for i in range(1, 5))]   # (inset, height)
    rings = []
    for d, h in prof:
        out = rounded_rect(-GARAGE_X + d, GARAGE_X - d, GARAGE_Z0 + d, GARAGE_Z1 - d, R - d, seg=SEG)
        rings.append([bm.verts.new(G(x, roof_y(x, z) + h, z)) for x, z in out])
    M = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for j in range(M): bm.faces.new((a[j], a[(j + 1) % M], b[(j + 1) % M], b[j])).material_index = mat
    bm.faces.new(list(reversed(rings[0]))).material_index = mat; bm.faces.new(rings[-1]).material_index = mat

# ---------- boxes: the cockpit cutter, seats, coamings ----------
def plan_prism(bm, outline, y0, y1, mat_side, mat_bottom, mat_top):
    lo = [bm.verts.new(G(x, y0, z)) for x, z in outline]; hi = [bm.verts.new(G(x, y1, z)) for x, z in outline]
    n = len(outline)
    for k in range(n): bm.faces.new((lo[k], lo[(k + 1) % n], hi[(k + 1) % n], hi[k])).material_index = mat_side
    bm.faces.new(list(reversed(lo))).material_index = mat_bottom; bm.faces.new(hi).material_index = mat_top
def rounded_rect(x0, x1, z0, z1, r, corners=(1, 1, 1, 1), seg=5):
    pts = []
    cs = [((x1, z0), (-1, 1), 0), ((x1, z1), (-1, -1), 1), ((x0, z1), (1, -1), 2), ((x0, z0), (1, 1), 3)]
    for (cx, cz), (sx, sz), k in cs:
        if not corners[k]: pts.append((cx, cz)); continue
        ox, oz = cx + sx * r, cz + sz * r
        a0 = [math.pi * 1.5, 0, math.pi / 2, math.pi][k]
        for i in range(seg + 1):
            a = a0 + (math.pi / 2) * i / seg
            pts.append((ox + r * math.cos(a), oz + r * math.sin(a)))
    return pts

def new_object(name, mat_names):
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    for m in mat_names: me.materials.append(MAT[m])
    return ob

def material(name, color, rough=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1); p.inputs['Roughness'].default_value = rough
    return m

for o in list(bpy.data.objects): bpy.data.objects.remove(o)
MAT = {'hull': material('hull', (0.92, 0.92, 0.9), 0.2), 'deck': material('deck', (0.8, 0.79, 0.75), 0.85),
       'gel': material('gel', (0.9, 0.89, 0.86), 0.3), 'glass': material('glass', (0.03, 0.04, 0.05), 0.05)}
ORDER = ['hull', 'deck', 'gel', 'glass']
IDX = {m: i for i, m in enumerate(ORDER)}

# the hull and the coachroof, one solid
hull = new_object('yacht', ORDER)
bm = bmesh.new(); transom = build_hull(bm, IDX); build_coachroof(bm, IDX)
# the transom's edge turned round a 3 cm radius, as the deck edge is, rather than left a knife edge
edges = list({e for v in transom for e in v.link_edges if all(w in set(transom) for w in e.verts)})
bmesh.ops.bevel(bm, geom=edges, offset=0.03, offset_type='OFFSET', segments=3, profile=0.5, affect='EDGES', clamp_overlap=True)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(hull.data); bm.free()

# the cockpit, cut out of it (the deck plan): from the companionway in the coachroof's aft face, 1.3 m wide, out to
# 2 m wide abreast the primaries and 2.6 m at the closed transom; its floor 0.62 above the water
COCKPIT = [(0.66, CR_ZA - 0.005), (1.0, 2.9), (1.0, 3.95), (1.3, STERN_Z - 0.17)]
COCKPIT_FLOOR = 0.62
cut = new_object('cockpit', ORDER)
bm = bmesh.new()
plan_prism(bm, [(x, z) for x, z in COCKPIT] + [(-x, z) for x, z in reversed(COCKPIT)], COCKPIT_FLOOR, 3.0, IDX['gel'], IDX['deck'], IDX['gel'])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(cut.data); bm.free()
mod = hull.modifiers.new('cockpit', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut; mod.solver = 'EXACT'
mod.use_self = True   # the hull and the coachroof are two shells, one inside the other: merge them as it cuts
try: mod.material_mode = 'TRANSFER'
except Exception as e: print('material_mode:', e)
bpy.context.view_layer.objects.active = hull; bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cut)

# the cockpit's two drains, out through the transom just above the floor, lined dark: a cut of their own
cut = new_object('drains', ORDER)
bm = bmesh.new()
for sx in (-1, 1):
    ring = [(sx * 0.62 + 0.045 * math.cos(2 * math.pi * k / 12), COCKPIT_FLOOR + 0.06 + 0.045 * math.sin(2 * math.pi * k / 12)) for k in range(12)]
    a = [bm.verts.new(G(x, y, STERN_Z - 0.3)) for x, y in ring]; b = [bm.verts.new(G(x, y, STERN_Z + 0.3)) for x, y in ring]
    for k in range(12): bm.faces.new((a[k], a[(k + 1) % 12], b[(k + 1) % 12], b[k])).material_index = IDX['glass']
    bm.faces.new(list(reversed(a))).material_index = IDX['glass']; bm.faces.new(b).material_index = IDX['glass']
bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(cut.data); bm.free()
mod = hull.modifiers.new('drains', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut; mod.solver = 'EXACT'
try: mod.material_mode = 'TRANSFER'
except Exception as e: print('material_mode:', e)
bpy.context.view_layer.objects.active = hull; bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cut)

# the keel and the cockpit's foot braces, joined in
bm = bmesh.new(); bm.from_mesh(hull.data)
H = IDX['hull']
foil(bm, H, 0.15, -2.05, 1.2, 0.64, -0.98, -0.74, 0.12)                    # the fin: 1.2 m of chord at the hull, 0.64 at the bulb
# the fairings: at the root, flaring the fin into the hull, and where it meets the bulb; each ends on the fin's own
# section (its chord and leading edge there), only a touch thicker, so it blends in rather than steps
foil(bm, H, 0.15, -0.3, 1.34, 1.09, -1.05, -0.93, 0.13, NS=4)
foil(bm, H, -1.85, -2.08, 0.7, 0.86, -0.765, -0.82, 0.13, NS=3)
bulb(bm, H, -1.25, 0.71, -2.13, 0.22)                                          # the lead bulb, 2 m long: 2.24 m draft
for sx in (-1, 1):
    xs = sorted([sx * 0.43, sx * 0.66])   # the foot braces moulded into the floor, for the crew to brace against heeled
    plan_prism(bm, rounded_rect(xs[0], xs[1], 2.95, 4.14, 0.05), COCKPIT_FLOOR - 0.01, COCKPIT_FLOOR + 0.12, IDX['gel'], IDX['gel'], IDX['deck'])
build_garage(bm, IDX['gel'])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
# the knuckle's a crease the length of the topsides, not smoothed over: its edges marked sharp
def on_knuckle(v):
    x, z, y = v.co.x, -v.co.y, v.co.z
    t = t_at(z)
    return abs(x) > 0.05 and 0.002 < t < 0.997 and abs(y - knuckle_y(t)) < 2e-3 and abs(abs(x) - section(t, s_at(t, knuckle_y(t)))[0]) < 5e-3
kv = {v for v in bm.verts if on_knuckle(v)}
ks = [e for e in bm.edges if e.verts[0] in kv and e.verts[1] in kv]
for e in ks: e.smooth = False
print('knuckle edges', len(ks))
bm.to_mesh(hull.data); bm.free()

# smooth, with creases at the chine, deck edge, transom and the coachroof's corners
bpy.ops.object.select_all(action='DESELECT'); hull.select_set(True); bpy.context.view_layer.objects.active = hull
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(34))
me = hull.data
print('verts', len(me.vertices), 'tris', sum(len(p.vertices) - 2 for p in me.polygons), 'mats', [m.name for m in me.materials])

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                          export_texcoords=False, export_normals=True, export_materials='EXPORT', export_extras=False,
                          export_animations=False, export_skins=False, export_morph=False, export_cameras=False, export_lights=False)
print('wrote', OUT, os.path.getsize(OUT))
