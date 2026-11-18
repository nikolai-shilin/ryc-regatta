// Compiling the shaders aside (world.js prepare). three's own compileAsync waits on each material's program, and throws
// from its timer when a material is disposed while it waits (the graphics level changed under it): that wait then never
// ends, and the picture stands still until prepare gives up on it. Here a material with no program any more isn't
// waited for. The renderer's properties are read anew each time: it makes new ones when the graphics come back.
export function compileReady(r, scene, camera) {
  const mats = r.compile(scene, camera);
  return new Promise((res) => {
    const poll = () => {
      for (const m of mats) { const p = r.properties.get(m).currentProgram; if (!p || p.isReady()) mats.delete(m); }
      if (mats.size) setTimeout(poll, 10); else res(scene);
    };
    poll();
  });
}

// three reads each program's logs the first time it draws with it, to report a shader that doesn't compile. With the
// graphics lost (a phone short of memory) those logs are null and it throws, so the check is left to a developer's machine.
export const checkShaders = (host) => /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/.test(host);
