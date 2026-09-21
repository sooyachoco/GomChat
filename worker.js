import { sendPushNotification } from "@mmmike/web-push/send";

const PUSH_USER = "승수";
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");

    if (url.pathname === "/api/push/subscribe" && request.method === "POST") {
      try {
        const body = await request.json();
        if (String(body.name || "") !== PUSH_USER) return new Response("forbidden", { status: 403 });
        const sub = body.subscription || {};
        if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth || !String(sub.endpoint).startsWith("https://")) {
          return new Response("invalid subscription", { status: 400 });
        }
        const id = env.CHAT_ROOM.idFromName("default");
        return env.CHAT_ROOM.get(id).fetch(new Request("https://internal/push/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: body.name, subscription: sub })
        }));
      } catch (_) {
        return new Response("bad request", { status: 400 });
      }
    }

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket required", { status: 426 });
      const room = url.searchParams.get("room") || "default";
      const id = env.CHAT_ROOM.idFromName(room);
      return env.CHAT_ROOM.get(id).fetch(request);
    }
    return new Response("GomChat API", { headers: { "content-type": "text/plain; charset=utf-8" } });
  }
};

export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  async pruneOldMessages() {
    const current = (await this.state.storage.get("messages")) || [];
    const cutoff = Date.now() - RETENTION_MS;
    const next = current.filter(m => {
      const t = Date.parse(m.time || "");
      return Number.isFinite(t) && t >= cutoff;
    });
    if (next.length !== current.length) await this.state.storage.put("messages", next);
    return next;
  }

  async scheduleCleanup() {
    const alarm = await this.state.storage.getAlarm();
    if (alarm == null) await this.state.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);
  }

  async alarm() {
    try {
      const current = (await this.state.storage.get("messages")) || [];
      const cutoff = Date.now() - RETENTION_MS;
      const next = current.filter(m => {
        const t = Date.parse(m.time || "");
        return Number.isFinite(t) && t >= cutoff;
      });
      if (next.length !== current.length) {
        await this.state.storage.put("messages", next);
        const payload = JSON.stringify({ type: "history_pruned" });
        for (const ws of this.sessions.values()) { try { ws.send(payload); } catch (_) {} }
      }
    } finally {
      await this.state.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);
    }
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/push/subscribe" && request.method === "POST") {
      try {
        const body = await request.json();
        if (String(body.name || "") !== PUSH_USER) return new Response("forbidden", { status: 403 });
        const sub = body.subscription || {};
        if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth || !String(sub.endpoint).startsWith("https://")) {
          return new Response("invalid subscription", { status: 400 });
        }
        const subs = (await this.state.storage.get("pushSubscriptions")) || [];
        const next = subs.filter(s => s.endpoint !== sub.endpoint);
        next.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
        if (next.length > 5) next.splice(0, next.length - 5);
        await this.state.storage.put("pushSubscriptions", next);
        await this.scheduleCleanup();
        return new Response("ok");
      } catch (_) {
        return new Response("bad request", { status: 400 });
      }
    }

    if (url.pathname === "/push/list" && request.method === "GET") {
      return Response.json((await this.state.storage.get("pushSubscriptions")) || []);
    }

    if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket required", { status: 426 });
    await this.pruneOldMessages();
    await this.scheduleCleanup();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const id = crypto.randomUUID();
    this.sessions.set(id, server);
    const history = (await this.state.storage.get("messages")) || [];
    server.send(JSON.stringify({ type: "history", messages: history }));
    server.addEventListener("message", async event => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "delete") {
          const messageId = String(msg.messageId || "");
          const requester = String(msg.name || "").slice(0, 20);
          if (!messageId || !requester) return;
          const current = (await this.state.storage.get("messages")) || [];
          const target = current.find(m => m.id === messageId);
          if (!target || target.name !== requester) return;
          const next = current.filter(m => m.id !== messageId);
          await this.state.storage.put("messages", next);
          const payload = JSON.stringify({ type: "delete", messageId });
          for (const ws of this.sessions.values()) { try { ws.send(payload); } catch (_) {} }
          return;
        }
        if (msg.type !== "message") return;
        const name = String(msg.name || "익명").slice(0, 20);
        const text = String(msg.text || "").slice(0, 2000);
        const image = typeof msg.image === "string" ? msg.image : "";
        if (!text && !image) return;
        if (image && (!image.startsWith("data:image/") || image.length > 450000)) return;
        const item = { id: crypto.randomUUID(), name, text, image, time: new Date().toISOString() };
        const current = await this.pruneOldMessages();
        current.push(item);
        if (current.length > 500) current.splice(0, current.length - 500);
        await this.state.storage.put("messages", current);
        await this.scheduleCleanup();
        const payload = JSON.stringify({ type: "message", message: item });
        for (const ws of this.sessions.values()) { try { ws.send(payload); } catch (_) {} }
        if (name === "지연") await this.sendPushToMe(item);
      } catch (_) {}
    });
    const close = () => this.sessions.delete(id);
    server.addEventListener("close", close);
    server.addEventListener("error", close);
    return new Response(null, { status: 101, webSocket: client });
  }

  async sendPushToMe(item) {
    const publicKey = this.env.VAPID_PUBLIC_KEY;
    const privateKey = this.env.VAPID_PRIVATE_KEY;
    const subject = this.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) return;
    const subs = (await this.state.storage.get("pushSubscriptions")) || [];
    if (!subs.length) return;
    const stale = new Set();
    for (const sub of subs) {
      try {
        const delivered = await sendPushNotification(sub, {
          title: "곰채팅",
          body: item.text ? item.text.slice(0, 100) : "사진을 보냈어요.",
          url: "/",
          tag: "gomchat-message"
        }, { publicKey, privateKey, subject }, { ttl: 86400, urgency: "high", topic: "gomchat-message" });
        if (!delivered) stale.add(sub.endpoint);
      } catch (_) {}
    }
    if (stale.size) await this.state.storage.put("pushSubscriptions", subs.filter(s => !stale.has(s.endpoint)));
  }
}
