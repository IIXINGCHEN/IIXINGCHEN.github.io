const GITHUB_RELEASES_ARCHIVE_REGEX = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/(releases|archive)\/.*$/i;
const GITHUB_BLOB_RAW_REGEX = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/(blob|raw)\/.*$/i;
const GITHUB_INFO_GIT_REGEX = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/(info|git-).*$/i;
const GITHUB_RAW_CONTENT_REGEX = /^https?:\/\/raw\.(githubusercontent|github)\.com\/[^/]+\/[^/]+\/[^/]+\/[^/]+$/i;
const GITHUB_GIST_REGEX = /^https?:\/\/gist\.(githubusercontent|github)\.com\/[^/]+\/[^/]+\/[^/]+$/i;
const GITHUB_TAGS_REGEX = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/tags.*$/i;

document.getElementById('downloadForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const urlInput = document.getElementsByName('q')[0];
    const urlValue = urlInput.value.trim();

    if (!isValidGitHubUrl(urlValue)) {
        alert('请输入有效的GitHub文件链接');
        urlInput.value = ''; // 清空输入框
        return;
    }

    // 服务器处理这个请求并返回文件内容
    const baseUrl = window.location.origin + window.location.pathname;
    const fileUrl = encodeURIComponent(urlValue);
    const requestUrl = `${baseUrl}?q=${fileUrl}`;

    fetch(requestUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('网络响应失败');
            }
            const contentDisposition = response.headers.get('Content-Disposition');
            let fileName = 'downloaded_file';
            if (contentDisposition && contentDisposition.includes('filename=')) {
                fileName = contentDisposition.split('filename=')[1].replace(/['"]/g, '');
            } else {
                const urlParts = urlValue.split('/');
                fileName = urlParts[urlParts.length - 1];
            }
            return response.blob().then(blob => ({ blob, fileName }));
        })
        .then(({ blob, fileName }) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName; // 动态设置文件名
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        })
        .catch(error => {
            console.error('下载失败:', error);
            alert('下载失败，请重试');
        });
});

function isValidGitHubUrl(url) {
    return GITHUB_RELEASES_ARCHIVE_REGEX.test(url) ||
        GITHUB_BLOB_RAW_REGEX.test(url) ||
        GITHUB_INFO_GIT_REGEX.test(url) ||
        GITHUB_RAW_CONTENT_REGEX.test(url) ||
        GITHUB_GIST_REGEX.test(url) ||
        GITHUB_TAGS_REGEX.test(url);
}
