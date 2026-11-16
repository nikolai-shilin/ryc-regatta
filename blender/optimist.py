# Regatta: the Optimist's moulded hull (game/boats3d.js OptimistView), modelled here and exported to
# game/optimist.glb. She is a pram: a flat-floored, hard-chined box with flared topsides, a small transom at the bow as
# well as the stern, both raked, and no deck: an open GRP shell, its gunwale turned in as a flange (the inwale) all
# round the top, a rubbing strake round its outside, the mast thwart across the bow with the mast's hole in it, and the
# daggerboard case on the centreline, its slot cut through case and hull. The daggerboard, the rudder, the spars, the
# sail, the buoyancy bags, the fittings and the sailor stay in boats3d.js.
#
# The hull follows boats3d.js's lines for her (OZ: optimistLines, the same functions as below), so the name and logo
# decals still lie on her topsides, and the floor, the thwart, the case and the inwale are where its fittings, bags
# and sailor expect them.
#
# Materials by name, which boats3d.js swaps for its own: hull (the paint drawn by its shader), deck (the floor's
# non-skid), gel (the inside of the shell, the inwale, the thwart, the case), rub (the rubbing strake). No UVs:
# boats3d.js lays the floor's out from the plan.
#
#   blender -b --factory-startup -P blender/optimist.py
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'public', 'game', 'optimist.glb'))

# ---------- boats3d.js's lines for her (game frame: +x starboard, +y up, -z forward, the waterline at y = 0) ----------
# t = 0 at the stern transom ... 1 at the bow transom, both at the gunwale
L, B = 2.31, 1.13
STERN = L / 2
def clamp(v, a, b): return max(a, min(b, v))
def lerp(a, b, t): return a + (b - a) * t
def smooth(e0, e1, x): t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def z_at(t): return STERN - t * L
def t_at(z): return clamp((STERN - z) / L, 0, 1)
def hb(t):  # the gunwale's half-breadth: 0.88 m across the stern transom, 1.13 m a little aft of the middle, 0.6 m at the bow's
    if t < 0.45: return 0.44 + 0.125 * math.sin((t / 0.45) * math.pi / 2)
    return 0.3 + 0.265 * math.cos(min(1, (t - 0.45) / 0.55) * math.pi / 2) ** 0.9
def sheer(t): return 0.29 + 0.11 * t ** 2.2 - 0.02 * math.sin(math.pi * t)  # the gunwale's height: rising to the bow
def keel(t):  # the floor's centreline outside: its rocker, deepest a little aft of the middle, sweeping up to the bow transom
    if t < 0.4: return -0.12 + 0.09 * ((0.4 - t) / 0.4) ** 2
    return -0.12 + 0.22 * ((t - 0.4) / 0.6) ** 1.8
DEAD = 0.035  # the chine stands this much above the centreline: a little vee in the floor
FLARE = 0.36  # the topsides lean out this much a metre up
CHINE_R = 0.025
def chine_y(t): return keel(t) + DEAD
def hc(t): return hb(t) - FLARE * (sheer(t) - chine_y(t))
# the transoms raked: the floor's centreline runs from 0.1 m forward of the stern's gunwale to 0.19 m aft of the bow's,
# each section leaning in z between its gunwale and its keel, so the stern's top stands aft of its foot and the bow's
# forward of it, and the rocker sweeps up into the bow transom in one curve
K_STERN, K_BOW = STERN - 0.1, -STERN + 0.19
def zp(t, y):
    zk = lerp(K_STERN, K_BOW, t)
    return lerp(z_at(t), zk, (sheer(t) - y) / (sheer(t) - keel(t)))

def fillet(P0, C, P1, r, n=4):
    """the corner C between the lines from P0 and to P1, rounded to radius r: the arc's points"""
    ax, ay = P0[0] - C[0], P0[1] - C[1]; la = math.hypot(ax, ay); ax, ay = ax / la, ay / la
    bx, by = P1[0] - C[0], P1[1] - C[1]; lb = math.hypot(bx, by); bx, by = bx / lb, by / lb
    th = math.acos(clamp(ax * bx + ay * by, -1, 1)); d = r / math.tan(th / 2)
    T0, T1 = (C[0] + ax * d, C[1] + ay * d), (C[0] + bx * d, C[1] + by * d)
    mx, my = ax + bx, ay + by; lm = math.hypot(mx, my); k = r / math.sin(th / 2)
    O = (C[0] + mx / lm * k, C[1] + my / lm * k)
    a0, a1 = math.atan2(T0[1] - O[1], T0[0] - O[0]), math.atan2(T1[1] - O[1], T1[0] - O[0])
    if a1 - a0 > math.pi: a1 -= 2 * math.pi
    if a0 - a1 > math.pi: a1 += 2 * math.pi
    return [(O[0] + r * math.cos(lerp(a0, a1, i / n)), O[1] + r * math.sin(lerp(a0, a1, i / n))) for i in range(n + 1)]

