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

    form.addEventListener('submit', (event) => {
        event.preventDefault(); // 阻止默认提交行为

        const inputValue = input.value.trim();

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

        // 使用正则表达式进一步验证链接格式
        const githubLinkPattern = /^https?:\/\/github\.com\/.+\/.+\/blob\/.+/;
        if (!githubLinkPattern.test(inputValue)) {
            alert('请输入有效的GitHub文件链接');
            return;
        }

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
