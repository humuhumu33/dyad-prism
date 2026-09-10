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
| Words | a `shell/index.html` whose committed or staged words differ from the projection of `view()` (the projector rewrites the page, then the lane compares against the index) | build | see the plant log; `plant.sh shell` stages a hand edit |
| Bytes | a generated function whose bytes differ from the rule on any corpus case (`model/corpus.json`) | build | armed 2026-09-10: `plant.sh bytes` changed one expected preimage; the corpus test failed on that case; restored, green |
| Restore | stored bytes that do not re-derive to their address (spike 6, planted flipped bit refused) | build | armed in the spike, to be re-armed here |
| Capability | a preview request to an origin no grant lists (spike 7, 403 with an audit row) | build | armed in the spike, to be re-armed here |

A gate is trusted only after a planted defect has been seen to trip it and a restore commit has been seen to clear it. `scripts/plant.sh` will hold the defects; the rows above say pending until each has been run.

## Theorems (Lean 4.32.1, leanchecker replayed, proof by reflexivity)

- `view_headline`: the View's headline is "Own Your Ideas".
- `admits_nothing_without_grants`: `admits [] origin = false`.
- `refuses_without_grants`: `networkDecision {endpoints = []} origin = Refuse`.
- `empty_project_preimage`: the preimage of a project with no entries unfolds to its literal shape.

String equality is not kernel reducible in Lean 4.32, so equality of concrete strings is never a theorem here; the corpus pins those bytes.

## What is not claimed

- That the browser host is free of bugs: the model owns rules and bytes; adapters are handwritten and covered by conformance runs, not proofs.
- That BLAKE3 is computed correctly: the address is derived by the holospaces wasm, `some-true` from that project's own verification.
