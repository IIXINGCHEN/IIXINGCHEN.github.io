// config.js
export const CONFIG = {
    MAX_RETRIES: 3,
    DOWNLOAD_TIMEOUT_MS: 120000, // 增加超时时间到 2 分钟
    MAX_FILE_SIZE_BYTES: 1024 * 1024 * 1024, // 1GB
    VALID_URL_REGEX: /^https:\/\/(github\.com|gist\.githubusercontent\.com)\/([\w-]+)\/([\w-]+)(\/releases\/download|\/archive\/refs\/tags|\/blob|\/raw)\/([\w\.-]+)(\/[\w\.-]+)?(\?.*)?$/, // 更新正则表达式以支持更多 URL 模式
    FILE_TYPES: {
        DOCUMENT: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
        IMAGE: ['jpg', 'jpeg', 'png', 'gif'],
        ARCHIVE: ['zip', 'rar', 'tar', 'gz'],
        CODE: ['js', 'css', 'html', 'json'],
        INSTALLER: ['deb', 'dmg', 'rpm', 'exe', 'sh']
    }
};

export const MESSAGES = {
    ERROR_UNKNOWN: '发生未知错误，请稍后重试',
    ERROR_EMPTY_URL: '请输入 GitHub 文件链接',
    ERROR_INVALID_URL: '请输入有效的 GitHub 文件链接',
    ERROR_DOWNLOAD_TIMEOUT: '下载超时，请检查网络连接或稍后重试',
    ERROR_FILE_TOO_LARGE: '文件太大，无法下载。请选择小于1GB的文件。',
    ERROR_STREAM_INTERRUPTED: '下载中断，请稍后重试',
    ERROR_DOWNLOAD_FAILED: '下载失败，请稍后重试',
    ERROR_NETWORK: '网络错误',
    ERROR_INVALID_FILE_TYPE: '文件类型不符，下载已取消',
    SUCCESS_DOWNLOAD_COMPLETE: '下载完成',
    INFO_TOTAL_DOWNLOADS: '总下载次数：',
    INFO_PREPARING_DOWNLOAD: '准备下载...'
};
