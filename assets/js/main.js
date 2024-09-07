let downloadCount = parseInt(localStorage.getItem('downloadCount')) || 0;
let totalDownloadSize = parseInt(localStorage.getItem('totalDownloadSize')) || 0;
let totalDownloadTime = parseInt(localStorage.getItem('totalDownloadTime')) || 0;
let startTime = 0;
const cdnUrl = 'https://cdn.jsdmirror.com/gh/';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('current-year').textContent = new Date().getFullYear();
    updateDownloadStats(); // 页面加载时更新下载统计数据
});

function handleSubmit(event) {
    event.preventDefault();

    const input = document.querySelector('input[name="gh_url"]');
    const url = input.value.trim();

    if (!url || !isValidUrl(url)) {
        alert('请输入有效的 URL');
        return false;
    }

    const baseUrl = location.href.substring(0, location.href.lastIndexOf('/') + 1);
    const fullUrl = `${baseUrl}${url}`;

    try {
        startTime = Date.now();
        downloadCount++;
        localStorage.setItem('downloadCount', downloadCount); // 更新下载次数
        updateStatus('loading', '加载中...');
        disableDownloadButton();
        downloadFile(fullUrl);
    } catch (error) {
        console.error('打开新窗口时出错:', error);
        updateStatus('error', '无法打开新窗口，请检查 URL 是否有效');
        enableDownloadButton();
    }

    return false;
}

function isValidUrl(url) {
    try {
        const urlObj = new URL(url);
        const validHosts = ['raw.githubusercontent.com', 'gist.github.com', 'gist.githubusercontent.com', 'github.com'];
        return (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && validHosts.includes(urlObj.hostname);
    } catch (e) {
        return false;
    }
}

function updateStatus(statusClass, message) {
    const statusElement = document.getElementById('status');
    statusElement.className = `status ${statusClass}`;
    statusElement.textContent = message;
}

function updateDownloadStats() {
    const elements = {
        'download-count': downloadCount,
        'total-download-size': totalDownloadSize,
        'home-total-download-size': totalDownloadSize,
    };

    for (const [id, value] of Object.entries(elements)) {
        document.getElementById(id).textContent = value;
    }

    const totalTimeInSeconds = isNaN(totalDownloadTime) ? 0 : totalDownloadTime / 1000;
    const minutes = Math.floor(totalTimeInSeconds / 60);
    const seconds = Math.floor(totalTimeInSeconds % 60);
    document.getElementById('total-download-time').textContent = `${minutes}分${seconds}秒`;
}

function getFileNameFromUrl(url) {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    let fileName = pathname.substring(pathname.lastIndexOf('/') + 1);
    if (!fileName) {
        fileName = 'download_' + new Date().getTime(); // 使用时间戳作为默认文件名
    }
    // 清理文件名
    fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return fileName;
}

function disableDownloadButton() {
    document.getElementById('download-btn').disabled = true;
}

function enableDownloadButton() {
    document.getElementById('download-btn').disabled = false;
}

function downloadFile(url) {
    const progressBarContainer = document.getElementById('progressBarContainer');
    const progressBar = document.getElementById('progressBar');

    progressBarContainer.style.display = 'block'; // 显示进度条容器

    const xhr = new XMLHttpRequest();

    xhr.open('GET', url, true);
    xhr.responseType = 'blob';

    xhr.onprogress = (event) => {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            progressBar.style.width = `${percentComplete}%`;
            updateStatus('loading', `下载中: ${percentComplete.toFixed(2)}%`);
        } else {
            updateStatus('loading', '下载中...');
        }
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            const blob = xhr.response;
            const fileName = getFileNameFromUrl(url);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            if (blob.size !== undefined) {
                totalDownloadSize += blob.size;
                localStorage.setItem('totalDownloadSize', totalDownloadSize); // 更新累计下载大小
            }
            const endTime = Date.now();
            const downloadTime = endTime - startTime;
            totalDownloadTime += downloadTime;
            localStorage.setItem('totalDownloadTime', totalDownloadTime); // 更新累计下载时间
            updateStatus('success', '下载完成');
            updateDownloadStats();
            enableDownloadButton();

            // 清空输入框链接
            document.querySelector('input[name="gh_url"]').value = '';

            // 强制重定向并刷新首页
            redirectToHome(true);

            // 动态获取并显示下载时间
            const downloadTimeInSeconds = downloadTime / 1000;
            const minutes = Math.floor(downloadTimeInSeconds / 60);
            const seconds = Math.floor(downloadTimeInSeconds % 60);
            document.getElementById('total-download-time').textContent = `${minutes}分${seconds}秒`;
        } else {
            updateStatus('error', `下载失败，状态码: ${xhr.status}`);
            enableDownloadButton();
        }

        progressBarContainer.style.display = 'none'; // 隐藏进度条容器
    };

    xhr.onerror = () => {
        updateStatus('error', '下载失败，可能是跨域问题');
        enableDownloadButton();
        progressBarContainer.style.display = 'none'; // 隐藏进度条容器
    };

    xhr.send();
}

function redirectToHome(forceReload = false) {
    window.location.href = 'https://github.axingchen.com';
    if (forceReload) {
        window.location.reload(true); // 强制刷新页面
    }
}
