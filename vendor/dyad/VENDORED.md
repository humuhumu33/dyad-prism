# Vendored: dyad-sh/dyad at 00d5f5af7fd0 (v1.15.0-beta.1, 2026-09-10)

Taken with `git archive` from the pinned commit: src, scaffold, worker, shared, packages, index.html,
package.json, package-lock.json, vite.renderer.config.mts, tsconfig*.json, components.json, LICENSE,
NOTICE, README.md, AGENTS.md.

Removed: `src/pro/` (Functional Source License 1.1; not reused). Everything kept is Apache 2.0 per
LICENSE.

Changes to reused files are listed here, one line each, so upstream can be tracked:

- `src/pro/` is not Dyad's: four small files of ours export the names the renderer imports from the
  removed folder, so the renderer builds without the Functional Source License code:
  `shared/search_replace_parser.ts` (a parser for the SEARCH / REPLACE blocks the chat renders),
  `ui/components/Annotator/Annotator.tsx` (hands the screenshot back as one attachment; no drawing),
  `main/ipc/handlers/local_agent/tool_definitions.ts` (the tool name type; the names are the PrismPM tool contract's),
  `main/prompts/turbo_edits_v2_prompt.ts` (empty; turbo edits are a Pro feature and not offered).
- `scaffold/src/App.tsx`, as staged for the shell only (the vendored file is untouched): `<BrowserRouter basename={import.meta.env.BASE_URL}>`, so a project routes correctly when served under its address path instead of an origin root.
- `src/router.ts`: `basepath: import.meta.env.BASE_URL.replace(/\/$/, "")` on `createRouter`, so Dyad's routes live under the base the shell is served from (`/app/` locally, `/dyad-prism/app/` on Pages) and a refresh finds them.
- `src/components/preview_panel/PublishPanel.tsx`: one import and one mount of `HologramSection` (ours, `src/components/preview_panel/HologramSection.tsx`) above Dyad's deployment section, so the Publish panel offers "Publish as a Hologram application": the host composes a `.holo` v4 through PrismPM's own archive code in the core and serves it under its address. The words are the View's.
- `vite.shell.config.mts` (ours, added): the vendored Vite config plus fixed output names, so the shell's projected homepage can reference `assets/index.js` and `assets/index.css`; the renderer is now the homepage at the shell's root, the `--base` is the shell's base.
