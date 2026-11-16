# Regatta: the committee boat's moulded parts (game/committee.js), modelled here and exported to game/committee.glb, as
# the yachts' are: a 13 m flybridge motor cruiser. The hull: the deck edge turned round a radius, the topsides flaring
# out over a hard chine that lifts towards the bow, a reverse chine flat along it, a spray rail a side on the vee'd
# bottom, a shallow keel aft and a raked stem; the swim platform moulded onto the transom; two long tinted windows a
# side in the topsides forward. The deck, crowned, its aft deck teak. The deckhouse: its plan rounded at the nose, its
# sides leaning in, the windscreen raked aft more the higher it goes, a band of tinted glass round it with the pillars
# between the panes. The hardtop over it and the aft deck, its edge rounded, its top the flybridge floor; the helm
# console moulded on it, its dash sloping down to the helm.
# The rubbing strake, the rails, the signal mast, the flags, the ladders, the fenders, the fittings and the officers
# stay in committee.js (they move, or are made per boat).
#
# The hull follows committee.js's own lines (station()), so the fittings it stands on the deck (deckY, halfB) are where
# they were; the deckhouse, the hardtop (FLY) and the console are where its rails, posts, mast and crew expect them.
#
# Materials by name, which committee.js swaps for its own: hull (the paint, boot-top and antifouling drawn by
# yacht.js's shader), deck (non-skid: the foredeck and the side decks), roof (non-skid: the flybridge floor), teak (the
# aft deck and the swim platform), gel, glass. No UVs: committee.js lays the deck's and the teak's out from the plan.
#
#   blender -b --factory-startup -P blender/committee.py
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'public', 'game', 'committee.glb'))

# ---------- committee.js's lines (game frame: +x starboard, +y up, -z forward, the waterline at y = 0) ----------
L, B, DRAFT, FLY = 13.0, 4.3, 0.85, 3.3
def clamp(v, a, b): return max(a, min(b, v))
def lerp(a, b, t): return a + (b - a) * t
def smooth(e0, e1, x): t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def station(t):  # committee.js station(): t = 0 at the transom ... 1 at the stem
    hb = (B / 2) * (0.88 + 0.12 * math.sin((t / 0.5) * math.pi / 2) if t < 0.5 else max(0.0, math.cos(((t - 0.5) / 0.5) * math.pi / 2)) ** 0.7)
    d = DRAFT * (0.72 + 0.28 * math.sin((t / 0.55) * math.pi / 2) if t < 0.55 else max(0.0, math.cos(((t - 0.55) / 0.45) * math.pi / 2)) ** 0.8)
    return dict(hb=hb, sy=1.2 + 0.62 * t ** 2.2, d=d, hc=hb * (0.95 - 0.25 * t), yc=lerp(-0.1, 0.5, t ** 1.6), z=L / 2 - t * L,
                rake=1.7 * clamp((t - 0.7) / 0.3, 0, 1) ** 2)
def t_at(z): return clamp((L / 2 - z) / L, 0, 1)
def deck_y(z): return station(t_at(z))['sy']
def half_b(z): return station(t_at(z))['hb']
CROWN = 0.03

def G(x, y, z): return Vector((x, -z, y))  # game -> Blender (Z up, +Y forward); the glTF export turns it back

# ---------- the hull: one ring a station, round from the deck's middle, down a side, under her and up the other ----------
R_EDGE = 0.06
def section(s):
    """The starboard half of a section, from the deck edge's arc down to the keel: (x, y) points, and the crown."""
    hb, sy, d, hc, yc = s['hb'], s['sy'], s['d'], s['hc'], s['yc']
    k = hb / (B / 2)
    r = min(R_EDGE, hb * 0.3)
    pts = []
    # the deck edge, turned round r
    for i in range(4, 0, -1):
        a = (math.pi / 2) * i / 4
        pts.append((hb - r + r * math.cos(a), sy - r + r * math.sin(a)))
    # the topsides, flaring out above the chine (a little fullness in them)
    KT = 9
    for j in range(KT + 1):
        u = j / KT
        y = lerp(sy - r, yc, u)
        pts.append((lerp(hb, hc, u) + 0.05 * math.sin(math.pi * u) * k, y))
    # the reverse chine: a flat a few centimetres wide, turned down a touch
    cw = 0.06 * k + 0.004
    xc0, yc0 = hc - cw, yc - 0.012
    pts.append((xc0, yc0))
    # the bottom, vee'd and a little convex, a spray rail along it from a third of the way aft to the bow
    KB = 10
    rail = 0.035 * smooth(0.18, 0.4, s['t']) * k + 0.004
    bot = lambda u: (lerp(xc0, 0.0, u), lerp(yc0, -d, u) - 0.06 * math.sin(math.pi * u) * (hc / (B / 2)))
    for j in range(1, KB + 1):
        u = j / KB
        if j == 4:  # the spray rail: out along the bottom's line, then its flat underside back in to the hull
            x, y = bot(0.42); pts.append((x, y))
            x, y = bot(0.45); pts.append((x + rail, y + 0.004)); pts.append((x, y))
            continue
        pts.append(bot(u))
    return pts, r

