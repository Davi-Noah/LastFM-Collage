// A Last.fm devolve a mesma estrela genérica para toda faixa e todo artista, então
// buscamos capas de faixa e fotos de artista na API pública do Deezer (sem chave).
// É um complemento: qualquer falha aqui só deixa o item com o placeholder.
const DEEZER_BASE_URL = "https://api.deezer.com";
const REQUEST_TIMEOUT_MS = 4_000;
const MAX_CACHE_ENTRIES = 2_000;

const cache = new Map();

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function httpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

async function searchDeezer(kind, query, limit) {
  const url = new URL(`${DEEZER_BASE_URL}/search/${kind}`);
  url.search = new URLSearchParams({ q: query, limit: String(limit) }).toString();
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Deezer respondeu ${response.status}`);
  const data = await response.json();
  return Array.isArray(data?.data) ? data.data : [];
}

async function findArtistImage(name) {
  const target = normalize(name);
  const results = await searchDeezer("artist", name, 3);
  const match = results.find((artist) => normalize(artist.name) === target);
  // Artista sem foto no Deezer vem com o hash vazio: .../images/artist//500x500...
  if (!match?.picture_big || match.picture_big.includes("/artist//")) return "";
  return httpsUrl(match.picture_big);
}

async function findTrackImage(title, artist) {
  const targetTitle = normalize(title);
  const targetArtist = normalize(artist);
  // A busca avançada (artist:"" track:"") do Deezer não retorna nada hoje; a busca livre funciona.
  const results = await searchDeezer("track", `${artist} ${title}`, 5);
  const sameArtist = results.filter((track) => normalize(track.artist?.name) === targetArtist);
  const match = sameArtist.find((track) => normalize(track.title) === targetTitle)
    || sameArtist.find((track) => normalize(track.title).startsWith(targetTitle));
  return httpsUrl(match?.album?.cover_big);
}

async function cachedLookup(key, lookup) {
  if (cache.has(key)) return cache.get(key);
  const image = await lookup();
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, image);
  return image;
}

export async function fillMissingImages(items, type) {
  if (type !== "musicas" && type !== "artistas") return items;

  const lookups = items.map((item) => {
    if (item.image) return Promise.resolve(item.image);
    return type === "artistas"
      ? cachedLookup(`artist:${normalize(item.name)}`, () => findArtistImage(item.name))
      : cachedLookup(`track:${normalize(item.artist)}:${normalize(item.name)}`, () => findTrackImage(item.name, item.artist));
  });

  const results = await Promise.allSettled(lookups);
  return items.map((item, index) => ({
    ...item,
    image: results[index].status === "fulfilled" ? results[index].value : item.image,
  }));
}
