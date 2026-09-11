# Verification

Every claim carries its honesty level: `some-true` (from a source, not established here), `build` (validated here against an oracle, evidence not proof), `open` (measured or stated, never asserted).

## Gates

| Gate | What it refuses | Level | Armed by a planted defect |
|---|---|---|---|
| Authority | a `src/Dyad.lex.tex` that is not what `tools/author.py` writes | build | pending |
| Lock | a model whose `lexlean.lock` is not current | build | pending |
| Check | a semantic module outside the lexicon closure | build | pending |
| Verify | a theorem Lean cannot close by the stated proof, or a declaration whose observed axioms differ from its pinned exact set (`tools/axioms.json`) | build | armed 2026-09-10: `plant.sh words` (headline changed in the model, theorem kept) and `plant.sh grant` (`admits [] = true`) both made `rfl` fail in `lexlean verify`; restored, verify green |
| Export | two lean4-prod exports that are not byte identical | build | pending |
| Codegen | two prod-codegen runs that are not byte identical, or generated Rust that drifted from `generated/dyad_core.rs` | build | pending |
| Words | a `shell/index.html` whose committed or staged words differ from the projection of `view()` (the projector rewrites the page, then the lane compares against the index) | build | armed 2026-09-10: `plant.sh shell` staged a hand edit of the headline; the lane's compare refused it; restored, green |
| Bytes | a generated function whose bytes differ from the rule on any corpus case (`model/corpus.json`) | build | armed 2026-09-10: `plant.sh bytes` changed one expected preimage; the corpus test failed on that case; restored, green |
| Restore | stored bytes that do not re-derive to their address (spike 6, planted flipped bit refused) | build | armed in the spike, to be re-armed here |
| Capability | a preview request to an origin no grant lists (spike 7, 403 with an audit row) | build | armed in the spike, to be re-armed here |
| Composer | a vendored PrismPM archive file (`core/src/holo/*.rs`, `core/src/error.rs`) that is not PrismPM's at the pinned commit (`tools/prismpm_vendor.py` against `tools/prismpm_vendor.sha256`) | build | armed 2026-09-11: `plant.sh composer` changed one character of a comment in `core/src/holo/archive.rs`; the lane's vendor check refused it, naming the recorded, upstream and vendored digests; restored, green |
| Publish | a `.holo` that PrismPM's validator (`validate_application`, vendored) does not accept: the committed archive vector with one flipped byte (`core/tests/publish.rs`) | build | armed 2026-09-11: `plant.sh publish` flipped one bit at a third of the committed `model/objects/publish/hello.holo`; `validate_application` refused it and the test failed; restored, green |
| Evidence | a publish decision that differs from the rule on any corpus row (`model/publish.json`): no attestation, closure drift, or both, must refuse | build | armed 2026-09-11: `plant.sh evidence` said the closure drift row is accepted; the generated `publishDecision` disagreed and the test failed; restored, green |
| Provenance | a `shell/provenance.json` the lane could not derive in full (a missing field stops the lane, `tools/provenance.py`), or a page whose shell closure differs from the one recorded beside the core (the host's publish refuses with the View's word before anything is composed) | build | armed 2026-09-11 in the browser: the precached `provenance.json` was rewritten with one hex digit of the closure changed, then with no attestation id; both publishes were refused with the View's word and an audit row (`holo.application.publish refused`); the original restored, the next publish was accepted |

A gate is trusted only after a planted defect has been seen to trip it and a restore commit has been seen to clear it. `scripts/plant.sh` holds the defects. Authority, lock, check, export and codegen say pending: their defects are the next plants. CI (ubuntu, first run) went green on 91f0535, and Pages deploys `shell/`.

## Theorems (Lean 4.32.1, leanchecker replayed, proof by reflexivity)

- `view_headline`: the View's headline is "Own Your Ideas".
- `admits_nothing_without_grants`: `admits [] origin = false`.
- `refuses_without_grants`: `networkDecision {endpoints = []} origin = Refuse`.
- `empty_project_preimage`: the preimage of a project with no entries unfolds to its literal shape.
- `publish_refused_without_attestation`: `publishDecision c c none = Refuse` (a match on the option; the Accept row and the drift row are string comparisons, pinned by `model/publish.json`).
- `holo_path_shape`: `holoPath "k"` unfolds to `"/holo/" ++ "k" ++ "/"`.
- `publish_preimage_shape`: the model document of a published application unfolds to its literal shape.

String equality is not kernel reducible in Lean 4.32, so equality of concrete strings is never a theorem here; the corpus pins those bytes.

## What is not claimed

- That the browser host is free of bugs: the model owns rules and bytes; adapters are handwritten and covered by conformance runs, not proofs.
- That BLAKE3 is computed correctly: the address is derived by the holospaces wasm, `some-true` from that project's own verification; the composer's `address_bytes` (uor-hologram) agreed with it on every archive produced here, and the host refuses to keep an archive whose two addresses differ.
- That the composed archive is correct beyond what PrismPM's own validator and hologram-live's loader check: the composer is PrismPM's code verbatim, `some-true` from PrismPM's conformance runs; the round trip through hologram-live's `inspect_bytes` is `build`.
