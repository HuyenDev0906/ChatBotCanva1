function getApiUrl() {
    const currentOrigin = window.location.origin;
    const currentPort = window.location.port;

    if (currentPort === '8000' || currentPort === '8080') {
        return 'http://localhost:3000/api/sever';
    }

    return currentOrigin + '/api/sever';
}

async function fetchWithTimeout(url, options, timeoutMs = 25000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function sendMessage() {
    const inputEl = document.getElementById('userInput');
    const chatBox = document.getElementById('chatBox');
    const text = inputEl.value.trim();

    if (!text) return;

    chatBox.insertAdjacentHTML('beforeend', `<div class="msg user-msg">${text}</div>`);
    inputEl.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    const loadingId = 'load-' + Date.now();
    chatBox.insertAdjacentHTML('beforeend', `<div class="msg bot-msg" id="${loadingId}">AI đang suy nghĩ...</div>`);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const response = await fetchWithTimeout(getApiUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        }, 25000);

        let data = {};
        const rawText = await response.text();

        if (rawText) {
            try {
                data = JSON.parse(rawText);
            } catch (parseError) {
                console.error('Invalid JSON from /api/sever:', rawText);
                data = { error: 'Phản hồi không hợp lệ từ máy chủ.' };
            }
        }

        if (!response.ok) {
            throw new Error((data && data.error) || 'Lỗi máy chủ');
        }

        var reply = data && data.reply ? data.reply : '';

        if (!reply && data && data.data && data.data.candidates && data.data.candidates[0] && data.data.candidates[0].content && data.data.candidates[0].content.parts) {
            reply = data.data.candidates[0].content.parts.map(function (part) {
                return part.text || '';
            }).join('');
        }

        if (!reply) {
            reply = 'Không có phản hồi từ AI.';
        }

        document.getElementById(loadingId).innerText = reply;
    } catch (error) {
        document.getElementById(loadingId).innerText = error.message || 'Lỗi kết nối server. Vui lòng thử lại.';
    }

    chatBox.scrollTop = chatBox.scrollHeight;
}

const userInput = document.getElementById('userInput');
if (userInput) {
    userInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

const chatWidget = document.getElementById('chatWidget');
const chatToggle = document.getElementById('chatToggle');
const chatClose = document.getElementById('chatClose');

if (chatWidget && chatToggle) {
    chatToggle.addEventListener('click', function () {
        chatWidget.classList.toggle('open');
        const isOpen = chatWidget.classList.contains('open');
        chatToggle.setAttribute('aria-label', isOpen ? 'Đóng chat AI' : 'Mở chat AI');
        if (isOpen && userInput) {
            setTimeout(function () {
                userInput.focus();
            }, 80);
        }
    });
}

if (chatWidget && chatClose) {
    chatClose.addEventListener('click', function () {
        chatWidget.classList.remove('open');
        if (chatToggle) {
            chatToggle.setAttribute('aria-label', 'Mở chat AI');
        }
    });
}

const canvaFrame = document.getElementById('canvaFrame');
const canvaFallback = document.getElementById('canvaFallback');

if (canvaFrame && canvaFallback) {
    const hideFallback = function () {
        canvaFallback.hidden = true;
        canvaFallback.style.display = 'none';
        canvaFrame.style.display = 'block';
    };

    const showFallback = function () {
        canvaFrame.style.display = 'none';
        canvaFallback.hidden = false;
        canvaFallback.style.display = 'flex';
    };

    hideFallback();

    canvaFrame.addEventListener('load', hideFallback);
    canvaFrame.addEventListener('error', showFallback);

    setTimeout(function () {
        try {
            const iframeDoc = canvaFrame.contentDocument || canvaFrame.contentWindow.document;
            if (iframeDoc && iframeDoc.body && iframeDoc.body.innerHTML.trim().length > 0) {
                hideFallback();
                return;
            }
        } catch (error) {
            // Cross-origin access is blocked intentionally by the browser, but the iframe can still render correctly.
        }

        if (canvaFrame && canvaFrame.getAttribute('src')) {
            // Keep iframe visible unless an actual network error is reported.
            hideFallback();
        }
    }, 1000);
}