//! The shell projector: renders the landing page and the shell's closure from the generated `view()`.
//!
//! An adapter, not the model: every visible word comes from the Lean verified `View` record; this
//! file owns only markup. It writes `shell/index.html` (Dyad's UI at the root, with the appearance
//! switch: Immersive, Dark, Light), `shell/holo.html` (the runner for published
//! applications), `shell/app.webmanifest`, `shell/v1/openapi.json`,
//! `shell/manifest.json` (the hash list the service worker precaches from, so the shell is one
//! versioned closure) and `shell/sw.js` from `shell/sw.template.js` with the closure digest inside.
//!
//! Run from the repo root: cargo run --release --manifest-path core/Cargo.toml --bin project-shell

use dyad_core::abi::view_json;
use dyad_core::{encodeCompletion, encodeError, encodeModels, view, Completion};
use std::fmt::Write as _;
use std::path::{Path, PathBuf};

fn esc(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

fn page() -> String {
    // The homepage is Dyad's own UI, whole, at the root of the shell: its renderer is built by Vite
    // into assets/ with fixed names (scripts/vite.shell.config.mts), the host runs first so
    // window.electron exists when the contracts read it, and the appearance switch from the
    // landing page stays: Immersive (a curated photo behind frosted panels), Dark, Light, kept as
    // Hologram OS keeps it (holo.theme.v1) and mirrored into Dyad's own theme class.
    let v = view();
    let mut h = String::new();
    let _ = write!(
        h,
        r##"<!doctype html>
<html lang="en" class="notranslate" translate="no">
<head>
<meta charset="utf-8">
<meta name="google" content="notranslate">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#151312">
<title>{title}</title>
<meta name="description" content="{lede}">
<link rel="icon" href="mark.svg" type="image/svg+xml">
<link rel="manifest" href="app.webmanifest">
<link rel="stylesheet" href="assets/index.css">
<link rel="stylesheet" href="appearance.css">
<script>
// Pre paint appearance, the same canonical state Hologram OS keeps (holo.theme.v1: palette, immersive,
// wallpaper) and the same hooks (data-holo-palette, data-holo-immersive, --holo-wallpaper, color-scheme),
// mirrored into Dyad's theme class and its localStorage "theme", so the first frame already wears the
// chosen look. First run, and once for anyone who chose before look 3: immersive on the first curated
// photo; Dark and Light are one click away.
(function () {{
  var root = document.documentElement, s = null;
  try {{ s = JSON.parse(localStorage.getItem("holo.theme.v1") || "null"); }} catch (e) {{}}
  if (!s || s.look !== 3) {{ s = {{ look: 3, palette: "dark", immersive: true, wallpaper: "wallpapers/{wall0}" }}; try {{ localStorage.setItem("holo.theme.v1", JSON.stringify(s)); }} catch (e) {{}} }}
  var palette = s.palette === "light" ? "light" : "dark";
  root.setAttribute("data-holo-palette", palette);
  root.setAttribute("data-holo-immersive", s.immersive ? "on" : "off");
  root.style.setProperty("color-scheme", palette);
  if (s.wallpaper) root.style.setProperty("--holo-wallpaper", "url(" + JSON.stringify(s.wallpaper) + ")");
  root.classList.remove("light", "dark"); root.classList.add(palette);
  try {{ localStorage.setItem("theme", palette); }} catch (e) {{}}
}})();
</script>
<script type="application/json" id="wallpapers">{walls_json}</script>
<script type="application/json" id="view">{view_json}</script>
</head>
<body>
<div id="root"></div>
<button class="appearance" id="appearance" type="button" aria-haspopup="dialog" aria-expanded="false" aria-label="{appearance}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg></button>
<div class="popover" id="popover" role="dialog" aria-label="{appearance}" hidden>
  <button class="mode" type="button" data-mode="immersive"><span>{immersive}</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"></rect><path d="M3 15l5-5 4 4 3-3 6 6"></path><circle cx="16" cy="8" r="1.5"></circle></svg></button>
  <div class="walls" id="walls">{walls}</div>
  <button class="mode" type="button" data-mode="dark"><span>{dark}</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path></svg></button>
  <button class="mode" type="button" data-mode="light"><span>{light}</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg></button>
</div>
<script type="module" src="host.js"></script>
<script type="module" src="assets/index.js"></script>
<script type="module" src="appearance.js"></script>
</body>
</html>
"##,
        title = esc(&v.headline),
        lede = esc(&v.lede),
        appearance = esc(&v.appearanceLabel),
        dark = esc(&v.darkLabel),
        light = esc(&v.lightLabel),
        immersive = esc(&v.immersiveLabel),
        wall0 = esc(&v.wallpapers[0].file),
        walls = v.wallpapers.iter().map(|w| format!(r#"<button class="wall" type="button" data-wall="wallpapers/{}" title="{}" aria-label="{}" style="background-image:url(wallpapers/{})"></button>"#, esc(&w.file), esc(&w.label), esc(&w.label), esc(&w.file))).collect::<String>(),
        walls_json = serde_json::json!(v.wallpapers.iter().map(|w| serde_json::json!({ "file": format!("wallpapers/{}", w.file), "name": w.label, "by": w.author, "byUrl": w.authorUrl })).collect::<Vec<_>>()).to_string().replace("</", "<\\/"),
        view_json = view_json().to_string().replace("</", "<\\/"),
    );
    h
}

fn webmanifest() -> String {
    let v = view();
    serde_json::json!({
        "name": "Hologram",
        "short_name": "Hologram",
        "description": v.lede,
        "start_url": "./",
        "display": "standalone",
        "background_color": "#151312",
        "theme_color": "#151312",
        "icons": [{ "src": "mark.svg", "sizes": "any", "type": "image/svg+xml" }]
    })
    .to_string()
        + "\n"
}

/// The endpoint's OpenAPI document. The examples are not typed here: they are the bytes the
/// generated encoders produce, so the document cannot drift from the model.
fn openapi() -> String {
    let sample = Completion {
        id: "chatcmpl-3f1c9a2b7d40".to_owned(),
        created: "1757500000".to_owned(),
        model: "webgpu:BitNet".to_owned(),
        text: "Hello.".to_owned(),
        fingerprint: "blake3:e41292a4…;blake3:9c0d…".to_owned(),
        receipt: "did:holo:sha256:…".to_owned(),
    };
    let parse = |bytes: String| serde_json::from_str::<serde_json::Value>(&bytes).expect("encoder emits JSON");
    let doc = serde_json::json!({
        "openapi": "3.1.0",
        "info": {
            "title": "dyad-prism",
            "version": "1",
            "summary": "OpenAI compatible chat completions served from the browser tab that has this page open.",
            "description": "Every answer carries a receipt (x-hologram-receipt, and hologram.receipt on the last streamed chunk). A repeated request is served from its seal on the device with x-hologram-reuse: 1. On this origin the service worker answers; on a machine, freeinference-relay.py (served by this page, SHA-256 in manifest.json) forwards http://127.0.0.1:11435/v1 to the tab and requires an Authorization header of any value. No server computes or stores anything."
        },
        "security": [{ "anyKey": [] }],
        "servers": [
            { "url": "https://humuhumu33.github.io/dyad-prism/v1", "description": "the page's own origin, answered by the service worker while the page is open" },
            { "url": "http://127.0.0.1:11435/v1", "description": "the local relay, freeinference-relay.py from this page, for native clients" }
        ],
        "paths": {
            "/models": { "get": { "operationId": "listModels", "responses": { "200": { "description": "the resident model", "content": { "application/json": { "example": parse(encodeModels(&["webgpu:BitNet".to_owned()])) } } } } } },
            "/chat/completions": { "post": {
                "operationId": "createChatCompletion",
                "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ChatCompletionRequest" },
                    "example": { "model": "webgpu:BitNet", "messages": [{ "role": "user", "content": "Hello" }], "max_tokens": 512, "temperature": 0.7, "stream": true } } } },
                "responses": {
                    "200": { "description": "the answer; with stream: true, chunks as text/event-stream ending in data: [DONE]",
                        "headers": {
                            "x-hologram-receipt": { "description": "the answer's receipt id", "schema": { "type": "string" } },
                            "x-hologram-reuse": { "description": "1 when served from the seal without running the model", "schema": { "type": "string" } },
                            "x-hologram-stream": { "description": "native, memo, or plain", "schema": { "type": "string" } }
                        },
                        "content": { "application/json": { "example": parse(encodeCompletion(&sample)) }, "text/event-stream": { "schema": { "type": "string" } } } },
                    "400": { "description": "malformed request", "content": { "application/json": { "example": parse(encodeError("messages must not be empty".to_owned(), "invalid_request_error".to_owned())) } } },
                    "503": { "description": "no page is open, or this browser cannot run the model" }
                } } }
        },
        "components": { "securitySchemes": { "anyKey": { "type": "http", "scheme": "bearer", "description": "any value; the relay needs the header present, never its value" } }, "schemas": {
            "ChatCompletionRequest": { "type": "object", "required": ["messages"], "properties": {
                "model": { "type": "string", "description": "a model the page offers; the resident model answers by default" },
                "messages": { "type": "array", "items": { "type": "object", "required": ["role", "content"], "properties": { "role": { "type": "string" }, "content": { "type": "string" } } } },
                "max_tokens": { "type": "integer" }, "max_completion_tokens": { "type": "integer" },
                "temperature": { "type": "number" }, "seed": { "type": "integer" }, "stream": { "type": "boolean" }
            } }
        } }
    });
    serde_json::to_string_pretty(&doc).unwrap() + "\n"
}

