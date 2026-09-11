// dyad-prism (ours, not Dyad's; see VENDORED.md): Dyad's renderer built for the shell, the vendored
// Vite config unchanged plus fixed output names, so the projected shell/index.html (written by the
// core from the verified View) can reference assets/index.js and assets/index.css without knowing a
// content hash. Lives beside the vendored config so Vite resolves Dyad's modules. Run from vendor/dyad:
//   npx vite build --config vite.shell.config.mts --base <base> --outDir dist --emptyOutDir
// then python3 ../../scripts/stamp_shell.py copies dist/assets into shell/assets.
import { mergeConfig } from "vite";
import base from "./vite.renderer.config.mts";

export default mergeConfig(base, {
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
