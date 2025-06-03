"use strict";

const axios = require("axios");
const CryptoJs = require("crypto-js");

const PYNCPLAYER_VERSION = "1.2.1";
const pageSize = 30;
const GDSTUDIO_API_BASE = "https://music-api.gdstudio.xyz/api.php";
const NETEASE_API_BASE = "https://interface.music.163.com/e";
const DEFAULT_GDSTUDIO_SOURCE = "kuwo";
const VALID_GDSTUDIO_SOURCES = ["netease", "kuwo"];

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

// --- API Call Helpers ---
async function callGdApi(params) {
    try {
        const response = await axios.get(GDSTUDIO_API_BASE, { params, timeout: 8000 });
        if (response.status === 200 && response.data && typeof response.data === 'object') {
            if (typeof response.data.url === 'string') {
                response.data.url = response.data.url.replace(/\\\//g, '/');
            }
            return response.data;
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function callNetEaseApi(path, json = {}, music_u = "") {
    try {
        let params = [path, JSON.stringify(json)];
        params.push(CryptoJs.MD5("nobody" + params.join("use") + "md5forencrypt").toString(CryptoJs.enc.Hex));
        params = CryptoJs.AES.encrypt(
            params.join("-36cd479b6b5-"),
            CryptoJs.enc.Utf8.parse("e82ckenh8dichen8"),
            { mode: CryptoJs.mode.ECB, padding: CryptoJs.pad.Pkcs7 }
        ).ciphertext.toString(CryptoJs.enc.Hex).toUpperCase();

        const music_a = (music_u || "").match(/MUSIC_[UA]=([^;]+)/i);
        const cookie = music_u ? `os=pc; appver=9.0.25; MUSIC_U=${music_a ? music_a[1] : ""}` : "";

        const response = await axios({
            url: path.replace("/", NETEASE_API_BASE),
            method: "POST",
            data: "params=" + params,
            headers: { cookie },
            timeout: 8000
        });
        return response.data;
    } catch (error) {
        return null;
    }
}

// --- User Config Handling ---
let currentEnvConfig = {
    PROXY_URL: null,
    GDSTUDIO_SOURCE: DEFAULT_GDSTUDIO_SOURCE,
    MUSIC_U: null
};

function getUserConfig() {
    let config = { ...currentEnvConfig };
    if (typeof global !== 'undefined' && global.lx && global.lx.env && typeof global.lx.env.getUserVariables === 'function') {
        const userVars = global.lx.env.getUserVariables();
        if (userVars && typeof userVars === 'object') {
            if (userVars.PROXY_URL && isValidUrl(userVars.PROXY_URL)) {
                config.PROXY_URL = userVars.PROXY_URL;
            }
            if (userVars.GDSTUDIO_SOURCE && VALID_GDSTUDIO_SOURCES.includes(String(userVars.GDSTUDIO_SOURCE).toLowerCase())) {
                config.GDSTUDIO_SOURCE = String(userVars.GDSTUDIO_SOURCE).toLowerCase();
            }
            if (userVars.MUSIC_U && typeof userVars.MUSIC_U === 'string') {
                config.MUSIC_U = sanitizeString(userVars.MUSIC_U);
            }
        }
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
    if (!apiTrackData || typeof apiTrackData !== 'object' || !apiTrackData.id) {
        return null;
    }

    const id = String(apiTrackData.id);
    const title = sanitizeString(apiTrackData.name || apiTrackData.songname, "Unknown Title");
    let artists = "Unknown Artist";
    if (Array.isArray(apiTrackData.artist || apiTrackData.ar)) {
        artists = (apiTrackData.artist || apiTrackData.ar)
            .map(a => sanitizeString(a.name || a))
            .filter(Boolean)
            .join('&') || "Unknown Artist";
    } else if (apiTrackData.artist) {
        artists = sanitizeString(apiTrackData.artist);
    }

    const album = sanitizeString(apiTrackData.album || (apiTrackData.al && apiTrackData.al.name), "Unknown Album");
    const duration = parseInt(apiTrackData.duration_ms || apiTrackData.duration || apiTrackData.dt || 0, 10) || 0;

    return {
        id: id,
        title: title,
        artist: artists,
        album: album,
        artwork: sanitizeString(apiTrackData.artworkUrl || (apiTrackData.al && apiTrackData.al.picUrl), ""),
        duration: duration,
        _pic_id: apiTrackData.pic_id ? String(apiTrackData.pic_id) : null,
        _lyric_id: apiTrackData.lyric_id ? String(apiTrackData.lyric_id) : id,
        _source: apiTrackData.source ? String(apiTrackData.source) : null,
        qualities: {},
        content: (apiTrackData.fee == 0 || apiTrackData.fee == 8) && (apiTrackData.privilege ? apiTrackData.privilege.st > -1 : true) ? 0 : 1,
        rawLrc: sanitizeString(apiTrackData.lyrics, "")
    };
}

// --- Exported Core Functions ---
async function search(query, page = 1, type = "music") {
    if (typeof query !== 'string' || !query.trim()) {
        return Promise.resolve({ isEnd: true, data: [], error: "Invalid search query." });
    }
    if (typeof page !== 'number' || page < 1) page = 1;
    if (type !== "music") {
        return Promise.resolve({ isEnd: true, data: [], error: `Search type "${type}" not supported.` });
    }

    const userCfg = getUserConfig();
    const apiParams = {
        types: "search",
        source: userCfg.GDSTUDIO_SOURCE,
        name: query,
        count: pageSize,
        pages: page
    };
    const searchData = await callGdApi(apiParams);

    if (searchData && Array.isArray(searchData)) {
        const formattedResults = searchData.map(track => internalFormatMusicItem(track)).filter(item => item !== null);
        return Promise.resolve({
            isEnd: formattedResults.length < pageSize,
            data: formattedResults
        });
    }
    return Promise.resolve({ isEnd: true, data: [], error: "Search API request failed or returned invalid data." });
}

async function getMusicInfo(musicItem) {
    if (!musicItem || typeof musicItem !== 'object' || !musicItem.id || typeof musicItem.id !== 'string') {
        return Promise.resolve(internalFormatMusicItem({ id: "unknown", title: "Error: Invalid musicItem input" }));
    }

    const userCfg = getUserConfig();
    const source = (musicItem._source && VALID_GDSTUDIO_SOURCES.includes(musicItem._source)) ? musicItem._source : userCfg.GDSTUDIO_SOURCE;
    let finalItemData = { ...musicItem };

    if (source === "netease") {
        const neteaseData = await callNetEaseApi("/api/v3/song/detail", { c: `[{"id":"${musicItem.id}"}]` }, userCfg.MUSIC_U);
        if (neteaseData && neteaseData.songs && neteaseData.songs[0]) {
            finalItemData = { ...finalItemData, ...neteaseData.songs[0], privilege: neteaseData.privileges[0] };
        }
    } else {
        const songData = await callGdApi({
            types: "song",
            source: source,
            id: musicItem.id
        });
        if (songData) {
            finalItemData = { ...finalItemData, ...songData };
        }
    }

    if (!finalItemData.artwork && finalItemData._pic_id) {
        const picData = await callGdApi({
            types: "pic",
            source: source,
            id: finalItemData._pic_id
        });
        if (picData && isValidUrl(picData.url)) {
            finalItemData.artworkUrl = picData.url;
        }
    }

    const formattedItem = internalFormatMusicItem(finalItemData);
    if (!formattedItem) {
        return Promise.resolve(internalFormatMusicItem({ id: musicItem.id, title: "Error: Failed to process music item." }));
    }
    return Promise.resolve(formattedItem);
}

async function getMediaSource(musicItem, quality) {
    if (!musicItem || typeof musicItem !== 'object' || !musicItem.id || typeof musicItem.id !== 'string') {
        return Promise.resolve({ error: "Invalid musicItem input." });
    }
    if (typeof quality !== 'string') quality = "standard";

    const userCfg = getUserConfig();
    const source = (musicItem._source && VALID_GDSTUDIO_SOURCES.includes(musicItem._source)) ? musicItem._source : userCfg.GDSTUDIO_SOURCE;
    const track_id = musicItem.id;

    let bitrate;
    switch (quality.toLowerCase()) {
        case "low": bitrate = "128"; break;
        case "standard": bitrate = "320"; break;
        case "high": bitrate = "999"; break;
        case "super": bitrate = "999"; break;
        default: bitrate = "320";
    }

    let urlData;
    if (source === "netease") {
        urlData = await callNetEaseApi("/api/song/enhance/player/url/v1", {
            ids: `["${track_id}"]`,
            encodeType: "flac",
            immerseType: "c51",
            trialMode: "23",
            level: { low: "standard", standard: "exhigh", high: "lossless", super: "hires" }[quality] || "exhigh"
        }, userCfg.MUSIC_U);
        if (urlData && urlData.data && urlData.data[0] && isValidUrl(urlData.data[0].url) && urlData.data[0].code !== 404 && urlData.data[0].fee !== 1) {
            return Promise.resolve({
                url: applyProxy(urlData.data[0].url.split("?")[0], userCfg.PROXY_URL),
                size: urlData.data[0].size ? parseInt(urlData.data[0].size, 10) * 1024 : 0,
                quality
            });
        }
    }

    urlData = await callGdApi({
        types: "url",
        source: "kuwo",
        id: track_id,
        br: bitrate
    });

    if (urlData && isValidUrl(urlData.url)) {
        return Promise.resolve({
            url: applyProxy(urlData.url, userCfg.PROXY_URL),
            size: urlData.size ? parseInt(urlData.size, 10) * 1024 : 0,
            quality
        });
    }
    return Promise.resolve({ error: "Failed to get media source or invalid URL returned." });
}

async function getLyric(musicItem) {
    if (!musicItem || typeof musicItem !== 'object' || (!musicItem.id && !musicItem._lyric_id)) {
        return Promise.resolve({ rawLrc: "", tlyric: "", error: "Invalid musicItem input." });
    }

    const userCfg = getUserConfig();
    const source = (musicItem._source && VALID_GDSTUDIO_SOURCES.includes(musicItem._source)) ? musicItem._source : userCfg.GDSTUDIO_SOURCE;
    const lyric_id = musicItem._lyric_id || musicItem.id;

    if (!lyric_id) {
        return Promise.resolve({ rawLrc: "", tlyric: "", error: "Lyric ID missing." });
    }

    let lyricData;
    if (source === "netease") {
        lyricData = await callNetEaseApi("/api/song/lyric", {
            id: lyric_id,
            lv: -1,
            kv: -1,
            tv: -1
        }, userCfg.MUSIC_U);
        if (lyricData && lyricData.lrc && typeof lyricData.lrc.lyric === 'string') {
            return Promise.resolve({
                rawLrc: sanitizeString(lyricData.lrc.lyric),
                tlyric: sanitizeString(lyricData.tlyric ? lyricData.tlyric.lyric : "")
            });
        }
    }

    lyricData = await callGdApi({
        types: "lyric",
        source: source,
        id: lyric_id
    });

    if (lyricData && (typeof lyricData.lyric === 'string' || typeof lyricData.tlyric === 'string')) {
        return Promise.resolve({
            rawLrc: sanitizeString(lyricData.lyric),
            tlyric: sanitizeString(lyricData.tlyric)
        });
    }
    return Promise.resolve({ rawLrc: "", tlyric: "", error: "Lyric not found or API error." });
}

// --- Module Exports ---
module.exports = {
    platform: "NetEase & Kuwo (GDStudio API Secure)",
    version: PYNCPLAYER_VERSION,
    cacheControl: "no-store",
    userVariables: [
        {
            key: "GDSTUDIO_SOURCE",
            name: "音源",
            hint: `默认音源 (可选: ${VALID_GDSTUDIO_SOURCES.join(', ')}). 默认: ${DEFAULT_GDSTUDIO_SOURCE}`
        },
        {
            key: "PROXY_URL",
            name: "反代URL (可选)",
            hint: "例如: https://yourproxy.com (代理部分音源链接)"
        },
        {
            key: "MUSIC_U",
            name: "网易云用户数据 (cookie)",
            hint: "MUSIC_U 或 MUSIC_A"
        }
    ],
    hints: {
        general: "基于GDStudio API，支持网易云和酷我音源。部分功能依赖MUSIC_U cookie。"
    },
    supportedSearchType: ["music"],
    search,
    getMusicInfo,
    getMediaSource,
    getLyric
};
