function getApiUrl() {
    const config = window.SITE_CONFIG || {};
    const base = (config.apiBaseUrl || '').trim().replace(/\/$/, '');
    const path = config.apiPath || '/api/sever';
    if (base) return base + path;
    if (['localhost','127.0.0.1','[::1]'].includes(window.location.hostname) || window.location.protocol === 'file:') return 'http://localhost:3000/api/sever';
    throw new Error('Chưa cấu hình URL Render API trong js/config.js');
}

let chatRequestInProgress = false;

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
    const sendButton = document.querySelector('.chat-input-area button');
    const text = inputEl.value.trim();

    if (!text || chatRequestInProgress) return;

    chatRequestInProgress = true;
    if (sendButton) sendButton.disabled = true;
    inputEl.disabled = true;

    const userMessage = document.createElement('div');
    userMessage.className = 'msg user-msg';
    userMessage.textContent = text;
    chatBox.appendChild(userMessage);
    inputEl.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;
    updateChatScrollButton();

    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'msg bot-msg';
    loadingMessage.textContent = 'AI đang suy nghĩ...';
    chatBox.appendChild(loadingMessage);
    chatBox.scrollTop = chatBox.scrollHeight;
    updateChatScrollButton();

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
            const requestError = new Error((data && data.error) || 'Chat API request failed.');
            requestError.status = response.status;
            throw requestError;
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
        console.error('[Chat] Request failed:', {
            status: error.status || null,
            message: error.message || 'Unknown request error'
        });

        loadingMessage.classList.add('error-msg');
        loadingMessage.setAttribute('role', 'alert');
        if ([401, 403, 405].includes(error.status)) {
            loadingMessage.textContent = 'Access was denied. Please contact the administrator or Ms. Huyen.';
        } else if (error.status === 429) {
            loadingMessage.textContent = 'Too many requests. Please wait a moment before trying again.';
        } else {
            loadingMessage.textContent = 'The assistant is temporarily unavailable. Please try again later.';
        }
    } finally {
        chatRequestInProgress = false;
        inputEl.disabled = false;
        if (sendButton) sendButton.disabled = false;
    }

    if (!loadingMessage.classList.contains('error-msg')) {
        addReactionControls(loadingMessage);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
    updateChatScrollButton();
    if (chatWidget && !chatWidget.classList.contains('open')) {
        unreadReplies += 1;
        showOutsideBadge();
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
const chatMinimize = document.getElementById('chatMinimize');
const chatNotification = document.getElementById('chatNotification');
const chatOutsideBadge = document.getElementById('chatOutsideBadge');
const chatMessages = document.getElementById('chatBox');
const chatScrollDown = document.getElementById('chatScrollDown');
let unreadReplies = 0;
let outsideBadgeTimeout = null;

function updateChatScrollButton() {
    if (!chatMessages || !chatScrollDown) return;

    const distanceFromBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;
    chatScrollDown.hidden = distanceFromBottom <= 32;
}

if (chatMessages) {
    chatMessages.addEventListener('scroll', updateChatScrollButton, { passive: true });
}

if (chatScrollDown && chatMessages) {
    chatScrollDown.addEventListener('click', function () {
        chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
    });
    updateChatScrollButton();
}

function setInitialChat() {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox || chatBox.querySelector('.msg')) {
        return;
    }

    chatBox.innerHTML = '<div class="msg bot-msg">Xin chào! Mình là ChatBot AI. Bạn muốn hỏi gì nào?</div>';
}

function hideOutsideBadge() {
    if (chatOutsideBadge) {
        chatOutsideBadge.hidden = true;
    }
}

function showOutsideBadge() {
    if (!chatOutsideBadge) return;
    chatOutsideBadge.hidden = false;

    if (outsideBadgeTimeout) {
        clearTimeout(outsideBadgeTimeout);
    }

    outsideBadgeTimeout = setTimeout(function () {
        hideOutsideBadge();
    }, 5000);
}

function updateChatNotification() {
    if (!chatToggle || !chatNotification) return;

    const isOpen = !!(chatWidget && chatWidget.classList.contains('open'));
    chatNotification.hidden = isOpen || unreadReplies === 0;

    chatToggle.setAttribute(
        'aria-label',
        isOpen
            ? 'Thu nhỏ chat AI'
            : unreadReplies > 0
                ? `Mở chat AI, ${unreadReplies} phản hồi mới`
                : 'Mở chat AI'
    );
}

function openChatPanel() {
    if (!chatWidget) return;

    chatWidget.classList.add('open');
    chatWidget.classList.remove('minimized');
    unreadReplies = 0;
    hideOutsideBadge();
    updateChatNotification();

    if (userInput) {
        setTimeout(function () {
            userInput.focus();
        }, 80);
    }
}

function minimizeChatPanel() {
    if (!chatWidget) return;

    chatWidget.classList.remove('open');
    chatWidget.classList.add('minimized');
    hideOutsideBadge();
    updateChatNotification();
}

function resetChatHistory() {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;

    chatBox.innerHTML = '<div class="msg bot-msg">Xin chào! Mình là ChatBot AI. Bạn muốn hỏi gì nào?</div>';
    chatBox.scrollTop = 0;
    updateChatScrollButton();
}

function addReactionControls(messageElement) {
    if (!messageElement || (messageElement.nextElementSibling && messageElement.nextElementSibling.classList.contains('chat-reactions'))) return;

    const response = document.createElement('div');
    response.className = 'bot-response';
    messageElement.parentNode.insertBefore(response, messageElement);
    response.appendChild(messageElement);

    messageElement.tabIndex = 0;
    messageElement.setAttribute('aria-label', `${messageElement.textContent.trim()} Nhấn giữ hoặc rê chuột để hiện biểu cảm.`);

    const reactions = document.createElement('div');
    reactions.className = 'chat-reactions';
    reactions.setAttribute('role', 'group');
    reactions.setAttribute('aria-label', 'Biểu cảm cho câu trả lời của AI');

    [
        { value: 'like', icon: '👍', label: 'Thích' },
        { value: 'love', icon: '❤️', label: 'Yêu thích' },
        { value: 'laugh', icon: '😂', label: 'Haha' },
        { value: 'wow', icon: '😮', label: 'Ngạc nhiên' },
        { value: 'sad', icon: '😢', label: 'Buồn' },
        { value: 'thanks', icon: '🙏', label: 'Cảm ơn' }
    ].forEach(function (reaction) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chat-reaction';
        button.dataset.reaction = reaction.value;
        button.textContent = reaction.icon;
        button.title = reaction.label;
        button.setAttribute('aria-label', reaction.label);
        button.setAttribute('aria-pressed', 'false');
        reactions.appendChild(button);
    });

    const moreButton = document.createElement('button');
    moreButton.type = 'button';
    moreButton.className = 'chat-reaction chat-reaction-more';
    moreButton.textContent = '+';
    moreButton.title = 'Thêm biểu cảm';
    moreButton.setAttribute('aria-label', 'Hiện thêm biểu cảm');
    moreButton.setAttribute('aria-expanded', 'false');
    reactions.appendChild(moreButton);

    const moreReactions = document.createElement('div');
    moreReactions.className = 'chat-reaction-more-list';
    moreReactions.setAttribute('role', 'group');
    moreReactions.setAttribute('aria-label', 'Biểu cảm khác');
    [
        { value: 'celebrate', icon: '🎉', label: 'Ăn mừng' },
        { value: 'clap', icon: '👏', label: 'Vỗ tay' },
        { value: 'heart-eyes', icon: '😍', label: 'Yêu mến' },
        { value: 'thinking', icon: '🤔', label: 'Suy nghĩ' },
        { value: 'angry', icon: '😡', label: 'Tức giận' },
        { value: 'hundred', icon: '💯', label: 'Tuyệt vời' }
    ].forEach(function (reaction) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chat-reaction';
        button.dataset.reaction = reaction.value;
        button.textContent = reaction.icon;
        button.title = reaction.label;
        button.setAttribute('aria-label', reaction.label);
        button.setAttribute('aria-pressed', 'false');
        moreReactions.appendChild(button);
    });
    reactions.appendChild(moreReactions);

    const summary = document.createElement('div');
    summary.className = 'chat-reaction-summary';
    summary.hidden = true;

    const selectedReaction = document.createElement('button');
    selectedReaction.type = 'button';
    selectedReaction.className = 'chat-reaction-count';
    selectedReaction.title = 'Bấm để gỡ biểu cảm';
    selectedReaction.setAttribute('aria-label', 'Chưa chọn biểu cảm');
    const selectedIcon = document.createElement('span');
    selectedIcon.className = 'chat-reaction-count-emoji';
    selectedReaction.appendChild(selectedIcon);
    summary.appendChild(selectedReaction);

    response.append(reactions, summary);
}

