"use strict";

// Attempt to load critical dependency and set diagnostic flags/messages
let unblockMusicMatcher = null;
let UNM_LOAD_ERROR = null; // Will always be an Error object or null
let UNM_ERROR_MESSAGE = "";
let UNM_ERROR_STACK_SNIPPET = "";

try {
    unblockMusicMatcher = require("@unblockneteasemusic/server");
    if (!unblockMusicMatcher || typeof unblockMusicMatcher.match !== 'function') {
        UNM_ERROR_MESSAGE = "@unblockneteasemusic/server loaded but is not the expected module (missing 'match' function).";
        UNM_LOAD_ERROR = new Error(UNM_ERROR_MESSAGE); 
    }
} catch (e) {
    // Ensure e is processed safely, regardless of what was thrown
    if (e instanceof Error) {
        UNM_LOAD_ERROR = e;
        UNM_ERROR_MESSAGE = e.message || "Unknown error during UNM load.";
        if (e.stack) {
            UNM_ERROR_STACK_SNIPPET = e.stack.substring(0, 200) + "...";
        } else {
            UNM_ERROR_STACK_SNIPPET = "(No stack trace available)";
        }
    } else {
        // If 'e' is not an Error object (e.g., a string, null, undefined was thrown)
        let thrownValueType = typeof e;
        if (e === null) thrownValueType = "null";
        
        UNM_ERROR_MESSAGE = `Non-Error value thrown during UNM load: ${String(e)} (type: ${thrownValueType}).`;
        UNM_LOAD_ERROR = new Error(UNM_ERROR_MESSAGE); // Wrap it in a new Error object
        UNM_ERROR_STACK_SNIPPET = "(Stack trace not applicable for non-Error throw)";
    }
}

const axios = require("axios");

const PYNCPLAYER_VERSION = "1.0.0"; // Incremented version
const pageSize = 30;

const qualityToBitrate = {
    "low": "128",
    "standard": "320",
    "high": "999",
    "super": "999",
};