def section(t, inset=0.0, floor=0.0, top=None):
    """the starboard half of the section at t, gunwale (or `top`) to the centreline: the flared topside, the chine
    turned round its radius, the floor. inset: the inside skin, that much in from the outside; floor: and the floor
    that much up"""
    sy, yc, h, c = sheer(t), chine_y(t) + floor, hb(t), hc(t)
    lean = math.hypot(1, FLARE)
    G0 = (h - inset * lean, sy); C0 = (c - inset * lean, yc + inset * 0.3); K = (0.0, keel(t) + floor)
    if top is not None: G0 = (G0[0] + FLARE * (top - sy), top)
    pts = [G0] + [(lerp(G0[0], C0[0], i / 4), lerp(G0[1], C0[1], i / 4)) for i in range(1, 4)]
    pts += fillet(G0, C0, K, CHINE_R if not inset else CHINE_R * 0.6)
    pts += [(lerp(C0[0], K[0], i / 5), lerp(C0[1], K[1], i / 5)) for i in range(1, 6)]
    return pts

def G(x, y, z): return Vector((x, -z, y))  # game -> Blender (Z up, +Y forward); the glTF export turns it back

# ---------- materials, objects ----------
def material(name, color, rough=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1); p.inputs['Roughness'].default_value = rough
    return m
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
MAT = {'hull': material('hull', (0.92, 0.92, 0.9), 0.2), 'deck': material('deck', (0.8, 0.79, 0.75), 0.85),
       'gel': material('gel', (0.83, 0.84, 0.83), 0.45), 'rub': material('rub', (0.2, 0.21, 0.22), 0.7)}
ORDER = ['hull', 'deck', 'gel', 'rub']
IDX = {m: i for i, m in enumerate(ORDER)}
def new_object(name):
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    for m in ORDER: me.materials.append(MAT[m])
    return ob
def finish_mesh(ob, bm):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(ob.data); bm.free()

def loft(bm, t0, t1, ring_of, n, end_mat):
    """a closed solid: the ring (a closed loop of (x, y, z, face material) points, round the section) at n + 1
    stations from t0 to t1, capped at both ends"""
    rings = []
    for i in range(n + 1):
        u = i / n; t = lerp(t0, t1, 0.5 - 0.5 * math.cos(math.pi * u))  # crowded towards the transoms, where the lines turn
        pts = ring_of(t); rings.append(([bm.verts.new(G(x, y, z)) for x, y, z, _ in pts], [m for *_, m in pts]))
    R = len(rings[0][0])
    for i in range(n):
        (a, mats), (b, _) = rings[i], rings[i + 1]
        for j in range(R):
            bm.faces.new((a[j], a[(j + 1) % R], b[(j + 1) % R], b[j])).material_index = IDX[mats[j]]
    for vs, flip in ((rings[0][0], True), (rings[-1][0], False)):
        f = bm.faces.new(list(reversed(vs)) if flip else vs); f.material_index = IDX[end_mat]

def closed_ring(t, half, top_y, side_mat, floor_mat, top_mat):
    """the section's two halves joined across the top at top_y: (x, y, z, material of the face that starts here)"""
    st = half  # gunwale -> centreline, starboard
    n_side = 8  # the faces down the topside and round the chine (section's layout: 4 points, then the arc's 5)
    out = []
    for k, (x, y) in enumerate(st):
        out.append((x, y, zp(t, y), side_mat if k < n_side else floor_mat))
    port = [(-x, y) for x, y in reversed(st[:-1])]
    for k, (x, y) in enumerate(port):
        kk = len(st) - 2 - k  # the starboard point it mirrors
        out.append((x, y, zp(t, y), floor_mat if kk - 1 >= n_side else side_mat))  # the face from it is starboard's kk - 1
    out[-1] = (*out[-1][:3], top_mat)  # the port gunwale back across the top to the starboard one
    return out

def cut(target, cutter):
    mod = target.modifiers.new('cut', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cutter; mod.solver = 'EXACT'
    try: mod.material_mode = 'TRANSFER'
    except Exception as e: print('material_mode:', e)
    bpy.context.view_layer.objects.active = target; bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter)
