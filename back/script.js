import { get } from "node:http";

const API_KEY = "da5f5f73fc0a93bcbdb45a9b315c2746";

async function fetchLastFmData(user, period, method) {
  const limit = 5;
  const url = `https://ws.audioscrobbler.com/2.0/?method=${method}&user=${user}&api_key=${API_KEY}&period=${period}&limit=${limit}&format=json`;

  const response = await fetch(url);
  const data = await response.json();

  return data;
}

function renderData(data, tipoFront) {
  let mscs = [];

  if (tipoFront === "musicas" && data.toptracks) {
    data.toptracks.track.forEach((item) => {
      mscs.push({
        name: item.name,
        artist: item.artist.name,
        playcount: item.playcount,
        duration: item.duration, // <-- PUXANDO A DURAÇÃO AQUI!
      });
    });
  }
  // Para Álbuns e Artistas a API não devolve tempo, então deixamos 0
  else if (tipoFront === "artistas" && data.topartists) {
    data.topartists.artist.forEach((item) => {
      mscs.push({
        name: item.name,
        artist: "",
        playcount: item.playcount,
        duration: "0",
      });
    });
  } else if (tipoFront === "albuns" && data.topalbums) {
    data.topalbums.album.forEach((item) => {
      mscs.push({
        name: item.name,
        artist: item.artist.name,
        playcount: item.playcount,
        duration: "0",
      });
    });
  }

  return mscs;
}

export async function getResults(user, periodoFront, tipoFront) {
  const periodMap = {
    "1_mes": "1month",
    "6_meses": "6month",
    todo_tempo: "overall",
  };
  const period = periodMap[periodoFront] || "6month";

  const methodMap = {
    musicas: "user.gettoptracks",
    artistas: "user.gettopartists",
    albuns: "user.gettopalbums",
  };
  const method = methodMap[tipoFront] || "user.gettoptracks";

  let rawData = await fetchLastFmData(user, period, method);

  return renderData(rawData, tipoFront);
}
