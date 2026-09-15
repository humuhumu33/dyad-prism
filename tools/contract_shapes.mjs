// Every channel Dyad's renderer calls, with the shape its contract declares, and what the host
// answers. The renderer types its calls but validates no answer at runtime, so a handler that returns
// an object where the contract says array crashes a screen ("is not iterable") only when a user opens
// it. This reads the vendored contracts and the host side by side and refuses on a mismatch.
//
//   node tools/contract_shapes.mjs          # the table
//   node tools/contract_shapes.mjs --check  # exit 1 on any array or object mismatch
//
// The contracts are TypeScript with zod, so they are bundled through esbuild (a dependency of the
// vendored renderer) into one module and read with zod's own introspection.
import { build } from "../vendor/dyad/node_modules/esbuild/lib/main.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const typesDir = path.join(root, "vendor/dyad/src/ipc/types");
const entry = path.join(root, "vendor/dyad/node_modules/.cache-contract-shapes.mjs");
const modules = fs.readdirSync(typesDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts") && !f.includes(".test."));
fs.writeFileSync(entry, modules.map((f, i) => `export * as m${i} from ${JSON.stringify(path.join(typesDir, f))};`).join("\n"));

const bundled = path.join(root, "vendor/dyad/node_modules/.cache-contract-shapes.bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundled,
  logLevel: "silent",
  alias: { "@": path.join(root, "vendor/dyad/src") },
  loader: { ".png": "empty", ".svg": "empty", ".css": "empty" },
});
const all = await import("file://" + bundled.replace(/\\/g, "/"));

// zod 4 names the kind in `_def.type`, unwrapped through the wrappers an output may use.
function shapeOf(schema, depth = 0) {
  const def = schema?._def;
  if (!def || depth > 8) return "unknown";
  const kind = def.type ?? String(def.typeName ?? "").replace(/^Zod/, "").toLowerCase();
  if (kind === "array" || kind === "object") return kind;
  if (kind === "nullable" || kind === "optional" || kind === "default" || kind === "readonly" || kind === "catch") return shapeOf(def.innerType, depth + 1);
  if (kind === "pipe") return shapeOf(def.out ?? def.in, depth + 1);
  if (kind === "union") {
    const kinds = new Set((def.options ?? []).map((o) => shapeOf(o, depth + 1)));
    kinds.delete("null");
    return kinds.size === 1 ? [...kinds][0] : "union";
  }
  if (kind === "lazy") return shapeOf(def.getter?.(), depth + 1);
  return kind || "unknown";
}

const contracts = new Map();
for (const ns of Object.values(all)) {
  for (const group of Object.values(ns ?? {})) {
    if (!group || typeof group !== "object") continue;
    for (const contract of Object.values(group)) {
      if (contract && typeof contract === "object" && typeof contract.channel === "string" && contract.output?._def) {
        contracts.set(contract.channel, shapeOf(contract.output));
      }
    }
  }
}

// What the host answers. Only a literal answer is classified: `=> ({ ... })` is an object, `=> [...]`
// an array. A block body (`=> { ... }`) is code, never guessed at, because the runtime check in
// `shell/host.js` parses those answers against the same contracts with real data.
const host = fs.readFileSync(path.join(root, "shell/host.js"), "utf8");
const answers = new Map();
for (const m of host.matchAll(/handlers\.set\("([^"]+)",\s*([\s\S]{0,120})/g)) {
  const [, channel, body] = m;
  const arrow = body.match(/^(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*([\s\S]*)$/);
  const tail = (arrow ? arrow[1] : "").trimStart();
  let shape = "code";
  if (/^\[/.test(tail)) shape = "array";
  else if (/^\(\s*\{/.test(tail)) shape = "object";
  else if (/^(null|undefined)/.test(tail)) shape = "null";
  else if (/^(true|false)/.test(tail)) shape = "boolean";
  else if (/^["'`]/.test(tail)) shape = "string";
  else if (/^\d/.test(tail)) shape = "number";
  answers.set(channel, shape);
}

const rows = [...answers.keys()].sort().map((channel) => ({ channel, declared: contracts.get(channel) ?? "not in a contract", answered: answers.get(channel) }));
const clash = rows.filter((r) => (r.declared === "array" && ["object", "null", "string", "number", "boolean"].includes(r.answered)) || (r.declared === "object" && r.answered === "array"));
const width = Math.max(...rows.map((r) => r.channel.length));
for (const r of rows) {
  const mark = clash.includes(r) ? "  <-- MISMATCH" : "";
  if (!process.argv.includes("--check") || mark) console.log(`${r.channel.padEnd(width)}  declared ${String(r.declared).padEnd(16)} answered ${r.answered}${mark}`);
}
console.log(`\n${rows.length} channels answered by the host, ${contracts.size} channels under contract, ${clash.length} mismatch(es)`);
fs.rmSync(entry, { force: true });
fs.rmSync(bundled, { force: true });
if (clash.length && process.argv.includes("--check")) process.exit(1);
