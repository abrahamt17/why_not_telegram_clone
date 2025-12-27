const API_BASE = '';

let chats = [];
let currentChat = null;
let messageMap = new Map();

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadChats();
    setupSearch();
});

// Load all chats
async function loadChats() {
    try {
        const response = await fetch(`${API_BASE}/api/chats`);
        chats = await response.json();
        renderChatList(chats);
    } catch (error) {
        console.error('Error loading chats:', error);
        document.getElementById('chatList').innerHTML = 
            '<div class="loading">Error loading chats. Please check if the server is running.</div>';
    }
}

// Render chat list
function renderChatList(chatList) {
    const chatListEl = document.getElementById('chatList');
    
    if (chatList.length === 0) {
        chatListEl.innerHTML = '<div class="loading">No chats found</div>';
        return;
    }
    
    chatListEl.innerHTML = chatList.map(chat => {
        const lastMessage = chat.lastMessage || chat.last_message;
        let preview = 'No messages yet';
        if (lastMessage) {
            preview = getMessagePreview(lastMessage);
        } else if (chat.messages && chat.messages.length > 0) {
            // Try to get last message from messages array
            const msgs = chat.messages;
            if (msgs.length > 0) {
                preview = getMessagePreview(msgs[msgs.length - 1]);
            }
        }
        const time = lastMessage ? formatTimeForList(lastMessage.date) : '';
        const avatar = getInitials(chat.name);
        const messageCount = chat.messageCount || chat.message_count || 0;
        
        return `
            <div class="chat-item" data-path="${chat.path}">
                <div class="chat-avatar">${avatar}</div>
                <div class="chat-info">
                    <div class="chat-name">${escapeHtml(chat.name)}</div>
                    <div class="chat-preview">${preview}</div>
                </div>
                <div class="chat-meta">
                    ${time ? `<div class="chat-time">${time}</div>` : ''}
                    ${messageCount > 0 ? `<div class="chat-badge">${messageCount}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers - instant opening
    chatListEl.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            loadChat(item.dataset.path);
        }, { passive: true });
    });
}

// Current user ID (determined from messages)
let currentUserId = null;

