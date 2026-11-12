# Regatta: the game's racing yacht (miniapp/regatta/yacht.js), the hard parts modelled here and exported to
# miniapp/regatta/yacht.glb: the hull (chined aft, fine forward), a fin keel with a bulb, a spade rudder, the deck
# with an open-transom cockpit cut into it, seats and coamings, and a coachroof with a raked front and a window band.
# The sails, rig, lifelines, winches, wheel, hatches and decals stay in yacht.js (they move, or are made per boat).
#
# The topsides above the chine follow yacht.js's own lines (halfBeam, sheerAt, canoe, section), so the logo and
# hull-window decals it wraps onto the hull still lie on this surface; the sheer, deck outline, cockpit opening and
# the coachroof's footprint and top are where yacht.js's fittings expect them.
#
# Materials by name, which yacht.js swaps for its own: hull (paint, boot-top and antifouling drawn by its shader),
# deck (non-skid), gel, teak, glass. No UVs: yacht.js lays the deck's and the teak's out from the plan itself.
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P docs/design/blender/game_yacht.py
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'miniapp', 'regatta', 'yacht.glb'))

# ---------- yacht.js's lines (game frame: +x starboard, +y up, -z forward, the waterline at y = 0) ----------
L, B = 10.4, 3.35
STERN_Z = L / 2
def clamp(v, a, b): return max(a, min(b, v))
def lerp(a, b, t): return a + (b - a) * t
def smooth(e0, e1, x): t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def half_beam(t):
    if t < 0.42: return (B / 2) * (0.84 + 0.16 * math.sin((t / 0.42) * math.pi / 2))
    return (B / 2) * max(0.0, math.cos(min(1, (t - 0.42) / 0.58) * math.pi / 2)) ** 0.85
def sheer(t): return 1.0 + 0.22 * t ** 1.6
def canoe(t): return 0.62 * math.sin(math.pi * min(1, t * 0.93 + 0.05)) ** 0.75
def z_at(t): return STERN_Z - t * L
def t_at(z): return clamp((STERN_Z - z) / L, 0, 1)
def deck_y(z, x=0.0):
    hb = max(half_beam(t_at(z)), 0.3)
    return sheer(t_at(z)) + 0.05 * (1 - (x / hb) ** 2)
def n_of(t): return lerp(2.9, 1.6, clamp((t - 0.45) / 0.55, 0, 1))
def section(t, s):  # yacht.js's section(): s = 0 at the deck edge ... 1 at the keel -> (x, y, dz)
    hb, sy, d, n = half_beam(t), sheer(t), canoe(t), n_of(t)
    phi = s * math.pi / 2; c, sn = math.cos(phi), math.sin(phi); yr = sn ** (2 / n)
    x = hb * c ** (2 / n) * (1 - 0.05 * sn)
    dz = 0.4 * yr * ((t - 0.88) / 0.12) ** 2 if t > 0.88 else 0.0
    return x, sy - (sy + d) * yr, dz

def G(x, y, z): return Vector((x, -z, y))  # game -> Blender (Z up, +Y forward); the glTF export turns it back

