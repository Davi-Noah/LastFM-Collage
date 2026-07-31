import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getResults, LastFmError, PERIODS, TYPES } from "./script.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontDir = path.join(__dirname, "../front");
const pageFiles = {
  "/": "index.html",
  "/consulta": "consulta.html",
  "/inicial": "inicial.html",
  "/sobre": "sobre.html",
  "/privacidade": "privacidade.html",
  "/termos": "termos.html",
  "/contato": "contato.html",
};

const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const requests = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 30;

function securityHeaders(req, res, next) {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' https://pagead2.googlesyndication.com https://cdnjs.cloudflare.com",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://lastfm.freetls.fastly.net https://*.last.fm",
    "connect-src 'self' https://pagead2.googlesyndication.com https://*.google.com",
    "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.removeHeader("X-Powered-By");
  next();
}

function apiRateLimit(req, res, next) {
  const key = req.ip || "unknown";
  const now = Date.now();
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
}

function validateQuery(query) {
  const user = String(query.user || "").trim();
  const periodo = String(query.periodo || "");
  const tipo = String(query.tipo || "");

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,59}$/.test(user)) {
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

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /inicial\nSitemap: ${siteUrl(req)}/sitemap.xml\n`);
  });
  app.use(express.static(frontDir, { etag: true, maxAge: "1d", index: false }));

  app.get("/sitemap.xml", (req, res) => {
    const origin = siteUrl(req);
    const pages = Object.keys(pageFiles).filter((route) => !["/inicial", "/contato"].includes(route));
    const urls = pages
      .map((route) => `  <url><loc>${origin}${route}</loc></url>`)
      .join("\n");
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
  });

  for (const [route, filename] of Object.entries(pageFiles)) {
    app.get(route, (_req, res) => res.sendFile(path.join(frontDir, filename)));
  }

  app.get("/api/gerar", apiRateLimit, async (req, res) => {
    const query = validateQuery(req.query);
    if (query.error) return res.status(400).json({ erro: query.error });

    const key = `${query.user}:${query.periodo}:${query.tipo}`;
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
      const status = error instanceof LastFmError ? error.status : 500;
      const message = error instanceof LastFmError ? error.message : "Erro inesperado ao buscar seus dados.";
      return res.status(status).json({ erro: message });
    }
  });

  app.use((_req, res) => res.status(404).sendFile(path.join(frontDir, "404.html")));
  return app;
}
