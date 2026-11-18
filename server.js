/**
 * Cyato Tea — production-style static server.
 * Serves dist/ HTML and public/assets, with clean URLs and gzip.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(root, "dist");
const assetsDir = path.join(root, "public", "assets");
const port = Number(process.env.PORT) || 4321;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

const COMPRESSIBLE = new Set([".html", ".css", ".js", ".json", ".xml", ".txt", ".svg", ".webmanifest"]);

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
};

function resolveTarget(pathname) {
  if (pathname.startsWith("/assets/")) {
    const builtAsset = path.resolve(distDir, `.${pathname}`);
    if (
      builtAsset.startsWith(distDir) &&
      fs.existsSync(builtAsset) &&
      fs.statSync(builtAsset).isFile()
    ) {
      return builtAsset;
    }

    const publicAsset = path.resolve(assetsDir, `.${pathname.slice("/assets".length)}`);
    return publicAsset.startsWith(assetsDir) ? publicAsset : null;
  }

  const clean = pathname.replace(/\/+$/, "");
  const candidates = [
    path.resolve(distDir, `.${pathname}`),
    path.resolve(distDir, `.${clean}/index.html`),
    path.resolve(distDir, `.${clean}.html`),
  ];

  return candidates.find((file) => file.startsWith(distDir) && fs.existsSync(file) && fs.statSync(file).isFile()) || null;
}

function send(res, req, status, filePath, extraHeaders = {}) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const stat = fs.statSync(filePath);

  const headers = {
    "Content-Type": type,
    ...securityHeaders,
    ...extraHeaders,
  };

  const wantsGzip =
    COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers["accept-encoding"] || "");

  if (wantsGzip) {
    const body = fs.readFileSync(filePath);
    const compressed = zlib.gzipSync(body, { level: 6 });
    headers["Content-Encoding"] = "gzip";
    headers["Content-Length"] = compressed.length;
    headers["Vary"] = "Accept-Encoding";
    res.writeHead(status, headers);
    if (req.method === "HEAD") return res.end();
    return res.end(compressed);
  }

  headers["Content-Length"] = stat.size;
  res.writeHead(status, headers);
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end("Method not allowed");
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400);
    return res.end("Bad request");
  }

  const target = resolveTarget(pathname);

  if (!target) {
    const notFound = path.join(distDir, "404.html");
    if (fs.existsSync(notFound)) return send(res, req, 404, notFound, { "Cache-Control": "no-cache" });
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }

  const ext = path.extname(target).toLowerCase();
  const isHtml = ext === ".html";
  const cache = isHtml
    ? "no-cache"
    : pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600";

  try {
    send(res, req, 200, target, { "Cache-Control": cache });
  } catch (error) {
    console.error("Failed to serve", target, error.message);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal error");
  }
});

server.listen(port, () => {
  console.log(`Cyato Tea running at http://localhost:${port}`);
});
