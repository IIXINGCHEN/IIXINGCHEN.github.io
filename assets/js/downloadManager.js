// downloadManager.js
import { CONFIG, MESSAGES } from './config.js';
import * as Utils from './utils.js';

export class DownloadManager {
    constructor(elements) {
        this.elements = elements;
        this.downloadCount = parseInt(localStorage.getItem('downloadCount')) || 0;
        this.downloadTimeout = null;
    }

    async handleDownloadRequest(url) {
        this.showLoader();
        this.hideError();
        this.resetProgressBar();

        let retryCount = 0;
        const attemptDownload = async () => {
            if (this.downloadTimeout) {
                clearTimeout(this.downloadTimeout);
            }

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
                const response = await fetch(url, { method: 'GET' });

                if (!response.ok) {
                    throw new Error(`${MESSAGES.ERROR_NETWORK} (${response.status})`);
                }

                const contentLength = parseInt(response.headers.get('Content-Length'), 10) || 0;

                if (contentLength > CONFIG.MAX_FILE_SIZE_BYTES) {
                    throw new Error(MESSAGES.ERROR_FILE_TOO_LARGE);
                }

                const blob = await this.streamResponse(response, contentLength);
                clearTimeout(this.downloadTimeout);
                const fileName = Utils.getFilenameFromUrl(url);
                this.handleDownload({ blob, fileName });
                this.updateDownloadCount();
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

    async streamResponse(response, contentLength) {
        const reader = response.body.getReader();
        let receivedLength = 0;
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
            if (contentLength) {
                this.updateProgressBar(receivedLength, contentLength);
            }
        }

        return new Blob(chunks);
    }

    handleDownload({ blob, fileName }) {
        const validMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'text/plain', 'application/zip', 'application/x-tar', 'application/gzip', 'application/x-debian-package', 'application/x-apple-diskimage', 'application/x-rpm', 'application/x-msdos-program', 'text/x-shellscript']; // 根据实际需求添加更多 MIME 类型
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
        element.click();

        (async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            document.body.removeChild(element);
            Utils.revokeObjectUrl(url);
            Utils.showNotification(MESSAGES.SUCCESS_DOWNLOAD_COMPLETE, 'success');
        })();
    }

    showLoader() {
        Utils.showElement(this.elements.loader);
        this.elements.downloadButton?.setAttribute('disabled', 'true');
    }

    hideLoader() {
        Utils.hideElement(this.elements.loader);
        this.elements.downloadButton?.removeAttribute('disabled');
    }

    showError(message) {
        if (this.elements.errorMessage) {
            Utils.setElementText(this.elements.errorMessage, message || MESSAGES.ERROR_UNKNOWN);
            Utils.showElement(this.elements.errorMessage);
        }
    }

    hideError() {
        Utils.hideElement(this.elements.errorMessage);
    }

    updateProgressBar(loaded, total) {
        if (this.elements.progressBar) {
            const progress = total ? (loaded / total) * 100 : 0;
            this.elements.progressBar.style.width = `${progress}%`;
            Utils.setElementText(this.elements.progressBar, total ? `${Math.round(progress)}%` : MESSAGES.INFO_PREPARING_DOWNLOAD);
            Utils.showElement(this.elements.progressBar);
        }
    }

    resetProgressBar() {
        if (this.elements.progressBar) {
            this.elements.progressBar.style.width = '0%';
            Utils.setElementText(this.elements.progressBar, '');
            Utils.hideElement(this.elements.progressBar);
        }
    }

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
