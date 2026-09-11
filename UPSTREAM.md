# Upstream requests

Each entry is precise enough to be a pull request description.

## LexLean (UOR-Foundation/PrismPM vendor/lexlean 0.3.0): a `std-fs` feature so `check` compiles to wasm32

Measured on PrismPM f57a697 with Rust 1.97.1: `cargo build --lib --target wasm32-wasip1` fails inside the crate with `cannot find module or crate sys` (nine sites; the `fs4` file locking and `same-file` paths have no WASI implementation); `--target wasm32-unknown-unknown` fails earlier in `errno` ("target OS is unknown"). Request: gate the lock file and same-file logic behind a default `std-fs` feature and add an API that takes the project's files as bytes, so `check` (lexicon closure, semantic module validation) can run in a browser tab while `build` and `verify` stay on the normative host. A browser builder that authors PrismPM models could then refuse an invalid model before the lane runs.

## PrismPM v0.3: an application projection for text Views

Same request as freeinference-prism's `UPSTREAM.md`: the application projection is calculator shaped (operation type, two integers, fixed labels). dyad-prism's View is a record of strings and lists projected by a handwritten adapter; a text View family in the projector would remove that adapter.

## Dyad (dyad-sh/dyad 00d5f5af7fd0): a viewport meta and a platform gate for window chrome

`index.html` has no `<meta name="viewport">`, so the renderer lays out at 980 px on phones; the title bar with minimize, maximize and close renders even when `get-system-platform` is not a desktop. Both are one line each and would let the renderer run in a browser without a patch to reused files.

## hologram-live (a9f44a5): the docs page for `.holo` says versions 2 to 4 are accepted; the code accepts only 4

`src/holo_format.rs:5-21` admits `HOLO` plus little-endian u16 version 4 only; `apps/docs/src/pages/docs/holo-files.astro` says readers accept 2 to 4. Request: align the page with the code.

## PrismPM f57a697: the Hologram composer as a crate of its own

`crates/prismpm/src/holo/archive.rs` (`compose_application`, `validate_application`) depends only on `holo/canonical.rs`, `holo/model_document.rs`, `holo/validate.rs` and `error.rs`, on `uor-hologram` (features `archive`, `space`), `serde`, `serde_json` and `sha2`; those five files compile unchanged for `wasm32-unknown-unknown` (measured here: 40 KB of wasm for the uor-hologram crates, the composer running in a browser tab). The `prismpm` crate as a whole does not (clap, fs4, jsonschema, lexlean). dyad-prism vendors the five files verbatim and checks their digests against the pinned commit in its lane. Request: publish them as a `prismpm-holo` library crate (or a `holo` feature that drops the CLI dependencies), so a browser can compose and validate Holo/1 archives with PrismPM's own code without a copy.

## PrismPM f57a697: a capability request on `ApplicationArchiveInput`

`compose_application` fixes the archive's capability request to the empty baseline (`empty_capabilities()` in `archive.rs`) and `validate_application` accepts nothing else. A published application therefore cannot declare the network endpoints it was granted while previewed; hologram-live would enforce them from `capabilities.json` v2 if the archive carried them. Request: an optional `capability_request: Option<Capabilities>` on the input, canonicalised through `CapabilitySet` and validated like the manifest, with the empty baseline as the default and the only accepted value for the Holo/1 profile unless the profile is extended.

## hologram-live a9f44a5: a base path for a portable View served under a directory

A portable View is served by the desktop surface at an origin root; a browser host that serves the same bundle under `holo/<kappa>/` needs the page to learn its base. dyad-prism defines the scaffold's `BASE_URL` from `location.pathname` at load. Request: document (or provide in the intent contract) the base path a portable View may assume, so one bundle serves both surfaces without host specific code.

