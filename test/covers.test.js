import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { fillMissingImages } from "../back/covers.js";

const originalFetch = globalThis.fetch;
const cover = (id) => `https://cdn-images.dzcdn.net/images/cover/${id}/500x500-000000-80-0-0.jpg`;
const picture = (id) => `https://cdn-images.dzcdn.net/images/artist/${id}/500x500-000000-80-0-0.jpg`;

function mockDeezer(handler) {
  const requests = [];
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    requests.push(parsed);
    return new Response(JSON.stringify({ data: handler(parsed) }));
  };
  return requests;
}

// O cache é do módulo, então cada teste usa nomes próprios.
describe("fillMissingImages", () => {
  afterEach(() => { globalThis.fetch = originalFetch; });

  test("faixa usa a capa da versão com o mesmo título, não a ao vivo", async () => {
    mockDeezer(() => [
      { title: "Sultans Of Swing (Live At Hammersmith Odeon)", artist: { name: "Dire Straits" }, album: { cover_big: cover("ao-vivo") } },
      { title: "Sultans Of Swing", artist: { name: "Dire Straits" }, album: { cover_big: cover("estudio") } },
    ]);
    const [track] = await fillMissingImages([{ name: "Sultans of Swing", artist: "Dire Straits", image: "" }], "musicas");
    assert.equal(track.image, cover("estudio"));
  });

  test("faixa de outro artista (remix) não é aceita", async () => {
    mockDeezer(() => [{ title: "HUMBLE. (Remix)", artist: { name: "Outro DJ" }, album: { cover_big: cover("remix") } }]);
    const [track] = await fillMissingImages([{ name: "HUMBLE.", artist: "Kendrick Lamar", image: "" }], "musicas");
    assert.equal(track.image, "");
  });

  test("artista ignora acentos e caixa, e recusa foto vazia do Deezer", async () => {
    mockDeezer((url) => (url.searchParams.get("q") === "Björk"
      ? [{ name: "bjork", picture_big: picture("bjork") }]
      : [{ name: "Sem Foto", picture_big: "https://cdn-images.dzcdn.net/images/artist//500x500-000000-80-0-0.jpg" }]));
    const items = await fillMissingImages([
      { name: "Björk", artist: "", image: "" },
      { name: "Sem Foto", artist: "", image: "" },
    ], "artistas");
    assert.deepEqual(items.map((item) => item.image), [picture("bjork"), ""]);
  });

  test("falha do Deezer mantém o item sem imagem e não derruba o resultado", async () => {
    globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
    const items = await fillMissingImages([{ name: "Artista Fora do Ar", artist: "", image: "" }], "artistas");
    assert.deepEqual(items, [{ name: "Artista Fora do Ar", artist: "", image: "" }]);
  });

  test("não consulta o Deezer para álbuns nem para itens que já têm imagem", async () => {
    const requests = mockDeezer(() => []);
    const album = [{ name: "Disco", artist: "Banda", image: cover("lastfm") }];
    assert.deepEqual(await fillMissingImages(album, "albuns"), album);
    await fillMissingImages([{ name: "Com Capa", artist: "Banda", image: cover("ja-tem") }], "musicas");
    assert.equal(requests.length, 0);
  });

  test("reaproveita a busca em cache", async () => {
    const requests = mockDeezer(() => [{ name: "Cacheado", picture_big: picture("cache") }]);
    await fillMissingImages([{ name: "Cacheado", artist: "", image: "" }], "artistas");
    const [artist] = await fillMissingImages([{ name: "Cacheado", artist: "", image: "" }], "artistas");
    assert.equal(artist.image, picture("cache"));
    assert.equal(requests.length, 1);
  });
});
