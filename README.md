# dyad-prism

Dyad in any browser, 100 percent serverless, as one PrismPM module.

Dyad (dyad-sh/dyad, vendored at `00d5f5af7fd0`, v1.15.0-beta.1) supplies the product: its React renderer, its typed IPC contracts, its state machines, its prompts, its scaffold. PrismPM supplies the authority: one Lean verified model in `src/*.lex.tex` that owns every rule, every address preimage and every visible word, projected by lean4-prod to Rust and wasm32 and shipped as a `.holo` v4. Hologram supplies the substrate: kappa addressing, a service worker that is the kernel of the page origin, and the contracts hologram-live already enforces, so an application built here runs unchanged on Hologram Desktop and Server.

Nothing runs but the browser and a static file host. No Electron, no Node process, no database process, no relay, no proxy.

## How it is built

- `tools/author.py` writes `src/*.lex.tex`, the only files LexLean and PrismPM read. `lexlean.lock` pins them.
- `scripts/lane.sh` replays the whole lane on Linux x86_64 (WSL or CI) at the PrismPM commit in `PRISMPM_REV`: LexLean lock, check, build, verify under Lean 4.32.1 with leanchecker replay and exact per declaration axiom sets (`tools/axioms.json`, pinned by `tools/pin_axioms.py`); lean4-prod exports every root in `model/roots.txt` to kernel LCNF twice, byte identical, and generates Rust twice, byte identical, into `generated/dyad_core.rs`; the core crate builds for the host and for wasm32; `core/src/bin/project_shell.rs` renders `shell/index.html` from the generated `view()`. Compare mode refuses drift in any committed artifact.
- `tools/corpus.py` pins the bytes Lean cannot: the snapshot preimage and the capability decision on a fixed corpus, checked by `core/tests/corpus.rs` against the generated functions.
- `vendor/dyad/` is Dyad at the pinned commit with `src/pro` removed (Functional Source License; not reused). Every change to a reused file is listed in `vendor/dyad/VENDORED.md`.

## Publish: every application is a `.holo` cooked through PrismPM

Dyad's Publish panel offers "Publish as a Hologram application". The host builds the project's page with every dependency bundled in (a portable View has no network), encodes it as a HOLOVIEW v1 bundle, takes this very core as the Core-Wasm guest, asks the core for the model document and the source manifest bytes, and hands all of it to PrismPM's own archive composer, `compose_application`, which runs in the core: `core/src/holo/` and `core/src/error.rs` are PrismPM's files verbatim at the pinned commit (the lane refuses a build whose copy drifted, `tools/prismpm_vendor.sha256`). The result is a `.holo` v4 in PrismPM's closed Holo/1 profile, kept in the device store at its BLAKE3 address, served by the worker under `holo/<kappa>/`, downloadable as `holo/<kappa>.holo`, and loadable unchanged by hologram-live. `holo.html` runs any such file on any device, desktop or phone: PrismPM's validator in the core accepts the bytes, every blob re-derives to its address, the View unpacks under its address and opens. The core decides before anything is composed (`publishDecision`): the page's shell closure must be the closure the lane recorded beside the core in `shell/provenance.json`, and the lane's attestation must be present; otherwise the View's refusal word. The decisions and measurements are in `HOLOGRAM/DYAD-PUBLISH-HOLO-EVAL.md`.

## The model: five LexLean modules

`Workspace` (records, the snapshot preimage, restore, capabilities, versions, preview), `Inference` (the transcript, memo, the route table, the OpenAI wire, the OpenRouter request), `Object` (the kappa object addressing rule, pool and stage tables, pack, ladder, loader), `Publish` (the published application's model document, source manifest, decision and path) and `Dyad` (the one View of every visible word). `tools/author.py` writes them from `tools/model_workspace.py`, `tools/model_inference.py` and `tools/model_publish.py`.

## Module 1, workspace (the first commit)

Records: `Entry {path, kappa, bytes}`, `Project {label, entries}`, `Grant {endpoint}`, `Capabilities {endpoints}`, `View`. Rules: `snapshotPreimage` (the bytes a project state is addressed by; the model owns preimages, the host derives the BLAKE3 address), `restoreDecision` (stored bytes must re-derive to their address or are refused), `networkDecision` (an origin is admitted only when a grant lists it; the empty baseline admits nothing, as hologram-live decides). Theorems by reflexivity: `view_headline`, `admits_nothing_without_grants`, `refuses_without_grants`, `empty_project_preimage`.

The spikes that decided the design, with measurements, are in the HOLOGRAM workspace: `DYAD-BROWSER-FIRST-EVAL.md`.

## Licence

This repository: MIT or Apache 2.0. `vendor/dyad`: Apache 2.0 (see `vendor/dyad/LICENSE` and `NOTICE`).
