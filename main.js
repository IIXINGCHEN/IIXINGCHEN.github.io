'use strict'

/**
 * static files (404.html, sw.js, conf.js)
 */
const ASSET_URL = 'https://hunshcn.github.io/gh-proxy/'
// 前缀，如果自定义路由为example.com/gh/*，将PREFIX改为 '/gh/'，注意，少一个杠都会错！
const PREFIX = '/'
// 分支文件使用jsDelivr镜像的开关，0为关闭，默认关闭
const Config = {
    jsdelivr: 0
}

const whiteList = [] // 白名单，路径里面有包含字符的才会通过，e.g. ['/username/']

/** @type {RequestInit} */
// 假设从配置或环境变量中获取 ALLOWED_METHODS
const ALLOWED_METHODS = getAllowedMethods(); // 假设这是一个从配置或环境变量中获取方法的函数

// 封装设置Preflight响应头的逻辑
function setPreflightHeaders(methods) {
    return {
        status: 204,
        headers: new Headers({
            'access-control-allow-origin': '*',
            'access-control-allow-methods': methods.join(','),
            'access-control-max-age': '1728000',
        }),
    };
}
// 使用封装好的函数来设置PREFLIGHT_INIT
const PREFLIGHT_INIT = setPreflightHeaders(ALLOWED_METHODS);

const exp1 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:releases|archive)\/.*$/i
const exp2 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:blob|raw)\/.*$/i
const exp3 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:info|git-).*$/i
const exp4 = /^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+$/i
const exp5 = /^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+$/i
const exp6 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tags.*$/i
const exp7 = /^(?:https?:\/\/)?api\.github\.com\/.*$/i
const exp8 = /^(?:https?:\/\/)?git\.io\/.*$/i

/**
 * @param {any} body
 * @param {number} status
 * @param {Object<string, string>} headers
 */
function makeRes(body, status = 200, headers = {}) {
    // 使用简洁的 in 操作符检查 headers 中是否存在 'access-control-allow-origin'
    if (!('access-control-allow-origin' in headers)) {
        headers['access-control-allow-origin'] = '*';
    }
    
    // 可以考虑在这里添加对 body 的校验或转换逻辑
    // 例如，如果 body 是对象，则转换为 JSON 字符串
    // if (typeof body === 'object' && body !== null) {
    //     body = JSON.stringify(body);
    //     headers['Content-Type'] = 'application/json';
    // }

    return new Response(body, { status, headers });
}
/**
 * @param {string} urlStr
 */

function newUrl(urlStr) {
    try {
        return new URL(urlStr);
    } catch (err) {
        // 返回一个特定的错误对象而不是一个包含错误消息的普通对象
        return Promise.reject(new Error(`Error creating URL: ${err.message}`));
    }
}

addEventListener('fetch', e => {
    // 使用 async 函数来更优雅地处理异步逻辑
    (async () => {
        try {
            const response = await fetchHandler(e);
            e.respondWith(response);
        } catch (err) {
            console.error("Fetch error handler:", err);
            e.respondWith(makeRes('cfworker error:\n' + err.stack, 502));
        }
    })();
})

// 在调用 newUrl 时，确保你正确处理了返回的 Promise
// 例如：
// newUrl(someString)
//   .then(urlObj => {
//       // 是有效的URL对象，可以安全使用
//   })
//   .catch(err => {
//       // 处理错误
//   });

/**
 * 检查给定的URL是否与预定义的正则表达式列表中的任何一个匹配
 *
 * @param {string} u - 待检查的URL字符串
 * @returns {boolean} 如果匹配则返回true，否则返回false
 */
function checkUrl(u) {
    // 使用 some 方法结合正则表达式的 test 方法来检查 URL 是否与任何一个正则表达式匹配
    return [exp1, exp2, exp3, exp4, exp5, exp6, exp7, exp8].some(exp => exp.test(u));
}
/**
 * @param {FetchEvent} e
 */
