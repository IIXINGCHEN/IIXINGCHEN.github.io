document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('accelerateForm');
    if (!form) {
        console.error('Form with id "accelerateForm" not found');
        return;
    }

    const input = document.getElementsByName('q')[0];
    if (!input) {
        console.error('Input with name "q" not found');
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // 阻止默认提交行为

        const inputValue = input.value.trim();

        // 处理输入为空的情况
        if (!inputValue) {
            alert('请输入有效的GitHub文件链接');
            return;
        }

        // 验证输入是否以 http:// 或 https:// 开头
        if (!inputValue.startsWith('http://') && !inputValue.startsWith('https://')) {
            alert('请输入有效的GitHub文件链接');
            return;
        }

        // 验证输入是否包含 github.com
        if (!inputValue.includes('github.com')) {
            alert('请输入有效的GitHub文件链接');
            return;
        }

        // 使用更严格的正则表达式进一步验证链接格式
        const githubLinkPattern = /^https?:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\/blob\/[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/;
        if (!githubLinkPattern.test(inputValue)) {
            alert('请输入有效的GitHub文件链接');
            return;
        }

        // 使用 fetch 进行HEAD请求，验证链接是否存在和可访问
        try {
            const response = await fetch(inputValue, { method: 'HEAD' });
            if (!response.ok) {
                alert('无法打开链接，请检查链接是否有效或尝试手动打开。');
                return;
            }
        } catch (e) {
            alert('无法打开链接，请检查链接是否有效或尝试手动打开。');
            return;
        }

        // 尝试在新窗口中打开链接
        try {
            const newWindow = window.open(inputValue, '_blank');
            if (!newWindow) {
                alert('无法打开链接，请检查链接是否有效或尝试手动打开。');
            }
        } catch (e) {
            alert('无法打开链接，请检查链接是否有效或尝试手动打开。');
        }
    });
});
