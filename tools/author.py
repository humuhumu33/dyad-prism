"""Authoring helper for src/Dyad.lex.tex, the authority of dyad-prism.

The .lex.tex file this script writes is the only thing LexLean and PrismPM read. The script exists so
the semantic module JSON (lexlean/semantic-module/1, the dialect PrismPM's examples/Calculator uses)
can be written as short Python instead of by hand. Run: python3 tools/author.py

Module 1, workspace: the records the browser host keeps, the bytes every address is derived from
(the model owns preimages, never digests), the restore rule (bytes that do not re-derive to their
address are refused), the capability rule (an origin is admitted only when a grant lists it; the empty
baseline admits nothing, as hologram-live decides it), and the View, every visible word of the shell.

Shapes kept because of lean4-prod's Rust generator, all met on freeinference-prism: a list returning
definition cannot be an intermediate; a string parameter of a string returning definition is owned and
a projected field arrives borrowed, so such definitions take the record and project inside; an owned
copy of a projected string is split on a delimiter and joined with the same delimiter; a match inside
a list literal lowers to a closure the exporter refuses, so it is hoisted into its own definition.
"""
import json, pathlib

NL = "\n"
BS = "\\"

# Exact axiom sets Lean observes per declaration, pinned by tools/pin_axioms.py (exact policy).
_PINS = pathlib.Path(__file__).resolve().parent / "axioms.json"
AXIOMS = json.loads(_PINS.read_text(encoding="utf-8")) if _PINS.exists() else {}

# ---- types
STRING = {"kind": "string"}
BYTES = {"kind": "bytes"}
BOOL = {"kind": "bool"}
U64 = {"kind": "uint64"}
def named(n): return {"arguments": [], "kind": "named", "member": {"name": n}}
def lst(t): return {"element": t, "kind": "list"}
def opt(t): return {"kind": "option", "value": t}

# ---- expressions
def var(n): return {"kind": "var", "name": n}
def s(v): return {"kind": "string", "value": v}
def u64(v): return {"kind": "integer", "representation": "uint64", "value": str(v)}
def u32(v): return {"kind": "integer", "representation": "uint32", "value": str(v)}
def b(v): return {"kind": "bool", "value": v}
def call(f, *args): return {"arguments": list(args), "function": {"name": f}, "kind": "call"}
def prim(op, result, *args): return {"arguments": list(args), "kind": "primitive", "operation": op, "result": result}
def ctor(name, *args, targs=()):
    return {"arguments": list(args), "constructor": {"name": name}, "kind": "constructor", "type_arguments": list(targs)}
def project(field, value): return {"field": field, "kind": "project", "value": value}
def if_(cond, then, else_): return {"condition": cond, "kind": "if", "then_value": then, "else_value": else_}
def match(scrutinee, *branches): return {"branches": list(branches), "kind": "match", "scrutinee": scrutinee}
def branch(ctor_name, binders, body): return {"binders": binders, "body": body, "constructor": {"name": ctor_name}}
def record(type_name, **fields): return {"fields": [{"field": k, "value": v} for k, v in fields.items()], "kind": "record", "type": {"name": type_name}}
def cons(head, tail): return {"head": head, "kind": "cons", "tail": tail}
def nil(t): return {"element": t, "kind": "nil"}
def strings(*items):
    out = nil(STRING)
    for item in reversed(items): out = cons(item, out)
    return out
def join(list_expr, sep=""): return prim("join", STRING, list_expr, s(sep))
def equal(a, c): return prim("equal", BOOL, a, c)
def eq(l, r): return {"kind": "eq", "left": l, "right": r}
def owned(expr):
    return match(prim("split_exact", opt(lst(STRING)), expr, s(NL), u32(2147483647)),
                 branch("Option.none", [], s("")),
                 branch("Option.some", ["fields"], join(var("fields"), NL)))
