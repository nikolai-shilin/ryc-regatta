# Regatta: the banner plane (game/plane.js), modelled here and exported to game/plane.glb: a high-wing two-seat
# taildragger of the kind that tows banners along every summer coast, at a Super Cub's size (6.9 m long, 10.7 m
# across the wing). The fuselage lofted through rounded-box sections, the cowling's nose bowl open round the spinner,
# the windscreen rising to the wing and the cabin's side windows; the wing a cambered section with its rounded tips and
# a degree of dihedral, on V lift struts and their jury struts; the V legs of the main gear on fat tyres, the tail
# wheel on its leaf spring; the round fin and rudder and the tailplane with their bracing; the exhaust, the tow hook,
# the navigation lights. The propeller is its own object, turned by plane.js.
#
# Game frame: +x starboard, +y up, -z forward; the thrust line at y = 0, the propeller's hub at z = -3.40, the tow
# hook under the tail at (0, 0, 3.25) (plane.js's hook).
#
# Materials by name, which plane.js paints and shades for itself: white, blue (the cowling, the cheat line, the fin,
# the wing tips), red and green (the navigation lights), glass, metal (struts, gear legs, spinner, exhaust), dark
# (tyres, the nose bowl's mouth); and on the propeller, prop and tip. No UVs.
#
#   blender -b --factory-startup -P blender/plane.py
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'public', 'game', 'plane.glb'))

def clamp(v, a, b): return max(a, min(b, v))
def lerp(a, b, t): return a + (b - a) * t
def G(x, y, z): return Vector((x, -z, y))  # game -> Blender (Z up, +Y forward); the glTF export turns it back
def game(v): return v.x, v.z, -v.y

ORDER = ['white', 'blue', 'red', 'green', 'glass', 'metal', 'dark']
COL = {'white': (0.92, 0.93, 0.92), 'blue': (0.02, 0.16, 0.45), 'red': (0.8, 0.02, 0.02), 'green': (0.02, 0.6, 0.1),
       'glass': (0.03, 0.05, 0.07), 'metal': (0.6, 0.62, 0.64), 'dark': (0.02, 0.02, 0.02),
       'prop': (0.02, 0.02, 0.02), 'tip': (0.95, 0.7, 0.05)}
MAT = {}
for k, c in COL.items():
    m = bpy.data.materials.new(k); m.diffuse_color = (*c, 1); MAT[k] = m
    m.use_nodes = True
    next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs[0].default_value = (*c, 1)

# ---------- helpers ----------
def airfoil(n, t, m=0.0, p=0.4):
    """A NACA four-digit section, chord 0..1 from the leading edge: from the trailing edge over the top to the nose and
    back underneath, the trailing edge once. (x along the chord, y up)"""
    def yt(x): return 5 * t * (0.2969 * math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)
    def yc(x):
        if m == 0: return 0.0
        return m / p ** 2 * (2 * p * x - x * x) if x < p else m / (1 - p) ** 2 * (1 - 2 * p + 2 * p * x - x * x)
    xs = [(1 - math.cos(math.pi * i / n)) / 2 for i in range(n + 1)]
    up = [(x, yc(x) + yt(x)) for x in reversed(xs)]
    lo = [(x, yc(x) - yt(x)) for x in xs[1:-1]]
    return up + lo

def loft(bm, rings, mats, cap0=True, cap1=True, closed=True):
    """Quads between successive rings of game points (each the same count); mats(i, j, centre) names each face's
    material. Ends capped with an n-gon."""
    vs = [[bm.verts.new(G(*p)) for p in r] for r in rings]
    n = len(rings[0])
    for i in range(len(vs) - 1):
        for j in range(n if closed else n - 1):
            a, b, c, d = vs[i][j], vs[i][(j + 1) % n], vs[i + 1][(j + 1) % n], vs[i + 1][j]
            cen = [(rings[i][j][k] + rings[i][(j + 1) % n][k] + rings[i + 1][(j + 1) % n][k] + rings[i + 1][j][k]) / 4 for k in range(3)]
            try: f = bm.faces.new((a, b, c, d))
            except ValueError: continue
            f.material_index = IDX[mats(i, j, cen)]
    for cap, r, name in ((cap0, vs[0], 'c0'), (cap1, vs[-1], 'c1')):
        if not cap: continue
        try: f = bm.faces.new(r)
        except ValueError: continue
        cen = [sum(game(v.co)[k] for v in r) / len(r) for k in range(3)]
        f.material_index = IDX[mats(-1 if name == 'c0' else len(rings), 0, cen)]
    return vs

