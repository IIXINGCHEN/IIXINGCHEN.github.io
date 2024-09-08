let downloadCount = 0;
let totalDownloadSize = 0;
let totalDownloadTime = 0;
let startTime = 0;
const cdnUrl = 'https://cdn.jsdmirror.com/gh/';

document.addEventListener('DOMContentLoaded', () => {
    // 动态获取当前年份并显示在页脚
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
});

function toSubmit(event) {
    event.preventDefault();

    const input = document.getElementsByName('gh_url')[0];
    const url = input.value.trim();

    if (!url) {
        alert('请输入有效的 URL');
        return false;
    }

    const baseUrl = location.href.substring(0, location.href.lastIndexOf('/') + 1);
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

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (error) {
        console.error('URL 无效:', error);
        return false;
    }
}

function updateStatus(statusClass, message) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.className = `status ${statusClass}`;
        statusElement.textContent = message;
    }
}

function updateDownloadStats() {
    const elements = {
        'download-count': downloadCount,
        'total-download-size': totalDownloadSize,
        'home-total-download-size': totalDownloadSize,
    };

    for (const [id, value] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    const totalTimeInSeconds = totalDownloadTime / 1000;
    const minutes = Math.floor(totalTimeInSeconds / 60);
    const seconds = Math.floor(totalTimeInSeconds % 60);
    const timeElement = document.getElementById('total-download-time');
    if (timeElement) {
        timeElement.textContent = `${minutes}分${seconds}秒`;
    }
}

function getFileNameFromUrl(url) {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    let fileName = pathname.substring(pathname.lastIndexOf('/') + 1);
    if (!fileName) {
        fileName = 'download_' + new Date().getTime(); // 使用时间戳作为默认文件名
    }
    return fileName;
}

function disableDownloadButton() {
    const button = document.getElementById('download-btn');
    if (button) {
        button.disabled = true;
    }
}

function enableDownloadButton() {
    const button = document.getElementById('download-btn');
    if (button) {
        button.disabled = false;
    }
}

function downloadFile(url) {
    const progressBar = document.getElementById('progressBar');
    if (!progressBar) {
        console.error('进度条元素未找到');
        return;
    }

    const xhr = new XMLHttpRequest();

    xhr.open('GET', url, true);
    xhr.responseType = 'blob';

    xhr.onprogress = (event) => {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            progressBar.style.width = `${percentComplete}%`;
            updateStatus('loading', `下载中: ${percentComplete.toFixed(2)}%`);
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

            totalDownloadSize += blob.size;
            const endTime = Date.now();
            totalDownloadTime += endTime - startTime;
            updateStatus('success', '下载完成');
            updateDownloadStats();
            enableDownloadButton();
        } else {
            updateStatus('error', '下载失败');
            enableDownloadButton();
        }
    };

    xhr.onerror = () => {
        console.error('下载失败');
        updateStatus('error', '下载失败');
        enableDownloadButton();
    };

    xhr.send();
}

function redirectToHome() {
    window.location.href = 'https://github.axingchen.com';
}

// 添加按钮来触发命令行工具下载
document.getElementById('download-btn').addEventListener('click', () => {
    const input = document.getElementsByName('gh_url')[0];
    const url = input.value.trim();
    if (url.includes('github.com')) {
        downloadWithCommandLineTools(url);
    } else if (url.includes('git clone')) {
        gitClone(url);
    } else {
        downloadFile(url);
    }
});
