import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { getResults, LastFmError, normalizeItems, PERIODS, TYPES } from "../back/lastfm.js";

test("aceita somente os filtros suportados", () => {
  assert.deepEqual([...PERIODS], ["1_mes", "6_meses", "todo_tempo"]);
  assert.deepEqual([...TYPES], ["musicas", "artistas", "albuns"]);
});

describe("normalizeItems", () => {
  test("normaliza faixas e usa a maior imagem https", () => {
    const data = {
      toptracks: {
        track: [{
          name: "Faixa",
          artist: { name: "Banda" },
          playcount: "12",
          duration: "200",
          image: [
            { "#text": "https://lastfm.freetls.fastly.net/i/u/34s/pequena.jpg", size: "small" },
            { "#text": "https://lastfm.freetls.fastly.net/i/u/300x300/grande.jpg", size: "extralarge" },
            { "#text": "", size: "mega" },
          ],
        }],
      },
    };

    assert.deepEqual(normalizeItems(data, "musicas"), [{
      name: "Faixa",
      artist: "Banda",
      playcount: 12,
      duration: 200,
      image: "https://lastfm.freetls.fastly.net/i/u/300x300/grande.jpg",
    }]);
  });

  test("aceita item único fora de array e preenche campos ausentes", () => {
    const [album] = normalizeItems({ topalbums: { album: { playcount: "abc" } } }, "albuns");
    assert.deepEqual(album, { name: "Álbum sem nome", artist: "Artista desconhecido", playcount: 0, duration: 0, image: "" });
  });

  test("descarta imagens http e a estrela genérica de artista", () => {
    const items = normalizeItems({
      topartists: {
        artist: [
          { name: "A", image: [{ "#text": "http://exemplo.com/capa.jpg" }] },
          { name: "B", image: [{ "#text": "https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png" }] },
        ],
      },
    }, "artistas");
    assert.deepEqual(items.map((item) => item.image), ["", ""]);
  });

  test("devolve lista vazia quando a Last.fm não traz itens", () => {
    assert.deepEqual(normalizeItems({ toptracks: {} }, "musicas"), []);
  });
});

describe("getResults", () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.LASTFM_API_KEY;
  const originalConsoleError = console.error;

  beforeEach(() => {
    process.env.LASTFM_API_KEY = "chave-teste";
    console.error = () => {};
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    if (originalKey === undefined) delete process.env.LASTFM_API_KEY;
    else process.env.LASTFM_API_KEY = originalKey;
  });

  function respondWith(body, status = 200) {
    globalThis.fetch = async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }

  async function assertLastFmError(status, messagePattern) {
    await assert.rejects(getResults("usuario", "1_mes", "musicas"), (error) => {
      assert.ok(error instanceof LastFmError);
      assert.equal(error.status, status);
      assert.match(error.message, messagePattern);
      return true;
    });
  }

  test("monta a URL da Last.fm com os parâmetros mapeados", async () => {
    let requested;
    globalThis.fetch = async (url) => {
      requested = new URL(url);
      return new Response(JSON.stringify({ topalbums: { album: [] } }));
    };

    await getResults("usuario", "6_meses", "albuns");
    assert.equal(requested.searchParams.get("method"), "user.gettopalbums");
    assert.equal(requested.searchParams.get("period"), "6month");
    assert.equal(requested.searchParams.get("user"), "usuario");
    assert.equal(requested.searchParams.get("limit"), "7");
  });

  test("usuário inexistente vira 404 em português, mesmo com status HTTP de erro", async () => {
    respondWith({ error: 6, message: "User not found" }, 404);
    await assertLastFmError(404, /Não encontramos esse usuário/);
  });

  test("limite de consultas da Last.fm vira 503", async () => {
    respondWith({ error: 29, message: "Rate limit exceeded" }, 429);
    await assertLastFmError(503, /limitando consultas/);
  });

  test("chave inválida não expõe a mensagem original", async () => {
    respondWith({ error: 10, message: "Invalid API key" }, 403);
    await assertLastFmError(503, /indisponível/);
  });

  test("resposta que não é JSON vira 502", async () => {
    respondWith("<html>erro</html>", 500);
    await assertLastFmError(502, /não respondeu como esperado/);
  });

  test("falha de rede vira 502", async () => {
    globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
    await assertLastFmError(502, /Não foi possível conectar/);
  });

  test("timeout vira 504", async () => {
    globalThis.fetch = async () => { throw new DOMException("aborted", "AbortError"); };
    await assertLastFmError(504, /demorou/);
  });

  test("sem chave configurada vira 503 sem chamar a Last.fm", async () => {
    delete process.env.LASTFM_API_KEY;
    globalThis.fetch = async () => assert.fail("não deveria chamar a Last.fm");
    await assertLastFmError(503, /não foi configurada/);
  });
});
