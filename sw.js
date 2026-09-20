self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title || "곰채팅", {
    body: data.body || "새 메시지가 도착했어요.",
    tag: data.tag || "gomchat-message",
    data: { url: data.url || "/" }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(clients => {
    const open = clients.find(client => new URL(client.url).origin === self.location.origin);
    return open ? open.focus() : self.clients.openWindow(url);
  }));
});
