document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('accelerateForm');
    const resultDiv = document.getElementById('result');
    const urlInput = form.querySelector('input[name="q"]');

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const url = urlInput.value.trim();

        if (validateUrl(url)) {
            // 实际的加速逻辑应该在这里实现
            // 这里我们模拟一个异步操作
            showLoading();
            setTimeout(() => {
                const acceleratedUrl = generateAcceleratedUrl(url);
                showResult(`加速链接生成成功！<br><a href="${acceleratedUrl}" target="_blank">${acceleratedUrl}</a>`, true);
            }, 1500);
        } else {
            showResult('请输入有效的GitHub文件链接', false);
        }
    });

    function validateUrl(url) {
        return url.startsWith('https://github.com/') && url.includes('/blob/');
    }

    function showResult(message, isSuccess) {
        resultDiv.innerHTML = message;
        resultDiv.className = 'result ' + (isSuccess ? 'success' : 'error');
        resultDiv.style.display = 'block';
    }

    function showLoading() {
        resultDiv.textContent = '正在生成加速链接...';
        resultDiv.className = 'result';
        resultDiv.style.display = 'block';
    }

    function generateAcceleratedUrl(originalUrl) {
        // 这里应该是实际的URL转换逻辑
        return originalUrl.replace('github.com', 'raw.githubusercontent.com')
                          .replace('/blob/', '/');
    }

    // 添加输入验证反馈
    urlInput.addEventListener('input', function() {
        if (this.value.trim() && !validateUrl(this.value.trim())) {
            this.setCustomValidity('请输入有效的GitHub文件链接');
        } else {
            this.setCustomValidity('');
        }
    });
});
