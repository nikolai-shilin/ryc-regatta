# Regatta: the Dragon's moulded parts (game/boats3d.js DragonView), modelled here and exported to game/dragon.glb: the
# hull with her keel moulded into it, the deck, the cabin and the cockpit.
#
# Johan Anker's 1929 keelboat, to the International Dragon class rules (World Sailing 2020): 8.90 m over all on 5.66 m
# of waterline, 1.96 m wide, drawing 1.20 m. Long overhangs, a spoon bow and a counter ending in a small transom raked
# forward 320 mm from the deck to its foot; a low freeboard with a sweeping sheer, highest at the bow. Her sections are
# a wine glass: round bilges over a hollow garboard that runs down into the deadwood and the iron keel, one surface, the
# keel's own section a foil some 15 cm thick that fines to its trailing edge, where the rudder hangs. The keel's flat
# foot is 1.20 m down, its leading edge a long sweep up into the forefoot, its trailing edge raked aft up to the counter
# along the rudder's stock. The deck cambered 9.5 mm in every 305 mm of her width, its edge turned on a 9 mm radius.
#
# The cabin and the cockpit coaming are one band of varnished mahogany, a fair curve all round as the rules have it:
# the cabin's sides 20 cm high, narrowing forward to its rounded front, then aft along the cockpit 13 cm high and round
# its aft end; the cabin top arched 10 cm over them, ending at station 8 over the cabin's aft face (boats3d.js draws
# the companionway in it); the cockpit inside the coaming from station 8 to 0.2 m short of station 12, its floorboards
# 0.47 m under the deck.
#
# The rudder and tiller, the spars, the sails, the fittings and the crew stay in boats3d.js (they move, or are made per
# boat). The hull follows boats3d.js's lines for her (DZ: the same functions as below), so the name, the number and the
# logo it lays onto her topsides still lie on them, and the deck, the cabin and the cockpit are where its fittings and
# crew expect them.
#
# Materials by name, which boats3d.js swaps for its own: hull (the paint, boot-top and antifouling drawn by its shader,
# the keel's iron with them), deck (non-skid or the player's deck), wood (the varnished cabin sides and coamings), gel
# (the cabin top, its aft face, the cockpit's sides), teak (the floorboards). No UVs: boats3d.js lays them out from the
# plan.
#
#   blender -b --factory-startup -P blender/dragon.py
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'public', 'game', 'dragon.glb'))

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
# t = 0 at the transom ... 1 at the stem, both at the deck. The class's stations are 600 mm apart from the stem: station
# k at z = BOW + 0.6 k (station 8, where the cabin ends, at z = 0.35)
L, B = 8.9, 1.96
STERN = L / 2
def z_at(t): return STERN - t * L
def t_at(z): return clamp((STERN - z) / L, 0, 1)
def hb(t):  # the deck's half-breadth: 0.53 m across the transom, 1.96 m at stations 8–9, 1.834 m at station 6
    if t < 0.44: return (B / 2) * (0.27 + 0.73 * math.sin((t / 0.44) * math.pi / 2) ** 0.9)
    return (B / 2) * max(0.0, math.cos(min(1, (t - 0.44) / 0.56) * math.pi / 2)) ** 0.75
def sheer(t):  # the deck's height: lowest 0.58 m some 2.7 m from the transom, 0.72 m there and 0.92 m at the stem
    if t < 0.3: return 0.58 + 0.14 * ((0.3 - t) / 0.3) ** 2
    return 0.58 + 0.34 * ((t - 0.3) / 0.7) ** 1.8
# the canoe body's centreline under her (its depth below the water, negative where the overhangs stand clear of it): the
# waterline from 1.85 m forward of the transom to 1.39 m aft of the stem, 5.66 m long
YC = spline([(0, 0.38), (0.1, 0.18), (0.208, 0.0), (0.3, -0.155), (0.4, -0.26), (0.5, -0.3), (0.6, -0.275), (0.7, -0.19),
             (0.78, -0.095), (0.844, 0.0), (0.9, 0.14), (0.95, 0.37), (1.0, 0.87)])