def ring_points(t):
    s = station(t); s['t'] = t
    half, r = section(s)
    sy, d, z, rake = s['sy'], s['d'], s['z'], s['rake']
    zr = lambda y: z + rake * (sy - y) / (sy + d + 1e-3)  # the stem raked: its foot aft of its head
    side = [(x, y, zr(y)) for x, y in half]
    ring = side + [(-x, y, zz) for x, y, zz in reversed(side[:-1])]  # the keel point once
    nh = len(ring)
    # the deck across, crowned, from the port arc's inner end to the starboard's
    xd = half[0][0]; KD = 8
    for kk in range(-(KD - 1), KD):
        x = xd * kk / KD
        ring.append((x, sy + CROWN * (1 - (x / max(s['hb'], 0.2)) ** 2), z))
    # rotate so the deck's points close the ring: starboard arc ... port arc, deck from port to starboard
    return ring, nh

def build_hull(bm, M):
    N = 90
    rings, nh = [], None
    for i in range(N + 1):
        t = min(0.996, (i / N) ** 0.9)
        pts, nh = ring_points(t)
        rings.append([bm.verts.new(G(*p)) for p in pts])
    R = len(rings[0])
    for i in range(N):
        a, b = rings[i], rings[i + 1]
        zc = station(min(0.996, ((i + 0.5) / N) ** 0.9))['z']
        for j in range(R):
            f = bm.faces.new((a[j], a[(j + 1) % R], b[(j + 1) % R], b[j]))
            if j < nh - 1: f.material_index = M['hull']
            else: f.material_index = M['teak'] if zc > 2.35 else M['deck']  # the aft deck teak, under the hardtop
    bm.faces.new(list(reversed(rings[0]))).material_index = M['hull']  # the transom
    bm.faces.new(rings[-1]).material_index = M['hull']                  # the stem's narrow face

# ---------- the hull windows: two long slots a side in the topsides forward, tinted, on the hull's own surface ----------
def topsides_x(z, y):
    s = station(t_at(z)); k = s['hb'] / (B / 2); r = min(R_EDGE, s['hb'] * 0.3)
    u = clamp((s['sy'] - r - y) / (s['sy'] - r - s['yc']), 0, 1)
    return lerp(s['hb'], s['hc'], u) + 0.05 * math.sin(math.pi * u) * k
def build_hull_windows(bm, M):
    for z0, z1, h0, h1 in ((-3.75, -2.25, 0.11, 0.15), (-1.95, -0.55, 0.15, 0.16)):
        NZ, NY = 28, 4
        for sx in (-1, 1):
            grid = []
            for i in range(NZ + 1):
                u = i / NZ; z = lerp(z0, z1, u)
                hh = lerp(h0, h1, u) / 2 * (1 - abs(2 * u - 1) ** 6) ** 0.5  # its ends rounded
                yc = deck_y(z) - 0.4 + 0.04 * u
                row = []
                for j in range(NY + 1):
                    y = yc + hh * (2 * j / NY - 1)
                    row.append(bm.verts.new(G(sx * (topsides_x(z, y) + 0.006), y, z)))
                grid.append(row)
            for i in range(NZ):
                for j in range(NY):
                    q = (grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1])
                    bm.faces.new(tuple(reversed(q)) if sx > 0 else q).material_index = M['glass']  # facing out

# ---------- the keel: a shallow fin along her middle aft, its foot curved up into the hull at either end ----------
def build_keel(bm, M):
    N = 24; secs = []
    for i in range(N + 1):
        t = lerp(0.1, 0.62, i / N)
        s = station(t); f = math.sin(math.pi * i / N) ** 0.6
        y0 = -s['d'] + 0.06; k = 0.34 * f + 0.01
        w = 0.07
        prof = [(w, y0), (w * 0.8, y0 - k * 0.7), (w * 0.35, y0 - k), (0.0, y0 - k - 0.01)]
        ring = [G(x, y, s['z']) for x, y in prof] + [G(-x, y, s['z']) for x, y in reversed(prof[:-1])]
        secs.append([bm.verts.new(p) for p in ring])
    R = len(secs[0])
    for i in range(N):
        for j in range(R - 1):
            bm.faces.new((secs[i][j], secs[i][j + 1], secs[i + 1][j + 1], secs[i + 1][j])).material_index = M['hull']
    for r in (secs[0], secs[-1]): bm.faces.new(r).material_index = M['hull']

