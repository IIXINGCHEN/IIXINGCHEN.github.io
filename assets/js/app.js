// app.js

// 从配置文件和工具模块中导入所需内容
import { MESSAGES } from './config.js';
import * as Utils from './utils.js';
import { DownloadManager } from './downloadManager.js';

/**
 * GitHubDownloaderApp 类
 * 负责初始化应用并处理用户下载请求
 */
class GitHubDownloaderApp {
    constructor() {
        // 缓存页面中的关键DOM元素
        this.elements = {
            downloadForm: document.getElementById('downloadForm'),
            urlInput: document.getElementById('urlInput'),
            loader: document.getElementById('loader'),
            errorMessage: document.getElementById('errorMessage'),
            downloadButton: document.getElementById('submitButton'),
            progressBar: document.getElementById('progressBar'),
            downloadCountDisplay: document.getElementById('downloadCountDisplay')
        };

        // 确保所有必要的DOM元素已存在，然后初始化下载管理器
        if (this.elements.downloadForm && this.elements.urlInput && this.elements.loader && 
            this.elements.errorMessage && this.elements.downloadButton && 
            this.elements.progressBar && this.elements.downloadCountDisplay) {
            this.downloadManager = new DownloadManager(this.elements);
            this.initializeEventListeners();  // 初始化事件监听器
            this.initializeDownloadCount();   // 初始化下载计数
            Utils.addAccessibility(this.elements);  // 为元素添加辅助功能属性
        } else {
            console.error('缺少一些必要的DOM元素，无法初始化GitHubDownloaderApp。');
        }
    }

    /**
     * 初始化事件监听器
     */
    initializeEventListeners() {
        // 监听下载表单的提交事件
        if (this.elements.downloadForm) {
            this.elements.downloadForm.addEventListener('submit', this.handleSubmit);
        }

        // 监听下载按钮的点击事件
        if (this.elements.downloadButton) {
            this.elements.downloadButton.addEventListener('click', this.handleSubmit);
        }

        // 捕获未处理的全局错误
        window.addEventListener('error', this.handleGlobalError);
    }

    /**
     * 处理表单提交事件
     * @param {Event} event - 事件对象
     */
    handleSubmit = async (event) => {
        event.preventDefault();  // 阻止表单的默认提交行为
        const url = this.elements.urlInput.value.trim();  // 获取并去除输入URL的空格

        if (!url) {
            this.downloadManager.showError(MESSAGES.ERROR_EMPTY_URL);
            return;
        }

        if (!Utils.isValidUrl(url)) {
            this.downloadManager.showError(MESSAGES.ERROR_INVALID_URL);
            return;
        }

        try {
            // 调用下载管理器处理下载请求
            await this.downloadManager.handleDownloadRequest(url);
        } catch (error) {
            // 根据错误类型显示相应的错误信息
            if (error.name === 'AbortError') {
                console.warn('下载被中止');
            } else if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                this.downloadManager.showError(MESSAGES.ERROR_FETCH_FAILED);
            } else {
                console.error('下载错误:', error);
                this.downloadManager.showError(MESSAGES.ERROR_UNKNOWN);
            }
        }
    }

    /**
     * 处理全局错误
     * @param {Event} event - 错误事件对象
     */
    handleGlobalError = (event) => {
        const error = event.error || new Error('未知错误');
        console.error('全局错误:', error);
        this.downloadManager.showError(MESSAGES.ERROR_UNKNOWN);
    }

    /**
     * 初始化下载计数显示
     */
    initializeDownloadCount() {
        if (this.elements.downloadCountDisplay) {
            Utils.setElementText(
                this.elements.downloadCountDisplay, 
                `${MESSAGES.INFO_TOTAL_DOWNLOADS}${this.downloadManager.downloadCount}`
            );
        }
    }
}

// 在文档加载完成后实例化GitHubDownloaderApp
document.addEventListener('DOMContentLoaded', () => {
    new GitHubDownloaderApp();
});
