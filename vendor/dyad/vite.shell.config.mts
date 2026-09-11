// dyad-prism (ours, not Dyad's; see VENDORED.md): Dyad's renderer built for the shell, the vendored
// Vite config unchanged plus fixed output names, so the projected shell/index.html (written by the
// core from the verified View) can reference assets/index.js and assets/index.css without knowing a
// content hash. Lives beside the vendored config so Vite resolves Dyad's modules. Run from vendor/dyad:
//   npx vite build --config vite.shell.config.mts --base <base> --outDir dist --emptyOutDir
// then python3 ../../scripts/stamp_shell.py copies dist/assets into shell/assets.
//
// The product is Hologram: at build time every standalone "Dyad" word in the renderer's sources,
// locales and markdown becomes "Hologram", and Dyad's logo becomes Hologram's mark. Identifiers
// (DyadError, dyad-write, __dyadIpcEnvelope) are untouched, so the contracts with the host hold.
import path from "path";
import { mergeConfig, type Plugin } from "vite";
import base from "./vite.renderer.config.mts";

const src = path.resolve(__dirname, "src").replace(/\\/g, "/");
const mark = path.resolve(__dirname, "../../shell/mark.svg");

const hologramWords: Plugin = {
  name: "hologram-words",
  enforce: "pre",
  resolveId(id, importer) {
    if (id.endsWith("assets/logo.svg") && importer && importer.replace(/\\/g, "/").startsWith(src)) return mark;
    return null;
  },
  transform(code, id) {
    const file = id.replace(/\\/g, "/").split("?")[0];
    if (!file.startsWith(src) || !/\.(tsx?|jsx?|json|md)$/.test(file)) return null;
    if (!/\bDyad\b/.test(code)) return null;
    return { code: code.replace(/\bDyad\b/g, "Hologram"), map: null };
  },
};

export default mergeConfig(base, {
  plugins: [hologramWords],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/index.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