# ---------- boxes in plan ----------
def rounded_rect(x0, x1, z0, z1, r, seg=6):
    pts = []
    for (cx, cz), a0 in (((x1 - r, z0 + r), -math.pi / 2), ((x1 - r, z1 - r), 0), ((x0 + r, z1 - r), math.pi / 2), ((x0 + r, z0 + r), math.pi)):
        for i in range(seg + 1):
            a = a0 + (math.pi / 2) * i / seg
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts
def ccw(outline):  # counter-clockwise seen from above (+y), so the faces built on it face out
    area = sum(outline[k][0] * outline[(k + 1) % len(outline)][1] - outline[(k + 1) % len(outline)][0] * outline[k][1] for k in range(len(outline)))
    return list(reversed(outline)) if area > 0 else outline
def loft(bm, levels, mats, cap_lo=None, cap_hi=None):
    """levels: rings of game points, bottom to top, the same count; mats(i, k): the band i's face k's material."""
    vs = [[bm.verts.new(G(*p)) for p in ring] for ring in levels]
    n = len(levels[0])
    for i in range(len(vs) - 1):
        for k in range(n):
            bm.faces.new((vs[i][k], vs[i][(k + 1) % n], vs[i + 1][(k + 1) % n], vs[i + 1][k])).material_index = mats(i, k)
    if cap_lo is not None: bm.faces.new(list(reversed(vs[0]))).material_index = cap_lo
    if cap_hi is not None: bm.faces.new(vs[-1]).material_index = cap_hi
def edged_slab(bm, outline, y0, y1, mat_side, mat_lo, mat_hi, ins_lo=0.03, ins_hi=0.04, r=0.05):
    """a slab in plan with its edges rounded: inset at its foot and its top, full width between"""
    o = ccw(outline)
    cx = sum(p[0] for p in o) / len(o); cz = sum(p[1] for p in o) / len(o)
    def inset(d):
        out = []
        for k, (x, z) in enumerate(o):
            (xa, za), (xb, zb) = o[k - 1], o[(k + 1) % len(o)]
            tx, tz = xb - xa, zb - za; l = math.hypot(tx, tz) or 1
            nx, nz = tz / l, -tx / l
            if nx * (x - cx) + nz * (z - cz) < 0: nx, nz = -nx, -nz
            out.append((x - nx * d, z - nz * d))
        return out
    levels = []
    for d, y in ((ins_lo, y0), (ins_lo * 0.3, y0 + r * 0.35), (0, y0 + r), (0, y1 - r), (ins_hi * 0.3, y1 - r * 0.35), (ins_hi, y1)):
        levels.append([(x, y, z) for x, z in inset(d)])
    loft(bm, levels, lambda i, k: mat_side, mat_lo, mat_hi)

# ---------- the deckhouse ----------
# committee.js: its foot from z = -1.7 (the nose, on the centreline) to 2.4 (its aft face), half-widths 1.42 forward and
# 1.55 aft; at its top (3.15, under the hardtop) -0.75 to 2.3, 1.22 and 1.42. The tinted band from 2.15 to 2.95.
DH_TOP, WIN0, WIN1 = 3.16, 2.15, 2.95
NOSE_N, SIDE_N, AFT_N, CORNER_N = 12, 14, 4, 4
def dh_outline(u):
    f, a = lerp(-1.7, -0.75, u ** 1.5), lerp(2.4, 2.32, u)
    wf, wa = lerp(1.42, 1.22, u), lerp(1.55, 1.42, u)
    rf, ra, n = lerp(1.0, 0.85, u), 0.14, 2.6
    pts, tags = [], []
    for i in range(NOSE_N + 1):  # the nose, from the centreline round to the side: the windscreen
        ph = (math.pi / 2) * (1 - i / NOSE_N)
        pts.append((wf * math.cos(ph) ** (2 / n), f + rf * (1 - math.sin(ph) ** (2 / n)))); tags.append('nose')
    for i in range(1, SIDE_N + 1):  # the side, aft to the corner
        v = i / SIDE_N
        pts.append((lerp(wf, wa, v), lerp(f + rf, a - ra, v))); tags.append('side')
    for i in range(1, CORNER_N + 1):
        ph = (math.pi / 2) * i / CORNER_N
        pts.append((wa - ra + ra * math.cos(ph), a - ra + ra * math.sin(ph))); tags.append('corner')
    for i in range(1, AFT_N + 1):
        pts.append(((wa - ra) * (1 - i / AFT_N), a)); tags.append('aft')
    star = pts
    full = star + [(-x, z) for x, z in reversed(star[1:-1])]
    ftag = tags + list(reversed(tags[1:-1]))
    return full, ftag
