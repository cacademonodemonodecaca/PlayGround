#!/usr/bin/env bash
# Serve the built static game (PROJECT_DIR/dist) in the foreground on PORT (default 3000).
# - Source and built output stay inside PROJECT_DIR.
# - OPENCODE_WEB_DIR is used only for worker metadata (deployment-output.json).
# - Every significant command is timed with /usr/bin/time -p.
set -euo pipefail

cd "$(dirname "$0")" # shell builtin; real commands below are each timed
PROJECT_ROOT="$(pwd)"
/usr/bin/time -p test -f package.json
PORT="${PORT:-3000}"
/usr/bin/time -p test "$PORT" -ge 1 -a "$PORT" -le 65535
export PORT

# Install dependencies when needed (missing node_modules or manifest changed).
# Note: npm ci recreates node_modules, so the stamp dir is (re)created after install.
STAMP_FILE="node_modules/.cache/start-dependencies"
MANIFEST_HASH="$(/usr/bin/time -p sh -c 'sha256sum package.json package-lock.json 2>/dev/null | sha256sum' | cut -d' ' -f1)"
if [[ ! -f "$STAMP_FILE" ]] || [[ "$(/usr/bin/time -p cat "$STAMP_FILE")" != "$MANIFEST_HASH" ]] || [[ ! -x node_modules/.bin/vite ]]; then
  if [[ -f package-lock.json ]]; then
    /usr/bin/time -p npm ci --no-audit --no-fund
  else
    /usr/bin/time -p npm install --no-audit --no-fund
  fi
  /usr/bin/time -p mkdir -p "$(dirname "$STAMP_FILE")"
  /usr/bin/time -p printf '%s' "$MANIFEST_HASH" > "$STAMP_FILE"
fi

# Build when needed (missing output or any source newer than the output).
if [[ ! -f dist/index.html ]] || [[ -n "$(/usr/bin/time -p find src public index.html package.json vite.config.js -newer dist/index.html -print -quit 2>/dev/null)" ]]; then
  /usr/bin/time -p npm run build
fi
/usr/bin/time -p test -f dist/index.html

# Publish deployment metadata for the controller (worker metadata only).
if [[ -n "${OPENCODE_WEB_DIR:-}" ]]; then
  /usr/bin/time -p mkdir -p "$OPENCODE_WEB_DIR"
  /usr/bin/time -p node -e 'const fs=require("node:fs");const [root,dir,out]=process.argv.slice(1);fs.writeFileSync(out,JSON.stringify({project:root,directory:dir}));' "$PROJECT_ROOT" "$PROJECT_ROOT/dist" "$OPENCODE_WEB_DIR/deployment-output.json"
  /usr/bin/time -p cat "$OPENCODE_WEB_DIR/deployment-output.json"
  echo
else
  echo 'warning: OPENCODE_WEB_DIR is not set; skipping deployment-output.json' >&2
fi

# Serve the static build in the foreground (exec keeps this script as the server process).
exec /usr/bin/time -p node -e '
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(process.cwd(), "dist");
const port = Number(process.env.PORT || 3000);
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".wasm": "application/wasm", ".glb": "model/gltf-binary", ".map": "application/json" };
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let file = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(404); res.end("Not found"); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      const fallback = path.join(root, "index.html"); // SPA fallback for extensionless routes
      if (!path.extname(file) && fs.existsSync(fallback)) file = fallback;
      else { res.writeHead(404); res.end("Not found"); return; }
    }
    res.setHeader("Content-Type", mime[path.extname(file).toLowerCase()] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache");
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(404); res.end("Not found"); }
});
server.listen(port, "0.0.0.0", () => console.log(`Serving ${root} on port ${port}`));
'
