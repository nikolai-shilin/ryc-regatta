# Regatta: the J Class yacht's moulded parts (game/boats3d.js JClassView), modelled here and exported to
# game/jclass.glb: the hull with her long keel moulded into it, the laid deck, the doghouse, the skylight and the helm's
# well.
#
# A generic America's Cup J of the 1930s (the Universal Rule's 76-foot rating), between Velsheda, Endeavour and Ranger
# as the J Class Association lists them today: 39.3 m over all on 27.0 m of waterline, 6.55 m wide, drawing 4.55 m,
# some 175 tonnes. The overhangs long and nearly equal, 6.1 m at the bow and 6.2 m aft: a spoon bow sweeping up to the
# stem head, and a counter ending in a small transom raked well forward. The freeboard low under a long sheer, 1.3 m at
# its lowest a little aft of amidships, 2.35 m at the stem head and 1.75 m at the transom. The widest station 55% of her
# length from the bow. Her sections a deep wine glass: slack round bilges over hollow garboards running down into a
# long keel, one surface, its lead at its foot. The keel's profile is the hull's own: from the forefoot it slopes down
# in a long curve to its deepest, 4.55 m down 52% of her length from the bow, then rises gently aft to the heel, where
# the rudder's post rakes up 37° to the counter (the stock comes through the deck 86% of her length from the bow).
#
# On deck, laid teak from stem to stern inside a low bulwark, 26 cm high, the topsides carried up in her paint, white
# inside, under a varnished cap rail 15 cm wide that runs round the transom too: the mast 43% of her length from the
# bow; aft of it the doghouse, its sides varnished teak with windows (boats3d.js draws them) under a white-painted top;
# forward of the mast a varnished skylight, its top pitched and glazed; aft, the helm's well sunk into the deck round
# the wheel, its floor teak. The rudder, the wheel, the spars, the sails, the winches and the crew stay in boats3d.js (they move, or are made per
# boat). The hull follows boats3d.js's lines for her (JZ: the same functions as below), so the name, the number and the
# logo it lays onto her topsides lie on them, and the deck structures are where its fittings and crew expect them.
#
# Materials by name, which boats3d.js swaps for its own: hull (the paint, boot-top and antifouling drawn by its shader,
# the lead with them, and the bulwark's outside), deck (laid teak, or the player's deck), wood (varnished teak: the
# cap rail, the doghouse's and the skylight's sides), gel (the white-painted tops and the bulwark's inside), teak (the
# well's floor), glass (the skylight's). No UVs: boats3d.js lays them out from the plan.
#
#   blender -b --factory-startup -P blender/jclass.py
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'public', 'game', 'jclass.glb'))

def clamp(v, a, b): return max(a, min(b, v))
def lerp(a, b, t): return a + (b - a) * t
def smooth(e0, e1, x): t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def spline(P):
    """a smooth curve through the points [(x, y)], x rising: Catmull-Rom tangents on a cubic Hermite (boats3d.js spline)"""
    n = len(P)
    m = [(P[min(n - 1, i + 1)][1] - P[max(0, i - 1)][1]) / (P[min(n - 1, i + 1)][0] - P[max(0, i - 1)][0]) for i in range(n)]
    def f(x):
        if x <= P[0][0]: return P[0][1]
        if x >= P[-1][0]: return P[-1][1]
        i = 0
        while P[i + 1][0] < x: i += 1
        h = P[i + 1][0] - P[i][0]; u = (x - P[i][0]) / h
        h00, h10, h01, h11 = 2 * u ** 3 - 3 * u * u + 1, u ** 3 - 2 * u * u + u, -2 * u ** 3 + 3 * u * u, u ** 3 - u * u
        return h00 * P[i][1] + h10 * h * m[i] + h01 * P[i + 1][1] + h11 * h * m[i + 1]
    return f

# ---------- boats3d.js's lines for her (game frame: +x starboard, +y up, -z forward, the waterline at y = 0) ----------
# t = 0 at the transom ... 1 at the stem, both at the deck
L, B = 39.3, 6.55
STERN = L / 2
def z_at(t): return STERN - t * L
def t_at(z): return clamp((STERN - z) / L, 0, 1)
TMAX = 0.45  # the widest station, 55% of her length from the bow
def hb(t):  # the deck's half-breadth: 0.85 m across the transom, 3.275 m at its widest, fining to the stem
    if t < TMAX: return (B / 2) * (0.26 + 0.74 * math.sin((t / TMAX) * math.pi / 2) ** 0.85)
    return (B / 2) * max(0.0, math.cos(min(1, (t - TMAX) / (1 - TMAX)) * math.pi / 2)) ** 0.7
