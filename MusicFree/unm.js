"use strict";

const axios = require("axios");

const PYNCPLAYER_VERSION = "1.2.1";
const pageSize = 20;
const METING_API_BASE = "https://meting-api.imixc.top/api.php";
const DEFAULT_METING_SOURCE = "pyncmd";
const VALID_METING_SOURCES = ["netease", "tencent", "kugou", "kuwo", "baidu", "pyncmd"];

// --- Validation Helper Functions ---
function isValidUrl(urlString) {
    if (typeof urlString !== 'string') return false;
    try {
        const url = new URL(urlString);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
}

function sanitizeString(str, defaultVal = "") {
    if (typeof str === 'string') {
        return str.replace(/\0/g, '').trim();
    }
    return defaultVal;
}

// --- API Call Helper ---
async function callMetingApi(endpoint, params = {}) {
    try {
        const response = await axios.get(METING_API_BASE + endpoint, { params, timeout: 8000 });
        if (response.status === 200 && response.data.success && Array.isArray(response.data.data)) {
            return response.data.data;
        }
        return [];
    } catch (error) {
        return [];
    }
}

// --- User Config Handling ---
let currentEnvConfig = {
    PROXY_URL: null,
    METING_SOURCE: DEFAULT_METING_SOURCE
};

function getUserConfig() {
    let config = { ...currentEnvConfig };
    try {
        if (typeof global !== 'undefined' && global.lx && global.lx.env && typeof global.lx.env.getUserVariables === 'function') {
            const userVars = global.lx.env.getUserVariables();
            if (userVars && typeof userVars === 'object') {
                if (userVars.PROXY_URL && isValidUrl(userVars.PROXY_URL)) {
                    config.PROXY_URL = userVars.PROXY_URL;
                }
                if (userVars.METING_SOURCE && VALID_METING_SOURCES.includes(String(userVars.METING_SOURCE).toLowerCase())) {
                    config.METING_SOURCE = String(userVars.METING_SOURCE).toLowerCase();
                }
            }
        }
    } catch (error) {
        // Fallback to default config
    }
    return config;
}

function applyProxy(url, proxyUrl) {
    if (proxyUrl && isValidUrl(proxyUrl) && url && isValidUrl(url) &&
        (url.includes("kuwo.cn") || url.includes("music.163.com"))) {
        const httpRemovedUrl = url.replace(/^http[s]?:\/\//, "");
        return proxyUrl.replace(/\/$/, "") + "/" + httpRemovedUrl;
    }
    return url;
}

// --- Internal Formatting ---
function internalFormatMusicItem(apiTrackData) {
    if (!apiTrackData || typeof apiTrackData !== 'object' || !apiTrackData.id || apiTrackData.type !== "song") {
        return null;
    }

    return {
        id: String(apiTrackData.id),
        title: sanitizeString(apiTrackData.name, "Unknown Title"),
        artist: sanitizeString(apiTrackData.artist, "Unknown Artist"),
        album: sanitizeString(apiTrackData.album, "Unknown Album"),
        artwork: sanitizeString(apiTrackData.pic, ""),
        duration: parseInt(apiTrackData.duration || 0, 10) || 0,
        _pic_id: null,
        _lyric_id: apiTrackData.lyric_id ? String(apiTrackData.lyric_id) : null,
        _source: apiTrackData.source ? String(apiTrackData.source) : null,
        qualities: {},
        content: 0,
        rawLrc: ""
    };
}

function formatAlbumItem(apiAlbumData) {
    if (!apiAlbumData || typeof apiAlbumData !== 'object' || !apiAlbumData.id || apiAlbumData.type !== "album") {
        return null;
    }

    return {
        id: String(apiAlbumData.id),
        title: sanitizeString(apiAlbumData.name, "Unknown Album"),
        artist: sanitizeString(apiAlbumData.artist, "Unknown Artist"),
        artwork: sanitizeString(apiAlbumData.pic, ""),
        description: sanitizeString(apiAlbumData.description, ""),
        date: sanitizeString(apiAlbumData.publish_date, ""),
        worksNum: apiAlbumData.song_count || 0,
        content: 4
    };
}

function formatArtistItem(apiArtistData) {
    if (!apiArtistData || typeof apiArtistData !== 'object' || !apiArtistData.id || apiArtistData.type !== "artist") {
        return null;
    }

    return {
        id: String(apiArtistData.id),
        name: sanitizeString(apiArtistData.name, "Unknown Artist"),
        artwork: sanitizeString(apiArtistData.pic, ""),
        description: sanitizeString(apiArtistData.description, ""),
        worksNum: apiArtistData.song_count || 0,
        content: 5
    };
}

function formatPlaylistItem(apiPlaylistData) {
    if (!apiPlaylistData || typeof apiPlaylistData !== 'object' || !apiPlaylistData.id || apiPlaylistData.type !== "playlist") {
        return null;
    }

    return {
        id: String(apiPlaylistData.id),
        title: sanitizeString(apiPlaylistData.name, "Unknown Playlist"),
        creator: sanitizeString(apiPlaylistData.creator, "Unknown Creator"),
        artwork: sanitizeString(apiPlaylistData.pic, ""),
        description: sanitizeString(apiPlaylistData.description, ""),
        worksNum: apiPlaylistData.song_count || (apiPlaylistData.tracks ? apiPlaylistData.tracks.length : 0),
        content: 2,
        tracks: apiPlaylistData.tracks ? apiPlaylistData.tracks.map(track => internalFormatMusicItem(track)).filter(item => item !== null) : []
    };
}

// --- Exported Core Functions ---
async function search(query, page = 1, type = "music") {
    if (typeof query !== 'string' || !query.trim()) {
        return Promise.resolve({ isEnd: true, data: [], error: "Invalid search query." });
    }
    if (typeof page !== 'number' || page < 1) page = 1;
    if (!["music", "album", "artist", "playlist"].includes(type)) {
        return Promise.resolve({ isEnd: true, data: [], error: `Search type "${type}" not supported.` });
    }

    const userCfg = getUserConfig();
    const source = userCfg.METING_SOURCE || DEFAULT_METING_SOURCE;
    const limit = pageSize;
    const offset = (page - 1) * limit;

    const apiParams = {
        q: query,
        server: source,
        limit: limit,
        offset: offset
    };

    const searchData = await callMetingApi("/search", apiParams);

    if (!Array.isArray(searchData)) {
        return Promise.resolve({ isEnd: true, data: [], error: "Search API request failed or returned invalid data." });
    }

    let filteredData;
    switch (type) {
        case "music":
            filteredData = searchData.filter(item => item.type === "song");
            break;
        case "album":
            filteredData = searchData.filter(item => item.type === "album");
            break;
        case "artist":
            filteredData = searchData.filter(item => item.type === "artist");
            break;
        case "playlist":
            filteredData = searchData.filter(item => item.type === "playlist");
            break;
        default:
            filteredData = [];
    }

    const formattedResults = filteredData.map(item => {
        switch (type) {
            case "music":
                return internalFormatMusicItem(item);
            case "album":
                return formatAlbumItem(item);
            case "artist":
                return formatArtistItem(item);
            case "playlist":
                return formatPlaylistItem(item);
            default:
                return null;
        }
    }).filter(item => item !== null);

    const isEnd = formattedResults.length < limit;

    return Promise.resolve({
        isEnd: isEnd,
        data: formattedResults
    });
}

async function getMusicInfo(musicItem) {
    if (!musicItem || typeof musicItem !== 'object' || !musicItem.id || typeof musicItem.id !== 'string') {
        return Promise.resolve(internalFormatMusicItem({ id: "unknown", title: "Error: Invalid musicItem input" }));
    }

    const userCfg = getUserConfig();
    const source = (musicItem._source && VALID_METING_SOURCES.includes(musicItem._source)) ? musicItem._source : userCfg.METING_SOURCE;

    const apiParams = {
        server: source
    };

    const songData = await callMetingApi(`/song/${musicItem.id}`, apiParams);

    if (!Array.isArray(songData) || songData.length === 0) {
        return Promise.resolve(internalFormatMusicItem({ id: musicItem.id, title: "Error: Song not found" }));
    }

    const formattedItem = internalFormatMusicItem(songData[0]);
    if (!formattedItem.artwork && songData[0].pic_id) {
        const picData = await callMetingApi(`/picture/${songData[0].pic_id}`, { server: source, size: 500 });
        if (Array.isArray(picData) && picData.length > 0 && picData[0].url) {
            formattedItem.artwork = picData[0].url;
        }
    }
    return Promise.resolve(formattedItem);
}

async function getMediaSource(musicItem, quality) {
    if (!musicItem || typeof musicItem !== 'object' || !musicItem.id || typeof musicItem.id !== 'string') {
        return Promise.resolve({ error: "Invalid musicItem input." });
    }
    if (typeof quality !== 'string') quality = "standard";

    const userCfg = getUserConfig();
    const source = (musicItem._source && VALID_METING_SOURCES.includes(musicItem._source)) ? musicItem._source : userCfg.METING_SOURCE;

    let bitrate;
    switch (quality.toLowerCase()) {
        case "low": bitrate = "128"; break;
        case "standard": bitrate = "320"; break;
        case "high": bitrate = "999"; break;
        case "super": bitrate = "999"; break;
        default: bitrate = "320";
    }

    const apiParams = {
        server: source,
        bitrate: bitrate
    };

    const urlData = await callMetingApi(`/url/${musicItem.id}`, apiParams);

    if (Array.isArray(urlData) && urlData.length > 0 && urlData[0].url) {
        return {
            url: applyProxy(urlData[0].url, userCfg.PROXY_URL),
            size: urlData[0].size ? parseInt(urlData[0].size, 10) * 1024 : 0,
            quality: quality
        };
    }

    return { error: "Failed to get media source or invalid URL returned." };
}

async function getLyric(musicItem) {
    if (!musicItem || typeof musicItem !== 'object' || (!musicItem.id && !musicItem._lyric_id)) {
        return Promise.resolve({ rawLrc: "", translateLrc: "", error: "Invalid musicItem input." });
    }

    const userCfg = getUserConfig();
    const source = (musicItem._source && VALID_METING_SOURCES.includes(musicItem._source)) ? musicItem._source : userCfg.METING_SOURCE;
    const lyric_id = musicItem._lyric_id || musicItem.id;

    const apiParams = {
        server: source
    };

    const lyricData = await callMetingApi(`/lyric/${lyric_id}`, apiParams);

    if (Array.isArray(lyricData) && lyricData.length > 0 && lyricData[0].lyric) {
        return {
            rawLrc: sanitizeString(lyricData[0].lyric),
            translateLrc: sanitizeString(lyricData[0].tlyric || "")
        };
    }
    return { rawLrc: "", translateLrc: "", error: "Lyric not found or API error." };
}

function updatePlugin() {
    const currentVersion = PYNCPLAYER_VERSION;
    const latestVersion = "1.2.1"; // Hardcoded for now, should fetch from a server in production
    if (currentVersion !== latestVersion) {
        return {
            updateAvailable: true,
            currentVersion,
            latestVersion,
            message: `Update available: ${latestVersion}. Please visit https://meting-api.imixc.top for details.`
        };
    }
    return {
        updateAvailable: false,
        currentVersion,
        message: "Plugin is up to date."
    };
}

function sharePlugin(item, type = "music") {
    if (!item || typeof item !== "object" || !item.id || !["music", "album", "artist", "playlist"].includes(type)) {
        return Promise.resolve({ error: "Invalid item or type for sharing." });
    }

    const userCfg = getUserConfig();
    const source = (item._source && VALID_METING_SOURCES.includes(item._source)) ? item._source : userCfg.METING_SOURCE;

    let shareType;
    switch (type) {
        case "music": shareType = "song"; break;
        case "album": shareType = "album"; break;
        case "artist": shareType = "artist"; break;
        case "playlist": shareType = "playlist"; break;
        default: shareType = "song";
    }

    const shareUrl = `https://meting-api.imixc.top/share?type=${shareType}&id=${item.id}&server=${source}`;

    return Promise.resolve({
        shareUrl,
        title: item.title || item.name || "Unknown",
        source
    });
}

async function importMusicSheet(url) {
    if (!isValidUrl(url)) {
        return Promise.resolve({ error: "Invalid playlist URL." });
    }

    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    let source = null;
    if (hostname.includes("music.163.com")) source = "netease";
    else if (hostname.includes("y.qq.com")) source = "tencent";
    else if (hostname.includes("kuwo.cn")) source = "kuwo";
    else if (hostname.includes("kugou.com")) source = "kugou";
    else return Promise.resolve({ error: "Unsupported playlist source." });

    const idMatch = url.match(/id=(\d+)/) || url.match(/\/(\d+)/);
    if (!idMatch) return Promise.resolve({ error: "Playlist ID not found." });
    const id = idMatch[1];

    const apiParams = {
        server: source
    };

    const playlistData = await callMetingApi(`/playlist/${id}`, apiParams);

    if (!Array.isArray(playlistData) || playlistData.length === 0) {
        return Promise.resolve({ error: "Playlist not found." });
    }

    const playlistItem = formatPlaylistItem(playlistData[0]);
    return Promise.resolve(playlistItem.tracks);
}

// --- Module Exports ---
module.exports = {
    platform: "Meting API v2.0.0",
    version: PYNCPLAYER_VERSION,
    cacheControl: "no-store",
    userVariables: [
        {
            key: "METING_SOURCE",
            name: "Meting Source",
            hint: `Default music source (options: ${VALID_METING_SOURCES.join(', ')}). Default: ${DEFAULT_METING_SOURCE}`
        },
        {
            key: "PROXY_URL",
            name: "Proxy URL (Optional)",
            hint: "e.g., https://yourproxy.com (proxies certain music source links)"
        }
    ],
    hints: {
        general: "Powered by Meting API v2.0.0, supports multiple music sources. Supports music, album, artist, and playlist search and import.",
        importMusicSheet: [
            "Supports playlist URLs from NetEase, Tencent, Kuwo, and Kugou (e.g., https://music.163.com/playlist?id=12345)"
        ]
    },
    supportedSearchType: ["music", "album", "artist", "playlist"],
    search,
    getMusicInfo,
    getMediaSource,
    getLyric,
    importMusicSheet,
    updatePlugin,
    sharePlugin
};
