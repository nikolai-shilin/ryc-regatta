// A dependency-free Supabase Realtime client (broadcast only), over one WebSocket shared by every channel.
// Phoenix v1.0.0 frames: { topic, event, payload, ref, join_ref }. Reconnects after 1, 2, 5, then every 10 s and
// rejoins every channel; a channel the server drops (phx_error, phx_close) is joined again after the same ladder; a send
// before its channel's join is answered is dropped. A heartbeat unanswered by the next one drops the socket: every 25 s
// by default (a dead link noticed in under 50 s), every 5 s in a match (setHeartbeat: under 10 s). reconnect() drops it
// at once and connects again (the page back from the background, the network back, a race gone quiet); lastHeard() is
// when the server last said anything (the match's host doesn't count its guest silent while its own link is in doubt).
const HEARTBEAT_MS = 25000;
const JOIN_MS = 10000;
const RETRY_MS = [1000, 2000, 5000, 10000];

export function realtime({ url, key, WebSocket = globalThis.WebSocket, heartbeat = HEARTBEAT_MS, now = Date.now }) {
  const wsUrl = `${String(url).replace(/^http/, 'ws').replace(/\/+$/, '')}/realtime/v1/websocket?apikey=${key}&vsn=1.0.0`;
  const channels = new Map(); // 'realtime:' + topic -> channel state
  let sock = null, hb = null, hbRef = null, retry = null, tries = 0, closed = false, ref = 0, hbMs = heartbeat, heard = now();

  const nextRef = () => String(++ref);
  const raw = (frame) => { if (sock && sock.readyState === 1) sock.send(JSON.stringify(frame)); };

  function sendJoin(c) {
    c.joined = false;
    c.joinRef = nextRef();
    raw({ topic: c.topic, event: 'phx_join', ref: c.joinRef, join_ref: c.joinRef, payload: {
      config: { broadcast: { self: c.self, ack: false }, presence: { key: '', enabled: false }, postgres_changes: [], private: false },
      access_token: key,
    } });
  }

  function connect() {
    if (closed || sock) return;
    const s = new WebSocket(wsUrl);
    sock = s;
    s.onopen = () => {
      if (sock !== s) return;
      tries = 0; heard = now();
      beat(s);
      for (const c of channels.values()) { clearTimeout(c.rejoin); c.rejoin = null; sendJoin(c); }
    };
    s.onmessage = (e) => {
      if (sock !== s) return;
      heard = now();
      let f; try { f = JSON.parse(e.data); } catch { return; }
      if (f.topic === 'phoenix') { if (f.event === 'phx_reply' && f.ref === hbRef) hbRef = null; return; }
      const c = channels.get(f.topic);
      if (!c) return;
      if (f.event === 'phx_reply' && f.ref === c.joinRef) {
        if (f.payload?.status === 'ok') { c.joined = true; c.okAt = now(); clearTimeout(c.timer); c.resolve?.(); c.resolve = c.reject = null; }
        else if (c.reject) { clearTimeout(c.timer); c.reject(new Error('join refused: ' + JSON.stringify(f.payload?.response ?? f.payload))); c.resolve = c.reject = null; }
      } else if (f.event === 'phx_close' && f.ref && f.ref !== c.joinRef) {
        // an earlier join's close: a channel left and joined again at once is closed on the server after the new join
        // is answered (its ref is the old join's). Joining again on it would close the new join, and so on for ever
      } else if (f.event === 'phx_error' || f.event === 'phx_close') {
        rejoin(c); // the server dropped this channel: join it again, after a moment
      } else if (f.event === 'broadcast' && f.payload) {
        for (const fn of c.handlers.get(f.payload.event) || []) { try { fn(f.payload.payload); } catch (err) { console.error(err); } }
      }
    };
    s.onclose = () => lost(s);
    s.onerror = () => {};
  }

  // the heartbeat on socket s, every hbMs
  function beat(s) {
    clearInterval(hb);
    hbRef = null;
    hb = setInterval(() => {
      if (hbRef) return lost(s); // the last heartbeat was never answered: a half-open socket
      hbRef = nextRef();
      raw({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: hbRef });
    }, hbMs);
  }

  // A channel the server dropped, joined again after the next delay in the ladder (a channel that stayed joined 30 s
  // starts the ladder again): a server that keeps refusing it isn't asked a dozen times a second.
  function rejoin(c) {
    c.joined = false;
    if (now() - (c.okAt ?? -Infinity) > 30000) c.tries = 0;
    const d = RETRY_MS[Math.min(c.tries++, RETRY_MS.length - 1)];
    clearTimeout(c.rejoin);
    c.rejoin = setTimeout(() => { c.rejoin = null; if (channels.get(c.topic) === c && sock && sock.readyState === 1) sendJoin(c); }, d);
  }

  // Socket s let go of: closed, its heartbeat and the channels' rejoins stopped.
  function drop(s) {
    sock = null;
    s.onopen = s.onmessage = s.onclose = s.onerror = null;
    try { s.close(); } catch {}
    hbRef = null;
    clearInterval(hb); hb = null;
    for (const c of channels.values()) { c.joined = false; clearTimeout(c.rejoin); c.rejoin = null; }
  }

  // The socket is gone, or is taken to be: close it, and retry after the next delay in the ladder.
  function lost(s) {
    if (sock !== s) return;
    drop(s);
    if (closed) return;
    const d = RETRY_MS[Math.min(tries++, RETRY_MS.length - 1)];
    retry = setTimeout(() => { retry = null; connect(); }, d);
  }

  return {
    channel(topic, { self = false } = {}) {
      const c = { topic: 'realtime:' + topic, self, handlers: new Map(), joined: false, joinRef: null, resolve: null, reject: null, rejoin: null, tries: 0, okAt: null };
      return {
        join() {
          return new Promise((resolve, reject) => {
            c.resolve = resolve; c.reject = reject;
            clearTimeout(c.timer);
            c.timer = setTimeout(() => { c.timer = null; if (c.reject) { c.reject(new Error('join timed out')); c.resolve = c.reject = null; } }, JOIN_MS);
            channels.set(c.topic, c);
            if (sock && sock.readyState === 1) sendJoin(c); else connect();
          });
        },
        send(event, payload) {
          if (!c.joined) return;
          raw({ topic: c.topic, event: 'broadcast', ref: nextRef(), join_ref: c.joinRef, payload: { type: 'broadcast', event, payload } });
        },
        on(event, fn) {
          if (!c.handlers.has(event)) c.handlers.set(event, []);
          c.handlers.get(event).push(fn);
        },
        leave() {
          if (channels.get(c.topic) !== c) return;
          raw({ topic: c.topic, event: 'phx_leave', ref: nextRef(), join_ref: c.joinRef, payload: {} });
          channels.delete(c.topic);
          c.joined = false;
          clearTimeout(c.timer); clearTimeout(c.rejoin); c.rejoin = null;
          if (c.reject) { c.reject(new Error('left before joined')); c.resolve = c.reject = null; }
        },
      };
    },
    // the heartbeat every ms from now on (on the open socket at once)
    setHeartbeat(ms) {
      hbMs = ms;
      if (sock && sock.readyState === 1) beat(sock);
    },
    // drop the socket now and connect again at once, rejoining every channel (no-op once closed)
    reconnect() {
      if (closed) return;
      clearTimeout(retry); retry = null;
      if (sock) drop(sock);
      tries = 0;
      connect();
    },
    // when the server last said anything (a heartbeat's answer, a broadcast, a join's), or the socket last opened
    lastHeard() { return heard; },
    close() {
      closed = true;
      clearInterval(hb); clearTimeout(retry);
      for (const c of channels.values()) clearTimeout(c.rejoin);
      channels.clear();
      const s = sock; sock = null;
      try { s?.close(); } catch {}
    },
  };
}
