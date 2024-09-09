const cdnUrl = 'https://cdn.jsdmirror.com/gh/';

// 页面加载完成后执行的回调函数
document.addEventListener('DOMContentLoaded', () => {
    if (!document.body) {
        console.error('document.body 未加载');
        return;
    }

    // 获取当前年份并显示在页面中
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    // 动态生成进度条容器和进度条
    const progressBarContainer = createElementWithId('div', 'progressBarContainer');
    progressBarContainer.style.display = 'none'; // 初始隐藏进度条容器

    const progressBar = createElementWithId('div', 'progressBar');

    progressBarContainer.appendChild(progressBar);
    document.body.appendChild(progressBarContainer);
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

    if (!url || !isValidUrl(url)) {
        alert('请输入有效的 URL');
        return false;
    }

    const baseUrl = getBaseUrl();
    const fullUrl = `${baseUrl}${url}`;

    try {
        updateStatus('loading', '加载中...', true);
        disableDownloadButton();
        downloadFile(fullUrl);
    } catch (error) {
        console.error('打开新窗口时出错:', error);
        updateStatus('error', '无法打开新窗口，请检查 URL 是否有效', true);
        enableDownloadButton();
    }

    return false;
}

// 更新状态信息的函数
function updateStatus(statusClass, message, showRed) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.className = `status ${statusClass}`;
        statusElement.textContent = message;
        if (showRed) {
            // 设定颜色为红色并添加闪动效果
            statusElement.style.color = 'red';
            statusElement.classList.add('blink'); // 添加闪动类
        } else {
            statusElement.style.color = '';
            statusElement.classList.remove('blink'); // 移除闪动类
        }
    } else {
        console.error('状态元素未找到');
    }
}

// 从 URL 中获取文件名的函数
function getFileNameFromUrl(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        let fileName = pathname.substring(pathname.lastIndexOf('/') + 1);
        if (fileName) {
            resolve(fileName);
        } else {
            const xhr = new XMLHttpRequest();
            xhr.open('HEAD', url, true); // 使用异步请求获取响应头
            xhr.onload = () => {
                if (xhr.status === 200) {
                    const contentDisposition = xhr.getResponseHeader('Content-Disposition');
                    if (contentDisposition && contentDisposition.includes('filename=')) {
                        fileName = contentDisposition.split('filename=')[1].replace(/['"]/g, '');
                    } else {
                        fileName = `download_${new Date().getTime()}`; // 不添加默认的文件扩展名
                    }
                } else {
                    fileName = `download_${new Date().getTime()}`; // 不添加默认的文件扩展名
                }
                resolve(fileName);
            };
            xhr.onerror = () => {
                reject(new Error('获取文件名失败'));
            };
            xhr.send();
        }
    });
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

// 获取进度条容器元素的函数
function getProgressBarContainer() {
    const progressBarContainer = document.getElementById('progressBarContainer');
    if (!progressBarContainer) {
        console.error('进度条容器元素未找到');
    }
    return progressBarContainer;
}

// 更新进度条的函数
function updateProgressBar(percentComplete) {
    const progressBar = getProgressBar();
    if (progressBar) {
        progressBar.style.width = `${percentComplete}%`;
    }
}

// 下载文件的函数
function downloadFile(url) {
    const progressBarContainer = getProgressBarContainer();
    const progressBar = getProgressBar();
    if (!progressBarContainer || !progressBar) {
        return;
    }

    // 初始化进度条
    progressBar.style.width = '0%';
    progressBarContainer.style.display = 'block'; // 显示进度条容器

    const xhr = new XMLHttpRequest();

    xhr.open('GET', url, true);
    xhr.responseType = 'blob';

    xhr.onprogress = (event) => {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            updateProgressBar(percentComplete); // 更新进度条
            updateStatus('loading', `下载中: ${percentComplete.toFixed(2)}%`, true); // 显示红色
        } else {
            // 默认处理逻辑
            updateProgressBar(0);
            updateStatus('loading', '下载中...', true); // 显示红色
        }
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            const blob = xhr.response;
            getFileNameFromUrl(url).then(fileName => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                link.style.display = 'none'; // 隐藏下载链接
                document.body.appendChild(link);
                link.click();
                URL.revokeObjectURL(link.href); // 先释放内存
                document.body.removeChild(link);

                updateStatus('success', '下载完成', false); // 不显示红色
                enableDownloadButton();
                resetProgressBar();

                // 延迟2秒刷新页面
                setTimeout(() => {
                    // 使用 history.replaceState 更新 URL，不刷新页面
                    history.replaceState(null, document.title, window.location.pathname);
                }, 2000);
            }).catch(error => {
                handleDownloadError('获取文件名失败');
            });
        } else {
            handleDownloadError(`下载失败，状态码是 ${xhr.status}`);
        }
    };

    xhr.onerror = () => {
        handleDownloadError('下载失败');
    };

    xhr.send();
}

// 处理下载错误的函数
function handleDownloadError(message) {
    updateStatus('error', message, true);
    enableDownloadButton();
    resetProgressBar();
    console.error(message);
}

// 重置进度条的函数
function resetProgressBar() {
    const progressBarContainer = getProgressBarContainer();
    const progressBar = getProgressBar();
    if (progressBarContainer && progressBar) {
        progressBar.style.width = '0%';
        progressBarContainer.style.display = 'none'; // 隐藏进度条容器
    }
}

// 重定向到首页的函数
function redirectToHome() {
    window.location.href = 'https://github.axingchen.com';
}

// 验证URL的函数
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// 辅助函数：创建带有ID的元素
function createElementWithId(tagName, id) {
    const element = document.createElement(tagName);
    element.id = id;
    return element;
}

// 辅助函数：获取基础URL
function getBaseUrl() {
    const baseUrl = location.href.substring(0, location.href.lastIndexOf('/') + 1);
    return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

// 绑定提交事件
document.getElementById('download-btn').addEventListener('click', toSubmit);
