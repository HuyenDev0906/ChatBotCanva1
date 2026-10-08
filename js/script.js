function getApiUrl() {
    const { protocol, hostname, origin } = window.location;
    const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

    if (protocol === 'file:' || isLocalHost) {
        const apiHost = hostname === '127.0.0.1' ? hostname : 'localhost';
        return `http://${apiHost}:3000/api/sever`;
    }

    return new URL('/api/sever', origin).href;
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

    const userMessage = document.createElement('div');
    userMessage.className = 'msg user-msg';
    userMessage.textContent = text;
    chatBox.appendChild(userMessage);
    inputEl.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'msg bot-msg';
    loadingMessage.textContent = 'AI đang suy nghĩ...';
    chatBox.appendChild(loadingMessage);
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
            throw new Error(`HTTP ${response.status}: ${(data && data.error) || 'Lỗi máy chủ'}`);
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

        loadingMessage.textContent = reply;
    } catch (error) {
        loadingMessage.textContent = error.message || 'Lỗi kết nối server. Vui lòng thử lại.';
    }

    chatBox.scrollTop = chatBox.scrollHeight;
    if (chatWidget && !chatWidget.classList.contains('open')) {
        unreadReplies += 1;
        updateChatNotification();
    }
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
const chatNotification = document.getElementById('chatNotification');
let unreadReplies = 0;

function updateChatNotification() {
    if (!chatToggle || !chatNotification) return;

    chatNotification.hidden = unreadReplies === 0;
    chatToggle.setAttribute(
        'aria-label',
        chatWidget.classList.contains('open')
            ? 'Thu nhỏ chat AI'
            : unreadReplies > 0
                ? `Mở chat AI, ${unreadReplies} phản hồi mới`
                : 'Mở chat AI'
    );
}

if (chatWidget && chatToggle) {
    chatToggle.addEventListener('click', function () {
        chatWidget.classList.toggle('open');
        const isOpen = chatWidget.classList.contains('open');
        if (isOpen) {
            unreadReplies = 0;
        }
        updateChatNotification();
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
        updateChatNotification();
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