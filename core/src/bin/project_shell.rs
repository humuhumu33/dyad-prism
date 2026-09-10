//! The shell is a projection of the verified View. This adapter renders `shell/index.html` from the
//! generated `view()`; no visible word is written here by hand. Compare mode in the lane refuses a
//! page whose words drifted from the model.

use dyad_core::view;
use std::fs;
use std::path::Path;

fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

fn index() -> String {
    let v = view();
    format!(
        r##"<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#d8e1fc">
<title>{title}</title>
<meta name="description" content="{lede}">
<link rel="stylesheet" href="shell.css">
</head>
<body>
<main>
  <h1>{title}</h1>
  <p class="lede">{lede}</p>
  <form class="composer" id="composer">
    <textarea id="input" rows="1" placeholder="{placeholder}" autocomplete="off" autofocus></textarea>
    <div class="row"><span class="hint mono" id="hint"></span><button class="btn" id="send" type="submit" aria-label="{send}">{send}</button></div>
  </form>
</main>
<script type="application/json" id="view">{view_json}</script>
<script type="module" src="shell.js"></script>
</body>
</html>
"##,
        title = esc(&v.headline),
        lede = esc(&v.lede),
        placeholder = esc(&v.promptPlaceholder),
        send = esc(&v.sendLabel),
        view_json = serde_json::json!({
            "headline": v.headline, "lede": v.lede, "promptPlaceholder": v.promptPlaceholder, "sendLabel": v.sendLabel,
            "buildingLabel": v.buildingLabel, "previewLabel": v.previewLabel, "snapshotLabel": v.snapshotLabel,
            "rollbackLabel": v.rollbackLabel, "refusedLabel": v.refusedLabel, "offlineLabel": v.offlineLabel,
        })
        .to_string()
        .replace("</", "<\\/"),
    )
}

fn main() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).parent().expect("repo root").to_path_buf();
    let shell = root.join("shell");
    fs::create_dir_all(&shell).expect("shell/");
    fs::write(shell.join("index.html"), index()).expect("write shell/index.html");
    println!("projected shell/index.html from view()");
}
