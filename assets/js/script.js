// Utility to show toast
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast'; // Reset classes
    // Apply type-specific styles (assuming CSS variables are set)
    if (type === 'success') {
        toast.style.backgroundColor = 'var(--color-bg-toast-success, #00DFA2)';
        toast.style.color = 'var(--color-text-on-success, #0A0F1E)';
    } else if (type === 'error') {
        toast.style.backgroundColor = 'var(--color-bg-toast-error, #FF005C)';
        toast.style.color = 'var(--color-text-on-error, #FFFFFF)';
    } else { // info or default
        toast.style.backgroundColor = 'var(--color-bg-toast-info, #00DFFC)';
        toast.style.color = 'var(--color-text-on-accent, #0A0F1E)';
    }
    // CSS class for multi-line toast
    toast.style.whiteSpace = 'pre-line';
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 5000); // Increased duration for multi-line messages
}

// Mobile Menu Functionality
function initMobileMenu() {
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuClose = document.getElementById('mobileMenuClose');
    const mobileMenuLinks = mobileMenu ? mobileMenu.querySelectorAll('a') : [];

    function openMenu() {
        if (mobileMenu) {
            mobileMenu.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeMenu() {
        if (mobileMenu) {
            mobileMenu.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', openMenu);
        mobileMenuButton.setAttribute('aria-expanded', 'false');
    }
    if (mobileMenuClose) mobileMenuClose.addEventListener('click', closeMenu);
    mobileMenuLinks.forEach(link => link.addEventListener('click', closeMenu));

    if (mobileMenuButton && mobileMenu) {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'class') {
                    const isOpen = mobileMenu.classList.contains('show');
                    mobileMenuButton.setAttribute('aria-expanded', isOpen.toString());
                }
            });
        });
        observer.observe(mobileMenu, { attributes: true });
    }
}