def frame(d):
    """Two unit vectors square to d, the first as near the flight path (z) as d allows."""
    d = d.normalized(); z = Vector((0, 0, 1))
    u = z - d * z.dot(d)
    if u.length < 1e-4: u = Vector((1, 0, 0)) - d * d.x
    u.normalize(); return u, d.cross(u)

def rod(bm, a, b, rw, rt=None, mat='metal', n=8):
    """A strut from a to b (game points), its section an ellipse rw along the flight path, rt across it (a streamline);
    rt = None: round."""
    A, B = Vector(a), Vector(b); u, v = frame(B - A); rt = rw if rt is None else rt
    ring = lambda P: [tuple(P + u * (rw * math.cos(2 * math.pi * k / n)) + v * (rt * math.sin(2 * math.pi * k / n))) for k in range(n)]
    loft(bm, [ring(A), ring(B)], lambda *_: mat)

def lathe(bm, prof, origin, axis, segs, mat, closed=False):
    """Turned about an axis ('x' or 'z') through origin: prof is (radius, along the axis) pairs."""
    O = Vector(origin); rings = []
    for (r, a) in prof:
        ring = []
        for k in range(segs):
            ph = 2 * math.pi * k / segs; c, s = r * math.cos(ph), r * math.sin(ph)
            ring.append(tuple(O + (Vector((a, c, s)) if axis == 'x' else Vector((c, s, a)))))
        rings.append(ring)
    if closed: rings.append(rings[0])
    return loft(bm, rings, (mat if callable(mat) else (lambda *_: mat)), cap0=not closed and prof[0][0] > 0, cap1=not closed and prof[-1][0] > 0)

# ---------- the fuselage ----------
# (z, half-width, bottom, top, the section's squareness): a rounded box, the cowling's nose round, the cabin's top up
# under the wing, the turtle deck running down aft to the tail post
SECT = [(-3.32, 0.3, -0.29, 0.31, 2.4), (-3.18, 0.37, -0.38, 0.37, 2.6), (-2.9, 0.41, -0.45, 0.41, 2.8),
        (-2.6, 0.42, -0.48, 0.43, 2.9), (-2.3, 0.425, -0.50, 0.445, 3.0), (-1.93, 0.425, -0.51, 0.80, 3.0),
        (-1.0, 0.425, -0.50, 0.81, 3.0), (-0.4, 0.405, -0.46, 0.80, 3.0), (0.2, 0.36, -0.38, 0.63, 2.9),
        (1.2, 0.28, -0.22, 0.51, 2.8), (2.2, 0.18, -0.04, 0.43, 2.6), (2.9, 0.095, 0.10, 0.385, 2.4), (3.25, 0.03, 0.20, 0.34, 2.2)]
def section(z):
    """Catmull-Rom through SECT: hw, yc, hh, n."""
    zs = [s[0] for s in SECT]; i = clamp(next((k for k in range(len(zs) - 1) if z <= zs[k + 1]), len(zs) - 2), 0, len(zs) - 2)
    t = (z - zs[i]) / (zs[i + 1] - zs[i])
    def cr(k):
        p0, p1, p2, p3 = (SECT[clamp(j, 0, len(SECT) - 1)][k] for j in (i - 1, i, i + 1, i + 2))
        return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
    hw, yb, yt, n = cr(1), cr(2), cr(3), cr(4)
    return hw, (yb + yt) / 2, (yt - yb) / 2, n

COWL = -2.42                                         # the cowling's back edge
SCREEN = (-2.30, -1.93)                              # the windscreen, from the cowling up to the wing's leading edge
WINDOWS = [(-1.88, -1.06), (-1.0, -0.46)]            # the cabin's side windows, a door pillar between
def stripe(z): return 0.035 + max(0.0, z + 0.6) * 0.055   # the cheat line's middle, rising aft
STRIPE = 0.045
def w_lo(z): return 0.38 if z < -1.9 else 0.13
def w_hi(z): hw, yc, hh, n = section(z); return yc + hh - 0.07

