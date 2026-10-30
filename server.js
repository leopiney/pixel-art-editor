// Tiny zero-dependency static server: serves this folder and opens the browser.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const ROOT = path.join(__dirname, "public");
const START_PORT = Number(process.env.PORT) || 5173;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const filePath = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);
  if (!filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
});

function openBrowser(url) {
  if (process.env.NO_OPEN) return;
  const cmd =
    process.platform === "darwin" ? `open "${url}"` :
    process.platform === "win32" ? `start "" "${url}"` :
    `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function listen(port) {
  server.once("error", (err) => {
    if (err.code === "EADDRINUSE" && port < START_PORT + 20) listen(port + 1);
    else throw err;
  });
  server.listen(port, "127.0.0.1", () => {
    const url = `http://localhost:${port}`;
    console.log(`Pixel Art Editor running at ${url}  (Ctrl+C to stop)`);
    openBrowser(url);
  });
}

listen(START_PORT);