// Load a specific chat
async function loadChat(path) {
    try {
        console.log('Loading chat:', path);
        const response = await fetch(`${API_BASE}/api/chat/${path}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        currentChat = await response.json();
        console.log('Chat loaded:', currentChat.name, 'Messages:', currentChat.messages?.length || 0);
        
        // Ensure messages array exists
        if (!currentChat.messages) {
            currentChat.messages = [];
        }
        
        // Determine current user by finding the most common from_id
        const userIdCounts = {};
        currentChat.messages.forEach(msg => {
            if (msg.from_id) {
                userIdCounts[msg.from_id] = (userIdCounts[msg.from_id] || 0) + 1;
            }
        });
        
        // Set current user to the most frequent sender (usually "you")
        if (Object.keys(userIdCounts).length > 0) {
            currentUserId = Object.keys(userIdCounts).reduce((a, b) => 
                userIdCounts[a] > userIdCounts[b] ? a : b
            );
            console.log('Current user ID:', currentUserId);
        }
        
        // Build message map for replies
        messageMap.clear();
        currentChat.messages.forEach(msg => {
            messageMap.set(msg.id, msg);
        });
        
        renderChat(currentChat);
    } catch (error) {
        console.error('Error loading chat:', error);
        const chatArea = document.getElementById('chatArea');
        chatArea.innerHTML = `
            <div class="empty-state">
                <h2>Error loading chat</h2>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Render chat messages
function renderChat(chat) {
    const chatArea = document.getElementById('chatArea');
    
    if (!chat || !chat.messages || chat.messages.length === 0) {
        chatArea.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <h2>No messages found</h2>
                <p>This chat has no messages to display</p>
            </div>
        `;
        return;
    }
    
    // Header
    const avatar = getInitials(chat.name);
    const header = `
        <div class="chat-header">
            <div class="chat-header-left" onclick="toggleMediaMenu()" style="cursor: pointer;">
                <div class="chat-header-avatar">${avatar}</div>
                <div class="chat-header-info">
                    <h2>${escapeHtml(chat.name)}</h2>
                    <p>${chat.messages.length} messages</p>
                </div>
            </div>
            <div class="chat-header-actions">
                <button class="header-button" onclick="openChatSearch()" title="Search in chat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                </button>
                <button class="header-button" onclick="scrollToBottom()" title="Scroll to bottom" id="scrollToBottomBtn" style="display: none;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M7 13l5 5 5-5M7 6l5 5 5-5"></path>
                    </svg>
                </button>
            </div>
        </div>
        <div class="media-menu" id="mediaMenu" style="display: none;">
            <div class="media-menu-item" onclick="showMediaSection('photos')">
                <span class="media-icon">📷</span>
                <span>Photos</span>
            </div>
            <div class="media-menu-item" onclick="showMediaSection('videos')">
                <span class="media-icon">🎥</span>
                <span>Videos</span>
            </div>
            <div class="media-menu-item" onclick="showMediaSection('files')">
                <span class="media-icon">📎</span>
                <span>Files</span>
            </div>
            <div class="media-menu-item" onclick="showMediaSection('stickers')">
                <span class="media-icon">🎨</span>
                <span>Stickers</span>
            </div>
            <div class="media-menu-item" onclick="showMediaSection('links')">
                <span class="media-icon">🔗</span>
                <span>Links</span>
            </div>
        </div>
    `;
    
    // Messages
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'messages-container';
    
    let lastDate = '';
    let lastSender = null;
    let messageGroup = [];
    
    chat.messages.forEach((message, index) => {
        const messageDate = formatDate(message.date);
        if (messageDate !== lastDate) {
            // Flush previous group
            if (messageGroup.length > 0) {
                messagesContainer.appendChild(createMessageGroup(messageGroup));
                messageGroup = [];
            }
            messagesContainer.appendChild(createDateSeparator(messageDate));
            lastDate = messageDate;
            lastSender = null;
        }
        
        // Group messages from same sender
        const currentSender = message.from_id;
        if (currentSender === lastSender && !message.reply_to_message_id) {
            messageGroup.push(message);
        } else {
            // Flush previous group
            if (messageGroup.length > 0) {
                messagesContainer.appendChild(createMessageGroup(messageGroup));
            }
            messageGroup = [message];
            lastSender = currentSender;
        }
    });
    
    // Flush last group
    if (messageGroup.length > 0) {
        messagesContainer.appendChild(createMessageGroup(messageGroup));
    }
    
    // Scroll to bottom immediately (Telegram shows newest at bottom)
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Add scroll listener for scroll-to-bottom button
    messagesContainer.addEventListener('scroll', () => {
        const btn = document.getElementById('scrollToBottomBtn');
        if (btn) {
            const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;
            btn.style.display = isNearBottom ? 'none' : 'flex';
        }
    });
    
    chatArea.innerHTML = header;
    chatArea.appendChild(messagesContainer);
    
    // Store message elements for search (with message IDs for lookup)
    window.messageElements = [];
    window.messageElementMap = new Map();
    
    currentChat.messages.forEach((message, index) => {
        const messageEl = messagesContainer.querySelector(`[data-message-id="${message.id}"]`);
        if (messageEl) {
            window.messageElements.push(messageEl);
            window.messageElementMap.set(message.id, messageEl);
        }
    });
}

// Create date separator
function createDateSeparator(date) {
    const separator = document.createElement('div');
    separator.className = 'date-separator';
    separator.innerHTML = `<span>${date}</span>`;
    return separator;
}

// Create message group (multiple messages from same sender)
function createMessageGroup(messages) {
    const groupEl = document.createElement('div');
    groupEl.className = 'message-group';
    
    const firstMessage = messages[0];
    // Determine if message is sent (from current user) or received
    const isSent = currentUserId && firstMessage.from_id === currentUserId;
    const messageClass = isSent ? 'sent' : 'received';
    
    // Add wrapper class for alignment
    groupEl.classList.add(`message-group-${messageClass}`);
    
    messages.forEach((message, index) => {
        const messageEl = createMessageElement(message, index, messages.length, messageClass);
        groupEl.appendChild(messageEl);
    });
    
    return groupEl;
}

// Create message element
function createMessageElement(message, index, groupSize, messageClass) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${messageClass}`;
    
    // Show sender name only for first message in group or if it's a reply
    const showSender = index === 0 || message.reply_to_message_id;
    
    let content = '';
    
    // Reply indicator
    if (message.reply_to_message_id) {
        const repliedMessage = messageMap.get(message.reply_to_message_id);
        if (repliedMessage) {
            content += `
                <div class="message-reply">
                    <div class="message-reply-author">${escapeHtml(repliedMessage.from)}</div>
                    <div class="message-reply-text">${getMessagePreview(repliedMessage)}</div>
                </div>
            `;
        }
    }
    
    // Media content
    if (message.photo) {
        const mediaPath = `${API_BASE}/api/media/${currentChat.path}/${message.photo}`;
        content += `
            <div class="message-media">
                <img src="${mediaPath}" alt="Photo" class="message-photo" onclick="openImageModal('${mediaPath}')" />
            </div>
        `;
    } else if (message.video) {
        const mediaPath = `${API_BASE}/api/media/${currentChat.path}/${message.video}`;
        content += `
            <div class="message-media">
                <video src="${mediaPath}" controls class="message-video"></video>
            </div>
        `;
    } else if (message.media_type === 'sticker') {
        const stickerPath = message.thumbnail || message.file;
        if (stickerPath) {
            const mediaPath = `${API_BASE}/api/media/${currentChat.path}/${stickerPath}`;
            content += `
                <div class="message-media">
                    <img src="${mediaPath}" alt="Sticker" class="message-sticker" />
                </div>
            `;
        }
    } else if (message.media_type === 'voice_message') {
        const audioPath = `${API_BASE}/api/media/${currentChat.path}/${message.file}`;
        const duration = message.duration_seconds || 0;
        content += `
            <div class="message-voice">
                <button class="voice-play-button" onclick="playVoiceMessage('${audioPath}', this)">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </button>
                <div class="voice-info">
                    <div class="voice-duration">${formatDuration(duration)}</div>
                    <div class="voice-waveform"></div>
                </div>
            </div>
        `;
    } else if (message.file && !message.media_type) {
        const filePath = `${API_BASE}/api/media/${currentChat.path}/${message.file}`;
        const fileName = message.file.split('/').pop();
        content += `
            <div class="message-file">
                <div class="file-icon">
                    <svg viewBox="0 0 24 24" fill="white" width="24" height="24">
                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                    </svg>
                </div>
                <div class="file-info">
                    <div class="file-name">${escapeHtml(fileName)}</div>
                    <div class="file-size">File</div>
                </div>
            </div>
        `;
    }
    
    // Text content
    if (message.text) {
        content += `<div class="message-text">${formatMessageText(message.text, message.text_entities)}</div>`;
    }
    
    // Header with sender and time
    let header = '';
    if (messageClass === 'received' && showSender) {
        // Received messages show sender name
        header = `
            <div class="message-header">
                <span class="message-sender">${escapeHtml(message.from)}</span>
            </div>
        `;
    }
    
    // For sent messages, time goes at the end (Telegram style)
    // For received messages, time is in header
    let timeHtml = '';
    const timeStr = formatTime(message.date);
    const editedStr = message.edited ? ' <span class="message-edited">edited</span>' : '';
    
    if (messageClass === 'sent') {
        timeHtml = `<span class="message-time-inline">${timeStr}${editedStr}</span>`;
    } else if (showSender) {
        timeHtml = `<div class="message-header" style="margin-top: 2px;"><span class="message-time">${timeStr}${editedStr}</span></div>`;
    } else {
        // For subsequent messages in group, show time inline
        timeHtml = `<span class="message-time-inline">${timeStr}${editedStr}</span>`;
    }
    
    messageEl.innerHTML = header + content + timeHtml;
    messageEl.setAttribute('data-message-id', message.id);
    return messageEl;
}

// Format message text with entities
function formatMessageText(text, entities) {
    if (!text) return '';
    
    // Ensure text is a string (it might be an array or other type)
    let textStr = '';
    if (typeof text === 'string') {
        textStr = text;
    } else if (Array.isArray(text)) {
        // If text is an array, join it
        textStr = text.map(t => typeof t === 'string' ? t : String(t)).join('');
    } else {
        textStr = String(text);
    }
    
    // For now, just escape HTML and preserve line breaks
    // The export format uses simple text_entities with just type and text
    // We can enhance this later if needed for bold/italic/links
    let formatted = escapeHtml(textStr);
    
    // Convert line breaks to <br>
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Basic URL detection and linking
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    
    return formatted;
}

// Get message preview
function getMessagePreview(message) {
    if (message.photo) return '📷 Photo';
    if (message.video) return '🎥 Video';
    if (message.media_type === 'sticker') return '🎨 Sticker';
    if (message.media_type === 'voice_message') return '🎤 Voice message';
    if (message.file) return '📎 File';
    if (message.text) {
        // Ensure text is a string
        let textStr = '';
        if (typeof message.text === 'string') {
            textStr = message.text;
        } else if (Array.isArray(message.text)) {
            textStr = message.text.map(t => typeof t === 'string' ? t : String(t)).join('');
        } else {
            textStr = String(message.text);
        }
        
        const text = textStr.replace(/\n/g, ' ');
        return text.length > 50 ? text.substring(0, 50) + '...' : text;
    }
    return 'Media';
}

// Format time (for message timestamps)
function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Format time for chat list
function formatTimeForList(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (days === 1) {
        return 'Yesterday';
    } else if (days < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}

// Format date (Telegram style)
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    }
    
    // Telegram style: "15 January 2021" or "January 15, 2021"
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

// Format duration
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Get initials
function getInitials(name) {
    if (!name) return '?';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Setup search
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = chats.filter(chat => 
            chat.name.toLowerCase().includes(query)
        );
        renderChatList(filtered);
    });
}

// Play voice message
function playVoiceMessage(audioPath, button) {
    const audio = new Audio(audioPath);
    const svg = button.querySelector('svg');
    
    if (audio.paused) {
        audio.play();
        svg.innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>';
        audio.onended = () => {
            svg.innerHTML = '<path d="M8 5v14l11-7z"/>';
        };
    } else {
        audio.pause();
        svg.innerHTML = '<path d="M8 5v14l11-7z"/>';
    }
}

// Open image modal (simple implementation)
function openImageModal(imagePath) {
    window.open(imagePath, '_blank');
}

// Chat search functionality
let searchResults = [];
let currentSearchIndex = -1;

function openChatSearch() {
    const overlay = document.getElementById('chatSearchOverlay');
    const input = document.getElementById('chatSearchInput');
    overlay.style.display = 'flex';
    input.focus();
    input.value = '';
    searchResults = [];
    currentSearchIndex = -1;
    updateSearchResults();
    // Perform initial search to show all messages
    performChatSearch();
}

function closeChatSearch() {
    document.getElementById('chatSearchOverlay').style.display = 'none';
    // Remove highlights
    if (window.messageElements) {
        window.messageElements.forEach(el => {
            el.classList.remove('search-highlight', 'search-highlight-active');
        });
    }
}

function performChatSearch() {
    const query = document.getElementById('chatSearchInput').value.trim().toLowerCase();
    const resultsContainer = document.getElementById('chatSearchResults');
    searchResults = [];
    currentSearchIndex = -1;
    
    if (!currentChat || !currentChat.messages) {
        resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">No messages to search</div>';
        updateSearchResults();
        return;
    }
    
    // Remove previous highlights
    if (window.messageElements) {
        window.messageElements.forEach(el => {
            el.classList.remove('search-highlight', 'search-highlight-active');
        });
    }
    
    if (!query) {
        resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Type to search messages...</div>';
        updateSearchResults();
        return;
    }
    
    // Search through messages
    currentChat.messages.forEach((message, index) => {
        let searchText = '';
        if (message.text) {
            if (typeof message.text === 'string') {
                searchText = message.text.toLowerCase();
            } else if (Array.isArray(message.text)) {
                searchText = message.text.map(t => String(t).toLowerCase()).join(' ');
            } else {
                searchText = String(message.text).toLowerCase();
            }
        }
        
        if (searchText.includes(query)) {
            // Find the corresponding message element by message ID
            const messageEl = window.messageElementMap?.get(message.id);
            searchResults.push({ message, index, element: messageEl });
        }
    });
    
    // Display results as list
    if (searchResults.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">No results found</div>';
    } else {
        resultsContainer.innerHTML = searchResults.map((result, idx) => {
            const preview = getMessagePreview(result.message);
            const time = formatTime(result.message.date);
            const sender = result.message.from || 'Unknown';
            const isActive = idx === currentSearchIndex;
            
            return `
                <div class="chat-search-result-item ${isActive ? 'active' : ''}" 
                     onclick="selectSearchResult(${idx})" 
                     data-message-id="${result.message.id}">
                    <div style="font-weight: 500; color: var(--text-primary);">${escapeHtml(sender)}</div>
                    <div class="result-preview">${escapeHtml(preview)}</div>
                    <div class="result-time">${time}</div>
                </div>
            `;
        }).join('');
    }
    
    // Set first result as active if we have results
    if (searchResults.length > 0 && currentSearchIndex < 0) {
        currentSearchIndex = 0;
    }
    
    updateSearchResults();
    
    // Highlight results in chat
    searchResults.forEach((result, idx) => {
        if (result.element) {
            result.element.classList.add('search-highlight');
            if (idx === currentSearchIndex) {
                result.element.classList.add('search-highlight-active');
            }
        }
    });
    
    if (searchResults.length > 0 && currentSearchIndex >= 0) {
        scrollToSearchResult(currentSearchIndex);
    }
}

function selectSearchResult(index) {
    currentSearchIndex = index;
    
    // Refresh search results display
    const resultsContainer = document.getElementById('chatSearchResults');
    if (resultsContainer && searchResults.length > 0) {
        resultsContainer.innerHTML = searchResults.map((result, idx) => {
            const preview = getMessagePreview(result.message);
            const time = formatTime(result.message.date);
            const sender = result.message.from || 'Unknown';
            const isActive = idx === currentSearchIndex;
            
            return `
                <div class="chat-search-result-item ${isActive ? 'active' : ''}" 
                     onclick="selectSearchResult(${idx})" 
                     data-message-id="${result.message.id}">
                    <div style="font-weight: 500; color: var(--text-primary);">${escapeHtml(sender)}</div>
                    <div class="result-preview">${escapeHtml(preview)}</div>
                    <div class="result-time">${time}</div>
                </div>
            `;
        }).join('');
    }
    
    updateSearchResults();
    scrollToSearchResult(index);
}

function scrollToSearchResult(index) {
    if (searchResults[index]?.element) {
        searchResults[index].element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function navigateSearch(direction) {
    if (searchResults.length === 0) return;
    
    // Remove active from current
    if (currentSearchIndex >= 0 && searchResults[currentSearchIndex]?.element) {
        searchResults[currentSearchIndex].element.classList.remove('search-highlight-active');
    }
    
    currentSearchIndex += direction;
    if (currentSearchIndex < 0) currentSearchIndex = searchResults.length - 1;
    if (currentSearchIndex >= searchResults.length) currentSearchIndex = 0;
    
    // Refresh search results display
    const resultsContainer = document.getElementById('chatSearchResults');
    if (resultsContainer && searchResults.length > 0) {
        resultsContainer.innerHTML = searchResults.map((result, idx) => {
            const preview = getMessagePreview(result.message);
            const time = formatTime(result.message.date);
            const sender = result.message.from || 'Unknown';
            const isActive = idx === currentSearchIndex;
            
            return `
                <div class="chat-search-result-item ${isActive ? 'active' : ''}" 
                     onclick="selectSearchResult(${idx})" 
                     data-message-id="${result.message.id}">
                    <div style="font-weight: 500; color: var(--text-primary);">${escapeHtml(sender)}</div>
                    <div class="result-preview">${escapeHtml(preview)}</div>
                    <div class="result-time">${time}</div>
                </div>
            `;
        }).join('');
    }
    
    updateSearchResults();
    scrollToSearchResult(currentSearchIndex);
}

function updateSearchResults() {
    const countEl = document.getElementById('searchResultCount');
    if (searchResults.length === 0) {
        countEl.textContent = '0 / 0';
    } else {
        countEl.textContent = `${currentSearchIndex + 1} / ${searchResults.length}`;
    }
}

// Setup chat search
document.addEventListener('DOMContentLoaded', () => {
    const chatSearchInput = document.getElementById('chatSearchInput');
    if (chatSearchInput) {
        chatSearchInput.addEventListener('input', performChatSearch);
        chatSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.shiftKey) {
                    navigateSearch(-1);
                } else {
                    navigateSearch(1);
                }
            } else if (e.key === 'Escape') {
                closeChatSearch();
            }
        });
    }
});

