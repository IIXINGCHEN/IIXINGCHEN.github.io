"use strict";

const axios = require("axios");

const PYNCPLAYER_VERSION = "1.2.6";
const pageSize = 20;
const METING_API_BASE = "https://meting-api.imixc.top/api.php";
const DEFAULT_METING_SOURCE = "netease";
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
    if (typeof str === 'number') { // Handle cases where a field might unexpectedly be a number
        return String(str).trim();
    }
    return defaultVal;
}

// --- API Call Helper ---
async function callMetingApi(endpoint, params = {}) {
    try {
        const response = await axios.get(METING_API_BASE + endpoint, { params, timeout: 8000 });

        if (response.status === 200 && response.data && typeof response.data === 'object') {
            if (response.data.success === true) {
                const apiData = response.data.data;
                // Check for { data: { results: [...] } } structure (primarily for /search)
                if (apiData && typeof apiData === 'object' && Array.isArray(apiData.results)) {
                    return apiData.results;
                }
                // Check for { data: [...] } structure (for /song, /url, /lyric, /playlist)
                if (Array.isArray(apiData)) {
                    return apiData;
                }
                // Fallback for success:true but unexpected data structure or empty data
                return [];
            } else {
                // API explicitly stated failure (e.g., response.data.success === false)
                return { error: response.data.error || "API request failed with no specific error message." };
            }
        }
        // Handle cases where response.status is not 200 or response.data is not a valid object
        return { error: `Invalid API response status: ${response.status} or malformed response body.` };
    } catch (error) {
        let errorMessage = "Network error or API unreachable.";
        if (error.isAxiosError) {
            if (error.response) {
                const apiErrorMsg = (error.response.data && typeof error.response.data.error === 'string') ? error.response.data.error : JSON.stringify(error.response.data);
                errorMessage = `API request failed with status ${error.response.status}: ${apiErrorMsg || error.response.statusText}`;
            } else if (error.request) {
                errorMessage = "No response received from API. Check network or API server status.";
            } else {
                errorMessage = error.message || "Axios request setup error.";
            }
        } else {
             errorMessage = error.message || "An unknown error occurred during the API call.";
        }
        return { error: errorMessage };
    }
}

// --- User Config Handling ---
let currentEnvConfig = { // This is not used if global.lx.env is available
    PROXY_URL: null,
    METING_SOURCE: DEFAULT_METING_SOURCE
};

function getUserConfig() {
    // Prioritize global.lx.env if available
    if (typeof global !== 'undefined' && global.lx && global.lx.env && typeof global.lx.env.getUserVariables === 'function') {
        const userVars = global.lx.env.getUserVariables();
        const config = { PROXY_URL: null, METING_SOURCE: DEFAULT_METING_SOURCE }; // Start with defaults
        if (userVars && typeof userVars === 'object') {
            if (userVars.PROXY_URL && isValidUrl(userVars.PROXY_URL)) {
                config.PROXY_URL = userVars.PROXY_URL;
            }
            if (userVars.METING_SOURCE && VALID_METING_SOURCES.includes(String(userVars.METING_SOURCE).toLowerCase())) {
                config.METING_SOURCE = String(userVars.METING_SOURCE).toLowerCase();
            }
        }
        return config;
    }
    // Fallback to currentEnvConfig if global.lx.env is not available (e.g. standalone testing)
    // For this example, assuming it should always try to read from a dynamic source if possible,
    // and currentEnvConfig is more of a conceptual fallback or for non-lx environments.
    // If global.lx.env is the *only* intended source, this part could be error or fixed defaults.
    return { ...currentEnvConfig }; // Or a more robust default if global.lx.env is expected
}


