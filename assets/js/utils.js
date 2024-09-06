// utils.js
// 从配置模块引入 CONFIG 和 MESSAGES
import { CONFIG, MESSAGES } from './config.js';

/**
 * 防抖函数
 * 确保函数只在特定时间间隔后执行，用于避免频繁触发的事件
 * @param {Function} func - 需要防抖处理的函数
 * @param {number} delayMs - 防抖延迟的时间（毫秒）
 */
export function debounce(func, delayMs) {
    let timeoutId; // 用于存储定时器ID
    return function (...args) {
        clearTimeout(timeoutId); // 清除之前的定时器
        // 创建新的定时器，在延迟结束后执行函数
        timeoutId = setTimeout(() => func.apply(this, args), delayMs);
    };
}

/**
 * 验证URL是否符合预期格式
 * @param {string} url - 需要验证的URL
 * @returns {boolean} - 返回URL格式是否有效
 */
export function isValidUrl(url) {
    if (!CONFIG || !CONFIG.VALID_URL_REGEX) {
        throw new Error('CONFIG 或 CONFIG.VALID_URL_REGEX 未定义'); // 如果配置未定义则抛出错误
    }
    return CONFIG.VALID_URL_REGEX.test(url); // 使用正则表达式验证URL格式
}

/**
 * 从URL解析出文件名
 * @param {string} url - 包含文件名的URL
 * @returns {string} - 解析出的文件名
 */
export function getFilenameFromUrl(url) {
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1]; // 获取URL最后部分
    return decodeURIComponent(lastPart); // 解码处理，防止有编码的字符
}

/**
 * 显示指定的DOM元素
 * @param {HTMLElement} element - 需要显示的DOM元素
 */
export function showElement(element) {
    if (element && element.classList) {
        element.classList.remove('hidden'); // 移除隐藏类使元素可见
    }
}

/**
 * 隐藏指定的DOM元素
 * @param {HTMLElement} element - 需要隐藏的DOM元素
 */
export function hideElement(element) {
    if (element && element.classList) {
        element.classList.add('hidden'); // 添加隐藏类使元素不可见
    }
}

/**
 * 设置DOM元素的文本内容
 * @param {HTMLElement} element - 需要设置文本的DOM元素
 * @param {string} text - 要设置的文本内容
 */
export function setElementText(element, text) {
    if (element) {
        element.textContent = text; // 设置元素的文本内容
    }
}

/**
 * 创建用于下载文件的链接并自动触发下载
 * @param {Blob} blob - 包含文件数据的Blob对象
 * @param {string} fileName - 下载时用作文件名
 * @returns {Object} - 包含链接元素和URL对象的对象
 */
export function createDownloadLink(blob, fileName) {
    const url = URL.createObjectURL(blob); // 创建文件URL
    const a = document.createElement('a'); // 创建一个链接元素
    a.href = url;
    a.download = fileName; // 指定下载文件名
    a.style.display = 'none'; // 隐藏链接不影响页面布局
    document.body.appendChild(a); // 将链接添加至DOM
    a.click(); // 自动触发点击事件，开始下载
    document.body.removeChild(a); // 移除链接避免污染DOM
    return { element: a, url }; // 返回用于后续清理的对象
}

/**
 * 释放之前创建的URL对象
 * @param {string} url - 需要释放的URL
 */
export function revokeObjectUrl(url) {
    URL.revokeObjectURL(url); // 释放内存中的URL对象
}

/**
 * 为页面元素添加无障碍辅助属性
 * @param {Object} elements - 需要添加属性的DOM元素集合
 */
export function addAccessibility(elements) {
    const interactiveElements = document.querySelectorAll('button, a, input, select');
    interactiveElements.forEach(element => {
        // 如果元素没有设置aria-label，则使用其文本内容或值作为标签
        if (!element.getAttribute('aria-label')) {
            element.setAttribute('aria-label', element.textContent || element.value);
        }
    });

    // 设置进度条的无障碍属性
    if (elements.progressBar && elements.progressBar instanceof HTMLElement) {
        elements.progressBar.setAttribute('role', 'progressbar'); // 指定角色为进度条
        elements.progressBar.setAttribute('aria-valuemin', '0'); // 设置最小值
        elements.progressBar.setAttribute('aria-valuemax', '100'); // 设置最大值
    }
}
