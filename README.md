# dyad-prism

Dyad in any browser, 100 percent serverless, as one PrismPM module.

Dyad (dyad-sh/dyad, vendored at `00d5f5af7fd0`, v1.15.0-beta.1) supplies the product: its React renderer, its typed IPC contracts, its state machines, its prompts, its scaffold. PrismPM supplies the authority: one Lean verified model in `src/Dyad.lex.tex` that owns every rule, every address preimage and every visible word, projected by lean4-prod to Rust and wasm32 and shipped as a `.holo` v4. Hologram supplies the substrate: kappa addressing, a service worker that is the kernel of the page origin, and the contracts hologram-live already enforces, so an application built here runs unchanged on Hologram Desktop and Server.

Nothing runs but the browser and a static file host. No Electron, no Node process, no database process, no relay, no proxy.

## How it is built

- `tools/author.py` writes `src/Dyad.lex.tex`, the only file LexLean and PrismPM read. `lexlean.lock` pins it.
- `scripts/lane.sh` replays the whole lane on Linux x86_64 (WSL or CI) at the PrismPM commit in `PRISMPM_REV`: LexLean lock, check, build, verify under Lean 4.32.1 with leanchecker replay and exact per declaration axiom sets (`tools/axioms.json`, pinned by `tools/pin_axioms.py`); lean4-prod exports every root in `model/roots.txt` to kernel LCNF twice, byte identical, and generates Rust twice, byte identical, into `generated/dyad_core.rs`; the core crate builds for the host and for wasm32; `core/src/bin/project_shell.rs` renders `shell/index.html` from the generated `view()`. Compare mode refuses drift in any committed artifact.
- `tools/corpus.py` pins the bytes Lean cannot: the snapshot preimage and the capability decision on a fixed corpus, checked by `core/tests/corpus.rs` against the generated functions.
- `vendor/dyad/` is Dyad at the pinned commit with `src/pro` removed (Functional Source License; not reused). Every change to a reused file is listed in `vendor/dyad/VENDORED.md`.

## Module 1, workspace (this commit)

Records: `Entry {path, kappa, bytes}`, `Project {label, entries}`, `Grant {endpoint}`, `Capabilities {endpoints}`, `View`. Rules: `snapshotPreimage` (the bytes a project state is addressed by; the model owns preimages, the host derives the BLAKE3 address), `restoreDecision` (stored bytes must re-derive to their address or are refused), `networkDecision` (an origin is admitted only when a grant lists it; the empty baseline admits nothing, as hologram-live decides). Theorems by reflexivity: `view_headline`, `admits_nothing_without_grants`, `refuses_without_grants`, `empty_project_preimage`.

The spikes that decided the design, with measurements, are in the HOLOGRAM workspace: `DYAD-BROWSER-FIRST-EVAL.md`.

## Licence

This repository: MIT or Apache 2.0. `vendor/dyad`: Apache 2.0 (see `vendor/dyad/LICENSE` and `NOTICE`).
