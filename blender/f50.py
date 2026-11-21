# Regatta: the F50's moulded platform (game/boats3d.js F50View), modelled here and exported to game/f50.glb: her two
# hulls, each a long slim hull of rounded sections, narrowing over its forward half to a low rounded nose, its deck sloping down
# to it, aft its sides drawing in to a small upright transom, the bottom rising to both ends, the
# cockpit well aft in each where the crew stand; the main beam across at the wing's step, a slim faired tube flaring
# into the hulls at its roots, as the photographs show it; an open truss aft; the central pod (her batteries' housing) forward from the main beam to
# the jib's tack, braced to the hulls by a rod either side under the beam; the nets between the hulls from one beam to the other. The boards, the rudders, the wing and the jib,
# the wheels and pedestals, the fittings and the crew stay in boats3d.js (they move, or are made per boat).
#
# Her size from the class (15 m hulls, 8.8 m across the boards' tips; the AC50 she came from 8.47 m over the hulls) and
# her shape from the class's profile drawing (Wikimedia Commons, F50 Catamaran.png) and from photographs of the boats
# racing (2019 to 2026, Wikimedia Commons), measured against her 15 m hulls: each hull some 1.0 m wide and 1.2 m from
# the bottom to the deck amidships, 0.9 m at the transom, where the bottom has risen 0.3 m; the deck level until 2.7 m
# from the bow and then drooping in a long curve to the nose, which comes down nearly to the bottom, at the waterline;
# the bottom straight to within a metre of it, the hull rounding off in plan over the last 1.5 m; the wing stepped near
# amidships, its leading edge some 7.4 m aft of the bows; the jib's tack on the pod 3.2 m aft of them; the crew aft.
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
FLARE, CROWN = 0.02, 0.1
DECK, BOTTOM, NOSE_Y = 0.85, -0.38, 0.15   # the deck and the bottom amidships, and the height of the nose's rounded tip
TIP = 0.94                                 # where the nose's rounded tip begins (0.9 m from it)
AFT = 0.14                                 # the stern narrowing in plan over its last 2.1 m to a small transom, as the photographs show it
def clamp(v, a, b): return max(a, min(b, v))
def lerp(a, b, t): return a + (b - a) * t
def smooth(e0, e1, x): t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
# the same lines as boats3d.js F (t = 0 at the transom, 1 at the nose's tip)
def ell(t, t0): return math.sqrt(max(0.0, 1 - ((t - t0) / (1 - t0)) ** 2)) if t > t0 else 1.0  # a quarter ellipse to the tip
def aft(t): return 1 - 0.45 * (1 - t / AFT) ** 1.6 if t < AFT else 1.0  # the sides drawing in to a transom 55% of her width
# in plan: full amidships, then narrowing steadily over her forward half to a rounded tip; aft, the sides drawing in to
# a small, flat, upright transom shaped like a rounded shield (its corners rounded, its top crowned)
def hb_of(t): return 0.5 * (0.92 + 0.08 * smooth(0, 0.3, t)) * (1 - 0.5 * smooth(0.45, 0.97, t)) * ell(t, TIP) * aft(t)
# in profile: the deck level aft, sloping down over her forward 40% to some 0.6 m, then rounding down to the nose;
# the bottom straight amidships, rising 0.3 m aft to the transom and some 0.25 m forward before rounding up to the nose
def deck0(t): return DECK + 0.02 * math.sin(math.pi * t) - 0.27 * smooth(0.55, TIP, t)
def bot0(t): return BOTTOM + 0.3 * (1 - smooth(0, 0.5, t)) + 0.25 * smooth(0.7, TIP, t)
def sheer(t): return NOSE_Y + (deck0(t) - NOSE_Y) * ell(t, TIP)
def bottom(t): return NOSE_Y - (NOSE_Y - bot0(t)) * ell(t, TIP)
def depth(t): return -bottom(t)
def n_of(t): return lerp(2.4, 2.7, smooth(0, 0.15, t)) if t < 0.4 else lerp(2.7, 2.2, smooth(0.4, 0.9, t))  # a rounded box, rounder at the transom and forward
def crown(t): return CROWN * (1 - 0.6 * smooth(0.6, 1, t))
def z_at(t): return STERN - t * L
def t_at(z): return clamp((STERN - z) / L, 0, 1)
def deck_y(z, x=0.0):
    hb = max(hb_of(t_at(z)), 0.12)
    return sheer(t_at(z)) + crown(t_at(z)) * (1 - min(1, abs(x) / hb) ** 2)
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
    ts = [AFT * i / 14 for i in range(14)] + [lerp(AFT, TIP, i / 58) for i in range(58)] \
         + [TIP + (1 - TIP) * math.sin(0.5 * math.pi * k / 16) for k in range(16)]
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

