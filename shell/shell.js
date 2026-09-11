// The landing page: one headline, one line, one box. Appearance as Hologram OS keeps it, the who
// pill (your device or a paid model), the key row, the Connect pill and its sheet for agent
// harnesses, and the box itself, which is the builder's first prompt: submitting it creates the app
// from the scaffold and opens Dyad's UI with the turn already running. Words come from the View.
import { coreReady, viewReady, keyGet, keySet, readWho, writeWho, engine, relay, readConnect, writeConnect, relayWatch, RELAY, RELAY_PORT, MODEL_ID, short } from "./inference.js";

const $ = (id) => document.getElementById(id);
let VIEW = null;
function setState(text) { $("hint").textContent = text || ""; }
const grow = (t) => { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 220) + "px"; };
$("input").addEventListener("input", (e) => grow(e.target));
$("input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("composer").requestSubmit(); } });

// The first prompt: kept for the builder, which creates the app and runs the turn on arrival.
$("composer").onsubmit = async (e) => {
  e.preventDefault();
  const text = $("input").value.trim(); if (!text) return;
  $("send").disabled = true;
  try { sessionStorage.setItem("holo.first-prompt.v1", JSON.stringify({ prompt: text, at: Date.now() })); } catch (err) {}
  setState(VIEW.buildingLabel);
  location.assign(new URL("app/", location.href).href);
};

// ---- Connect: the pill in the box and its sheet
const sheetOpen = () => !$("sheet").hidden;
relay.sheetOpen = sheetOpen;
let os = /Windows/i.test(navigator.userAgent) ? "win" : "mac", snip = "python", relayHash = "";
const RELAY_FILE = new URL("freeinference-relay.py", location.href).href;
const baseUrl = () => `${RELAY}/v1`;
let whoNow = { provider: "local", model: "" };
const modelId = () => (whoNow.provider === "paid" ? "openrouter/" + (whoNow.model || VIEW.paidModels[0].id) : MODEL_ID);
const portEnv = { mac: RELAY_PORT === 11435 ? "" : `FREEINFERENCE_RELAY_PORT=${RELAY_PORT} `, win: RELAY_PORT === 11435 ? "" : `$env:FREEINFERENCE_RELAY_PORT=${RELAY_PORT}; ` };
const COMMANDS = {
  mac: { run: () => `curl -fsSLO ${RELAY_FILE} && ${portEnv.mac}python3 freeinference-relay.py`, verify: () => "shasum -a 256 freeinference-relay.py" },
  win: { run: () => `iwr ${RELAY_FILE} -OutFile freeinference-relay.py; ${portEnv.win}py freeinference-relay.py`, verify: () => "Get-FileHash freeinference-relay.py" },
};
const SNIPPETS = [
  ["python", "Python", () => `from openai import OpenAI\nclient = OpenAI(base_url="${baseUrl()}", api_key="local")\nr = client.chat.completions.create(model="${modelId()}", messages=[{"role": "user", "content": "Hello"}])\nprint(r.choices[0].message.content)`],
  ["node", "Node", () => `import OpenAI from "openai";\nconst client = new OpenAI({ baseURL: "${baseUrl()}", apiKey: "local" });\nconst r = await client.chat.completions.create({ model: "${modelId()}", messages: [{ role: "user", content: "Hello" }] });\nconsole.log(r.choices[0].message.content);`],
  ["curl", "curl", () => `curl ${baseUrl()}/chat/completions -H "Authorization: Bearer local" -H "Content-Type: application/json" -d '{"model":"${modelId()}","messages":[{"role":"user","content":"Hello"}]}'`],
  ["hermes", "Hermes", () => `CUSTOM_BASE_URL=${baseUrl()} CUSTOM_API_KEY=local hermes chat -q "Hello" -m ${modelId()} --provider custom --ignore-rules -t none`],
  ["openclaw", "OpenClaw", () => `// ~/.openclaw/openclaw.json\n"models": { "providers": { "local": { "baseUrl": "${baseUrl()}", "apiKey": "local", "api": "openai-completions",\n  "models": [{ "id": "${modelId()}", "name": "Hologram, in the browser" }] } } }\n// then: openclaw agent exec --model local/${modelId()} "Hello"`],
];
function paintConnect() {
  if (!VIEW) return;
  const dot = relay.state === "connected" ? "dot on" : relay.state === "listening" || relay.state === "second" ? "dot wait" : "dot";
  $("pillDot").className = dot; $("sheetDot").className = dot;
  $("state").textContent = relay.state === "connected" ? `${VIEW.connectedLabel} · 127.0.0.1:${RELAY_PORT}`
    : relay.state === "second" ? `${VIEW.secondTabLabel}${relay.other ? " · " + relay.other : ""}`
    : relay.state === "listening" ? VIEW.listeningLabel : VIEW.notConnectedLabel;
  $("ask").hidden = !(readConnect().enabled && !relay.seen && relay.state !== "connected");
  $("cmd").textContent = COMMANDS[os].run(); $("verifycmd").textContent = COMMANDS[os].verify();
  $("hash").textContent = relayHash ? `sha256 ${relayHash}` : ""; $("hash").title = relayHash;
  $("baseUrl").textContent = baseUrl(); $("modelId").textContent = `${VIEW.modelIdLabel} · ${modelId()}`;
  $("snippet").textContent = SNIPPETS.find((s) => s[0] === snip)[2]();
  for (const b of document.querySelectorAll(".ostab")) b.setAttribute("aria-pressed", String(b.dataset.os === os));
  for (const b of document.querySelectorAll(".snip")) b.setAttribute("aria-pressed", String(b.dataset.snip === snip));
  $("test").disabled = relay.state !== "connected";
}
relay.onState = paintConnect;
async function refreshConnect() {
  if (!VIEW) return;
  const c = await coreReady();
  const ready = c.run({ op: "endpoint-ready", resident: !!engine.instance, keyPresent: !!(await keyGet()), online: navigator.onLine }).ready;
  $("connect").hidden = !ready;
  if (!ready && sheetOpen()) closeSheet();
  paintConnect();
}
engine.onReady = refreshConnect;
function openSheet() {
  $("sheet").hidden = false; $("scrim").hidden = false; $("connect").setAttribute("aria-expanded", "true");
  const c = readConnect(); if (!c.enabled) writeConnect({ ...c, enabled: true, since: Date.now() });
  if (relay.state === "off") relay.state = "listening";
  paintConnect();
  relayWatch();
}
function closeSheet() { $("sheet").hidden = true; $("scrim").hidden = true; $("connect").setAttribute("aria-expanded", "false"); }
function initConnect() {
  for (const [id, label] of SNIPPETS) { const b = document.createElement("button"); b.type = "button"; b.className = "snip"; b.dataset.snip = id; b.textContent = label; b.onclick = () => { snip = id; paintConnect(); }; $("snips").appendChild(b); }
  for (const b of document.querySelectorAll(".ostab")) b.onclick = () => { os = b.dataset.os; paintConnect(); };
  for (const b of document.querySelectorAll(".copy")) b.onclick = async () => {
    try { await navigator.clipboard.writeText($(b.dataset.copy).textContent); b.textContent = VIEW.copiedLabel; setTimeout(() => { b.textContent = VIEW.copyLabel; }, 1200); } catch (e) {}
  };
  $("connect").onclick = (e) => { e.stopPropagation(); if (sheetOpen()) closeSheet(); else openSheet(); };
  $("scrim").onclick = closeSheet;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sheetOpen()) closeSheet(); });
  $("test").onclick = async () => {
    $("test").disabled = true; $("testOut").textContent = "…"; $("testOut").title = "";
    try {
      const t0 = performance.now();
      const r = await fetch(`${baseUrl()}/chat/completions`, { method: "POST", headers: { authorization: "Bearer local", "content-type": "application/json" }, body: JSON.stringify({ model: modelId(), messages: [{ role: "user", content: "Say hello in five words." }], max_tokens: 24 }) });
      const j = await r.json();
      if (!r.ok) throw new Error((j.error && j.error.message) || String(r.status));
      const reuse = r.headers.get("x-hologram-reuse") === "1"; const receipt = r.headers.get("x-hologram-receipt") || "";
      $("testOut").textContent = `“${j.choices[0].message.content}” · ${Math.round(performance.now() - t0)} ms · ${reuse ? VIEW.servedLabel : VIEW.sealedLabel} · ${short(receipt)}`;
      $("testOut").title = receipt;
    } catch (err) { $("testOut").textContent = `Error: ${err.message}`; }
    finally { $("test").disabled = relay.state !== "connected"; }
  };
  fetch("manifest.json", { cache: "no-store" }).then((r) => r.json()).then((m) => { const f = (m.files || []).find((x) => x.path === "freeinference-relay.py"); relayHash = f ? f.sha256 : ""; paintConnect(); }).catch(() => {});
  window.addEventListener("online", refreshConnect); window.addEventListener("offline", refreshConnect);
  if (readConnect().enabled) relayWatch();
  refreshConnect();
}

