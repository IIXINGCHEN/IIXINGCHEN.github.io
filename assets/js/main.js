'use strict';

// 定义GitHub URL的正则表达式
const URL_REGEXES = [
    /^(?:https?:\/\/)?github\.com\/[^\/]+\/[^\/]+\/(?:releases|archive|blob|raw|info|git-|tags|tree)\/.*$/i,
    /^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/[^\/]+\/[^\/]+\/[^\/]+\/.*$/i,
    /^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/[^\/]+\/[^\/]+\/.*$/i
];

// 表单提交事件监听器
document.getElementById('downloadForm').addEventListener('submit', handleFormSubmit);

/**
 * 处理表单提交事件
 * @param {Event} e - 事件对象
 */
function handleFormSubmit(e) {
    e.preventDefault();
    const githubUrlInput = document.getElementsByName('downloa_url')[0];
    const urlValue = githubUrlInput.value.trim();

    if (!isValidGitHubUrl(urlValue)) {
        alert('请输入有效的GitHub文件链接。例如：\n' +
            'https://github.com/用户名/仓库名/blob/分支名/文件路径\n' +
            'https://raw.githubusercontent.com/用户名/仓库名/分支名/文件路径');
        githubUrlInput.value = '';
        return;
    }

    // 清理用户输入
    const encodedUrlValue = encodeURIComponent(urlValue);
    toggleLoadingIndicator(true, '文件下载中，请稍等...');
    const baseUrl = window.location.origin + window.location.pathname;
    const requestUrl = `${baseUrl}?q=${encodedUrlValue}`;

    fetchWithRetry(requestUrl)
        .then(handleFetchResponse)
        .then(handleDownload)
        .catch(handleFetchError)
        .finally(() => toggleLoadingIndicator(false));
}

/**
 * 验证GitHub URL是否有效
 * @param {string} url - 要验证的URL
 * @returns {boolean} - 返回URL是否有效
 */
function isValidGitHubUrl(url) {
    return URL_REGEXES.some(regex => regex.test(url));
}

/**
 * 处理fetch响应
 * @param {Response} response - fetch响应对象
 * @returns {Promise} - 返回处理后的blob和fileName
 */
async function handleFetchResponse(response) {
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`网络响应失败: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const contentDisposition = response.headers.get('Content-Disposition');
    let fileName = contentDisposition ? contentDisposition.match(/filename=["']?([^"']+)["']?/)[1] || 'downloaded_file' : 'downloaded_file';
    const blob = await response.blob();
    return { blob, fileName };
}

/**
 * 处理下载
 * @param {{blob: Blob, fileName: string}} data - 包含blob和fileName的对象
 */
function handleDownload({ blob, fileName }) {
    if (blob.size > 1024 * 1024 * 1024) { // 1GB 限制
        alert('文件太大，无法下载。请选择小于1GB的文件。');
        return;
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showDownloadComplete(); // 显示下载完成提示
}

/**
 * 处理fetch错误
 * @param {Error} error - 错误对象
 */
function handleFetchError(error) {
    console.error('下载失败:', error);
    let errorMessage = '下载失败，请重试。';
    if (error.message.includes('网络响应失败')) {
        errorMessage = '服务器无法处理您的请求，请检查URL是否正确。';
    }
    alert(errorMessage);
}

/**
 * 显示或隐藏加载指示器
 * @param {boolean} show - 是否显示加载指示器
 * @param {string} message - 显示的消息
 */
function toggleLoadingIndicator(show, message = '') {
    let loadingIndicator = document.getElementById('loadingIndicator');
    if (!loadingIndicator) {
        loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loadingIndicator';
        document.body.appendChild(loadingIndicator);
    }
    loadingIndicator.textContent = message;
    loadingIndicator.style.display = show ? 'block' : 'none';
}

/**
 * 显示下载完成提示
 */
function showDownloadComplete() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.textContent = '下载完成';
        loadingIndicator.style.display = 'block';

        // 添加淡出效果
        setTimeout(() => {
            let opacity = 1;
            const fadeEffect = setInterval(() => {
                if (opacity > 0) {
                    opacity -= 0.05; // 调整淡出速度
                    loadingIndicator.style.opacity = opacity;
                } else {
                    clearInterval(fadeEffect);
                    loadingIndicator.style.display = 'none';
                }
            }, 100); // 调整淡出间隔
        }, 3000); // 3秒后开始淡出
    }
}

/**
 * 带有重试机制的fetch请求
 * @param {string} url - 请求的URL
 * @param {number} retries - 重试次数
 * @param {number} delay - 重试延迟时间（毫秒）
 * @returns {Promise} - 返回fetch响应
 */
async function fetchWithRetry(url, retries = 3, delay = 500) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`网络响应失败: ${response.status} ${response.statusText}`);
        }
        return response;
    } catch (error) {
        if (retries > 0) {
            console.warn(`请求失败，${delay}毫秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, retries - 1, Math.min(delay * 2, 5000)); // 增加延迟时间，但不超过5秒
        } else {
            throw error;
        }
    }
}
