let downloadCount = 0;
let totalDownloadSize = 0;
let totalDownloadTime = 0;
let startTime = 0;
const cdnUrl = 'https://cdn.jsdmirror.com/gh/';

function toSubmit(e) {
    e.preventDefault();

    const input = document.getElementsByName('gh_url')[0];
    const url = input.value.trim();

    if (!url) {
        alert('请输入有效的 URL');
        return false;
    }

    const baseUrl = location.href.substr(0, location.href.lastIndexOf('/') + 1);
    const fullUrl = `${baseUrl}${url}`;

    try {
        startTime = Date.now();
        downloadCount++;
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

function updateStatus(statusClass, message) {
    const statusElement = document.getElementById('status');
    statusElement.className = `status ${statusClass}`;
    statusElement.textContent = message;
}

function updateDownloadStats() {
    document.getElementById('download-count').textContent = downloadCount;
    document.getElementById('total-download-count').textContent = downloadCount;
    document.getElementById('total-download-size').textContent = totalDownloadSize;
    document.getElementById('home-total-download-count').textContent = downloadCount;
    document.getElementById('home-total-download-size').textContent = totalDownloadSize;

    const totalTimeInSeconds = totalDownloadTime / 1000;
    const hours = Math.floor(totalTimeInSeconds / 3600);
    const minutes = Math.floor((totalTimeInSeconds % 3600) / 60);
    const seconds = Math.floor(totalTimeInSeconds % 60);
    document.getElementById('total-download-time').textContent = `${hours}小时${minutes}分${seconds}秒`;
}

function getFileNameFromUrl(url) {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    let fileName = pathname.substring(pathname.lastIndexOf('/') + 1);
    if (!fileName) {
        fileName = 'download';
    }
    return fileName;
}

function disableDownloadButton() {
    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.disabled = true;
}

function enableDownloadButton() {
    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.disabled = false;
}

function downloadFile(url) {
    const progressBar = document.getElementById('progressBar');
    const xhr = new XMLHttpRequest();

    xhr.open('GET', url, true);
    xhr.responseType = 'blob';

    xhr.onprogress = function (event) {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            progressBar.style.width = `${percentComplete}%`;
            updateStatus('loading', `下载中: ${percentComplete.toFixed(2)}%`);
        }
    };

    xhr.onload = function () {
        if (xhr.status === 200) {
            const blob = xhr.response;
            const fileName = getFileNameFromUrl(url);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(link.href);

            totalDownloadSize += blob.size;
            const endTime = Date.now();
            totalDownloadTime += endTime - startTime;
            updateStatus('success', '下载完成');
            updateDownloadStats();
            enableDownloadButton();
            redirectToHome();
        } else {
            updateStatus('error', `下载失败，状态码: ${xhr.status}`);
            enableDownloadButton();
        }
    };

    xhr.onerror = function () {
        updateStatus('error', '下载失败');
        enableDownloadButton();
    };

    xhr.send();
}

function redirectToHome() {
    window.location.href = '/';
}

// 确保页面加载时按钮是启用的
document.addEventListener('DOMContentLoaded', () => {
    enableDownloadButton();
});
