// The browser host: the surface src/preload.ts exposes as window.electron, implemented on the page
// with no server. Rules come from the generated core (core.wasm: preimage, restore, network, view);
// addresses are BLAKE3 over the bytes the core spells; records live in IndexedDB. Adapters only:
// nothing here decides, it derives, stores and forwards.
//
// Slices 1 and 2: settings, apps and their files, versions as kappa snapshots, chats as records,
// the preview worker, and the app run machine (build in the tab, serve at the version's address).
// The chat stream is the next slice.

const MARKER = "dyad-ipc-envelope-v1";
const BASE = new URL("./", import.meta.url); // the shell's directory, wherever it is served
const ok = (value) => ({ __dyadIpcEnvelope: MARKER, ok: true, value });
const fail = (message, kind = "not_found") => ({ __dyadIpcEnvelope: MARKER, ok: false, error: { name: "DyadError", message, kind } });
const listeners = new Map();
const handlers = new Map();
const seen = new Map();
const emit = (channel, payload) => { const set = listeners.get(channel); if (set) for (const fn of set) { try { fn(payload); } catch (e) { console.error(e); } } };

// ---- the generated core
const enc = new TextEncoder(), dec = new TextDecoder();
let core = null;
const coreReady = (async () => {
  const bytes = await (await fetch(new URL("core.wasm", BASE))).arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const { memory, holo_alloc, holo_free, holo_run } = instance.exports;
  return {
    run(op) {
      const input = enc.encode(JSON.stringify(op));
      const ptr = holo_alloc(input.length);
      new Uint8Array(memory.buffer, ptr, input.length).set(input);
      const packed = holo_run(ptr, input.length);
      const outPtr = Number(packed >> 32n), outLen = Number(packed & 0xffffffffn);
      const text = dec.decode(new Uint8Array(memory.buffer, outPtr, outLen));
      holo_free(outPtr, outLen);
      const value = JSON.parse(text);
      if (value.error) throw new Error(value.error);
      return value;
    },
  };
})().then((c) => (core = c));

// ---- addresses: BLAKE3 as hologram-live spells them, "blake3:" + 64 hex
let blake3 = null;
const kappaReady = import("https://esm.sh/@noble/hashes@1.7.1/blake3").then((m) => (blake3 = m.blake3));
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
async function kappa(bytes) { await kappaReady; return "blake3:" + hex(blake3(bytes)); }