// Scroll to bottom
function scrollToBottom() {
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    }
}

// Media menu functions
function toggleMediaMenu() {
    const menu = document.getElementById('mediaMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

function showMediaSection(type) {
    if (!currentChat || !currentChat.messages) return;
    
    const mediaItems = currentChat.messages.filter(msg => {
        switch(type) {
            case 'photos': return msg.photo;
            case 'videos': return msg.video;
            case 'files': return msg.file && !msg.media_type;
            case 'stickers': return msg.media_type === 'sticker';
            case 'links': 
                if (msg.text) {
                    const text = typeof msg.text === 'string' ? msg.text : String(msg.text);
                    return /https?:\/\//.test(text);
                }
                return false;
            default: return false;
        }
    });
    
    // Close menu
    toggleMediaMenu();
    
    // Create media gallery view
    const chatArea = document.getElementById('chatArea');
    const avatar = getInitials(currentChat.name);
    
    const mediaView = `
        <div class="chat-header">
            <div class="chat-header-left" onclick="loadChat('${currentChat.path}')" style="cursor: pointer;">
                <div class="chat-header-avatar">${avatar}</div>
                <div class="chat-header-info">
                    <h2>${escapeHtml(currentChat.name)}</h2>
                    <p>${mediaItems.length} ${type}</p>
                </div>
            </div>
            <div class="chat-header-actions">
                <button class="header-button" onclick="loadChat('${currentChat.path}')" title="Back to chat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="media-gallery">
            ${mediaItems.map(item => {
                if (type === 'photos' && item.photo) {
                    const mediaPath = `${API_BASE}/api/media/${currentChat.path}/${item.photo}`;
                    return `<div class="media-item"><img src="${mediaPath}" onclick="openImageModal('${mediaPath}')" /></div>`;
                } else if (type === 'videos' && item.video) {
                    const mediaPath = `${API_BASE}/api/media/${currentChat.path}/${item.video}`;
                    return `<div class="media-item"><video src="${mediaPath}" controls></video></div>`;
                } else if (type === 'stickers' && item.thumbnail) {
                    const mediaPath = `${API_BASE}/api/media/${currentChat.path}/${item.thumbnail}`;
                    return `<div class="media-item"><img src="${mediaPath}" /></div>`;
                }
                return '';
            }).join('')}
        </div>
    `;
    
    chatArea.innerHTML = mediaView;
}


