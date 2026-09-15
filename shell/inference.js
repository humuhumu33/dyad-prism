// Inference on the page, shared by the landing page (shell.js) and the builder's host (host.js).
// Adapters only: the rules are in core.wasm, generated from the Lean verified model (the route table,
// the preimages, the OpenAI wire, the OpenRouter request); the engine is Hologram Q's snapshot under
// q/; addresses are BLAKE3 from the holospaces wasm; seals live in the device store. No server is
// contacted except Hugging Face, once, for the model's blocks, and OpenRouter with the visitor's own
// key on the paid route.

const BASE = new URL("./", import.meta.url);
const enc = new TextEncoder();
export const short = (k) => (k ? String(k).replace(/^blake3:/, "").replace("did:holo:sha256:", "").slice(0, 12) + "…" : "");

// ---- the verified core, through its JSON ABI
let core = null, coreLoading = null;
export function coreReady() {
  if (core) return Promise.resolve(core);
  if (coreLoading) return coreLoading;
  coreLoading = (async () => {
    const { instance } = await WebAssembly.instantiateStreaming(fetch(new URL("core.wasm", BASE)), {});
    const { memory, holo_alloc, holo_free, holo_run } = instance.exports;
    core = {
      run(request) {
        const bytes = enc.encode(JSON.stringify(request));
        const ptr = holo_alloc(bytes.length);
        new Uint8Array(memory.buffer, ptr, bytes.length).set(bytes);
        const packed = holo_run(ptr, bytes.length);
        const outPtr = Number(packed >> 32n), outLen = Number(packed & 0xffffffffn);
        const text = new TextDecoder().decode(new Uint8Array(memory.buffer, outPtr, outLen));
        holo_free(outPtr, outLen); holo_free(ptr, bytes.length);
        const out = JSON.parse(text);
        if (out.error) throw new Error(out.error);
        return out;
      },
    };
    return core;
  })();
  return coreLoading;
}
export let VIEW = null;
export async function viewReady() { if (VIEW) return VIEW; const inline = document.getElementById("view"); VIEW = inline ? JSON.parse(inline.textContent) : (await coreReady()).run({ op: "view" }); return VIEW; }

// ---- BLAKE3 addresses from the holospaces wasm (the same κ every daemon computes)
let kappaFn = null;
export async function kappaReady() {
  if (kappaFn) return kappaFn;
  const mod = await import(new URL("q/pkg/holospaces_web.js", BASE).href);
  if (typeof mod.default === "function") { try { await mod.default(); } catch (e) {} }
  kappaFn = (bytes) => String(mod.kappa(bytes));
  return kappaFn;
}
export async function kappa(bytes) { return (await kappaReady())(bytes); }

