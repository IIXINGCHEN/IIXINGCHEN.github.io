let startTime = 0;
const cdnUrl = 'https://cdn.jsdmirror.com/gh/';

// 页面加载完成后执行的回调函数
document.addEventListener('DOMContentLoaded', () => {
    // 动态获取当前年份并显示在页脚
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
});

// 处理提交事件的函数
function toSubmit(event) {
    event.preventDefault();

    const input = document.querySelector('input[name="gh_url"]');
    if (!input) {
        alert('输入框未找到');
        return false;
    }

    const url = input.value.trim();

    if (!url) {
        alert('请输入有效的 URL');
        return false;
    }

    const baseUrl = location.href.substring(0, location.href.lastIndexOf('/') + 1);
    const fullUrl = `${baseUrl}${url}`;

    try {
        let downloadStartTime = Date.now(); // 将 startTime 作为局部变量
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

// 更新状态信息的函数
function updateStatus(statusClass, message) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.className = `status ${statusClass}`;
        statusElement.textContent = message;
    } else {
        console.error('状态元素未找到');
    }
}

// 从 URL 中提取文件名的函数
function getFileNameFromUrl(url) {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    let fileName = pathname.substring(pathname.lastIndexOf('/') + 1);
    if (!fileName) {
        fileName = 'download_' + new Date().getTime(); // 使用时间戳作为默认文件名
    }
    return fileName;
}

// 禁用下载按钮的函数
function disableDownloadButton() {
    const button = document.getElementById('download-btn');
    if (button) {
        button.disabled = true;
    } else {
        console.error('下载按钮元素未找到');
    }
}

// 启用下载按钮的函数
function enableDownloadButton() {
    const button = document.getElementById('download-btn');
    if (button) {
        button.disabled = false;
    } else {
        console.error('下载按钮元素未找到');
    }
}

// 获取进度条元素的函数
function getProgressBar() {
    const progressBar = document.getElementById('progressBar');
    if (!progressBar) {
        console.error('进度条元素未找到');
    }
    return progressBar;
}

// 更新进度条的函数
function updateProgressBar(percentComplete, isLoading = false) {
    const progressBar = getProgressBar();
    if (progressBar) {
        progressBar.style.width = `${percentComplete}%`;
        if (isLoading) {
            progressBar.style.backgroundColor = 'green'; // 设置进度条颜色为绿色
        } else {
            progressBar.style.backgroundColor = ''; // 恢复默认颜色
        }
    }
}

// 下载文件的函数
function downloadFile(url) {
    const progressBar = getProgressBar();
    if (!progressBar) {
        return;
    }

    // 初始化进度条
    progressBar.style.width = '0%';
    progressBar.style.display = 'block'; // 显示进度条

    const xhr = new XMLHttpRequest();

    xhr.open('GET', url, true);
    xhr.responseType = 'blob';

    xhr.onprogress = (event) => {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            updateProgressBar(percentComplete, true); // 更新进度条并设置颜色为绿色
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

            updateStatus('success', '下载完成');
            enableDownloadButton();

            // 恢复进度条到初始状态
            resetProgressBar();
        } else {
            handleDownloadError('下载失败');
        }
    };

    xhr.onerror = () => {
        handleDownloadError('下载失败');
    };

    xhr.send();
}

// 处理下载错误的函数
function handleDownloadError(message) {
    updateStatus('error', message);
    enableDownloadButton();
    resetProgressBar();
}

// 重置进度条的函数
function resetProgressBar() {
    const progressBar = getProgressBar();
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.style.display = 'none'; // 隐藏进度条
    }
}

// 重定向到主页的函数
function redirectToHome() {
    window.location.href = 'https://github.axingchen.com';
}