// Converter Functionality
function initConverter() {
    const githubUrlInput = document.getElementById('github-url');
    const convertBtn = document.getElementById('convert-btn');
    const convertText = document.getElementById('convert-text');
    const convertSpinner = document.getElementById('convert-spinner');
    const resultContainer = document.getElementById('result-container');
    const acceleratedUrlInput = document.getElementById('accelerated-url');
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const errorMessageElement = document.getElementById('error-message');
    const mirrorSelect = document.getElementById('mirror-select');
    const exampleLinks = document.querySelectorAll('.example-link');

    exampleLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            if (githubUrlInput) {
                githubUrlInput.value = this.textContent;
                githubUrlInput.focus();
            }
        });
    });

    function showError(message) {
        if (errorMessageElement) {
            errorMessageElement.textContent = message;
            errorMessageElement.classList.remove('hidden');
        }
    }

    function hideError() {
        if (errorMessageElement) {
            errorMessageElement.classList.add('hidden');
        }
    }
    
    function generateAcceleratedUrl(githubUrl, selectedMirrorHost) {
        if (!githubUrl.startsWith('https://github.com/')) {
            throw new Error('无效的GitHub链接格式，必须以 "https://github.com/" 开头。');
        }
        
        const cleanUrl = githubUrl.split('?')[0].split('#')[0]; 
        
        const mirrorsConfig = {
            'gh.imixc.top': {
                format: (originalCleanUrl) => `https://gh.imixc.top/${originalCleanUrl.replace(/^https?:\/\//, '')}`
            },
            'github.axingchen.com': {
                format: (originalCleanUrl) => `https://github.axingchen.com/${originalCleanUrl}`
            }
        };

        let effectiveMirrorHost = selectedMirrorHost;
        if (selectedMirrorHost === 'auto' || !mirrorsConfig[selectedMirrorHost]) {
            effectiveMirrorHost = 'gh.imixc.top'; 
        }

        if (mirrorsConfig[effectiveMirrorHost]) {
            return mirrorsConfig[effectiveMirrorHost].format(cleanUrl);
        } else {
            throw new Error('选择的镜像配置错误或不受支持。');
        }
    }

    if (convertBtn) {
        convertBtn.addEventListener('click', function() {
            const githubUrl = githubUrlInput ? githubUrlInput.value.trim() : '';
            const selectedMirror = mirrorSelect ? mirrorSelect.value : 'gh.imixc.top'; 
            
            hideError();
            if (!githubUrl) {
                showError('请输入GitHub链接');
                showToast('请输入GitHub链接', 'error');
                return;
            }
            if (!githubUrl.startsWith('https://github.com/')) {
                showError('请输入以 "https://github.com/" 开头的有效GitHub链接');
                showToast('请输入有效的GitHub链接', 'error');
                return;
            }

            if (convertText) convertText.style.display = 'none';
            if (convertSpinner) convertSpinner.classList.remove('hidden');
            this.disabled = true;

            setTimeout(() => {
                try {
                    const acceleratedUrl = generateAcceleratedUrl(githubUrl, selectedMirror);
                    if (acceleratedUrlInput) acceleratedUrlInput.value = acceleratedUrl;
                    if (downloadBtn) downloadBtn.href = acceleratedUrl;
                    if (resultContainer) resultContainer.classList.remove('hidden');
                    
                    if (resultContainer) {
                         resultContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    showToast('转换成功！点击下载或复制链接。', 'success');

                } catch (error) {
                    showError(error.message);
                    showToast(`转换失败: ${error.message}`, 'error');
                } finally {
                    if (convertText) convertText.style.display = 'inline';
                    if (convertSpinner) convertSpinner.classList.add('hidden');
                    this.disabled = false;
                }
            }, 1200);
        });
    }

    if (copyBtn && acceleratedUrlInput) {
        copyBtn.addEventListener('click', function() {
            acceleratedUrlInput.select();
            acceleratedUrlInput.setSelectionRange(0, 99999); 
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    showToast('链接已复制到剪贴板!', 'success');
                    const originalIcon = this.innerHTML;
                    this.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => { this.innerHTML = originalIcon; }, 2000);
                } else {
                    showToast('复制失败。您的浏览器可能不支持此操作。', 'error');
                }
            } catch (err) {
                showToast('复制失败, 请手动复制。', 'error');
                console.error('Copy failed:', err);
            }
        });
    }
    
    if (githubUrlInput) {
        githubUrlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                if (convertBtn) convertBtn.click();
            }
        });
    }
}

// Ping Test Functionality (Using favicon.ico)
function getTestUrlForMirror(mirrorHost) {
    // All mirrors will attempt to fetch their own /favicon.ico
    return `https://${mirrorHost}/favicon.ico`;
}

