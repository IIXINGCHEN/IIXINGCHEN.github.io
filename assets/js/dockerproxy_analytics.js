(function () {
    // 多语言支持消息
    const messages = {
        en: {
            welcome: "Welcome to WebViso/yestool, Author: YesTool, Author URL: https://webviso.yestool.org",
            fetchError: "WebViso.init fetch error",
            fetchTimeout: "Request timed out"
        },
        zh: {
            welcome: "欢迎使用 WebViso/yestool，作者：YesTool，作者网址：https://webviso.yestool.org",
            fetchError: "WebViso.init 获取错误",
            fetchTimeout: "请求超时"
        }
    };

    // 设置默认语言为中文
    const lang = 'zh';

    // 控制台输出欢迎信息
    console.info(messages[lang].welcome);

    /**
     * 延迟添加<meta>标签到<head>
     */
    setTimeout(function () {
        if (document.head) {
            const metaAuthor = document.createElement("meta");
            metaAuthor.setAttribute("property", "og:site_counter_author");
            metaAuthor.setAttribute("content", "yestool");

            const metaAuthorURL = document.createElement("meta");
            metaAuthorURL.setAttribute("property", "og:site_counter_author_url");
            metaAuthorURL.setAttribute("content", "https://webviso.yestool.org");

            document.head.appendChild(metaAuthor);
            document.head.appendChild(metaAuthorURL);
        }
    }, 500); // 500 毫秒后执行

    // 获取当前脚本元素
    const currentScript = document.currentScript;
    // 从data-属性获取基础 URL，默认为 'https://webviso.yestool.org'
    let baseUrl = currentScript.getAttribute("data-base-url") || "https://webviso.yestool.org";
    // 获取 PV 和 UV 元素的 ID，默认为 'page_pv' 和 'page_uv'
    let pagePVId = currentScript.getAttribute("data-page-pv-id") || "page_pv";
    let pageUVId = currentScript.getAttribute("data-page-uv-id") || "page_uv";

    // 定义统计对象
    const analytics = {
        version: "0.0.0",
        page_pv_id: pagePVId,
        page_uv_id: pageUVId,
        /**
         * 初始化统计功能
         */
        init: async function () {
            const locationInfo = getLocation(window.location.href);
            const pvElement = document.getElementById(this.page_pv_id);
            const uvElement = document.getElementById(this.page_uv_id);
            const payload = {
                url: locationInfo.pathname,
                hostname: locationInfo.hostname,
                referrer: document.referrer,
                pv: !!pvElement,
                uv: !!uvElement
            };

            try {
                const response = await fetchWithTimeout(`${baseUrl}/api/visit`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                }, 5000); // 设置5秒超时

                const result = await response.json();

                if (result.ret !== "OK" || !result.data) {
                    console.error("WebViso.init error", result.message || "无返回数据");
                    return;
                }

                const { pv, uv } = result.data;

                if (typeof pv === "number" && pvElement) {
                    pvElement.innerText = pv;
                }

                if (typeof uv === "number" && uvElement) {
                    uvElement.innerText = uv;
                }
            } catch (error) {
                if (error.message === "请求超时" || error.message === "Request timed out") {
                    console.error(messages[lang].fetchTimeout);
                } else {
                    console.error(messages[lang].fetchError, error);
                }
            }
        }
    };

    /**
     * 获取 URL 的辅助函数
     * @param {string} url - 完整的 URL
     * @returns {HTMLAnchorElement} - 解析后的链接元素
     */
    function getLocation(url) {
        const link = document.createElement("a");
        link.href = url;
        return link;
    }

    /**
     * 实现 fetch 超时功能
     * @param {string} resource - 请求的 URL
     * @param {object} options - fetch 选项
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise<Response>}
     */
    function fetchWithTimeout(resource, options = {}, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(messages[lang].fetchTimeout));
            }, timeout);

            fetch(resource, options)
                .then(response => {
                    clearTimeout(timer);
                    resolve(response);
                })
                .catch(err => {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }

    /**
     * 初始化统计，当窗口加载完成后执行
     */
    if (typeof window !== "undefined") {
        window.addEventListener('load', () => {
            analytics.init();
        });
        // 将 analytics 对象暴露到全局，以便其他脚本调用
        window.WebViso = analytics;
    }
})();