def depth(t): return -YC(t)
def n_of(t): return lerp(2.3, 1.9, clamp((t - 0.3) / 0.7, 0, 1))  # the sections' squareness: slack round bilges
FLARE = 0.04
CROWN = 0.0311  # the deck's camber: 9.5 mm in 305 mm of her width (57 mm at station 6)
def deck_y(z, x=0.0):
    h = max(hb(t_at(z)), 0.05)
    return sheer(t_at(z)) + CROWN * 2 * h * (1 - min(1, abs(x) / h) ** 2)

# the keel (the iron keel and the deadwood over it, one foil): its leading edge's z at each height y, sweeping up from
# its foot into the forefoot; its trailing edge raked along the rudder's stock, from the foot's aft corner up to the
# counter; its foot flat 1.20 m down. The iron keel's top runs 2.84 m, its aft end 1.317 m aft of station 8
KEEL_Y = -1.2
LE = spline([(-1.2, -0.22), (-1.1, -0.5), (-0.95, -0.82), (-0.75, -1.2), (-0.5, -1.7), (-0.25, -2.25), (0.0, -2.85), (0.25, -3.45)])
TE0, TE_RAKE = 1.42, 1.08 / 1.25  # the trailing edge's z at the foot, and how far aft it runs for each metre up
def TE(y): return TE0 + (y - KEEL_Y) * TE_RAKE
def keel_half(z, y):
    """the keel's half-thickness at (z, y): a NACA section between its edges, 15 cm thick in the iron, 12 in the deadwood"""
    le, te = LE(y), TE(y)
    if te <= le: return 0.0
    c = (z - le) / (te - le)
    if c <= 0 or c >= 1: return 0.0
    f = 5 * (0.2969 * math.sqrt(c) - 0.126 * c - 0.3516 * c * c + 0.2843 * c ** 3 - 0.1036 * c ** 4) / 0.5
    th = lerp(0.075, 0.06, smooth(-0.8, -0.35, y))
    w = max(th * f, 0.014 * smooth(0.6, 0.85, c))  # the trailing edge left 28 mm thick, hollowed for the rudder's stock
    return w * math.sqrt(clamp((y - KEEL_Y) / 0.07, 0, 1))  # the foot rounded
def keel_bottom(z):
    """the keel's lowest point at z (None where there's none)"""
    if z < LE(KEEL_Y):
        if z < LE(0.25): return None
        a, b = KEEL_Y, 0.25
        for _ in range(40):
            m = (a + b) / 2
            if LE(m) > z: a = m
            else: b = m
        return (a + b) / 2
    if z <= TE0: return KEEL_Y
    return KEEL_Y + (z - TE0) / TE_RAKE

# ---------- the hull's sections ----------
def round_pt(t, s):  # hullOf's round section: s = 0 at the deck edge ... 1 at the centreline under her
    h, sy, d, n = hb(t), sheer(t), depth(t), n_of(t)
    phi = s * math.pi / 2; c, sn = math.cos(phi), math.sin(phi); yr = sn ** (2 / n)
    return h * c ** (2 / n) * (1 - FLARE * sn), sy - (sy + d) * yr
