'use strict';

// Define GitHub URL regular expressions
const URL_REGEXES = [
    /^(?:https?:\/\/)?github\.com\/[^\/]+\/[^\/]+\/(?:releases|archive|blob|raw|info|git-|tags|tree)\/.*$/i,
    /^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/[^\/]+\/[^\/]+\/[^\/]+\/.*$/i,
    /^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/[^\/]+\/[^\/]+\/.*$/i
];

// Form submit event listener
document.getElementById('downloadForm').addEventListener('submit', handleFormSubmit);

/**
 * Handle form submit event
 * @param {Event} e - Event object
 */
function handleFormSubmit(e) {
    e.preventDefault();
    const githubUrlInput = document.getElementsByName('urlInput')[0]; // Correct spelling error
    const urlValue = githubUrlInput.value.trim();

    if (!isValidGitHubUrl(urlValue)) {
        alert('Please enter a valid GitHub file link. For example:\n' +
            'https://github.com/username/repository/blob/branch/file_path\n' +
            'https://raw.githubusercontent.com/username/repository/branch/file_path');
        githubUrlInput.value = '';
        return;
    }

    // Clean user input
    const encodedUrlValue = encodeURIComponent(urlValue);
    toggleLoadingIndicator(true, 'File downloading, please wait...');
    const baseUrl = window.location.origin + window.location.pathname;
    const requestUrl = `${baseUrl}?url=${encodedUrlValue}`; // Correct spelling error

    fetchWithRetry(requestUrl)
        .then(handleFetchResponse)
        .then(handleDownload)
        .catch(handleFetchError)
        .finally(() => toggleLoadingIndicator(false));
}

/**
 * Validate GitHub URL
 * @param {string} url - URL to validate
 * @returns {boolean} - Returns whether the URL is valid
 */
function isValidGitHubUrl(url) {
    return URL_REGEXES.some(regex => regex.test(url));
}

/**
 * Handle fetch response
 * @param {Response} response - Fetch response object
 * @returns {Promise} - Returns processed blob and fileName
 */
async function handleFetchResponse(response) {
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Network response failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const contentDisposition = response.headers.get('Content-Disposition');
    let fileName = contentDisposition ? contentDisposition.match(/filename=["']?([^"']+)["']?/)[1] || 'downloaded_file' : 'downloaded_file';
    const blob = await response.blob();
    return { blob, fileName };
}

/**
 * Handle download
 * @param {{blob: Blob, fileName: string}} data - Object containing blob and fileName
 */
function handleDownload({ blob, fileName }) {
    if (blob.size > 1024 * 1024 * 1024) { // 1GB limit
        alert('File is too large to download. Please select a file smaller than 1GB.');
        return;
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showDownloadComplete(); // Show download complete prompt
}

/**
 * Handle fetch error
 * @param {Error} error - Error object
 */
function handleFetchError(error) {
    console.error('Download failed:', error);
    let errorMessage = 'Download failed, please try again.';
    if (error.message.includes('Network response failed')) {
        errorMessage = 'The server cannot process your request. Please check the URL.';
    }
    alert(errorMessage);
}

/**
 * Show or hide loading indicator
 * @param {boolean} show - Whether to show the loading indicator
 * @param {string} message - Message to display
 */
function toggleLoadingIndicator(show, message = '') {
    let loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.textContent = message;
        loadingIndicator.style.display = show ? 'block' : 'none';
    }
}

/**
 * Show download complete prompt
 */
function showDownloadComplete() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.textContent = 'Download complete';
        loadingIndicator.style.display = 'block';

        // Add fade-out effect
        setTimeout(() => {
            let opacity = 1;
            const fadeEffect = setInterval(() => {
                if (opacity > 0) {
                    opacity -= 0.05; // Adjust fade-out speed
                    loadingIndicator.style.opacity = opacity;
                } else {
                    clearInterval(fadeEffect);
                    loadingIndicator.style.display = 'none';
                }
            }, 100); // Adjust fade-out interval
        }, 3000); // Start fade-out after 3 seconds
    }
}

/**
 * Fetch request with retry mechanism
 * @param {string} url - Request URL
 * @param {number} retries - Number of retries
 * @param {number} delay - Retry delay time (milliseconds)
 * @returns {Promise} - Returns fetch response
 */
async function fetchWithRetry(url, retries = 3, delay = 500) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Network response failed: ${response.status} ${response.statusText}`);
        }
        return response;
    } catch (error) {
        if (retries > 0) {
            console.warn(`Request failed, retrying in ${delay} milliseconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, retries - 1, Math.min(delay * 2, 5000)); // Increase delay time, but not exceeding 5 seconds
        } else {
            throw error;
        }
    }
}
