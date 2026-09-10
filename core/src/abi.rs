//! The browser boundary: a host transport adapter, not the model.
//!
//! `holo_alloc`, `holo_free` and `holo_run` are the guest shape PrismPM's Core-Wasm guests export
//! (`core-wasm-v1` in hologram-live: `holo_alloc(i32) -> i32`, an entry `(i32, i32) -> i64` returning
//! `out_ptr << 32 | out_len`). Requests and responses are UTF-8 JSON; this adapter only decodes the
//! request into the generated records, calls the generated core, and encodes what came back. No rule
//! lives here.
//!
//! Operations:
//!   {"op":"preimage","project":{"label":"…","entries":[{"path","kappa","bytes"}]},"parent":"…"} -> {"bytes":"…"}
//!   {"op":"restore","derived":"blake3:…","expected":"blake3:…"} -> {"decision":"Accept"|"Refuse"}
//!   {"op":"network","endpoints":["https://…"],"origin":"https://…"} -> {"decision":"Accept"|"Refuse"}
//!   {"op":"view"} -> the View record as JSON
//! Errors: {"error":"…"}.

use crate::{networkDecision, restoreDecision, snapshotPreimage, view, Capabilities, Decision, Entry, Grant, Project};
use serde_json::{json, Value};

fn text(value: &Value) -> String {
    value.as_str().unwrap_or("").to_owned()
}

fn project(value: &Value) -> Project {
    Project {
        label: text(&value["label"]),
        entries: value["entries"]
            .as_array()
            .map(|entries| {
                entries
                    .iter()
                    .map(|e| Entry { path: text(&e["path"]), kappa: text(&e["kappa"]), bytes: e["bytes"].as_u64().unwrap_or(0) })
                    .collect()
            })
            .unwrap_or_default(),
    }
}

fn decision(d: Decision) -> Value {
    json!({ "decision": match d { Decision::Accept => "Accept", Decision::Refuse => "Refuse" } })
}

fn run(input: &[u8]) -> Value {
    let value: Value = match serde_json::from_slice(input) {
        Ok(value) => value,
        Err(error) => return json!({ "error": format!("request is not JSON: {error}") }),
    };
    match value["op"].as_str().unwrap_or("") {
        "preimage" => json!({ "bytes": snapshotPreimage(&project(&value["project"]), text(&value["parent"])) }),
        "restore" => decision(restoreDecision(text(&value["derived"]), text(&value["expected"]))),
        "network" => {
            let caps = Capabilities {
                endpoints: value["endpoints"]
                    .as_array()
                    .map(|l| l.iter().map(|e| Grant { endpoint: text(e) }).collect())
                    .unwrap_or_default(),
            };
            decision(networkDecision(&caps, text(&value["origin"])))
        }
        "view" => view_json(),
        other => json!({ "error": format!("unknown op {other:?}") }),
    }
}

/// The View record as JSON, field by field, so the shell and the projector read the same words.
pub fn view_json() -> Value {
    let v = view();
    json!({
        "headline": v.headline, "lede": v.lede, "promptPlaceholder": v.promptPlaceholder, "sendLabel": v.sendLabel,
        "buildingLabel": v.buildingLabel, "previewLabel": v.previewLabel, "snapshotLabel": v.snapshotLabel,
        "rollbackLabel": v.rollbackLabel, "refusedLabel": v.refusedLabel, "offlineLabel": v.offlineLabel,
    })
}

/// Allocate `len` bytes the host writes a request into.
#[no_mangle]
pub extern "C" fn holo_alloc(len: i32) -> i32 {
    let mut buffer = Vec::<u8>::with_capacity(len.max(0) as usize);
    let pointer = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    pointer as i32
}

/// Release a buffer `holo_alloc` or `holo_run` handed out.
#[no_mangle]
pub extern "C" fn holo_free(pointer: i32, len: i32) {
    if pointer != 0 && len > 0 {
        // SAFETY: only pointers this module allocated with the same length are passed back.
        unsafe { drop(Vec::from_raw_parts(pointer as *mut u8, len as usize, len as usize)) };
    }
}

/// Run one request. Returns `(pointer << 32) | len` of a UTF-8 JSON response the host must free.
#[no_mangle]
pub extern "C" fn holo_run(pointer: i32, len: i32) -> i64 {
    // SAFETY: the host wrote `len` bytes at a pointer from `holo_alloc`.
    let input = unsafe { std::slice::from_raw_parts(pointer as *const u8, len.max(0) as usize) };
    let output = run(input).to_string().into_bytes();
    let out_len = output.len() as i64;
    let mut output = output.into_boxed_slice();
    let out_pointer = output.as_mut_ptr() as i64;
    std::mem::forget(output);
    (out_pointer << 32) | out_len
}
