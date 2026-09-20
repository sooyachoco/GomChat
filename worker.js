export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");
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
  constructor(state) {
    this.state = state;
    this.sessions = new Map();
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket required", { status: 426 });
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
        if (msg.type !== "message" || !msg.text) return;
        const item = { id: crypto.randomUUID(), name: String(msg.name || "익명").slice(0, 20), text: String(msg.text).slice(0, 2000), time: new Date().toISOString() };
        const current = (await this.state.storage.get("messages")) || [];
        current.push(item);
        if (current.length > 500) current.splice(0, current.length - 500);
        await this.state.storage.put("messages", current);
        const payload = JSON.stringify({ type: "message", message: item });
        for (const ws of this.sessions.values()) {
          try { ws.send(payload); } catch (_) {}
        }
      } catch (_) {}
    });
    const close = () => this.sessions.delete(id);
    server.addEventListener("close", close);
    server.addEventListener("error", close);
    return new Response(null, { status: 101, webSocket: client });
  }
}
