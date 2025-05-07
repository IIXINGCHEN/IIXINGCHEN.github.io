// Utility to show toast
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast'; // Reset classes

    switch(type) {
        case 'success':
            toast.classList.add('success');
            toast.style.backgroundColor = 'var(--color-bg-toast-success)';
            toast.style.color = 'var(--color-text-on-success)';
            break;
        case 'error':
            toast.classList.add('error');
            toast.style.backgroundColor = 'var(--color-bg-toast-error)';
            toast.style.color = 'var(--color-text-white)';
            break;
        case 'info':
        default:
            toast.classList.add('info');
            toast.style.backgroundColor = 'var(--color-bg-toast-info)';
            toast.style.color = 'var(--color-text-on-accent)'; // Or a dedicated --color-text-on-info
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
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
    }

    function closeMenu() {
        if (mobileMenu) {
            mobileMenu.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    if (mobileMenuButton) mobileMenuButton.addEventListener('click', openMenu);
    if (mobileMenuClose) mobileMenuClose.addEventListener('click', closeMenu);
    mobileMenuLinks.forEach(link => link.addEventListener('click', closeMenu)); // Close menu when a link is clicked
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
            errorMessageElement.classList.remove('hidden'); // Assuming Tailwind 'hidden' class
        }
    }

    function hideError() {
        if (errorMessageElement) {
            errorMessageElement.classList.add('hidden');
        }
    }
    
    function generateAcceleratedUrl(githubUrl, mirrorValue) {
        // Basic validation (should be more robust in a real app)
        if (!githubUrl.startsWith('https://github.com/')) {
            throw new Error('无效的GitHub链接格式');
        }
        
        const cleanUrl = githubUrl.split('?')[0].split('#')[0];
        let mirrorDomain;
        
        // This mapping should ideally come from a configuration or a more dynamic source
        const mirrors = {
            'auto': 'gh.imixc.top', // Default/auto
            'beijing': 'gh.imixc.top', 
            'shanghai': 'github.axingchen.com', // Example alternative
            'guangzhou': 'github.axingchen.com', // Example alternative
            'hongkong': 'gh.imixc.top' // Example alternative
        };
        
        mirrorDomain = mirrors[mirrorValue] || mirrors['auto'];

        // Different mirrors might have different URL structures
        // For ghproxy.com and similar, it's often a direct prefix
        // For others, it might be part of the path.
        // This is a simplified example for common proxy patterns.
        // Example: https://mirror.domain.com/https://github.com/user/repo
        // Or: https://mirror.domain.com/user/repo
        // The provided code implies the mirror domain replaces "github.com" or is prefixed.
        // Let's assume a common pattern for this demo: prefixing the full GitHub URL.
        // A more robust solution would involve checking the specific mirror's API.
        // The original JS had `https://${mirrorDomain}/${cleanUrl}` which might be too simple for some mirrors.
        // Let's try to be a bit more flexible based on common patterns.
        
        // If the GitHub URL contains /releases/download/ or /archive/
        // these are often directly proxied by replacing github.com or prefixing.
        // e.g. https://ghproxy.com/https://github.com/user/repo/releases/download/v1/file.zip

        if (mirrorDomain === 'github.axingchen.com' || mirrorDomain === 'github.axingchen.com') {
             return `https://${mirrorDomain}/${cleanUrl}`;
        }
        // For others like gh.imixc.top (which might be a direct replacement or path based)
        // Assuming it's a prefix for the path part of the URL
        // e.g. https://gh.imixc.top/user/repo/...
        const path = cleanUrl.replace('https://github.com/', '');
        return `https://${mirrorDomain}/${path}`;

        // A more robust way would be to have specific formatters per mirror.
        // For now, this covers two common patterns.
    }

    if (convertBtn) {
        convertBtn.addEventListener('click', function() {
            const githubUrl = githubUrlInput ? githubUrlInput.value.trim() : '';
            const mirrorValue = mirrorSelect ? mirrorSelect.value : 'auto';
            
            hideError();
            if (!githubUrl) {
                showError('请输入GitHub链接');
                showToast('请输入GitHub链接', 'error');
                return;
            }
            if (!githubUrl.includes('github.com')) { // Simple check
                showError('请输入有效的GitHub链接');
                showToast('请输入有效的GitHub链接', 'error');
                return;
            }

            if (convertText) convertText.style.display = 'none';
            if (convertSpinner) convertSpinner.classList.remove('hidden'); // Spinner uses 'loading-spinner' class now
            this.disabled = true;

            setTimeout(() => { // Simulate API call
                try {
                    const acceleratedUrl = generateAcceleratedUrl(githubUrl, mirrorValue);
                    if (acceleratedUrlInput) acceleratedUrlInput.value = acceleratedUrl;
                    if (downloadBtn) downloadBtn.href = acceleratedUrl;
                    if (resultContainer) resultContainer.classList.remove('hidden'); // Assuming Tailwind 'hidden'
                    
                    if (resultContainer) { // Scroll to result smoothly
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
            }, 1200); // Slightly longer for "tech" feel
        });
    }

    if (copyBtn && acceleratedUrlInput) {
        copyBtn.addEventListener('click', function() {
            acceleratedUrlInput.select();
            acceleratedUrlInput.setSelectionRange(0, 99999); // For mobile devices
            try {
                document.execCommand('copy');
                showToast('链接已复制到剪贴板!', 'success');
                const originalIcon = this.innerHTML;
                this.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => { this.innerHTML = originalIcon; }, 2000);
            } catch (err) {
                showToast('复制失败, 请手动复制。', 'error');
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
    if (pingBtn) {
        pingBtn.addEventListener('click', function() {
            const originalIconHTML = this.innerHTML;
            this.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>'; // Use FontAwesome spin
            this.disabled = true;

            setTimeout(() => {
                // Simulate ping results
                const pings = [
                    { name: '自动选择', ping: Math.floor(Math.random() * 30) + 20 },
                    { name: '北京节点', ping: Math.floor(Math.random() * 50) + 30 },
                    { name: '上海节点', ping: Math.floor(Math.random() * 40) + 25 },
                    { name: '广州节点', ping: Math.floor(Math.random() * 60) + 40 },
                    { name: '香港节点', ping: Math.floor(Math.random() * 25) + 15 }
                ];
                pings.sort((a, b) => a.ping - b.ping);
                showToast(`节点测速完成: ${pings[0].name} (${pings[0].ping}ms) 为当前最优`, 'info');
                
                this.innerHTML = originalIconHTML;
                this.disabled = false;
            }, 1500);
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
                const delay = parseFloat(entry.target.style.transitionDelay) * 1000 || 0; // Respect inline transition-delay
                setTimeout(() => {
                    entry.target.classList.remove('fade-in-initial');
                }, delay);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 }); // Trigger a bit earlier

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
});
