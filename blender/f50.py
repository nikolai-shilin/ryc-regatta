# Regatta: the F50's moulded platform (game/boats3d.js F50View), modelled here and exported to game/f50.glb: her two
# hulls, each a long slim tube with a domed deck and a rounded bullet nose, its bottom rockered up to the transom, the
# cockpit well aft in each where the crew stand; the main beam across at the wing's step, faired to a thick foil section
# as the photographs show it; a lighter beam aft; the central pod (her batteries' housing) forward from the main beam to
# the jib's tack; the nets between the hulls from one beam to the other. The boards, the rudders, the wing and the jib,
# the wheels and pedestals, the fittings and the crew stay in boats3d.js (they move, or are made per boat).
#
# Her size from the class (15 m hulls, 8.8 m across the boards' tips; the AC50 she came from 8.47 m over the hulls) and
# her proportions from photographs of the boats racing (2019 to 2026, Wikimedia Commons): the hull some 1.0 m wide and 1.3 m from the keel
# to the top of the deck amidships, the nose round in plan and in profile; the wing stepped near amidships, its
# leading edge some 7.4 m aft of the bows; the jib's tack on the pod 3.4 m aft of them; the crew aft of the wing.
#
# The hulls follow boats3d.js's lines for her (F: hullOf with her half-breadth, sheer, depth and sections), so her
# number, name and logo still lie on them, and the cockpits are where its wheels, pedestals and crew expect them.
#
# Materials by name, which boats3d.js swaps for its own: hull (her paint: the hulls, beams and pod; the undersides
# darker), deck (the hulls' tops), pod (the cockpits' walls), rubber (their floors), net (the trampolines). No UVs:
# boats3d.js lays the deck's out from the plan.
#
#   blender -b --factory-startup -P blender/f50.py
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'public', 'game', 'f50.glb'))

L, HX = 15.0, 3.7          # the hulls' length; their centres either side of hers
STERN = L / 2
FLARE, CROWN = 0.03, 0.1
NOSE, NOSE_Y = 0.86, 0.42  # where the nose starts rounding off, and the height its tip comes to
def clamp(v, a, b): return max(a, min(b, v))
def lerp(a, b, t): return a + (b - a) * t
def smooth(e0, e1, x): t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
# the same lines as boats3d.js F (t = 0 at the transom, 1 at the nose's tip)
def nose(t): return math.sqrt(max(0.0, 1 - ((t - NOSE) / (1 - NOSE)) ** 2)) if t > NOSE else 1.0
def hb_of(t): return 0.5 * (1 - 0.16 * smooth(0.45, NOSE, t)) * (0.9 + 0.1 * smooth(0, 0.2, t)) * nose(t)
def sheer(t): return NOSE_Y + (1.0 + 0.06 * math.sin(math.pi * t) - NOSE_Y) * nose(t)
def depth(t): return (NOSE_Y + 0.18 + 0.27 * math.sin(math.pi * min(1, t / 1.1)) ** 0.8) * nose(t) - NOSE_Y
def n_of(t): return 2.5
def z_at(t): return STERN - t * L
def t_at(z): return clamp((STERN - z) / L, 0, 1)
def deck_y(z, x=0.0):
    hb = max(hb_of(t_at(z)), 0.12)
    return sheer(t_at(z)) + CROWN * nose(t_at(z)) * (1 - min(1, abs(x) / hb) ** 2)
def round_pt(t, s):
    hb, sy, d, n = hb_of(t), sheer(t), depth(t), n_of(t)
    phi = s * math.pi / 2; c, sn = math.cos(phi), math.sin(phi); yr = sn ** (2 / n)
    return hb * c ** (2 / n) * (1 - FLARE * sn), sy - (sy + d) * yr

def G(x, y, z): return Vector((x, -z, y))  # game -> Blender (Z up, +Y forward); the glTF export turns it back

# a hull at x = cx: its sections from the transom to the nose, the topsides and bottom one round section, the deck's
# edge turned round a radius into the domed deck
def edge_arc(t):
    hb, sy, d, n = hb_of(t), sheer(t), depth(t), n_of(t)
    r = min(0.07, hb * 0.3)
    s_r = math.asin(clamp(r / max(sy + d, 1e-4), 0, 1) ** (n / 2)) * 2 / math.pi
    x_r, y_r = round_pt(t, s_r)
    yd = deck_y(z_at(t), x_r - r)
    arc = [(x_r - r + r * math.cos(a), lerp(y_r, yd, math.sin(a))) for a in (math.pi / 2 * k / 4 for k in range(4, 0, -1))]
    return s_r, arc, x_r - r
