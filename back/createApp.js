import express from "express";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getResults, LastFmError, PERIODS, TYPES } from "./lastfm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const vercelConfig = require("../vercel.json");
const frontDir = path.join(__dirname, "../public");
const pageFiles = {
  "/": "index.html",
  "/consulta": "consulta.html",
  "/carrinho": "carrinho.html",
  "/sobre": "sobre.html",
  "/privacidade": "privacidade.html",
  "/termos": "termos.html",
  "/contato": "contato.html",
};
const unlistedPages = new Set(["/carrinho", "/contato"]);

const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,59}$/;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 30;
const MAX_TRACKED_CLIENTS = 1000;

const platformSecurityHeaders = vercelConfig.headers
  .find(({ source }) => source === "/(.*)")
  ?.headers ?? [];

function securityHeaders(req, res, next) {
  for (const { key, value } of platformSecurityHeaders) res.setHeader(key, value);
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}

function createRateLimiter() {
  const requests = new Map();

  function pruneExpired(now) {
    for (const [key, entry] of requests) {
      if (now - entry.startedAt >= RATE_WINDOW_MS) requests.delete(key);
    }
  }

  return (req, res, next) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    if (requests.size >= MAX_TRACKED_CLIENTS) pruneExpired(now);

    const previous = requests.get(key);
    const current = !previous || now - previous.startedAt >= RATE_WINDOW_MS
      ? { startedAt: now, count: 0 }
      : previous;

    current.count += 1;
    requests.set(key, current);

    if (current.count > RATE_LIMIT) {
      const seconds = Math.ceil((RATE_WINDOW_MS - (now - current.startedAt)) / 1000);
      res.setHeader("Retry-After", String(seconds));
      return res.status(429).json({ erro: "Muitas consultas em pouco tempo. Aguarde alguns minutos." });
    }

    return next();
  };
}

export function validateQuery(query) {
  const user = String(query.user || "").trim();
  const periodo = String(query.periodo || "");
  const tipo = String(query.tipo || "");

  if (!USERNAME_PATTERN.test(user)) {
    return { error: "Informe um usuário Last.fm válido, usando letras, números, hífen ou sublinhado." };
  }
  if (!PERIODS.has(periodo) || !TYPES.has(tipo)) {
    return { error: "Os filtros enviados são inválidos." };
  }
  return { user, periodo, tipo };
}

function siteUrl(req) {
  const configured = process.env.PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

export function createApp(app = express()) {
  const cache = new Map();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /carrinho\nSitemap: ${siteUrl(req)}/sitemap.xml\n`);
  });
  app.use(express.static(frontDir, {
    etag: true,
    index: false,
    cacheControl: false,
    setHeaders: (res, filePath) => {
      // JS e CSS mudam junto com o HTML a cada deploy; revalidar evita página nova com script antigo.
      res.setHeader("Cache-Control", /\.(js|css)$/.test(filePath) ? "no-cache" : "public, max-age=86400");
    },
  }));

  app.get("/sitemap.xml", (req, res) => {
    const origin = siteUrl(req);
    const urls = Object.keys(pageFiles)
      .filter((route) => !unlistedPages.has(route))
      .map((route) => `  <url><loc>${origin}${route}</loc></url>`)
      .join("\n");
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
  });

  // Endereço antigo da página de resultado; mantido para links já compartilhados.
  app.get("/inicial", (req, res) => {
    const queryIndex = req.originalUrl.indexOf("?");
    res.redirect(301, `/carrinho${queryIndex === -1 ? "" : req.originalUrl.slice(queryIndex)}`);
  });

  for (const [route, filename] of Object.entries(pageFiles)) {
    app.get(route, (_req, res) => res.sendFile(path.join(frontDir, filename)));
  }

  app.get("/api/gerar", createRateLimiter(), async (req, res) => {
    const query = validateQuery(req.query);
    if (query.error) return res.status(400).json({ erro: query.error });

    const key = `${query.user.toLowerCase()}:${query.periodo}:${query.tipo}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=600");
      return res.json(cached.data);
    }

    try {
      const data = await getResults(query.user, query.periodo, query.tipo);
      if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
      cache.set(key, { createdAt: Date.now(), data });
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=600");
      return res.json(data);
    } catch (error) {
      if (error instanceof LastFmError) return res.status(error.status).json({ erro: error.message });
      console.error(error);
      return res.status(500).json({ erro: "Erro inesperado ao buscar seus dados." });
    }
  });

  app.use((_req, res) => res.status(404).sendFile(path.join(frontDir, "404.html")));
  return app;
}
