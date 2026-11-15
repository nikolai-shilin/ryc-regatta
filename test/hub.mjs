// An in-memory stand-in for net.js's realtime(): every client made from one hub hears the others' broadcasts on
// the same topic, and hears its own only with { self: true }. With no latency, synchronously; with `latency` ms (on
// the clock `now`), each broadcast is held that long and delivered by pump(), in the order sent. `jitter` ms more, at
// random (seeded), each: still in the order sent to each receiver, as one socket delivers them (a late one holds up
// those behind it).
export function memoryRealtime({ latency = 0, jitter = 0, seed = 7, now = null } = {}) {
  const topics = new Map(); // topic -> Set<channel>
  const held = []; // { due, to, event, payload }, by due
  const lastDue = new Map(); // receiver -> the due of the last held for it
  let x = seed;
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  const pump = () => {
    while (held.length && held[0].due <= now()) { const m = held.shift(); m.to._deliver(m.event, m.payload); }
  };
  return {
    channel(topic, { self = false } = {}) {
      const handlers = new Map();
      let joined = false;
      const ch = {
        join() { joined = true; if (!topics.has(topic)) topics.set(topic, new Set()); topics.get(topic).add(ch); return Promise.resolve(); },
        send(event, payload) {
          if (!joined) return;
          for (const other of topics.get(topic) || []) {
            if (other === ch && !self) continue;
            const p = JSON.parse(JSON.stringify(payload ?? null));
            if (latency > 0 || jitter > 0) {
              const due = Math.max(now() + latency + jitter * rnd(), lastDue.get(other) ?? -Infinity);
              lastDue.set(other, due);
              let i = held.length; while (i > 0 && held[i - 1].due > due) i--;
              held.splice(i, 0, { due, to: other, event, payload: p });
            } else other._deliver(event, p);
          }
        },
        on(event, fn) { if (!handlers.has(event)) handlers.set(event, []); handlers.get(event).push(fn); },
        leave() { joined = false; topics.get(topic)?.delete(ch); },
        _deliver(event, payload) { for (const fn of handlers.get(event) || []) fn(payload); },
      };
      return ch;
    },
    pump,
    close() { topics.clear(); held.length = 0; },
  };
}
