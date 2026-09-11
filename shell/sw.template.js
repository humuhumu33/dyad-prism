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
//  4. Published applications: a .holo the page verified through PrismPM's validator in the core is
//     unpacked into the holo cache under <base>holo/<kappa>/ and served from there on any device;
//     a missing entry hands the URL to the runner page, which finds the bytes in the store or asks
//     for the file; <base>holo/<kappa>.holo downloads the bytes. A published application carries the
//     empty capability baseline, so every cross origin request from under holo/ is refused and audited.
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
    await cache.addAll(m.files.map((f) => f.path).concat(["manifest.json", "provenance.json"]).map((p) => new Request(p, { cache: "reload" })));
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
  const page = clients.find((c) => c.url.startsWith(self.registration.scope) && !/^(p|holo)\//.test(new URL(c.url).pathname.slice(BASE.length)));
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
async function principalOf(e) {
  if (!e.clientId) return null;
  const c = await self.clients.get(e.clientId);
  if (!c) return null;
  const m = new URL(c.url).pathname.slice(BASE.length).match(/^(p|holo)\/([^/]+)\//);
  return m ? { kind: m[1], id: m[2] } : null;
}

// ---- published applications
async function holoBytes(id) { const db = await openDb(); return new Promise((res, rej) => { const q = db.transaction("objects", "readonly").objectStore("objects").get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); }
async function serveHolo(request, path) {
  const rest = path.slice("holo/".length);
  const download = rest.match(/^([^/]+)\.holo$/);
  if (download) {
    const bytes = await holoBytes(download[1]);
    if (!bytes) return new Response("no application " + download[1], { status: 404 });
    return new Response(bytes, { headers: { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=\"" + download[1].replace(/^blake3:/, "") + ".holo\"" } });
  }
  const slash = rest.indexOf("/");
  if (slash < 0) return Response.redirect(request.url + "/", 302);
  const id = rest.slice(0, slash);
  let file = rest.slice(slash + 1) || "index.html";
  if (file.endsWith("/")) file += "index.html";
  const cache = await caches.open("holo");
  const hit = await cache.match(BASE + "holo/" + id + "/" + file);
  if (hit) return hit;
  if (file === "index.html" || !file.includes(".")) {
    const runner = (await caches.match("holo.html")) || (await fetch(new Request(BASE + "holo.html", { cache: "no-store" })).catch(() => null));
    if (runner && runner.ok) return new Response(await runner.text(), { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  }
  return new Response("no application file " + id + "/" + file, { status: 404 });
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin) {
    const path = url.pathname.slice(BASE.length);
    if (ENDPOINT.has(path)) { event.respondWith(serveFromPage(event.request, path)); return; }
    if (path.startsWith("holo/")) { event.respondWith(serveHolo(event.request, path)); return; }
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
    const who = await principalOf(event);
    if (!who) return fetch(event.request);
    // A published application carries the empty baseline: nothing is admitted, every request audited.
    const caps = who.kind === "holo" ? { network: { endpoints: [] } } : await grants(who.id);
    const endpoints = (caps && caps.network && caps.network.endpoints) || [];
    const allowed = caps ? endpoints.some((ep) => url.origin === ep) : true;
    if (caps) await audit({ principal: who.kind + ":" + who.id, operation: "holo.capability.authorize", resource: url.origin, outcome: allowed ? "granted" : "refused" });
    if (allowed) return fetch(event.request);
    return new Response("refused by capabilities: " + url.origin, { status: 403, headers: { "content-type": "text/plain" } });
  })());
});
