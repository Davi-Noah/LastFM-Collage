const API_KEY = "da5f5f73fc0a93bcbdb45a9b315c2746";
const USER = "davinoah_";
const LIMIT = 5;
const PERIOD = "1month";


async function getTopTracks() {
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=${USER}&api_key=${API_KEY}&period=${PERIOD}&limit=${LIMIT}&format=json`
    const response = await fetch(url);
    const data = await response.json();
    return data.toptracks.track;
}

function renderToptracks(tracks) {
    tracks.forEach((artist) => {
        console.log(artist.name);
        console.log(artist.playcount);
        console.log(artist);
    });
}


getTopTracks().then(renderToptracks);