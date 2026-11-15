// An in-memory stand-in for net.js's realtime(): every client made from one hub hears the others' broadcasts on
// the same topic, synchronously, and hears its own only with { self: true }.
export function memoryRealtime() {
  const topics = new Map(); // topic -> Set<channel>
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
            other._deliver(event, JSON.parse(JSON.stringify(payload ?? null)));
          }
        },
        on(event, fn) { if (!handlers.has(event)) handlers.set(event, []); handlers.get(event).push(fn); },
        leave() { joined = false; topics.get(topic)?.delete(ch); },
        _deliver(event, payload) { for (const fn of handlers.get(event) || []) fn(payload); },
      };
      return ch;
    },
    close() { topics.clear(); },
  };
}