function applyProxy(url, proxyUrl) {
    if (proxyUrl && isValidUrl(proxyUrl) && url && isValidUrl(url) &&
        (url.includes("kuwo.cn") || url.includes("music.163.com"))) { // Add other domains if needed
        const httpRemovedUrl = url.replace(/^http[s]?:\/\//, "");
        return proxyUrl.replace(/\/$/, "") + "/" + httpRemovedUrl;
    }
    return url;
}

// --- Internal Formatting ---
function formatArtistName(artistData) {
    if (Array.isArray(artistData)) {
        return artistData.map(a => sanitizeString(typeof a === 'object' && a.name ? a.name : a)).filter(Boolean).join('&');
    }
    return sanitizeString(typeof artistData === 'object' && artistData.name ? artistData.name : artistData, "Unknown Artist");
}

function internalFormatMusicItem(apiTrackData) {
    if (!apiTrackData || typeof apiTrackData !== 'object' || !apiTrackData.id) {
        return null;
    }

    return {
        id: String(apiTrackData.id),
        title: sanitizeString(apiTrackData.name, "Unknown Title"),
        artist: formatArtistName(apiTrackData.artist), // Use helper for artist name
        album: sanitizeString(apiTrackData.album, "Unknown Album"),
        // Assuming 'picture' is the correct field from API for artwork. If it's pic_id, logic needs to change.
        artwork: sanitizeString(apiTrackData.picture || apiTrackData.pic_id || apiTrackData.pic, ""), // Try common variants for picture
        duration: parseInt(apiTrackData.duration || 0, 10) || 0,
        _lyric_id: apiTrackData.lyric_id ? String(apiTrackData.lyric_id) : (apiTrackData.id ? String(apiTrackData.id) : null), // Fallback lyric_id to id
        _source: apiTrackData.source ? String(apiTrackData.source) : null,
        qualities: {}, // This seems to be populated later or by the player
        content: 0, // Assuming 0 for music type
        rawLrc: "" // Populated by getLyric
    };
}

function formatAlbumItem(apiAlbumData) {
    if (!apiAlbumData || typeof apiAlbumData !== 'object' || !apiAlbumData.id) {
        return null;
    }

    return {
        id: String(apiAlbumData.id),
        title: sanitizeString(apiAlbumData.name, "Unknown Album"),
        artist: formatArtistName(apiAlbumData.artist), // Use helper for artist name
        artwork: sanitizeString(apiAlbumData.picture || apiAlbumData.pic_id || apiAlbumData.pic, ""),
        description: sanitizeString(apiAlbumData.description, ""),
        date: sanitizeString(apiAlbumData.publish_date || apiAlbumData.time, ""), // common variants for date
        worksNum: parseInt(apiAlbumData.song_count || apiAlbumData.size || 0, 10), // common variants for count
        content: 4 // Assuming 4 for album type
    };
}

function formatArtistItem(apiArtistData) {
    if (!apiArtistData || typeof apiArtistData !== 'object' || !apiArtistData.id) {
        return null;
    }

    return {
        id: String(apiArtistData.id),
        name: sanitizeString(apiArtistData.name, "Unknown Artist"), // Artist item primarily has a name
        artwork: sanitizeString(apiArtistData.picture || apiArtistData.pic_id || apiArtistData.pic, ""),
        description: sanitizeString(apiArtistData.description, ""),
        worksNum: parseInt(apiArtistData.song_count || apiArtistData.album_size || 0, 10), // common variants
        content: 5 // Assuming 5 for artist type
    };
}

function formatPlaylistItem(apiPlaylistData) {
    if (!apiPlaylistData || typeof apiPlaylistData !== 'object' || !apiPlaylistData.id) {
        return null;
    }

    const tracks = Array.isArray(apiPlaylistData.songs)
        ? apiPlaylistData.songs.map(track => internalFormatMusicItem(track)).filter(item => item !== null)
        : [];

    return {
        id: String(apiPlaylistData.id),
        title: sanitizeString(apiPlaylistData.name, "Unknown Playlist"),
        creator: sanitizeString(apiPlaylistData.creator?.nickname || apiPlaylistData.creator, "Unknown Creator"), // Handle creator object
        artwork: sanitizeString(apiPlaylistData.picture || apiPlaylistData.coverImgUrl || apiPlaylistData.pic_id || apiPlaylistData.pic, ""),
        description: sanitizeString(apiPlaylistData.description, ""),
        worksNum: tracks.length || parseInt(apiPlaylistData.song_count || apiPlaylistData.trackCount || 0, 10),
        content: 2, // Assuming 2 for playlist type
        tracks: tracks
    };
}

// --- Exported Core Functions ---
async function search(query, page = 1, type = "music") {
    if (typeof query !== 'string' || !query.trim()) {
        return Promise.resolve({ isEnd: true, data: [], error: "Invalid search query." });
    }
    if (typeof page !== 'number' || page < 1) page = 1;

    // Based on simulated调研, /search endpoint primarily returns songs and doesn't effectively filter by API type param.
    // So, we only proceed if type is "music". For other types, this endpoint is not suitable.
    if (type !== "music") {
        // console.warn(`Search type "${type}" is not effectively supported by the API's /search endpoint. Returning empty.`);
        return Promise.resolve({ isEnd: true, data: [], error: `Search for type "${type}" is not supported via this general search. Try specific import/lookup if available.` });
    }

    const userCfg = getUserConfig();
    const source = userCfg.METING_SOURCE || DEFAULT_METING_SOURCE;
    const limit = pageSize; // pageSize for one page
    // Meting API's /search endpoint might not directly support 'offset' parameter.
    // The original code fetched 'limit + offset' items and then sliced.
    // Let's assume the API returns enough items if we just ask for 'limit' for current page,
    // or we stick to fetching more and slicing. The current Meting API seems to use 'page' and 'limit'.
    // For this example, we'll keep the client-side slice logic for pagination.
    // A more robust solution would be to confirm API's pagination params (e.g., page, limit).
    // The provided API sample shows 'limit' in response, implying it's a request param.
    // If API supports 'page', then 'offset' calculation is (page - 1) * limit.
    // For now, sticking to original plugin's pagination approach if API 'offset' is unconfirmed.
    const fetchLimit = limit * page; // Fetch all items up to the current page to simulate full list then slice

    const apiParams = {
        q: query,
        server: source,
        limit: fetchLimit // Fetch up to 'page * pageSize' items
        // type: type, // Removed as per调研, API's /search doesn't use this effectively for filtering other types
    };

    const searchData = await callMetingApi("/search", apiParams);

    if (searchData.error) {
        return Promise.resolve({ isEnd: true, data: [], error: searchData.error });
    }

    if (!Array.isArray(searchData)) { // Should be an array from callMetingApi
        return Promise.resolve({ isEnd: true, data: [], error: "Invalid data format from API search." });
    }
    
    // Client-side pagination: slice the results for the current page
    const offset = (page - 1) * limit;
    const slicedData = searchData.slice(offset, offset + limit);

    let formattedResults = [];
    // Since we decided 'search' primarily handles 'music' type:
    if (type === "music") {
        formattedResults = slicedData
            .map(item => internalFormatMusicItem(item)) // No 'item.type' check, assume all are songs
            .filter(item => item !== null);
    }
    // Other types (album, artist, playlist) are pre-filtered out.
    // If API /search could return mixed types with a 'type' field, the switch would be here.

    return Promise.resolve({
        isEnd: slicedData.length < limit || (offset + slicedData.length) >= searchData.length, // isEnd if current slice is less than pageSize or we've reached end of total fetched
        data: formattedResults
    });
}

async function getMusicInfo(musicItem) {
    if (!musicItem || typeof musicItem !== 'object' || !musicItem.id || typeof musicItem.id !== 'string') {
        return Promise.resolve(internalFormatMusicItem({ id: "unknown", name: "Error: Invalid musicItem input" })); // Matched name field
    }

    const userCfg = getUserConfig();
    const source = (musicItem._source && VALID_METING_SOURCES.includes(musicItem._source)) ? musicItem._source : userCfg.METING_SOURCE;

    const apiParams = {
        server: source
    };

    const songDataArray = await callMetingApi(`/song/${musicItem.id}`, apiParams);

    if (songDataArray.error) {
        return Promise.resolve(internalFormatMusicItem({ id: musicItem.id, name: `Error: ${songDataArray.error}` }));
    }

    if (!Array.isArray(songDataArray) || songDataArray.length === 0) {
        return Promise.resolve(internalFormatMusicItem({ id: musicItem.id, name: "Error: Song not found or API error" }));
    }

    const formattedItem = internalFormatMusicItem(songDataArray[0]);
    return Promise.resolve(formattedItem);
}

async function getMediaSource(musicItem, quality) {
    if (!musicItem || typeof musicItem !== 'object' || !musicItem.id || typeof musicItem.id !== 'string') {
        return Promise.resolve({ error: "Invalid musicItem input." });
    }
    if (typeof quality !== 'string') quality = "standard"; // Default quality

    const userCfg = getUserConfig();
    const source = (musicItem._source && VALID_METING_SOURCES.includes(musicItem._source)) ? musicItem._source : userCfg.METING_SOURCE;

    let bitrate; // API expects bitrate as string
    switch (quality.toLowerCase()) {
        case "low": bitrate = "128000"; break; // Example bitrates, API might expect specific values
        case "standard": bitrate = "320000"; break;
        case "high": bitrate = "flac"; break; // Or "999000" or "ape" or "wav"
        case "super": bitrate = "flac"; break; // Or highest available
        default: bitrate = "320000";
    }
     // The original code had different bitrate values like "128", "320", "999".
     // Meting API (e.g. Netease) might expect 'br' param like 128000, 320000, or specific values like 'flac'.
     // For demo, using original logic's implied values.
    switch (quality.toLowerCase()) {
        case "low": bitrate = "128"; break;
        case "standard": bitrate = "320"; break;
        case "high": bitrate = "999"; break; // '999' often means highest/lossless in some Meting wrappers
        case "super": bitrate = "999"; break;
        default: bitrate = "320";
    }


    const apiParams = {
        server: source,
        bitrate: bitrate // Or 'br': bitrate, check API spec
    };
    // API endpoint for URL is often /song/url or just /url. Original had /url/:id
    const urlDataArray = await callMetingApi(`/url/${musicItem.id}`, apiParams);


    if (urlDataArray.error) {
        return Promise.resolve({ error: urlDataArray.error });
    }

    if (!Array.isArray(urlDataArray) || urlDataArray.length === 0 || !urlDataArray[0].url) {
        return Promise.resolve({ error: "Failed to get media source or invalid URL returned." });
    }
    
    const urlDataItem = urlDataArray[0];

    return Promise.resolve({
        url: applyProxy(sanitizeString(urlDataItem.url), userCfg.PROXY_URL),
        size: urlDataItem.size ? parseInt(urlDataItem.size, 10) : 0, // API might return size in bytes or KB
        quality: quality,
        br: urlDataItem.br || null // Actual bitrate from API
    });
}

async function getLyric(musicItem) {
    if (!musicItem || typeof musicItem !== 'object' || (!musicItem.id && !musicItem._lyric_id)) {
        return Promise.resolve({ rawLrc: "", translateLrc: "", error: "Invalid musicItem input." });
    }

    const userCfg = getUserConfig();
    const source = (musicItem._source && VALID_METING_SOURCES.includes(musicItem._source)) ? musicItem._source : userCfg.METING_SOURCE;
    const lyric_id = musicItem._lyric_id || musicItem.id; // Use specific lyric_id if available

    const apiParams = {
        server: source
        // id: lyric_id // Some Meting APIs might take id in params for lyric
    };

    const lyricDataArray = await callMetingApi(`/lyric/${lyric_id}`, apiParams);

    if (lyricDataArray.error) {
        return Promise.resolve({ rawLrc: "", translateLrc: "", error: lyricDataArray.error });
    }

    if (!Array.isArray(lyricDataArray) || lyricDataArray.length === 0) {
        return Promise.resolve({ rawLrc: "", translateLrc: "", error: "Lyric not found or API error." });
    }

    const lyricDataItem = lyricDataArray[0];
    return Promise.resolve({
        rawLrc: sanitizeString(lyricDataItem.lyric || lyricDataItem.lrc || ""),
        translateLrc: sanitizeString(lyricDataItem.tlyric || lyricDataItem.translation || "")
    });
}

function updatePlugin() { // This is a stub, real update check would be async and against a server
    const currentVersion = PYNCPLAYER_VERSION;
    // In a real scenario, this would be fetched from a remote version manifest
    const latestVersion = PYNCPLAYER_VERSION; // Hardcoded, assuming this is the "latest" for now.
    if (currentVersion !== latestVersion) {
        // console.log("Update available logic triggered");
        return {
            updateAvailable: true,
            currentVersion,
            latestVersion,
            message: `Update available: ${latestVersion}. Please visit plugin source for details.` // Generic message
        };
    }
    return {
        updateAvailable: false,
        currentVersion,
        message: "Plugin is up to date."
    };
}

function sharePlugin(item, type = "music") { // This function is a stub without a real sharing backend
    if (!item || typeof item !== "object" || !item.id || !["music", "album", "artist", "playlist"].includes(type)) {
        return Promise.resolve({ error: "Invalid item or type for sharing." });
    }

    const userCfg = getUserConfig();
    const source = (item._source && VALID_METING_SOURCES.includes(item._source)) ? item._source : userCfg.METING_SOURCE;

    let shareType;
    switch (type) {
        case "music": shareType = "song"; break;
        // Meting standard types for sharing might be different
        case "album": shareType = "album"; break;
        case "artist": shareType = "artist"; break;
        case "playlist": shareType = "playlist"; break; // or "list"
        default: shareType = "song";
    }

    // Example share URL, replace with actual Meting share URL structure if known
    const shareUrl = `https://music.163.com/#/${shareType}?id=${item.id}`; // Example for Netease
    // Or a generic one if Meting API has a share link generator:
    // const shareUrl = `${METING_API_BASE}/share?type=${shareType}&id=${item.id}&server=${source}`;


    return Promise.resolve({
        shareUrl,
        title: sanitizeString(item.title || item.name, "Unknown Item"),
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
    let id = null;

    // Basic URL parsing for common platforms
    if (hostname.includes("music.163.com")) {
        source = "netease";
        const match = urlObj.searchParams.get('id') || url.match(/playlist\/(\d+)/i)?.[1] || url.match(/album\/(\d+)/i)?.[1];
        if (match) id = match;
    } else if (hostname.includes("y.qq.com")) {
        source = "tencent";
        const match = url.match(/playsquare\/([a-zA-Z0-9]+)/i)?.[1] || url.match(/playlist\/([0-9]+)/i)?.[1] || urlObj.searchParams.get('id');
        if (match) id = match;
    } else if (hostname.includes("kuwo.cn")) {
        source = "kuwo";
        const match = url.match(/playlist\/([0-9]+)/i)?.[1] || url.match(/album\/([0-9]+)/i)?.[1];
        if (match) id = match;
    } else if (hostname.includes("kugou.com")) {
        source = "kugou";
        const match = url.match(/special\/single\/([0-9]+)/i)?.[1] || url.match(/album\/single\/([0-9]+)/i)?.[1] || urlObj.searchParams.get('id');
        if (match) id = match;
    } else {
        return Promise.resolve({ error: "Unsupported playlist source or无法识别的URL格式." });
    }

    if (!id) return Promise.resolve({ error: "Playlist ID not found in URL." });
    if (!source) return Promise.resolve({ error: "Could not determine source from URL."});


    const apiParams = {
        server: source
        // id: id // ID is part of the endpoint path
    };

    // API endpoint for playlist is often /playlist or /list
    const playlistDataArray = await callMetingApi(`/playlist/${id}`, apiParams);

    if (playlistDataArray.error) {
        return Promise.resolve({ error: playlistDataArray.error });
    }

    if (!Array.isArray(playlistDataArray) || playlistDataArray.length === 0) {
        return Promise.resolve({ error: "Playlist not found or API error." });
    }

    const playlistItem = formatPlaylistItem(playlistDataArray[0]); // Assuming API returns an array with one playlist object
    
    if (!playlistItem) { // formatPlaylistItem could return null
        return Promise.resolve({ error: "Failed to format playlist data."});
    }
    return Promise.resolve(playlistItem.tracks); // Return only the tracks array as per original spec
}

// --- Module Exports ---
module.exports = {
    platform: "Meting API v2.0.0 (Enhanced by AI)",
    version: PYNCPLAYER_VERSION, // Consider updating if significant changes
    cacheControl: "no-store", // Or 'public, max-age=3600' if API data is cacheable
    userVariables: [
        {
            key: "METING_SOURCE",
            name: "Meting 音乐源", // Chinese name
            hint: `默认音乐源 (可选: ${VALID_METING_SOURCES.join(', ')})。默认: ${DEFAULT_METING_SOURCE}`
        },
        {
            key: "PROXY_URL",
            name: "代理服务器 URL (可选)", // Chinese name
            hint: "例如: https://yourproxy.com (代理特定音乐源链接，如网易云、酷我)"
        }
    ],
    hints: {
        general: "由 Meting API v2.0.0 强力驱动，支持多音乐源。支持音乐搜索，以及歌单、专辑、艺术家信息获取（具体支持程度依赖API）。",
        importMusicSheet: [
            "支持网易云音乐、QQ音乐、酷我音乐、酷狗音乐的歌单链接 (例如: https://music.163.com/playlist?id=12345)"
        ]
    },
    supportedSearchType: ["music"], // Reflecting that search is now primarily for 'music'
    search,
    getMusicInfo,
    getMediaSource,
    getLyric,
    importMusicSheet,
    updatePlugin,
    sharePlugin
};
