document.getElementById('downloadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const urlInput = document.getElementsByName('q')[0];
    if (urlInput.value.trim() === '') {
        alert('请输入有效的GitHub文件链接');
        return;
    }

    try {
        const response = await fetch(urlInput.value);
        if (!response.ok) {
            throw new Error('网络请求失败');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = new URL(urlInput.value).pathname.split('/').pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('下载失败:', error);
        alert('下载失败，请检查链接是否正确');
    }
});