# the main beam, as she shows it head-on: a slim faired tube across at deck height, its section an ellipse (chord fore
# and aft, depth up and down), flaring at each root into a smooth fairing on the hull's inboard topside
def build_main_beam(bm, M, z, y, chord, depth, seg=20, span=40):
    ends = HX - 0.15
    rows = []
    for k in range(span + 1):
        x = lerp(-ends, ends, k / span); r = smooth(ends - 1.0, ends, abs(x))  # the root's flare, over its last metre
        a, b, yc = chord / 2 * (1 + 1.3 * r), depth / 2 * (1 + 0.6 * r), y + 0.08 * r
        rows.append([bm.verts.new(G(x, yc + b * math.sin(2 * math.pi * j / seg), z + a * math.cos(2 * math.pi * j / seg) * (0.85 if math.cos(2 * math.pi * j / seg) < 0 else 1.15))) for j in range(seg)])
    for k in range(span):
        for j in range(seg): bm.faces.new((rows[k][j], rows[k][(j + 1) % seg], rows[k + 1][(j + 1) % seg], rows[k + 1][j])).material_index = M['hull']
    bm.faces.new(list(reversed(rows[0]))).material_index = M['hull']; bm.faces.new(rows[-1]).material_index = M['hull']

# the pod: a body of revolution forward along her middle from inside the main beam to its rounded nose at the jib's
# tack, thickest aft
def build_pod(bm, M, z0, z1, y, r0, r1, seg=24, n=40):
    # its section a teardrop, as she shows it head-on: rounded on top, deep and narrowing to a keel below
    def sec(a, r):
        c, s = math.cos(a), math.sin(a)
        return (r * c * (0.85 if s >= 0 else 0.85 * (1 + s) ** 0.6 + 0.02), r * (0.55 * s if s >= 0 else 2.2 * s))
    rows = []
    for i in range(n + 1):
        s = i / n; z = lerp(z0, z1, s)
        r = lerp(r0, r1, s ** 0.8) * (math.sqrt(max(0.0, 1 - ((s - 0.9) / 0.1) ** 2)) if s > 0.9 else 1.0)
        rows.append([bm.verts.new(G(*(lambda p: (p[0], y + p[1]))(sec(2 * math.pi * k / seg, r)), z)) for k in range(seg)])
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

# the aft beam: an open truss between the hulls, as the photographs of her on the crane show it: two tubes one above the
# other, their ends in the hulls, and diagonals between them
def tube_between(bm, M, a, b, r, seg=8):
    a, b = Vector(a), Vector(b); d = (b - a).normalized()
    u = d.cross(Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))).normalized(); w = d.cross(u)
    ra = [bm.verts.new(a + r * (math.cos(2 * math.pi * k / seg) * u + math.sin(2 * math.pi * k / seg) * w)) for k in range(seg)]
    rb = [bm.verts.new(b + r * (math.cos(2 * math.pi * k / seg) * u + math.sin(2 * math.pi * k / seg) * w)) for k in range(seg)]
    for k in range(seg): bm.faces.new((ra[k], ra[(k + 1) % seg], rb[(k + 1) % seg], rb[k])).material_index = M['pod']
    bm.faces.new(list(reversed(ra))).material_index = M['pod']; bm.faces.new(rb).material_index = M['pod']
