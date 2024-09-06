'use strict';

// GitHub URL的正则表达式对象
const GITHUB_REGEXES = {
    RELEASES_ARCHIVE: /^https?:\/\/github\.com\/[^/]+\/[^/]+\/(releases|archive)\/.*$/i,
    BLOB_RAW: /^https?:\/\/github\.com\/[^/]+\/[^/]+\/(blob|raw)\/.*$/i,
    INFO_GIT: /^https?:\/\/github\.com\/[^/]+\/[^/]+\/(info|git-).*$/i,
    RAW_CONTENT: /^https?:\/\/raw\.(githubusercontent|github)\.com\/[^/]+\/[^/]+\/[^/]+\/[^/]+$/i,
    GIST: /^https?:\/\/gist\.(githubusercontent|github)\.com\/[^/]+\/[^/]+\/[^/]+$/i,
    TAGS: /^https?:\/\/github\.com\/[^/]+\/[^/]+\/tags.*$/i
};

// 事件监听器
document.getElementById('downloadForm').addEventListener('submit', handleFormSubmit);

/**
 * 处理表单提交事件
 * @param {Event} e - 事件对象
 */
function handleFormSubmit(e) {
    e.preventDefault();

    const urlInput = document.getElementsByName('q')[0];
    let urlValue = encodeURIComponent(urlInput.value.trim());

    if (!isValidGitHubUrl(urlValue)) {
        showError('请输入有效的GitHub文件链接');
        urlInput.value = '';
        return;
    }

    showLoader();
    hideError();
    resetProgressBar();
    updateDownloadCount(0);

    const requestUrl = `${window.location.origin}${window.location.pathname}?q=${urlValue}`;

    fetch(requestUrl)
        .then(handleFetchResponse)
        .then(handleDownload)
        .catch(handleFetchError);
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
    let fileName = 'downloaded_file';
    const fileNameMatch = contentDisposition?.match(/filename=["']?([^"']+)["']?/);

    if (fileNameMatch) {
        fileName = fileNameMatch[1];
    } else {
        fileName = new URLSearchParams(response.url).get('q').split('/').pop();
    }

    return { blob: await response.blob(), fileName };
}

/**
 * 处理下载
 * @param {{blob: Blob, fileName: string}} data - 包含blob和fileName的对象
 */
function handleDownload({ blob, fileName }) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    updateDownloadCount(1);
    setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
        hideLoader();
    }, 1000);
}

/**
 * 处理fetch错误
 * @param {Error} error - 错误对象
 */
function handleFetchError(error) {
    console.error('下载失败:', error);
    showError(`下载失败，请重试: ${error.message}`);
    hideLoader();
}

/**
 * 验证GitHub URL是否有效
 * @param {string} url - 要验证的URL
 * @returns {boolean} - 返回URL是否有效
 */
function isValidGitHubUrl(url) {
    return Object.values(GITHUB_REGEXES).some(regex => regex.test(url));
}

/**
 * 显示加载动画
 */
function showLoader() {
    toggleVisibility('loader', true);
    toggleVisibility('progressBarContainer', true);
}

/**
 * 隐藏加载动画
 */
function hideLoader() {
    toggleVisibility('loader', false);
    toggleVisibility('progressBarContainer', false);
}

/**
 * 显示错误信息
 * @param {string} message - 错误信息
 */
function showError(message) {
    const errorMessageDiv = document.getElementById('errorMessage');
    errorMessageDiv.textContent = message;
    toggleVisibility('errorMessage', true);
}

/**
 * 隐藏错误信息
 */
function hideError() {
    toggleVisibility('errorMessage', false);
}

/**
 * 控制元素可见性
 * @param {string} elementId - 元素ID
 * @param {boolean} isVisible - 是否可见
 */
function toggleVisibility(elementId, isVisible) {
    document.getElementById(elementId).classList.toggle('hidden', !isVisible);
}

/**
 * 重置进度条
 */
function resetProgressBar() {
    updateProgressBar(0);
}

/**
 * 更新进度条
 * @param {number} percentage - 进度百分比
 */
function updateProgressBar(percentage) {
    document.getElementById('progressBar').style.width = `${percentage}%`;
}

/**
 * 更新下载计数显示
 * @param {number} count - 当前下载计数
 */
function updateDownloadCount(count) {
    document.getElementById('downloadCountDisplay').textContent = `下载次数: ${count}`;
}
