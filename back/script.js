import { get } from "node:http";

const API_KEY = "da5f5f73fc0a93bcbdb45a9b315c2746";

const USER = "davinoah_";
const LIMIT = 5;
const PERIOD = "1month";


async function getTopTracks(user=USER, period=PERIOD, limit=LIMIT) {
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=${user}&api_key=${API_KEY}&period=${period}&limit=${limit}&format=json`
    const response = await fetch(url);
    const data = await response.json();
    console.log(data);
    
    return data.toptracks.track;
}

function renderTopTracks(tracks) {
    let mscs = [];

    tracks.forEach((artist) => {
        {
            const msc = {
                name: artist.name,
                playcount: artist.playcount,
                duration: artist.duration
            };
            mscs.push(msc);
        }
    });

    return mscs;
}

export async function getResults(user) {
    let tracks = await getTopTracks(user);
    return renderTopTracks(tracks);
}


