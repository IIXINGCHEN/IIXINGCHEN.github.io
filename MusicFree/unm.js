// unm.js
"use strict";

const axios = require("axios");
// const CryptoJs = require("crypto-js"); // Not used by Meting API interaction
// const dayjs = require("dayjs");       // Not used in this version's formatting

const UNM_PLUGIN_VERSION = "2.2.0"; // Final alignment version
const pageSize = 30; 
const METING_API_HOST = "https://meting-api.imixc.top"; 

const DEFAULT_METING_SERVER = "netease";
const VALID_METING_SERVERS = ["netease", "tencent", "kugou", "kuwo", "baidu", "pyncmd"];

// Original qualityMap - will be used to determine requested bitrate quality abstractly
// but actual available qualities depend on Meting API's /url endpoint.
const qualityMap = { // This is for getMediaSource's 'quality' parameter.
    "low": "128k",      // Placeholder, actual mapping to bitrate done in getMediaSource
    "standard": "320k", // Placeholder
    "high": "flac",     // Placeholder
    "super": "hires",   // Placeholder
};

// --- Validation Helper Functions ---
function isValidUrl(urlString) { /* ... (same as v2.1.6) ... */ 
    if (typeof urlString !== 'string') return false;
    try {
        const url = new URL(urlString);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
}
function sanitizeString(str, defaultVal = "") { /* ... (same as v2.1.6) ... */ 
    if (typeof str === 'string') {
        return str.replace(/\0/g, '').trim();
    }
    return defaultVal;
}

// --- API Call Helper ---
async function callMetingApi(endpointPathWithApiPrefix, params = {}) { /* ... (same as v2.1.6) ... */ 
    try {
        const url = `${METING_API_HOST}${endpointPathWithApiPrefix}`;
        const response = await axios.get(url, { params, timeout: 10000 });
        if (response.status === 200 && response.data) {
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
let currentEnvConfig = { /* ... (same as v2.1.6) ... */ 
    PROXY_URL: null,
    METING_SERVER: DEFAULT_METING_SERVER,
};
function getUserConfig() { /* ... (same as v2.1.6) ... */ 
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

function applyProxy(url, proxyUrl) { /* ... (same as v2.1.6) ... */ 
    if (proxyUrl && isValidUrl(proxyUrl) && url && isValidUrl(url) && 
        (url.includes("kuwo.cn") || url.includes("migu.cn") || url.includes("music.163.com") || url.includes("isure.stream.qqmusic.qq.com") || url.includes("qq.com"))) {
        const httpRemovedUrl = url.replace(/^http[s]?:\/\//, "");
        return proxyUrl.replace(/\/$/, "") + "/" + httpRemovedUrl;
    }
    return url;
}

// --- EAPI Stub (for structural consistency with original wy.js) ---
// This function is NOT used by unm.js's core logic.
async function EAPI(path, json = {}) {
    // console.warn("unm.js: EAPI function is a stub and not used for Meting API calls.");
    return Promise.resolve({});
}

// --- Internal Formatting Functions (to match original wy.js structure where possible) ---
function formatMusicItem(apiTrackData, server) { // Renamed for export
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

    const albumName = sanitizeString(apiTrackData.album, "Unknown Album");
    let artwork = "";
    if (isValidUrl(apiTrackData.pic)) artwork = apiTrackData.pic; // From /song endpoint
    else if (isValidUrl(apiTrackData.cover)) artwork = apiTrackData.cover; // From /playlist song item

    // Duration: Meting API spec for /search and /song doesn't explicitly list 'dt' or a duration field.
    // Assuming 'duration' if present, otherwise 0. Original 'dt' was in ms.
    const duration = parseInt(apiTrackData.duration || apiTrackData.dt || 0, 10) || 0; 

    const albumId = String(apiTrackData.album_id || (apiTrackData.al ? apiTrackData.al.id : "") || ""); 

    // Qualities: Very simplified. Meting API /url gives one link per bitrate request.
    // We can't replicate the original EAPI's detailed qualities object.
    const qualities = {}; 
    if (id) { // If a song exists, assume a 'standard' quality is findable via getMediaSource
        qualities["standard"] = { size: parseInt(apiTrackData.size || 0) }; // Size from /url if passed here, else 0
    }
    
    // Content (fee status): Meting API doesn't provide Netease's 'fee' or 'privilege'. Assume playable.
    const content = 0; 
    
    // rawLrc might be populated by getLyric later, or if /song or /playlist item includes it.
    const rawLrc = sanitizeString(apiTrackData.lyric || apiTrackData.lrc || ""); 

    return {
        id: id,
        artist: artists,
        title: title,
        duration: duration, // Milliseconds
        album: albumName,
        artwork: artwork,
        qualities: qualities, // Simplified
        albumId: albumId,     // Often not available from Meting search/song directly
        content: content,     // Simplified
        rawLrc: rawLrc,       // May be empty initially
        _pic_id: apiTrackData.pic_id ? String(apiTrackData.pic_id) : null,
        _lyric_id: String(apiTrackData.lyric_id || id),
        _source: server || sanitizeString(apiTrackData.source),
    };
}

function formatSheetItem(playlistId, playlistApiResponse, server) { // Renamed for export
    // ... (same as internalFormatSheetItem from v2.1.6)
    // This will produce a sheetItem with minimal metadata due to API response structure.
    let sheetName = `Playlist ${playlistId}`; 
    let coverImgUrl = ""; let creatorName = ""; let description = "";
    let trackCount = 0; let playCount = 0;

    if (playlistApiResponse && playlistApiResponse.data) {
        const data = playlistApiResponse.data;
        // Try to get some metadata if the API wrapper for /playlist/{id} provides it.
        // The JSON example for /playlist/{id} only had `playlist_id` and `playlist_info`.
        sheetName = sanitizeString(data.name || data.title, `Playlist ${playlistId}`);
        coverImgUrl = isValidUrl(data.cover || data.artwork || data.coverImgUrl) ? (data.cover || data.artwork || data.coverImgUrl) : "";
        creatorName = sanitizeString(data.creator ? (data.creator.name || data.creator.nickname) : (data.user ? data.user.nickname : ""), "");
        description = sanitizeString(data.description, "");
        playCount = parseInt(data.play_count || data.playCount, 10) || 0;
        
        if (Array.isArray(data.playlist_info)) {
            trackCount = data.playlist_info.length;
        } else if (Array.isArray(data.songs)) { // Fallback if songs are under 'songs'
             trackCount = data.songs.length;
        } else if (Array.isArray(data.tracks)) { // Fallback for 'tracks'
             trackCount = data.tracks.length;
        }
    }
    if (playlistApiResponse && playlistApiResponse.meta && typeof playlistApiResponse.meta.song_count === 'number' && trackCount === 0) {
        trackCount = playlistApiResponse.meta.song_count;
    }
    
    return {
        id: String(playlistId), title: sheetName, artist: creatorName, artwork: coverImgUrl,
        description: description, worksNum: trackCount, playCount: playCount, 
        // Fields from original wy.js formatSheetItem (defaults if not available)
        date: playlistApiResponse && playlistApiResponse.updateTime ? playlistApiResponse.updateTime : null, 
        createUserId: playlistApiResponse && playlistApiResponse.userId ? playlistApiResponse.userId : null,
        createTime: playlistApiResponse && playlistApiResponse.createTime ? playlistApiResponse.createTime : null,
        content: 2, // Original value
        _source: server,
    };
}

function formatAlbumItem(apiAlbumData, server) { // Renamed for export
    // ... (same as internalFormatAlbumItem from v2.1.6)
    if (!apiAlbumData || typeof apiAlbumData !== 'object' || !apiAlbumData.id) {
        return { id: "unknown", title: "Unknown Album", artist: "", artwork: "", description: "", date: "", worksNum: 0, content: 4 };
    }
    let artistName = "Unknown Artist";
    // ... (artist parsing logic)
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
        artist: artistName, // Artist of the album
        artwork: isValidUrl(apiAlbumData.cover || apiAlbumData.pic) ? (apiAlbumData.cover || apiAlbumData.pic) : "",
        description: sanitizeString(apiAlbumData.description || apiAlbumData.desc, ""),
        // date: apiAlbumData.publishTime ? dayjs.unix(apiAlbumData.publishTime / 1000).format("YYYY-MM-DD") : "", // Requires dayjs
        date: sanitizeString(apiAlbumData.publish_date || apiAlbumData.publishTime, ""),
        worksNum: parseInt(apiAlbumData.song_count || (apiAlbumData.songs ? apiAlbumData.songs.length : 0), 10) || 0,
        content: 4, // Original value
        _source: server,
    };
}

function formatArtistItem(apiArtistData, server) { // Renamed for export
    // ... (same as internalFormatArtistItem from v2.1.6)
    if (!apiArtistData || typeof apiArtistData !== 'object' || !apiArtistData.id) {
        return { id: "unknown", name: "Unknown Artist", avatar: "", description: "", worksNum: 0, content: 5 };
    }
    return {
        id: String(apiArtistData.id),
        name: sanitizeString(apiArtistData.name, "Artist"),
        avatar: isValidUrl(apiArtistData.pic || apiArtistData.cover || apiArtistData.avatar) ? (apiArtistData.pic || apiArtistData.cover || apiArtistData.avatar) : "",
        description: sanitizeString(apiArtistData.description || apiArtistData.desc || apiArtistData.briefDesc, ""),
        worksNum: parseInt(apiArtistData.music_size || apiArtistData.song_count || 0, 10) || 0,
        content: 5, // Original value
        _source: server,
    };
}

// --- Exported Core Functions ---
// Search, getMusicInfo, getMediaSource, getLyric, getMusicSheetInfo, importMusicSheet,
// getAlbumInfo, getArtistWorks are adapted from v2.1.6 to use the renamed formatters
// and ensure they match the structure of the original wy.js where feasible.

async function search(query, page = 1, type = "music") {
    if (typeof query !== 'string' || !query.trim()) return Promise.resolve({ isEnd: true, data: [], error: "Invalid search query." });
    if (typeof page !== 'number' || page < 1) page = 1;
    
    const userCfg = getUserConfig();
    const server = userCfg.METING_SERVER;

    if (type !== "music") { 
        // Meting API's /search is primarily for songs. 
        // Other types like album/artist are better fetched via their specific endpoints if an ID is known,
        // or this search could try to infer them, but results would still be song lists.
        // For functional parity with original wy.js that *had* typed search (even if via different EAPI paths):
        // We will return empty for non-music types as Meting /search doesn't directly support them.
        return Promise.resolve({ isEnd: true, data: [], error: `Search type "${type}" not directly supported by Meting /search. Use specific getAlbumInfo/getArtistWorks or song search.` });
    }
    
    const apiResponse = await callMetingApi("/api.php/search", { q: query, server: server, limit: pageSize });
    let songsArray = null;
    if (apiResponse && apiResponse.data && Array.isArray(apiResponse.data.results)) {
        songsArray = apiResponse.data.results;
    } else if (apiResponse && Array.isArray(apiResponse)) {
        songsArray = apiResponse;
    }

    if (songsArray && Array.isArray(songsArray)) { 
        const formattedResults = songsArray.map(track => formatMusicItem(track, track.source || server)).filter(item => item !== null);
        const totalResults = (apiResponse.meta && typeof apiResponse.meta.total_results === 'number') ? apiResponse.meta.total_results : null;
        let isEnd = formattedResults.length < pageSize; 
        if (totalResults !== null) { isEnd = (page * pageSize) >= totalResults; }
        
        return Promise.resolve({ isEnd: isEnd, data: formattedResults });
    }
    return Promise.resolve({ isEnd: true, data: [], error: "Search API request failed or returned no parsable song list." });
}

async function getMusicInfo(musicItem) { /* ... (from v2.1.6, uses formatMusicItem) ... */ 
    if (!musicItem || typeof musicItem !== 'object' || !musicItem.id || typeof musicItem.id !== 'string') {
        return Promise.resolve(formatMusicItem({ id: "unknown", name: "Error: Invalid musicItem input" }, null));
    }
    const userCfg = getUserConfig();
    const server = musicItem._source || userCfg.METING_SERVER;
    const track_id = musicItem.id;
    const apiResponse = await callMetingApi(`/api.php/song/${track_id}`, { server: server });
    let songData = null;
    if (apiResponse && apiResponse.data && Array.isArray(apiResponse.data.song_info) && apiResponse.data.song_info.length > 0) {
        songData = apiResponse.data.song_info[0];
    } else if (apiResponse && apiResponse.data && apiResponse.data.id) {
        songData = apiResponse.data;
    } else if (Array.isArray(apiResponse) && apiResponse.length > 0 && apiResponse[0].id) {
        songData = apiResponse[0];
    }
    if (songData && songData.id) {
        let formatted = formatMusicItem(songData, server);
        const picIdToFetch = songData.pic_id || formatted._pic_id || (isValidUrl(songData.pic) ? null : songData.pic) ;
        if (!formatted.artwork && picIdToFetch && !isValidUrl(picIdToFetch)) { 
            const picData = await callMetingApi(`/api.php/picture/${picIdToFetch}`, {server: server});
            if (picData && picData.data && isValidUrl(picData.data.url)) {
               formatted.artwork = picData.data.url;
            } else if (picData && isValidUrl(picData.url)){
                formatted.artwork = picData.url;
            }
        } else if (!formatted.artwork && isValidUrl(picIdToFetch)) { 
            formatted.artwork = picIdToFetch;
        }
        return Promise.resolve(formatted);
    }
    return Promise.resolve(formatMusicItem({ ...musicItem, name: musicItem.title || `Track ${track_id} (Info call failed)` }, server));
}

async function getMediaSource(musicItem, quality) { /* ... (from v2.1.6, uses qualityMap abstractly) ... */ 
    // Note: musicItem.qualities is from the original wy.js structure.
    // Here, it's not pre-populated. We directly request a bitrate.
    // The 'quality' parameter is an abstract key like "standard", "high".
    if (!musicItem || typeof musicItem !== 'object' || !musicItem.id || typeof musicItem.id !== 'string') {
        return Promise.resolve({ error: "Invalid musicItem input." });
    }
    if (typeof quality !== 'string' || !qualityMap[quality.toLowerCase()]) { // Check against qualityMap keys
        quality = "standard"; // Default if provided quality key is invalid
    }
    const userCfg = getUserConfig();
    const server = musicItem._source || userCfg.METING_SERVER;
    const track_id = musicItem.id;
    let bitrateApiValue; 
    switch (quality.toLowerCase()) { // Use qualityMap for mapping if needed, or direct values
        case "low": bitrateApiValue = 128000; break;
        case "standard": bitrateApiValue = 320000; break;
        case "high": bitrateApiValue = 999000; break; 
        case "super": bitrateApiValue = 999000; break;
        default: bitrateApiValue = 320000;
    }
    const apiResponse = await callMetingApi(`/api.php/url/${track_id}`, { server: server, bitrate: bitrateApiValue });
    if (apiResponse && apiResponse.data && apiResponse.data.url_info && isValidUrl(apiResponse.data.url_info.url)) {
        const PROXY_URL = userCfg.PROXY_URL; 
        return Promise.resolve({
            url: applyProxy(apiResponse.data.url_info.url, PROXY_URL),
            size: parseInt(apiResponse.data.url_info.size, 10) || 0,
            quality: quality, // Return the requested abstract quality key
        });
    }
    return Promise.resolve({ error: "Failed to get media source or invalid URL returned." });
}

async function getLyric(musicItem) { /* ... (from v2.1.6, returns rawLrc and translateLrc) ... */ 
    if (!musicItem || typeof musicItem !== 'object' || (!musicItem.id && !musicItem._lyric_id)) {
        return Promise.resolve({ rawLrc: "", tlyric: "", error: "Invalid musicItem input." });
    }
    const userCfg = getUserConfig();
    const server = musicItem._source || userCfg.METING_SERVER;
    const lyric_id_to_use = musicItem._lyric_id || musicItem.id;
    if (!lyric_id_to_use) return Promise.resolve({ rawLrc: "", tlyric: "", error: "Lyric ID missing." });
    const apiResponse = await callMetingApi(`/api.php/lyric/${lyric_id_to_use}`, { server: server });
    if (apiResponse && apiResponse.data && typeof apiResponse.data.lyric === 'object') {
        return Promise.resolve({
            rawLrc: sanitizeString(apiResponse.data.lyric.lyric),
            translateLrc: sanitizeString(apiResponse.data.lyric.tlyric), // Original wy.js just had rawLrc
        });
    }
    return Promise.resolve({ rawLrc: "", tlyric: "", error: "Lyric not found or API error." });
}

async function getMusicSheetInfo(sheetQuery, page = 1) { /* ... (from v2.1.6, uses formatSheetItem) ... */ 
    const sheet_id = typeof sheetQuery === 'object' ? sheetQuery.id : String(sheetQuery);
    if (!sheet_id || typeof sheet_id !== 'string' || !sheet_id.trim()) {
        return Promise.resolve({ isEnd: true, sheetItem: formatSheetItem(sheet_id, null, null), musicList: [], error: "Invalid sheet ID." });
    }
    const userCfg = getUserConfig();
    const server = userCfg.METING_SERVER; 
    const playlistApiResponse = await callMetingApi(`/api.php/playlist/${sheet_id}`, { server: server });
    if (playlistApiResponse && playlistApiResponse.data && playlistApiResponse.data.playlist_id === sheet_id) {
        const sheetItem = formatSheetItem(sheet_id, playlistApiResponse, server); 
        let musicList = [];
        const tracksArray = playlistApiResponse.data.playlist_info;
        if (Array.isArray(tracksArray)) {
            musicList = tracksArray.map(track => formatMusicItem(track, track.source || server)).filter(item => item !== null);
        }
        return Promise.resolve({ isEnd: true, sheetItem: sheetItem, musicList: musicList });
    }
    return Promise.resolve({ isEnd: true, sheetItem: formatSheetItem(sheet_id, null, server), musicList: [], error: "Failed to fetch playlist details or invalid API response." });
}

async function importMusicSheet(urlLike) { /* ... (from v2.1.6, uses getMusicSheetInfo) ... */ 
    if (typeof urlLike !== 'string' || !urlLike.trim()) { return Promise.resolve(false); } // Original returns false
    let sheetId = null;
    const neteasePlaylistMatch = urlLike.match(/(?:playlist\?id=|playlist\/|song\/list\?id=|list\?id=)(\d+)/i);
    if (neteasePlaylistMatch && neteasePlaylistMatch[1]) { sheetId = neteasePlaylistMatch[1]; }
    if (!sheetId) { return Promise.resolve(false); } // Original returns false
    const result = await getMusicSheetInfo({ id: sheetId }); // Result contains sheetItem and musicList
    return Promise.resolve(result.musicList || false); // Original returns musicList or false
}

async function importMusicItem(urlLike) { // To match original wy.js
    if (typeof urlLike !== 'string' || !urlLike.trim()) { return Promise.resolve(false); }
    let songId = null;
    // Basic Netease song ID parsing
    const neteaseSongMatch = urlLike.match(/(?:song\?id=|song\/)(\d+)/i);
    if (neteaseSongMatch && neteaseSongMatch[1]) {
        songId = neteaseSongMatch[1];
    } else if (/^\d+$/.test(urlLike)) { // If just an ID string
        songId = urlLike;
    }
    if (!songId) { return Promise.resolve(false); }
    return getMusicInfo({ id: songId }); // Returns a Promise<MusicItem> or Promise<FormattedErrorItem>
}


async function getAlbumInfo(albumItemQuery) { /* ... (from v2.1.6, uses formatAlbumItem) ... */ 
    const album_id = typeof albumItemQuery === 'object' ? albumItemQuery.id : albumItemQuery;
    if (!album_id || typeof album_id !== 'string') {
        return Promise.resolve({ isEnd: true, albumItem: formatAlbumItem({id: "unknown"}, null), musicList: [], error: "Invalid album ID." });
    }
    const userCfg = getUserConfig();
    const server = (typeof albumItemQuery === 'object' && albumItemQuery._source) || userCfg.METING_SERVER;
    const albumApiResponseArray = await callMetingApi(`/api.php/album/${album_id}`, { server: server });
    const albumApiResponse = (Array.isArray(albumApiResponseArray) && albumApiResponseArray.length > 0) ? albumApiResponseArray[0] : albumApiResponseArray;
    if (albumApiResponse && albumApiResponse.id) {
        const albumDetails = formatAlbumItem(albumApiResponse, server);
        let musicList = [];
        const tracksArray = albumApiResponse.songs || albumApiResponse.tracks;
        if (Array.isArray(tracksArray)) {
            musicList = tracksArray.map(track => formatMusicItem(track, server)).filter(item => item !== null);
        }
        return Promise.resolve({ isEnd: true, albumItem: albumDetails, musicList: musicList });
    }
    return Promise.resolve({ isEnd: true, albumItem: formatAlbumItem({id: album_id, name: "Album not found"}, server), musicList: [], error: "Failed to fetch album details." });
}

async function getArtistWorks(artistItemQuery, page = 1, type = "music") { /* ... (from v2.1.6, uses formatArtistItem) ... */ 
    const artist_id = typeof artistItemQuery === 'object' ? artistItemQuery.id : artistItemQuery;
     if (!artist_id || typeof artist_id !== 'string') {
        return Promise.resolve({ isEnd: true, artistItem: formatArtistItem({id: "unknown"}, null), data: [], error: "Invalid artist ID." });
    }
    const userCfg = getUserConfig();
    const server = (typeof artistItemQuery === 'object' && artistItemQuery._source) || userCfg.METING_SERVER;
    const artistApiResponseArray = await callMetingApi(`/api.php/artist/${artist_id}`, { server: server });
    const artistApiResponse = (Array.isArray(artistApiResponseArray) && artistApiResponseArray.length > 0) ? artistApiResponseArray[0] : artistApiResponseArray;
    if (artistApiResponse && artistApiResponse.id) {
        const artistDetails = formatArtistItem(artistApiResponse, server);
        let worksList = [];
        const tracksArray = artistApiResponse.songs || artistApiResponse.hot_songs || artistApiResponse.tracks; 
        if (type === "music" && Array.isArray(tracksArray)) {
            worksList = tracksArray.map(track => formatMusicItem(track, server)).filter(item => item !== null);
        } 
        // To align with original wy.js, if type === "album", we'd need to fetch albums.
        // Meting /artist/{id} doesn't directly list albums in a separate array in its typical spec.
        // We'd have to infer albums from the song list, or this feature will be limited for "album" type.
        // For now, worksList will be songs.
        return Promise.resolve({ isEnd: true, artistItem: artistDetails, data: worksList });
    }
    return Promise.resolve({ isEnd: true, artistItem: formatArtistItem({id: artist_id, name: "Artist not found"}, server), data: [], error: "Failed to fetch artist details/works." });
}

// Stubbed functions to match original wy.js export structure
async function getTopLists() { 
    // console.warn("unm.js: getTopLists is not implemented via Meting API.");
    return Promise.resolve([]); 
}
async function getTopListDetail(topListItem) { 
    // console.warn("unm.js: getTopListDetail is not fully implemented.");
    if(topListItem && topListItem.id) {
        // Treat a toplist item as a sheet/playlist for fetching songs
        const result = await getMusicSheetInfo(topListItem); 
        return Promise.resolve({ ...result, topListItem: result.sheetItem }); // sheetItem will be minimal
    }
    return Promise.resolve({isEnd: true, topListItem: {}, musicList: [], error: "Invalid topListItem"});
}
async function getRecommendSheetTags() { 
    // console.warn("unm.js: getRecommendSheetTags is not implemented via Meting API.");
    return Promise.resolve({ pinned: [], data: [] }); 
}
async function getRecommendSheetsByTag(tag, page) { 
    // console.warn("unm.js: getRecommendSheetsByTag is not implemented via Meting API.");
    return Promise.resolve({ isEnd: true, data: [] });
}
async function getMusicComments(musicItem, page = 1) {
    // console.warn("unm.js: getMusicComments is not implemented via Meting API.");
    return Promise.resolve({ isEnd: true, data: [] });
}


// --- Module Exports (Aligning with original wy.js structure) ---
module.exports = {
    platform: "unm (Meting API)", // Platform name changed from "网易云"
    author: 'Original wy.js Author & Meting API by community, Refactor: AI Assistant', // Updated author
    version: UNM_PLUGIN_VERSION,
    appVersion: ">0.4.0-alpha.0", // Copied from original wy.js
    srcUrl: "https://raw.githubusercontent.com/IIXINGCHEN/IIXINGCHEN.github.io/refs/heads/main/MusicFree/unm.js", // Placeholder, UPDATE THIS
    cacheControl: "no-store", 
    hints: {
        importMusicSheet: [
            "支持网易云歌单链接导入 (例如 https://music.163.com/#/playlist?id=xxxxxx)",
            "歌单功能基于Meting API，可能与其他源的歌单信息丰富度不同。"
        ],
        importMusicItem: [
            "支持网易云歌曲链接/ID导入。"
        ]
    },
    userVariables: [
        { 
            key: "METING_SERVER", 
            name: "Meting API 音源 (server)", 
            hint: `选择数据源 (可选: ${VALID_METING_SERVERS.join(', ')}). 默认: ${DEFAULT_METING_SERVER}` 
        },
        { 
            key: "PROXY_URL", 
            name: "反代URL (可选)", 
            hint: "例如: https://yourproxy.com (代理部分音源链接)" 
        }
    ],
    supportedSearchType: ["music", "album", "artist"], // Aligning with implemented getAlbumInfo/getArtistWorks

    // Core functions
    search,
    getMusicInfo,
    getMediaSource,
    getLyric,
    
    // Playlist/Sheet functions
    importMusicSheet,
    getMusicSheetInfo, 
    
    // Album and Artist functions
    getAlbumInfo, 
    getArtistWorks,
    
    // Functions that are now stubs due to Meting API limitations (compared to EAPI)
    getTopLists, 
    getTopListDetail,  
    getRecommendSheetTags,
    getRecommendSheetsByTag,
    getMusicComments,

    // Original wy.js also exported these formatters and EAPI utils.
    // Exporting them as stubs or with limited functionality for structural compatibility.
    formatMusicItem, // Now points to our Meting-adapted internal formatter
    formatAlbumItem, // Points to our Meting-adapted internal formatter
    formatArtistItem, // Points to our Meting-adapted internal formatter
    formatSheetItem, // Points to our Meting-adapted internal formatter
    // formatComment: (c) => c, // Simple pass-through stub if needed for structure
    EAPI, // Stub
    // MD5 and AES are not directly used by Meting interactions, can be omitted or kept as utils
    // MD5: (data) => CryptoJs.MD5(data).toString(CryptoJs.enc.Hex), 
    // AES: (data) => { /* ... AES logic ... */ return ""; },
};
