"""Stamp the built renderer so it runs in a plain browser, and stage the scaffold beside the shell.

The viewport meta: Dyad's index.html has none, so phones lay out at 980 px. The host: loaded before
the renderer's module script, so window.electron exists when the contracts read it. The scaffold:
Dyad's template with a file list, which the host creates apps from.
Run after `vite build` wrote shell/app/index.html: python3 scripts/stamp_shell.py
"""
import json, pathlib, shutil

root = pathlib.Path(__file__).resolve().parent.parent
index = root / "shell" / "app" / "index.html"
html = index.read_text(encoding="utf-8")
if 'name="viewport"' not in html:
    html = html.replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />', 1)
if "host.js" not in html:
    html = html.replace('<script type="module"', '<script type="module" src="../host.js"></script>\n    <script type="module"', 1)
index.write_text(html, encoding="utf-8", newline="\n")
print(f"stamped {index}")

src = root / "vendor" / "dyad" / "scaffold"
dst = root / "shell" / "scaffold"
if dst.exists():
    shutil.rmtree(dst)
shutil.copytree(src / "src", dst / "src")
for name in ("package.json", "tailwind.config.ts", "index.html", "AI_RULES.md"):
    if (src / name).exists():
        shutil.copy(src / name, dst / name)
app = dst / "src" / "App.tsx"
app.write_text(app.read_text(encoding="utf-8").replace("<BrowserRouter>", "<BrowserRouter basename={import.meta.env.BASE_URL}>", 1), encoding="utf-8", newline="\n")
files = sorted(str(p.relative_to(dst)).replace("\\", "/") for p in (dst / "src").rglob("*") if p.is_file())
(dst / "files.json").write_text(json.dumps(files), encoding="utf-8", newline="\n")
print(f"staged {len(files)} scaffold files")
