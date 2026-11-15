# Regatta: the AC75's moulded hull (game/boats3d.js AC75View), modelled here and exported to game/ac75.glb: the hull,
# a scow aft with a hard chine high on its topsides and a long fine bow, its deck edge turned round a radius; the bustle
# down the centreline of the bottom faired into it in one surface; the flat deck with the eight crew pods cut into it,
# four a side, their walls and floors; a pocket let into each side where the foil arm comes out round its bearing; the
# transom's edge turned round a radius. The foil arms and their bearings, the rudder, the mast and sails, the pods' rims,
# bikes and wheels, the fittings and the crew stay in boats3d.js (they move, or are made per boat).
#
# The hull follows boats3d.js's lines for her (A: hullOf with her half-breadth, sheer, depth, sections and chine), so
# the logo, the sail number, her name and the arms' bearings still lie on it; the deck and the pods (their outlines and
# floors) are where its rims, bikes, wheels and crew expect them.
#
# Materials by name, which boats3d.js swaps for its own: hull (her paint, the underside darker), deck (the flat dark
# deck or the player's), pod (the pods' walls), rubber (their floors). No UVs: boats3d.js lays the deck's out from the
# plan.
#
#   blender -b --factory-startup -P blender/ac75.py
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'public', 'game', 'ac75.glb'))

L, B = 22.86, 5.0
STERN = L / 2
FLARE = 0.02
CROWN = 0.08
def clamp(v, a, b): return max(a, min(b, v))
def lerp(a, b, t): return a + (b - a) * t
def smooth(e0, e1, x): t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def hb_of(t):
    if t < 0.5: return (B / 2) * (0.86 + 0.14 * math.sin((t / 0.5) * math.pi / 2))
    return (B / 2) * max(0.0, math.cos(min(1, (t - 0.5) / 0.5) * math.pi / 2)) ** 0.62
def sheer(t): return 1.05 + 0.32 * t ** 2.2
def depth(t): return 0.62 * math.sin(math.pi * min(1, t * 0.88 + 0.1)) ** 0.6
def n_of(t): return lerp(3.4, 2.1, clamp((t - 0.4) / 0.6, 0, 1))
def chine_y(t): return 0.42 - 0.45 * t
def chine_w(t): return 1 - smooth(0.5, 0.88, t)
def chine_dead(t): return lerp(7, 3, clamp(t / 0.4, 0, 1))
def z_at(t): return STERN - t * L
def t_at(z): return clamp((STERN - z) / L, 0, 1)
def deck_y(z, x=0.0):
    hb = max(hb_of(t_at(z)), 0.2)
    return sheer(t_at(z)) + CROWN * (1 - min(1, abs(x) / hb) ** 2)
def round_pt(t, s):
    hb, sy, d, n = hb_of(t), sheer(t), depth(t), n_of(t)
    phi = s * math.pi / 2; c, sn = math.cos(phi), math.sin(phi); yr = sn ** (2 / n)
    return hb * c ** (2 / n) * (1 - FLARE * sn), sy - (sy + d) * yr
