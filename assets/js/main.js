let downloadCount = 0;
let totalDownloadSize = 0;
let totalDownloadTime = 0;
let startTime = 0;
const cdnUrl = 'https://cdn.jsdmirror.com/gh/';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('current-year').textContent = new Date().getFullYear();
});

function toSubmit(event) {
    event.preventDefault();

    const input = document.getElementsByName('gh_url')[0];
    const url = input.value.trim();

    if (!url) {
        alert('请输入有效的 URL');
        return false;
    }

    // 添加 URL 格式验证
    if (!isValidUrl(url)) {
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

    const totalTimeInSeconds = totalDownloadTime / 1000;
    const minutes = Math.floor(totalTimeInSeconds / 60);
    const seconds = Math.floor(totalTimeInSeconds % 60);
    document.getElementById('total-download-time').textContent = `${minutes}分${seconds}秒`;
}

function getFileNameFromUrl(url) {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    let fileName = pathname.substring(pathname.lastIndexOf('/') + 1);
    return fileName || `download_${Date.now()}`; // 使用时间戳作为默认文件名
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
        }
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            const blob = xhr.response;
            const fileName = getFileNameFromUrl(url);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            totalDownloadSize += blob.size;
            totalDownloadTime += Date.now() - startTime;
            updateStatus('success', '下载完成');
            updateDownloadStats();
            enableDownloadButton();

            // 提供用户选择是否重定向的选项
            if (confirm('下载完成，是否重定向到主页？')) {
                redirectToHome();
            }
        } else {
            updateStatus('error', `下载失败，状态码: ${xhr.status}`);
            enableDownloadButton();
        }
    };

    xhr.onerror = () => {
        updateStatus('error', '下载失败，网络错误');
        enableDownloadButton();
    };

    xhr.send();
}

function redirectToHome() {
    window.location.href = 'https://github.axingchen.com';
}

// 支持终端命令行工具
function downloadWithCommandLineTools(url) {
    const command = `wget ${url} || curl -O ${url}`;
    console.log(`执行命令: ${command}`);
}

// 支持 git clone
function gitClone(url) {
    const command = `git clone ${url}`;
    console.log(`执行命令: ${command}`);
}

// 示例：在页面中添加按钮来触发命令行工具下载
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
