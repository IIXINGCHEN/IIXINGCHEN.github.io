let downloadCount = 0;
let totalDownloadSize = 0;
let totalDownloadTime = 0;
let startTime = 0;
const cdnUrl = 'https://cdn.jsdmirror.com/gh/';

document.addEventListener('DOMContentLoaded', () => {
    // 动态获取当前年份并显示在页脚
    document.getElementById('current-year').textContent = new Date().getFullYear();
});

function handleSubmit(event) {
    event.preventDefault();

    const input = document.querySelector('input[name="gh_url"]');
    const url = input.value.trim();

    if (!url) {
        alert('请输入有效的 URL');
        return false;
    }

    // 使用正则表达式验证 URL 的有效性
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    if (!urlPattern.test(url)) {
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

    const totalTimeInSeconds = totalDownloadTime / 1000;
    const minutes = Math.floor(totalTimeInSeconds / 60);
    const seconds = Math.floor(totalTimeInSeconds % 60);
    document.getElementById('total-download-time').textContent = `${minutes}分${seconds}秒`;
}

function getFileNameFromUrl(url) {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    let fileName = pathname.substring(pathname.lastIndexOf('/') + 1);
    if (!fileName) {
        fileName = 'download_' + new Date().getTime() + '_' + Math.random().toString(36).substring(2, 15); // 使用时间戳和随机数作为默认文件名
    }
    return fileName;
}

function disableDownloadButton() {
    document.getElementById('download-btn').disabled = true;
}

function enableDownloadButton() {
    document.getElementById('download-btn').disabled = false;
}

function downloadFile(url) {
    const progressBar = document.getElementById('progressBar');
    const xhr = new XMLHttpRequest();

    xhr.open('GET', url, true);
    xhr.responseType = 'blob';

    xhr.onprogress = (event) => {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            progressBar.style.width = `${percentComplete}%`;
            updateStatus('loading', `下载中: ${percentComplete.toFixed(2)}%`);
        } else {
            updateStatus('loading', '下载中: 进度无法计算');
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
            redirectToHome();
        } else {
            updateStatus('error', `下载失败，状态码: ${xhr.status}`);
            enableDownloadButton();
        }
    };

    xhr.onerror = () => {
        updateStatus('error', '下载失败');
        enableDownloadButton();
    };

    xhr.send();
}

function redirectToHome() {
    if (confirm('下载完成，是否重定向到主页？')) {
        window.location.href = 'https://github.axingchen.com';
    }
}
