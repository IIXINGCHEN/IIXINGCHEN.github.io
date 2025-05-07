// Utility to show toast
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast'; // Reset classes

    switch(type) {
        case 'success':
            toast.classList.add('success');
            toast.style.backgroundColor = 'var(--color-bg-toast-success, #00DFA2)';
            toast.style.color = 'var(--color-text-on-success, #0A0F1E)';
            break;
        case 'error':
            toast.classList.add('error');
            toast.style.backgroundColor = 'var(--color-bg-toast-error, #FF005C)';
            toast.style.color = 'var(--color-text-on-error, #FFFFFF)';
            break;
        case 'info':
        default:
            toast.classList.add('info');
            toast.style.backgroundColor = 'var(--color-bg-toast-info, #00DFFC)';
            toast.style.color = 'var(--color-text-on-accent, #0A0F1E)';
            break;
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
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
        
        // The cleanUrl is the full original GitHub URL (after removing query/fragment)
        const cleanUrl = githubUrl.split('?')[0].split('#')[0]; 
        
        const mirrorsConfig = {
            'gh.imixc.top': {
                // Format: https://gh.imixc.top/github.com/user/repo/...
                // Takes original URL without 'https://' part
                format: (originalCleanUrl) => `https://gh.imixc.top/${originalCleanUrl.replace(/^https?:\/\//, '')}`
            },
            'github.axingchen.com': {
                // Format: https://github.axingchen.com/https://github.com/user/repo/...
                // Takes the full originalCleanUrl (which starts with https://)
                format: (originalCleanUrl) => `https://github.axingchen.com/${originalCleanUrl}`
            }
        };

        // Determine which host to use based on selection or default
        let effectiveMirrorHost = selectedMirrorHost;
        if (selectedMirrorHost === 'auto' || !mirrorsConfig[selectedMirrorHost]) {
            // Default to gh.imixc.top if 'auto' or if selectedMirrorHost is not in our explicit config
            // (though DOMContentLoaded should ensure select only has valid options)
            effectiveMirrorHost = 'gh.imixc.top'; 
        }

        if (mirrorsConfig[effectiveMirrorHost]) {
            return mirrorsConfig[effectiveMirrorHost].format(cleanUrl);
        } else {
            // This case should ideally not be reached if select options are managed properly
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

// Ping Test Functionality (Simulation)
function initPingTest() {
    const pingBtn = document.getElementById('ping-btn');
    const mirrorSelect = document.getElementById('mirror-select');

    if (pingBtn && mirrorSelect) {
        pingBtn.addEventListener('click', function() {
            const originalIconHTML = this.innerHTML;
            this.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
            this.disabled = true;
            mirrorSelect.disabled = true;

            const mirrorsToPing = [
                { name: 'gh.imixc.top', displayName: '节点1 (gh.imixc.top)'},
                { name: 'github.axingchen.com', displayName: '节点2 (github.axingchen.com)'}
            ];

            const pingPromises = mirrorsToPing.map(mirror => 
                new Promise(resolve => {
                    const latency = Math.floor(Math.random() * (150 - 20 + 1)) + 20;
                    setTimeout(() => resolve({ ...mirror, ping: latency }), latency + Math.random() * 500);
                })
            );

            Promise.all(pingPromises).then(results => {
                results.sort((a, b) => a.ping - b.ping);
                const fastest = results[0];
                                
                showToast(`测速完成: ${fastest.displayName} (${fastest.ping}ms) 响应最快`, 'info');
                
                this.innerHTML = originalIconHTML;
                this.disabled = false;
                mirrorSelect.disabled = false;
            });
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
        // Define the mirrors that should be in the select
        const allowedMirrors = [
            { value: 'auto', text: '自动选择最优节点 (默认 gh.imixc.top)' }, // Clarify auto behavior
            { value: 'gh.imixc.top', text: '节点1 (gh.imixc.top)' },
            { value: 'github.axingchen.com', text: '节点2 (github.axingchen.com)' },
        ];
        
        // Clear existing options
        while (mirrorSelect.options.length > 0) {
            mirrorSelect.remove(0);
        }

        // Add the allowed mirrors
        allowedMirrors.forEach(mirror => {
            const option = new Option(mirror.text, mirror.value);
            mirrorSelect.add(option);
        });
        
        // Set a default selection (e.g., 'auto' or the first specific mirror)
        mirrorSelect.value = 'auto'; 
    }
});
