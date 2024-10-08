'use strict'
/**
 * static files (404.html, sw.js, conf.js)
 */
const ASSET_URL = 'https://iixingchen.github.io/'
// 前缀，如果自定义路由为example.com/gh/*，将PREFIX改为 '/gh/'，注意，少一个杠都会错！
const PREFIX = '/'
const Config = {
    jsdelivr: 1,
    gitclone: 1
}

/** @type {RequestInit} */
const PREFLIGHT_INIT = {
    status: 204,
    headers: new Headers({
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS',
        'access-control-max-age': '1728000',
    }),
}

const GITHUB_RELEASES_ARCHIVE_REGEX = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:releases|archive)\/.*$/i
const GITHUB_BLOB_RAW_REGEX = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:blob|raw)\/.*$/i
const GITHUB_INFO_GIT_REGEX = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:info|git-).*$/i
const GITHUB_RAW_CONTENT_REGEX = /^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+$/i
const GITHUB_GIST_REGEX = /^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+$/i
const GITHUB_TAGS_REGEX = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tags.*$/i

/**
 * @param {any} body
 * @param {number} status
 * @param {Object<string, string>} headers
 */
function makeRes(body, status = 200, headers = {}) {
    headers['access-control-allow-origin'] = '*'
    return new Response(body, { status, headers })
}

/**
 * @param {string} urlStr
 */
function newUrl(urlStr) {
    try {
        return new URL(urlStr)
    } catch (err) {
        return null
    }
}

addEventListener('fetch', e => {
    const ret = fetchHandler(e)
        .catch(err => makeRes('cfworker error:\n' + err.stack, 502))
    e.respondWith(ret)
})

function checkUrl(u) {
    for (let i of [GITHUB_RELEASES_ARCHIVE_REGEX, GITHUB_BLOB_RAW_REGEX, GITHUB_INFO_GIT_REGEX, GITHUB_RAW_CONTENT_REGEX, GITHUB_GIST_REGEX, GITHUB_TAGS_REGEX]) {
        if (i.test(u)) {
            return true
        }
    }
    return false
}

// 创建一个生成器函数，用于生成随机的GitHub加速网站目标URL
const TARGET_URLS = 'https://gh.duckcc.com,https://git.gushao.club'; // 替换为实际的URL
const targetUrls = TARGET_URLS.split(',');

function* urlGenerator() {
    while (true) {
        const randomIndex = Math.floor(Math.random() * targetUrls.length);
        yield targetUrls[randomIndex];
    }
}

const getNextUrl = urlGenerator();

// 创建一个生成器函数，用于生成随机的GitHub URL
const GH_URLS = 'https://github.q2zy.com,https://gitclone.com'; // 替换为实际的URL
const GHUrls = GH_URLS.split(',');

function* urlgh() {
    while (true) {
        const randomIndex = Math.floor(Math.random() * GHUrls.length);
        yield GHUrls[randomIndex];
    }
}

const ghUrl = urlgh();

/**
 * @param {FetchEvent} e
 */
async function fetchHandler(e) {
    const req = e.request
    const urlStr = req.url
    const urlObj = new URL(urlStr)
    let path = urlObj.searchParams.get('q')
    if (path) {
        return Response.redirect('https://' + urlObj.host + PREFIX + path, 301)
    }
    // cfworker 会把路径中的 `//` 合并成 `/`
    path = urlObj.href.substr(urlObj.origin.length).replace(/^\/+/, '')
    if (GITHUB_RELEASES_ARCHIVE_REGEX.test(path) || GITHUB_GIST_REGEX.test(path) || GITHUB_TAGS_REGEX.test(path) || (!Config.gitclone && (GITHUB_INFO_GIT_REGEX.test(path) || GITHUB_RAW_CONTENT_REGEX.test(path)))) {
        const newUrl = `${getNextUrl.next().value}/${path}`;
        return fetch(newUrl).then(response => new Response(response.body, {
            status: response.status,
            headers: response.headers
        }));
    } else if (GITHUB_BLOB_RAW_REGEX.test(path)) {
        if (Config.jsdelivr) {
            const newUrl = path.replace('/blob/', '@').replace(/^(?:https?:\/\/)?github\.com/, 'https://cdn.jsdmirror.com/gh')
            return Response.redirect(newUrl, 302)
        } else {
            path = path.replace('/blob/', '/raw/')
            return httpHandler(req, path)
        }
    } else if (GITHUB_INFO_GIT_REGEX.test(path)) {
        const newUrl = path.replace(/^(?:https?:\/\/)?github\.com/, ghUrl.next().value);
        return Response.redirect(newUrl, 302)
    } else if (GITHUB_RAW_CONTENT_REGEX.test(path)) {
        const newUrl = path.replace(/(?<=com\/.+?\/.+?)\/(.+?\/)/, '@$1').replace(/^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com/, 'https://cdn.jsdmirror.com/gh')
        return Response.redirect(newUrl, 302)
    } else {
        return fetch(ASSET_URL + path)
    }
}

/**
 * @param {Request} req
 * @param {string} pathname
 */
function httpHandler(req, pathname) {
    const reqHdrRaw = req.headers

    // preflight
    if (req.method === 'OPTIONS' &&
        reqHdrRaw.has('access-control-request-headers')
    ) {
        return new Response(null, PREFLIGHT_INIT)
    }

    const reqHdrNew = new Headers(reqHdrRaw)

    let urlStr = pathname
    if (urlStr.startsWith('github')) {
        urlStr = 'https://' + urlStr
    }
    const urlObj = newUrl(urlStr)
    if (!urlObj) {
        return makeRes('Invalid URL', 400)
    }

    /** @type {RequestInit} */
    const reqInit = {
        method: req.method,
        headers: reqHdrNew,
        redirect: 'manual',
        body: req.body
    }
    return proxy(urlObj, reqInit)
}

/**
 *
 * @param {URL} urlObj
 * @param {RequestInit} reqInit
 */
async function proxy(urlObj, reqInit) {
    const res = await fetch(urlObj.href, reqInit)
    const resHdrOld = res.headers
    const resHdrNew = new Headers(resHdrOld)

    const status = res.status

    if (resHdrNew.has('location')) {
        let _location = resHdrNew.get('location')
        if (checkUrl(_location))
            resHdrNew.set('location', PREFIX + _location)
        else {
            reqInit.redirect = 'follow'
            return proxy(newUrl(_location), reqInit)
        }
    }
    resHdrNew.set('access-control-expose-headers', '*')
    resHdrNew.set('access-control-allow-origin', '*')

    resHdrNew.delete('content-security-policy')
    resHdrNew.delete('content-security-policy-report-only')
    resHdrNew.delete('clear-site-data')

    return new Response(res.body, {
        status,
        headers: resHdrNew,
    })
}