def union(target, other):
    mod = target.modifiers.new('join', 'BOOLEAN'); mod.operation = 'UNION'; mod.object = other; mod.solver = 'EXACT'
    try: mod.material_mode = 'TRANSFER'
    except Exception as e: print('material_mode:', e)
    bpy.context.view_layer.objects.active = target; bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(other)

def plan_prism(bm, outline, y0, y1, ms, mb, mt):
    lo = [bm.verts.new(G(x, y0, z)) for x, z in outline]; hi = [bm.verts.new(G(x, y1, z)) for x, z in outline]
    n = len(outline)
    for k in range(n): bm.faces.new((lo[k], lo[(k + 1) % n], hi[(k + 1) % n], hi[k])).material_index = IDX[ms]
    bm.faces.new(list(reversed(lo))).material_index = IDX[mb]; bm.faces.new(hi).material_index = IDX[mt]
def rounded_rect(x0, x1, z0, z1, r, seg=5):
    pts = []
    for (cx, cz), (sx, sz), k in [((x1, z0), (-1, 1), 0), ((x1, z1), (-1, -1), 1), ((x0, z1), (1, -1), 2), ((x0, z0), (1, 1), 3)]:
        ox, oz = cx + sx * r, cz + sz * r
        a0 = [math.pi * 1.5, 0, math.pi / 2, math.pi][k]
        for i in range(seg + 1):
            a = a0 + (math.pi / 2) * i / seg
            pts.append((ox + r * math.cos(a), oz + r * math.sin(a)))
    return pts
def prism_object(name, outline, y0, y1, ms, mb, mt):
    ob = new_object(name); bm = bmesh.new(); plan_prism(bm, outline, y0, y1, ms, mb, mt); finish_mesh(ob, bm); return ob

# ---------- the shell ----------
# the outside, closed across the top at the gunwale (that face becomes the inwale's top)
hull = new_object('optimist'); bm = bmesh.new()
loft(bm, 0, 1, lambda t: closed_ring(t, section(t), sheer(t), 'hull', 'hull', 'gel'), 64, 'hull')
finish_mesh(hull, bm)

SKIN, FLOOR_T, FLANGE, LIP = 0.012, 0.016, 0.045, 0.022  # the skin, the floor, the inwale's width and depth
T_END = 0.018 / L  # the transoms' thickness
# the inside, cut out of it: the skin's thickness in from the topsides and the floor, below the inwale's lip...
inner = new_object('inner'); bm = bmesh.new()
loft(bm, T_END, 1 - T_END, lambda t: closed_ring(t, section(t, SKIN, FLOOR_T, sheer(t) - LIP), sheer(t) - LIP, 'gel', 'deck', 'gel'), 64, 'gel')
finish_mesh(inner, bm); cut(hull, inner)
# ...and under the inwale's top, FLANGE in from the gunwale all round, transoms too, up through the top
lip = new_object('lip'); bm = bmesh.new()
TL = FLANGE / L
def lip_ring(t):
    y0, y1 = sheer(t) - LIP - 0.004, sheer(t) + 0.2
    x0 = hb(t) - FLANGE - FLARE * LIP
    pts = [(x0, y0), (x0 + FLARE * (y1 - y0), y1)]
    return [(pts[1][0], y1, zp(t, y1), 'gel'), (pts[0][0], y0, zp(t, y0), 'gel'), (-pts[0][0], y0, zp(t, y0), 'gel'), (-pts[1][0], y1, zp(t, y1), 'gel')]
loft(bm, TL, 1 - TL, lip_ring, 48, 'gel')
finish_mesh(lip, bm); cut(hull, lip)

# the mast thwart: a moulded beam across the bow, its top flush with the inwale's, the mast's hole through it
MAST_Z = -STERN + 0.4  # boats3d.js OZ.MAST_Z
MAST_AT = MAST_Z + 0.009  # where the mast, raked 1.5° aft about its foot on the floor, comes through the thwart
tm = t_at(MAST_Z)
def inner_x(t, y): return hb(t) - SKIN * math.hypot(1, FLARE) - FLARE * (sheer(t) - y)
TH_W, TH_D = 0.17, 0.035
ty = sheer(t_at(MAST_Z + TH_W / 2)) - 0.002  # its top level with the inwale at its aft edge, the lower
# its ends against the topsides as they narrow towards the bow, 4 mm into the skin
edge_z = [MAST_Z - TH_W / 2 + TH_W * k / 6 for k in range(7)]
ends = [(inner_x(t_at(z), ty - TH_D) + 0.004, z) for z in edge_z]
thwart = prism_object('thwart', [(x, z) for x, z in ends] + [(-x, z) for x, z in reversed(ends)], ty - TH_D, ty, 'gel', 'gel', 'gel')
union(hull, thwart)
hole = new_object('hole'); bm = bmesh.new()
plan_prism(bm, [(0.027 * math.cos(a), MAST_AT + 0.027 * math.sin(a)) for a in (2 * math.pi * k / 20 for k in range(20))], ty - 0.1, ty + 0.1, 'gel', 'gel', 'gel')
finish_mesh(hole, bm); cut(hull, hole)