def esc_step(name, needle, replacement, inner):
    return definition(name, [("value", STRING)], STRING,
        match(prim("split_exact", opt(lst(STRING)), inner, s(needle), u32(2147483647)),
              branch("Option.none", [], s("")),
              branch("Option.some", ["parts"], join(var("parts"), replacement))))
def q(expr): return join(strings(s('"'), call("escapeJson", expr), s('"')))

# ---- declarations
def inductive(name, *ctors): return {"constructors": [{"fields": [], "name": c} for c in ctors], "kind": "inductive", "name": name, "parameters": [], "type_parameters": []}
def structure(name, **fields): return {"fields": [{"name": k, "type": v} for k, v in fields.items()], "kind": "structure", "name": name, "parameters": [], "type_parameters": []}
def definition(name, params, result, body, recursive=None):
    node = {"axioms": AXIOMS.get(name, []), "body": body, "kind": "definition", "name": name, "parameters": [{"name": k, "type": v} for k, v in params], "result": result}
    if recursive: node["recursive_argument"] = recursive
    return node
def theorem(name, statement, proof="reflexivity"): return {"axioms": AXIOMS.get(name, []), "kind": "theorem", "name": name, "parameters": [], "proof": {"kind": proof}, "statement": statement}

# The snapshot preimage, written once so the definition and the corpus share the term: entries in the
# order the host sorted them (by path, bytewise), each ["path","kappa",bytes], then the name, then the
# parent address ("" for the first snapshot). Keys sorted, no spaces, no trailing newline.
def preimage_body(project_, parent):
    return join(strings(s('{"entries":['), call("entryLines", project("entries", project_)), s('],"name":'), q(call("projectName", project_)),
                        s(',"parent":'), q(parent), s("}")))

