# Regatta: the J/70's and the RS21's moulded parts (game/boats3d.js SportView), modelled here and exported to
# game/j70.glb and game/rs21.glb: the hull with its chine aft and its deck edge turned round a radius, the crowned deck,
# the cockpit cut down to its floor and out through the open transom, and on the J/70 the cuddy forward of it, its
# sides leaning in, its top edge rounded and its front raked. The keel, the rudder, the rig, the sails, the fittings and
# the crew stay in boats3d.js (they move, or are made per boat).
#
# Each hull follows boats3d.js's lines for her (sport(RS): hullOf with her half-breadth, sheer, depth, sections and
# chine), so the logo, the sail number, the name, the toe rails and the rubbing strake it lays onto her still lie on it;
# the deck, the cockpit's outline and floor and the cuddy's footprint and top are where its fittings and crew expect them.
#
# Materials by name, which boats3d.js swaps for its own: hull (the paint, boot-top and antifouling drawn by its
# shader), deck (non-skid or the player's deck), gel (the cockpit's walls, the cuddy). No UVs: boats3d.js lays the
# deck's out from the plan.
#
#   blender -b --factory-startup -P blender/sportboats.py
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
def clamp(v, a, b): return max(a, min(b, v))
def lerp(a, b, t): return a + (b - a) * t
def smooth(e0, e1, x): t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def G(x, y, z): return Vector((x, -z, y))  # game -> Blender (Z up, +Y forward); the glTF export turns it back

def boat(RS):
    """boats3d.js sport(RS)'s lines, and where her cockpit and cuddy are"""
    L, B = (6.67, 2.2) if RS else (6.93, 2.25)
    S = {'L': L, 'STERN': L / 2, 'FLARE': 0.05 if RS else 0.03, 'CROWN': 0.03}
    def hb(t):
        if t < 0.42: return (B / 2) * ((0.8 if RS else 0.76) + (0.2 if RS else 0.24) * math.sin((t / 0.42) * math.pi / 2))
        return (B / 2) * max(0.0, math.cos(min(1, (t - 0.42) / 0.58) * math.pi / 2)) ** (0.7 if RS else 0.8)
    S['hb'] = hb
    S['sheer'] = (lambda t: 0.55 + 0.09 * t ** 1.8) if RS else (lambda t: 0.6 + 0.13 * t ** 1.6)
    S['depth'] = lambda t: (0.26 if RS else 0.3) * math.sin(math.pi * min(1, t * 0.93 + 0.05)) ** 0.75
    S['n'] = lambda t: lerp(2.9 if RS else 2.7, 1.7, clamp((t - 0.45) / 0.55, 0, 1))
    S['chine_y'] = lambda t: (0.13 if RS else 0.1) - 0.22 * t
    S['chine_w'] = lambda t: 1 - smooth(0.4 if RS else 0.28, 0.8 if RS else 0.64, t)
    S['dead'] = lambda t: lerp(12 if RS else 16, 7 if RS else 10, clamp(t / 0.35, 0, 1))
    S['ck'] = (-0.5 if RS else -0.35, 0.8 if RS else 0.74, 0.26 if RS else 0.3)   # the cockpit: its front, half-width, floor
    return S