# the daggerboard case on the centreline, standing up from the floor amidships, its slot through it and the hull
DBZ, CASE_L, CASE_W, CASE_TOP = -0.06, 0.36, 0.075, 0.16  # boats3d.js OZ.DBZ, OZ.CASE_TOP
case = prism_object('case', rounded_rect(-CASE_W / 2, CASE_W / 2, DBZ - CASE_L / 2, DBZ + CASE_L / 2, 0.02, 3), keel(t_at(DBZ)) + 0.006, CASE_TOP, 'gel', 'gel', 'gel')
union(hull, case)
slot = prism_object('slot', rounded_rect(-0.0095, 0.0095, DBZ - 0.145, DBZ + 0.145, 0.008, 3), -0.4, CASE_TOP + 0.2, 'gel', 'gel', 'gel')
cut(hull, slot)

# ---------- the rubbing strake ----------
# round the outside of the gunwale, sides and transoms: a half-round fender just under its top edge
def strake():
    ob = new_object('strake'); bm = bmesh.new()
    path = []  # (where across, as a share of the half-breadth: 1 starboard ... -1 port; t)
    n = 40
    for i in range(n + 1): path.append((1, 0.002 + 0.996 * i / n))  # starboard, stern to bow
    for i in range(1, 8): path.append((1 - 2 * i / 8, 0.998))  # across the bow transom
    for i in range(n, -1, -1): path.append((-1, 0.002 + 0.996 * i / n))  # port, bow to stern
    for i in range(1, 8): path.append((-1 + 2 * i / 8, 0.002))  # across the stern
    def at(p, y):  # the hull's outside at height y under that point of the gunwale
        f, t = p; return f * (hb(t) - FLARE * (sheer(t) - y)), zp(t, y)
    R, H, S = 0.014, 0.024, 7  # how far it stands out, its depth, the points round its face
    rings, m = [], len(path)
    for i, p in enumerate(path):
        (xp, zp0), (xn, zn) = at(path[(i - 1) % m], sheer(path[(i - 1) % m][1])), at(path[(i + 1) % m], sheer(path[(i + 1) % m][1]))
        dx, dz = xn - xp, zn - zp0; l = math.hypot(dx, dz) or 1
        nx, nz = -dz / l, dx / l  # outward, in plan
        y = sheer(p[1]) - 0.006
        ring = []
        for k in range(S + 1):
            a = math.pi * k / S  # from the top round its face to the bottom
            o, yy = R * math.sin(a), y - H / 2 + (H / 2) * math.cos(a)
            x, z = at(p, yy)
            ring.append(bm.verts.new(G(x + nx * (o - 0.003), yy, z + nz * (o - 0.003))))
        rings.append(ring)
    for i in range(m):
        a, b = rings[i], rings[(i + 1) % m]
        for k in range(S):
            bm.faces.new((a[k], b[k], b[k + 1], a[k + 1])).material_index = IDX['rub']
    finish_mesh(ob, bm)
    return ob
rub = strake()

bm = bmesh.new(); bm.from_mesh(hull.data)  # the shell's faces outward, before the open strake joins it
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(hull.data); bm.free()
bpy.ops.object.select_all(action='DESELECT')
for o in (hull, rub): o.select_set(True)
bpy.context.view_layer.objects.active = hull
bpy.ops.object.join()
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(34))
me = hull.data
print('verts', len(me.vertices), 'tris', sum(len(p.vertices) - 2 for p in me.polygons), 'mats', [m.name for m in me.materials])

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                          export_texcoords=False, export_normals=True, export_materials='EXPORT', export_extras=False,
                          export_animations=False, export_skins=False, export_morph=False, export_cameras=False, export_lights=False)
print('wrote', OUT, os.path.getsize(OUT))