decls = [
    # ---- records the host keeps
    structure("Entry", path=STRING, kappa=STRING, bytes=U64),
    structure("Project", label=STRING, entries=lst(named("Entry"))),
    inductive("Decision", "Accept", "Refuse"),
    # A network grant: one origin or one https prefix, as hologram-live's capabilities.json spells it.
    structure("Grant", endpoint=STRING),
    structure("Capabilities", endpoints=lst(named("Grant"))),
    # Every visible word of the shell; the projector renders the page from this record, nothing is
    # written in HTML by hand. No hyphens in any string.
    structure("View", headline=STRING, lede=STRING, promptPlaceholder=STRING, sendLabel=STRING,
              buildingLabel=STRING, previewLabel=STRING, snapshotLabel=STRING, rollbackLabel=STRING,
              refusedLabel=STRING, offlineLabel=STRING),

    # ---- JSON escaping, split and join, backslash first
    esc_step("escapeBackslash", BS, BS + BS, var("value")),
    esc_step("escapeQuote", '"', BS + '"', call("escapeBackslash", var("value"))),
    esc_step("escapeNewline", NL, BS + "n", call("escapeQuote", var("value"))),
    esc_step("escapeReturn", "\r", BS + "r", call("escapeNewline", var("value"))),
    definition("escapeJson", [("value", STRING)], STRING, call("escapeReturn", var("value"))),

    # ---- the address preimage of a project state
    definition("entryPath", [("entry", named("Entry"))], STRING, owned(project("path", var("entry")))),
    definition("entryKappa", [("entry", named("Entry"))], STRING, owned(project("kappa", var("entry")))),
    definition("projectName", [("project", named("Project"))], STRING, owned(project("label", var("project")))),
    definition("entryLine", [("entry", named("Entry"))], STRING,
        join(strings(s("["), q(call("entryPath", var("entry"))), s(","), q(call("entryKappa", var("entry"))), s(","),
                     prim("format_decimal", STRING, project("bytes", var("entry"))), s("]")))),
    definition("entryLines", [("entries", lst(named("Entry")))], STRING,
        match(var("entries"),
            branch("List.nil", [], s("")),
            branch("List.cons", ["entry", "rest"],
                match(var("rest"),
                    branch("List.nil", [], call("entryLine", var("entry"))),
                    branch("List.cons", ["next", "more"], join(strings(call("entryLine", var("entry")), call("entryLines", var("rest"))), ","))))),
        recursive="entries"),
    definition("snapshotPreimage", [("project", named("Project")), ("parent", STRING)], STRING,
        preimage_body(var("project"), var("parent"))),

    # ---- restore: the stored bytes must re-derive to the address they were stored under
    definition("restoreDecision", [("derived", STRING), ("expected", STRING)], named("Decision"),
        if_(equal(var("derived"), var("expected")), ctor("Decision.Accept"), ctor("Decision.Refuse"))),

    # ---- capabilities: admitted only when listed; nothing listed, nothing admitted
    definition("grantEndpoint", [("grant", named("Grant"))], STRING, owned(project("endpoint", var("grant")))),
    definition("admits", [("endpoints", lst(named("Grant"))), ("origin", STRING)], BOOL,
        match(var("endpoints"),
            branch("List.nil", [], b(False)),
            branch("List.cons", ["grant", "rest"],
                if_(equal(call("grantEndpoint", var("grant")), var("origin")), b(True), call("admits", var("rest"), var("origin"))))),
        recursive="endpoints"),
    definition("networkDecision", [("capabilities", named("Capabilities")), ("origin", STRING)], named("Decision"),
        if_(call("admits", project("endpoints", var("capabilities")), var("origin")), ctor("Decision.Accept"), ctor("Decision.Refuse"))),

    # ---- the words
    definition("view", [], named("View"), record("View",
        headline=s("Own Your Ideas"),
        lede=s("Describe it. It builds, runs and stays yours, in this browser, on no server."),
        promptPlaceholder=s("What do you want to build?"),
        sendLabel=s("Build"),
        buildingLabel=s("building in your browser"),
        previewLabel=s("Preview"),
        snapshotLabel=s("Sealed"),
        rollbackLabel=s("Go back"),
        refusedLabel=s("Refused: not what it claims to be"),
        offlineLabel=s("offline, working from your device"))),

    # ---- theorems: the shape of the rules, by unfolding; bytes are pinned by the corpus
    theorem("view_headline", eq(project("headline", call("view")), s("Own Your Ideas"))),
    theorem("admits_nothing_without_grants", eq(call("admits", nil(named("Grant")), s("https://example.com")), b(False))),
    theorem("refuses_without_grants",
        eq(call("networkDecision", record("Capabilities", endpoints=nil(named("Grant"))), s("https://example.com")), ctor("Decision.Refuse"))),
    theorem("empty_project_preimage",
        eq(call("snapshotPreimage", record("Project", label=s("a"), entries=nil(named("Entry"))), s("")),
           join(strings(s('{"entries":['), call("entryLines", nil(named("Entry"))), s('],"name":'), q(call("projectName", record("Project", label=s("a"), entries=nil(named("Entry"))))), s(',"parent":'), q(s("")), s("}"))))),
]

module = {"declarations": decls, "spec": "lexlean/semantic-module/1"}
text = ("\\begin{lexlean}{Dyad}\n"
        "\\useglossary{lexlean.std.bool@1.1.0}\n"
        "\\useglossary{lexlean.std.nat@1.1.0}\n"
        "\\title{Boolean}\n"
        "\\begin{semanticmodule}\n"
        "\\semanticdata{" + json.dumps(module, separators=(",", ":"), sort_keys=True, ensure_ascii=False) + "}\n"
        "\\end{semanticmodule}\n"
        "\\end{lexlean}\n")
out = pathlib.Path(__file__).resolve().parent.parent / "src" / "Dyad.lex.tex"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(text, encoding="utf-8", newline="\n")
roots = sorted(d["name"] for d in decls if d["kind"] == "definition")
(out.parent.parent / "model").mkdir(exist_ok=True)
(out.parent.parent / "model" / "roots.txt").write_text("\n".join(roots) + "\n", encoding="utf-8", newline="\n")
print(f"wrote {out} ({len(text)} bytes, {len(decls)} declarations, {len(roots)} roots)")