// ---- the store
const DB = "dyad-prism";
const STORES = ["settings", "apps", "chats", "files", "objects", "refs", "versions", "audit"];
const dbReady = new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => { for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function tx(store, mode, fn) { const db = await dbReady; return new Promise((res, rej) => { const t = db.transaction(store, mode); const q = fn(t.objectStore(store)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
const get = (store, key) => tx(store, "readonly", (s) => s.get(key));
const put = (store, key, value) => tx(store, "readwrite", (s) => s.put(value, key));
const del = (store, key) => tx(store, "readwrite", (s) => s.delete(key));
const all = (store) => tx(store, "readonly", (s) => s.getAll());
const keys = (store) => tx(store, "readonly", (s) => s.getAllKeys());

// ---- settings
const DEFAULT_SETTINGS = {
  selectedModel: { name: "auto", provider: "auto" }, providerSettings: {}, telemetryConsent: "opted_out", telemetryUserId: "web",
  hasRunBefore: true, experiments: {}, enableProLazyEditsMode: false, enableProSmartFilesContextMode: false, selectedChatMode: "build",
  enableAppBlueprint: false, enableTestingForNewApps: false, enableAutoUpdate: false, releaseChannel: "stable", isRunning: false,
  enableSandboxScriptExecution: false, enableMcpToolSearch: false, enableCodeExplorer: false, runTypeScriptForWholeProject: false,
  enableMultiWindow: false, enableExplorerSubagent: false, enableAutoReview: false, enableReviewButton: false,
  enableImplementerSubagent: false, enableAdvancedSubagents: false, autoFixReviewIssues: false, autoApproveNonSchemaSql: true,
  autoExpandPreviewPanel: true, enableContextCompaction: true, enablePnpmMinimumReleaseAgeWarning: false,
  previewIdleTimeoutPolicy: "default", nodeRuntimePreference: "system", disablePreviewNodeAutoInstall: true,
};
handlers.set("get-user-settings", async () => (await get("settings", "user")) || DEFAULT_SETTINGS);
handlers.set("set-user-settings", async (patch) => { const s = { ...((await get("settings", "user")) || DEFAULT_SETTINGS), ...(patch || {}) }; await put("settings", "user", s); return s; });
handlers.set("get-env-vars", () => ({}));
handlers.set("get-system-platform", () => "web");
handlers.set("get-app-version", () => ({ version: "1.15.0-web" }));
handlers.set("native-theme:get-state", () => ({ shouldUseDarkColors: matchMedia("(prefers-color-scheme: dark)").matches }));
handlers.set("get-initial-load-telemetry-context", () => ({ isFirstSession: false, previousSessionAppSize: null }));
// The build engine is esbuild in the tab; Dyad asks for Node before it shows a preview, so the
// answer names the engine that will run: no Node is installed or needed.
handlers.set("nodejs-status", () => ({ nodeVersion: "browser (esbuild in the tab)", pnpmVersion: "browser", nodeDownloadUrl: "", source: "system", nodePath: null, managedNodeInstalled: false, managedNodeVersion: null, systemNodeTooOld: false, managedNodeSupported: false }));
handlers.set("window-infrastructure:bootstrap", () => ({ windowSessionId: "web-1", currentQueryInvalidationEpoch: 0, missedInvalidations: [], recoveryScopes: [], mayMigrateLegacyChatTabSession: false, restorableWindowSessionIds: [] }));
for (const c of ["window-infrastructure:set-focused", "window-infrastructure:set-visible-entities", "window-infrastructure:set-chat-tab-ownership", "add-log", "renderer:error-toast-ready", "clear-logs"]) handlers.set(c, () => undefined);
handlers.set("does-release-note-exist", () => ({ exists: false }));
handlers.set("get-user-budget", () => null);
handlers.set("get-subscription-status", () => null);
handlers.set("get-custom-apps-folder", () => ({ path: null, isCustom: false }));
handlers.set("get-node-path", () => null);
handlers.set("get-language-model-providers", () => []);
handlers.set("get-language-models-by-providers", () => ({}));
handlers.set("prompts:list", () => []);
handlers.set("list-all-media", () => ({ apps: [] }));
handlers.set("free-agent-quota:get-status", () => ({ messagesUsed: 0, messagesLimit: 5, isQuotaExceeded: false, windowStartTime: null, resetTime: null }));
handlers.set("get-themes", () => []);
handlers.set("get-custom-themes", () => []);
handlers.set("user-input:get-pending", () => []);
handlers.set("get-app-upgrades", () => []);
handlers.set("get-app-env-vars", () => []);
handlers.set("get-templates", () => []);
handlers.set("check-problems", () => ({ problems: [], totalErrors: 0, totalWarnings: 0 }));

// ---- apps and files. A file is stored under "<appId>:<path>"; the app record carries no files,
// get-app lists them. Every edit seals a version: the address of the project state.
const nextId = async (store) => { const ks = await keys(store); return ks.length ? Math.max(...ks.map(Number)) + 1 : 1; };
const nulls = { githubOrg: null, githubRepo: null, githubBranch: null, supabaseProjectId: null, supabaseParentProjectId: null, supabaseOrganizationSlug: null, neonProjectId: null, neonDevelopmentBranchId: null, neonPreviewBranchId: null, neonActiveBranchId: null, selectedDatabaseBranchType: null, vercelProjectId: null, vercelProjectName: null, vercelDeploymentUrl: null, vercelTeamId: null, installCommand: null, startCommand: null, chatContext: null, isFavorite: false, testingEnabled: false, collectionId: null };
const withDates = (a) => ({ ...a, createdAt: new Date(a.createdAt), updatedAt: new Date(a.updatedAt), resolvedPath: a.path });
async function filesOf(appId) {
  const ks = (await keys("files")).filter((k) => k.startsWith(appId + ":")).map((k) => k.slice(String(appId).length + 1)).sort();
  return ks;
}
async function entriesOf(appId) {
  const out = [];
  for (const path of await filesOf(appId)) { const bytes = enc.encode(await get("files", appId + ":" + path)); out.push({ path, kappa: await kappa(bytes), bytes: bytes.length }); }
  return out;
}
async function seal(appId, message) {
  await coreReady;
  const app = await get("apps", appId);
  const parent = (await get("refs", appId + ":main")) || "";
  const { bytes: preimage } = core.run({ op: "preimage", project: { label: app.name, entries: await entriesOf(appId) }, parent });
  const body = enc.encode(preimage);
  const k = await kappa(body);
  await put("objects", k, body);
  await put("refs", appId + ":main", k);
  const versions = (await get("versions", appId)) || [];
  versions.unshift({ oid: k, message, timestamp: Math.floor(Date.now() / 1000), dbTimestamp: null, isFavorite: false, note: null });
  await put("versions", appId, versions);
  emit("version-created", { appId, oid: k });
  return k;
}
let scaffold = null;
async function loadScaffold() {
  if (scaffold) return scaffold;
  const list = await (await fetch(new URL("scaffold/files.json", BASE))).json();
  const files = {};
  await Promise.all(list.map(async (p) => { files[p] = await (await fetch(new URL("scaffold/" + p, BASE))).text(); }));
  return (scaffold = files);
}
handlers.set("list-apps", async () => ({ apps: (await all("apps")).map(withDates) }));
handlers.set("get-app", async (id) => { const a = await get("apps", id); if (!a) throw new Error("no app " + id); return { ...withDates(a), files: await filesOf(id), frameworkType: "react-vite", supabaseProjectName: null, vercelTeamSlug: null }; });
handlers.set("check-app-name", async ({ appName }) => ({ exists: (await all("apps")).some((a) => a.name === appName) }));
handlers.set("preview-app-folder-name", async ({ appName }) => ({ folderName: appName }));
handlers.set("create-app", async ({ name, initialChatMode }) => {
  const id = await nextId("apps");
  const now = new Date().toISOString();
  const app = { id, name, path: name, createdAt: now, updatedAt: now, ...nulls };
  await put("apps", id, app);
  for (const [p, src] of Object.entries(await loadScaffold())) await put("files", id + ":" + p, src);
  const oid = await seal(id, "Init Dyad app");
  const chatId = await nextId("chats");
  await put("chats", chatId, { id: chatId, appId: id, title: name, messages: [], initialCommitHash: oid, dbTimestamp: null, chatMode: initialChatMode || "build", modelSelection: null, referencedApps: [] });
  return { app: withDates(app), chatId };
});
handlers.set("read-app-file", async ({ appId, filePath }) => { const c = await get("files", appId + ":" + filePath); if (c === undefined) throw new Error("no file " + filePath); return c; });
handlers.set("edit-app-file", async ({ appId, filePath, content }) => { await put("files", appId + ":" + filePath, content); await seal(appId, "Edit " + filePath); return { success: true, warning: null }; });
handlers.set("delete-app", async ({ appId }) => { for (const p of await filesOf(appId)) await del("files", appId + ":" + p); await del("apps", appId); await del("versions", appId); await del("refs", appId + ":main"); for (const c of await all("chats")) if (c.appId === appId) await del("chats", c.id); });
handlers.set("rename-app", async ({ appId, appName }) => { const a = await get("apps", appId); a.name = appName; a.path = appName; a.updatedAt = new Date().toISOString(); await put("apps", appId, a); return { app: withDates(a) }; });
handlers.set("search-app", async (q) => (await all("apps")).filter((a) => a.name.toLowerCase().includes(String(q || "").toLowerCase())).map(withDates));
handlers.set("search-app-files", async ({ appId, query }) => { const out = []; for (const p of await filesOf(appId)) { if (p.toLowerCase().includes(String(query || "").toLowerCase())) out.push({ path: p }); } return out; });
handlers.set("app:get-current-commit-hash", async ({ appId }) => (await get("refs", appId + ":main")) || null);
handlers.set("app:list-screenshots", () => ({ screenshots: [] }));
handlers.set("app:list-thumbnails", () => ({ thumbnails: [] }));
handlers.set("appCollections:list", () => []);

// ---- versions: a branch is a name pointing at an address; rollback restores the object at an
// address only when its bytes re-derive to it (the core's restore rule).
handlers.set("list-versions", async ({ appId }) => (await get("versions", appId)) || []);
handlers.set("get-current-branch", async () => ({ branch: "main" }));
handlers.set("get-version-changes", async () => ({ files: [] }));
handlers.set("set-version-favorite", async ({ appId, oid, isFavorite }) => { const v = (await get("versions", appId)) || []; for (const x of v) if (x.oid === oid) x.isFavorite = isFavorite; await put("versions", appId, v); });
handlers.set("set-version-note", async ({ appId, oid, note }) => { const v = (await get("versions", appId)) || []; for (const x of v) if (x.oid === oid) x.note = note; await put("versions", appId, v); });
async function restore(appId, oid) {
  await coreReady;
  const body = await get("objects", oid);
  if (!body) throw new Error("no object at " + oid);
  const derived = await kappa(body);
  const { decision } = core.run({ op: "restore", derived, expected: oid });
  await put("audit", Date.now() + ":" + oid, { ts: Date.now(), operation: "snapshot.restore", resource: oid, outcome: decision });
  if (decision !== "Accept") throw new Error("refused: bytes at " + oid.slice(0, 22) + " re-derive to " + derived.slice(0, 22));
  // The preimage names entries by address; the file bytes are looked up by their own addresses.
  const state = JSON.parse(dec.decode(body));
  for (const p of await filesOf(appId)) await del("files", appId + ":" + p);
  for (const [path, k] of state.entries) { const bytes = await get("objects", k); if (bytes) await put("files", appId + ":" + path, dec.decode(bytes)); }
  await put("refs", appId + ":main", oid);
  return oid;
}
handlers.set("checkout-version", async ({ appId, versionId }) => { await restore(appId, versionId); });
handlers.set("revert-version", async ({ appId, previousVersionId }) => { await restore(appId, previousVersionId); await seal(appId, "Revert to " + previousVersionId.slice(0, 22)); return { successMessage: "Reverted" }; });

// ---- chats as records; the stream is the next slice
handlers.set("get-chats", async (appId) => (await all("chats")).filter((c) => appId == null || c.appId === appId).map((c) => ({ id: c.id, appId: c.appId, title: c.title, createdAt: new Date(c.createdAt || Date.now()) })));
handlers.set("get-chat", async (id) => { const c = await get("chats", id); if (!c) throw new Error("no chat " + id); return c; });
handlers.set("get-chat-metadata", async (id) => { const c = await get("chats", id); return c ? { id: c.id, appId: c.appId, title: c.title } : null; });
handlers.set("create-chat", async (appId) => { const id = await nextId("chats"); await put("chats", id, { id, appId, title: "New chat", messages: [], initialCommitHash: null, dbTimestamp: null, chatMode: "build", modelSelection: null, referencedApps: [] }); return id; });
handlers.set("update-chat", async ({ chatId, title }) => { const c = await get("chats", chatId); if (c && title) c.title = title; if (c) await put("chats", chatId, c); });
handlers.set("delete-chat", async (id) => { await del("chats", id); });
handlers.set("search-chats", () => []);
handlers.set("chat:count-tokens", () => ({ totalTokens: 0, messageHistoryTokens: 0, codebaseTokens: 0, mentionedAppsTokens: 0, inputTokens: 0, systemPromptTokens: 0, contextWindow: 128000 }));

// ---- the app run machine. Dyad's renderer talks to app running as a remote machine: it subscribes
// to a key and dispatches intents; the host owns the state and publishes snapshots. Here START builds
// the project in the tab (esbuild-wasm, dependencies through an import map) and serves it through
// the worker under the model's previewPath of the head address; PROXY_READY is the snapshot with
// phase ready and that url. No process is spawned anywhere.
const machines = new Map(); // "app_run:<appId>" -> { revision, state }
const caps = (phase) => ({ canStart: phase === "idle" || phase === "stopped" || phase === "errored", canRestart: phase === "ready", canRebuild: phase === "ready", canStop: phase === "ready" || phase === "starting", canReload: phase === "ready" });
function machineOf(appId) {
  const key = "app_run:" + appId;
  if (!machines.has(key)) machines.set(key, { revision: 0, state: { appId, revision: 0, previewReloadEpoch: 0, phase: "idle", operation: null, startedAt: null, url: null, operationError: null, exit: null, capabilities: caps("idle"), invocationRef: null, lastSettlement: null } });
  return machines.get(key);
}
function publish(appId, patch) {
  const m = machineOf(appId);
  m.revision += 1;
  m.state = { ...m.state, ...patch, revision: m.revision, capabilities: caps(patch.phase || m.state.phase) };
  emit("distributed-machine:snapshot", { protocolVersion: 1, machineId: "app_run", encodedKey: { appId }, actorInstanceId: "web-app_run-" + appId, revision: m.revision, encodedState: m.state });
  return m;
}
let esbuildReady = null;
async function esbuild() {
  if (!esbuildReady) esbuildReady = import("https://cdn.jsdelivr.net/npm/esbuild-wasm@0.25.5/esm/browser.min.js").then(async (m) => { await m.initialize({ wasmURL: "https://cdn.jsdelivr.net/npm/esbuild-wasm@0.25.5/esbuild.wasm" }); return m; });
  return esbuildReady;
}
async function buildPreview(appId) {
  await coreReady;
  const head = await get("refs", appId + ":main");
  const { path } = core.run({ op: "preview", kappa: head });
  const appUrl = new URL(path.slice(1), BASE);
  const files = new Map();
  for (const p of await filesOf(appId)) files.set(p, await get("files", appId + ":" + p));
  const pkg = await (await fetch(new URL("scaffold/package.json", BASE))).json();
  const pkgs = Object.fromEntries(Object.entries(pkg.dependencies).map(([n, v]) => [n, v.replace(/^[\^~]/, "")]));
  const react = pkgs.react, dom = pkgs["react-dom"];
  const imports = { react: `https://esm.sh/react@${react}`, "react/": `https://esm.sh/react@${react}/`, "react-dom": `https://esm.sh/react-dom@${dom}?external=react`, "react-dom/": `https://esm.sh/react-dom@${dom}&external=react/` };
  for (const [n, v] of Object.entries(pkgs)) { if (n === "react" || n === "react-dom") continue; imports[n] = `https://esm.sh/${n}@${v}?external=react,react-dom`; imports[n + "/"] = `https://esm.sh/${n}@${v}&external=react,react-dom/`; }
  const tw = await (await fetch(new URL("scaffold/tailwind.config.ts", BASE))).text();
  const m = tw.match(/theme:\s*(\{[\s\S]*\n  \}),\n  plugins/);
  const tailwindConfig = m ? "{darkMode:['class'],theme:" + m[1] + "}" : "{}";
  const exts = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];
  const resolveFile = (p) => { for (const e of exts) if (files.has(p + e)) return p + e; return null; };
  const plugin = { name: "project", setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === "entry-point") { const r = resolveFile(args.path); if (r) return { path: r, namespace: "project" }; }
      if (args.path.startsWith("@/")) { const r = resolveFile("src/" + args.path.slice(2)); if (r) return { path: r, namespace: "project" }; }
      if (/^\.\.?\//.test(args.path) || args.path.startsWith("/")) {
        const base = args.importer ? args.importer.split("/").slice(0, -1).join("/") : "src";
        const norm = new URL(args.path, "file:///" + base + "/").pathname.slice(1);
        const r = resolveFile(norm); if (r) return { path: r, namespace: "project" };
        return { errors: [{ text: "not in project: " + norm }] };
      }
      return { path: args.path, external: true };
    });
    b.onLoad({ filter: /.*/, namespace: "project" }, (args) => {
      const src = files.get(args.path);
      if (args.path.endsWith(".css")) return { contents: src.replace(/@tailwind[^;]*;/g, ""), loader: "css" };
      return { contents: src, loader: args.path.endsWith(".tsx") ? "tsx" : args.path.endsWith(".ts") ? "ts" : "jsx" };
    });
  } };
  const es = await esbuild();
  const r = await es.build({ entryPoints: ["src/main.tsx"], bundle: true, write: false, format: "esm", target: "es2022", jsx: "automatic", plugins: [plugin], outdir: "out", logLevel: "silent",
    define: { "import.meta.env.DEV": "true", "import.meta.env.MODE": '"development"', "import.meta.env.BASE_URL": JSON.stringify(appUrl.pathname), "process.env.NODE_ENV": '"development"' } });
  const js = r.outputFiles.find((f) => f.path.endsWith(".js")).text;
  const css = (r.outputFiles.find((f) => f.path.endsWith(".css")) || { text: "" }).text;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script type="importmap">${JSON.stringify({ imports })}<\/script>
<script>tailwind = { config: ${tailwindConfig} };<\/script>
<script src="https://cdn.tailwindcss.com"><\/script>
<style>${css}</style></head><body><div id="root"></div>
<script type="module">${js}<\/script></body></html>`;
  const cache = await caches.open("previews");
  await cache.put(appUrl.pathname + "index.html", new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }));
  return { appUrl: appUrl.href, bytes: js.length };
}
handlers.set("distributed-machine:subscribe", async ({ machineId, encodedKey }) => {
  if (machineId !== "app_run") throw new Error("no browser machine " + machineId);
  const m = machineOf(encodedKey.appId);
  return { protocolVersion: 1, machineId, encodedKey, actorInstanceId: "web-app_run-" + encodedKey.appId, revision: m.revision, encodedState: m.state };
});
handlers.set("distributed-machine:unsubscribe", () => undefined);
handlers.set("distributed-machine:dispatch", async ({ machineId, encodedKey, messageId, encodedEvent }) => {
  if (machineId !== "app_run") throw new Error("no browser machine " + machineId);
  const appId = encodedKey.appId, type = encodedEvent && encodedEvent.type;
  const receipt = (m) => ({ kind: "applied", actorInstanceId: "web-app_run-" + appId, revision: m.revision, transactionSequence: m.revision, messageId });
  if (type === "START" || type === "RESTART" || type === "MANUAL_RELOAD") {
    const op = type === "START" ? "run" : type === "RESTART" ? (encodedEvent.operation === "rebuild" ? "rebuild" : "restart") : "reload";
    const m = publish(appId, { phase: type === "MANUAL_RELOAD" ? "reloading" : "starting", operation: op, startedAt: Date.now(), operationError: null, exit: null });
    (async () => {
      try {
        const { appUrl } = await buildPreview(appId);
        const cur = machineOf(appId);
        publish(appId, { phase: "ready", operation: null, url: { appUrl, originalUrl: appUrl, mode: "cloud" }, previewReloadEpoch: cur.state.previewReloadEpoch + 1, lastSettlement: { operationId: encodedEvent.operationId || messageId, kind: "run", outcome: "succeeded" } });
      } catch (e) {
        publish(appId, { phase: "errored", operation: null, operationError: { message: String((e && e.message) || e) }, lastSettlement: { operationId: encodedEvent.operationId || messageId, kind: "run", outcome: "failed", error: { message: String((e && e.message) || e) } } });
      }
    })();
    return receipt(m);
  }
  if (type === "STOP_REQUESTED") {
    const m = publish(appId, { phase: "stopped", operation: null, url: null, exit: { exitCode: 0, timestamp: Date.now() }, lastSettlement: { operationId: encodedEvent.operationId || messageId, kind: "stop", outcome: "succeeded" } });
    return receipt(m);
  }
  return { kind: "ignored", actorInstanceId: "web-app_run-" + appId, revision: machineOf(appId).revision, messageId, reason: "unknown intent " + type };
});
handlers.set("connection-flow:get-states", () => ({ github: { status: "disconnected", revision: 0 }, supabase: { status: "disconnected", revision: 0 }, neon: { status: "disconnected", revision: 0 } }));
handlers.set("window-infrastructure:attach-interest", () => undefined);
handlers.set("window-infrastructure:detach-interest", () => undefined);
handlers.set("is-capacitor", () => false);
handlers.set("get-app-theme", () => null);
handlers.set("get-proposal", () => null);
handlers.set("select-app-for-preview", () => undefined);
handlers.set("git:get-uncommitted-files", () => []);
handlers.set("reload-env-path", () => undefined);
handlers.set("get-cloud-sandbox-status", () => null);
window.__preview = buildPreview;

// ---- the surface
function dispatch(channel, args) {
  const n = (seen.get(channel) || 0) + 1; seen.set(channel, n);
  const h = handlers.get(channel);
  if (!h) { if (n === 1) console.warn("[host] no handler:", channel, args[0]); return Promise.resolve(fail("no browser handler for " + channel)); }
  return Promise.resolve().then(() => h(...args)).then(ok, (e) => { console.warn("[host]", channel, e); return fail(String((e && e.message) || e), "internal"); });
}
// Every stored file's bytes are also an object at their own address, so a restore can find them.
const originalPut = put;
handlers.set("__seal-files", null); handlers.delete("__seal-files");
const rawEdit = handlers.get("edit-app-file");
handlers.set("edit-app-file", async (input) => { await originalPut("objects", await kappa(enc.encode(input.content)), enc.encode(input.content)); return rawEdit(input); });
const rawCreate = handlers.get("create-app");
handlers.set("create-app", async (input) => { for (const src of Object.values(await loadScaffold())) { const b = enc.encode(src); await originalPut("objects", await kappa(b), b); } return rawCreate(input); });

window.electron = {
  ipcRenderer: {
    invokeEnvelope: (channel, ...args) => dispatch(channel, args),
    invoke: (channel, ...args) => dispatch(channel, args).then((env) => { if (env.ok) return env.value; const err = new Error(env.error.message); err.name = env.error.name || "Error"; throw err; }),
    send: (channel) => { const n = (seen.get(channel) || 0) + 1; seen.set(channel, n); if (n === 1) console.warn("[host] send:", channel); },
    on: (channel, fn) => { if (!listeners.has(channel)) listeners.set(channel, new Set()); listeners.get(channel).add(fn); return () => listeners.get(channel).delete(fn); },
    removeListener: (channel, fn) => { const set = listeners.get(channel); if (set) set.delete(fn); },
    removeAllListeners: (channel) => { listeners.delete(channel); },
  },
};
window.__host = { handlers, emit, seen, get, put, all, kappa, core: () => core, coreReady, view: () => coreReady.then((c) => c.run({ op: "view" })) };
if ("serviceWorker" in navigator) navigator.serviceWorker.register(new URL("sw.js", BASE)).catch(() => {});
