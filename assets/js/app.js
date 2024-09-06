// app.js
import { MESSAGES } from './config.js';
import * as Utils from './utils.js';
import { DownloadManager } from './downloadManager.js';

class GitHubDownloaderApp {
    constructor() {
        this.elements = {
            downloadForm: document.getElementById('downloadForm'),
            urlInput: document.getElementById('urlInput'),
            loader: document.getElementById('loader'),
            errorMessage: document.getElementById('errorMessage'),
            downloadButton: document.getElementById('submitButton'),
            progressBar: document.getElementById('progressBar'),
            downloadCountDisplay: document.getElementById('downloadCountDisplay')
        };

        // 确保所有元素都存在后再初始化 downloadManager
        if (this.elements.downloadForm && this.elements.urlInput && this.elements.loader && this.elements.errorMessage && this.elements.downloadButton && this.elements.progressBar && this.elements.downloadCountDisplay) {
            this.downloadManager = new DownloadManager(this.elements);
            this.initializeEventListeners();
            this.initializeDownloadCount();
            Utils.addAccessibility(this.elements);
        } else {
            console.error('Some elements are missing. Unable to initialize GitHubDownloaderApp.');
        }
    }

    initializeEventListeners() {
        if (this.elements.downloadForm) {
            this.elements.downloadForm.addEventListener('submit', this.handleSubmit);
        }

        if (this.elements.downloadButton) {
            this.elements.downloadButton.addEventListener('click', this.handleSubmit);
        }

        window.addEventListener('error', this.handleGlobalError);
    }

    handleSubmit = async (event) => {
        event.preventDefault();
        const url = this.elements.urlInput.value.trim();

        if (!url) {
            this.downloadManager.showError(MESSAGES.ERROR_EMPTY_URL);
            return;
        }

        if (!Utils.isValidUrl(url)) {
            this.downloadManager.showError(MESSAGES.ERROR_INVALID_URL);
            return;
        }

        try {
            await this.downloadManager.handleDownloadRequest(url);
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('Download aborted');
            } else if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                this.downloadManager.showError(MESSAGES.ERROR_FETCH_FAILED);
            } else {
                console.error('Download error:', error);
                this.downloadManager.showError(MESSAGES.ERROR_UNKNOWN);
            }
        }
    }

    handleGlobalError = (event) => {
        const error = event.error || new Error('Unknown error');
        console.error('Global error:', error);
        this.downloadManager.showError(MESSAGES.ERROR_UNKNOWN);
    }

    initializeDownloadCount() {
        if (this.elements.downloadCountDisplay) {
            Utils.setElementText(this.elements.downloadCountDisplay, `${MESSAGES.INFO_TOTAL_DOWNLOADS}${this.downloadManager.downloadCount}`);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GitHubDownloaderApp();
});
