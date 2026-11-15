// An in-memory stand-in for net.js's realtime(): every client made from one hub hears the others' broadcasts on
// the same topic, and hears its own only with { self: true }. With no latency, synchronously; with `latency` ms (on
// the clock `now`), each broadcast is held that long and delivered by pump(), in the order sent.
export function memoryRealtime({ latency = 0, now = null } = {}) {
  const topics = new Map(); // topic -> Set<channel>
  const held = []; // { due, to, event, payload }
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
            if (latency > 0) held.push({ due: now() + latency, to: other, event, payload: p });
            else other._deliver(event, p);
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