// --- Internal Helper Functions ( 그대로 유지 ) ---
async function callGDStudioAPI(id, br = "320") {
    try {
        const apiUrl = new URL("https://music-api.gdstudio.xyz/api.php");
        apiUrl.searchParams.append("types", "url");
        apiUrl.searchParams.append("id", id);
        apiUrl.searchParams.append("br", br);
        const response = await axios.get(apiUrl.toString(), { timeout: 8000 });
        if (response.status === 200 && response.data && response.data.url) {
            return {
                url: String(response.data.url).split("?")[0],
                size: response.data.size || 0,
                br: response.data.br || br,
                type: response.data.type,
            };
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function searchGDStudioKuwo(name, page = 1, limit = pageSize) {
    try {
        const apiUrl = new URL("https://music-api.gdstudio.xyz/api.php");
        apiUrl.searchParams.append("types", "search");
        apiUrl.searchParams.append("source", "kuwo");
        apiUrl.searchParams.append("name", name);
        apiUrl.searchParams.append("count", String(limit));
        apiUrl.searchParams.append("pages", String(page));
        const response = await axios.get(apiUrl.toString(), { timeout: 10000 });
        if (response.status === 200 && response.data && Array.isArray(response.data)) {
            return response.data;
        }
        return [];
    } catch (error) {
        return [];
    }
}

let currentEnvConfig = { PROXY_URL: null, UNM_SOURCES: null, music_u: null };
function getUserConfig() {
    if (typeof global !== 'undefined' && global.lx && global.lx.env && typeof global.lx.env.getUserVariables === 'function') {
        return { ...currentEnvConfig, ...global.lx.env.getUserVariables() };
    }
    return currentEnvConfig;
}

function applyProxy(url, proxyUrl) {
    if (proxyUrl && url && (url.includes("kuwo.cn") || url.includes("migu.cn") || url.includes("isure.stream.qqmusic.qq.com"))) {
        const httpRemovedUrl = url.replace(/^http[s]?:\/\//, "");
        return proxyUrl.replace(/\/$/, "") + "/" + httpRemovedUrl;
    }
    return url;
}

function internalFormatMusicItem(rawTrackData, dataSourceHint = "unknown") {
    let id = rawTrackData.id || null;
    let title = rawTrackData.name || rawTrackData.title || "Unknown Title";
    let artist = "Unknown Artist";
    let albumName = "Unknown Album";
    let artwork = rawTrackData.pic || rawTrackData.artwork || (rawTrackData.album ? rawTrackData.album.picUrl : null) || "";
    let duration = rawTrackData.dt || rawTrackData.duration || 0;
    let albumId = rawTrackData.al ? rawTrackData.al.id : (rawTrackData.album ? rawTrackData.album.id : null);
    let loadWarning = rawTrackData.loadWarning || null;

    if (rawTrackData.ar && Array.isArray(rawTrackData.ar)) artist = rawTrackData.ar.map(a => a.name).join('&');
    else if (rawTrackData.artists && Array.isArray(rawTrackData.artists)) artist = rawTrackData.artists.map(a => a.name).join('&');
    else if (typeof rawTrackData.artist === 'string') artist = rawTrackData.artist;

    if (rawTrackData.al && rawTrackData.al.name) { albumName = rawTrackData.al.name; if (!artwork && rawTrackData.al.picUrl) artwork = rawTrackData.al.picUrl; }
    else if (rawTrackData.album && typeof rawTrackData.album === 'object' && rawTrackData.album.name) { albumName = rawTrackData.album.name; if (!artwork && rawTrackData.album.picUrl) artwork = rawTrackData.album.picUrl; }
    else if (typeof rawTrackData.album === 'string') albumName = rawTrackData.album;
    
    if (dataSourceHint === "gdkuwo_search") {
        id = String(rawTrackData.id || (rawTrackData.MUSICRID ? String(rawTrackData.MUSICRID).split('_').pop() : null));
        title = rawTrackData.SONGNAME || title; artist = String(rawTrackData.ARTIST || artist).replace(/;/g, '&'); albumName = rawTrackData.ALBUM || albumName;
        duration = rawTrackData.DURATION ? parseInt(rawTrackData.DURATION, 10) * 1000 : duration;
    }
    const qualities = {}; if (id) qualities["standard"] = { size: rawTrackData.size || 0 };
    let content = 0; 
    let rawLrc = rawTrackData.lyric || rawTrackData.lyrics || null;
    
    const formatted = {
        id: String(id), artist: artist, title: title, duration: parseInt(duration, 10), album: albumName, artwork: artwork,
        qualities: qualities, albumId: albumId ? String(albumId) : null, content: content, rawLrc: rawLrc,
    };
    if (loadWarning) formatted.loadWarning = loadWarning;
    return formatted;
}

// --- Exported Core Functions (그대로 유지, UNM_LOAD_ERROR 처리 강화) ---
async function getMediaSource(musicItem, quality) {
    if (UNM_LOAD_ERROR) {
        const targetBitrate = qualityToBitrate[quality] || "320";
        const gdResult = await callGDStudioAPI(musicItem.id, targetBitrate);
        if (gdResult && gdResult.url) {
            const userVars = getUserConfig(); const PROXY_URL = userVars.PROXY_URL;
            return Promise.resolve({ 
                url: applyProxy(gdResult.url, PROXY_URL), size: gdResult.size || 0, quality: quality,
                warning: `UNM Core Err: ${UNM_ERROR_MESSAGE.substring(0,50)}... Using fallback.` 
            });
        }
        return Promise.resolve(false);
    } // ... (rest of the function remains the same)
    if (!musicItem || !musicItem.id) return Promise.resolve(false);
    const userVars = getUserConfig(); const PROXY_URL = userVars.PROXY_URL; const unmCookie = userVars.music_u;
    let sourceUrl = null; let sourceSize = 0; let actualQualityKey = quality;
    const unmSources = (userVars.UNM_SOURCES && userVars.UNM_SOURCES.split(',')) || ["pyncmd", "kuwo", "bilibili", "migu", "kugou", "qq", "youtube"];
    try {
        const unblockResult = await unblockMusicMatcher.match(musicItem.id, unmSources, unmCookie);
        if (unblockResult && unblockResult.url) { sourceUrl = String(unblockResult.url).split("?")[0]; sourceSize = unblockResult.size || 0; }
    } catch (e) { /* Suppress runtime error during match */ }
    if (!sourceUrl) {
        const targetBitrate = qualityToBitrate[quality] || "320";
        const gdResult = await callGDStudioAPI(musicItem.id, targetBitrate);
        if (gdResult && gdResult.url) { sourceUrl = gdResult.url; sourceSize = gdResult.size || 0; }
    }
    if (sourceUrl) return Promise.resolve({ url: applyProxy(sourceUrl, PROXY_URL), size: sourceSize, quality: actualQualityKey });
    return Promise.resolve(false);
}

async function getMusicInfo(musicItem) {
    const unmErrorStr = UNM_LOAD_ERROR ? `UNM Load Err: ${UNM_ERROR_MESSAGE.substring(0,50)}...` : null;
    if (!musicItem || !musicItem.id) return Promise.resolve(internalFormatMusicItem({ id: musicItem ? musicItem.id : "unknown", name: "Error: Track ID missing", loadWarning: unmErrorStr }));
    if (UNM_LOAD_ERROR) return Promise.resolve(internalFormatMusicItem({ id: musicItem.id, name: musicItem.name || `Track (ID: ${musicItem.id})`, loadWarning: unmErrorStr }));
    // ... (rest of the function remains the same)
    const userVars = getUserConfig(); const unmCookie = userVars.music_u;
    const unmSources = (userVars.UNM_SOURCES && userVars.UNM_SOURCES.split(',')) || ["pyncmd", "kuwo", "bilibili", "migu", "kugou", "qq", "youtube"];
    let trackData = null;
    try {
        const matchResult = await unblockMusicMatcher.match(musicItem.id, unmSources, unmCookie);
        if (matchResult && (matchResult.url || matchResult.name || matchResult.title)) trackData = { ...matchResult, id: musicItem.id };
    } catch (e) { /* Suppress runtime error */ }
    if (trackData) return Promise.resolve(internalFormatMusicItem(trackData, "unm_match"));
    return Promise.resolve(internalFormatMusicItem({ id: musicItem.id, name: `Track (ID: ${musicItem.id}) - Info limited`, loadWarning: unmErrorStr }));
}

async function search(query, page = 1, type = "music") {
    if (type !== "music") return Promise.resolve({ isEnd: true, data: [] }); 
    const loadWarning = UNM_LOAD_ERROR ? `UNM Load Err: ${UNM_ERROR_MESSAGE.substring(0,50)}... Playback may be affected.` : null;
    // ... (rest of the function remains the same)
    const results = await searchGDStudioKuwo(query, page, pageSize);
    const formattedResults = results.map(track => {
        const item = internalFormatMusicItem(track, "gdkuwo_search");
        if(loadWarning && results.length > 0) item.loadWarning = loadWarning;
        return item;
    });
    if (results.length === 0 && UNM_LOAD_ERROR) {
        return Promise.resolve({ isEnd: true, data: [internalFormatMusicItem({id: 'err-search-unm', name: "Search failed to return results.", loadWarning: loadWarning})] });
    }
    return Promise.resolve({ isEnd: results.length < pageSize, data: formattedResults });
}

async function getLyric(musicItem) {
    const unmErrorStr = UNM_LOAD_ERROR ? `UNM Load Err: ${UNM_ERROR_MESSAGE.substring(0,50)}...` : null;
    if (!musicItem || !musicItem.id) return Promise.resolve({ rawLrc: "", error: "Track ID missing", loadWarning: unmErrorStr });
    if (UNM_LOAD_ERROR) return Promise.resolve({ rawLrc: "", error: `UNM Load Err: ${UNM_ERROR_MESSAGE.substring(0,50)}...`, loadWarning: unmErrorStr });
    // ... (rest of the function remains the same)
    const userVars = getUserConfig(); const unmCookie = userVars.music_u;
    const unmSources = (userVars.UNM_SOURCES && userVars.UNM_SOURCES.split(',')) || ["pyncmd", "kuwo", "bilibili", "migu", "kugou", "qq", "youtube"];
    let lyric = "";
    try {
        const matchResult = await unblockMusicMatcher.match(musicItem.id, unmSources, unmCookie);
        if (matchResult && (matchResult.lyric || matchResult.lyrics)) lyric = matchResult.lyric || matchResult.lyrics;
    } catch (e) { /* Suppress runtime error */ }
    const result = { rawLrc: lyric };
    if (unmErrorStr) result.loadWarning = unmErrorStr;
    if (!lyric && !UNM_LOAD_ERROR) result.info = "Lyric not found via UNM.";
    return Promise.resolve(result);
}

// --- Module Exports (그대로 유지) ---
const platformNameDisplay = `pyncmd ${UNM_LOAD_ERROR ? `(UNM Err: ${UNM_ERROR_MESSAGE.substring(0, 25)}...)` : ''}`.trim();

module.exports = {
    platform: platformNameDisplay,
    version: PYNCPLAYER_VERSION,
    cacheControl: "no-store", 
    userVariables: [
        { key: "music_u", name: "网易云Cookie (可选)", hint: "MUSIC_U/A. 对pyncmd作用有限." },
        { key: "PROXY_URL", name: "反代URL (可选)", hint: "例如: http://yourproxy.com" },
        { key: "UNM_SOURCES", name: "UNM音源 (可选,CSV)", hint: "例如: pyncmd,kuwo,qq" }
    ],
    hints: { 
        general: UNM_LOAD_ERROR ? `核心组件UNM加载失败: ${UNM_ERROR_MESSAGE}. 功能受限. STACK (部分): ${UNM_ERROR_STACK_SNIPPET}` : "pyncmd解锁源 (基于@unblockneteasemusic/server)."
    },
    supportedSearchType: ["music"],
    search,
    getMusicInfo,
    getMediaSource,
    getLyric,
    // _unmLoadErrorDetails: UNM_LOAD_ERROR ? { message: UNM_ERROR_MESSAGE, stack: UNM_ERROR_STACK_SNIPPET, errorString: UNM_LOAD_ERROR.toString() } : null, // Kept for easier debugging if needed
};
