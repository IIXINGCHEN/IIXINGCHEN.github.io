// 初始化全局变量
const MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024; // 1GB in bytes
const VALID_HOSTS = ['raw.githubusercontent.com', 'gist.github.com', 'gist.githubusercontent.com', 'github.com', 'mirror.ghproxy.com'];

let downloadCount = parseInt(localStorage.getItem('downloadCount')) || 0;
let totalDownloadCount = parseInt(localStorage.getItem('totalDownloadCount')) || 0;
let totalDownloadSize = parseInt(localStorage.getItem('totalDownloadSize')) || 0;
let totalDownloadTime = parseInt(localStorage.getItem('totalDownloadTime')) || 0;
let startTime = 0;

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializeApp);

// 初始化应用，更新下载统计信息
function initializeApp() {
    updateDownloadStats();
}

// 表单提交处理
function handleSubmit(event) {
    event.preventDefault();
    const url = getInputValue('gh_url').trim();

    if (!isValidUrl(url)) {
        alert('请输入有效的 URL');
        return;
    }

    const fullUrl = constructFullUrl(url);
    startDownload(fullUrl);
}

// 获取输入框的值
function getInputValue(name) {
    return document.querySelector(`input[name="${name}"]`).value;
}

// 构造完整的文件 URL
function constructFullUrl(url) {
    if (url.startsWith("git clone ")) {
        url = url.replace("git clone ", "").trim();
    }

    if (url.startsWith("https://mirror.ghproxy.com/")) {
        url = url.replace("https://mirror.ghproxy.com/", "https://");
    }

    return url;
}

// 开始下载文件
function startDownload(url) {
    startTime = Date.now();
    downloadCount++;
    localStorage.setItem('downloadCount', downloadCount);
    localStorage.setItem('totalDownloadCount', downloadCount); // 更新累计下载次数
    updateStatus('loading', '正在下载...');
    disableDownloadButton();
    downloadFile(url);
}

// URL 验证
function isValidUrl(url) {
    try {
        const urlObj = new URL(url);
        return (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && VALID_HOSTS.includes(urlObj.hostname);
    } catch {
        return false;
    }
}

// 更新状态信息
function updateStatus(statusClass, message) {
    const statusElement = document.getElementById('status');
    statusElement.className = `status ${statusClass}`;
    statusElement.textContent = message;
}

// 更新下载统计信息
function updateDownloadStats() {
    document.getElementById('download-count').textContent = downloadCount;
    document.getElementById('total-download-count').textContent = totalDownloadCount;
    document.getElementById('total-download-size').textContent = formatBytes(totalDownloadSize);
    document.getElementById('total-download-time').textContent = formatDownloadTime(totalDownloadTime);
    document.getElementById('home-total-download-count').textContent = totalDownloadCount;
    document.getElementById('home-total-download-size').textContent = formatBytes(totalDownloadSize);
}

// 格式化字节
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// 格式化下载时间
function formatDownloadTime(totalDownloadTime) {
    const totalTimeInSeconds = totalDownloadTime / 1000 || 0;
    const minutes = Math.floor(totalTimeInSeconds / 60);
    const seconds = Math.floor(totalTimeInSeconds % 60);
    return `${minutes}分 ${seconds}秒`;
}

// 下载文件
function downloadFile(url) {
    const progressBarContainer = document.getElementById('progressBarContainer');
    const progressBar = document.getElementById('progressBar');
    progressBarContainer.style.display = 'block'; // 显示进度条

    const xhr = new XMLHttpRequest();
    xhr.open('HEAD', url, true);

    xhr.onreadystatechange = () => {
        if (xhr.readyState === xhr.DONE) {
            handleHeadResponse(xhr, url, progressBarContainer, progressBar);
        }
    };

    xhr.send();
}

// 处理 HEAD 请求响应
function handleHeadResponse(xhr, url, progressBarContainer, progressBar) {
    if (xhr.status === 200) {
        const fileSize = xhr.getResponseHeader('Content-Length');
        if (fileSize && parseInt(fileSize) <= MAX_FILE_SIZE) {
            initiateFileDownload(url, progressBarContainer, progressBar);
        } else {
            updateStatus('error', '文件大小超过 1GB，无法下载');
            enableDownloadButton();
        }
    } else if (xhr.status === 404) {
        updateStatus('error', '文件未找到（404），请检查 URL 是否正确');
        enableDownloadButton();
    } else {
        updateStatus('error', `获取文件大小时出错: ${xhr.status}`);
        enableDownloadButton();
    }
}

// 发起文件下载
function initiateFileDownload(url, progressBarContainer, progressBar) {
    const newXhr = new XMLHttpRequest();
    newXhr.open('GET', url, true);
    newXhr.responseType = 'blob';

    newXhr.onprogress = (event) => handleProgress(event, progressBar);
    newXhr.onload = () => handleDownloadComplete(newXhr, progressBarContainer);
    newXhr.onerror = () => handleDownloadError(progressBarContainer);

    newXhr.send();
}

// 处理下载进度
function handleProgress(event, progressBar) {
    if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        progressBar.style.width = `${percentComplete}%`;
        updateStatus('loading', `下载进度: ${percentComplete.toFixed(2)}%`);
    } else {
        updateStatus('loading', '下载中...');
    }
}

// 处理下载完成
function handleDownloadComplete(xhr, progressBarContainer) {
    if (xhr.status === 200) {
        const blob = xhr.response;
        const fileName = getFileNameFromUrl(xhr.responseURL);
        downloadBlob(blob, fileName);
        updateDownloadStatsAfterDownload(blob.size);
        updateStatus('success', '下载完成');
        enableDownloadButton();
    } else {
        updateStatus('error', `下载失败，状态码: ${xhr.status}`);
        enableDownloadButton();
    }
    progressBarContainer.style.display = 'none'; // 隐藏进度条
}

// 处理下载错误
function handleDownloadError(progressBarContainer) {
    updateStatus('error', '下载过程中出现错误');
    enableDownloadButton();
    progressBarContainer.style.display = 'none'; // 隐藏进度条
}

// 下载 Blob 对象
function downloadBlob(blob, fileName) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

// 更新下载统计信息
function updateDownloadStatsAfterDownload(blobSize) {
    totalDownloadSize += blobSize;
    localStorage.setItem('totalDownloadSize', totalDownloadSize);
    totalDownloadTime += (Date.now() - startTime);
    localStorage.setItem('totalDownloadTime', totalDownloadTime);
    updateDownloadStats();
}

// 从 URL 获取文件名
function getFileNameFromUrl(url) {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    let fileName = pathname.substring(pathname.lastIndexOf('/') + 1) || `download_${new Date().getTime()}`;
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// 禁用下载按钮
function disableDownloadButton() {
    document.getElementById('download-btn').disabled = true;
}

// 启用下载按钮
function enableDownloadButton() {
    document.getElementById('download-btn').disabled = false;
}