def ring_at(z):
    """The section's outline: the starboard side from the keel up to the top through the rows the paint and the
    windows break at, then the port side back down."""
    hw, yc, hh, n = section(z)
    keys = sorted(clamp(y, yc - hh, yc + hh) for y in (stripe(z) - STRIPE, stripe(z) + STRIPE, w_lo(z), w_hi(z)))
    keys = [yc - hh] + keys + [yc + hh]
    th = lambda y: math.copysign(math.asin(clamp(abs((y - yc) / hh), 0, 1) ** (n / 2)), y - yc)
    segs = [5, 1, 2, 3, 4]
    side = [-math.pi / 2]
    for g in range(5):
        a, b = th(keys[g]), th(keys[g + 1])
        for k in range(1, segs[g] + 1): side.append(lerp(a, b, k / segs[g]))
    pt = lambda t, sx: (sx * hw * abs(math.cos(t)) ** (2 / n), yc + hh * math.copysign(abs(math.sin(t)) ** (2 / n), t), z)
    return [pt(t, 1) for t in side] + [pt(t, -1) for t in reversed(side[1:-1])]

def fuselage_mat(i, j, c):
    x, y, z = c
    if i < 0: return 'blue'                          # the nose ring (opened into the bowl below)
    if i >= len(FZ): return 'white'                  # the tail post
    if z < COWL: return 'blue'
    if SCREEN[0] < z < SCREEN[1] and y > w_lo(z) - 0.005: return 'glass'
    if any(a < z < b for a, b in WINDOWS) and w_lo(z) - 0.005 < y < w_hi(z) + 0.005 and abs(x) > 0.2: return 'glass'
    if abs(y - stripe(z)) < STRIPE: return 'blue'
    return 'white'

def build_fuselage(bm):
    global FZ
    FZ = sorted(set([round(-3.32 + k * 0.06, 3) for k in range(9)] + [COWL, -2.36, *SCREEN, WINDOWS[0][0], -1.6, -1.3,
               WINDOWS[0][1], WINDOWS[1][0], -0.7, WINDOWS[1][1], -0.2, 0.2, 0.6, 1.0, 1.4, 1.8, 2.2, 2.55, 2.9, 3.1, 3.25]))
    rings = [ring_at(z) for z in FZ]
    vs = loft(bm, rings, fuselage_mat, cap0=False, cap1=True)
    # the nose bowl: a lip turned in from the cowling's front, then its dark mouth set back round the spinner
    lip = [(x * 0.74, y * 0.74, -3.31) for (x, y, z) in rings[0]]
    deep = [(x * 0.7, y * 0.7, -3.2) for (x, y, z) in rings[0]]
    loft(bm, [rings[0], lip], lambda *_: 'blue', cap0=False, cap1=False)
    loft(bm, [lip, deep], lambda *_: 'dark', cap0=False, cap1=True)

# ---------- the wing ----------
WY, CH, ZLE, SPAN, DIH = 0.81, 1.6, -2.0, 10.7, math.radians(1.0)
WING = airfoil(12, 0.12, 0.03, 0.35)
def wing_y(x): return WY + abs(x) * math.tan(DIH)
def chord(x):
    s = abs(x)
    if s <= 4.95: return CH
    return CH * max(0.1, math.sqrt(max(0.0, 1 - ((s - 4.95) / 0.4) ** 2)))
def build_wing(bm):
    half = [0, 0.45, 1.5, 2.75, 3.4, 4.2, 4.9, 4.95, 5.05, 5.14, 5.22, 5.28, 5.32, 5.35]
    xs = [-x for x in reversed(half[1:])] + half
    rings = []
    for x in xs:
        c = chord(x); zle = ZLE + (CH - c) * 0.45; y0 = wing_y(x)
        rings.append([(x, y0 + c * ya, zle + c * xa) for (xa, ya) in WING])
    loft(bm, rings, lambda i, j, cen: 'blue' if abs(cen[0]) > 4.9 else 'white')
    # the navigation lights, in the tips' leading edges: red to port, green to starboard
    for sx, m in ((-1, 'red'), (1, 'green')):
        x = sx * 5.2; c = chord(x)
        lathe(bm, [(0.0, -0.05), (0.035, -0.035), (0.045, 0.0), (0.035, 0.035), (0.0, 0.05)],
              (x, wing_y(x) + 0.01, ZLE + (CH - c) * 0.45 + 0.04), 'z', 8, m)

