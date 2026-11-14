/** WEB — лише статика сайту. API на окремому api-server. */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const WEB_PORT = Number(process.env.PORT || 3847);
const API_URL = process.env.API_URL || "http://127.0.0.1:3848";
const PUBLIC = path.join(__dirname, "..", "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function proxy(req, res, targetPath) {
  const u = new URL(targetPath, API_URL);
  const preq = http.request(
    {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: req.method,
      headers: { ...req.headers, host: u.host },
    },
    (pres) => {
      res.writeHead(pres.statusCode || 502, pres.headers);
      pres.pipe(res);
    }
  );
  preq.on("error", () => {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "API-SERVER недоступний. Запустіть: npm run api" }));
  });
  req.pipe(preq);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return proxy(req, res, url.pathname + url.search);

    let filePath = path.join(PUBLIC, url.pathname === "/" ? "index.html" : url.pathname);
    if (!filePath.startsWith(PUBLIC)) {
      res.writeHead(403);
      return res.end("Заборонено");
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("Не знайдено");
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(WEB_PORT, () => {
    console.log(`[web] http://localhost:${WEB_PORT}`);
    console.log(`[web] API → ${API_URL}`);
  });