/// Every file of the shell with its SHA-256, lexically ordered. Not in the closure: the worker and
/// its template, this list, `provenance.json` (the closure digest is one of its fields; the worker
/// precaches it beside this list), Dyad's renderer build under `assets/` and the staged `scaffold/` and
/// `404.html` (written after the lane by the Pages workflow and content hashed by Vite already), and
/// model weights, which live in the device store the engine keeps.
fn manifest(shell: &Path) -> String {
    fn walk(dir: &Path, root: &Path, out: &mut Vec<PathBuf>) {
        let mut entries: Vec<_> = std::fs::read_dir(dir).expect("shell dir").flatten().collect();
        entries.sort_by_key(|e| e.path());
        for entry in entries {
            let path = entry.path();
            if path.is_dir() {
                let name = path.file_name().unwrap().to_string_lossy().to_string();
                if path.parent() == Some(root) && (name == "app" || name == "assets" || name == "scaffold") {
                    continue;
                }
                walk(&path, root, out);
            } else {
                out.push(path.strip_prefix(root).unwrap().to_path_buf());
            }
        }
    }
    let mut files = Vec::new();
    walk(shell, shell, &mut files);
    let mut rows = Vec::new();
    for rel in files {
        let name = rel.to_string_lossy().replace('\\', "/");
        if name == "manifest.json" || name == "provenance.json" || name == "sw.js" || name == "sw.template.js" || name == "404.html" {
            continue;
        }
        let bytes = std::fs::read(shell.join(&rel)).expect("read shell file");
        rows.push(serde_json::json!({ "path": name, "sha256": sha256(&bytes), "bytes": bytes.len() }));
    }
    let closure = sha256(serde_json::to_string(&rows).unwrap().as_bytes());
    serde_json::json!({ "spec": "dyad-prism/shell/1", "closure": closure, "files": rows }).to_string() + "\n"
}