def spar_under(x, frac):
    """Where a spar meets the wing's underside, at fraction frac of the chord."""
    c = chord(x); zle = ZLE + (CH - c) * 0.45
    lo = min((p for p in WING if p[1] < 0.02), key=lambda p: abs(p[0] - frac))
    return (x, wing_y(x) + c * lo[1] + 0.01, zle + c * frac)

def build_struts(bm):
    for sx in (-1, 1):
        root = (sx * 0.41, -0.40, -1.45)
        for frac in (0.2, 0.68):  # the front and rear lift struts, to the spars
            top = spar_under(sx * 2.75, frac)
            rod(bm, root, top, 0.055, 0.018, 'metal')
            # the jury strut, from halfway up the lift strut to the wing above it
            mid = tuple(lerp(root[k], top[k], 0.5) for k in range(3))
            rod(bm, mid, spar_under(mid[0], frac), 0.016, 0.01, 'metal', 6)
        # the main gear: V legs to the axle, the axle stub, the tyre and its hub
        axle = (sx * 0.86, -1.12, -1.92)
        rod(bm, (sx * 0.30, -0.49, -2.2), axle, 0.04, 0.022, 'metal')
        rod(bm, (sx * 0.30, -0.48, -1.48), axle, 0.04, 0.022, 'metal')
        rod(bm, axle, (sx * 0.98, -1.12, -1.92), 0.025, None, 'metal', 6)
        tyre = [(0.13, -0.08), (0.22, -0.096), (0.27, -0.09), (0.296, -0.06), (0.302, 0.0), (0.296, 0.06), (0.27, 0.09), (0.22, 0.096), (0.13, 0.08)]
        tyre = [(r, sx * a) for (r, a) in tyre]
        lathe(bm, tyre, (sx * 0.98, -1.12, -1.92), 'x', 20, 'dark', closed=True)
        lathe(bm, [(0.0, -0.09), (0.07, -0.09), (0.132, -0.075), (0.132, 0.075), (0.07, 0.09), (0.0, 0.09)],
              (sx * 0.98, -1.12, -1.92), 'x', 12, 'metal')

# ---------- the tail ----------
TAILY = 0.37
STAB = airfoil(8, 0.07)
def build_tail(bm):
    # the tailplane and elevators, their tips round
    def le(s): return 2.50 + (0.30 * (1 - math.sqrt(max(0.0, 1 - ((s - 0.6) / 0.4) ** 2))) if s > 0.6 else 0)
    def te(s): return 3.30 - (0.50 * (1 - math.sqrt(max(0.0, 1 - ((s - 0.5) / 0.5) ** 2))) if s > 0.5 else 0)
    ss = [1, 0.985, 0.95, 0.9, 0.82, 0.72, 0.6, 0.5, 0.3, 0]
    xs = [-1.6 * s for s in ss] + [1.6 * s for s in reversed(ss[:-1])]
    rings = []
    for x in xs:
        s = abs(x) / 1.6; a, b = le(s), te(s); c = max(0.04, b - a)
        rings.append([(x, TAILY + c * ya, a + c * xa) for (xa, ya) in STAB])
    loft(bm, rings, lambda *_: 'white')
    # the fin and rudder, round topped, the rudder's trailing edge just abaft the tail post
    H = 1.2
    def fle(u): return 2.30 + 0.62 * u + (0.14 * (1 - math.sqrt(max(0.0, 1 - ((u - 0.7) / 0.3) ** 2))) if u > 0.7 else 0)
    def fte(u): return 3.32 - (0.26 * (1 - math.sqrt(max(0.0, 1 - ((u - 0.55) / 0.45) ** 2))) if u > 0.55 else 0)
    FIN = airfoil(8, 0.09)
    rings = []
    for u in [0, 0.2, 0.4, 0.55, 0.65, 0.75, 0.83, 0.9, 0.95, 0.98, 1.0]:
        a, b = fle(u), fte(u); c = max(0.03, b - a)
        rings.append([(c * ya, 0.26 + u * H, a + c * xa) for (xa, ya) in FIN])
    loft(bm, rings, lambda *_: 'blue')
    # the white tail light on the rudder's trailing edge
    lathe(bm, [(0.0, -0.03), (0.025, 0.0), (0.0, 0.03)], (0, 0.55, 3.33), 'z', 6, 'white')
    # the bracing: from the fin down to the tailplane, and from the tailplane down to the fuselage's foot
    for sx in (-1, 1):
        rod(bm, (0, 1.05, 2.95), (sx * 1.0, TAILY + 0.02, 2.9), 0.012, None, 'metal', 4)
        rod(bm, (sx * 1.0, TAILY - 0.02, 2.9), (sx * 0.05, 0.13, 2.85), 0.012, None, 'metal', 4)
    # the tail wheel on its leaf spring, and the tow hook beside it
    rod(bm, (0, 0.2, 2.9), (0, -0.0, 3.17), 0.035, 0.012, 'metal', 6)
    lathe(bm, [(0.04, -0.025), (0.085, -0.025), (0.1, 0.0), (0.085, 0.025), (0.04, 0.025)], (0, -0.05, 3.2), 'x', 12, 'dark', closed=True)
    rod(bm, (0, 0.22, 3.12), (0, 0.02, 3.25), 0.018, None, 'metal', 6)