async function measureLatency(mirror) {
    const testUrl = getTestUrlForMirror(mirror.name); // mirror.name is the hostname like 'gh.imixc.top'
    const startTime = performance.now();
    
    try {
        const cacheBustUrl = `${testUrl}?t=${Date.now()}&rand=${Math.random()}`; // Enhanced cache busting
        
        const response = await fetch(cacheBustUrl, {
            method: 'HEAD',
            mode: 'cors',
            cache: 'no-store', // Explicitly no-store
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);

        if (!response.ok) {
            // Log non-OK responses but still count latency if a response was received
            console.warn(`Ping test for ${mirror.displayName} (${testUrl}) returned status: ${response.status}`);
            // Consider a higher effective latency for non-OK responses if desired
            // For now, we use the measured time if a response (even error) was received within timeout
            return { ...mirror, ping: latency, error: `Status ${response.status}` };
        }
        return { ...mirror, ping: latency, error: null };

    } catch (error) {
        // endTime might not be accurate if timeout occurs before fetch even starts network activity.
        // performance.now() at catch time is a better measure for total time until error.
        const endTime = performance.now(); 
        const duration = Math.round(endTime - startTime);

        console.error(`Ping test error for ${mirror.displayName} (${testUrl}):`, error.name, error.message);
        
        if (error.name === 'AbortError') {
             return { ...mirror, ping: duration, error: '超时' }; // Timeout
        }
        // For other errors (network, CORS, etc.), also use duration.
        // If ping is high, it implies an issue. Infinity was too harsh.
        return { ...mirror, ping: duration, error: error.name === 'TypeError' ? 'CORS或网络错误' : (error.name || '未知错误') };
    }
}

function initPingTest() {
    const pingBtn = document.getElementById('ping-btn');
    const mirrorSelect = document.getElementById('mirror-select');

    if (pingBtn && mirrorSelect) {
        pingBtn.addEventListener('click', async function() {
            const originalIconHTML = this.innerHTML;
            this.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
            this.disabled = true;
            mirrorSelect.disabled = true;

            const mirrorsToPing = [
                { name: 'gh.imixc.top', displayName: '节点1 (gh.imixc.top)'},
                { name: 'github.axingchen.com', displayName: '节点2 (github.axingchen.com)'}
            ];

            showToast('正在为各节点测速，请稍候...\n这可能需要几秒钟。', 'info');

            const results = [];
            // Sequential pings to avoid network contention issues from concurrent requests
            for (const mirror of mirrorsToPing) {
                const result = await measureLatency(mirror);
                results.push(result);
            }
            
            results.sort((a, b) => a.ping - b.ping); // Sort by ping time, lowest first
            
            let toastMessage = "测速结果 (越小越好):\n";
            results.forEach(res => {
                toastMessage += `${res.displayName}: ${res.error ? res.error + ` (${res.ping}ms)` : res.ping + 'ms'}\n`;
            });

            if (results.length > 0 && !results[0].error) { // Check if the fastest had no error
                const fastest = results[0];
                // mirrorSelect.value = fastest.name; // Auto-select the fastest
                toastMessage += `\n推荐节点: ${fastest.displayName}`;
                 // Re-sort by error presence then ping, to prefer non-erroring nodes
                results.sort((a, b) => {
                    if (a.error && !b.error) return 1;
                    if (!a.error && b.error) return -1;
                    return a.ping - b.ping;
                });
                if (results[0] && !results[0].error) {
                    mirrorSelect.value = results[0].name;
                    showToast(toastMessage.trim(), 'success');
                } else {
                     showToast(toastMessage.trim(), 'info'); // Info if best has error
                }

            } else if (results.length > 0) { // All might have errors but we have data
                 showToast(toastMessage.trim(), 'info'); // Use info if best has error
            }
            else { // Should not happen if mirrorsToPing is not empty
                showToast("无法获取测速节点信息。", 'error');
            }
            
            this.innerHTML = originalIconHTML;
            this.disabled = false;
            mirrorSelect.disabled = false;
        });
    }
}

// Fade-in elements on scroll
function initScrollFadeIn() {
    const fadeElements = document.querySelectorAll('.fade-in');
    if (!fadeElements.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = parseFloat(getComputedStyle(entry.target).transitionDelay) * 1000 || 0;
                setTimeout(() => {
                    entry.target.classList.remove('fade-in-initial');
                }, delay);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    fadeElements.forEach(el => {
        el.classList.add('fade-in-initial');
        observer.observe(el);
    });
}


// DOMContentLoaded to initialize all scripts
document.addEventListener('DOMContentLoaded', function() {
    initMobileMenu();
    initConverter();
    initPingTest();
    initScrollFadeIn();

    const mirrorSelect = document.getElementById('mirror-select');
    if (mirrorSelect) {
        const allowedMirrors = [
            { value: 'auto', text: '自动选择 (默认 节点1)' },
            { value: 'gh.imixc.top', text: '节点1 (gh.imixc.top)' },
            { value: 'github.axingchen.com', text: '节点2 (github.axingchen.com)' },
        ];
        
        while (mirrorSelect.options.length > 0) {
            mirrorSelect.remove(0);
        }
        allowedMirrors.forEach(mirror => {
            const option = new Option(mirror.text, mirror.value);
            mirrorSelect.add(option);
        });
        mirrorSelect.value = 'auto'; 
    }
});