// ---- the device store: one database for the builder and the seals. Seals are rows keyed by κ,
// indexed by kind and by memo prompt κ; the builder's own stores sit beside them.
export const DB = "dyad-prism", DB_VERSION = 2;
export const STORES = ["settings", "apps", "chats", "files", "objects", "refs", "versions", "audit"];
let dbHandle = null;
export function db() {
  if (dbHandle) return Promise.resolve(dbHandle);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
      if (!d.objectStoreNames.contains("seals")) { const s = d.createObjectStore("seals", { keyPath: "id" }); s.createIndex("kind", "kind"); s.createIndex("promptKappa", "promptKappa"); }
    };
    req.onsuccess = () => resolve((dbHandle = req.result)); req.onerror = () => reject(req.error);
  });
}
export async function sealPut(kind, value, extra = {}) {
  const bytes = enc.encode(typeof value === "string" ? value : JSON.stringify(value));
  const id = await kappa(bytes);
  const d = await db();
  await new Promise((res, rej) => { const t = d.transaction("seals", "readwrite"); t.objectStore("seals").put({ id, kind, value, created: Date.now(), ...extra }); t.oncomplete = res; t.onerror = () => rej(t.error); });
  return id;
}
export async function sealGet(id) {
  const d = await db();
  return new Promise((res, rej) => { const r = d.transaction("seals").objectStore("seals").get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function byPrompt(promptKappa) {
  const d = await db();
  return new Promise((res, rej) => { const r = d.transaction("seals").objectStore("seals").index("promptKappa").getAll(promptKappa); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); });
}

// ---- settings: Dyad's own record, one place for the key and the chosen model
export async function settingsGet() { const d = await db(); return new Promise((res, rej) => { const r = d.transaction("settings").objectStore("settings").get("user"); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); }); }
export async function settingsPut(s) { const d = await db(); await new Promise((res, rej) => { const t = d.transaction("settings", "readwrite"); t.objectStore("settings").put(s, "user"); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
export async function deviceKeyGet() { const s = await settingsGet(); const v = s && s.providerSettings && s.providerSettings.openrouter && s.providerSettings.openrouter.apiKey && s.providerSettings.openrouter.apiKey.value; return v ? String(v) : ""; }
// The site may include a key of its own (warmup.json, written at deploy time from a repository secret,
// never in the tree): it counts as a key for the route and warm up rules and answers every visitor
// while their local model loads; the visitor's own key wins over it.
export const site = { key: "", model: "", ready: null };
export function siteKeyReady() {
  if (!site.ready) site.ready = fetch(new URL("warmup.json", BASE), { cache: "no-store" }).then(async (r) => { if (r.ok) { const j = await r.json(); site.key = String(j.key || ""); site.model = String(j.model || ""); } }).catch(() => {}).then(() => site.key);
  return site.ready;
}
export async function keyGet() { return (await deviceKeyGet()) || (await siteKeyReady()); }
export async function keySet(value) { const s = (await settingsGet()) || {}; s.providerSettings = { ...(s.providerSettings || {}), openrouter: { ...((s.providerSettings || {}).openrouter || {}), apiKey: { value } } }; await settingsPut(s); }
// Who answers: local (the Q engine) or paid (an OpenRouter model). Read from and written to the same
// selectedModel Dyad's settings page and composer use.
export const MODEL_ID = "webgpu:BitNet";
export const paidId = (model) => model.replace(/^openrouter\//, "");
export async function readWho() {
  const s = await settingsGet();
  const m = s && s.selectedModel;
  if (m && m.provider === "openrouter" && m.name) return { provider: "paid", model: paidId(m.name) };
  return { provider: "local", model: "" };
}
export async function writeWho(w) {
  const s = (await settingsGet()) || {};
  s.selectedModel = w.provider === "paid" ? { provider: "openrouter", name: w.model } : { provider: "local", name: MODEL_ID };
  await settingsPut(s);
}

// ---- memo: the core owns the preimages and the route, the wasm owns the address, the store owns the rest
export async function keyOf(body) {
  const c = await coreReady();
  const pre = c.run({ op: "preimages", request: body });
  return { promptKappa: await kappa(enc.encode(pre.prompt)), paramsKappa: await kappa(enc.encode(pre.params)) };
}
export async function lookup(body) {
  const key = await keyOf(body);
  const memos = (await byPrompt(key.promptKappa)).filter((o) => o.kind === "memo" && o.value.paramsKappa === key.paramsKappa && o.value.model.includes(body.model)).sort((a, b) => b.created - a.created);
  for (const m of memos) {
    const receipt = await sealGet(m.value.receipt); const answer = await sealGet(m.value.outputKappa);
    if (!receipt || !answer) continue;
    if (receipt.kind === "or-receipt") {
      if ((await kappa(enc.encode(JSON.stringify(receipt.value)))) !== receipt.id || (await kappa(enc.encode(answer.value))) !== answer.id) continue;
      return { hit: true, text: answer.value, receipt: m.value.receipt, rec: receipt.value, paid: true, fingerprint: `${receipt.value.model};${receipt.value.provider || ""};${receipt.value.fingerprint || ""}` };
    }
    const { verifyIntegrity } = await import(new URL("q/core/kappa.js", BASE).href);
    if (!(await verifyIntegrity(receipt.value)).ok) continue;
    return { hit: true, text: answer.value, receipt: m.value.receipt, rec: receipt.value, fingerprint: `${receipt.value.body["prov:used"]["holo:model"]};${receipt.value.body["prov:used"]["holo:engine"]}` };
  }
  return { hit: false, key };
}
export async function seal(body, rec, key) {
  const receipt = await sealPut("q-receipt", { id: rec.id, body: rec.body, text: rec.text, promptText: rec.promptText, ctxIds: rec.ctxIds, turnIds: rec.turnIds, outIds: rec.outIds, params: rec.params });
  const outputKappa = await sealPut("answer", rec.text);
  const used = rec.body["prov:used"] || {};
  const memo = { iri: "https://freeinference.ai/memo/v1", model: [used["holo:model"], body.model], engineKappa: used["holo:engine"] || "", promptKappa: key.promptKappa, paramsKappa: key.paramsKappa, outputKappa, receipt };
  await sealPut("memo", memo, { promptKappa: key.promptKappa });
  return receipt;
}
export async function sealPaid(body, rec, key) {
  const receipt = await sealPut("or-receipt", rec);
  const outputKappa = await sealPut("answer", rec.text);
  const memo = { iri: "https://freeinference.ai/memo/v1", model: [rec.model, body.model], engineKappa: "openrouter:" + (rec.provider || ""), promptKappa: key.promptKappa, paramsKappa: key.paramsKappa, outputKappa, receipt };
  await sealPut("memo", memo, { promptKappa: key.promptKappa });
  return receipt;
}

// ---- the engine: Hologram Q on WebGPU, resident across turns, warm KV as q-brain-fast does it
export const engine = { instance: null, model: null, mods: null, session: null, loading: null, onState: () => {}, onReady: () => {} };
const sigOf = (list) => (list || []).map((m) => (m.role || "") + (m.content || "")).join("");
const tailFor = (M, u) => M.llama3 ? `<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n${u || ""}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n` : null;
export function gpuReady() {
  if (engine.instance) return Promise.resolve(engine.instance);
  if (engine.loading) return engine.loading;
  engine.loading = (async () => {
    const q = (p) => new URL("q/core/" + p, BASE).href;
    const [L, E, F] = await Promise.all([import(q("loader.js")), import(q("engine.js")), import(q("q-brain-fast.mjs"))]);
    engine.mods = { L, E, F }; engine.model = L.MODELS.find((m) => m.fam === "BitNet");
    const V = await viewReady();
    engine.onState(V.loadingLabel); await L.ready();
    const loaded = await L.loadModel(engine.model, {
      onStatus: () => engine.onState(V.loadingLabel),
      onProgress: (d, t) => engine.onState(t ? `${V.loadingLabel} · ${Math.round((d / t) * 100)}%` : V.loadingLabel),
    });
    if (!loaded || !loaded.gpu) throw new Error("model load failed");
    engine.instance = await E.createEngine(engine.model, loaded);
    engine.onState("");
    engine.onReady();
    return engine.instance;
  })().catch((err) => { engine.loading = null; throw err; });
  return engine.loading;
}
export function gpuIds(inst, messages) {
  const last = messages[messages.length - 1];
  if (engine.session && messages.length >= 2 && last && last.role === "user") {
    const tail = tailFor(engine.model, last.content);
    if (tail != null && sigOf(messages.slice(0, -1)) === engine.session.sig) return { ids: engine.session.ids.concat(inst.tokenize(tail)), warm: true };
  }
  let ids = inst.tokenize(engine.mods.F.frameHistory(engine.model, messages));
  if (engine.model.bos && inst.bosId != null) ids = [inst.bosId, ...ids];
  return { ids, warm: false };
}
export function rememberSession(messages, res, text) { if (res.ids && text && !res.error) engine.session = { ids: res.ids.slice(), sig: sigOf(messages.concat([{ role: "assistant", content: text }])) }; }
let gpuBusy = Promise.resolve();
export function withEngine(fn) { const run = gpuBusy.then(fn, fn); gpuBusy = run.catch(() => {}); return run; }

// ---- the paid route: OpenRouter with the visitor's key. The request bytes are the model's encoder.
const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";
export async function paidGenerate(body, onDelta, signal) {
  const c = await coreReady(); const key = await keyGet(); const V = await viewReady();
  const bytes = c.run({ op: "encode-openrouter-request", model: paidId(body.model), request: body, stream: true }).bytes;
  const r = await fetch(OPENROUTER, { method: "POST", signal, headers: { Authorization: "Bearer " + key, "content-type": "application/json", "HTTP-Referer": location.origin, "X-Title": "dyad-prism" }, body: bytes });
  if (!r.ok) {
    let msg = ""; try { msg = (await r.json()).error.message; } catch (e) {}
    const word = r.status === 401 ? V.noKeyLabel : r.status === 402 ? V.noCreditLabel : V.providerBusyLabel;
    throw Object.assign(new Error(word), { status: r.status, detail: msg });
  }
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "", text = "", last = null, first = null;
  const t0 = performance.now();
  for (;;) {
    const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      let j; try { j = JSON.parse(line.slice(6)); } catch (e) { continue; }
      if (j.error) throw new Error(V.providerBusyLabel);
      last = j; const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
      if (d) { if (first === null) first = performance.now() - t0; text += d; if (onDelta) onDelta(text); }
    }
  }
  if (!text.trim()) throw new Error(V.providerBusyLabel);
  const usage = (last && last.usage) || {};
  const rec = { kind: "openrouter", id: last && last.id, model: (last && last.model) || paidId(body.model), provider: last && last.provider, fingerprint: (last && last.system_fingerprint) || "", usage: { prompt: usage.prompt_tokens || 0, completion: usage.completion_tokens || 0 }, cost: String(usage.cost ?? ""), text: text.trim(), rederivable: false, ttftMs: Math.round(first || 0) };
  return { text: rec.text, rec };
}

// ---- the route: the model's table decides who answers
export async function routeOf(hit, body) {
  const c = await coreReady();
  return c.run({ op: "route", hit: !!hit.hit, provider: body.model.startsWith("openrouter/") ? "paid" : "local", gpuReady: !!navigator.gpu, keyPresent: !!(await keyGet()), online: navigator.onLine }).route;
}
export async function refusalWord(route) { const V = await viewReady(); return { NoKey: V.noKeyLabel, NoGpu: V.noGpuLabel, PaidOffline: V.paidOfflineLabel }[route]; }
export async function modelFor(who) { const V = await viewReady(); return who.provider === "paid" ? "openrouter/" + (who.model || V.paidModels[0].id) : MODEL_ID; }

// ---- the endpoint: one function answers an OpenAI request, memo first, then the engine. Every byte
// it returns is encoded by the verified core. Two transports carry it and compute nothing: the
// service worker on this origin, and the one file relay for native harnesses.
const wire = (op, extra) => core.run({ op, ...extra }).bytes;
function completionOf(id, text, fingerprint, receipt, model = MODEL_ID) { return { id, created: String(Math.floor(Date.now() / 1000)), model, text, fingerprint, receipt }; }
async function requestOf(raw) {
  const V = await viewReady();
  const messages = raw.messages.map((m) => ({ role: m.role || "user", content: Array.isArray(m.content) ? m.content.map((p) => (p && p.text) || "").join("\n") : String(m.content ?? "") }));
  const maxTokens = raw.max_completion_tokens ?? raw.max_tokens;
  const who = await readWho();
  const model = typeof raw.model === "string" && raw.model.startsWith("openrouter/") ? raw.model : who.provider === "paid" ? "openrouter/" + (who.model || V.paidModels[0].id) : MODEL_ID;
  return { model, messages, max_tokens: Number.isInteger(maxTokens) && maxTokens > 0 ? Math.min(maxTokens, 2048) : 512, temperature: raw.temperature == null ? "" : String(raw.temperature), seed: raw.seed };
}
export async function serve(raw, sink) {
  await coreReady(); const V = await viewReady();
  if (!raw || !Array.isArray(raw.messages) || !raw.messages.length) {
    return { status: 400, bytes: wire("encode-error", { message: "messages must not be empty", type: "invalid_request_error" }), headers: {} };
  }
  const body = await requestOf(raw);
  const hit = await lookup(body);
  const rt = await routeOf(hit, body);
  const word = await refusalWord(rt);
  if (word) return { status: rt === "NoKey" ? 401 : 503, bytes: wire("encode-error", { message: word, type: rt === "NoKey" ? "authentication_error" : "server_error" }), headers: {} };
  if (rt === "Serve") {
    const c = completionOf("chatcmpl-" + hit.receipt.replace("blake3:", "").slice(0, 12), hit.text, hit.fingerprint, hit.receipt, body.model);
    const headers = { "x-hologram-receipt": hit.receipt, "x-hologram-reuse": "1", "x-hologram-stream": sink ? "memo" : "plain", "x-hologram-provider": hit.paid ? "openrouter" : "local" };
    if (!sink) return { status: 200, bytes: wire("encode-completion", { completion: c }), headers };
    sink.head(headers);
    sink.frame(wire("encode-role", { completion: c })); sink.frame(wire("encode-delta", { completion: c, delta: hit.text }));
    sink.frame(wire("encode-final", { completion: c })); sink.frame(wire("done"));
    return { status: 200, headers };
  }
  if (rt === "Paid") {
    const c = completionOf("chatcmpl-" + Math.random().toString(16).slice(2, 14), "", "", "", body.model);
    let sent = "";
    if (sink) { sink.head({ "x-hologram-stream": "native", "x-hologram-provider": "openrouter" }); sink.frame(wire("encode-role", { completion: c })); }
    const { text, rec } = await paidGenerate(body, (t) => { if (sink && t.startsWith(sent) && t.length > sent.length) { sink.frame(wire("encode-delta", { completion: c, delta: t.slice(sent.length) })); sent = t; } });
    const receipt = await sealPaid(body, rec, hit.key);
    const done = { ...c, text, fingerprint: `${rec.model};${rec.provider || ""};${rec.fingerprint || ""}`, receipt, model: body.model };
    const headers = { "x-hologram-receipt": receipt, "x-hologram-stream": sink ? "native" : "plain", "x-hologram-provider": "openrouter", "x-hologram-cost": rec.cost };
    if (!sink) return { status: 200, bytes: wire("encode-completion", { completion: done }), headers };
    if (text.length > sent.length && text.startsWith(sent)) sink.frame(wire("encode-delta", { completion: done, delta: text.slice(sent.length) }));
    sink.frame(wire("encode-final", { completion: done })); sink.frame(wire("done"));
    return { status: 200, headers };
  }
  const inst = await gpuReady();
  const messages = body.messages;
  const c = completionOf("chatcmpl-" + Math.random().toString(16).slice(2, 14), "", "", "");
  if (sink) { sink.head({ "x-hologram-stream": "native" }); sink.frame(wire("encode-role", { completion: c })); }
  let sent = "";
  const { ids, warm } = gpuIds(inst, messages);
  const res = await withEngine(() => inst.generate(ids, { maxNew: body.max_tokens, onToken: ({ text }) => {
    if (sink && text.startsWith(sent) && text.length > sent.length) { sink.frame(wire("encode-delta", { completion: c, delta: text.slice(sent.length) })); sent = text; }
  } }));
  const text = (res.text || "").trim();
  rememberSession(messages, res, text);
  const promptText = (messages.filter((m) => m.role === "user").slice(-1)[0] || {}).content || "";
  const rec = await inst.buildReceipt({ promptText, ctxIds: [], turnIds: ids, outIds: res.outIds });
  const receipt = await seal(body, rec, hit.key);
  const used = rec.body["prov:used"] || {};
  const done = { ...c, text, fingerprint: `${used["holo:model"]};${used["holo:engine"]}`, receipt };
  const headers = { "x-hologram-receipt": receipt, "x-hologram-stream": sink ? "native" : "plain", "x-hologram-warm": warm ? "1" : "0" };
  if (!sink) return { status: 200, bytes: wire("encode-completion", { completion: done }), headers };
  if (text.length > sent.length && text.startsWith(sent)) sink.frame(wire("encode-delta", { completion: done, delta: text.slice(sent.length) }));
  sink.frame(wire("encode-final", { completion: done })); sink.frame(wire("done"));
  return { status: 200, headers };
}
export async function modelsBytes() { await coreReady(); const V = await viewReady(); return wire("encode-models", { ids: [MODEL_ID].concat(V.paidModels.map((m) => "openrouter/" + m.id)) }); }

// Transport 1: the service worker hands each /v1 request on this origin to this page over a
// MessageChannel: {head:{status,headers}} once, then {frame} per wire frame, then {done}.
if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", async (event) => {
  const { endpoint, body } = event.data || {}; const port = event.ports && event.ports[0];
  if (!port || !endpoint) return;
  const json = (status, bytes, headers = {}) => { port.postMessage({ head: { status, headers: { "content-type": "application/json", ...headers } } }); port.postMessage({ frame: bytes, done: true }); };
  try {
    await coreReady();
    if (endpoint === "v1/models") return json(200, await modelsBytes());
    let raw; try { raw = JSON.parse(body || ""); } catch (e) { return json(400, wire("encode-error", { message: "request is not JSON", type: "invalid_request_error" })); }
    if (!raw.stream) { const out = await serve(raw, null); return json(out.status, out.bytes, out.headers); }
    let headed = false;
    const sink = {
      head: (headers) => { if (!headed) { headed = true; port.postMessage({ head: { status: 200, headers: { "content-type": "text/event-stream", "cache-control": "no-cache", ...headers } } }); } },
      frame: (bytes) => port.postMessage({ frame: "data: " + bytes + "\n\n" }),
    };
    const out = await serve(raw, sink);
    if (!headed) return json(out.status, out.bytes, out.headers);
    port.postMessage({ done: true });
  } catch (err) { try { json(500, wire("encode-error", { message: err.message, type: "server_error" })); } catch (e) {} }
});

// Transport 2: the relay. When freeinference-relay.py runs on this machine, this tab serves its jobs.
export const RELAY_PORT = Number(new URLSearchParams(location.search).get("relay")) || 11435;
export const RELAY = `http://127.0.0.1:${RELAY_PORT}`;
const TAB_ID = (() => { try { const k = "holo.tab.v1"; let id = sessionStorage.getItem(k); if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())).replace(/-/g, "").slice(0, 12); sessionStorage.setItem(k, id); } return id; } catch (e) { return String(Math.random()).slice(2, 14); } })();
const CONNECT = "holo.connect.v1";
export const readConnect = () => { try { return JSON.parse(localStorage.getItem(CONNECT) || "null") || {}; } catch (e) { return {}; } };
export const writeConnect = (c) => { try { localStorage.setItem(CONNECT, JSON.stringify(c)); } catch (e) {} };
export const relay = { token: "", running: false, timer: null, state: "off", seen: false, other: "", onState: () => {}, sheetOpen: () => false };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tabHeaders = () => ({ "X-Freeinference-Tab": relay.token || "hello", "X-Freeinference-Tab-Id": TAB_ID });
function setRelayState(state, other) {
  if (state === "connected") relay.seen = true;
  if (state === relay.state && (other || "") === relay.other) return;
  relay.state = state; relay.other = other || ""; relay.onState();
}
async function relayLoop() {
  if (relay.running) return; relay.running = true;
  try {
    for (;;) {
      let job = null;
      try {
        const r = await fetch(RELAY + "/tab/next", { cache: "no-store", headers: tabHeaders() });
        if (r.status === 200) job = await r.json();
        else if (r.status === 409) { setRelayState("second", ((await r.json()).serving || "")); await sleep(5000); continue; }
        else if (r.status === 403) { relay.token = ""; scheduleWatch(2000); return; }
        else if (r.status !== 204) { await sleep(2000); continue; }
        setRelayState("connected");
      } catch (e) { setRelayState("listening"); scheduleWatch(); return; }
      if (!job) continue;
      const post = (action, payload) => fetch(`${RELAY}/tab/${job.id}/${action}`, { method: "POST", headers: { "content-type": "application/json", ...tabHeaders() }, body: JSON.stringify(payload) }).catch(() => {});
      try {
        await coreReady();
        if (job.op === "models") { await post("result", { bytes: await modelsBytes(), headers: {} }); continue; }
        const raw = job.request || {};
        if (!raw.stream) { const out = await serve(raw, null); await post(out.status === 200 ? "result" : "fail", out.status === 200 ? { bytes: out.bytes, headers: out.headers } : { message: JSON.parse(out.bytes).error.message }); continue; }
        let chain = Promise.resolve();
        const sink = { head: (headers) => { chain = chain.then(() => post("head", { headers })); }, frame: (bytes) => { chain = chain.then(() => post("frame", { bytes })); } };
        const out = await serve(raw, sink); await chain;
        if (out.bytes) await post("fail", { message: JSON.parse(out.bytes).error.message });
      } catch (err) { await post("fail", { message: err.message }); }
    }
  } finally { relay.running = false; }
}
export function scheduleWatch(ms) { clearTimeout(relay.timer); relay.timer = setTimeout(relayWatch, ms ?? (relay.sheetOpen() ? 2000 : 10000)); }
export async function relayWatch() {
  if (!readConnect().enabled) return;
  try {
    const r = await fetch(RELAY + "/tab/hello", { cache: "no-store", headers: tabHeaders() });
    if (r.ok) { const h = await r.json(); relay.token = h.token || ""; setRelayState("connected"); relayLoop(); return; }
  } catch (e) {}
  setRelayState("listening"); scheduleWatch();
}
export { setRelayState };