async function fetchHandler(e) {
    const req = e.request;
    const urlStr = req.url;
    const urlObj = new URL(urlStr);

    let path;
    // 检查URL中是否有查询参数'q'
    if (urlObj.searchParams.has('q')) {
        path = urlObj.searchParams.get('q'); // 直接使用查询参数中的路径
        return Response.redirect(new URL(path, urlObj.origin).href, 301); // 使用完整的URL
    }

    path = urlObj.pathname + urlObj.search + urlObj.hash; // 完整路径

    // 去除嵌套路径
    const expRemovePrefix = new RegExp(`^${PREFIX}`, 'i');
    while (expRemovePrefix.test(path)) {
        path = path.replace(expRemovePrefix, '');
    }

    // 提前定义处理函数
    const handleJsDelivrRedirect = (path) => {
        if (Config.jsdelivr) {
            return path.replace('/blob/', '@').replace(/^(?:https?:\/\/)?github\.com/, 'https://cdn.jsdelivr.net/gh');
        }
        return path.replace('/blob/', '/raw/');
    };

    // 模式匹配与处理
    if (matchesPattern(path, [exp1, exp3, exp4, exp5, exp6, exp7, exp8])) {
        return httpHandler(req, path);
    } else if (matchesPattern(path, [exp2])) {
        return Response.redirect(handleJsDelivrRedirect(path), 302);
    } else if (path === 'perl-pe-para') {
        // 假设这是修正拼写错误后的响应文本
        const responseText = "修正后的文本内容";
        return new Response(responseText, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain',
                'Cache-Control': 'max-age=300'
            }
        });
    } else {
        // 假设有一个配置项指向资源的基础URL
        const RESOURCE_BASE_URL = ASSET_URL; // 可以通过配置或参数化来修改
        console.log("fetch", RESOURCE_BASE_URL + path);
        return fetch(RESOURCE_BASE_URL + path).catch((err) => {
            // 添加错误处理
            console.error("Fetch error:", err);
            return makeRes('cfworker error:\n' + err.stack, 502);
        });
    }
}
// 辅助函数，检查path是否匹配任何给定的正则表达式
function matchesPattern(path, patterns) {
    return patterns.some(pattern => pattern.test(path));
}

/**
 * @param {Request} req
 * @param {string} pathname
 */
function httpHandler(req, pathname) {
    const reqHdrRaw = req.headers;

    // Preflight 处理
    if (req.method === 'OPTIONS' && reqHdrRaw.has('access-control-request-headers')) {
        return new Response(null, PREFLIGHT_INIT);
    }

    const reqHdrNew = new Headers(reqHdrRaw);

    // 检查白名单
    if (whiteList.length > 0 && !whiteList.some(item => pathname.includes(item))) {
        return new Response("Access denied due to whitelist restriction", { status: 403 });
    }

    // 确保URL的完整性和格式正确
    let urlObj;
    try {
        urlObj = newUrl(pathname);
        if (!(urlObj instanceof URL)) {
            throw new Error('Invalid URL');
        }
    } catch (err) {
        return new Response("Invalid URL: " + err.message, { status: 400 });
    }

    // 检查是否已经是完整的URL，如果不是且以'git'开头，则添加协议前缀
    if (!/^https?:\/\//.test(pathname) && pathname.startsWith('git')) {
        pathname = 'https://' + pathname;
        // 重新尝试解析，但此时我们假设已经是有效的URL格式
        urlObj = new URL(pathname);
    }

    const reqInit = {
        method: req.method,
        headers: reqHdrNew,
        redirect: 'manual',
        body: req.body
    };
    return proxy(urlObj, reqInit);
}
/**
 *
 * @param {URL} urlObj
 * @param {RequestInit} reqInit
 */

async function proxy(urlObj, reqInit) {
    const res = await fetch(urlObj.href, reqInit);
    
    // 只创建一次Headers对象，后续修改
    const resHdrNew = new Headers(res.headers);
    
    const status = res.status;

    if (resHdrNew.has('location')) {
        const originalLocation = resHdrNew.get('location');
        // 先检查新URL是否有效
        const newLocationUrl = newUrl(originalLocation);
        if (newLocationUrl instanceof URL) { // 检查返回的是否为URL对象
            if (checkUrl(newLocationUrl.href)) {
                // 只在确认新URL有效且符合规则时才修改location头
                resHdrNew.set('location', PREFIX + newLocationUrl.href);
            } else {
                // 如果新URL不符合规则，则设置redirect为follow，并递归调用
                // 创建新的reqInit对象避免影响外部
                const newReqInit = { ...reqInit, redirect: 'follow' };
                return proxy(newLocationUrl, newReqInit);
            }
        } else {
            return new Response('Invalid redirect location', { status: 502 });
        }
    }
    resHdrNew.set('access-control-expose-headers', '*');
    resHdrNew.set('access-control-allow-origin', '*');
    resHdrNew.delete('content-security-policy');
    resHdrNew.delete('content-security-policy-report-only');
    resHdrNew.delete('clear-site-data');
    return new Response(res.body, {
        status,
        headers: resHdrNew,
    });
}
