// utils.js
import { CONFIG, MESSAGES } from './config.js';

export function debounce(func, delayMs) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delayMs);
    };
}

export function isValidUrl(url) {
    if (!CONFIG || !CONFIG.VALID_URL_REGEX) {
        throw new Error('CONFIG or CONFIG.VALID_URL_REGEX is not defined');
    }
    return CONFIG.VALID_URL_REGEX.test(url);
}

export function getFilenameFromUrl(url) {
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    return decodeURIComponent(lastPart);
}

export function showElement(element) {
    if (element && element.classList) {
        element.classList.remove('hidden');
    }
}

export function hideElement(element) {
    if (element && element.classList) {
        element.classList.add('hidden');
    }
}

export function setElementText(element, text) {
    if (element) {
        element.textContent = text;
    }
}

export function createDownloadLink(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a); // 将 a 元素添加到 DOM 中
    a.click(); // 触发点击事件
    document.body.removeChild(a); // 下载完成后移除 a 元素
    return { element: a, url };
}

export function revokeObjectUrl(url) {
    URL.revokeObjectURL(url);
}

export function addAccessibility(elements) {
    const interactiveElements = document.querySelectorAll('button, a, input, select');
    interactiveElements.forEach(element => {
        if (!element.getAttribute('aria-label')) {
            element.setAttribute('aria-label', element.textContent || element.value);
        }
    });

    if (elements.progressBar && elements.progressBar instanceof HTMLElement) {
        elements.progressBar.setAttribute('role', 'progressbar');
        elements.progressBar.setAttribute('aria-valuemin', '0');
        elements.progressBar.setAttribute('aria-valuemax', '100');
    }
}
