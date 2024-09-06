'use strict';

/**
 * Static files (404.html, sw.js, conf.js)
 */
const ASSET_URL = 'https://iixingchen.github.io';
const PREFIX = '/';
const Config = {
    jsdelivr: 1,
    gitclone: 1
};

const PREFLIGHT_INIT = {
    status: 204,
    headers: new Headers({
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS',
        'access-control-max-age': '1728000',
    }),
};

const URL_REGEXES = [
    /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:releases|archive)\/.*$/i,
    /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:blob|raw)\/.*$/i,
    /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:info|git-).*$/i,
    /^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+$/i,
    /^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+$/i,
    /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tags.*$/i,
    /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tree\/.*$/i // 添加tree路径的正则表达式
];

/**
 * @param {any} body
 * @param {number} status
 * @param {Object<string, string>} headers
 */
function createResponse(body, status = 200, headers = {}) {
    headers['access-control-allow-origin'] = '*';
    return new Response(body, { status, headers });
}

/**
 * @param {string} urlStr
 */
function parseUrl(urlStr) {
    try {
        return new URL(urlStr);
    } catch (err) {
        return null;
    }
}

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event).catch(err => createResponse('cfworker error:\n' + err.stack, 502)));
});

function isValidGitHubUrl(url) {
    return URL_REGEXES.some(regex => regex.test(url));
}

const TARGET_URLS = 'https://mirror.ghproxy.com,https://gh.duckcc.com,https://git.gushao.club';
const targetUrls = TARGET_URLS.split(',');

function* urlGenerator() {
    if (targetUrls.length === 0) {
        throw new Error('No target URLs available');
    }
    let count = 0;
    while (count < 10) { // 限制生成次数
        const randomIndex = Math.floor(Math.random() * targetUrls.length);
        yield targetUrls[randomIndex];
        count++;
    }
}

const getNextUrl = urlGenerator();

const GH_URLS = 'https://github.q2zy.com,https://gitclone.com';
const GHUrls = GH_URLS.split(',');

function* ghUrlGenerator() {
    if (GHUrls.length === 0) {
        throw new Error('No GH URLs available');
    }
    let count = 0;
    while (count < 10) { // 限制生成次数
        const randomIndex = Math.floor(Math.random() * GHUrls.length);
        yield GHUrls[randomIndex];
        count++;
    }
}

const getNextGhUrl = ghUrlGenerator();

const JSDELIVR_URLS = [
    'https://cdn.jsdmirror.com/gh',
    'https://cdn.jsdelivr.net/gh',
    'https://fastly.jsdelivr.net/gh',
    'https://gcore.jsdelivr.net/gh',
    'https://testingcf.jsdelivr.net/gh'
];

function* jsdelivrUrlGenerator() {
    if (JSDELIVR_URLS.length === 0) {
        throw new Error('No JSDELIVR URLs available');
    }
    let count = 0;
    while (count < 10) { // 限制生成次数
        const randomIndex = Math.floor(Math.random() * JSDELIVR_URLS.length);
        yield JSDELIVR_URLS[randomIndex];
        count++;
    }
}

const getNextJsdelivrUrl = jsdelivrUrlGenerator();

/**
 * @param {FetchEvent} event
 */
async function handleRequest(event) {
    try {
        const request = event.request;
        const urlStr = request.url;
        const urlObj = new URL(urlStr);
        let path = urlObj.searchParams.get('q');

        if (path) {
            if (!path.startsWith(PREFIX)) {
                return Response.redirect('https://' + urlObj.host + PREFIX + path, 301);
            }
        }

        path = urlObj.pathname + urlObj.search;
        path = path.startsWith(PREFIX) ? path.substr(PREFIX.length) : path;

        if (isValidGitHubUrl(path)) {
            const newUrl = `${getNextUrl.next().value}/${path}`;
            return fetch(newUrl).then(response => new Response(response.body, {
                status: response.status,
                headers: response.headers
            }));
        } else if (/^github\.com\/.+?\/.+?\/blob\/.*$/.test(path)) {
            if (Config.jsdelivr) {
                const newUrl = path.replace('/blob/', '@').replace(/^(?:https?:\/\/)?github\.com/, getNextJsdelivrUrl.next().value);
                return Response.redirect(newUrl, 302);
            } else {
                path = path.replace('/blob/', '/raw/');
                return handleHttp(request, path);
            }
        } else if (/^github\.com\/.+?\/.+?\/info\/.*$/.test(path)) {
            const newUrl = path.replace(/^(?:https?:\/\/)?github\.com/, getNextGhUrl.next().value);
            return Response.redirect(newUrl, 302);
        } else if (/^raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+$/.test(path)) {
            const newUrl = path.replace(/(?<=com\/.+?\/.+?)\/(.+?\/)/, '@$1').replace(/^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com/, getNextJsdelivrUrl.next().value);
            return Response.redirect(newUrl, 302);
        } else {
            const assetUrlObj = new URL(ASSET_URL);
            assetUrlObj.pathname = path;
            return fetch(assetUrlObj.toString());
        }
    } catch (err) {
        console.error('cfworker error:', err.stack); // 增加日志记录
        return createResponse('cfworker error:\n' + err.stack, 502);
    }
}

/**
 * @param {Request} request
 * @param {string} pathname
 */
function handleHttp(request, pathname) {
    const reqHeaders = new Headers(request.headers);

    if (request.method === 'OPTIONS' && reqHeaders.has('access-control-request-headers')) {
        return new Response(null, PREFLIGHT_INIT);
    }

    let urlStr = pathname;
    if (urlStr.startsWith('github')) {
        urlStr = 'https://' + urlStr;
    }
    const urlObj = parseUrl(urlStr);
    if (!urlObj) {
        return createResponse('Invalid URL', 400);
    }

    const requestInit = {
        method: request.method,
        headers: reqHeaders,
        redirect: 'manual',
        body: request.body
    };

    return proxyRequest(urlObj, requestInit);
}

/**
 * @param {URL} urlObj
 * @param {RequestInit} requestInit
 */
async function proxyRequest(urlObj, requestInit) {
    try {
        const response = await fetch(urlObj.href, requestInit);
        const resHeaders = new Headers(response.headers);

        if (resHeaders.has('location')) {
            let location = resHeaders.get('location');
            if (isValidGitHubUrl(location)) {
                resHeaders.set('location', PREFIX + location);
            } else {
                requestInit.redirect = 'follow';
                return proxyRequest(parseUrl(location), requestInit);
            }
        }

        resHeaders.set('access-control-expose-headers', '*');
        resHeaders.set('access-control-allow-origin', '*');

        resHeaders.delete('content-security-policy');
        resHeaders.delete('content-security-policy-report-only');
        resHeaders.delete('clear-site-data');

        return new Response(response.body, {
            status: response.status,
            headers: resHeaders,
        });
    } catch (err) {
        console.error('Proxy request error:', err.stack); // 增加日志记录
        return createResponse('Proxy request error:\n' + err.stack, 502);
    }
}