# ---------- the nose ----------
def build_nose(bm):
    # the spinner, in front of the nose bowl's mouth
    lathe(bm, [(0.17, -3.2), (0.17, -3.33), (0.162, -3.41), (0.14, -3.49), (0.1, -3.56), (0.05, -3.605), (0.0, -3.62)], (0, 0, 0), 'z', 16, 'metal')
    # the exhaust stack under the cowling, to starboard
    rod(bm, (0.16, -0.40, -2.62), (0.2, -0.55, -2.3), 0.03, None, 'metal', 8)

# ---------- the propeller (its own object) ----------
PROP = airfoil(6, 0.1, 0.03)
def build_prop(bm):
    rs = [0.15, 0.25, 0.4, 0.55, 0.7, 0.84, 0.86, 0.91, 0.935, 0.95]
    for sign in (1, -1):
        rings = []
        for r in rs:
            c = 0.17 - 0.06 * (r / 0.95) if r < 0.9 else (0.17 - 0.06 * 0.95) * math.sqrt(max(0.05, 1 - ((r - 0.9) / 0.05) ** 2))
            beta = math.atan(1.5 / (2 * math.pi * max(r, 0.2)))  # the blade's pitch, fine at the tip
            ring = []
            for (xa, ya) in PROP:
                cc, tt = (xa - 0.35) * c, ya * c
                # the chord lies mostly across the turning direction (y), tilted forward by the pitch
                ring.append((sign * r, sign * (cc * math.cos(beta) - tt * math.sin(beta)), -3.40 - (cc * math.sin(beta) + tt * math.cos(beta))))
            rings.append(ring)
        loft(bm, rings, lambda i, j, cen: 'tip' if abs(cen[0]) > 0.86 else 'prop')

# ---------- build and export ----------
def make(name, mats, builders):
    global IDX
    IDX = {m: i for i, m in enumerate(mats)}
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    for m in mats: me.materials.append(MAT[m])
    bm = bmesh.new()
    for b in builders: b(bm)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(32))
    print(name, 'verts', len(me.vertices), 'tris', sum(len(p.vertices) - 2 for p in me.polygons))
    return ob

for o in list(bpy.data.objects): bpy.data.objects.remove(o)
plane = make('plane', ORDER, [build_fuselage, build_wing, build_struts, build_tail, build_nose])
prop = make('prop', ['prop', 'tip'], [build_prop])
bpy.ops.object.select_all(action='DESELECT'); plane.select_set(True); prop.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                          export_texcoords=False, export_normals=True, export_materials='EXPORT', export_extras=False,
                          export_animations=False, export_skins=False, export_morph=False, export_cameras=False, export_lights=False)
print('wrote', OUT, os.path.getsize(OUT))
