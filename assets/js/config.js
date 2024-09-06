// config.js

// 配置常量用于定义下载管理器的行为和限制
export const CONFIG = {
    MAX_RETRIES: 3, // 最大重试次数，用于在下载失败时重试
    DOWNLOAD_TIMEOUT_MS: 120000, // 下载超时时间（以毫秒为单位），这里设置为2分钟
    MAX_FILE_SIZE_BYTES: 1024 * 1024 * 1024, // 最大文件大小限制（字节），即1GB

    // 正则表达式，用于验证输入的URL是否为支持的格式
    VALID_URL_REGEX: /^https:\/\/(github\.com|gist\.githubusercontent\.com)\/([\w-]+)\/([\w-]+)(\/releases\/download|\/archive\/refs\/tags|\/blob|\/raw)\/([\w\.-]+)(\/[\w\.-]+)?(\?.*)?$/,

    // 定义不同类型文件的扩展名，用于检查文件类型
    FILE_TYPES: {
        DOCUMENT: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
        IMAGE: ['jpg', 'jpeg', 'png', 'gif'],
        ARCHIVE: ['zip', 'rar', 'tar', 'gz'],
        CODE: ['js', 'css', 'html', 'json'],
        INSTALLER: ['deb', 'dmg', 'rpm', 'exe', 'sh']
    }
};

// 信息常量，用于在界面上向用户显示各种状态和错误信息
export const MESSAGES = {
    ERROR_UNKNOWN: '发生未知错误，请稍后重试', // 未知错误提示
    ERROR_EMPTY_URL: '请输入 GitHub 文件链接', // 空URL提示

    // 错误的URL提示
    ERROR_INVALID_URL: '请输入有效的 GitHub 文件链接',

    // 下载超时提示
    ERROR_DOWNLOAD_TIMEOUT: '下载超时，请检查网络连接或稍后重试',

    // 文件过大提示
    ERROR_FILE_TOO_LARGE: '文件太大，无法下载。请选择小于1GB的文件。',

    // 下载中断提示
    ERROR_STREAM_INTERRUPTED: '下载中断，请稍后重试',

    // 下载失败提示
    ERROR_DOWNLOAD_FAILED: '下载失败，请稍后重试',

    // 网络错误提示
    ERROR_NETWORK: '网络错误',

    // 无法识别的文件类型提示
    ERROR_INVALID_FILE_TYPE: '文件类型不符，下载已取消',

    // 下载成功提示
    SUCCESS_DOWNLOAD_COMPLETE: '下载完成',

    // 下载统计信息
    INFO_TOTAL_DOWNLOADS: '总下载次数：',

    // 准备下载提示
    INFO_PREPARING_DOWNLOAD: '准备下载...'
};
