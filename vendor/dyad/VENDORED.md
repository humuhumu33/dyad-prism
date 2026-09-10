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
