'use strict';

// 定义GitHub URL的正则表达式
const GITHUB_RELEASES_ARCHIVE_REGEX = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/(releases|archive)\/.*$/i;
const GITHUB_BLOB_RAW_REGEX = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/(blob|raw)\/.*$/i;
const GITHUB_INFO_GIT_REGEX = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/(info|git-).*$/i;
const GITHUB_RAW_CONTENT_REGEX = /^https?:\/\/raw\.(githubusercontent|github)\.com\/[^/]+\/[^/]+\/[^/]+\/[^/]+$/i;
const GITHUB_GIST_REGEX = /^https?:\/\/gist\.(githubusercontent|github)\.com\/[^/]+\/[^/]+\/[^/]+$/i;
const GITHUB_TAGS_REGEX = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/tags.*$/i;

// 表单提交事件监听器
document.getElementById('downloadForm').addEventListener('submit', handleFormSubmit);

/**
 * 处理表单提交事件
 * @param {Event} e - 事件对象
 */
function handleFormSubmit(e) {
    e.preventDefault();
    const urlInput = document.getElementsByName('q')[0];
    let urlValue = urlInput.value.trim(); // 避免使用全局变量

    // 清理用户输入
    urlValue = encodeURI(urlValue);

    if (!isValidGitHubUrl(urlValue)) {
        alert('请输入有效的GitHub文件链接');
        urlInput.value = ''; // 清空输入框
        return;
    }
    // 服务器处理这个请求并返回文件内容
    const baseUrl = window.location.origin + window.location.pathname;
    const fileUrl = encodeURIComponent(urlValue);
    const requestUrl = `${baseUrl}?q=${fileUrl}`;

    fetch(requestUrl)
        .then(handleFetchResponse)
        .then(handleDownload)
        .catch(handleFetchError)
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
    if (contentDisposition && contentDisposition.includes('filename=')) {
        const fileNameMatch = contentDisposition.match(/filename=["']?([^"']+)["']?/);
        if (fileNameMatch && fileNameMatch[1]) {
            fileName = fileNameMatch[1];
        }
    } else {
        const urlParts = urlValue.split('/');
        fileName = urlParts[urlParts.length - 1];
    }
    const blob = await response.blob();
    return { blob, fileName };
}

/**
 * 处理下载
 * @param {{blob: Blob, fileName: string}} data - 包含blob和fileName的对象
 */
function handleDownload({ blob, fileName }) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName; // 动态设置文件名
    a.style.display = 'none'; // 隐藏链接元素
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        a.remove();
        window.URL.revokeObjectURL(url);
    }, 1000); // 增加延迟时间，确保下载开始
}

/**
 * 处理fetch错误
 * @param {Error} error - 错误对象
 */
function handleFetchError(error) {
    console.error('下载失败:', error);
    alert(`下载失败，请重试: ${error.message}`);
}

/**
 * 验证GitHub URL是否有效
 * @param {string} url - 要验证的URL
 * @returns {boolean} - 返回URL是否有效
 */
function isValidGitHubUrl(url) {
    return GITHUB_RELEASES_ARCHIVE_REGEX.test(url) ||
        GITHUB_BLOB_RAW_REGEX.test(url) ||
        GITHUB_INFO_GIT_REGEX.test(url) ||
        GITHUB_RAW_CONTENT_REGEX.test(url) ||
        GITHUB_GIST_REGEX.test(url) ||
        GITHUB_TAGS_REGEX.test(url);
}