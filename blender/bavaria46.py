# Regatta: the Bavaria 46's moulded parts (game/boats3d.js CruiserView), modelled here and exported to
# game/bavaria46.glb: the hull, its deck edge turned round a radius, the deck, the coachroof (its sides leaning in, a
# low nose sloping down into the foredeck, a long window down each side tapering at its forward end, its top edge
# rounded, stepping down at its aft corners into the coamings that run on aft beside the cockpit), the cockpit cut down
# to its sole and out through the transom, widening at the wheels, its benches and the helms' seats. The keel, the
# rudder, the rig, the sails, the fittings, the lifelines and the decals stay in boats3d.js (they move, or are made per
# boat).
#
# She is the Farr-designed Cruiser 46 (2014), to Bavaria's figures: a 13.60 m hull, 4.35 m beam; her coachroof starts
# some 2.4 m aft of the stem and runs to the cockpit 3.7 m from the transom, the cockpit a well some 2.3 m wide between
# high coamings, the companionway at its forward end.
#
# The hull follows boats3d.js's lines for her (BV: hullOf with her half-breadth, sheer, depth, sections and chine), so
# the hull windows, the logo and the stripe it lays onto the hull still lie on this surface; the deck, the coachroof's
# plan and top (BV.COACH, BV.ROOF), the cockpit's opening and sole (BV.CK, BV.FLOOR) and the benches are where its
# fittings and crew expect them.
#
# Materials by name, which boats3d.js swaps for its own: hull (the paint, boot-top and antifouling drawn by its
# shader), deck (the side decks and foredeck: teak, as hers are, or the player's deck in the hull's colour), roof (the
# coachroof's and the coamings' tops: non-skid), gel, teak, glass. No UVs: boats3d.js lays the deck's, the roof's and
# the teak's out from the plan.
#
#   blender -b --factory-startup -P blender/bavaria46.py
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'public', 'game', 'bavaria46.glb'))

# ---------- boats3d.js's lines for her (game frame: +x starboard, +y up, -z forward, the waterline at y = 0) ----------
L, B = 13.6, 4.35
STERN = L / 2
FLARE = 0.05
def clamp(v, a, b): return max(a, min(b, v))
def lerp(a, b, t): return a + (b - a) * t
def smooth(e0, e1, x): t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def hb_of(t):
    if t < 0.42: return (B / 2) * (0.9 + 0.1 * math.sin((t / 0.42) * math.pi / 2))
    return (B / 2) * max(0.0, math.cos(min(1, (t - 0.42) / 0.58) * math.pi / 2)) ** 0.72
def sheer(t): return 1.26 + 0.26 * t ** 1.5
def depth(t): return 0.74 * math.sin(math.pi * min(1, t * 0.92 + 0.04)) ** 0.7
def n_of(t): return lerp(2.7, 1.9, clamp((t - 0.4) / 0.6, 0, 1))
def chine_y(t): return 0.42 - 0.55 * t
def chine_w(t): return 1 - smooth(0.3, 0.7, t)
def chine_dead(t): return lerp(16, 12, clamp(t / 0.35, 0, 1))
def z_at(t): return STERN - t * L
def t_at(z): return clamp((STERN - z) / L, 0, 1)
CROWN = 0.06
def deck_y(z, x=0.0):  # the deck: the sheer, crowned as boats3d.js's deck() crowns it
    hb = max(hb_of(t_at(z)), 0.2)
    return sheer(t_at(z)) + CROWN * (1 - min(1, abs(x) / hb) ** 2)

def round_pt(t, s):  # hullOf's round(): s = 0 at the deck edge ... 1 at the keel
    hb, sy, d, n = hb_of(t), sheer(t), depth(t), n_of(t)
    phi = s * math.pi / 2; c, sn = math.cos(phi), math.sin(phi); yr = sn ** (2 / n)
    return hb * c ** (2 / n) * (1 - FLARE * sn), sy - (sy + d) * yr
