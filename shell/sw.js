// The page origin's worker is the kernel of the shell. It serves each project's preview under
// <base>p/<kappa>/ from Cache Storage, which the host fills after every in-tab build, and it is the
// fetch gate: a request made by a preview frame to an origin no grant lists is refused here, and
// every decision is appended to the audit store (the audit.jsonl of the browser host). No server.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
const base = new URL(self.registration.scope).pathname; // "/" locally, "/dyad-prism/" on Pages

const openDb = () => new Promise((res, rej) => { const r = indexedDB.open("dyad-prism", 1); r.onupgradeneeded = () => { for (const s of ["settings", "apps", "chats", "files", "objects", "refs", "versions", "audit"]) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function audit(record) { const db = await openDb(); await new Promise((res, rej) => { const t = db.transaction("audit", "readwrite"); t.objectStore("audit").put({ ts: Date.now(), ...record }, Date.now() + ":" + record.resource); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
async function grants(id) { const db = await openDb(); return new Promise((res, rej) => { const q = db.transaction("refs", "readonly").objectStore("refs").get("capabilities:" + id); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); }

async function previewIdOf(e) {
  if (!e.clientId) return null;
  const c = await self.clients.get(e.clientId);
  if (!c) return null;
  const m = new URL(c.url).pathname.slice(base.length).match(/^p\/([^/]+)\//);
  return m ? m[1] : null;
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith(base + "p/")) {
    const id = url.pathname.slice(base.length).split("/")[1];
    e.respondWith((async () => {
      const cache = await caches.open("previews");
      const hit = await cache.match(base + "p/" + id + "/index.html");
      return hit || new Response("no preview " + id, { status: 404 });
    })());
    return;
  }
  if (url.origin === self.location.origin) return;
  e.respondWith((async () => {
    const id = await previewIdOf(e);
    if (!id) return fetch(e.request);
    const caps = await grants(id);
    const endpoints = (caps && caps.network && caps.network.endpoints) || [];
    const allowed = caps ? endpoints.some((ep) => url.origin === ep) : true;
    if (caps) await audit({ principal: "preview:" + id, operation: "holo.capability.authorize", resource: url.origin, outcome: allowed ? "granted" : "refused" });
    if (allowed) return fetch(e.request);
    return new Response("refused by capabilities: " + url.origin, { status: 403, headers: { "content-type": "text/plain" } });
  })());
});