LOW = 0.38  # the sheer's lowest point, 1.3 m, 15 m forward of the transom
def sheer(t):
    if t < LOW: return 1.3 + 0.45 * ((LOW - t) / LOW) ** 2
    return 1.3 + 1.05 * ((t - LOW) / (1 - LOW)) ** 2
# the canoe body's centreline (its height above the water: negative under it), the waterline from 6.2 m forward of the
# transom to 6.1 m aft of the stem head, deepest (1.8 m) amidships; the counter a long straight rise to the transom's
# foot, the bow a convex spoon up to the stem head
WL_A, WL_F = 0.158, 0.845
YC = spline([(0, 0.95), (0.06, 0.6), (0.11, 0.29), (WL_A, 0.0), (0.22, -0.5), (0.3, -1.08), (0.4, -1.62), (0.5, -1.82), (0.6, -1.7),
             (0.7, -1.25), (0.78, -0.66), (WL_F, 0.0), (0.9, 0.55), (0.95, 1.2), (1.0, 2.35)])
def depth(t): return -YC(t)
def n_of(t): return lerp(2.4, 2.0, clamp((t - 0.3) / 0.7, 0, 1))  # the sections' squareness: slack round bilges
FLARE = 0.03
CROWN = 0.022  # the deck's camber: 0.14 m at her widest
def deck_y(z, x=0.0):
    h = max(hb(t_at(z)), 0.05)
    return sheer(t_at(z)) + CROWN * 2 * h * (1 - min(1, abs(x) / h) ** 2)

# the keel: its forward edge's z at each height y, from its deepest point (4.55 m down, 52% of her length from the bow)
# forward and up in a long curve into the forefoot; its foot from there aft, rising gently to the heel; its trailing
# edge, the rudder's post, raked 37° from the heel up to the counter
KEEL_D, KEEL_DZ = -4.55, 0.8      # the deepest point
HEEL_Y, TE0 = -3.85, 10.0          # the heel, where the rudder's post meets the foot
TE_RAKE = 0.76                     # how far aft the post runs for each metre up
LE = spline([(-4.55, 0.8), (-4.5, -1.6), (-4.3, -3.8), (-3.9, -5.9), (-3.3, -8.0), (-2.5, -10.0), (-1.6, -11.8), (-0.8, -13.0),
             (-0.1, -13.8), (0.4, -14.25)])
LE_TOP = 0.4
def TE(y): return TE0 + (y - HEEL_Y) * TE_RAKE
def foot_y(z): return KEEL_D + (HEEL_Y - KEEL_D) * clamp((z - KEEL_DZ) / (TE0 - KEEL_DZ), 0, 1) ** 1.6
def keel_half(z, y):
    """the keel's half-thickness at (z, y): a NACA section between its edges, 0.72 m thick in the lead, 0.6 m above"""
    le, te = LE(y), TE(y)
    if te <= le: return 0.0
    c = (z - le) / (te - le)
    if c <= 0 or c >= 1: return 0.0
    f = 5 * (0.2969 * math.sqrt(c) - 0.126 * c - 0.3516 * c * c + 0.2843 * c ** 3 - 0.1036 * c ** 4) / 0.5
    th = lerp(0.36, 0.3, smooth(-3.6, -2.2, y))
    w = max(th * f, 0.06 * smooth(0.6, 0.85, c))  # the trailing edge left 12 cm thick, hollowed for the rudder's post
    return w * math.sqrt(clamp((y - foot_y(z)) / 0.3, 0, 1))  # the foot rounded
def keel_bottom(z):
    """the keel's lowest point at z (None where there's none)"""
    if z < KEEL_DZ:
        if z < LE(LE_TOP): return None
        a, b = KEEL_D, LE_TOP
        for _ in range(40):
            m = (a + b) / 2
            if LE(m) > z: a = m
            else: b = m
        return (a + b) / 2
    if z <= TE0: return foot_y(z)
    return HEEL_Y + (z - TE0) / TE_RAKE

# ---------- the hull's sections ----------
def round_pt(t, s):  # hullOf's round section: s = 0 at the deck edge ... 1 at the centreline under her
    h, sy, d, n = hb(t), sheer(t), depth(t), n_of(t)
    phi = s * math.pi / 2; c, sn = math.cos(phi), math.sin(phi); yr = sn ** (2 / n)
    return h * c ** (2 / n) * (1 - FLARE * sn), sy - (sy + d) * yr