def build_hull(bm, M, cx):
    KH, KD = 18, 6
    # the stations: evenly along her to where the nose starts, then round it by equal angles, so the tip closes to a
    # point and not a flat end
    ts = [NOSE * i / 64 for i in range(64)] + [NOSE + (1 - NOSE) * math.sin(0.5 * math.pi * k / 14) for k in range(14)]
    N = len(ts) - 1
    rings = []
    for t in ts:
        z = z_at(t)
        s_r, arc, xd = edge_arc(t)
        ring = [G(cx + x, y, z) for x, y in arc]
        for j in range(KH + 1):
            x, y = round_pt(t, j / KH if j else s_r); ring.append(G(cx + x, y, z))
        for j in range(KH - 1, -1, -1):
            x, y = round_pt(t, j / KH if j else s_r); ring.append(G(cx - x, y, z))
        ring += [G(cx - x, y, z) for x, y in reversed(arc)]
        nh = len(ring)
        for k in range(-(KD - 1), KD):
            x = xd * k / KD; ring.append(G(cx + x, deck_y(z, x), z))
        rings.append([bm.verts.new(p) for p in ring])
    R = len(rings[0])
    for i in range(N):
        a, b = rings[i], rings[i + 1]
        for j in range(R):
            bm.faces.new((a[j], a[(j + 1) % R], b[(j + 1) % R], b[j])).material_index = M['hull'] if j < nh - 1 else M['deck']
    bm.faces.new(list(reversed(rings[0]))).material_index = M['hull']  # the transom
    tip = bm.verts.new(G(cx, NOSE_Y, z_at(1)))                          # the nose's tip: a point
    last = rings[-1]
    for j in range(R): bm.faces.new((last[j], last[(j + 1) % R], tip)).material_index = M['hull']
    return rings[0]

# a beam across between the hulls: a foil section (chord fore and aft, thick up and down) at z, its middle y up, its
# ends buried in the hulls' inner sides
def naca(x): return 5 * (0.2969 * math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)
def build_beam(bm, M, z, y, chord, th, n=14, span=24):
    sec = [((1 + math.cos(math.pi * i / n)) / 2, 1) for i in range(n + 1)] + [((1 - math.cos(math.pi * i / n)) / 2, -1) for i in range(1, n)]
    ends = HX - 0.15
    rows = []
    for k in range(span + 1):
        x = lerp(-ends, ends, k / span)
        rows.append([bm.verts.new(G(x, y + sd * naca(u) * th * chord, z + (u - 0.45) * chord)) for u, sd in sec])
    m = len(sec)
    for k in range(span):
        for i in range(m):
            bm.faces.new((rows[k][i], rows[k][(i + 1) % m], rows[k + 1][(i + 1) % m], rows[k + 1][i])).material_index = M['hull']
    bm.faces.new(list(reversed(rows[0]))).material_index = M['hull']; bm.faces.new(rows[-1]).material_index = M['hull']

# the pod: a body of revolution forward along her middle from inside the main beam to its rounded nose at the jib's
# tack, thickest aft
def build_pod(bm, M, z0, z1, y, r0, r1, seg=20, n=40):
    rows = []
    for i in range(n + 1):
        s = i / n; z = lerp(z0, z1, s)
        r = lerp(r0, r1, s ** 0.8) * (math.sqrt(max(0.0, 1 - ((s - 0.9) / 0.1) ** 2)) if s > 0.9 else 1.0)
        rows.append([bm.verts.new(G(r * math.cos(2 * math.pi * k / seg), y + r * math.sin(2 * math.pi * k / seg) * 0.85, z)) for k in range(seg)])
    for i in range(n):
        for k in range(seg):
            bm.faces.new((rows[i][k], rows[i][(k + 1) % seg], rows[i + 1][(k + 1) % seg], rows[i + 1][k])).material_index = M['hull']
    bm.faces.new(list(reversed(rows[0]))).material_index = M['hull']
    tip = bm.verts.new(G(0, y, z1))
    for k in range(seg): bm.faces.new((rows[-1][k], rows[-1][(k + 1) % seg], tip)).material_index = M['hull']

# the nets: between the hulls' inner sides at the deck, from the main beam's trailing edge to the aft beam's leading edge
def build_net(bm, M, z0, z1, y, n=24):
    rows = []
    for i in range(n + 1):
        z = lerp(z0, z1, i / n); x = HX - hb_of(t_at(z)) * 0.92
        rows.append((bm.verts.new(G(-x, y, z)), bm.verts.new(G(x, y, z))))
    for i in range(n): bm.faces.new((rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0])).material_index = M['net']

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
       'pod': material('pod', (0.23, 0.25, 0.27), 0.6), 'rubber': material('rubber', (0.08, 0.09, 0.1), 0.9),
       'net': material('net', (0.35, 0.37, 0.4), 0.9)}
