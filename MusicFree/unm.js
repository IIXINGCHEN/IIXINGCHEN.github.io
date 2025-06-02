"use strict";

const axios = require("axios");

const UNM_PLUGIN_VERSION = "2.0.3"; // Version bump for search fix
const pageSize = 30; 
// API Host - does NOT include /api.php
const METING_API_HOST = "https://meting-api.imixc.top"; 

const DEFAULT_METING_SERVER = "netease";
const VALID_METING_SERVERS = ["netease", "tencent", "kugou", "kuwo", "baidu", "pyncmd"];

// --- Validation Helper Functions ---
function isValidUrl(urlString) { /* ... (same as unm.js v2.0.2) ... */ 
    if (typeof urlString !== 'string') return false;
    try {
        const url = new URL(urlString);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
}
function sanitizeString(str, defaultVal = "") { /* ... (same as unm.js v2.0.2) ... */ 
    if (typeof str === 'string') {
        return str.replace(/\0/g, '').trim();
    }
    return defaultVal;
}

// --- API Call Helper for Meting-style Endpoints ---
async function callMetingApi(endpointPathWithApiPrefix, params = {}) {
    // endpointPathWithApiPrefix example: "/api.php/search", "/api.php/song/12345"
    try {
        const url = `${METING_API_HOST}${endpointPathWithApiPrefix}`; // Construct full URL
        
        const response = await axios.get(url, { params, timeout: 10000 });
        if (response.status === 200 && response.data) {
            if (response.data.url && typeof response.data.url === 'string') {
                 response.data.url = response.data.url.replace(/\\\//g, '/');
            }
            if (response.data.cover && typeof response.data.cover === 'string') { 
                 response.data.cover = response.data.cover.replace(/\\\//g, '/');
            }
            if (response.data.pic && typeof response.data.pic === 'string' && isValidUrl(response.data.pic)) {
                response.data.pic = response.data.pic.replace(/\\\//g, '/');
            }
            return response.data;
        }
        // console.warn(`Meting API Call to ${url} returned status ${response.status}`);
        return null;
    } catch (error) {
        // console.error(`Meting API Call Exception to ${METING_API_HOST}${endpointPathWithApiPrefix}:`, error.message, "Params:", params);
        return null;
    }
}

// --- User Config Handling ---
let currentEnvConfig = { /* ... (same as unm.js v2.0.2) ... */ 
    PROXY_URL: null,
    METING_SERVER: DEFAULT_METING_SERVER,
};
function getUserConfig() { /* ... (same as unm.js v2.0.2) ... */ 
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

function applyProxy(url, proxyUrl) { /* ... (same as unm.js v2.0.2) ... */ 
    if (proxyUrl && isValidUrl(proxyUrl) && url && isValidUrl(url) && 
        (url.includes("kuwo.cn") || url.includes("migu.cn") || url.includes("music.163.com") || url.includes("isure.stream.qqmusic.qq.com") || url.includes("qq.com"))) {
        const httpRemovedUrl = url.replace(/^http[s]?:\/\//, "");
        return proxyUrl.replace(/\/$/, "") + "/" + httpRemovedUrl;
    }
    return url;
}

// --- Internal Formatting ---
function internalFormatMusicItem(apiTrackData, server) { /* ... (same as unm.js v2.0.2) ... */ 
    if (!apiTrackData || typeof apiTrackData !== 'object' || !apiTrackData.id) {
        return null; 
    }
    const id = String(apiTrackData.id);
    const title = sanitizeString(apiTrackData.name || apiTrackData.title, "Unknown Title");
    let artists = "Unknown Artist";
    if (Array.isArray(apiTrackData.artist)) {
        artists = apiTrackData.artist.map(a => sanitizeString(a)).filter(Boolean).join('&') || "Unknown Artist";
    } else if (apiTrackData.artist) {
        artists = sanitizeString(String(apiTrackData.artist));
    }
    const album = sanitizeString(apiTrackData.album, "Unknown Album");
    let artwork = "";
    if (isValidUrl(apiTrackData.pic)) artwork = apiTrackData.pic;
    else if (isValidUrl(apiTrackData.cover)) artwork = apiTrackData.cover;
    const duration = parseInt(apiTrackData.duration || 0, 10) || 0; 
    const pic_id_from_api = apiTrackData.pic_id || (artwork ? null : apiTrackData.pic);
    const lyric_id_from_api = apiTrackData.lyric_id || id;
    return {
        id: id, title: title, artist: artists, album: album, artwork: artwork, duration: duration,
        _pic_id: pic_id_from_api ? String(pic_id_from_api) : null,
        _lyric_id: String(lyric_id_from_api),
        _source: server || apiTrackData.source,
        qualities: {}, content: 0, rawLrc: "",
    };
}

function internalFormatSheetItem(apiSheetData, server) { /* ... (same as unm.js v2.0.2) ... */ 
    if (!apiSheetData || typeof apiSheetData !== 'object' || !apiSheetData.id) {
        return { id: "unknown", title: "Unknown Playlist", artwork: "", worksNum: 0, description: "", artist: "" };
    }
    return {
        id: String(apiSheetData.id),
        title: sanitizeString(apiSheetData.name, "Playlist"),
        artist: sanitizeString(apiSheetData.creator ? apiSheetData.creator.nickname : apiSheetData.artist_name, ""), 
        artwork: isValidUrl(apiSheetData.cover) ? apiSheetData.cover : (apiSheetData.cover_img_url || ""),
        description: sanitizeString(apiSheetData.description, ""),
        worksNum: parseInt(apiSheetData.track_count || (apiSheetData.songs ? apiSheetData.songs.length : 0), 10) || 0,
        playCount: parseInt(apiSheetData.play_count, 10) || 0,
        _source: server,
    };
}

// --- Exported Core Functions ---

async function search(query, page = 1, type = "music") {
    if (typeof query !== 'string' || !query.trim()) return Promise.resolve({ isEnd: true, data: [], error: "Invalid search query." });
    if (typeof page !== 'number' || page < 1) page = 1;
    if (type !== "music") return Promise.resolve({ isEnd: true, data: [], error: `Search type "${type}" not supported.` });

    const userCfg = getUserConfig();
    const server = userCfg.METING_SERVER;
    
    // Corrected endpoint path for callMetingApi
    const apiResponse = await callMetingApi("/api.php/search", { 
        q: query, 
        server: server,
        limit: pageSize 
        // Note: 'page' parameter might not be supported by this Meting endpoint or specific server.
    });

    // --- IMPORTANT: Adapt to actual API response structure for search results ---
    // Common Meting structures:
    // 1. Direct array: `[songObj1, songObj2]`
    // 2. Object with a key: `{ "result": [songObj1], "code": 200 }` or `{ "data": [...] }` or `{ "songs": [...] }`
    
    let songsArray = null;
    if (apiResponse) {
        if (Array.isArray(apiResponse)) {
            songsArray = apiResponse;
        } else if (apiResponse.result && Array.isArray(apiResponse.result)) {
            songsArray = apiResponse.result;
        } else if (apiResponse.data && Array.isArray(apiResponse.data)) {
            songsArray = apiResponse.data;
        } else if (apiResponse.songs && Array.isArray(apiResponse.songs)) {
            songsArray = apiResponse.songs;
        }
        // Add more checks if other wrapper keys are possible
    }
    // console.log("DEBUG: unm.js search - API Response:", JSON.stringify(apiResponse, null, 2)); // Temporary for debugging
    // console.log("DEBUG: unm.js search - Extracted songsArray:", JSON.stringify(songsArray, null, 2)); // Temporary for debugging


    if (songsArray && Array.isArray(songsArray)) { 
        const formattedResults = songsArray.map(track => internalFormatMusicItem(track, server)).filter(item => item !== null);
        return Promise.resolve({
            isEnd: formattedResults.length < pageSize, 
            data: formattedResults,
        });
    }
    return Promise.resolve({ isEnd: true, data: [], error: "Search API request failed or returned no parsable song list." });
}

async function getMusicInfo(musicItem) { /* ... (Ensure callMetingApi uses "/api.php/song/...") ... */ 
    if (!musicItem || typeof musicItem !== 'object' || !musicItem.id || typeof musicItem.id !== 'string') {
        return Promise.resolve(internalFormatMusicItem({ id: "unknown", name: "Error: Invalid musicItem input" }, null));
    }
    const userCfg = getUserConfig();
    const server = musicItem._source || userCfg.METING_SERVER;
    const track_id = musicItem.id;
    const songDataArray = await callMetingApi(`/api.php/song/${track_id}`, { server: server }); // Corrected path
    const songData = (Array.isArray(songDataArray) && songDataArray.length > 0) ? songDataArray[0] : songDataArray;
    if (songData && songData.id) {
        let formatted = internalFormatMusicItem(songData, server);
        if (!formatted.artwork && formatted._pic_id) {
            const picData = await callMetingApi(`/api.php/picture/${formatted._pic_id}`, {server: server}); // Corrected path
            if (picData && isValidUrl(picData.url)) {
               formatted.artwork = picData.url;
            }
        }
        return Promise.resolve(formatted);
    }
    return Promise.resolve(internalFormatMusicItem({ ...musicItem, name: musicItem.title || `Track ${track_id} (Info call failed)` }, server));
}

async function getMediaSource(musicItem, quality) { /* ... (Ensure callMetingApi uses "/api.php/url/...") ... */ 
    if (!musicItem || typeof musicItem !== 'object' || !musicItem.id || typeof musicItem.id !== 'string') {
        return Promise.resolve({ error: "Invalid musicItem input." });
    }
    if (typeof quality !== 'string') quality = "standard";
    const userCfg = getUserConfig();
    const server = musicItem._source || userCfg.METING_SERVER;
    const track_id = musicItem.id;
    let bitrateApiValue; 
    switch (quality.toLowerCase()) {
        case "low": bitrateApiValue = 128000; break;
        case "standard": bitrateApiValue = 320000; break;
        case "high": bitrateApiValue = 999000; break; 
        case "super": bitrateApiValue = 999000; break;
        default: bitrateApiValue = 320000;
    }
    const urlData = await callMetingApi(`/api.php/url/${track_id}`, { server: server, bitrate: bitrateApiValue }); // Corrected path
    if (urlData && isValidUrl(urlData.url)) {
        const PROXY_URL = userCfg.PROXY_URL; 
        return Promise.resolve({
            url: applyProxy(urlData.url, PROXY_URL),
            size: parseInt(urlData.size, 10) || 0, 
            quality: quality, 
        });
    }
    return Promise.resolve({ error: "Failed to get media source or invalid URL returned." });
}

async function getLyric(musicItem) { /* ... (Ensure callMetingApi uses "/api.php/lyric/...") ... */ 
    if (!musicItem || typeof musicItem !== 'object' || (!musicItem.id && !musicItem._lyric_id)) {
        return Promise.resolve({ rawLrc: "", tlyric: "", error: "Invalid musicItem input." });
    }
    const userCfg = getUserConfig();
    const server = musicItem._source || userCfg.METING_SERVER;
    const lyric_id_to_use = musicItem._lyric_id || musicItem.id;
    if (!lyric_id_to_use) return Promise.resolve({ rawLrc: "", tlyric: "", error: "Lyric ID missing." });
    const lyricData = await callMetingApi(`/api.php/lyric/${lyric_id_to_use}`, { server: server }); // Corrected path
    if (lyricData && (typeof lyricData.lyric === 'string' || typeof lyricData.tlyric === 'string')) {
        return Promise.resolve({
            rawLrc: sanitizeString(lyricData.lyric),
            translateLrc: sanitizeString(lyricData.tlyric),
        });
    }
    return Promise.resolve({ rawLrc: "", tlyric: "", error: "Lyric not found or API error." });
}

async function getMusicSheetInfo(sheetQuery, page = 1) { /* ... (Ensure callMetingApi uses "/api.php/playlist/...") ... */ 
    const sheet_id = typeof sheetQuery === 'object' ? sheetQuery.id : sheetQuery;
    if (!sheet_id || typeof sheet_id !== 'string') {
        return Promise.resolve({ isEnd: true, sheetItem: internalFormatSheetItem({id: "unknown"}), musicList: [], error: "Invalid sheet ID." });
    }
    const userCfg = getUserConfig();
    const server = userCfg.METING_SERVER;
    const playlistApiResponse = await callMetingApi(`/api.php/playlist/${sheet_id}`, { server: server }); // Corrected path
    if (playlistApiResponse && playlistApiResponse.id) {
        const sheetItem = internalFormatSheetItem(playlistApiResponse, server);
        let musicList = [];
        // Adapt to actual structure of songs within playlist response
        const tracksArray = playlistApiResponse.songs || playlistApiResponse.tracks || (Array.isArray(playlistApiResponse.list) ? playlistApiResponse.list : null);
        if (Array.isArray(tracksArray)) {
            musicList = tracksArray.map(track => internalFormatMusicItem(track, server)).filter(item => item !== null);
        }
        return Promise.resolve({
            isEnd: true, 
            sheetItem: sheetItem,
            musicList: musicList,
        });
    }
    return Promise.resolve({ isEnd: true, sheetItem: internalFormatSheetItem({id: sheet_id, name: "Playlist not found"}), musicList: [], error: "Failed to fetch playlist details." });
}

async function importMusicSheet(urlLike) { /* ... (same as unm.js v2.0.2) ... */ 
    if (typeof urlLike !== 'string' || !urlLike.trim()) {
        return Promise.resolve([]); 
    }
    let sheetId = null;
    const neteasePlaylistMatch = urlLike.match(/(?:playlist\?id=|playlist\/|song\/list\?id=|list\?id=)(\d+)/i);
    if (neteasePlaylistMatch && neteasePlaylistMatch[1]) {
        sheetId = neteasePlaylistMatch[1];
    }
    if (!sheetId) {
        return Promise.resolve([]); 
    }
    const result = await getMusicSheetInfo({ id: sheetId });
    return Promise.resolve(result.musicList || []);
}

// Stubbed functions
async function getTopLists() { return Promise.resolve([]); }
async function getTopListDetail(topListItem) { /* ... (same as unm.js v2.0.2) ... */ 
    if(topListItem && topListItem.id) {
        const result = await getMusicSheetInfo(topListItem);
        return Promise.resolve({ ...result, topListItem: result.sheetItem });
    }
    return Promise.resolve({isEnd: true, sheetItem: {}, musicList: []});
}
async function getRecommendSheetTags() { return Promise.resolve({ pinned: [], data: [] }); }
async function getRecommendSheetsByTag(tag, page) { return Promise.resolve({ isEnd: true, data: [] });}

// --- Module Exports ---
module.exports = { /* ... (same as unm.js v2.0.2, but ensure version and srcUrl are updated) ... */ 
    platform: "unm (Meting API)",
    version: UNM_PLUGIN_VERSION,
    srcUrl: "https://raw.githubusercontent.com/your-repo/unm.js", // PLEASE UPDATE THIS URL
    cacheControl: "no-store", 
    userVariables: [
        { 
            key: "METING_SERVER", 
            name: "Meting API 音源", 
            hint: `选择数据源 (可选: ${VALID_METING_SERVERS.join(', ')}). 默认: ${DEFAULT_METING_SERVER}` 
        },
        { 
            key: "PROXY_URL", 
            name: "反代URL (可选)", 
            hint: "例如: https://yourproxy.com (代理部分音源链接)" 
        }
    ],
    hints: { 
        general: `unm源 (基于 Meting API: ${METING_API_HOST}/api.php/ , 默认音源: ${DEFAULT_METING_SERVER}).`
    },
    supportedSearchType: ["music"],
    search, getMusicInfo, getMediaSource, getLyric,
    importMusicSheet, getMusicSheetInfo, 
    getTopLists, getTopListDetail, getRecommendSheetTags, getRecommendSheetsByTag,
};
