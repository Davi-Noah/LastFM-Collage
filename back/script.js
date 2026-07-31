const LASTFM_BASE_URL = "https://ws.audioscrobbler.com/2.0/";
const REQUEST_TIMEOUT_MS = 8_000;

export const PERIODS = new Set(["1_mes", "6_meses", "todo_tempo"]);
export const TYPES = new Set(["musicas", "artistas", "albuns"]);

const periodMap = {
  "1_mes": "1month",
  "6_meses": "6month",
  todo_tempo: "overall",
};

const methodMap = {
  musicas: "user.gettoptracks",
  artistas: "user.gettopartists",
  albuns: "user.gettopalbums",
};

export class LastFmError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function imageUrl(item) {
  const source = asArray(item.image).find((image) => image?.["#text"]);
  const url = source?.["#text"] || "";

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function renderData(data, type) {
  if (type === "musicas") {
    return asArray(data.toptracks?.track).map((item) => ({
      name: String(item.name || "Faixa sem nome"),
      artist: String(item.artist?.name || "Artista desconhecido"),
      playcount: Number.parseInt(item.playcount, 10) || 0,
      duration: Number.parseInt(item.duration, 10) || 0,
      image: imageUrl(item),
    }));
  }

  if (type === "artistas") {
    return asArray(data.topartists?.artist).map((item) => ({
      name: String(item.name || "Artista sem nome"),
      artist: "",
      playcount: Number.parseInt(item.playcount, 10) || 0,
      duration: 0,
      image: imageUrl(item),
    }));
  }

  return asArray(data.topalbums?.album).map((item) => ({
    name: String(item.name || "Álbum sem nome"),
    artist: String(item.artist?.name || "Artista desconhecido"),
    playcount: Number.parseInt(item.playcount, 10) || 0,
    duration: 0,
    image: imageUrl(item),
  }));
}

async function fetchLastFmData(user, period, method) {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    throw new LastFmError("A integração com a Last.fm ainda não foi configurada.", 503);
  }

  const url = new URL(LASTFM_BASE_URL);
  url.search = new URLSearchParams({
    method,
    user,
    api_key: apiKey,
    period,
    limit: "7",
    format: "json",
  }).toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new LastFmError("A Last.fm não respondeu como esperado. Tente novamente em instantes.");
    }

    const data = await response.json();
    if (data.error) {
      const status = data.error === 6 ? 404 : 422;
      throw new LastFmError(data.message || "Não foi possível encontrar esse perfil.", status);
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new LastFmError("A Last.fm demorou para responder. Tente novamente.", 504);
    }
    if (error instanceof LastFmError) throw error;
    throw new LastFmError("Não foi possível conectar à Last.fm. Tente novamente em instantes.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function getResults(user, periodFront, typeFront) {
  const data = await fetchLastFmData(user, periodMap[periodFront], methodMap[typeFront]);
  return renderData(data, typeFront);
}
