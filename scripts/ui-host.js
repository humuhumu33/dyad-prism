// The chat app's host on this origin. It is ours, not the chat app's: the app loads it as one module
// script and knows nothing about it. `../` from here is the shell root, whatever subpath the site is
// published under.
//
//   1. The connection is seeded once, to the endpoint this origin answers, with no key, so a visitor
//      never opens the settings screen.
//   2. The shell's service worker is registered, because it is what answers that endpoint; a visitor
//      who arrives before it is installed is controlled after one reload.
//   3. The engine is started at once, so the model is resident before the first prompt, and the one
//      long wait, the first download, is shown as a bar. Nothing here names a colour: the bar uses the
//      brand kit's variables, which the page already defines.
const SHELL = new URL("../", import.meta.url);
const SERVERS = "hollama-servers";

try {
  const stored = JSON.parse(localStorage.getItem(SERVERS) || "null");
  if (!Array.isArray(stored) || !stored.length) {
    localStorage.setItem(SERVERS, JSON.stringify([{
      id: "hologram",
      baseUrl: new URL("v1", SHELL).href,
      connectionType: "openai-compatible",
      isVerified: new Date().toISOString(),
      isEnabled: true,
      label: "Hologram",
      // The models this page can answer from itself. The paid ones the endpoint also lists need a key,
      // which is given on the homepage, not here; a visitor can clear this filter in the settings.
      modelFilter: "webgpu:",
    }]));
  }
} catch (error) {}

if (navigator.serviceWorker) {
  const controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register(new URL("sw.js", SHELL).href).catch(() => {});
  // Only the first install reloads: a page reloaded mid chat would lose what the visitor is reading.
  if (!controlled) navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
}

const bar = document.createElement("div");
bar.hidden = true;
bar.style.cssText = "position:fixed;top:.75rem;left:50%;transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:.75rem;width:min(22rem,calc(100vw - 2rem));padding:.5rem .85rem;border-radius:.625rem;font:500 12px/1.5 Geist,system-ui,sans-serif;background:hsl(var(--color-shade-0));color:hsl(var(--color-text-shade-1));border:1px solid hsl(var(--color-shade-5))";
const label = document.createElement("span");
label.style.cssText = "white-space:nowrap";
const track = document.createElement("span");
track.style.cssText = "flex:1;height:3px;border-radius:2px;background:hsl(var(--color-shade-4))";
const fill = document.createElement("span");
fill.style.cssText = "display:block;height:100%;width:0;border-radius:2px;background:hsl(var(--color-primary));transition:width .2s";
track.append(fill);
bar.append(label, track);
document.body.prepend(bar);

function show(word) {
  if (!word) { bar.hidden = true; return; }
  bar.hidden = false;
  label.textContent = word;
  const percent = /(\d+)%/.exec(word);
  fill.style.width = percent ? percent[1] + "%" : "0";
}

const inference = await import(new URL("inference.js", SHELL).href);
inference.engine.onState = show;
inference.engine.onReady = () => show("");
inference.gpuReady().catch((error) => show(error.message));
