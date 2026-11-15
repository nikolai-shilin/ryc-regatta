# Regatta: the Laser's moulded hull and deck (game/boats3d.js LaserView), modelled here and exported to
# game/laser.glb: the hull, its deck edge turned round a small radius onto the flange of the hull-to-deck joint that runs
# round the boat just under it, the crowned deck, the cockpit well cut down to its floor, and the daggerboard's slot cut
# through deck and hull. The daggerboard, the rudder, the spars, the sail, the fittings and the sailor stay in boats3d.js.
#
# The hull follows boats3d.js's lines for her (LZ: hullOf with her half-breadth, sheer, depth and sections), so the
# logo and name decals still lie on it; the deck, the cockpit's outline and floor (LZ.CK, LZ.FLOOR) and the
# daggerboard's slot are where its fittings and the sailor expect them.
#
# Materials by name, which boats3d.js swaps for its own: hull (the paint and antifouling drawn by its shader), deck
# (non-skid or the player's deck), gel (the flange and the slot's lining). No UVs: boats3d.js lays the deck's out from
# the plan.
#
#   blender -b --factory-startup -P blender/laser.py
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'public', 'game', 'laser.glb'))

# ---------- boats3d.js's lines for her (game frame: +x starboard, +y up, -z forward, the waterline at y = 0) ----------
L, B = 4.19, 1.39
STERN = L / 2
FLARE = 0.06
def clamp(v, a, b): return max(a, min(b, v))
def lerp(a, b, t): return a + (b - a) * t
def hb_of(t):
    if t < 0.5: return (B / 2) * (0.72 + 0.28 * math.sin((t / 0.5) * math.pi / 2))
    return (B / 2) * max(0.0, math.cos(min(1, (t - 0.5) / 0.5) * math.pi / 2)) ** 0.72
def sheer(t): return 0.3 + 0.07 * t ** 1.6
def depth(t): return 0.13 * math.sin(math.pi * min(1, t * 0.93 + 0.05)) ** 0.7
def n_of(t): return lerp(2.6, 1.9, clamp((t - 0.4) / 0.6, 0, 1))
def z_at(t): return STERN - t * L
def t_at(z): return clamp((STERN - z) / L, 0, 1)
CROWN = 0.05
def deck_y(z, x=0.0):  # the deck: the sheer, crowned as boats3d.js's deck() crowns it
    hb = max(hb_of(t_at(z)), 0.2)
    return sheer(t_at(z)) + CROWN * (1 - min(1, abs(x) / hb) ** 2)
def hull_point(t, s):  # hullOf's round section: s = 0 at the deck edge ... 1 at the keel
    hb, sy, d, n = hb_of(t), sheer(t), depth(t), n_of(t)
    phi = s * math.pi / 2; c, sn = math.cos(phi), math.sin(phi); yr = sn ** (2 / n)
    return hb * c ** (2 / n) * (1 - FLARE * sn), sy - (sy + d) * yr

def G(x, y, z): return Vector((x, -z, y))  # game -> Blender (Z up, +Y forward); the glTF export turns it back

# the deck edge, outboard to in: down the topsides to the flange, out along its top, down its face, back in under it,
# then up round the deck edge's small radius onto the crowned deck
FL_OUT, FL_TOP, FL_H = 0.014, 0.022, 0.016          # the flange: how far it stands out, how far under the sheer, its depth
def edge(t):
    hb, sy, d, n = hb_of(t), sheer(t), depth(t), n_of(t)
    r = min(0.03, hb * 0.2)
    s_of = lambda dy: math.asin(clamp(dy / (sy + d), 0, 1) ** (n / 2)) * 2 / math.pi  # the section's s at dy under the sheer
    xr, yr = hull_point(t, s_of(r))                 # where the deck edge's radius meets the topsides
    xt, yt = hull_point(t, s_of(FL_TOP))
    xb, yb = hull_point(t, s_of(FL_TOP + FL_H))
    yd = sy + CROWN * (1 - min(1, (xr - r) / max(hb, 0.2)) ** 2)
    arc = [(xr - r + r * math.cos(a), lerp(yr, yd, math.sin(a))) for a in (math.pi / 2 * k / 4 for k in range(4, -1, -1))]
    # deck side first: the arc from the deck down to the topsides, then the flange
    pts = list(arc) + [(xt, yt), (xt + FL_OUT, yt), (xb + FL_OUT, yb), (xb, yb)]
    mats = ['hull'] * (len(arc) - 1) + ['hull', 'gel', 'gel', 'gel']  # the faces between successive points
    return pts, mats, s_of(FL_TOP + FL_H), xr - r

def build_hull(bm, M):
    N, KH, KD = 72, 20, 8
    rings, ring_mats = [], None
    for i in range(N + 1):
        t = min(0.997, (i / N) ** 0.85); z = z_at(t)
        pts, emats, s0, xd = edge(t)
        star = [(x, y) for x, y in pts] + [hull_point(t, s0 + (1 - s0) * (j / KH)) for j in range(1, KH + 1)]
        side_mats = emats + ['hull'] * KH
        ring = [G(x, y, z) for x, y in star] + [G(-x, y, z) for x, y in reversed(star[:-1])]
        mats = side_mats + list(reversed(side_mats))
        for k in range(-(KD - 1), KD):
            x = xd * k / KD; ring.append(G(x, deck_y(z, x), z))
        mats += ['deck'] * (2 * KD - 1) + ['deck']
        rings.append([bm.verts.new(p) for p in ring]); ring_mats = mats
    R = len(rings[0])
    for i in range(N):
        a, b = rings[i], rings[i + 1]
        for j in range(R):
            bm.faces.new((a[j], a[(j + 1) % R], b[(j + 1) % R], b[j])).material_index = M[ring_mats[j]]
    for r in (rings[0], rings[-1]): bm.faces.new(r).material_index = M['hull']  # the transom, the stem

# ---------- boxes ----------
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
def new_object(name):
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    for m in ORDER: me.materials.append(MAT[m])
    return ob
def cut_out(target, outline, y0, y1, side, bottom):
    cut = new_object('cut'); bm = bmesh.new()
    plan_prism(bm, outline, y0, y1, IDX[side], IDX[bottom], IDX[side])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(cut.data); bm.free()
    mod = target.modifiers.new('cut', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut; mod.solver = 'EXACT'
    try: mod.material_mode = 'TRANSFER'
    except Exception as e: print('material_mode:', e)
    bpy.context.view_layer.objects.active = target; bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cut)

for o in list(bpy.data.objects): bpy.data.objects.remove(o)
MAT = {'hull': material('hull', (0.92, 0.92, 0.9), 0.2), 'deck': material('deck', (0.8, 0.79, 0.75), 0.85),
       'gel': material('gel', (0.83, 0.84, 0.83), 0.45)}
ORDER = ['hull', 'deck', 'gel']
IDX = {m: i for i, m in enumerate(ORDER)}

hull = new_object('laser')
bm = bmesh.new(); build_hull(bm, IDX)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(hull.data); bm.free()

# the cockpit well (boats3d.js LZ.CK, LZ.FLOOR), its floor the deck's non-skid
CK0, CK1, FLOOR = 0.05, 1.55, 0.13
cut_out(hull, rounded_rect(-0.3, 0.3, CK0, CK1, 0.14), FLOOR, 1.0, 'gel', 'deck')
# the daggerboard's slot, through deck and hull just forward of the cockpit, lined
DBZ = CK0 - 0.2
cut_out(hull, rounded_rect(-0.018, 0.018, DBZ - 0.165, DBZ + 0.165, 0.012, seg=3), -0.5, 1.0, 'gel', 'gel')

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