def lines(S):
    L, STERN, FLARE, CROWN = S['L'], S['STERN'], S['FLARE'], S['CROWN']
    hb, sheer, depth, n_of = S['hb'], S['sheer'], S['depth'], S['n']
    z_at = lambda t: STERN - t * L
    t_at = lambda z: clamp((STERN - z) / L, 0, 1)
    def deck_y(z, x=0.0):
        h = max(hb(t_at(z)), 0.2)
        return sheer(t_at(z)) + CROWN * (1 - min(1, abs(x) / h) ** 2)
    def round_pt(t, s):
        h, sy, d, n = hb(t), sheer(t), depth(t), n_of(t)
        phi = s * math.pi / 2; c, sn = math.cos(phi), math.sin(phi); yr = sn ** (2 / n)
        return h * c ** (2 / n) * (1 - FLARE * sn), sy - (sy + d) * yr
    SPLIT = 0.5
    def hull_point(t, s):  # hullOf's section(): round above the chine, a curve to the flat of the keel below
        sy, d, n, w = sheer(t), depth(t), n_of(t), S['chine_w'](t)
        sc = math.asin(clamp((sy - S['chine_y'](t)) / (sy + d), 0, 1) ** (n / 2)) * 2 / math.pi
        sf = s / SPLIT * sc if s <= SPLIT else sc + (s - SPLIT) / (1 - SPLIT) * (1 - sc)
        fx, fy = round_pt(t, sf)
        if s <= SPLIT or w <= 0: return fx, fy
        xc, ycc = round_pt(t, sc)
        u = (s - SPLIT) / (1 - SPLIT); d2 = d * 0.85; dr = math.radians(S['dead'](t)); k = xc * 0.42
        P = [(xc, ycc), (xc - k * math.cos(dr), ycc - k * math.sin(dr)), (xc * 0.38, -d2), (0.0, -d2)]
        a, b2, c2, e = (1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3
        return lerp(fx, a * P[0][0] + b2 * P[1][0] + c2 * P[2][0] + e * P[3][0], w), lerp(fy, a * P[0][1] + b2 * P[1][1] + c2 * P[2][1] + e * P[3][1], w)
    def edge_arc(t):
        h, sy, d, n = hb(t), sheer(t), depth(t), n_of(t)
        r = min(0.04, h * 0.25)
        s_r = math.asin(clamp(r / (sy + d), 0, 1) ** (n / 2)) * 2 / math.pi
        x_r, y_r = hull_point(t, s_r)
        yd = sy + CROWN * (1 - min(1, (x_r - r) / max(h, 0.2)) ** 2)
        arc = [(x_r - r + r * math.cos(a), lerp(y_r, yd, math.sin(a))) for a in (math.pi / 2 * k / 4 for k in range(4, 0, -1))]
        return s_r, arc, x_r - r
    return z_at, t_at, deck_y, hull_point, edge_arc, SPLIT

def build_hull(bm, M, S):
    z_at, t_at, deck_y, hull_point, edge_arc, SPLIT = lines(S)
    N, KH, KD = 80, 24, 8
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

# the J/70's cuddy: lofted from its aft face (the cockpit's front) to its raked front, on boats3d.js's footprint (half
# its width a at za aft, f at zf forward, with the extrude's 4 cm bevel round it) and top (cudY + 0.2)
def build_cuddy(bm, M, S):
    z_at, t_at, deck_y, *_ = lines(S)
    CA, CF, CZA, CZF = 0.62 + 0.04, 0.4 + 0.04, -0.35 + 0.04, -2.0 - 0.04
    TOP = S['sheer'](t_at(-1.2)) - 0.02 + 0.2
    NZ = 36
    secs, zs = [], []
    for i in range(NZ + 1):
        z = lerp(CZA, CZF, (i / NZ) ** 0.95)
        w0 = lerp(CA, CF, clamp((CZA - z) / (CZA - CZF), 0, 1))
        rf = clamp((CZF + 0.3 - z) / 0.3, 0, 1); w0 *= math.sqrt(max(0.0, 1 - 0.6 * rf * rf))   # its front corners rounded
        yd = deck_y(z, w0)
        ht = TOP - (TOP - (deck_y(z) + 0.05)) * smooth(CZF + 0.45, CZF, z) ** 1.3            # the front, raked
        rr = 0.05
        wt = w0 - 0.06 * clamp((ht - yd) / 0.2, 0.2, 1)
        prof = [(w0, yd - 0.25), (w0, yd), (lerp(w0, wt, 0.5), lerp(yd, ht - rr, 0.5)), (wt, ht - rr), (wt - rr * 0.29, ht - rr * 0.29), (wt - rr, ht)]
        for x in (min(0.45, wt - rr - 0.03), 0.2): prof.append((x, ht + 0.012 * (1 - (x / wt) ** 2)))
        ring = [G(x, y, z) for x, y in prof] + [G(0, ht + 0.012, z)] + [G(-x, y, z) for x, y in reversed(prof)]
        secs.append([bm.verts.new(p) for p in ring]); zs.append(z)
    R = len(secs[0])
    for i in range(NZ):
        for j in range(R):
            bm.faces.new((secs[i][j], secs[i][(j + 1) % R], secs[i + 1][(j + 1) % R], secs[i + 1][j])).material_index = M['gel']
    bm.faces.new(list(reversed(secs[0]))).material_index = M['gel']
    bm.faces.new(secs[-1]).material_index = M['gel']

def plan_prism(bm, outline, y0, y1, ms, mb, mt):
    lo = [bm.verts.new(G(x, y0, z)) for x, z in outline]; hi = [bm.verts.new(G(x, y1, z)) for x, z in outline]
    n = len(outline)
    for k in range(n): bm.faces.new((lo[k], lo[(k + 1) % n], hi[(k + 1) % n], hi[k])).material_index = ms
    bm.faces.new(list(reversed(lo))).material_index = mb; bm.faces.new(hi).material_index = mt
def rounded_rect(x0, x1, z0, z1, r, corners=(1, 1, 1, 1), seg=6):
    pts = []
    for (cx, cz), (sx, sz), k in [((x1, z0), (-1, 1), 0), ((x1, z1), (-1, -1), 1), ((x0, z1), (1, -1), 2), ((x0, z0), (1, 1), 3)]:
        if not corners[k]: pts.append((cx, cz)); continue
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

ORDER = ['hull', 'deck', 'gel']
IDX = {m: i for i, m in enumerate(ORDER)}
for RS, name in ((False, 'j70'), (True, 'rs21')):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)
    MAT = {'hull': material('hull', (0.92, 0.92, 0.9), 0.2), 'deck': material('deck', (0.8, 0.79, 0.75), 0.85),
           'gel': material('gel', (0.9, 0.89, 0.86), 0.3)}
    def new_object(nm):
        me = bpy.data.meshes.new(nm); ob = bpy.data.objects.new(nm, me); bpy.context.scene.collection.objects.link(ob)
        for m in ORDER: me.materials.append(MAT[m])
        return ob
    S = boat(RS)
    hull = new_object(name)
    bm = bmesh.new(); build_hull(bm, IDX, S)
    if not RS: build_cuddy(bm, IDX, S)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(hull.data); bm.free()
    # the cockpit, cut from its front out through the open transom, down to its non-skid floor
    cz0, cx, floor = S['ck']
    cut = new_object('cockpit'); bm = bmesh.new()
    plan_prism(bm, rounded_rect(-cx, cx, cz0, S['STERN'] + 0.6, 0.2, corners=(1, 0, 0, 1)), floor, 2.0, IDX['gel'], IDX['deck'], IDX['gel'])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(cut.data); bm.free()
    mod = hull.modifiers.new('cockpit', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut; mod.solver = 'EXACT'
    mod.use_self = True   # the hull and the cuddy are two shells: merge them as it cuts
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
    out = os.path.normpath(os.path.join(HERE, '..', 'public', 'game', f'{name}.glb'))
    print(name, 'verts', len(me.vertices), 'tris', sum(len(p.vertices) - 2 for p in me.polygons), 'mats', [m.name for m in me.materials])
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_texcoords=False, export_normals=True, export_materials='EXPORT', export_extras=False,
                              export_animations=False, export_skins=False, export_morph=False, export_cameras=False, export_lights=False)
    print('wrote', out, os.path.getsize(out))
