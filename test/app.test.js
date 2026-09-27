import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import { createApp, validateQuery } from "../back/createApp.js";

const require = createRequire(import.meta.url);
const vercelConfig = require("../vercel.json");

// Política do AdSense: nada de anúncio em telas sem conteúdo do editor (formulário, resultado, contato, legais, erro).
test("script de anúncios só aparece em páginas com conteúdo editorial", () => {
  const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
  const withAds = readdirSync(publicDir, { recursive: true })
    .filter((file) => file.endsWith(".html"))
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => readFileSync(path.join(publicDir, file), "utf8").includes("/scripts/ads.js"))
    .sort();
  assert.deepEqual(withAds, [
    "guias/como-ler-estatisticas.html",
    "guias/conectar-spotify-lastfm.html",
    "guias/o-que-e-scrobble.html",
    "guias/perguntas-frequentes.html",
    "index.html",
    "sobre.html",
  ]);
});

describe("validateQuery", () => {
  test("aceita uma consulta válida e remove espaços do usuário", () => {
    assert.deepEqual(validateQuery({ user: "  rj_2-x ", periodo: "1_mes", tipo: "albuns" }), {
      user: "rj_2-x",
      periodo: "1_mes",
      tipo: "albuns",
    });
  });

  test("recusa usuários fora do padrão", () => {
    for (const user of ["", "_comeca-com-sublinhado", "com espaço", "a".repeat(61), "<script>"]) {
      assert.ok(validateQuery({ user, periodo: "1_mes", tipo: "albuns" }).error, user);
    }
  });

  test("recusa filtros desconhecidos", () => {
    assert.ok(validateQuery({ user: "rj", periodo: "semana", tipo: "albuns" }).error);
    assert.ok(validateQuery({ user: "rj", periodo: "1_mes", tipo: "podcasts" }).error);
  });
});

describe("rotas", () => {
  let server;
  let baseUrl;

  before(async () => {
    server = createApp().listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server.close());

  test("/inicial redireciona para /carrinho mantendo a consulta", async () => {
    const response = await fetch(`${baseUrl}/inicial?user=rj&periodo=1_mes&tipo=albuns`, { redirect: "manual" });
    assert.equal(response.status, 301);
    assert.equal(response.headers.get("location"), "/carrinho?user=rj&periodo=1_mes&tipo=albuns");
  });

  test("páginas respondem com cabeçalhos de segurança", async () => {
    const response = await fetch(`${baseUrl}/carrinho`);
    assert.equal(response.status, 200);
    const configuredCsp = vercelConfig.headers
      .find(({ source }) => source === "/(.*)")
      ?.headers.find(({ key }) => key === "Content-Security-Policy")
      ?.value;
    assert.match(configuredCsp, /frame-ancestors 'none'/);
    assert.equal(response.headers.get("content-security-policy"), configuredCsp);
    assert.equal(response.headers.get("x-powered-by"), null);
  });

  test("JS e CSS são revalidados; imagens ficam em cache", async () => {
    assert.equal((await fetch(`${baseUrl}/scripts/results.js`)).headers.get("cache-control"), "no-cache");
    assert.equal((await fetch(`${baseUrl}/styles/style.css`)).headers.get("cache-control"), "no-cache");
    assert.equal((await fetch(`${baseUrl}/imgs/screen-removebg-preview.png`)).headers.get("cache-control"), "public, max-age=86400");
  });

  test("sitemap não lista páginas fora do índice", async () => {
    const body = await (await fetch(`${baseUrl}/sitemap.xml`)).text();
    assert.match(body, /\/consulta</);
    assert.doesNotMatch(body, /\/carrinho</);
    assert.doesNotMatch(body, /\/contato</);
  });

  test("guias respondem e entram no sitemap", async () => {
    const sitemap = await (await fetch(`${baseUrl}/sitemap.xml`)).text();
    for (const route of ["/guias", "/guias/conectar-spotify-lastfm", "/guias/o-que-e-scrobble", "/guias/como-ler-estatisticas", "/guias/perguntas-frequentes"]) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.status, 200, route);
      assert.match(await response.text(), /<h1/, route);
      assert.match(sitemap, new RegExp(`${route}<`), route);
    }
  });

  test("rota desconhecida devolve 404", async () => {
    const response = await fetch(`${baseUrl}/nao-existe`);
    assert.equal(response.status, 404);
  });

  test("API recusa consulta inválida e depois aplica o limite por IP", async () => {
    const url = `${baseUrl}/api/gerar?user=_invalido&periodo=1_mes&tipo=albuns`;
    const first = await fetch(url);
    assert.equal(first.status, 400);
    assert.ok((await first.json()).erro);

    for (let i = 0; i < 29; i += 1) await (await fetch(url)).body?.cancel();
    const limited = await fetch(url);
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
  });
});