// ---- appearance: the same canonical state and hooks Hologram OS keeps
const KEY = "holo.theme.v1";
const WALLS = JSON.parse($("wallpapers").textContent);
const root = document.documentElement;
function readTheme() { try { return JSON.parse(localStorage.getItem(KEY) || "null") || {}; } catch (e) { return {}; } }
function applyTheme(s) {
  root.setAttribute("data-holo-palette", s.palette === "light" ? "light" : "dark");
  root.setAttribute("data-holo-immersive", s.immersive ? "on" : "off");
  root.style.setProperty("color-scheme", s.palette === "light" ? "light" : "dark");
  if (s.wallpaper) root.style.setProperty("--holo-wallpaper", `url(${JSON.stringify(s.wallpaper)})`);
  try { localStorage.setItem(KEY, JSON.stringify({ look: 3, ...s })); } catch (e) {}
  const mode = s.immersive ? "immersive" : s.palette === "light" ? "light" : "dark";
  for (const b of document.querySelectorAll(".mode")) b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
  for (const b of document.querySelectorAll(".wall")) b.setAttribute("aria-pressed", String(s.immersive && b.dataset.wall === s.wallpaper));
  $("walls").classList.toggle("on", !!s.immersive);
}
function setMode(mode) {
  const s = readTheme();
  if (mode === "immersive") applyTheme({ palette: "dark", immersive: true, wallpaper: s.wallpaper || WALLS[0].file });
  else applyTheme({ palette: mode, immersive: false, wallpaper: s.wallpaper || WALLS[0].file });
}
$("appearance").onclick = (e) => { e.stopPropagation(); const open = $("popover").hidden; $("popover").hidden = !open; $("appearance").setAttribute("aria-expanded", String(open)); };
document.addEventListener("click", (e) => { if (!$("popover").contains(e.target)) { $("popover").hidden = true; $("appearance").setAttribute("aria-expanded", "false"); } });
for (const b of document.querySelectorAll(".mode")) b.onclick = () => setMode(b.dataset.mode);
for (const b of document.querySelectorAll(".wall")) b.onclick = () => applyTheme({ palette: "dark", immersive: true, wallpaper: b.dataset.wall });

