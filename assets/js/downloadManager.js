// downloadManager.js
import { CONFIG, MESSAGES } from './config.js';
import * as Utils from './utils.js';

/**
 * 下载管理器类
 * 负责处理从输入URL进行加速下载的业务逻辑
 */
export class DownloadManager {
    constructor(elements) {
        // 初始化时传入的DOM元素集合
        this.elements = elements;

        // 从本地存储中获取已下载的计数
        this.downloadCount = parseInt(localStorage.getItem('downloadCount')) || 0;

        // 用于控制下载超时的定时器
        this.downloadTimeout = null;
    }

    /**
     * 处理单个下载请求
     * @param {string} url - 要下载的文件的URL
     */
    async handleDownloadRequest(url) {
        this.showLoader();  // 显示加载动画
        this.hideError();  // 隐藏错误信息
        this.resetProgressBar();  // 重置进度条

        let retryCount = 0;  // 记录重试次数

        // 封装下载尝试逻辑的异步函数
        const attemptDownload = async () => {
            if (this.downloadTimeout) {
                clearTimeout(this.downloadTimeout);
            }

            // 设置一个用于处理下载超时的定时器
            this.downloadTimeout = setTimeout(() => {
                this.hideLoader();
                if (retryCount < CONFIG.MAX_RETRIES) {
                    retryCount++;
                    attemptDownload();
                } else {
                    this.showError(MESSAGES.ERROR_DOWNLOAD_TIMEOUT);
                }
            }, CONFIG.DOWNLOAD_TIMEOUT_MS);

            try {
                // 发起网络请求下载文件
                const response = await fetch(url, { method: 'GET' });

                if (!response.ok) {
                    throw new Error(`${MESSAGES.ERROR_NETWORK} (${response.status})`);
                }

                const contentLength = parseInt(response.headers.get('Content-Length'), 10) || 0;

                // 检查文件大小是否符合配置要求
                if (contentLength > CONFIG.MAX_FILE_SIZE_BYTES) {
                    throw new Error(MESSAGES.ERROR_FILE_TOO_LARGE);
                }

                // 处理响应并生成Blob对象
                const blob = await this.streamResponse(response, contentLength);
                clearTimeout(this.downloadTimeout);
                const fileName = Utils.getFilenameFromUrl(url);  // 解析URL获取文件名
                this.handleDownload({ blob, fileName });
                this.updateDownloadCount();  // 更新下载计数
            } catch (error) {
                clearTimeout(this.downloadTimeout);
                this.showError(error.message || MESSAGES.ERROR_DOWNLOAD_FAILED);
                console.error('Download error:', error);
            } finally {
                this.hideLoader();
                this.resetProgressBar();
            }
        };

        await attemptDownload();
    }

    /**
     * 流式读取响应数据并更新进度条
     * @param {Response} response - fetch API的响应对象
     * @param {number} contentLength - 文件大小
     * @returns {Blob} - 表示下载文件的Blob对象
     */
    async streamResponse(response, contentLength) {
        const reader = response.body.getReader();
        let receivedLength = 0;  // 累积已接收的数据长度
        const chunks = [];  // 存储数据块的数组

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;  // 读取完成时跳出循环

            chunks.push(value);
            receivedLength += value.length;

            if (contentLength) {
                this.updateProgressBar(receivedLength, contentLength);
            }
        }

        return new Blob(chunks);  // 返回包含所有数据块的Blob对象
    }

    /**
     * 处理下载并保存文件
     * @param {Object} param0 - 包含Blob对象和文件名的对象
     */
    handleDownload({ blob, fileName }) {
        const validMimeTypes = [
            'application/pdf', 'image/jpeg', 'image/png', 'text/plain', 
            'application/zip', 'application/x-tar', 'application/gzip', 
            'application/x-debian-package', 'application/x-apple-diskimage', 
            'application/x-rpm', 'application/x-msdos-program', 'text/x-shellscript'
        ];  // 合法的MIME类型

        if (!validMimeTypes.includes(blob.type)) {
            Utils.showNotification(MESSAGES.ERROR_INVALID_FILE_TYPE, 'error');
            return;
        }

        if (blob.size > CONFIG.MAX_FILE_SIZE_BYTES) {
            Utils.showNotification(MESSAGES.ERROR_FILE_TOO_LARGE, 'error');
            return;
        }

        const { element, url } = Utils.createDownloadLink(blob, fileName);
        document.body.appendChild(element);
        element.click();  // 触发点击事件开始下载

        (async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            document.body.removeChild(element);
            Utils.revokeObjectUrl(url);
            Utils.showNotification(MESSAGES.SUCCESS_DOWNLOAD_COMPLETE, 'success');
        })();
    }

    showLoader() {
        // 显示加载动画
        Utils.showElement(this.elements.loader);
        this.elements.downloadButton?.setAttribute('disabled', 'true');
    }

    hideLoader() {
        // 隐藏加载动画
        Utils.hideElement(this.elements.loader);
        this.elements.downloadButton?.removeAttribute('disabled');
    }

    showError(message) {
        // 显示错误信息
        if (this.elements.errorMessage) {
            Utils.setElementText(this.elements.errorMessage, message || MESSAGES.ERROR_UNKNOWN);
            Utils.showElement(this.elements.errorMessage);
        }
    }

    hideError() {
        // 隐藏错误信息
        Utils.hideElement(this.elements.errorMessage);
    }

    /**
     * 更新进度条的显示
     * @param {number} loaded - 已加载的数据量
     * @param {number} total - 总数据量
     */
    updateProgressBar(loaded, total) {
        if (this.elements.progressBar) {
            const progress = total ? (loaded / total) * 100 : 0;
            this.elements.progressBar.style.width = `${progress}%`;
            Utils.setElementText(this.elements.progressBar, total ? `${Math.round(progress)}%` : MESSAGES.INFO_PREPARING_DOWNLOAD);
            Utils.showElement(this.elements.progressBar);
        }
    }

    /**
     * 重置进度条
     */
    resetProgressBar() {
        if (this.elements.progressBar) {
            this.elements.progressBar.style.width = '0%';
            Utils.setElementText(this.elements.progressBar, '');
            Utils.hideElement(this.elements.progressBar);
        }
    }

    /**
     * 更新下载计数并存储至本地存储
     */
    updateDownloadCount() {
        try {
            this.downloadCount++;
            localStorage.setItem('downloadCount', this.downloadCount.toString());
            if (this.elements.downloadCountDisplay) {
                Utils.setElementText(this.elements.downloadCountDisplay, `${MESSAGES.INFO_TOTAL_DOWNLOADS}${this.downloadCount}`);
            }
        } catch (e) {
            console.error('Failed to update download count:', e);
        }
    }
}
