"use strict";

const axios = require("axios");

const UNM_PLUGIN_VERSION = "2.1.0"; // Version bump for added album/artist info
const pageSize = 30; 
const METING_API_HOST = "https://meting-api.imixc.top"; 

const DEFAULT_METING_SERVER = "netease";
const VALID_METING_SERVERS = ["netease", "tencent", "kugou", "kuwo", "baidu", "pyncmd"];

// --- Validation Helper Functions ---
function isValidUrl(urlString) { /* ... (same as before) ... */ 
    if (typeof urlString !== 'string') return false;
    try {
        const url = new URL(urlString);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
}
function sanitizeString(str, defaultVal = "") { /* ... (same as before) ... */ 
    if (typeof str === 'string') {
        return str.replace(/\0/g, '').trim();
    }
    return defaultVal;
}

// --- API Call Helper ---
async function callMetingApi(endpointPathWithApiPrefix, params = {}) { /* ... (same as before) ... */ 
    try {
        const url = `${METING_API_HOST}${endpointPathWithApiPrefix}`;
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
        return null;
    } catch (error) {
        return null;
    }
}

// --- User Config Handling ---
let currentEnvConfig = { /* ... (same as before) ... */ 
    PROXY_URL: null,
    METING_SERVER: DEFAULT_METING_SERVER,
};
function getUserConfig() { /* ... (same as before) ... */ 
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

function applyProxy(url, proxyUrl) { /* ... (same as before) ... */ 
    if (proxyUrl && isValidUrl(proxyUrl) && url && isValidUrl(url) && 
        (url.includes("kuwo.cn") || url.includes("migu.cn") || url.includes("music.163.com") || url.includes("isure.stream.qqmusic.qq.com") || url.includes("qq.com"))) {
        const httpRemovedUrl = url.replace(/^http[s]?:\/\//, "");
        return proxyUrl.replace(/\/$/, "") + "/" + httpRemovedUrl;
    }
    return url;
}

// --- Internal Formatting ---
function internalFormatMusicItem(apiTrackData, server) { /* ... (same as v2.0.5, ensure _source is set) ... */ 
    if (!apiTrackData || typeof apiTrackData !== 'object' || !apiTrackData.id) {
        return null; 
    }
    const id = String(apiTrackData.id);
    const title = sanitizeString(apiTrackData.name || apiTrackData.title, "Unknown Title");
    let artists = "Unknown Artist";
    if (Array.isArray(apiTrackData.artist)) {
        artists = apiTrackData.artist.map(a => (a && typeof a.name === 'string' ? sanitizeString(a.name) : (typeof a === 'string' ? sanitizeString(a) : null)))
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
    const pic_id_from_api = apiTrackData.pic_id || (artwork ? null : apiTrackData.pic);
    const lyric_id_from_api = apiTrackData.lyric_id || id;
    return {
        id: id, title: title, artist: artists, album: album, artwork: artwork, duration: duration,
        _pic_id: pic_id_from_api ? String(pic_id_from_api) : null,
        _lyric_id: String(lyric_id_from_api),
        _source: server || sanitizeString(apiTrackData.source),
        qualities: {}, content: 0, rawLrc: "",
    };
}

function internalFormatSheetItem(apiSheetData, server) { /* ... (same as v2.0.5, ensure _source is set) ... */ 
    if (!apiSheetData || typeof apiSheetData !== 'object' || !apiSheetData.id) {
        return { id: "unknown", title: "Unknown Playlist", artwork: "", worksNum: 0, description: "", artist: "" };
    }
    return {
        id: String(apiSheetData.id),
        title: sanitizeString(apiSheetData.name, "Playlist"),
        artist: sanitizeString(apiSheetData.creator ? (apiSheetData.creator.name || apiSheetData.creator.nickname) : apiSheetData.artist_name, ""), 
        artwork: isValidUrl(apiSheetData.cover || apiSheetData.coverImgUrl || apiSheetData.pic) ? (apiSheetData.cover || apiSheetData.coverImgUrl || apiSheetData.pic) : "",
        description: sanitizeString(apiSheetData.description, ""),
        worksNum: parseInt(apiSheetData.track_count || (apiSheetData.songs ? apiSheetData.songs.length : 0), 10) || 0,
        playCount: parseInt(apiSheetData.play_count || apiSheetData.playCount, 10) || 0,
        _source: server,
    };
}

function internalFormatAlbumItem(apiAlbumData, server) {
    // Assuming apiAlbumData is the response from /album/{id}
    // It should contain album details and a list of songs.
    if (!apiAlbumData || typeof apiAlbumData !== 'object' || !apiAlbumData.id) {
        return { id: "unknown", title: "Unknown Album", artist: "", artwork: "", description: "", date: "", worksNum: 0 };
    }
    let artistName = "Unknown Artist";
    if (Array.isArray(apiAlbumData.artist)) {
        artistName = apiAlbumData.artist.map(a => (a && typeof a.name === 'string' ? sanitizeString(a.name) : (typeof a === 'string' ? sanitizeString(a) : null)))
            .filter(Boolean).join('&') || "Unknown Artist";
    } else if (apiAlbumData.artist && typeof apiAlbumData.artist.name === 'string') {
        artistName = sanitizeString(apiAlbumData.artist.name);
    } else if (typeof apiAlbumData.artist === 'string') {
         artistName = sanitizeString(apiAlbumData.artist);
    }

    return {
        id: String(apiAlbumData.id),
        title: sanitizeString(apiAlbumData.name, "Album"),
        artist: artistName,
        artwork: isValidUrl(apiAlbumData.cover || apiAlbumData.pic) ? (apiAlbumData.cover || apiAlbumData.pic) : "",
        description: sanitizeString(apiAlbumData.description || apiAlbumData.desc, ""),
        date: sanitizeString(apiAlbumData.publish_date || apiAlbumData.publishTime, ""), // Format later if needed
        worksNum: parseInt(apiAlbumData.song_count || (apiAlbumData.songs ? apiAlbumData.songs.length : 0), 10) || 0,
        _source: server,
    };
}

function internalFormatArtistItem(apiArtistData, server) {
    // Assuming apiArtistData is the response from /artist/{id}
    // It should contain artist details. Song list might be separate or part of it.
    if (!apiArtistData || typeof apiArtistData !== 'object' || !apiArtistData.id) {
        return { id: "unknown", name: "Unknown Artist", avatar: "", description: "", worksNum: 0 };
    }
    return {
        id: String(apiArtistData.id),
        name: sanitizeString(apiArtistData.name, "Artist"),
        avatar: isValidUrl(apiArtistData.pic || apiArtistData.cover || apiArtistData.avatar) ? (apiArtistData.pic || apiArtistData.cover || apiArtistData.avatar) : "",
        description: sanitizeString(apiArtistData.description || apiArtistData.desc || apiArtistData.briefDesc, ""),
        worksNum: parseInt(apiArtistData.music_size || apiArtistData.song_count || 0, 10) || 0, // Number of songs
        // album_size: parseInt(apiArtistData.album_size || 0, 10) || 0, // Number of albums
        _source: server,
    };
}


// --- Exported Core Functions ---
// search, getMusicInfo, getMediaSource, getLyric, getMusicSheetInfo, importMusicSheet
// remain largely the same as v2.0.5, just ensuring they use the correct internalFormat functions
// and pass the 'server' or use musicItem._source correctly.

async function search(query, page = 1, type = "music") { /* ... (same as unm.js v2.0.5) ... */ 
    if (typeof query !== 'string' || !query.trim()) return Promise.resolve({ isEnd: true, data: [], error: "Invalid search query." });
    if (typeof page !== 'number' || page < 1) page = 1;
    if (type !== "music") return Promise.resolve({ isEnd: true, data: [], error: `Search type "${type}" not supported.` });
    const userCfg = getUserConfig();
    const server = userCfg.METING_SERVER;
    const apiResponse = await callMetingApi("/api.php/search", { q: query, server: server, limit: pageSize });
    let songsArray = null;
    if (apiResponse && apiResponse.data && Array.isArray(apiResponse.data.results)) { // Matching previous successful structure
        songsArray = apiResponse.data.results;
    } else if (apiResponse && Array.isArray(apiResponse)) { // Fallback if API directly returns array
        songsArray = apiResponse;
    }
    if (songsArray && Array.isArray(songsArray)) { 
        const formattedResults = songsArray.map(track => internalFormatMusicItem(track, track.source || server)).filter(item => item !== null);
        const totalResults = apiResponse.meta && typeof apiResponse.meta.total_results === 'number' ? apiResponse.meta.total_results : (apiResponse.data && typeof apiResponse.data.total === 'number' ? apiResponse.data.total : null);
        let isEnd = formattedResults.length < pageSize; 
        if (totalResults !== null) { isEnd = (page * pageSize) >= totalResults; }
        return Promise.resolve({ isEnd: isEnd, data: formattedResults });
    }
    return Promise.resolve({ isEnd: true, data: [], error: "Search API request failed or returned no parsable song list." });
}

async function getMusicInfo(musicItem) { /* ... (same as unm.js v2.0.5, uses internalFormatMusicItem) ... */ 
    if (!musicItem || typeof musicItem !== 'object' || !musicItem.id || typeof musicItem.id !== 'string') {
        return Promise.resolve(internalFormatMusicItem({ id: "unknown", name: "Error: Invalid musicItem input" }, null));
    }
    const userCfg = getUserConfig();
    const server = musicItem._source || userCfg.METING_SERVER;
    const track_id = musicItem.id;
    const songDataArray = await callMetingApi(`/api.php/song/${track_id}`, { server: server });
    const songData = (Array.isArray(songDataArray) && songDataArray.length > 0) ? songDataArray[0] : songDataArray;
    if (songData && songData.id) {
        let formatted = internalFormatMusicItem(songData, server);
        const picIdToFetch = formatted._pic_id || songData.pic_id || (isValidUrl(songData.pic) ? null : songData.pic) ;
        if (!formatted.artwork && picIdToFetch) {
            const picData = await callMetingApi(`/api.php/picture/${picIdToFetch}`, {server: server});
            if (picData && isValidUrl(picData.url)) {
               formatted.artwork = picData.url;
            }
        }
        return Promise.resolve(formatted);
    }
    return Promise.resolve(internalFormatMusicItem({ ...musicItem, name: musicItem.title || `Track ${track_id} (Info call failed)` }, server));
}

async function getMediaSource(musicItem, quality) { /* ... (same as unm.js v2.0.5) ... */ 
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
    const urlData = await callMetingApi(`/api.php/url/${track_id}`, { server: server, bitrate: bitrateApiValue });
    if (urlData && isValidUrl(urlData.url)) {
        const PROXY_URL = userCfg.PROXY_URL; 
        return Promise.resolve({
            url: applyProxy(urlData.url, PROXY_URL),
            size: urlData.size ? parseInt(urlData.size, 10) * 1024 : 0, 
            quality: quality, 
        });
    }
    return Promise.resolve({ error: "Failed to get media source or invalid URL returned." });
}

async function getLyric(musicItem) { /* ... (same as unm.js v2.0.5) ... */ 
    if (!musicItem || typeof musicItem !== 'object' || (!musicItem.id && !musicItem._lyric_id)) {
        return Promise.resolve({ rawLrc: "", tlyric: "", error: "Invalid musicItem input." });
    }
    const userCfg = getUserConfig();
    const server = musicItem._source || userCfg.METING_SERVER;
    const lyric_id_to_use = musicItem._lyric_id || musicItem.id;
    if (!lyric_id_to_use) return Promise.resolve({ rawLrc: "", tlyric: "", error: "Lyric ID missing." });
    const lyricData = await callMetingApi(`/api.php/lyric/${lyric_id_to_use}`, { server: server });
    if (lyricData && (typeof lyricData.lyric === 'string' || typeof lyricData.tlyric === 'string')) {
        return Promise.resolve({
            rawLrc: sanitizeString(lyricData.lyric),
            translateLrc: sanitizeString(lyricData.tlyric),
        });
    }
    return Promise.resolve({ rawLrc: "", tlyric: "", error: "Lyric not found or API error." });
}

async function getMusicSheetInfo(sheetQuery, page = 1) { /* ... (same as unm.js v2.0.5) ... */ 
    const sheet_id = typeof sheetQuery === 'object' ? sheetQuery.id : sheetQuery;
    if (!sheet_id || typeof sheet_id !== 'string') {
        return Promise.resolve({ isEnd: true, sheetItem: internalFormatSheetItem({id: "unknown"}, null), musicList: [], error: "Invalid sheet ID." });
    }
    const userCfg = getUserConfig();
    const server = userCfg.METING_SERVER; // For playlists, typically use the default server or one that supports playlist well
    const playlistApiResponse = await callMetingApi(`/api.php/playlist/${sheet_id}`, { server: server });
    if (playlistApiResponse && playlistApiResponse.id) {
        const sheetItem = internalFormatSheetItem(playlistApiResponse, server);
        let musicList = [];
        const tracksArray = playlistApiResponse.songs || playlistApiResponse.tracks || (Array.isArray(playlistApiResponse.list) ? playlistApiResponse.list : null);
        if (Array.isArray(tracksArray)) {
            musicList = tracksArray.map(track => internalFormatMusicItem(track, server)).filter(item => item !== null);
        }
        return Promise.resolve({ isEnd: true, sheetItem: sheetItem, musicList: musicList });
    }
    return Promise.resolve({ isEnd: true, sheetItem: internalFormatSheetItem({id: sheet_id, name: "Playlist not found"}, server), musicList: [], error: "Failed to fetch playlist details." });
}

async function importMusicSheet(urlLike) { /* ... (same as unm.js v2.0.5) ... */ 
    if (typeof urlLike !== 'string' || !urlLike.trim()) { return Promise.resolve([]); }
    let sheetId = null;
    const neteasePlaylistMatch = urlLike.match(/(?:playlist\?id=|playlist\/|song\/list\?id=|list\?id=)(\d+)/i);
    if (neteasePlaylistMatch && neteasePlaylistMatch[1]) { sheetId = neteasePlaylistMatch[1]; }
    if (!sheetId) { return Promise.resolve([]); }
    const result = await getMusicSheetInfo({ id: sheetId });
    return Promise.resolve(result.musicList || []);
}

// --- NEW: Album and Artist Info ---
async function getAlbumInfo(albumItemQuery) { // albumItemQuery could be {id: "album_id", _source: "server"}
    const album_id = typeof albumItemQuery === 'object' ? albumItemQuery.id : albumItemQuery;
    if (!album_id || typeof album_id !== 'string') {
        return Promise.resolve({ isEnd: true, albumItem: internalFormatAlbumItem({id: "unknown"}, null), musicList: [], error: "Invalid album ID." });
    }
    const userCfg = getUserConfig();
    const server = (typeof albumItemQuery === 'object' && albumItemQuery._source) || userCfg.METING_SERVER;
    
    // Meting API: /album/{id}?server={platform}
    // Assuming response contains album details and a 'songs' or 'tracks' array
    const albumApiResponse = await callMetingApi(`/api.php/album/${album_id}`, { server: server });

    if (albumApiResponse && albumApiResponse.id) {
        const albumDetails = internalFormatAlbumItem(albumApiResponse, server);
        let musicList = [];
        const tracksArray = albumApiResponse.songs || albumApiResponse.tracks;
        if (Array.isArray(tracksArray)) {
            musicList = tracksArray.map(track => internalFormatMusicItem(track, server)).filter(item => item !== null);
        }
        return Promise.resolve({
            isEnd: true, // Assume all tracks of album are returned
            albumItem: albumDetails,
            musicList: musicList,
        });
    }
    return Promise.resolve({ isEnd: true, albumItem: internalFormatAlbumItem({id: album_id, name: "Album not found"}, server), musicList: [], error: "Failed to fetch album details." });
}

async function getArtistWorks(artistItemQuery, page = 1, type = "music") { // type can be 'music' or 'album'
    const artist_id = typeof artistItemQuery === 'object' ? artistItemQuery.id : artistItemQuery;
     if (!artist_id || typeof artist_id !== 'string') {
        return Promise.resolve({ isEnd: true, artistItem: internalFormatArtistItem({id: "unknown"}, null), data: [], error: "Invalid artist ID." });
    }
    const userCfg = getUserConfig();
    const server = (typeof artistItemQuery === 'object' && artistItemQuery._source) || userCfg.METING_SERVER;

    // Meting API: /artist/{id}?server={platform}
    // This endpoint usually returns artist details and a list of *songs*.
    // It might not directly support fetching 'albums' of an artist in a paginated way via this specific endpoint.
    // We'll focus on fetching songs by the artist.
    const artistApiResponse = await callMetingApi(`/api.php/artist/${artist_id}`, { server: server /*, limit: pageSize, page: page (if API supports for songs) */ });

    if (artistApiResponse && artistApiResponse.id) {
        const artistDetails = internalFormatArtistItem(artistApiResponse, server);
        let worksList = [];
        // Assuming response has a 'songs' or 'hot_songs' or 'tracks' array for artist's popular songs
        const tracksArray = artistApiResponse.songs || artistApiResponse.hot_songs || artistApiResponse.tracks; 
        if (type === "music" && Array.isArray(tracksArray)) {
            worksList = tracksArray.map(track => internalFormatMusicItem(track, server)).filter(item => item !== null);
        } 
        // If type === "album", this API endpoint might not be suitable.
        // For simplicity, we only handle type="music" for now.
        
        return Promise.resolve({
            isEnd: true, // Assume API returns a representative list, not necessarily paginated through this endpoint
            artistItem: artistDetails,
            data: worksList, // This is 'data' as per original Netease module structure for getArtistWorks
        });
    }
    return Promise.resolve({ isEnd: true, artistItem: internalFormatArtistItem({id: artist_id, name: "Artist not found"}, server), data: [], error: "Failed to fetch artist details/works." });
}

// Stubbed functions
async function getTopLists() { return Promise.resolve([]); }
async function getTopListDetail(topListItem) { 
    if(topListItem && topListItem.id) {
        const result = await getMusicSheetInfo(topListItem);
        return Promise.resolve({ ...result, topListItem: result.sheetItem });
    }
    return Promise.resolve({isEnd: true, sheetItem: {}, musicList: []});
}
async function getRecommendSheetTags() { return Promise.resolve({ pinned: [], data: [] }); }
async function getRecommendSheetsByTag(tag, page) { return Promise.resolve({ isEnd: true, data: [] });}

// --- Module Exports ---
module.exports = {
    platform: "unm (Meting API)",
    version: UNM_PLUGIN_VERSION,
    srcUrl: "https://raw.githubusercontent.com/IIXINGCHEN/IIXINGCHEN.github.io/refs/heads/main/MusicFree/unm.js",
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
    supportedSearchType: ["music"], // Can be expanded if artist/album search is robust
    search, getMusicInfo, getMediaSource, getLyric,
    importMusicSheet, getMusicSheetInfo, 
    getAlbumInfo, // Added
    getArtistWorks, // Added
    getTopLists, getTopListDetail, getRecommendSheetTags, getRecommendSheetsByTag,
    // To match original module structure, formatters are not typically top-level exported for MusicFree
};