# ---------- the hull section: yacht.js's topsides down to the chine, then a flat-ish bottom aft ----------
SPLIT = 0.5           # share of the section's samples above the chine
def chine_y(t): return 0.24 - 0.3 * t
def chine_w(t): return 1 - smooth(0.34, 0.7, t)    # 1: a hard chine aft ... 0: yacht.js's round sections forward
def hull_point(t, s):
    hb, sy, d, n = half_beam(t), sheer(t), canoe(t), n_of(t)
    yc = chine_y(t)
    sc = math.asin(clamp((sy - yc) / (sy + d), 0, 1) ** (n / 2)) * 2 / math.pi  # where the formula reaches the chine
    sf = s / SPLIT * sc if s <= SPLIT else sc + (s - SPLIT) / (1 - SPLIT) * (1 - sc)
    fx, fy, dz = section(t, sf)
    w = chine_w(t)
    if s <= SPLIT or w <= 0: return fx, fy, dz
    xc, yc2, _ = section(t, sc)
    u = (s - SPLIT) / (1 - SPLIT)
    d2 = d * 0.86
    dr = math.radians(lerp(22, 12, clamp(t / 0.35, 0, 1)))  # deadrise at the chine
    k = xc * 0.42
    P0 = (xc, yc2); P1 = (xc - k * math.cos(dr), yc2 - k * math.sin(dr)); P2 = (xc * 0.38, -d2); P3 = (0.0, -d2)
    a, b2, c2, e = (1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3
    bx = a * P0[0] + b2 * P1[0] + c2 * P2[0] + e * P3[0]
    by = a * P0[1] + b2 * P1[1] + c2 * P2[1] + e * P3[1]
    return lerp(fx, bx, w), lerp(fy, by, w), dz

def build_hull(bm, mats):
    N, KH, KD = 72, 22, 7
    rings = []
    for i in range(N + 1):
        t = min(0.995, (i / N) ** 0.85)
        z = z_at(t); hb = half_beam(t)
        ring = []
        for j in range(KH + 1):  # starboard, deck edge -> keel
            s = j / KH; s = s if s <= SPLIT else SPLIT + (1 - SPLIT) * ((s - SPLIT) / (1 - SPLIT)) ** 1.15
            x, y, dz = hull_point(t, s); ring.append(G(x, y, z + dz))
        for j in range(KH - 1, -1, -1):  # port, keel -> deck edge
            x, y, dz = hull_point(t, j / KH if j / KH <= SPLIT else SPLIT + (1 - SPLIT) * ((j / KH - SPLIT) / (1 - SPLIT)) ** 1.15)
            ring.append(G(-x, y, z + dz))
        nh = len(ring)
        for k in range(-(KD - 1), KD):  # the deck, port -> starboard
            x = hb * k / KD; ring.append(G(x, sheer(t) + 0.05 * (1 - (k / KD) ** 2), z))
        rings.append([bm.verts.new(p) for p in ring])
    M = len(rings[0])
    for i in range(N):
        a, b = rings[i], rings[i + 1]
        for j in range(M):
            f = bm.faces.new((a[j], a[(j + 1) % M], b[(j + 1) % M], b[j]))
            f.material_index = mats['hull'] if j < nh - 1 else mats['deck']
    for r in (rings[0], rings[-1]): bm.faces.new(r).material_index = mats['hull']  # transom, stem

# ---------- foils: the keel and the rudder ----------
def naca(u, th):  # half-thickness of a NACA 00xx at chord fraction u
    return 5 * th * (0.2969 * math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4)
def foil(bm, mat, y0, y1, c0, c1, le0, le1, th, NS=8, NC=14):
    secs = []
    for i in range(NS + 1):
        f = i / NS; y = lerp(y0, y1, f); c = lerp(c0, c1, f); le = lerp(le0, le1, f)
        us = [(1 - math.cos(math.pi * k / NC)) / 2 for k in range(NC + 1)]
        pts = [(naca(u, th) * c, le + u * c) for u in us] + [(-naca(u, th) * c, le + u * c) for u in reversed(us[1:-1])]
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

# ---------- the coachroof: lofted sections, aft (z = 1.51) to the raked front (z = -2.06) ----------
CR_A, CR_F, CR_ZA, CR_ZF, CR_TOP = 1.18, 0.78, 1.51, -2.06, 1.52   # yacht.js's footprint (with its bevel) and top
GLASS_LO, GLASS_HI = 1.27, 1.39
def build_coachroof(bm, mats):
    NZ = 40
    secs, meta = [], []
    for i in range(NZ + 1):
        f = i / NZ
        z = lerp(CR_ZA, CR_ZF, f ** 0.9)
        w0 = lerp(CR_A, CR_F, (CR_ZA - z) / (CR_ZA - CR_ZF))
        rf = clamp((-1.88 - z) / 0.18, 0, 1); w0 *= math.sqrt(max(0.0, 1 - 0.45 * rf * rf))  # round the front corners
        yd = deck_y(z, w0)
        ht = CR_TOP - (CR_TOP - (deck_y(z) + 0.16)) * smooth(-1.25, CR_ZF, z) ** 1.25
        wt = w0 - 0.11 * clamp((ht - yd) / 0.45, 0.25, 1)    # tumblehome
        rr = 0.07
        ys = [0.5, yd]
        side_top = ht - rr
        lo, hi = min(GLASS_LO, lerp(yd, side_top, 0.45)), min(GLASS_HI, lerp(yd, side_top, 0.75))
        for y in (lo, hi, side_top): ys.append(y)
        prof = [(w0, ys[0]), (w0, ys[1])]
        for y in ys[2:]: prof.append((lerp(w0, wt, (y - yd) / max(1e-3, side_top - yd)), y))
        prof += [(wt - rr * 0.29, ht - rr * 0.29), (wt - rr, ht)]
        for x in (0.5, 0.25):
            prof.append((x, ht + 0.03 * (1 - (x / wt) ** 2)))
        half = prof
        ring = [G(x, y, z) for x, y in half] + [G(0, ht + 0.03, z)] + [G(-x, y, z) for x, y in reversed(half)]
        secs.append([bm.verts.new(p) for p in ring]); meta.append(z)
    M = len(secs[0])
    for i in range(NZ):
        zc = (meta[i] + meta[i + 1]) / 2
        for j in range(M):
            mat = mats['gel']
            seg = j if j <= 8 else 17 - j              # the same segment on either side: 0 below the deck, 2 the window band
            if seg == 2 and -1.45 < zc < 1.2: mat = mats['glass']
            if seg in (7, 8) and -1.95 < zc < -1.4: mat = mats['glass']  # the raked front windows
            bm.faces.new((secs[i][j], secs[i][(j + 1) % M], secs[i + 1][(j + 1) % M], secs[i + 1][j])).material_index = mat
    bm.faces.new(list(reversed(secs[0]))).material_index = mats['gel']
    bm.faces.new(secs[-1]).material_index = mats['gel']

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
       'gel': material('gel', (0.9, 0.89, 0.86), 0.3), 'teak': material('teak', (0.45, 0.28, 0.13), 0.7),
       'glass': material('glass', (0.03, 0.04, 0.05), 0.05)}