ORDER = ['hull', 'deck', 'pod', 'rubber', 'net']
IDX = {m: i for i, m in enumerate(ORDER)}
def new_object(nm):
    me = bpy.data.meshes.new(nm); ob = bpy.data.objects.new(nm, me); bpy.context.scene.collection.objects.link(ob)
    for m in ORDER: me.materials.append(MAT[m])
    return ob

# the two hulls, each with its transom's edge turned round a 3 cm radius
hulls = new_object('f50'); bm = bmesh.new()
for cx in (-HX, HX):
    transom = build_hull(bm, IDX, cx); tv = set(transom)
    bmesh.ops.bevel(bm, geom=list({e for v in transom for e in v.link_edges if all(w in tv for w in e.verts)}), offset=0.03, offset_type='OFFSET',
                    segments=3, profile=0.5, affect='EDGES', clamp_overlap=True)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(hulls.data); bm.free()

# the cockpits (boats3d.js F.COCKPIT), one in each hull, 0.6 m wide, sunk 0.8 m below the deck (the crew stand in them
# with only their heads and shoulders above it, as the photographs show them): walls and floors
COCKPIT = (STERN - 6.9, STERN - 2.3)
cut = new_object('cockpits'); bm = bmesh.new()
for cx in (-HX, HX):
    plan_prism(bm, rounded_rect(cx - 0.3, cx + 0.3, COCKPIT[0], COCKPIT[1], 0.15), sheer(t_at(sum(COCKPIT) / 2)) - 0.8, 3.0, IDX['pod'], IDX['rubber'], IDX['pod'])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(cut.data); bm.free()
mod = hulls.modifiers.new('cockpits', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut; mod.solver = 'MANIFOLD'  # (EXACT loses the hulls here)
try: mod.material_mode = 'TRANSFER'
except Exception as e: print('material_mode:', e)
bpy.context.view_layer.objects.active = hulls; bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cut)

# the platform: the main beam at the wing's step (boats3d.js F.MAST_Z), the aft beam, the pod and the nets
MAIN_Z, AFT_Z, TACK_Z = -STERN + 7.4, STERN - 1.0, -STERN + 3.4
plat = new_object('platform'); bm = bmesh.new()
build_beam(bm, IDX, MAIN_Z + 0.25, 0.9, 1.5, 0.27)
build_beam(bm, IDX, AFT_Z, 0.9, 0.6, 0.34)
build_pod(bm, IDX, MAIN_Z, TACK_Z, 0.9, 0.3, 0.13)
build_net(bm, IDX, MAIN_Z + 0.25 + 0.55 * 1.5, AFT_Z - 0.45 * 0.6, 0.97)
bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if f.material_index != IDX['net']]); bm.to_mesh(plat.data); bm.free()

bpy.ops.object.select_all(action='DESELECT')
for o in (hulls, plat): o.select_set(True)
bpy.context.view_layer.objects.active = hulls; bpy.ops.object.join()
bm = bmesh.new(); bm.from_mesh(hulls.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.to_mesh(hulls.data); bm.free()
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(34))
me = hulls.data
print('verts', len(me.vertices), 'tris', sum(len(p.vertices) - 2 for p in me.polygons), 'mats', [m.name for m in me.materials])
# a look at her for the record, when asked (F50_SHOT=path.png): from forward and above her starboard bow
if os.environ.get('F50_SHOT'):
    sc = bpy.context.scene
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.rotation_euler = (0.6, 0.3, 0.8)
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.render.resolution_x, sc.render.resolution_y = 1200, 800
    for k, at in enumerate((G(13, 9, -14), G(-24, 0.6, 0.5))): # from forward and above her starboard bow; square on her port side
        cam.location = at; cam.rotation_euler = (G(0, 0.5, 0) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.environ['F50_SHOT'].replace('.png', f'-{k}.png'); bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam); bpy.data.objects.remove(sun)
bpy.ops.object.select_all(action='DESELECT'); hulls.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                          export_texcoords=False, export_normals=True, export_materials='EXPORT', export_extras=False,
                          export_animations=False, export_skins=False, export_morph=False, export_cameras=False, export_lights=False)
print('wrote', OUT, os.path.getsize(OUT))
