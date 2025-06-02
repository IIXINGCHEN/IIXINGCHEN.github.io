"use strict";

const axios = require("axios");

const PYNCPLAYER_VERSION = "1.2.0"; // Version bump for major refactor
const pageSize = 30;
const GDSTUDIO_API_BASE = "https://music-api.gdstudio.xyz/api.php";

// --- Internal Helper Functions ---

// Helper to call GD Studio API
async function callGdApi(params) {
    try {
        const response = await axios.get(GDSTUDIO_API_BASE, { params, timeout: 8000 });
        if (response.status === 200 && response.data) {
            // API sometimes returns URL with escaped slashes, fix them.
            if (typeof response.data.url === 'string') {
                response.data.url = response.data.url.replace(/\\\//g, '/');
            }
            return response.data;
        }
        return null;
    } catch (error) {
        // console.error("GD API Call Error:", error.message, "Params:", params);
        return null;
    }
}

let currentEnvConfig = {
    PROXY_URL: null,
    GDSTUDIO_SOURCE: "kuwo", // Default source
};

function getUserConfig() {
    if (typeof global !== 'undefined' && global.lx && global.lx.env && typeof global.lx.env.getUserVariables === 'function') {
        return { ...currentEnvConfig, ...global.lx.env.getUserVariables() };
    }
    return currentEnvConfig;
}

function applyProxy(url, proxyUrl) {
    if (proxyUrl && url && (url.includes("kuwo.cn") || url.includes("migu.cn") || url.includes("music.163.com") || url.includes("isure.stream.qqmusic.qq.com"))) {
        const httpRemovedUrl = url.replace(/^http[s]?:\/\//, "");
        return proxyUrl.replace(/\/$/, "") + "/" + httpRemovedUrl;
    }
    return url;
}

// Main formatting function for song items from GD Studio Search API
function internalFormatMusicItem(apiTrackData) {
    if (!apiTrackData || !apiTrackData.id) {
        return null; // Invalid data
    }

    const artists = Array.isArray(apiTrackData.artist) ? apiTrackData.artist.join('&') : (apiTrackData.artist || "Unknown Artist");
    
    // Duration not directly provided by search, will be 0 unless getMusicInfo enriches it later
    // Or if we assume some default if getMediaSource is called.
    // For now, keep it simple based on search result.
    
    // Artwork URL is not directly in search results, only pic_id.
    // This will be populated by getMusicInfo if needed.
    // For search list, we might leave it empty or use a placeholder.

    return {
        id: String(apiTrackData.id), // track_id
        title: apiTrackData.name || "Unknown Title",
        artist: artists,
        album: apiTrackData.album || "Unknown Album",
        artwork: "", // Will be filled by getMusicInfo using pic_id
        duration: 0, // Search API doesn't provide duration. getMusicInfo might not either.
                       // getMediaSource's underlying API (types=url) doesn't provide duration.
                       // This is a limitation of the GD Studio API for now.

        // Store these for later use by getMusicInfo, getMediaSource, getLyric
        _pic_id: apiTrackData.pic_id,
        _lyric_id: apiTrackData.lyric_id || String(apiTrackData.id), // Lyric ID often same as track ID
        _source: apiTrackData.source, // Source from search result

        qualities: {}, // Simplified, actual playable URL determined by getMediaSource
        content: 0, // Assume playable
        rawLrc: "", // Will be fetched by getLyric
    };
}


// --- Exported Core Functions ---

async function search(query, page = 1, type = "music") {
    if (type !== "music") {
        return Promise.resolve({ isEnd: true, data: [] });
    }
    const userCfg = getUserConfig();
    const apiParams = {
        types: "search",
        source: userCfg.GDSTUDIO_SOURCE,
        name: query,
        count: pageSize,
        pages: page,
    };
    const searchData = await callGdApi(apiParams);

    if (searchData && Array.isArray(searchData)) {
        const formattedResults = searchData.map(track => internalFormatMusicItem(track)).filter(item => item !== null);
        return Promise.resolve({
            isEnd: formattedResults.length < pageSize,
            data: formattedResults,
        });
    }
    return Promise.resolve({ isEnd: true, data: [] });
}

async function getMusicInfo(musicItem) {
    if (!musicItem || !musicItem.id) {
        return Promise.resolve(internalFormatMusicItem({ id: "unknown", name: "Error: Track ID missing" }));
    }

    // MusicItem from search should already have _pic_id, _lyric_id, _source
    // If not (e.g. direct call with only ID), we use defaults.
    const userCfg = getUserConfig();
    const source = musicItem._source || userCfg.GDSTUDIO_SOURCE;
    let pic_id = musicItem._pic_id;

    // If musicItem is minimal (e.g., only has id), we might need to re-search to get pic_id etc.
    // This indicates a potential design flaw if getMusicInfo is called with a bare ID often.
    // For now, assume musicItem has the necessary _* fields from a previous search.
    // If not, pic_id might be undefined.

    let finalItem = { ...musicItem }; // Start with given item

    // If artwork is missing and we have a pic_id, fetch it
    if (!finalItem.artwork && pic_id) {
        const picData = await callGdApi({
            types: "pic",
            source: source,
            id: pic_id,
            // size: "500" // Optional: get larger artwork
        });
        if (picData && picData.url) {
            finalItem.artwork = picData.url;
        }
    }
    
    // Ensure base fields are present even if some ops failed
    finalItem.title = finalItem.title || "Unknown Title";
    finalItem.artist = finalItem.artist || "Unknown Artist";
    finalItem.album = finalItem.album || "Unknown Album";

    // Duration is a known limitation with this API set for music info.
    // getMediaSource might return size, but not duration.
    finalItem.duration = musicItem.duration || 0; 


    return Promise.resolve(finalItem);
}


async function getMediaSource(musicItem, quality) {
    if (!musicItem || !musicItem.id) return Promise.resolve(false);

    const userCfg = getUserConfig();
    const source = musicItem._source || userCfg.GDSTUDIO_SOURCE; // Use source from item or default
    const track_id = musicItem.id;

    // Map abstract quality to GD Studio 'br' values
    let bitrate;
    switch (quality) {
        case "low": bitrate = "128"; break;
        case "standard": bitrate = "320"; break;
        case "high": bitrate = "999"; break; // Assuming 999 is lossless/highest
        case "super": bitrate = "999"; break;
        default: bitrate = "320"; // Default if quality string is unrecognized
    }

    const urlData = await callGdApi({
        types: "url",
        source: source,
        id: track_id,
        br: bitrate,
    });

    if (urlData && urlData.url) {
        const PROXY_URL = userCfg.PROXY_URL;
        return Promise.resolve({
            url: applyProxy(urlData.url, PROXY_URL),
            size: urlData.size ? parseInt(urlData.size, 10) * 1024 : 0, // API gives KB, convert to Bytes
            quality: quality, // Return the requested abstract quality key
            // br: urlData.br, // Optionally return actual bitrate if needed
        });
    }
    return Promise.resolve(false);
}

async function getLyric(musicItem) {
    if (!musicItem || (!musicItem.id && !musicItem._lyric_id)) {
        return Promise.resolve({ rawLrc: "", tlyric: "", info: "Track/Lyric ID missing" });
    }
    
    const userCfg = getUserConfig();
    const source = musicItem._source || userCfg.GDSTUDIO_SOURCE;
    const lyric_id = musicItem._lyric_id || musicItem.id; // Use specific lyric_id or fallback to track_id

    const lyricData = await callGdApi({
        types: "lyric",
        source: source,
        id: lyric_id,
    });

    if (lyricData) {
        return Promise.resolve({
            rawLrc: lyricData.lyric || "",
            translateLrc: lyricData.tlyric || "", // API provides 'tlyric'
        });
    }
    return Promise.resolve({ rawLrc: "", tlyric: "", info: "Lyric not found." });
}

// --- Module Exports ---
module.exports = {
    platform: "pyncmd (GDStudio API)",
    version: PYNCPLAYER_VERSION,
    cacheControl: "no-store", 
    
    userVariables: [
        { 
            key: "GDSTUDIO_SOURCE", 
            name: "GDStudio 音源", 
            hint: "默认音源 (e.g., netease, kuwo, tencent, migu). 当前稳定: netease, kuwo, joox, tidal. 默认: kuwo" 
        },
        { 
            key: "PROXY_URL", 
            name: "反代URL (可选)", 
            hint: "例如: http://yourproxy.com (代理部分音源链接)" 
        }
    ],
    hints: { 
        general: "pyncmd源 (基于GDStudio API). 依赖所选音源的稳定性. 部分音源可能需要代理."
    },
    supportedSearchType: ["music"],

    search,
    getMusicInfo,
    getMediaSource,
    getLyric,
};