ORDER = ['hull', 'deck', 'gel', 'teak', 'glass']
IDX = {m: i for i, m in enumerate(ORDER)}

# the hull and the coachroof, one solid
hull = new_object('yacht', ORDER)
bm = bmesh.new(); build_hull(bm, IDX); build_coachroof(bm, IDX)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(hull.data); bm.free()

# the cockpit, cut out of it: from the coachroof's aft face out through the transom, its sole 0.52 above the water
cut = new_object('cockpit', ORDER)
bm = bmesh.new()
plan_prism(bm, rounded_rect(-0.95, 0.95, 1.505, 6.5, 0.18, corners=(1, 0, 0, 1)), 0.52, 3.0, IDX['gel'], IDX['teak'], IDX['gel'])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(cut.data); bm.free()
mod = hull.modifiers.new('cockpit', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut; mod.solver = 'EXACT'
mod.use_self = True   # the hull and the coachroof are two shells, one inside the other: merge them as it cuts
try: mod.material_mode = 'TRANSFER'
except Exception as e: print('material_mode:', e)
bpy.context.view_layer.objects.active = hull; bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cut)

# appendages, seats and coamings, joined in
bm = bmesh.new(); bm.from_mesh(hull.data)
H = IDX['hull']
foil(bm, H, 0.15, -1.86, 1.12, 0.74, -0.78, -0.5, 0.12)                     # the keel
bulb(bm, H, -1.02, 1.16, -1.96, 0.24)                                          # its bulb
foil(bm, H, 0.1, -1.58, 0.54, 0.34, 4.25 - 0.54 * 0.25, 4.25 - 0.34 * 0.18, 0.11, NS=6)  # the spade rudder, its stock at z = 4.25
for sx in (-1, 1):
    xs = sorted([sx * 0.53, sx * 0.96])   # the seats, into the cockpit's side walls
    plan_prism(bm, rounded_rect(xs[0], xs[1], 1.505, 3.75, 0.06), 0.52, 0.76, IDX['gel'], IDX['gel'], IDX['teak'])
    xc = sorted([sx * 0.94, sx * 1.025])  # the coamings, standing on the deck at the cockpit's edge
    yb = deck_y(2.6, 1.0)
    plan_prism(bm, rounded_rect(xc[0], xc[1], 1.5, 3.65, 0.03), yb - 0.05, yb + 0.17, IDX['gel'], IDX['gel'], IDX['gel'])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
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
