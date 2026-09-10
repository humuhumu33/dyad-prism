#!/bin/bash
# Plant one defect, run the gate that should catch it, restore. A gate is trusted only after it has
# been seen to fail. Usage (from the project root, Linux x86_64 with the lane's prerequisites):
#   ./scripts/plant.sh words     # change a View word in the model but not the theorem: verify must refuse
#   ./scripts/plant.sh bytes     # change the corpus's expected preimage: the corpus test must refuse
#   ./scripts/plant.sh shell     # edit a word in shell/index.html by hand: the lane's compare must refuse
#   ./scripts/plant.sh grant     # make admits accept the empty list: the theorem must refuse
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LX="${DYAD_LANE_WORK:-$HOME/.cache/dyad-prism-lane}/PrismPM/target/release/lexlean"
export PATH="$HOME/.cargo/bin:$HOME/.elan/bin:$PATH"

restore() { git reset -q -- shell/index.html 2>/dev/null; git checkout -q -- tools/author.py model/corpus.json shell/index.html src/Dyad.lex.tex lexlean.lock 2>/dev/null; python3 tools/author.py >/dev/null; "$LX" lock >/dev/null 2>&1 || true; }
expect_fail() { if "$@" >/tmp/plant.log 2>&1; then echo "GATE DID NOT FIRE: $*"; tail -5 /tmp/plant.log; restore; exit 1; else echo "gate fired as it must: $*"; grep -m1 -E "error|violat|differ|drift|FAILED|panicked" /tmp/plant.log || tail -2 /tmp/plant.log; fi; }

case "${1:-}" in
  words)
    sed -i 's/headline=s("Own Your Ideas")/headline=s("Own your ideas")/' tools/author.py
    python3 tools/author.py >/dev/null; "$LX" lock >/dev/null 2>&1
    expect_fail "$LX" verify ;;
  grant)
    python3 - <<'EOF'
import io
p="tools/author.py"; s=io.open(p,encoding="utf-8").read()
a='''            branch("List.nil", [], b(False)),
            branch("List.cons", ["grant", "rest"],'''
b='''            branch("List.nil", [], b(True)),
            branch("List.cons", ["grant", "rest"],'''
assert s.count(a)==1; io.open(p,"w",encoding="utf-8",newline="\n").write(s.replace(a,b))
EOF
    python3 tools/author.py >/dev/null; "$LX" lock >/dev/null 2>&1
    expect_fail "$LX" verify ;;
  bytes)
    python3 - <<'EOF'
import io,json
p="model/corpus.json"; c=json.load(io.open(p,encoding="utf-8"))
c[1]["preimage"]=c[1]["preimage"].replace('"name":"hello"','"name":"hullo"')
io.open(p,"w",encoding="utf-8",newline="\n").write(json.dumps(c,indent=1,ensure_ascii=False)+"\n")
EOF
    expect_fail bash -c "cd core && cargo test --release -q --test corpus" ;;
  shell)
    # The words gate compares the projected page against the index, so the hand edit is staged as a
    # commit would stage it; an unstaged edit is simply overwritten by the projector.
    sed -i 's/<h1>Own Your Ideas<\/h1>/<h1>Own your ideas<\/h1>/' shell/index.html
    git add shell/index.html
    expect_fail bash -c "DYAD_LANE_WORK=${DYAD_LANE_WORK:-$HOME/.cache/dyad-prism-lane} ./scripts/lane.sh"
    git reset -q -- shell/index.html ;;
  *) echo "usage: $0 words|grant|bytes|shell" >&2; exit 2 ;;
esac
restore
echo "restored"
