// Regatta: a jointed figure in one draw. A sailor or a gull is a handful of rigid parts on joints that move; drawn as
// separate meshes each part costs a draw (and another in the shadow and the sea's mirror). Here the joints become
// bones, posed exactly as the groups they replace, and every part is skinned rigidly (weight 1) to its bone in one
// geometry, so the whole figure is one SkinnedMesh.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// parts: [geometry, bone, colour?] — a colour (a THREE.Color) paints the part's vertices for a vertexColors material;
// without one the geometry brings its own. root: the top bone (it goes in the mesh); sphere: bounds every pose.
export function rigidSkin(parts, bones, root, material, sphere) {
  const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), material);
  mesh.add(root); mesh.updateMatrixWorld(true); // the rest pose: where each part sits on its bone
  mesh.geometry = mergeGeometries(parts.map(([geo, bone, c]) => {
    const p = geo.clone().applyMatrix4(bone.matrixWorld), n = p.attributes.position.count, b = bones.indexOf(bone);
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = b; sw[i * 4] = 1; }
    p.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    p.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    if (c) {
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      p.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    return p;
  }));
  mesh.bind(new THREE.Skeleton(bones));
  mesh.boundingSphere = sphere.clone(); // the pose moves the parts: a fixed sphere round all of them, not the rest pose's
  return mesh;
}