def build_deckhouse(bm, M):
    y_lo = deck_y(2.4)  # the deck's lowest under it, aft
    hs = [None, None, 1.95, 2.08, WIN0, 2.55, WIN1, 3.04, DH_TOP]
    levels, tags0 = [], None
    for li, h in enumerate(hs):
        u = 0 if h is None else (h - y_lo) / (DH_TOP - y_lo)
        out, tags = dh_outline(clamp(u, 0, 1)); tags0 = tags0 or tags
        ring = []
        for x, z in out:
            if li == 0: y = deck_y(z) - 0.06
            elif li == 1: y = deck_y(z) + 0.06
            else: y = h
            ring.append((x, y, z))
        levels.append(ring)
    n = len(levels[0])
    def mat(i, k):
        if not (4 <= i <= 5): return M['gel']  # the bands between WIN0 and WIN1 are the glass
        a, b = levels[i][k], levels[i][(k + 1) % n]
        xm, zm = (a[0] + b[0]) / 2, (a[2] + b[2]) / 2
        tag = tags0[k] if tags0[k] == tags0[(k + 1) % n] else 'corner'
        if tag == 'nose': return M['glass'] if abs(xm) < 1.18 or zm < -0.3 else M['gel']  # the windscreen, its pillars at the corners
        if tag == 'side': return M['glass'] if (-0.05 < zm < 0.85) or (1.08 < zm < 2.0) else M['gel']
        if tag == 'aft': return M['glass'] if abs(xm) > 0.62 and abs(xm) < 1.15 else M['gel']
        return M['gel']
    loft(bm, levels, mat, M['gel'], M['gel'])

# ---------- the hardtop and the flybridge on it ----------
TOP_F, TOP_A, TOP_W = -0.95, 4.6, 1.62   # committee.js topF, topA, topW
def build_hardtop(bm, M):
    edged_slab(bm, rounded_rect(-TOP_W, TOP_W, TOP_F, TOP_A, 0.55, 8), FLY - 0.17, FLY, M['gel'], M['gel'], M['roof'], 0.04, 0.03, 0.06)
    # the helm console: moulded on the floor, its dash sloping down aft to the helm
    con_z = TOP_F + 0.2 + 0.75
    o = ccw(rounded_rect(-0.7, 0.7, con_z - 0.3, con_z + 0.3, 0.14, 4))
    dash = lambda z: FLY + 0.78 + 0.22 * clamp((con_z + 0.3 - z) / 0.6, 0, 1)
    levels = [[(x, FLY - 0.02, z) for x, z in o], [(x, dash(z) - 0.06, z) for x, z in o]]
    levels.append([(x * 0.97, dash(z) - 0.015, con_z + (z - con_z) * 0.96) for x, z in o])
    levels.append([(x * 0.9, dash(z), con_z + (z - con_z) * 0.88) for x, z in o])
    loft(bm, levels, lambda i, k: M['gel'], None, M['gel'])

# ---------- the swim platform on the transom ----------
def build_platform(bm, M):
    edged_slab(bm, rounded_rect(-B * 0.42, B * 0.42, L / 2 - 0.05, L / 2 + 0.88, 0.22, 6), 0.3, 0.44, M['gel'], M['gel'], M['teak'], 0.05, 0.015, 0.035)

def material(name, color, rough=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1); p.inputs['Roughness'].default_value = rough
    return m

for o in list(bpy.data.objects): bpy.data.objects.remove(o)
MAT = {'hull': material('hull', (0.92, 0.92, 0.9), 0.2), 'deck': material('deck', (0.8, 0.79, 0.75), 0.85),
       'gel': material('gel', (0.9, 0.89, 0.86), 0.3), 'teak': material('teak', (0.45, 0.28, 0.13), 0.7),
       'glass': material('glass', (0.03, 0.04, 0.05), 0.05), 'roof': material('roof', (0.86, 0.86, 0.84), 0.85)}
ORDER = ['hull', 'deck', 'gel', 'teak', 'glass', 'roof']
IDX = {m: i for i, m in enumerate(ORDER)}

me = bpy.data.meshes.new('committee'); ob = bpy.data.objects.new('committee', me); bpy.context.scene.collection.objects.link(ob)
for m in ORDER: me.materials.append(MAT[m])
bm = bmesh.new()
build_hull(bm, IDX); build_keel(bm, IDX); build_deckhouse(bm, IDX); build_hardtop(bm, IDX); build_platform(bm, IDX)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
build_hull_windows(bm, IDX)  # open patches: wound facing out, after the solids' normals are settled
bm.to_mesh(me); bm.free()

bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(30))
print('verts', len(me.vertices), 'tris', sum(len(p.vertices) - 2 for p in me.polygons), 'mats', [m.name for m in me.materials])
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                          export_texcoords=False, export_normals=True, export_materials='EXPORT', export_extras=False,
                          export_animations=False, export_skins=False, export_morph=False, export_cameras=False, export_lights=False)
print('wrote', OUT, os.path.getsize(OUT))