SG = 0.5  # where the round bilge gives way to the hollow garboard
KH, KB, KS, KD = 16, 12, 14, 9  # samples: down the topsides and bilge, round the garboard, down the keel, across the deck
def section(t):
    """one side's outline, from the deck edge down to the centreline under the keel: [(x, y)]"""
    z = z_at(t); sy = sheer(t); yc = YC(t)
    r = 0.04  # the deck edge, turned on a 4 cm radius
    s_r = math.asin(clamp(r / max(sy - yc, 0.05), 0, 1) ** (n_of(t) / 2)) * 2 / math.pi
    x_r, y_r = round_pt(t, s_r)
    yd = deck_y(z, x_r - r)
    pts = [(x_r - r + r * math.cos(a), lerp(y_r, yd, math.sin(a))) for a in (math.pi / 2 * k / 4 for k in range(4, 0, -1))]
    for j in range(KH + 1): pts.append(round_pt(t, lerp(s_r, SG, j / KH)))
    yk = keel_bottom(z)
    if yk is not None and yk >= yc: yk = None
    e = 0.0 if yk is None else yc - yk
    wk = smooth(0.0, 0.8, e)
    G = round_pt(t, SG); G2 = round_pt(t, SG + 0.01)
    tg = Vector((G2[0] - G[0], G2[1] - G[1])); tg.normalize()
    yj = yc - min(1.5, 0.45 * e)
    K = (max(keel_half(z, yj), 0.02), yj)
    span = math.hypot(G[0] - K[0], G[1] - K[1])
    P = [Vector(G), Vector(G) + tg * span * 0.42, Vector((K[0], K[1] + span * 0.45)), Vector(K)]
    for j in range(1, KB + 1):
        u = j / KB
        a, b2, c2, d2 = (1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3
        bx = a * P[0].x + b2 * P[1].x + c2 * P[2].x + d2 * P[3].x
        by = a * P[0].y + b2 * P[1].y + c2 * P[2].y + d2 * P[3].y
        rx, ry = round_pt(t, lerp(SG, 1.0, u))
        pts.append((lerp(rx, bx, wk), lerp(ry, by, wk)))
    for j in range(1, KS + 1):
        u = j / KS
        y = lerp(yj, yk if yk is not None else yc, 1 - (1 - u) ** 1.4)
        pts.append((keel_half(z, y) if yk is not None and j < KS else 0.0, y))
    return pts

# the transom raked: the counter's sections lean forward towards their foot, so the transom's foot stands 0.9 m forward
# of its top on the centreline
RAKE, RAKE_T = 0.9, 0.12
def rake_z(t, y):
    if t >= RAKE_T: return 0.0
    return -RAKE * clamp((sheer(t) - y) / (sheer(0) - YC(0)), 0, 1.5) * (1 - t / RAKE_T) ** 2

def G3(x, y, z): return Vector((x, -z, y))  # game -> Blender (Z up, +Y forward); the glTF export turns it back

def build_hull(bm, M):
    N = 170
    ts = [min(0.997, (i / N) ** 0.92) for i in range(N + 1)]
    rings = []
    for t in ts:
        z = z_at(t)
        side = section(t)
        ring = [(x, y) for x, y in side] + [(-x, y) for x, y in reversed(side[:-1])]
        xd = side[0][0]
        deck = [(xd * k / KD, deck_y(z, xd * k / KD)) for k in range(-(KD - 1), KD)]
        nh = len(ring)
        verts = [bm.verts.new(G3(x, y, z + rake_z(t, y))) for x, y in ring + deck]
        rings.append((verts, nh))
    R = len(rings[0][0]); nh = rings[0][1]
    for i in range(N):
        a, b = rings[i][0], rings[i + 1][0]
        for j in range(R):
            f = bm.faces.new((a[j], a[(j + 1) % R], b[(j + 1) % R], b[j]))
            f.material_index = M['hull'] if j < nh - 1 else M['deck']
    bm.faces.new(rings[0][0]).material_index = M['hull']            # the transom
    bm.faces.new(list(reversed(rings[-1][0]))).material_index = M['hull']

# ---------- the doghouse, the skylight and the helm's well ----------
MAST_Z = -2.75                    # 43% of her length from the bow
DH_F, DH_A = -1.6, 4.6            # the doghouse: from just aft of the mast to abaft the mainmast's partners
DH_W, DH_H, DH_ARCH = 1.35, 0.62, 0.1  # its half-width, its sides' height over the deck, its top's arch
SK_F, SK_A, SK_W, SK_H = -7.6, -5.6, 0.62, 0.42  # the skylight forward of the mast
WELL_F, WELL_A, WELL_W, WELL_D = 9.4, 13.4, 1.25, 0.75  # the helm's well round the wheel, its floor 0.75 m down
WOOD_T = 0.06
def dh_half(z):
    """the doghouse's half-width at z: its front rounded in plan, its aft end square"""
    if z < DH_F or z > DH_A: return 0.0
    n = clamp((z - DH_F) / 0.9, 0, 1)
    return lerp(1.05, DH_W, smooth(DH_F, DH_F + 2.5, z)) * math.sqrt(max(0.0, 1 - (1 - n) ** 2) ** 0.5)

def build_house(bm, M, zf, za, half, hgt, arch, rounded=True):
    """a deckhouse: varnished sides from under the deck up, a painted top arched across, 6 cm thick, its edge lipped"""
    NZ = 40
    zs = [lerp(zf, za, 0.5 - 0.5 * math.cos(math.pi * i / NZ)) if rounded else lerp(zf, za, i / NZ) for i in range(NZ + 1)]
    out = [(half(z), z) for z in zs] + [(-half(z), z) for z in reversed(zs)]
    lo = [bm.verts.new(G3(x, deck_y(z, x) - 0.12, z)) for x, z in out]
    hi = [bm.verts.new(G3(x, deck_y(z, abs(x)) + hgt, z)) for x, z in out]
    n = len(out)
    for k in range(n):
        if abs(out[k][1] - out[(k + 1) % n][1]) < 1e-9 and abs(out[k][0] - out[(k + 1) % n][0]) < 1e-9: continue
        bm.faces.new((lo[k], lo[(k + 1) % n], hi[(k + 1) % n], hi[k])).material_index = M['wood']
    # the top: its arch across, over its sides by 3 cm
    NX = 12; secs = []
    for z in zs:
        w = half(z) + 0.03; yb = deck_y(z, w) + hgt
        prof = [(lerp(w, -w, i / NX), yb + arch * (1 - (lerp(w, -w, i / NX) / max(w, 0.05)) ** 2)) for i in range(NX + 1)]
        ring = [(x, y + 0.06) for x, y in prof] + list(reversed(prof))
        secs.append([bm.verts.new(G3(x, y, z)) for x, y in ring])
    R = len(secs[0])
    for i in range(len(secs) - 1):
        for j in range(R):
            bm.faces.new((secs[i][j], secs[i][(j + 1) % R], secs[i + 1][(j + 1) % R], secs[i + 1][j])).material_index = M['gel']
    bm.faces.new(secs[-1]).material_index = M['gel']
    bm.faces.new(list(reversed(secs[0]))).material_index = M['gel']

BUL_H = 0.26  # the bulwark's height over the deck edge, under its cap rail
def build_bulwark(bm, M):
    """the bulwark all round her deck, across the transom too: its outside the topsides carried up in the hull's paint,
    its inside white, a varnished cap rail 15 cm wide over it, rounded on top and lipped over the outside"""
    NS = 150
    side = [min(0.999, (i / NS) ** 0.95) for i in range(NS + 1)]
    pts = [(hb(t), z_at(t) - 0.02, t) for t in side] + [(-hb(t), z_at(t) - 0.02, t) for t in reversed(side)]
    xT = hb(0)
    pts += [(lerp(-xT, xT, k / 6), z_at(0) - 0.02, 0.0) for k in range(1, 6)]  # across the transom, flush with it
    n = len(pts)
    def normal(k):
        x0, z0, _ = pts[(k - 1) % n]; x1, z1, _ = pts[(k + 1) % n]
        tx, tz = x1 - x0, z1 - z0; l = math.hypot(tx, tz) or 1
        nx, nz = tz / l, -tx / l
        x, z, _ = pts[k]
        if nx * x * 4 + nz * z < 0: nx, nz = -nx, -nz
        return nx, nz
    # the profile, out along the normal (o) and up (y over the sheer): the outside, the cap rail, the inside
    H = BUL_H
    PROF = [(0.004, -0.2, 'hull'), (0.004, H, 'wood'), (0.025, H, 'wood'), (0.025, H + 0.035, 'wood'), (-0.05, H + 0.058, 'wood'),
            (-0.125, H + 0.035, 'wood'), (-0.125, H, 'gel'), (-0.07, H, 'gel'), (-0.07, None, 'gel')]
    rings = []
    for k in range(n):
        x, z, t = pts[k]; nx, nz = normal(k); sy = sheer(t)
        ring = []
        for o, y, _ in PROF:
            px, pz = x + nx * o, z + nz * o
            py = deck_y(pz, abs(px)) - 0.03 if y is None else sy + y
            # over the counter it leans with the transom's rake (rake_z, carried on up above the deck)
            if t < RAKE_T: pz += RAKE * clamp((py - sy) / (sheer(0) - YC(0)), -1.5, 1.5) * (1 - t / RAKE_T) ** 2
            ring.append(bm.verts.new(G3(px, py, pz)))
        rings.append(ring)
    for k in range(n):
        a, b = rings[k], rings[(k + 1) % n]
        for j in range(len(PROF) - 1):
            bm.faces.new((a[j], b[j], b[j + 1], a[j + 1])).material_index = M[PROF[j][2]]

def build_skylight(bm, M, zf, za, w, h, ridge):
    """the skylight forward of the mast: varnished sides and ends, its top pitched to a ridge, glazed on both slopes
    (the bronze bars over the glass are boats3d.js's)"""
    def v(x, y, z): return bm.verts.new(G3(x, y, z))
    base = lambda z, x: deck_y(z, abs(x)) - 0.1
    top = deck_y((zf + za) / 2, w) + h
    for z0, z1 in [(zf, za)]:
        c = {}
        for zz in (z0, z1):
            c[zz] = [v(w, base(zz, w), zz), v(w, top, zz), v(0, top + ridge, zz), v(-w, top, zz), v(-w, base(zz, w), zz)]
        A, B = c[z0], c[z1]
        bm.faces.new((A[0], B[0], B[1], A[1])).material_index = M['wood']   # the sides
        bm.faces.new((A[3], B[3], B[4], A[4])).material_index = M['wood']
        bm.faces.new((A[1], B[1], B[2], A[2])).material_index = M['glass']  # the two slopes
        bm.faces.new((A[2], B[2], B[3], A[3])).material_index = M['glass']
        bm.faces.new(list(reversed(A))).material_index = M['wood']           # the ends, gabled
        bm.faces.new(B).material_index = M['wood']
        bm.faces.new((A[4], B[4], B[0], A[0])).material_index = M['wood']
    # the frame: a varnished ridge and a coaming round the glass
    for x0, y0 in [(0, top + ridge), (w, top), (-w, top)]:
        lo = [v(x0 - 0.04, y0 - 0.02, zf - 0.03), v(x0 + 0.04, y0 - 0.02, zf - 0.03), v(x0 + 0.04, y0 + 0.045, zf - 0.03), v(x0 - 0.04, y0 + 0.045, zf - 0.03)]
        hi = [v(x0 - 0.04, y0 - 0.02, za + 0.03), v(x0 + 0.04, y0 - 0.02, za + 0.03), v(x0 + 0.04, y0 + 0.045, za + 0.03), v(x0 - 0.04, y0 + 0.045, za + 0.03)]
        for k in range(4): bm.faces.new((lo[k], lo[(k + 1) % 4], hi[(k + 1) % 4], hi[k])).material_index = M['wood']
        bm.faces.new(list(reversed(lo))).material_index = M['wood']; bm.faces.new(hi).material_index = M['wood']

def plan_prism(bm, pts, y0, y1, ms, mb, mt):
    lo = [bm.verts.new(G3(x, y0, z)) for x, z in pts]; hi = [bm.verts.new(G3(x, y1, z)) for x, z in pts]
    n = len(pts)
    for k in range(n): bm.faces.new((lo[k], lo[(k + 1) % n], hi[(k + 1) % n], hi[k])).material_index = ms
    bm.faces.new(list(reversed(lo))).material_index = mb; bm.faces.new(hi).material_index = mt

def rounded_rect(x0, z0, x1, z1, r, seg=6):
    pts = []
    for cx, cz, a in [(x1 - r, z0 + r, -math.pi / 2), (x1 - r, z1 - r, 0), (x0 + r, z1 - r, math.pi / 2), (x0 + r, z0 + r, math.pi)]:
        for i in range(seg + 1):
            th = a + math.pi / 2 * i / seg; pts.append((cx + r * math.cos(th), cz + r * math.sin(th)))
    return pts

def material(name, color, rough=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1); p.inputs['Roughness'].default_value = rough
    return m

def volume_below(me, y0=0.0):
    """the hull's volume under the plane y = y0 (game frame; Blender's z), by the divergence theorem over its faces
    clipped at the plane: the water it displaces"""
    v = 0.0
    for p in me.polygons:
        pts = [me.vertices[i].co for i in p.vertices]
        for k in range(1, len(pts) - 1):
            tri = [pts[0], pts[k], pts[k + 1]]
            # clip the triangle to z <= y0
            poly = []
            for i in range(3):
                a, b = tri[i], tri[(i + 1) % 3]
                ina, inb = a.z <= y0, b.z <= y0
                if ina: poly.append(a)
                if ina != inb:
                    u = (y0 - a.z) / (b.z - a.z); poly.append(a + (b - a) * u)
            for i in range(1, len(poly) - 1):
                a, b, c = poly[0], poly[i], poly[i + 1]
                v += a.dot(b.cross(c)) / 6
    # the cut at the waterplane closes the solid: its own term is zero for a plane through z = 0
    return abs(v)

if __name__ == '__main__':
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)
    ORDER = ['hull', 'deck', 'wood', 'gel', 'teak', 'glass']
    MAT = {'hull': material('hull', (0.03, 0.07, 0.16), 0.2), 'deck': material('deck', (0.55, 0.4, 0.25), 0.8),
           'wood': material('wood', (0.4, 0.2, 0.08), 0.25), 'gel': material('gel', (0.92, 0.91, 0.88), 0.4),
           'teak': material('teak', (0.55, 0.38, 0.22), 0.7), 'glass': material('glass', (0.1, 0.13, 0.16), 0.05)}
    IDX = {m: i for i, m in enumerate(ORDER)}
    def new_object(nm):
        me = bpy.data.meshes.new(nm); ob = bpy.data.objects.new(nm, me); bpy.context.scene.collection.objects.link(ob)
        for m in ORDER: me.materials.append(MAT[m])
        return ob
    def finish(ob, bm):
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(ob.data); bm.free()
    def apply_bool(target, other, op):
        mod = target.modifiers.new(op, 'BOOLEAN'); mod.operation = op; mod.object = other; mod.solver = 'EXACT'; mod.use_self = True
        try: mod.material_mode = 'TRANSFER'
        except Exception as e: print('material_mode:', e)
        bpy.context.view_layer.objects.active = target; bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(other)

    hull = new_object('jclass')
    bm = bmesh.new(); build_hull(bm, IDX); finish(hull, bm)
    vol = volume_below(hull.data)
    print('displaced volume %.1f m3 = %.1f t of sea water' % (vol, vol * 1.025))
    # the helm's well, cut into the deck round the wheel
    cut = new_object('well'); bm = bmesh.new()
    plan_prism(bm, rounded_rect(-WELL_W, WELL_F, WELL_W, WELL_A, 0.45), deck_y(WELL_F) - WELL_D, 4.0, IDX['gel'], IDX['teak'], IDX['gel']); finish(cut, bm)
    apply_bool(hull, cut, 'DIFFERENCE')
    # the doghouse and the skylight, merged with the deck
    parts = new_object('parts'); bm = bmesh.new()
    build_house(bm, IDX, DH_F, DH_A, dh_half, DH_H, DH_ARCH)
    build_skylight(bm, IDX, SK_F, SK_A, SK_W, SK_H, 0.24)
    finish(parts, bm)
    apply_bool(hull, parts, 'UNION')
    bm = bmesh.new(); bm.from_mesh(hull.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(hull.data); bm.free()
    bpy.ops.object.select_all(action='DESELECT'); hull.select_set(True); bpy.context.view_layer.objects.active = hull
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(34))
    # the bulwark and its cap rail, joined on after the smoothing (it stands on the deck's edge, no boolean needed)
    bw = new_object('bulwark'); bm = bmesh.new(); build_bulwark(bm, IDX); finish(bw, bm)
    bpy.ops.object.select_all(action='DESELECT'); bw.select_set(True); bpy.context.view_layer.objects.active = bw
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    hull.select_set(True); bpy.context.view_layer.objects.active = hull; bpy.ops.object.join()
    me = hull.data
    print('jclass verts', len(me.vertices), 'tris', sum(len(p.vertices) - 2 for p in me.polygons), 'mats', [m.name for m in me.materials])
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_texcoords=False, export_normals=True, export_materials='EXPORT', export_extras=False,
                              export_animations=False, export_skins=False, export_morph=False, export_cameras=False, export_lights=False)
    print('wrote', OUT, os.path.getsize(OUT))
