// The page origin's worker is the kernel of the shell. Three duties, no server behind any of them:
//  1. The shell as one versioned closure: manifest.json, written by the projector, lists every shell
//     file with its SHA-256; the cache is named by the closure digest, so a new release is a new
//     cache and a stale worker never serves a mixed shell. Only shell caches are ever dropped; the
//     previews cache and the engine's part cache belong to the page.
//  2. The endpoint on this origin: v1/chat/completions and v1/models are answered by the open page,
//     which routes the request, runs the model or serves the seal, and encodes every byte through
//     the verified core. The worker only carries the request to a window client over a
//     MessageChannel and streams its frames back.
//  3. Previews and the capability gate: each project's preview is served under <base>p/<kappa>/
//     from the previews cache the host fills after every in-tab build; a cross origin request made
//     by a preview frame is admitted only when that project's grants list the origin, and every
//     decision is appended to the audit store, hologram-live's audit row shape.
const CLOSURE = "__CLOSURE__";   // written by the projector; a new shell is a new worker
const BASE = new URL(self.registration.scope).pathname;

async function readManifest() {
  const r = await fetch("manifest.json", { cache: "no-store" });
  return r.json();
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const m = await readManifest();
    if (m.closure !== CLOSURE) throw new Error("manifest closure does not match this worker");
    const cache = await caches.open("shell-" + CLOSURE);
    // Fetch every shell file fresh at install: the HTTP cache must not hand an older byte into a
    // closure whose digest says otherwise.
    await cache.addAll(m.files.map((f) => f.path).concat(["manifest.json"]).map((p) => new Request(p, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = "shell-" + CLOSURE;
    for (const name of await caches.keys()) if (name.startsWith("shell-") && name !== keep) await caches.delete(name);
    await self.clients.claim();
  })());
});

// ---- the endpoint
const ENDPOINT = new Set(["v1/chat/completions", "v1/models"]);
async function serveFromPage(request, path) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const page = clients.find((c) => c.url.startsWith(self.registration.scope) && !new URL(c.url).pathname.slice(BASE.length).startsWith("p/"));
  if (!page) return new Response(JSON.stringify({ error: { message: "open the page and leave it open", type: "server_error" } }), { status: 503, headers: { "content-type": "application/json" } });
  const body = request.method === "POST" ? await request.text() : "";
  const channel = new MessageChannel();
  const headers = new Headers();
  let resolveHead; const head = new Promise((r) => (resolveHead = r));
  const stream = new ReadableStream({
    start(controller) {
      channel.port1.onmessage = ({ data }) => {
        if (data.head) { resolveHead(data.head); return; }
        if (data.frame != null) controller.enqueue(new TextEncoder().encode(data.frame));
        if (data.done) controller.close();
      };
    },
  });
  page.postMessage({ endpoint: path, method: request.method, body }, [channel.port2]);
  const h = await head;
  for (const [k, v] of Object.entries(h.headers || {})) headers.set(k, v);
  return new Response(stream, { status: h.status || 200, headers });
}

// ---- previews and the capability gate
const openDb = () => new Promise((res, rej) => { const r = indexedDB.open("dyad-prism", 2); r.onupgradeneeded = () => { const d = r.result; for (const s of ["settings", "apps", "chats", "files", "objects", "refs", "versions", "audit"]) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); if (!d.objectStoreNames.contains("seals")) { const st = d.createObjectStore("seals", { keyPath: "id" }); st.createIndex("kind", "kind"); st.createIndex("promptKappa", "promptKappa"); } }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function audit(record) { const db = await openDb(); await new Promise((res, rej) => { const t = db.transaction("audit", "readwrite"); t.objectStore("audit").put({ timestamp_millis: Date.now(), ...record }, Date.now() + ":" + record.resource); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
async function grants(id) { const db = await openDb(); return new Promise((res, rej) => { const q = db.transaction("refs", "readonly").objectStore("refs").get("capabilities:" + id); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); }
async function previewIdOf(e) {
  if (!e.clientId) return null;
  const c = await self.clients.get(e.clientId);
  if (!c) return null;
  const m = new URL(c.url).pathname.slice(BASE.length).match(/^p\/([^/]+)\//);
  return m ? m[1] : null;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin) {
    const path = url.pathname.slice(BASE.length);
    if (ENDPOINT.has(path)) { event.respondWith(serveFromPage(event.request, path)); return; }
    if (path.startsWith("p/")) {
      const id = path.split("/")[1];
      event.respondWith((async () => {
        const cache = await caches.open("previews");
        const hit = await cache.match(BASE + "p/" + id + "/index.html");
        return hit || new Response("no preview " + id, { status: 404 });
      })());
      return;
    }
    if (event.request.method !== "GET") return;
    event.respondWith((async () => {
      const hit = await caches.match(event.request, { ignoreSearch: true });
      if (hit) return hit;
      try {
        return await fetch(event.request);
      } catch (error) {
        if (event.request.mode === "navigate") return (await caches.match("index.html")) || (await caches.match("./"));
        throw error;
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const id = await previewIdOf(event);
    if (!id) return fetch(event.request);
    const caps = await grants(id);
    const endpoints = (caps && caps.network && caps.network.endpoints) || [];
    const allowed = caps ? endpoints.some((ep) => url.origin === ep) : true;
    if (caps) await audit({ principal: "preview:" + id, operation: "holo.capability.authorize", resource: url.origin, outcome: allowed ? "granted" : "refused" });
    if (allowed) return fetch(event.request);
    return new Response("refused by capabilities: " + url.origin, { status: 403, headers: { "content-type": "text/plain" } });
  })());
});