SPLIT = 0.5
def hull_point(t, s):  # hullOf's section(): the round section above the chine, a curve to the flat of the keel below
    sy, d, n, w = sheer(t), depth(t), n_of(t), chine_w(t)
    sc = math.asin(clamp((sy - chine_y(t)) / (sy + d), 0, 1) ** (n / 2)) * 2 / math.pi
    sf = s / SPLIT * sc if s <= SPLIT else sc + (s - SPLIT) / (1 - SPLIT) * (1 - sc)
    fx, fy = round_pt(t, sf)
    if s <= SPLIT or w <= 0: return fx, fy
    xc, ycc = round_pt(t, sc)
    u = (s - SPLIT) / (1 - SPLIT); d2 = d * 0.85; dr = math.radians(chine_dead(t)); k = xc * 0.42
    P = [(xc, ycc), (xc - k * math.cos(dr), ycc - k * math.sin(dr)), (xc * 0.38, -d2), (0.0, -d2)]
    a, b2, c2, e = (1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3
    bx = a * P[0][0] + b2 * P[1][0] + c2 * P[2][0] + e * P[3][0]
    by = a * P[0][1] + b2 * P[1][1] + c2 * P[2][1] + e * P[3][1]
    return lerp(fx, bx, w), lerp(fy, by, w)

def G(x, y, z): return Vector((x, -z, y))  # game -> Blender (Z up, +Y forward); the glTF export turns it back

# the deck edge turned round a radius, as a moulded hull's is: where the topsides start below it, and the arc
def edge_arc(t):
    hb, sy, d, n = hb_of(t), sheer(t), depth(t), n_of(t)
    r = min(0.06, hb * 0.25)
    s_r = math.asin(clamp(r / (sy + d), 0, 1) ** (n / 2)) * 2 / math.pi
    x_r, y_r = hull_point(t, s_r)
    yd = sy + CROWN * (1 - min(1, (x_r - r) / max(hb, 0.2)) ** 2)
    arc = [(x_r - r + r * math.cos(a), lerp(y_r, yd, math.sin(a)) if a < math.pi / 2 else yd) for a in (math.pi / 2 * k / 4 for k in range(4, 0, -1))]
    return s_r, arc, x_r - r

def build_hull(bm, M):
    N, KH, KD = 96, 26, 8
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
            f = bm.faces.new((a[j], a[(j + 1) % R], b[(j + 1) % R], b[j]))
            f.material_index = M['hull'] if j < nh - 1 else M['deck']
    for r in (rings[0], rings[-1]): bm.faces.new(r).material_index = M['hull']  # the transom, the stem

# ---------- the coachroof and the coamings: lofted sections from its nose aft to where the coamings end ----------
# boats3d.js BV.COACH: the nose on the deck, the cockpit's front (the companionway), the half-width, the height, the
# nose's length, the coamings' height above the deck and where they end; the mast's step
CZF, CZA, CW, CH, NOSE, COAM, CEND = -4.4, 3.1, 1.55, 0.5, 2.3, 0.32, 5.8
MAST_Z = -1.15
COACH_Y = sheer(t_at(MAST_Z)) - 0.03                       # BV.coachY
ROOF = COACH_Y + CH + 0.04                                 # BV.ROOF: where the hatches, winches and the mast's foot stand
SIDE_DECK = 0.48
WIN_F = (0.17, 0.28, 0.39, 0.5, 0.61, 0.72, 0.83)  # the window's band up the coachroof's side, in six strips: most of its height, as hers is
def half_w(z):  # the plan: a rounded nose, then the full width, never closer than a side deck to the sheer
    u = clamp((z - CZF) / NOSE, 0, 1)
    return min(CW * (1 - (1 - u) ** 2) ** 0.4, hb_of(t_at(z)) - SIDE_DECK)
def top_y(z, x):  # the coachroof's top, sloping down into the foredeck at its nose; aft, the coamings'
    yd = deck_y(z, x)
    hi = lerp(yd, ROOF + 0.025 * (1 - (x / CW) ** 2), math.sin(math.pi / 2 * smooth(CZF, CZF + 1.8, z)) ** 0.8)
    step = CZA + 0.3 - 1.35 * (x / CW) ** 2                # the step down to the coamings: at the sides first
    co = yd + COAM * (1 - smooth(CEND - 0.45, CEND, z))
    return lerp(hi, co, smooth(step - 0.15, step + 0.25, z))
def build_coachroof(bm, M):
    NZ = 110
    secs, zs = [], []
    for i in range(NZ + 1):
        z = lerp(CZF + 0.03, CEND, (i / NZ) ** 0.97)
        w0 = half_w(z) + 0.02
        yd = deck_y(z, w0)
        ht = max(yd + 0.01, top_y(z, w0))
        h = ht - yd
        rr = min(0.08, h * 0.45)
        wt = w0 - 0.1 * clamp(h / 0.5, 0, 1)                   # the sides leaning in
        side_top = ht - rr
        prof = [(w0, yd - 0.45), (w0, yd)]
        for f in WIN_F: prof.append((lerp(w0, wt, f), lerp(yd, side_top, f)))
        prof.append((wt, side_top))
        prof += [(wt - rr * 0.29, ht - rr * 0.29 + 0.0), (wt - rr, ht)]
        for f in (0.8, 0.55, 0.3): x = (wt - rr) * f; prof.append((x, max(yd + 0.01, top_y(z, x))))
        ring = [G(x, y, z) for x, y in prof] + [G(0, max(deck_y(z) + 0.01, top_y(z, 0)), z)] + [G(-x, y, z) for x, y in reversed(prof)]
        secs.append([bm.verts.new(p) for p in ring]); zs.append(z)
    R = len(secs[0]); half = (R - 1) // 2
    for i in range(NZ):
        zc = (zs[i] + zs[i + 1]) / 2
        for j in range(R):
            seg = j if j < half else R - 2 - j                   # the same band on either side (0 below the deck, 2 … 7 the windows)
            mat = M['roof'] if seg >= len(WIN_F) + 4 else M['gel']                     # the top non-skid, its edge gelcoat
            k = seg - 2
            if 0 <= k < len(WIN_F) - 1:
                if lerp(-2.3, -2.95, (k + 0.5) / (len(WIN_F) - 1)) < zc < 1.75: mat = M['glass']  # the long window, its front edge raked forward as it rises
                if 2.45 < zc < 2.95: mat = M['glass']                                  # the small one in the coaming's side
            bm.faces.new((secs[i][j], secs[i][(j + 1) % R], secs[i + 1][(j + 1) % R], secs[i + 1][j])).material_index = mat
    bm.faces.new(list(reversed(secs[0]))).material_index = M['gel']
    bm.faces.new(secs[-1]).material_index = M['gel']

# ---------- boxes ----------
def plan_prism(bm, outline, y0, y1, ms, mb, mt):
    lo = [bm.verts.new(G(x, y0, z)) for x, z in outline]; hi = [bm.verts.new(G(x, y1, z)) for x, z in outline]
    n = len(outline)
    for k in range(n): bm.faces.new((lo[k], lo[(k + 1) % n], hi[(k + 1) % n], hi[k])).material_index = ms
    bm.faces.new(list(reversed(lo))).material_index = mb; bm.faces.new(hi).material_index = mt
def rounded_rect(x0, x1, z0, z1, r, corners=(1, 1, 1, 1), seg=6):
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

def material(name, color, rough=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1); p.inputs['Roughness'].default_value = rough
    return m
def new_object(name):
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    for m in ORDER: me.materials.append(MAT[m])
    return ob

for o in list(bpy.data.objects): bpy.data.objects.remove(o)
MAT = {'hull': material('hull', (0.92, 0.92, 0.9), 0.2), 'deck': material('deck', (0.8, 0.79, 0.75), 0.85),
       'gel': material('gel', (0.9, 0.89, 0.86), 0.3), 'teak': material('teak', (0.45, 0.28, 0.13), 0.7),
       'glass': material('glass', (0.03, 0.04, 0.05), 0.05), 'roof': material('roof', (0.86, 0.86, 0.84), 0.85)}
ORDER = ['hull', 'deck', 'gel', 'teak', 'glass', 'roof']
IDX = {m: i for i, m in enumerate(ORDER)}

# the hull and the coachroof, one solid
hull = new_object('bavaria46')
bm = bmesh.new(); build_hull(bm, IDX); build_coachroof(bm, IDX)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(hull.data); bm.free()

# the cockpit, cut out of it: from the companionway out through the transom, down to its teak sole; between the
# coamings, then wider aft where the wheels stand
CKZ, CKX, HELM_Z, HELM_X = CZA, 1.13, 5.35, 1.42          # BV.CK, BV.HELM
FLOOR = deck_y(4.5) - 0.55                                # BV.FLOOR
cut = new_object('cockpit')
bm = bmesh.new()
r = 0.25
out = [(CKX - r + r * math.cos(a), CKZ + r - r * math.sin(a)) for a in (math.pi / 2 * k / 6 for k in range(6, -1, -1))]  # the forward corner, rounded
out += [(CKX, HELM_Z), (HELM_X, HELM_Z + 0.25), (HELM_X, STERN + 1.0)]
outline = out + [(-x, z) for x, z in reversed(out)]
outline = list(reversed(outline)) if sum((outline[k][0] * outline[(k + 1) % len(outline)][1] - outline[(k + 1) % len(outline)][0] * outline[k][1]) for k in range(len(outline))) < 0 else outline
plan_prism(bm, outline, FLOOR, 4.0, IDX['gel'], IDX['teak'], IDX['gel'])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(cut.data); bm.free()
mod = hull.modifiers.new('cockpit', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut; mod.solver = 'EXACT'
mod.use_self = True
try: mod.material_mode = 'TRANSFER'
except Exception as e: print('material_mode:', e)
bpy.context.view_layer.objects.active = hull; bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cut)

# the benches down both sides, their tops teak; the helms' seats outboard aft, either side of the bathing platform
bm = bmesh.new(); bm.from_mesh(hull.data)
for sx in (-1, 1):
    xs = sorted([sx * (CKX - 0.5), sx * (CKX + 0.02)])
    plan_prism(bm, rounded_rect(xs[0], xs[1], CKZ + 0.2, HELM_Z - 0.15, 0.08), FLOOR - 0.01, FLOOR + 0.42, IDX['gel'], IDX['gel'], IDX['teak'])
    xh = sorted([sx * 1.02, sx * (HELM_X + 0.02)])
    plan_prism(bm, rounded_rect(xh[0], xh[1], STERN - 0.62, STERN - 0.06, 0.08), FLOOR - 0.01, FLOOR + 0.5, IDX['gel'], IDX['gel'], IDX['teak'])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.to_mesh(hull.data); bm.free()

bpy.ops.object.select_all(action='DESELECT'); hull.select_set(True); bpy.context.view_layer.objects.active = hull
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(34))
me = hull.data
print('verts', len(me.vertices), 'tris', sum(len(p.vertices) - 2 for p in me.polygons), 'mats', [m.name for m in me.materials])
print('ROOF', round(ROOF, 4), 'FLOOR', round(FLOOR, 4), 'COACH_Y', round(COACH_Y, 4))

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                          export_texcoords=False, export_normals=True, export_materials='EXPORT', export_extras=False,
                          export_animations=False, export_skins=False, export_morph=False, export_cameras=False, export_lights=False)
print('wrote', OUT, os.path.getsize(OUT))