def build_truss(bm, M, z, y0, y1, n=8):
    ends = HX - 0.2
    for y in (y0, y1): tube_between(bm, M, G(-ends, y, z), G(ends, y, z), 0.06)
    for k in range(n):
        xa, xb = lerp(-ends, ends, k / n), lerp(-ends, ends, (k + 1) / n)
        tube_between(bm, M, G(xa, y0 if k % 2 else y1, z), G(xb, y1 if k % 2 else y0, z), 0.025)

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

# the cockpits' fairings: a low streamlined cowl on the deck at each one's forward end, in front of the crew (the
# photographs show it), clear of the main beam's root: 0.9 m long, 0.56 m wide and 0.24 m high, its nose rounded and its
# tail running over the cockpit's forward end
fair = new_object('fairings'); bm = bmesh.new()
for cx in (-HX, HX):
    z0, z1, n, seg = COCKPIT[0] - 0.15, COCKPIT[0] + 0.75, 16, 14
    rows = []
    for i in range(n + 1):
        s = i / n; z = lerp(z0, z1, s); k = math.sin(math.pi * min(1, s / 0.7) / 2) * (1 - 0.15 * s)
        yb = deck_y(z) - 0.04
        rows.append([bm.verts.new(G(cx + 0.28 * k * math.cos(math.pi * j / seg), yb + 0.24 * k * math.sin(math.pi * j / seg), z)) for j in range(seg + 1)])
    for i in range(n):
        for j in range(seg): bm.faces.new((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j])).material_index = IDX['pod']
    bm.faces.new(rows[-1]).material_index = IDX['pod']
bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(fair.data); bm.free()

# the platform: the main beam at the wing's step (boats3d.js F.MAST_Z), the aft truss, the pod and its rods, the nets
MAIN_Z, AFT_Z, TACK_Z = -STERN + 7.4, STERN - 1.0, -STERN + 3.2
plat = new_object('platform'); bm = bmesh.new()
build_main_beam(bm, IDX, MAIN_Z + 0.25, 0.86, 0.6, 0.38)
build_truss(bm, IDX, AFT_Z, 0.42, 0.9)
# under the main beam, the pod braced to the hulls: a rod from its keel to each hull's inboard side at the beam's root
for sx in (-1, 1): tube_between(bm, IDX, G(0, 0.82 - 0.45 * 2.2 + 0.08, MAIN_Z + 0.1), G(sx * (HX - 0.42), 0.62, MAIN_Z + 0.25), 0.03)
build_pod(bm, IDX, MAIN_Z + 0.1, TACK_Z, 0.82, 0.45, 0.13)
build_net(bm, IDX, MAIN_Z + 0.25 + 0.36, AFT_Z - 0.1, 0.85)
bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if f.material_index != IDX['net']]); bm.to_mesh(plat.data); bm.free()

bpy.ops.object.select_all(action='DESELECT')
for o in (hulls, plat, fair): o.select_set(True)
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
    for k, at in enumerate((G(13, 9, -14), G(-45, 0.3, 0), G(3, 2.5, -13))): # above her starboard bow; square on her port side; her bows close
        cam.location = at; cam.rotation_euler = (G(0, 0.5, 0) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.environ['F50_SHOT'].replace('.png', f'-{k}.png'); bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam); bpy.data.objects.remove(sun)
bpy.ops.object.select_all(action='DESELECT'); hulls.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                          export_texcoords=False, export_normals=True, export_materials='EXPORT', export_extras=False,
                          export_animations=False, export_skins=False, export_morph=False, export_cameras=False, export_lights=False)
print('wrote', OUT, os.path.getsize(OUT))