// ---- the switch: one pill, one menu; choosing a model is choosing the provider
function openWhoMenu(open) { $("whoMenu").hidden = !open; $("whoPill").setAttribute("aria-expanded", String(open)); }
async function applyWho(w) {
  const provider = w.provider === "paid" ? "paid" : "local";
  const model = provider === "paid" ? (w.model || VIEW.paidModels[0].id) : "";
  whoNow = { provider, model };
  await writeWho(whoNow);
  $("whoCurrent").textContent = provider === "paid" ? (VIEW.paidModels.find((m) => m.id === model) || VIEW.paidModels[0]).label : VIEW.localLabel;
  for (const o of document.querySelectorAll("#whoMenu .opt")) o.setAttribute("aria-selected", String(o.dataset.provider === provider && (provider !== "paid" || o.dataset.model === model)));
  $("keyrow").hidden = !(provider === "paid") || !!(await keyGet());
  $("keyhint").textContent = (await keyGet()) ? VIEW.keySavedLabel : VIEW.paidOnceLabel;
  refreshConnect();
}
$("whoPill").onclick = (e) => { e.stopPropagation(); openWhoMenu($("whoMenu").hidden); };
for (const o of document.querySelectorAll("#whoMenu .opt")) o.onclick = () => { applyWho({ provider: o.dataset.provider, model: o.dataset.model || "" }); openWhoMenu(false); $("whoPill").focus(); };
document.addEventListener("click", (e) => { if (!e.target.closest(".who")) openWhoMenu(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("whoMenu").hidden) { openWhoMenu(false); $("whoPill").focus(); } });
$("key").addEventListener("change", async () => { const v = $("key").value.trim(); if (!v) return; await keySet(v); $("key").value = ""; applyWho(await readWho()); });
$("key").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("key").dispatchEvent(new Event("change")); } });

// ---- start: the shell is precached for offline, the words come from the verified View
(async () => {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  VIEW = await viewReady();
  engine.onState = setState;
  applyTheme(readTheme()); await applyWho(await readWho());
  if (!navigator.gpu) setState(VIEW.noGpuLabel);
  else if (!navigator.onLine) setState(VIEW.offlineLabel);
  window.addEventListener("offline", () => setState(VIEW.offlineLabel));
  // The engine is fetched when a turn needs it, not on every landing: the builder is the product,
  // and a first visit should not pull the model's blocks unasked.
  initConnect();
})();