fn sha256(bytes: &[u8]) -> String {
    // A tiny SHA-256 so the projector carries no extra dependency; correctness is checked against
    // Python's hashlib by tools/corpus_inference.py on every run.
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    let mut data = bytes.to_vec();
    let bit_len = (bytes.len() as u64) * 8;
    data.push(0x80);
    while data.len() % 64 != 56 {
        data.push(0);
    }
    data.extend_from_slice(&bit_len.to_be_bytes());
    for chunk in data.chunks(64) {
        let mut w = [0u32; 64];
        for (i, word) in chunk.chunks(4).enumerate() {
            w[i] = u32::from_be_bytes([word[0], word[1], word[2], word[3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh] = h;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ (!e & g);
            let t1 = hh.wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let t2 = s0.wrapping_add(maj);
            hh = g; g = f; f = e; e = d.wrapping_add(t1); d = c; c = b; b = a; a = t1.wrapping_add(t2);
        }
        for (slot, value) in h.iter_mut().zip([a, b, c, d, e, f, g, hh]) {
            *slot = slot.wrapping_add(value);
        }
    }
    h.iter().map(|word| format!("{word:08x}")).collect()
}


/// The runner page: opens a published application on any device. Served at `holo.html` and, by the
/// worker, at holoPath(κ) when the View is not yet unpacked there: the page finds the bytes in the
/// device store or asks for the file, verifies them through the core (PrismPM's own validator),
/// unpacks the View under its address and reloads. Every word is the View's.
fn holo_page() -> String {
    let v = view();
    format!(
        r##"<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark light">
<title>{title}</title>
<script>document.write('<base href="' + location.pathname.replace(/holo\/.*$/, "").replace(/[^/]*$/, "") + '">');</script>
<link rel="icon" href="mark.svg" type="image/svg+xml">
<link rel="stylesheet" href="shell.css">
<script>(function () {{ var root = document.documentElement, s = null; try {{ s = JSON.parse(localStorage.getItem("holo.theme.v1") || "null"); }} catch (e) {{}} var palette = s && s.palette === "light" ? "light" : "dark"; root.setAttribute("data-holo-palette", palette); root.setAttribute("data-holo-immersive", "off"); root.style.setProperty("color-scheme", palette); }})();</script>
<script type="application/json" id="view">{view_json}</script>
</head>
<body>
<a class="mark" href="./" aria-label="Hologram"><img class="on-dark" src="lockup-white.svg" alt="Hologram" width="157" height="30"><img class="on-light" src="lockup-black.svg" alt="Hologram" width="157" height="30"></a>
<main>
  <h1>{title}</h1>
  <p class="lede">{lede}</p>
  <p class="hint mono" id="status"></p>
  <p><label class="btn" for="file" id="pick">{pick}</label><input id="file" type="file" accept=".holo" hidden></p>
  <ul class="apps" id="apps"></ul>
  <p class="hint">{runs}</p>
</main>
<script type="module">
import {{ install, stored, installed }} from "./holo.js";
import {{ coreReady }} from "./inference.js";
const V = JSON.parse(document.getElementById("view").textContent);
const status = document.getElementById("status"), list = document.getElementById("apps");
const short = (k) => k.replace(/^blake3:/, "").slice(0, 12) + "…";
const wanted = (location.pathname.match(/\/holo\/([^/]+)\//) || [])[1] || null;
async function show() {{
  const rows = await installed();
  list.innerHTML = "";
  for (const r of rows) {{
    const li = document.createElement("li");
    const a = document.createElement("a"); a.href = new URL("holo/" + r.kappa + "/", document.baseURI).href; a.textContent = (r.application || "application") + " · " + short(r.kappa) + " · " + r.byteLength + " bytes";
    const d = document.createElement("a"); d.href = new URL("holo/" + r.kappa + ".holo", document.baseURI).href; d.textContent = V.downloadLabel; d.className = "hint"; d.setAttribute("download", "");
    li.append(a, " ", d); list.append(li);
  }}
}}
async function open(bytes) {{
  status.textContent = V.verifyingLabel + "…";
  try {{
    const done = await install(bytes);
    status.textContent = V.publishedLabel + " · " + short(done.kappa) + " · " + done.byteLength + " bytes · " + done.ms + " ms";
    await show();
    location.href = done.url;
  }} catch (e) {{
    status.textContent = V.refusedLabel + " · " + String((e && e.message) || e);
  }}
}}
document.getElementById("file").addEventListener("change", async (e) => {{ const f = e.target.files[0]; if (f) open(new Uint8Array(await f.arrayBuffer())); }});
(async () => {{
  await coreReady();
  await show();
  if (wanted) {{ const bytes = await stored(wanted); if (bytes) open(bytes); else status.textContent = short(wanted) + " · " + V.pickLabel; }}
}})();
</script>
</body>
</html>
"##,
        title = esc(&v.holoTitle),
        lede = esc(&v.holoLede),
        pick = esc(&v.pickLabel),
        runs = esc(&v.runsLabel),
        view_json = view_json()
    )
}

fn main() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf();
    let shell = root.join("shell");
    std::fs::create_dir_all(shell.join("v1")).expect("shell/v1");
    std::fs::write(shell.join("index.html"), page()).expect("write index.html");
    std::fs::write(shell.join("holo.html"), holo_page()).expect("write holo.html");
    std::fs::write(shell.join("app.webmanifest"), webmanifest()).expect("write webmanifest");
    std::fs::write(shell.join("v1").join("openapi.json"), openapi()).expect("write openapi.json");
    let manifest = manifest(&shell);
    std::fs::write(shell.join("manifest.json"), &manifest).expect("write manifest.json");
    // The closure digest is written into the worker itself, so a new shell is a new worker: the
    // browser installs it, precaches the new closure, and drops the old shell cache on activation.
    let closure = serde_json::from_str::<serde_json::Value>(&manifest).unwrap()["closure"].as_str().unwrap().to_owned();
    let worker = std::fs::read_to_string(shell.join("sw.template.js")).expect("read shell/sw.template.js");
    std::fs::write(shell.join("sw.js"), worker.replace("__CLOSURE__", &closure)).expect("write sw.js");
    println!("projected shell/index.html, holo.html, app.webmanifest, v1/openapi.json, manifest.json, sw.js from view(); closure {}", &closure[..12]);
}
