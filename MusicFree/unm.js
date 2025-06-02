"use strict";

const axios = require("axios");

const UNM_PLUGIN_VERSION = "2.1.4"; // Version bump for playlist detailed debugging
const pageSize = 30; 
const METING_API_HOST = "https://meting-api.imixc.top"; 

const DEFAULT_METING_SERVER = "netease";
const VALID_METING_SERVERS = ["netease", "tencent", "kugou", "kuwo", "baidu", "pyncmd"];

// --- Validation Helper Functions ---
function isValidUrl(urlString) { /* ... (same as unm.js v2.1.3) ... */ 
    if (typeof urlString !== 'string') return false;
    try {
        const url = new URL(urlString);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
}
function sanitizeString(str, defaultVal = "") { /* ... (same as unm.js v2.1.3) ... */ 
    if (typeof str === 'string') {
        return str.replace(/\0/g, '').trim();
    }
    return defaultVal;
}

// --- API Call Helper ---
async function callMetingApi(endpointPathWithApiPrefix, params = {}) { /* ... (same as unm.js v2.1.3) ... */ 
    try {
        const url = `${METING_API_HOST}${endpointPathWithApiPrefix}`;
        const response = await axios.get(url, { params, timeout: 10000 });
        if (response.status === 200 && response.data) {
            // Recursively unescape slashes in URLs within the response data
            const unescapeSlashes = (data) => {
                if (typeof data === 'string' && (data.startsWith('http:') || data.startsWith('https:'))) {
                    return data.replace(/\\\//g, '/');
                } else if (Array.isArray(data)) {
                    return data.map(unescapeSlashes);
                } else if (typeof data === 'object' && data !== null) {
                    const newData = {};
                    for (const key in data) {
                        newData[key] = unescapeSlashes(data[key]);
                    }
                    return newData;
                }
                return data;
            };
            return unescapeSlashes(response.data);
        }
        return null;
    } catch (error) {
        return null;
    }
}

// --- User Config Handling ---
let currentEnvConfig = { /* ... (same as unm.js v2.1.3) ... */ 
    PROXY_URL: null,
    METING_SERVER: DEFAULT_METING_SERVER,
};
function getUserConfig() { /* ... (same as unm.js v2.1.3) ... */ 
    let config = { ...currentEnvConfig }; 
    if (typeof global !== 'undefined' && global.lx && global.lx.env && typeof global.lx.env.getUserVariables === 'function') {
        const userVars = global.lx.env.getUserVariables();
        if (userVars && typeof userVars === 'object') {
            if (userVars.PROXY_URL && isValidUrl(userVars.PROXY_URL)) {
                config.PROXY_URL = userVars.PROXY_URL;
            }
            if (userVars.METING_SERVER && VALID_METING_SERVERS.includes(String(userVars.METING_SERVER).toLowerCase())) {
                config.METING_SERVER = String(userVars.METING_SERVER).toLowerCase();
            }
        }
    }
    return config;
}

function applyProxy(url, proxyUrl) { /* ... (same as unm.js v2.1.3) ... */ 
    if (proxyUrl && isValidUrl(proxyUrl) && url && isValidUrl(url) && 
        (url.includes("kuwo.cn") || url.includes("migu.cn") || url.includes("music.163.com") || url.includes("isure.stream.qqmusic.qq.com") || url.includes("qq.com"))) {
        const httpRemovedUrl = url.replace(/^http[s]?:\/\//, "");
        return proxyUrl.replace(/\/$/, "") + "/" + httpRemovedUrl;
    }
    return url;
}

// --- Internal Formatting ---
function internalFormatMusicItem(apiTrackData, server) { /* ... (same as unm.js v2.1.3) ... */ 
    if (!apiTrackData || typeof apiTrackData !== 'object' || !apiTrackData.id) {
        return null; 
    }
    const id = String(apiTrackData.id);
    const title = sanitizeString(apiTrackData.name || apiTrackData.title, "Unknown Title");
    let artists = "Unknown Artist";
    if (Array.isArray(apiTrackData.artist)) {
        artists = apiTrackData.artist
            .map(a => (a && typeof a.name === 'string' ? sanitizeString(a.name) : (typeof a === 'string' ? sanitizeString(a) : null)))
            .filter(Boolean).join('&') || "Unknown Artist";
    } else if (apiTrackData.artist && typeof apiTrackData.artist.name === 'string') {
        artists = sanitizeString(apiTrackData.artist.name);
    } else if (typeof apiTrackData.artist === 'string') {
         artists = sanitizeString(apiTrackData.artist);
    }
    const album = sanitizeString(apiTrackData.album, "Unknown Album");
    let artwork = "";
    if (isValidUrl(apiTrackData.pic)) artwork = apiTrackData.pic;
    else if (isValidUrl(apiTrackData.cover)) artwork = apiTrackData.cover;
    const duration = parseInt(apiTrackData.duration || 0, 10) || 0; 
    const pic_id_from_api = apiTrackData.pic_id || (artwork ? null : (typeof apiTrackData.pic === 'string' && !isValidUrl(apiTrackData.pic) ? apiTrackData.pic : null));
    const lyric_id_from_api = apiTrackData.lyric_id || id;
    return {
        id: id, title: title, artist: artists, album: album, artwork: artwork, duration: duration,
        _pic_id: pic_id_from_api ? String(pic_id_from_api) : null,
        _lyric_id: String(lyric_id_from_api),
        _source: server || sanitizeString(apiTrackData.source),
        qualities: {}, content: 0, rawLrc: "",
    };
}

function internalFormatSheetItem(playlistId, playlistApiResponse, server) { /* ... (same as unm.js v2.1.3, with refined defaults) ... */ 
    let sheetName = `Playlist ${playlistId}`; 
    let coverImgUrl = ""; let creatorName = ""; let description = "";
    let trackCount = 0; let playCount = 0;

    // Based on provided /playlist/{id} JSON example:
    // It contains `data.playlist_id` and `data.playlist_info` (songs).
    // It LACKS sheet metadata like name, cover, creator directly in `data`.
    // We use the passed `playlistId` and count songs from `data.playlist_info`.
    // `playlistApiResponse.meta.song_count` can also provide total song count.

    if (playlistApiResponse && playlistApiResponse.data && playlistApiResponse.data.playlist_id) {
        // If the API *did* provide sheet name in the future, we'd use it:
        // sheetName = sanitizeString(playlistApiResponse.data.name, `Playlist ${playlistId}`);
        // coverImgUrl = isValidUrl(playlistApiResponse.data.cover) ? playlistApiResponse.data.cover : "";
        // creatorName = sanitizeString(playlistApiResponse.data.creator_name, "");
        // description = sanitizeString(playlistApiResponse.data.description, "");
        // playCount = parseInt(playlistApiResponse.data.play_count, 10) || 0;
        if (Array.isArray(playlistApiResponse.data.playlist_info)) {
            trackCount = playlistApiResponse.data.playlist_info.length;
        }
    }
    // Fallback or primary source for song_count from meta if available
    if (playlistApiResponse && playlistApiResponse.meta && typeof playlistApiResponse.meta.song_count === 'number' && trackCount === 0) {
        trackCount = playlistApiResponse.meta.song_count;
    }
    
    return {
        id: String(playlistId), title: sheetName, artist: creatorName, artwork: coverImgUrl,
        description: description, worksNum: trackCount, playCount: playCount, _source: server,
    };
}

function internalFormatAlbumItem(apiAlbumData, server) { /* ... (same as unm.js v2.1.3) ... */ }
function internalFormatArtistItem(apiArtistData, server) { /* ... (same as unm.js v2.1.3) ... */ }

// --- Exported Core Functions ---
async function search(query, page = 1, type = "music") { /* ... (same as unm.js v2.1.3, ensure console.logs are removed for production) ... */ 
    if (typeof query !== 'string' || !query.trim()) return Promise.resolve({ isEnd: true, data: [], error: "Invalid search query." });
    if (typeof page !== 'number' || page < 1) page = 1;
    if (type !== "music") return Promise.resolve({ isEnd: true, data: [], error: `Search type "${type}" not supported.` });
    const userCfg = getUserConfig();
    const server = userCfg.METING_SERVER;
    const apiResponse = await callMetingApi("/api.php/search", { q: query, server: server, limit: pageSize });
    let songsArray = null;
    if (apiResponse && apiResponse.data && Array.isArray(apiResponse.data.results)) {
        songsArray = apiResponse.data.results;
    } else if (apiResponse && Array.isArray(apiResponse)) {
        songsArray = apiResponse;
    }
    if (songsArray && Array.isArray(songsArray)) { 
        const formattedResults = songsArray.map(track => internalFormatMusicItem(track, track.source || server)).filter(item => item !== null);
        const totalResults = (apiResponse.meta && typeof apiResponse.meta.total_results === 'number') ? apiResponse.meta.total_results : (apiResponse.data && typeof apiResponse.data.total === 'number' ? apiResponse.data.total : null);
        let isEnd = formattedResults.length < pageSize; 
        if (totalResults !== null) { isEnd = (page * pageSize) >= totalResults; }
        return Promise.resolve({ isEnd: isEnd, data: formattedResults });
    }
    return Promise.resolve({ isEnd: true, data: [], error: "Search API request failed or returned no parsable song list." });
}

async function getMusicInfo(musicItem) { /* ... (same as unm.js v2.1.3) ... */ }
async function getMediaSource(musicItem, quality) { /* ... (same as unm.js v2.1.3) ... */ }
async function getLyric(musicItem) { /* ... (same as unm.js v2.1.3) ... */ }

// --- Playlist/Sheet Functions ---
async function getMusicSheetInfo(sheetQuery, page = 1) {
    const sheet_id = typeof sheetQuery === 'object' ? sheetQuery.id : String(sheetQuery); // Ensure sheet_id is string

    // 1. Log input
    if (typeof console !== 'undefined') console.log(`DEBUG: unm.js getMusicSheetInfo - INPUT - sheet_id: ${sheet_id}, type: ${typeof sheet_id}`);

    if (!sheet_id || typeof sheet_id !== 'string' || !sheet_id.trim()) {
        if (typeof console !== 'undefined') console.error("DEBUG: unm.js getMusicSheetInfo - ERROR - Invalid sheet_id input");
        return Promise.resolve({ isEnd: true, sheetItem: internalFormatSheetItem(sheet_id, null, null), musicList: [], error: "Invalid sheet ID." });
    }

    const userCfg = getUserConfig();
    const server = userCfg.METING_SERVER; 

    const playlistApiResponse = await callMetingApi(`/api.php/playlist/${sheet_id}`, { server: server });

    // 2. Log raw API response
    if (typeof console !== 'undefined') console.log(`DEBUG: unm.js getMusicSheetInfo - Raw API Response for id '${sheet_id}':`, JSON.stringify(playlistApiResponse, null, 2));

    // Check based on the provided JSON: playlistApiResponse.data.playlist_id should match sheet_id
    // and songs are in playlistApiResponse.data.playlist_info
    if (playlistApiResponse && playlistApiResponse.data && playlistApiResponse.data.playlist_id === sheet_id) {
        const sheetItem = internalFormatSheetItem(sheet_id, playlistApiResponse, server); 
        
        // 3. Log formatted sheetItem
        if (typeof console !== 'undefined') console.log(`DEBUG: unm.js getMusicSheetInfo - Formatted sheetItem:`, JSON.stringify(sheetItem, null, 2));

        let musicList = [];
        const tracksArray = playlistApiResponse.data.playlist_info;
        
        // 4. Log extracted tracksArray
        if (typeof console !== 'undefined') console.log(`DEBUG: unm.js getMusicSheetInfo - Extracted tracksArray (length: ${Array.isArray(tracksArray) ? tracksArray.length : 'not an array'}):`, JSON.stringify(tracksArray, null, 2));

        if (Array.isArray(tracksArray)) {
            musicList = tracksArray.map((track, index) => {
                const formattedTrack = internalFormatMusicItem(track, track.source || server);
                // 5. Log each formatted track (optional, can be very verbose for long lists)
                // if (typeof console !== 'undefined' && index < 1 && formattedTrack) console.log(`DEBUG: getMusicSheetInfo - Formatted track ${index}:`, JSON.stringify(formattedTrack, null, 2));
                return formattedTrack;
            }).filter(item => item !== null);
        }
        
        // 6. Log final musicList (first few items)
        if (typeof console !== 'undefined') console.log(`DEBUG: unm.js getMusicSheetInfo - Final musicList (length: ${musicList.length}, first 3):`, JSON.stringify(musicList.slice(0,3), null, 2));

        return Promise.resolve({
            isEnd: true, 
            sheetItem: sheetItem,
            musicList: musicList,
        });
    }
    if (typeof console !== 'undefined') console.error(`DEBUG: unm.js getMusicSheetInfo - ERROR - Failed to process API response for id '${sheet_id}'. Response success: ${playlistApiResponse ? playlistApiResponse.success : 'null'}, Data object valid: ${playlistApiResponse && playlistApiResponse.data ? 'yes' : 'no'}`);
    return Promise.resolve({ isEnd: true, sheetItem: internalFormatSheetItem(sheet_id, null, server), musicList: [], error: "Failed to fetch playlist details or invalid API response." });
}

async function importMusicSheet(urlLike) { /* ... (same as unm.js v2.1.3) ... */ }
async function getAlbumInfo(albumItemQuery) { /* ... (same as unm.js v2.1.3) ... */ }
async function getArtistWorks(artistItemQuery, page = 1, type = "music") { /* ... (same as unm.js v2.1.3) ... */ }
async function getTopLists() { return Promise.resolve([]); }
async function getTopListDetail(topListItem) { /* ... (same as unm.js v2.1.3) ... */ }
async function getRecommendSheetTags() { return Promise.resolve({ pinned: [], data: [] }); }
async function getRecommendSheetsByTag(tag, page) { return Promise.resolve({ isEnd: true, data: [] });}

// --- Module Exports ---
module.exports = { /* ... (same as unm.js v2.1.3, ensure version is UNM_PLUGIN_VERSION) ... */ 
    platform: "unm (Meting API)",
    version: UNM_PLUGIN_VERSION, // Now 2.1.4
    srcUrl: "https://raw.githubusercontent.com/IIXINGCHEN/IIXINGCHEN.github.io/refs/heads/main/MusicFree/unm.js", 
    cacheControl: "no-store", 
    userVariables: [ /* ... */ ],
    hints: { /* ... */ },
    supportedSearchType: ["music", "album", "artist"],
    search, getMusicInfo, getMediaSource, getLyric,
    importMusicSheet, getMusicSheetInfo, 
    getAlbumInfo, getArtistWorks,
    getTopLists, getTopListDetail, getRecommendSheetTags, getRecommendSheetsByTag,
};

// For brevity, only showing getMusicSheetInfo and related changes.
// Assume other functions (search, getMusicInfo, getMediaSource, getLyric, importMusicSheet,
// getAlbumInfo, getArtistWorks, stubs, module.exports etc.) are copied from v2.1.3 if not explicitly changed here.
// It's crucial to use the full code from the previous complete block (v2.1.3) and apply these logging additions to getMusicSheetInfo.