SPLIT = 0.5
def hull_point(t, s):
    sy, d, n, w = sheer(t), depth(t), n_of(t), chine_w(t)
    sc = math.asin(clamp((sy - chine_y(t)) / (sy + d), 0, 1) ** (n / 2)) * 2 / math.pi
    sf = s / SPLIT * sc if s <= SPLIT else sc + (s - SPLIT) / (1 - SPLIT) * (1 - sc)
    fx, fy = round_pt(t, sf)
    if s <= SPLIT or w <= 0: return fx, fy
    xc, ycc = round_pt(t, sc)
    u = (s - SPLIT) / (1 - SPLIT); d2 = d * 0.92; dr = math.radians(chine_dead(t)); k = xc * 0.42
    P = [(xc, ycc), (xc - k * math.cos(dr), ycc - k * math.sin(dr)), (xc * 0.38, -d2), (0.0, -d2)]
    a, b2, c2, e = (1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3
    return lerp(fx, a * P[0][0] + b2 * P[1][0] + c2 * P[2][0] + e * P[3][0], w), lerp(fy, a * P[0][1] + b2 * P[1][1] + c2 * P[2][1] + e * P[3][1], w)

def G(x, y, z): return Vector((x, -z, y))  # game -> Blender (Z up, +Y forward); the glTF export turns it back

def edge_arc(t):
    hb, sy, d, n = hb_of(t), sheer(t), depth(t), n_of(t)
    r = min(0.08, hb * 0.25)
    s_r = math.asin(clamp(r / (sy + d), 0, 1) ** (n / 2)) * 2 / math.pi
    x_r, y_r = hull_point(t, s_r)
    yd = sy + CROWN * (1 - min(1, (x_r - r) / max(hb, 0.2)) ** 2)
    arc = [(x_r - r + r * math.cos(a), lerp(y_r, yd, math.sin(a))) for a in (math.pi / 2 * k / 4 for k in range(4, 0, -1))]
    return s_r, arc, x_r - r

def build_hull(bm, M):
    N, KH, KD = 160, 34, 12
    ss = lambda j: j / KH if j / KH <= SPLIT else SPLIT + (1 - SPLIT) * ((j / KH - SPLIT) / (1 - SPLIT)) ** 1.15
    rings = []
    for i in range(N + 1):
        t = min(0.997, (i / N) ** 0.85); z = z_at(t)
        s_r, arc, xd = edge_arc(t)
        ring = [G(x, y, z) for x, y in arc]
        for j in range(KH + 1):
            x, y = hull_point(t, ss(j) if j else s_r); ring.append(G(x, y, z))
        for j in range(KH - 1, -1, -1):
            x, y = hull_point(t, ss(j) if j else s_r); ring.append(G(-x, y, z))
        ring += [G(-x, y, z) for x, y in reversed(arc)]
        nh = len(ring)
        for k in range(-(KD - 1), KD):
            x = xd * k / KD; ring.append(G(x, deck_y(z, x), z))
        rings.append([bm.verts.new(p) for p in ring])
    R = len(rings[0])
    for i in range(N):
        a, b = rings[i], rings[i + 1]
        for j in range(R):
            bm.faces.new((a[j], a[(j + 1) % R], b[(j + 1) % R], b[j])).material_index = M['hull'] if j < nh - 1 else M['deck']
    for r in (rings[0], rings[-1]): bm.faces.new(r).material_index = M['hull']
    return rings[0]

# the bustle, on boats3d.js's curve: its keel line a quadratic from the hull's bottom 6 m aft of amidships, down to
# 0.75 m under it, up again 6 m forward; a rounded fin 0.48 m wide, narrowing to its ends, rising into the hull
def build_bustle(bm, M):
    NZ, top = 48, -0.1
    bez = lambda s: ((1 - s) ** 2 * -5.5 + s * s * 6.5, 2 * s * (1 - s) * -0.75 + s * s * -0.1)  # (shape x, shape y)
    secs = []
    for i in range(NZ + 1):
        s = i / NZ
        sx, sy = bez(s)
        z, yb = -sx + 0.5, sy - 0.48
        w = 0.24 * math.sin(math.pi * clamp(s * 1.02, 0, 1)) ** 0.35 + 0.01
        prof = [(w, top), (w, lerp(top, yb, 0.6)), (w * 0.85, yb + 0.07), (w * 0.45, yb + 0.01)]
        ring = [G(x, y, z) for x, y in prof] + [G(0, yb, z)] + [G(-x, y, z) for x, y in reversed(prof)]
        secs.append([bm.verts.new(p) for p in ring])
    R = len(secs[0])
    for i in range(NZ):
        for j in range(R):
            bm.faces.new((secs[i][j], secs[i][(j + 1) % R], secs[i + 1][(j + 1) % R], secs[i + 1][j])).material_index = M['hull']
    bm.faces.new(list(reversed(secs[0]))).material_index = M['hull']
    bm.faces.new(secs[-1]).material_index = M['hull']

def plan_prism(bm, outline, y0, y1, ms, mb, mt):
    lo = [bm.verts.new(G(x, y0, z)) for x, z in outline]; hi = [bm.verts.new(G(x, y1, z)) for x, z in outline]
    n = len(outline)
    for k in range(n): bm.faces.new((lo[k], lo[(k + 1) % n], hi[(k + 1) % n], hi[k])).material_index = ms
    bm.faces.new(list(reversed(lo))).material_index = mb; bm.faces.new(hi).material_index = mt
def rounded_rect(x0, x1, z0, z1, r, seg=6):
    pts = []
    for (cx, cz), (sx, sz), k in [((x1, z0), (-1, 1), 0), ((x1, z1), (-1, -1), 1), ((x0, z1), (1, -1), 2), ((x0, z0), (1, 1), 3)]:
        ox, oz = cx + sx * r, cz + sz * r
        a0 = [math.pi * 1.5, 0, math.pi / 2, math.pi][k]
        for i in range(seg + 1):
            a = a0 + (math.pi / 2) * i / seg
            pts.append((ox + r * math.cos(a), oz + r * math.sin(a)))
    return pts
def material(name, color, rough=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1); p.inputs['Roughness'].default_value = rough
    return m

for o in list(bpy.data.objects): bpy.data.objects.remove(o)
MAT = {'hull': material('hull', (0.1, 0.1, 0.11), 0.3), 'deck': material('deck', (0.17, 0.18, 0.2), 0.55),
       'pod': material('pod', (0.23, 0.25, 0.27), 0.6), 'rubber': material('rubber', (0.08, 0.09, 0.1), 0.9)}
ORDER = ['hull', 'deck', 'pod', 'rubber']
IDX = {m: i for i, m in enumerate(ORDER)}
def new_object(nm):
    me = bpy.data.meshes.new(nm); ob = bpy.data.objects.new(nm, me); bpy.context.scene.collection.objects.link(ob)
    for m in ORDER: me.materials.append(MAT[m])
    return ob

hull = new_object('ac75')
bm = bmesh.new(); transom = build_hull(bm, IDX); build_bustle(bm, IDX)
# the transom's edge turned round a 4 cm radius rather than left a knife edge
tv = set(transom)
bmesh.ops.bevel(bm, geom=list({e for v in transom for e in v.link_edges if all(w in tv for w in e.verts)}), offset=0.04, offset_type='OFFSET',
                segments=3, profile=0.5, affect='EDGES', clamp_overlap=True)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(hull.data); bm.free()

# the eight pods (boats3d.js), cut 0.9 m down from the deck at their middles: their walls and rubber floors
cut = new_object('pods'); bm = bmesh.new()
for sx in (-1, 1):
    for z0, z1 in ((-0.6, 0.8), (1.6, 3.0), (3.8, 5.2), (7.4, 9.2)):
        x0, x1 = (-2.05, -1.05) if sx < 0 else (1.05, 2.05)
        plan_prism(bm, rounded_rect(x0, x1, z0, z1, 0.22), sheer(t_at((z0 + z1) / 2)) - 0.9, 3.0, IDX['pod'], IDX['rubber'], IDX['pod'])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(cut.data); bm.free()
mod = hull.modifiers.new('pods', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut; mod.solver = 'EXACT'
mod.use_self = True   # the hull and the bustle are two shells: merge them as it cuts
try: mod.material_mode = 'TRANSFER'
except Exception as e: print('material_mode:', e)
bpy.context.view_layer.objects.active = hull; bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cut)

# a pocket let into each side where the foil arm comes out of the hull, round its bearing (boats3d.js A.ARM: the
# pivot 2.35 m out, 0.85 up, 0.6 forward of amidships): an oval 1.4 m long and 1 m tall, 10 cm deep, lined dark
cut = new_object('pockets'); bm = bmesh.new()
for sx in (-1, 1):
    tp = t_at(-0.6); xs = round_pt(tp, math.asin(clamp((sheer(tp) - 0.85) / (sheer(tp) + depth(tp)), 0, 1) ** (n_of(tp) / 2)) * 2 / math.pi)[0]
    ring = [(0.85 + 0.5 * math.sin(2 * math.pi * k / 20), -0.6 + 0.7 * math.cos(2 * math.pi * k / 20)) for k in range(20)]
    a = [bm.verts.new(G(sx * (xs - 0.1), y, z)) for y, z in ring]; b = [bm.verts.new(G(sx * (xs + 0.6), y, z)) for y, z in ring]
    for k in range(20): bm.faces.new((a[k], a[(k + 1) % 20], b[(k + 1) % 20], b[k])).material_index = IDX['pod']
    bm.faces.new(list(reversed(a))).material_index = IDX['pod']; bm.faces.new(b).material_index = IDX['pod']
bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(cut.data); bm.free()
mod = hull.modifiers.new('pockets', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut; mod.solver = 'EXACT'
try: mod.material_mode = 'TRANSFER'
except Exception as e: print('material_mode:', e)
bpy.context.view_layer.objects.active = hull; bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cut)

bm = bmesh.new(); bm.from_mesh(hull.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(hull.data); bm.free()
bpy.ops.object.select_all(action='DESELECT'); hull.select_set(True); bpy.context.view_layer.objects.active = hull
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(34))
me = hull.data
print('verts', len(me.vertices), 'tris', sum(len(p.vertices) - 2 for p in me.polygons), 'mats', [m.name for m in me.materials])
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                          export_texcoords=False, export_normals=True, export_materials='EXPORT', export_extras=False,
                          export_animations=False, export_skins=False, export_morph=False, export_cameras=False, export_lights=False)
print('wrote', OUT, os.path.getsize(OUT))
