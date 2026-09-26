import { fillMissingImages } from "./covers.js";

const LASTFM_BASE_URL = "https://ws.audioscrobbler.com/2.0/";
const REQUEST_TIMEOUT_MS = 8_000;
export const RESULT_LIMIT = 7;

// Imagem genérica (estrela cinza) que a Last.fm devolve para todo artista desde 2019.
const PLACEHOLDER_IMAGE_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

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

const UNAVAILABLE = "A integração com a Last.fm está indisponível no momento. Tente mais tarde.";
const UNSTABLE = "A Last.fm está instável agora. Tente novamente em instantes.";

// https://www.last.fm/api/errorcodes
const lastFmErrors = {
  4: [UNAVAILABLE, 503],
  6: ["Não encontramos esse usuário na Last.fm. Confira o nome e tente de novo.", 404],
  8: [UNSTABLE, 502],
  10: [UNAVAILABLE, 503],
  11: [UNSTABLE, 503],
  16: [UNSTABLE, 503],
  17: ["Esse perfil está privado na Last.fm.", 403],
  26: [UNAVAILABLE, 503],
  29: ["A Last.fm está limitando consultas agora. Tente de novo em alguns minutos.", 503],
};
const CONFIG_ERRORS = new Set([4, 10, 26]);

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
  // A Last.fm lista as imagens da menor para a maior; usamos a maior disponível.
  const source = asArray(item.image).findLast((image) => image?.["#text"]);
  const url = source?.["#text"] || "";
  if (url.includes(PLACEHOLDER_IMAGE_HASH)) return "";

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

export function normalizeItems(data, type) {
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

function errorFromCode(code) {
  if (CONFIG_ERRORS.has(code)) console.error(`Last.fm recusou a chave da API (erro ${code}).`);
  const [message, status] = lastFmErrors[code] || ["A Last.fm recusou a consulta. Tente novamente em instantes.", 502];
  return new LastFmError(message, status);
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
    limit: String(RESULT_LIMIT),
    format: "json",
  }).toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    // A Last.fm costuma responder erros com status HTTP 4xx e o código no corpo JSON.
    const data = await response.json().catch(() => null);
    if (data?.error) throw errorFromCode(Number(data.error));
    if (!response.ok || !data) {
      throw new LastFmError("A Last.fm não respondeu como esperado. Tente novamente em instantes.");
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

export async function getResults(user, period, type) {
  const data = await fetchLastFmData(user, periodMap[period], methodMap[type]);
  return fillMissingImages(normalizeItems(data, type), type);
}