SG = 0.5  # where the round bilge gives way to the hollow garboard
KH, KB, KS, KD = 14, 10, 12, 7  # samples: down the topsides and bilge, round the garboard, down the keel, across the deck
def section(t):
    """one side's outline, from the deck edge down to the centreline under the keel: [(x, y)]"""
    z = z_at(t); sy = sheer(t); yc = YC(t)
    # the deck edge, turned on a 9 mm radius
    r = 0.009
    s_r = math.asin(clamp(r / max(sy - yc, 0.02), 0, 1) ** (n_of(t) / 2)) * 2 / math.pi
    x_r, y_r = round_pt(t, s_r)
    yd = deck_y(z, x_r - r)
    pts = [(x_r - r + r * math.cos(a), lerp(y_r, yd, math.sin(a))) for a in (math.pi / 2 * k / 4 for k in range(4, 0, -1))]
    for j in range(KH + 1): pts.append(round_pt(t, lerp(s_r, SG, j / KH)))
    # below: the round section on to the centreline, or (over the keel) a hollow garboard curving down into its side
    yk = keel_bottom(z)
    e = 0.0 if yk is None else max(0.0, yc - yk)
    wk = smooth(0.0, 0.3, e)
    G = round_pt(t, SG); G2 = round_pt(t, SG + 0.01)
    tg = Vector((G2[0] - G[0], G2[1] - G[1])); tg.normalize()
    yj = yc - min(0.32, 0.45 * e)
    K = (max(keel_half(z, yj), 0.004), yj)
    span = math.hypot(G[0] - K[0], G[1] - K[1])
    P = [Vector(G), Vector(G) + tg * span * 0.42, Vector((K[0], K[1] + span * 0.45)), Vector(K)]
    for j in range(1, KB + 1):
        u = j / KB
        a, b2, c2, d2 = (1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3
        bx = a * P[0].x + b2 * P[1].x + c2 * P[2].x + d2 * P[3].x
        by = a * P[0].y + b2 * P[1].y + c2 * P[2].y + d2 * P[3].y
        rx, ry = round_pt(t, lerp(SG, 1.0, (j / (KB + KS)) ** 1.0))
        pts.append((lerp(rx, bx, wk), lerp(ry, by, wk)))
    for j in range(1, KS + 1):
        u = j / KS
        y = lerp(yj, yk if yk is not None else yc, 1 - (1 - u) ** 1.4)
        x = keel_half(z, y) if j < KS else 0.0
        rx, ry = round_pt(t, lerp(SG, 1.0, (KB + j) / (KB + KS)))
        pts.append((lerp(rx, x, wk), lerp(ry, y, wk)))
    return pts

# the transom raked: the counter's sections lean forward towards their foot, so the transom's foot stands 320 mm
# forward of its top on the centreline (and the counter's bottom sweeps up into it)
RAKE, RAKE_T = 0.32, 0.2
def rake_z(t, y):
    if t >= RAKE_T: return 0.0
    return -RAKE * clamp((sheer(t) - y) / (sheer(0) - YC(0)), 0, 1.5) * (1 - t / RAKE_T) ** 2

def G3(x, y, z): return Vector((x, -z, y))  # game -> Blender (Z up, +Y forward); the glTF export turns it back

def build_hull(bm, M):
    N = 120
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

# ---------- the cabin and the cockpit ----------
CAB_F, CAB_A = -1.05, 0.45      # the cabin's front and its aft end (station 8 and the 100 mm its top may run past it)
CK_A = 2.55                      # the cockpit's aft end, 0.2 m forward of station 12
FLOOR = 0.14                     # the floorboards
SIDE_H, COAM_H = 0.2, 0.13      # the cabin's sides and the coaming over the deck
ARCH = 0.1                       # the cabin top's arch over its sides
WOOD_T = 0.024                   # the mahogany's thickness
def band_half(z):
    """the band's outside half-width at z: the cabin's rounded front widening aft, then the cockpit's sides and its
    rounded aft end (0 forward of the front and aft of the end)"""
    if z < CAB_F or z > CK_A: return 0.0
    w = lerp(0.36, 0.64, smooth(CAB_F, 0.35, z) ** 0.8)
    nose = clamp((z - CAB_F) / 0.3, 0, 1); w *= math.sqrt(max(0.0, 1 - (1 - nose) ** 2))
    tail = clamp((CK_A - z) / 0.32, 0, 1); w *= math.sqrt(max(0.0, 1 - (1 - tail) ** 2))
    return w
def band_h(z): return lerp(SIDE_H, COAM_H, smooth(CAB_A - 0.05, CAB_A + 0.45, z))  # its height over the deck
NBZ = 64
def band_zs():
    out = []
    for i in range(NBZ + 1):  # crowded at the ends, where it turns
        u = i / NBZ; out.append(lerp(CAB_F, CK_A, 0.5 - 0.5 * math.cos(math.pi * u)))
    return out
def outline(inset=0.0):
    """the band's outline, closed, as [(x, z)], starboard aft then port forward"""
    zs = band_zs(); pts = []
    for z in zs: pts.append((max(0.0, band_half(z) - inset), z))
    for z in reversed(zs[1:-1]): pts.append((-max(0.0, band_half(z) - inset), z))
    return pts

def build_band(bm, M):
    """the cabin's sides and the coaming: a wall round the outline, its top rounded off, from under the deck up"""
    o = outline(0.0); n = len(o)
    zs = band_zs()
    def inner(k):  # the inside face, the thickness in from the outside along the outline's normal
        x, z = o[k]; xp, zp = o[(k - 1) % n]; xn, zn = o[(k + 1) % n]
        tx, tz = xn - xp, zn - zp; l = math.hypot(tx, tz) or 1
        nx, nz = tz / l, -tx / l
        if nx * x < 0 or (abs(x) < 1e-6 and nz * z < 0): nx, nz = -nx, -nz   # outward
        return x - nx * WOOD_T, z - nz * WOOD_T
    rings = []
    for k in range(n):
        x, z = o[k]; xi, zi = inner(k)
        top = deck_y(z, x) + band_h(z)
        prof = [(x, z, deck_y(z, x) - 0.03), (x, z, top - 0.008), (lerp(x, xi, 0.25), lerp(z, zi, 0.25), top - 0.001),
                (lerp(x, xi, 0.75), lerp(z, zi, 0.75), top - 0.001), (xi, zi, top - 0.008), (xi, zi, deck_y(z, xi) - 0.03)]
        rings.append([bm.verts.new(G3(px, py, pz)) for px, pz, py in prof])
    for k in range(n):
        a, b = rings[k], rings[(k + 1) % n]
        for j in range(len(a) - 1):
            bm.faces.new((a[j], b[j], b[j + 1], a[j + 1])).material_index = M['wood']
        bm.faces.new((a[-1], b[-1], b[0], a[0])).material_index = M['wood']

def build_cabin_top(bm, M):
    """the cabin top: arched across between the sides' tops, 3 cm thick, its edges lipped a little over the mahogany"""
    NZ, NX = 26, 14
    zs = [lerp(CAB_F + 0.025, CAB_A, i / NZ) for i in range(NZ + 1)]
    secs = []
    for z in zs:
        w = band_half(z) + 0.008
        yb = deck_y(z, w) + band_h(z)
        prof = []
        for i in range(NX + 1):
            x = lerp(w, -w, i / NX); prof.append((x, yb + ARCH * (1 - (x / w) ** 2) if w > 0 else yb))
        top = [(x, y + 0.03) for x, y in prof]
        ring = top + list(reversed([(x, y) for x, y in prof]))
        secs.append([bm.verts.new(G3(x, y, z)) for x, y in ring])
    R = len(secs[0])
    for i in range(NZ):
        for j in range(R):
            bm.faces.new((secs[i][j], secs[i][(j + 1) % R], secs[i + 1][(j + 1) % R], secs[i + 1][j])).material_index = M['gel']
    bm.faces.new(secs[-1]).material_index = M['gel']
    bm.faces.new(list(reversed(secs[0]))).material_index = M['gel']

def build_cabin_back(bm, M):
    """the cabin's aft face over the cockpit floor, up to the cabin top's arch"""
    z = CAB_A - 0.004; w = band_half(z) - WOOD_T; NX = 16
    yb = deck_y(z, w) + band_h(z)
    top = [(lerp(w, -w, i / NX), yb + ARCH * (1 - (lerp(w, -w, i / NX) / (w + WOOD_T)) ** 2)) for i in range(NX + 1)]
    front = [bm.verts.new(G3(x, y, z)) for x, y in top] + [bm.verts.new(G3(-w, FLOOR - 0.02, z)), bm.verts.new(G3(w, FLOOR - 0.02, z))]
    bm.faces.new(front).material_index = M['gel']
    back = [bm.verts.new(G3(x, y, z - 0.02)) for x, y in top] + [bm.verts.new(G3(-w, FLOOR - 0.02, z - 0.02)), bm.verts.new(G3(w, FLOOR - 0.02, z - 0.02))]
    bm.faces.new(list(reversed(back))).material_index = M['gel']
    n = len(front)
    for k in range(n): bm.faces.new((front[k], back[k], back[(k + 1) % n], front[(k + 1) % n])).material_index = M['gel']

def plan_prism(bm, pts, y0, y1, ms, mb, mt):
    lo = [bm.verts.new(G3(x, y0, z)) for x, z in pts]; hi = [bm.verts.new(G3(x, y1, z)) for x, z in pts]
    n = len(pts)
    for k in range(n): bm.faces.new((lo[k], lo[(k + 1) % n], hi[(k + 1) % n], hi[k])).material_index = ms
    bm.faces.new(list(reversed(lo))).material_index = mb; bm.faces.new(hi).material_index = mt

def material(name, color, rough=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1); p.inputs['Roughness'].default_value = rough
    return m

if __name__ == '__main__':
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)
    ORDER = ['hull', 'deck', 'wood', 'gel', 'teak']
    MAT = {'hull': material('hull', (0.05, 0.12, 0.25), 0.2), 'deck': material('deck', (0.8, 0.79, 0.75), 0.85),
           'wood': material('wood', (0.36, 0.14, 0.05), 0.25), 'gel': material('gel', (0.9, 0.89, 0.86), 0.35),
           'teak': material('teak', (0.55, 0.38, 0.22), 0.7)}
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

    hull = new_object('dragon')
    bm = bmesh.new(); build_hull(bm, IDX); finish(hull, bm)
    # the cockpit, cut inside the coaming from the cabin's aft face to its rounded aft end, down to the floorboards
    cut = new_object('cockpit'); bm = bmesh.new()
    zc = CAB_A - 0.01; wc = band_half(zc) - WOOD_T + 0.004
    ck = [(wc, zc)] + [(x, z) for x, z in outline(WOOD_T - 0.004) if z > zc] + [(-wc, zc)]
    plan_prism(bm, ck, FLOOR, 2.0, IDX['gel'], IDX['teak'], IDX['gel']); finish(cut, bm)
    apply_bool(hull, cut, 'DIFFERENCE')
    # the band of mahogany, the cabin top and the cabin's aft face, merged with the hull as they overlap it and each other
    parts = new_object('parts'); bm = bmesh.new()
    build_band(bm, IDX); build_cabin_top(bm, IDX); build_cabin_back(bm, IDX); finish(parts, bm)
    apply_bool(hull, parts, 'UNION')
    bm = bmesh.new(); bm.from_mesh(hull.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(hull.data); bm.free()
    bpy.ops.object.select_all(action='DESELECT'); hull.select_set(True); bpy.context.view_layer.objects.active = hull
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(34))
    me = hull.data
    print('dragon verts', len(me.vertices), 'tris', sum(len(p.vertices) - 2 for p in me.polygons), 'mats', [m.name for m in me.materials])
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_texcoords=False, export_normals=True, export_materials='EXPORT', export_extras=False,
                              export_animations=False, export_skins=False, export_morph=False, export_cameras=False, export_lights=False)
    print('wrote', OUT, os.path.getsize(OUT))