if (chatMessages) {
    chatMessages.querySelectorAll('.bot-msg').forEach(function (message, index) {
        if (index > 0) addReactionControls(message);
    });
    chatMessages.addEventListener('click', function (event) {
        const selectedReactionButton = event.target.closest('.chat-reaction-count');
        if (selectedReactionButton) {
            const summary = selectedReactionButton.closest('.chat-reaction-summary');
            const reactions = summary && summary.previousElementSibling;
            if (reactions && reactions.classList.contains('chat-reactions')) {
                reactions.querySelectorAll('button[data-reaction]').forEach(function (button) {
                    button.setAttribute('aria-pressed', 'false');
                    button.classList.remove('selected');
                });
                summary.hidden = true;
                reactions.parentElement.classList.remove('has-reaction', 'show-reactions');
                reactions.classList.remove('is-visible', 'expanded');
                reactions.classList.add('is-dismissed');
                const moreButton = reactions.querySelector('.chat-reaction-more');
                moreButton.setAttribute('aria-expanded', 'false');
                moreButton.setAttribute('aria-label', 'Hiện thêm biểu cảm');
            }
            return;
        }

        const moreButton = event.target.closest('.chat-reaction-more');
        if (moreButton) {
            const reactions = moreButton.closest('.chat-reactions');
            const expanded = reactions.classList.toggle('expanded');
            moreButton.setAttribute('aria-expanded', String(expanded));
            moreButton.setAttribute('aria-label', expanded ? 'Ẩn biểu cảm khác' : 'Hiện thêm biểu cảm');
            return;
        }

        const clickedButton = event.target.closest('button[data-reaction]');
        if (!clickedButton) return;

        const reactions = clickedButton.closest('.chat-reactions');
        const summary = reactions.nextElementSibling;
        const wasSelected = clickedButton.getAttribute('aria-pressed') === 'true';
        reactions.querySelectorAll('button[data-reaction]').forEach(function (button) {
            button.setAttribute('aria-pressed', 'false');
            button.classList.remove('selected');
        });

        if (!wasSelected) {
            clickedButton.setAttribute('aria-pressed', 'true');
            clickedButton.classList.add('selected');
            reactions.insertBefore(clickedButton, reactions.firstElementChild);
            reactions.parentElement.classList.add('has-reaction');
            summary.querySelector('.chat-reaction-count-emoji').textContent = clickedButton.textContent;
            summary.querySelector('.chat-reaction-count').setAttribute('aria-label', `Đã thả biểu cảm ${clickedButton.getAttribute('aria-label')}. Bấm để gỡ.`);
            summary.hidden = false;
        } else {
            summary.hidden = true;
            reactions.parentElement.classList.remove('has-reaction', 'show-reactions');
        }
        reactions.classList.add('is-dismissed');
        reactions.classList.remove('is-visible');
        reactions.classList.remove('expanded');
        const moreControlButton = reactions.querySelector('.chat-reaction-more');
        moreControlButton.setAttribute('aria-expanded', 'false');
        moreControlButton.setAttribute('aria-label', 'Hiện thêm biểu cảm');
    });

    let pressTimer;
    let pressedMessage;
    let pressStartX = 0;
    let pressStartY = 0;
    const clearPressTimer = function () {
        clearTimeout(pressTimer);
        pressTimer = null;
        pressedMessage = null;
    };

    chatMessages.addEventListener('pointerover', function (event) {
        if (event.pointerType !== 'mouse') return;
        const message = event.target.closest('.bot-msg');
        const response = message && message.closest('.bot-response');
        const controls = response && response.querySelector('.chat-reactions');
        if (controls) controls.classList.remove('is-dismissed');
    });

    chatMessages.addEventListener('pointerdown', function (event) {
        const message = event.target.closest('.bot-msg');
        if (!message || event.pointerType === 'mouse' || !event.isPrimary) return;

        pressedMessage = message;
        const response = message.closest('.bot-response');
        const controls = response && response.querySelector('.chat-reactions');
        if (controls) controls.classList.remove('is-dismissed');
        pressStartX = event.clientX;
        pressStartY = event.clientY;
        pressTimer = setTimeout(function () {
            const activeResponse = pressedMessage && pressedMessage.closest('.bot-response');
            const activeControls = activeResponse && activeResponse.querySelector('.chat-reactions');
            if (activeControls) {
                activeControls.classList.add('is-visible');
                activeResponse.classList.add('show-reactions');
            }
        }, 450);
    });
    ['pointerup', 'pointercancel'].forEach(function (eventName) {
        chatMessages.addEventListener(eventName, clearPressTimer);
    });
    chatMessages.addEventListener('pointermove', function (event) {
        const movedX = event.clientX - pressStartX;
        const movedY = event.clientY - pressStartY;
        if (Math.hypot(movedX, movedY) > 10) clearPressTimer();
    });

    document.addEventListener('pointerdown', function (event) {
        if (event.target.closest('.bot-msg, .chat-reactions')) return;
        chatMessages.querySelectorAll('.chat-reactions.is-visible, .chat-reactions.expanded').forEach(function (controls) {
            controls.classList.remove('is-visible', 'expanded');
            controls.classList.add('is-dismissed');
            const moreButton = controls.querySelector('.chat-reaction-more');
            if (moreButton) {
                moreButton.setAttribute('aria-expanded', 'false');
                moreButton.setAttribute('aria-label', 'Hiện thêm biểu cảm');
            }
        });
    });
}

if (chatWidget && chatToggle) {
    chatToggle.addEventListener('click', function () {
        if (chatWidget.classList.contains('open')) {
            minimizeChatPanel();
            return;
        }

        openChatPanel();
    });
}

if (chatWidget && chatMinimize) {
    chatMinimize.addEventListener('click', function (event) {
        event.stopPropagation();
        minimizeChatPanel();
    });
}

if (chatWidget && chatClose) {
    chatClose.addEventListener('click', function (event) {
        event.stopPropagation();
        chatWidget.classList.remove('open');
        chatWidget.classList.remove('minimized');
        unreadReplies = 0;
        hideOutsideBadge();
        resetChatHistory();
        updateChatNotification();
    });
}

if (chatWidget) {
    chatWidget.classList.remove('minimized');
    updateChatNotification();
}
