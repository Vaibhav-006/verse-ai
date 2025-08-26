// Gemini API Key is provided by the backend
console.log('VerseAI AI script version: v20250826-1919');
let API_KEY = 'AIzaSyBLtiBnsRgy4TqUyMbGKdB_5-yF5ZMQHh4';
const BACKEND_BASE = 'https://verse-ai.onrender.com';
// Use a widely available stable model; 2.0 endpoints can be rolled out gradually
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
// Free image generation (Pollinations) and OCR (OCR.space)
const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt/';
const OCR_SPACE_URL = 'https://api.ocr.space/parse/image';
// Demo OCR key is rate-limited; replace with your own for production
const OCR_SPACE_API_KEY = 'helloworld';

let isDarkMode = true; // Set dark mode as default
document.body.setAttribute('data-theme', 'dark'); // Set dark theme by default

// Modify the theme toggle icon to show sun initially
document.querySelector('.theme-toggle i').className = 'fas fa-sun';
document.querySelector('.theme-toggle').innerHTML = `
    <i class="fas fa-sun"></i>
    Light mode
`;

// Theme toggle functionality
document.querySelector('.theme-toggle').addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    const themeButton = document.querySelector('.theme-toggle');
    const icon = themeButton.querySelector('i');
    
    if (isDarkMode) {
        icon.className = 'fas fa-sun';
        themeButton.innerHTML = `
            <i class="fas fa-sun"></i>
            Light mode
        `;
    } else {
        icon.className = 'fas fa-moon';
        themeButton.innerHTML = `
            <i class="fas fa-moon"></i>
            Dark mode
        `;
    }
    
    gsap.to(icon, {
        rotation: '+=180',
        duration: 0.5,
        ease: "power2.inOut"
    });

// Refresh chats when user returns to the tab/window (helps after re-login from Home)
window.addEventListener('focus', async () => {
    try { await populateServerChatsSidebar(); } catch (_) {}
});
});

// Auto-resize textarea
const textarea = document.getElementById('userInput');
textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
});

// --- Command hint popup logic ---
const commandHintEl = document.getElementById('commandHint');
function showCommandHint() {
    if (!commandHintEl) return;
    // Cancel any in-flight tweens to prevent stacking
    if (window.gsap && gsap.killTweensOf) gsap.killTweensOf(commandHintEl);
    commandHintEl.classList.remove('hidden');
    // Animate in similar to chat elements
    gsap.fromTo(commandHintEl,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
    );
}
function hideCommandHint() {
    if (!commandHintEl) return;
    // Cancel any in-flight tweens to prevent stacking
    if (window.gsap && gsap.killTweensOf) gsap.killTweensOf(commandHintEl);
    // Animate out then set hidden
    gsap.to(commandHintEl, {
        opacity: 0,
        y: 8,
        duration: 0.25,
        ease: 'power2.inOut',
        onComplete: () => commandHintEl.classList.add('hidden')
    });
}
// Dismiss when user starts typing or focuses the input
if (textarea) {
    textarea.addEventListener('input', hideCommandHint);
    textarea.addEventListener('focus', hideCommandHint);
}
// Handle hint chip clicks: insert command into input
if (commandHintEl) {
    commandHintEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.hint-chip');
        if (!btn) return;
        const cmd = btn.dataset.cmd || '';
        if (textarea) {
            textarea.value = cmd;
            textarea.dispatchEvent(new Event('input'));
            textarea.focus();
        }
        hideCommandHint();
    });
}

// Send message functionality
document.getElementById('sendBtn').addEventListener('click', sendMessage);
textarea.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Add these variables at the top of the file
let currentFile = null;
let isSpeakingResponse = false;
const speechSynthesis = window.speechSynthesis;
let wasVoiceInput = false;

// Add these variables at the top
let isTyping = false;
let currentMessageTl = null;
// Auto-scroll control for the current bot response
let autoScrollForCurrent = false;
let autoScrollScrollHandler = null;

// Add these variables at the top
let currentConversationId = null;
// Map local conversation -> server chat id (when logged in)
const serverChatIdByLocalId = new Map();
const localIdByServerId = new Map();

// Add these variables at the top
let uploadedFile = null;
let fileContent = null;

// Add these variables at the top of the file
let recognition = null;
let isListening = false;

// Load API key from backend when needed
async function getApiKey() {
    if (API_KEY) return API_KEY;
    try {
        const res = await fetch(`${BACKEND_BASE}/config/gemini-key`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
            mode: 'cors',
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Key endpoint error: ${res.status} ${text?.slice(0, 120)}`);
        }
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
            const text = await res.text();
            throw new Error(`Non-JSON key response: ${text.slice(0, 120)}`);
        }
        const data = await res.json();
        if (!data || !data.key) {
            throw new Error('Gemini key missing in response');
        }
        API_KEY = data.key;
        return API_KEY;
    } catch (e) {
        console.error('Failed to load Gemini API key:', e);
        throw e;
    }
}

// Add file handling functions
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    currentFile = file;
    showFilePreview(file);

    // Read file content
    if (file.type.startsWith('image/')) {
        processImage(file);
    } else if (file.type === 'application/pdf') {
        processPDF(file);
    } else if (file.type === 'text/plain') {
        processTextFile(file);
    }
}

function showFilePreview(file) {
    const preview = document.querySelector('.file-preview');
    preview.innerHTML = `
        <div class="file-item">
            <i class="fas ${getFileIcon(file.type)}"></i>
            <span>${file.name}</span>
            <i class="fas fa-times remove-file" onclick="removeFile()"></i>
        </div>
    `;
}

function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) return 'fa-image';
    if (fileType === 'application/pdf') return 'fa-file-pdf';
    if (fileType === 'text/plain') return 'fa-file-text';
    return 'fa-file';
}

function removeFile() {
    currentFile = null;
    document.querySelector('.file-preview').innerHTML = '';
    document.getElementById('fileInput').value = '';
}

async function processImage(file) {
    try {
        // Convert image to base64
        const base64Image = await fileToBase64(file);
        // You can now use this base64Image with your API
        console.log('Image processed:', base64Image.substring(0, 50) + '...');
    } catch (error) {
        console.error('Error processing image:', error);
    }
}

async function processPDF(file) {
    // You'll need to add pdf.js library for PDF processing
    console.log('PDF processing to be implemented');
}

async function processTextFile(file) {
    try {
        const text = await file.text();
        console.log('Text file content:', text.substring(0, 100) + '...');
    } catch (error) {
        console.error('Error reading text file:', error);
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Add file handling function
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const filePreview = document.querySelector('.file-preview');
        filePreview.innerHTML = `
            <div class="file-info">
                <i class="fas ${getFileIcon(file.type)}"></i>
                <span>${file.name}</span>
                <button onclick="removeUploadedFile()" class="remove-file">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        filePreview.style.display = 'block';
        // Add small delay to trigger transition
        setTimeout(() => filePreview.classList.add('show'), 10);

        if (file.type.startsWith('image/')) {
            // Add size check for images
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                showUploadError('Image size should be less than 5MB');
                removeUploadedFile();
                return;
            }
            uploadedFile = file;
            fileContent = await fileToBase64(file);
            showUploadSuccess('Image uploaded successfully. You can now ask questions about it.');
        } else if (file.type === 'application/pdf') {
            const text = await extractPDFText(file);
            uploadedFile = file;
            fileContent = text;
            showUploadSuccess('PDF uploaded successfully. You can now ask questions about it.');
        } else if (file.type === 'text/plain') {
            const text = await file.text();
            uploadedFile = file;
            fileContent = text;
            showUploadSuccess('Text file uploaded successfully. You can now ask questions about it.');
        } else {
            showUploadError('Unsupported file type. Please upload an image, PDF, or text file.');
            removeUploadedFile();
        }
    } catch (error) {
        console.error('Error processing file:', error);
        showUploadError('Error processing file. Please try again.');
        removeUploadedFile();
    }
}

// Get appropriate icon for file type
function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) return 'fa-image';
    if (fileType === 'application/pdf') return 'fa-file-pdf';
    if (fileType === 'text/plain') return 'fa-file-text';
    return 'fa-file';
}

// Convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Extract text from PDF
async function extractPDFText(file) {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
        }
        
        return text;
    } catch (error) {
        console.error('Error extracting PDF text:', error);
        throw error;
    }
}

// Remove uploaded file
function removeUploadedFile() {
    uploadedFile = null;
    fileContent = null;
    document.getElementById('fileInput').value = '';
    const filePreview = document.querySelector('.file-preview');
    filePreview.classList.remove('show');
    setTimeout(() => {
        filePreview.style.display = 'none';
        filePreview.innerHTML = '';
    }, 300); // Wait for transition to complete
}

// Show upload status messages
function showUploadSuccess(message) {
    const status = document.querySelector('.upload-status');
    status.textContent = message;
    status.className = 'upload-status success';
    setTimeout(() => status.className = 'upload-status', 3000);
}

function showUploadError(message) {
    const status = document.querySelector('.upload-status');
    status.textContent = message;
    status.className = 'upload-status error';
    setTimeout(() => status.className = 'upload-status', 3000);
}

// Modify sendMessage function to include auto-scroll
async function sendMessage() {
    const userInput = textarea.value.trim();
    if (!userInput && !fileContent) return;
    // Ensure command hint is hidden once a message is being sent
    hideCommandHint();

    // Add user message to chat with file context
    let messageText = userInput || '';
    
    // Add user message without the "Analyzing" text
    addMessage(messageText, 'user');

    // Route special commands (/imagine, /ocr) before calling Gemini
    try {
        const handled = await handleCommands(messageText);
        if (handled) {
            textarea.value = '';
            textarea.style.height = 'auto';
            return;
        }
    } catch (e) {
        console.warn('Command handling error:', e);
    }

    // Persist user message immediately if logged in
    let createdServerChat = false;
    try {
        const beforeId = currentConversationId;
        const maybeId = await ensureServerChatForCurrent(messageText);
        if (maybeId) {
            createdServerChat = true;
            // Save the user message right away
            await appendMessageToServer(beforeId, 'user', messageText);
            // If a new server chat was created, refresh sidebar to show it
            if (createdServerChat) { try { await populateServerChatsSidebar(); } catch (_) {} }
        }
    } catch (e) {
        console.warn('Persist user message failed:', e.message);
    }
    
    textarea.value = '';
    textarea.style.height = 'auto';

    try {
        addTypingIndicator();

        const requestBody = {
            contents: [{
                parts: []
            }],
            generationConfig: {
                maxOutputTokens: 2048,
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                stopSequences: []
            }
        };

        // Add text content with proper formatting
        let textContent = userInput || '';
        if (fileContent && !uploadedFile?.type.startsWith('image/')) {
            textContent += `\n\nFile content:\n${fileContent}`;
        }

        requestBody.contents[0].parts.push({
            text: textContent
        });

        // Direct client-side call to Google Gemini with provided API key
        // NOTE: This exposes the key to the client. Ensure referrer restrictions are set on the key.
        const DIRECT_API_KEY = 'AIzaSyCw9litrf3O8zjaG3sfm0oVqToUXV6rsKE';
        let data;
        const response = await fetch(`${API_URL}?key=${DIRECT_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        const respText = await response.text();
        if (!response.ok) {
            throw new Error(`Gemini API error ${response.status}: ${respText.slice(0, 400)}`);
        }
        try {
            data = JSON.parse(respText);
        } catch (e) {
            throw new Error(`Gemini non-JSON response: ${respText.slice(0, 400)}`);
        }
        
        removeTypingIndicator();

        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            const fullResponse = data.candidates[0].content.parts[0].text;
            addMessage(fullResponse, 'bot');
            // Persist bot response if logged in
            try {
                const localId = currentConversationId;
                if (serverChatIdByLocalId.has(localId)) {
                    await appendMessageToServer(localId, 'bot', fullResponse);
                }
            } catch (e) {
                console.warn('Persist chat failed:', e.message);
            }
        } else if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.inlineData) {
            // fallback if text is not present
            addMessage('[Received non-text content from model]', 'bot');
        } else if (data.error) {
            throw new Error(`Gemini API returned error: ${data.error.message || JSON.stringify(data.error)}`);
        } else {
            throw new Error('Invalid response format from Gemini');
        }

    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();
        const msg =
          error && String(error).includes('Gemini')
            ? 'Gemini is not configured. Please try again later.'
            : 'Sorry, I encountered an error. Please try again.';
        addMessage(msg, 'bot');
    }
}

// Initialize GSAP timeline
const tl = gsap.timeline();

// Enhanced initial animation
window.addEventListener('load', () => {
    tl.from('.chat-header', {
        y: -50,
        opacity: 0,
        duration: 0.8,
        ease: "back.out(1.7)"
    })
    .from('.chat-container', {
        scale: 0.8,
        opacity: 0,
        duration: 0.8,
        ease: "power4.out"
    }, "-=0.4")
    .from('.chat-input-container', {
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: "back.out(1.7)"
    }, "-=0.4");
});

// Modify addMessage function to include auto-scroll
function addMessage(text, sender) {
    const welcomeScreen = document.getElementById('welcomeScreen');
    if (welcomeScreen) {
        gsap.to(welcomeScreen, {
            opacity: 0,
            duration: 0.3,
            onComplete: () => welcomeScreen.remove()
        });
    }

    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    if (sender === 'bot') {
        const avatar = document.createElement('div');
        avatar.className = 'bot-avatar';
        avatar.innerHTML = '<i class="fas fa-robot"></i>';
        messageDiv.appendChild(avatar);
    }

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Add text directly for voice input user messages
    if (sender === 'user' && wasVoiceInput) {
        messageContent.innerHTML = `<span class="word">${text}</span>`;
        messageDiv.appendChild(messageContent);
        messagesContainer.appendChild(messageDiv);
        return;
    }

    // Split text into larger chunks for better handling of long responses
    const chunks = text.split(/([.!?]\s+)/).map((chunk, i, arr) => {
        if (i % 2 === 0) return chunk;
        return chunk + (arr[i + 1] || '');
    }).filter(Boolean);
    let currentText = '';

    messageDiv.appendChild(messageContent);
    messagesContainer.appendChild(messageDiv);

    // Show stop button when typing starts
    const stopBtn = document.querySelector('.stop-btn');
    if (stopBtn) stopBtn.style.display = 'block';
    isTyping = true;

    // Setup auto-scroll monitoring for bot replies
    if (sender === 'bot') {
        autoScrollForCurrent = true; // enabled until user interferes
        // Remove any previous handler just in case
        if (autoScrollScrollHandler) {
            messagesContainer.removeEventListener('scroll', autoScrollScrollHandler);
        }
        autoScrollScrollHandler = () => {
            // If user scrolls away from bottom by threshold, disable auto-scroll for this response
            const threshold = 24; // px from bottom
            const atBottom = messagesContainer.scrollTop + messagesContainer.clientHeight >= (messagesContainer.scrollHeight - threshold);
            if (!atBottom) {
                autoScrollForCurrent = false;
            }
        };
        messagesContainer.addEventListener('scroll', autoScrollScrollHandler, { passive: true });
    }

    // Create timeline for message animation
    currentMessageTl = gsap.timeline({
        onComplete: () => {
            isTyping = false;
            if (!wasVoiceInput && stopBtn) {
                stopBtn.style.display = 'none';
            }
            // Cleanup auto-scroll listener after this response finishes
            if (autoScrollScrollHandler) {
                messagesContainer.removeEventListener('scroll', autoScrollScrollHandler);
                autoScrollScrollHandler = null;
            }
            autoScrollForCurrent = false;
        }
    });

    currentMessageTl.fromTo(messageDiv, 
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }
    );

    // Type out text with proper formatting
    chunks.forEach((chunk, index) => {
        currentMessageTl.add(() => {
            currentText += chunk;
            const formattedText = currentText
                .split('\n')
                .map(line => {
                    // Preserve empty lines
                    if (!line.trim()) return '<br>';
                    return line;
                })
                .join('\n')
                .split(' ')
                .filter(word => word.length > 0)
                .map(word => `<span class="word">${word}</span>`)
                .join(' ')
                .replace(/```([\s\S]*?)```/g, (match, code) => {
                    return `
                        <div class="code-block">
                            <div class="code-header">
                                <button class="copy-btn" onclick="copyCode(this)">
                                    <i class="fas fa-copy"></i>
                                    Copy
                                </button>
                            </div>
                            <pre><code>${highlightCode(code.trim())}</code></pre>
                        </div>
                    `;
                });
            messageContent.innerHTML = formattedText;
            // Keep view pinned to bottom while auto-scroll is active for this response
            if (sender === 'bot' && autoScrollForCurrent) {
                // Use rAF to avoid layout thrash during GSAP updates
                requestAnimationFrame(() => {
                    // Avoid smooth here to keep up with typing
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                });
            }
        }, index * 0.01);
    });

    // Handle speech synthesis for voice input
    if (sender === 'bot' && wasVoiceInput) {
        currentMessageTl.add(async () => {
            try {
                await loadVoices();
                const voices = window.speechSynthesis.getVoices();
                const preferredVoice = voices.find(voice => 
                    voice.name.includes('Google Assistant') ||
                    voice.name.includes('Google UK English Female') ||
                    voice.name.includes('Google US English') ||
                    voice.name.includes('English United States') ||
                    voice.name.includes('Microsoft Zira')
                ) || voices.find(voice => 
                    voice.lang === 'en-US' && voice.name.includes('Female')
                );

                const plainText = text.replace(/```[\s\S]*?```/g, ''); // Remove code blocks for speech
                const utterance = new SpeechSynthesisUtterance(plainText);
                utterance.rate = 1.2;
                utterance.pitch = 1.05;
                utterance.volume = 1.0;
                utterance.lang = 'en-US';

                if (preferredVoice) {
                    utterance.voice = preferredVoice;
                }

                const wordElements = messageContent.querySelectorAll('.word');
                let currentWordIndex = 0;

                utterance.onboundary = (event) => {
                    if (event.name === 'word' && currentWordIndex < wordElements.length) {
                        wordElements.forEach(word => word.classList.remove('speaking-word'));
                        wordElements[currentWordIndex].classList.add('speaking-word');
                        currentWordIndex++;
                    }
                };

                utterance.onend = () => {
                    wordElements.forEach(word => word.classList.remove('speaking-word'));
                    wasVoiceInput = false;
                };

                speechSynthesis.cancel();
                speechSynthesis.speak(utterance);

            } catch (error) {
                console.error('Speech synthesis error:', error);
                wasVoiceInput = false;
            }
        });
    }

    // Initial scroll to bottom when message node is appended
    if (sender === 'bot') {
        // Snap to bottom initially to reveal the start of the response
        requestAnimationFrame(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    } else {
        // For user messages, keep smooth scroll
        setTimeout(() => {
            messagesContainer.scrollTo({
                top: messagesContainer.scrollHeight,
                behavior: 'smooth'
            });
        }, 50);
    }

    // Add to chat history in sidebar
    if (sender === 'user') {
        addToChatHistory(text);
    }
}

// Store chat conversations
let conversations = [];

// ---- Auth/Chat backend helpers ----
function getAuthToken() {
    try { return localStorage.getItem('token'); } catch (_) { return null; }
}

async function apiFetch(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BACKEND_BASE}${path}`, { ...options, headers });
    if (!res.ok) {
        const msg = await res.text().catch(() => '');
        throw new Error(`API ${path} ${res.status}: ${msg.slice(0,200)}`);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
}

async function ensureServerChatForCurrent(titleHint) {
    const token = getAuthToken();
    if (!token) return null;
    if (!currentConversationId) return null;
    if (serverChatIdByLocalId.has(currentConversationId)) return serverChatIdByLocalId.get(currentConversationId);
    const body = { title: (titleHint || 'New chat').slice(0, 60) };
    const data = await apiFetch('/api/chats', { method: 'POST', body: JSON.stringify(body) });
    const serverId = data?.chat?._id;
    if (serverId) {
        serverChatIdByLocalId.set(currentConversationId, serverId);
        localIdByServerId.set(serverId, currentConversationId);
        // mark sidebar item if exists
        const item = document.querySelector(`.chat-history-item[data-id="${currentConversationId}"]`);
        if (item) item.dataset.serverId = serverId;
    }
    return serverId;
}

async function appendMessageToServer(localConvId, role, content) {
    const token = getAuthToken();
    if (!token) return;
    const serverId = serverChatIdByLocalId.get(localConvId);
    if (!serverId) return;
    await apiFetch(`/api/chats/${serverId}/messages`, { method: 'POST', body: JSON.stringify({ role, content }) });
}

async function fetchChatsList() {
    const token = getAuthToken();
    if (!token) return [];
    const data = await apiFetch('/api/chats', { method: 'GET' });
    return data?.chats || [];
}

async function fetchChat(serverId) {
    const token = getAuthToken();
    if (!token) throw new Error('Not logged in');
    const data = await apiFetch(`/api/chats/${serverId}`, { method: 'GET' });
    return data?.chat;
}

function renderMessageSimple(role, text, container) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    if (role === 'bot') {
        const avatar = document.createElement('div');
        avatar.className = 'bot-avatar';
        avatar.innerHTML = '<i class="fas fa-robot"></i>';
        messageDiv.appendChild(avatar);
    }
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = text;
    messageDiv.appendChild(content);
    container.appendChild(messageDiv);
}

// Minimal image bubble renderer for generated images and previews
function addImageBubble(imageUrl, caption = '', sender = 'bot') {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    if (sender === 'bot') {
        const avatar = document.createElement('div');
        avatar.className = 'bot-avatar';
        avatar.innerHTML = '<i class="fas fa-robot"></i>';
        messageDiv.appendChild(avatar);
    }
    const content = document.createElement('div');
    content.className = 'message-content';
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = caption || 'image';
    img.loading = 'lazy';
    content.appendChild(img);
    if (caption) {
        const cap = document.createElement('div');
        cap.className = 'image-caption';
        cap.textContent = caption;
        content.appendChild(cap);
    }
    messageDiv.appendChild(content);
    messagesContainer.appendChild(messageDiv);
}

async function loadServerChatToUI(serverId) {
    try {
        const chat = await fetchChat(serverId);
        if (!chat) return;
        let localId = localIdByServerId.get(serverId);
        if (!localId) {
            // create a local shadow conversation id and mapping
            localId = Date.now();
            localIdByServerId.set(serverId, localId);
            serverChatIdByLocalId.set(localId, serverId);
        }
        currentConversationId = localId;

        // Update sidebar active state
        document.querySelectorAll('.chat-history-item').forEach(i => i.classList.remove('active'));
        const item = document.querySelector(`.chat-history-item[data-server-id="${serverId}"]`);
        if (item) item.classList.add('active');

        // Render messages
        const chatMessages = document.getElementById('chatMessages');
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) welcomeScreen.remove();
        chatMessages.innerHTML = '';
        (chat.messages || []).forEach(m => renderMessageSimple(m.role, m.content, chatMessages));
    } catch (e) {
        console.error('Failed to load server chat:', e);
    }
}

async function populateServerChatsSidebar() {
    try {
        const chats = await fetchChatsList();
        const sidebar = document.querySelector('.chat-history');
        if (!sidebar) return;
        // Do not clear locally created items; prepend server items
        chats.forEach(chat => {
            // Skip if already present
            if (document.querySelector(`.chat-history-item[data-server-id="${chat._id}"]`)) return;
            const div = document.createElement('div');
            div.className = 'chat-history-item';
            div.dataset.serverId = chat._id;
            div.innerHTML = `<i class="fas fa-message"></i><span>${chat.title || 'New chat'}</span>`;
            div.addEventListener('click', () => loadServerChatToUI(chat._id));
            sidebar.prepend(div);
        });
    } catch (e) {
        // silent
    }
}

// Modify addToChatHistory function
function addToChatHistory(text) {
    // Create new conversation if none exists
    if (!currentConversationId) {
        currentConversationId = Date.now();
        conversations.push({
            id: currentConversationId,
            messages: [],
            title: text.substring(0, 30) + (text.length > 30 ? '...' : '')
        });
    }

    // Add message to current conversation
    const currentConversation = conversations.find(c => c.id === currentConversationId);
    const messages = document.getElementById('chatMessages').innerHTML;
    currentConversation.messages = messages;

    // Create history item if it doesn't exist
    if (!document.querySelector(`.chat-history-item[data-id="${currentConversationId}"]`)) {
        const historyDiv = document.createElement('div');
        historyDiv.className = 'chat-history-item active'; // Add active class to new conversation
        historyDiv.setAttribute('data-id', currentConversationId);
        historyDiv.innerHTML = `
            <i class="fas fa-message"></i>
            <span>${currentConversation.title}</span>
        `;
        
        // Remove active class from other history items
        document.querySelectorAll('.chat-history-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add click handler to switch conversations (local)
        historyDiv.addEventListener('click', () => {
            // If this item is linked to a server chat, load from server
            const serverId = historyDiv.dataset.serverId;
            if (serverId) return loadServerChatToUI(serverId);
            switchConversation(currentConversationId);
        });
        
        document.querySelector('.chat-history').prepend(historyDiv);

        gsap.from(historyDiv, {
            opacity: 0,
            x: -20,
            duration: 0.3
        });
    }
}

// Modify switchConversation function
function switchConversation(conversationId) {
    // Save current conversation before switching
    if (currentConversationId) {
        const currentConversation = conversations.find(c => c.id === currentConversationId);
        if (currentConversation) {
            currentConversation.messages = document.getElementById('chatMessages').innerHTML;
        }
    }

    // Update current conversation ID
    currentConversationId = conversationId;

    // Load selected conversation
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
        const chatMessages = document.getElementById('chatMessages');
        
        // Remove welcome screen if it exists
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) {
            welcomeScreen.remove();
        }
        
        // Set the messages
        chatMessages.innerHTML = conversation.messages;
        
        // Reattach event listeners for message hover effects
        reattachMessageEventListeners();
    }

    // Update active state in sidebar
    document.querySelectorAll('.chat-history-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-id') === conversationId.toString()) {
            item.classList.add('active');
        }
    });
}

// Add function to reattach message event listeners
function reattachMessageEventListeners() {
    document.querySelectorAll('.message').forEach(message => {
        message.addEventListener('mouseover', () => {
            gsap.to(message, {
                scale: 1.02,
                duration: 0.3,
                ease: "power2.out"
            });
        });

        message.addEventListener('mouseout', () => {
            gsap.to(message, {
                scale: 1,
                duration: 0.3,
                ease: "power2.out"
            });
        });
    });
}

// Enhanced typing indicator
function addTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message bot-message typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    document.getElementById('chatMessages').appendChild(indicator);

    // Animate dots with GSAP
    gsap.to(indicator.children, {
        scale: 1.2,
        duration: 0.6,
        stagger: {
            each: 0.2,
            repeat: -1,
            yoyo: true
        },
        ease: "power2.inOut"
    });

    // Bounce animation
    gsap.to(indicator, {
        y: -3,
        duration: 1.5,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut"
    });
}

function removeTypingIndicator() {
    const indicator = document.querySelector('.typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Add input focus animations
textarea.addEventListener('focus', () => {
    gsap.to('.chat-input-container', {
        boxShadow: '0 0 20px rgba(142, 68, 173, 0.2)',
        duration: 0.3
    });
});

textarea.addEventListener('blur', () => {
    gsap.to('.chat-input-container', {
        boxShadow: 'none',
        duration: 0.3
    });
});

// Enable/disable send button based on input
textarea.addEventListener('input', () => {
    const hasText = textarea.value.trim().length > 0;
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = !hasText;
    
    if (hasText) {
        gsap.to(sendBtn, {
            scale: 1.1,
            duration: 0.3,
            ease: "back.out(1.7)"
        });
    } else {
        gsap.to(sendBtn, {
            scale: 1,
            duration: 0.3,
            ease: "power2.out"
        });
    }
});

// Add click handlers for suggestion chips
document.querySelectorAll('.suggestion-chips button').forEach(button => {
    button.addEventListener('click', () => {
        textarea.value = button.textContent;
        textarea.dispatchEvent(new Event('input'));
        sendMessage();
    });
});

// Modify the new chat button functionality
document.querySelector('.new-chat').addEventListener('click', () => {
    // Save current conversation before creating new one
    if (currentConversationId) {
        const currentConversation = conversations.find(c => c.id === currentConversationId);
        if (currentConversation) {
            currentConversation.messages = document.getElementById('chatMessages').innerHTML;
        }
    }

    // Reset current conversation ID
    currentConversationId = null;

    // Clear chat messages
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    // Create and show welcome screen
    const welcomeScreen = document.createElement('div');
    welcomeScreen.className = 'welcome-screen';
    welcomeScreen.id = 'welcomeScreen';
    welcomeScreen.innerHTML = `
        <h1>Hello, I'm Verse AI</h1>
        <p>How can I help you today?</p>
        <div class="suggestion-chips">
            <button>Help me write</button>
            <button>Help me analyze</button>
            <button>Help me code</button>
            <button>Help me learn</button>
        </div>
    `;
    
    // Add welcome screen with animation
    chatMessages.appendChild(welcomeScreen);
    gsap.from(welcomeScreen, {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: "power2.out"
    });

    // Remove active state from all history items
    document.querySelectorAll('.chat-history-item').forEach(item => {
        item.classList.remove('active');
    });

    // Re-add click handlers for suggestion chips
    welcomeScreen.querySelectorAll('.suggestion-chips button').forEach(button => {
        button.addEventListener('click', () => {
            textarea.value = button.textContent;
            textarea.dispatchEvent(new Event('input'));
            sendMessage();
        });
    });

    // Clear textarea
    textarea.value = '';
    textarea.style.height = 'auto';
    document.getElementById('sendBtn').disabled = true;
    // Show command hints for fresh chat
    showCommandHint();
});

// Add hover animation for messages
document.getElementById('chatMessages').addEventListener('mouseover', (e) => {
    if (e.target.classList.contains('message')) {
        gsap.to(e.target, {
            scale: 1.02,
            duration: 0.3,
            ease: "power2.out"
        });
    }
});

document.getElementById('chatMessages').addEventListener('mouseout', (e) => {
    if (e.target.classList.contains('message')) {
        gsap.to(e.target, {
            scale: 1,
            duration: 0.3,
            ease: "power2.out"
        });
    }
});

// Update the speech recognition setup
document.addEventListener('DOMContentLoaded', async () => {
    // Load voices first
    await loadVoices();
    
    // Populate server chats ASAP (works even if speech recognition is unsupported)
    try { await populateServerChatsSidebar(); } catch (_) {}
    
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error('Speech recognition not supported');
        const micEl = document.querySelector('.mic-btn');
        if (micEl) {
            micEl.classList.add('disabled');
            micEl.setAttribute('title', 'Voice input is not supported in this browser. Try Chrome or Edge.');
            // Attach a click handler to inform the user
            micEl.addEventListener('click', (e) => {
                e.preventDefault();
                showNotification('Voice input is not supported in this browser. Try Chrome or Edge.', 'error');
            }, { once: false });
        }
        // Do NOT return early; continue initializing rest of the UI
    }

    // First request microphone permission
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream after getting permission
        
        // Initialize speech recognition
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US'; // Add language setting

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            textarea.value = transcript;
            hideMicPopup();
            isListening = false;
            updateMicButton();

            // Auto send message after voice input
            if (transcript.trim()) {
                setTimeout(() => {
                    const sendBtn = document.getElementById('sendBtn');
                    sendBtn.disabled = false;
                    sendMessage();
                }, 500);
            }
        };

        recognition.onend = () => {
            isListening = false;
            hideMicPopup();
            updateMicButton();
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isListening = false;
            hideMicPopup();
            updateMicButton();
            // Show error message to user
            const errorMessage = event.error === 'not-allowed' 
                ? 'Microphone access denied. Please check your permissions.'
                : 'Error with speech recognition. Please try again.';
            showNotification(errorMessage, 'error');
        };

        const micButton = document.querySelector('.mic-btn');
        if (micButton) {
            // If disabled (unsupported), keep the info click; otherwise wire real handler
            if (!micButton.classList.contains('disabled')) {
                micButton.addEventListener('click', toggleSpeechRecognition);
            }
        }

    } catch (err) {
        console.error('Microphone permission denied:', err);
        const micEl = document.querySelector('.mic-btn');
        if (micEl) {
            micEl.classList.add('disabled');
            micEl.setAttribute('title', 'Microphone blocked. Allow mic access or use Chrome/Edge.');
            micEl.addEventListener('click', (e) => {
                e.preventDefault();
                showNotification('Microphone blocked. Please allow mic access in site permissions.', 'error');
            }, { once: false });
        }
    }

    // (Already populated above)

    // If no messages yet, show quick command hint
    try {
        const cm = document.getElementById('chatMessages');
        const hasContent = cm && cm.children && cm.children.length > 0;
        if (!hasContent) showCommandHint();
    } catch (_) {}

    // Handle placeholder text for different screen sizes
    const updatePlaceholder = () => {
        if (window.innerWidth <= 768) {
            textarea.placeholder = "Chat";
        } else {
            textarea.placeholder = "Message VerseAI...";
        }
    };

    // Initial call
    updatePlaceholder();

    // Update on resize
    window.addEventListener('resize', updatePlaceholder);
});

// Add these functions to handle the mic popup
function showMicPopup() {
    document.querySelector('.mic-popup').classList.add('active');
    document.querySelector('.mic-popup-overlay').classList.add('active');
}

function hideMicPopup() {
    document.querySelector('.mic-popup').classList.remove('active');
    document.querySelector('.mic-popup-overlay').classList.remove('active');
}

// Update the toggleSpeechRecognition function
function toggleSpeechRecognition() {
    if (!recognition) {
        console.error('Speech recognition not initialized');
        return;
    }

    if (isListening) {
        recognition.stop();
        stopSpeaking();
        wasVoiceInput = false;
        hideMicPopup();
        isListening = false;
    } else {
        stopSpeaking();
        wasVoiceInput = true;
        isListening = true;
        try {
            recognition.start();
            showMicPopup();
            console.log('Starting recognition...');
        } catch (error) {
            console.error('Error starting recognition:', error);
            recognition.stop();
            isListening = false;
            hideMicPopup();
            setTimeout(() => {
                try {
                    recognition.start();
                    isListening = true;
                    showMicPopup();
                } catch (e) {
                    console.error('Failed to restart recognition:', e);
                    isListening = false;
                    hideMicPopup();
                }
            }, 100);
        }
    }
    updateMicButton();
}

// Update updateMicButton function
function updateMicButton() {
    const micBtn = document.querySelector('.mic-btn');
    const micIcon = micBtn.querySelector('i');
    
    if (isListening) {
        micBtn.classList.add('listening');
        micIcon.className = 'fas fa-stop';
    } else {
        micBtn.classList.remove('listening');
        micIcon.className = 'fas fa-microphone';
    }
}

// Show listening animation
function showListeningAnimation() {
    const animation = document.querySelector('.listening-animation');
    animation.classList.add('active');
    
    const waves = animation.querySelectorAll('.listening-wave');
    waves.forEach((wave, index) => {
        gsap.to(wave, {
            height: gsap.utils.random(10, 20),
            duration: 0.5,
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut",
            delay: index * 0.1
        });
    });
}

// Hide listening animation
function hideListeningAnimation() {
    const animation = document.querySelector('.listening-animation');
    animation.classList.remove('active');
    
    const waves = animation.querySelectorAll('.listening-wave');
    waves.forEach(wave => {
        gsap.killTweensOf(wave);
    });
}

// Update the stopSpeaking function
function stopSpeaking() {
    speechSynthesis.cancel();
    wasVoiceInput = false;
}

// Add event listener to stop speaking when user starts typing
textarea.addEventListener('keydown', () => {
    wasVoiceInput = false; // Reset voice input flag when typing
    stopSpeaking();
});

// Update loadVoices function to be more robust
function loadVoices() {
    return new Promise((resolve) => {
        let voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            resolve(voices);
        } else {
            window.speechSynthesis.onvoiceschanged = () => {
                voices = window.speechSynthesis.getVoices();
                resolve(voices);
            };
            // Fallback in case voices don't load
            setTimeout(resolve, 1000);
        }
    });
}

// Add the stop function
function stopAllActions() {
    // Stop speaking
    speechSynthesis.cancel();
    wasVoiceInput = false;

    // Stop typing animation
    if (currentMessageTl) {
        currentMessageTl.progress(1); // Complete the typing instantly
    }
    isTyping = false;

    // Remove any highlighting
    document.querySelectorAll('.word').forEach(word => {
        word.classList.remove('speaking-word');
    });

    // Update stop button visibility
    const stopBtn = document.querySelector('.stop-btn');
    if (stopBtn) stopBtn.style.display = 'none';
}

// Add copy code functionality
function copyCode(button) {
    const codeBlock = button.closest('.code-block');
    const code = codeBlock.querySelector('code').textContent;
    
    navigator.clipboard.writeText(code).then(() => {
        button.innerHTML = '<i class="fas fa-check"></i>Copied!';
        button.classList.add('copied');
        
        setTimeout(() => {
            button.innerHTML = '<i class="fas fa-copy"></i>Copy';
            button.classList.remove('copied');
        }, 2000);
    });
}

// Add syntax highlighting
function highlightCode(code) {
    return code
        .replace(/\b(function|def|class|if|else|return|import|from|as)\b/g, '<span class="keyword">$1</span>')
        .replace(/\b([a-zA-Z_]\w*)\(/g, '<span class="function">$1</span>(')
        .replace(/"([^"]*)"|'([^']*)'/g, '<span class="string">$&</span>')
        .replace(/\b(\d+)\b/g, '<span class="number">$1</span>')
        .replace(/#.*/g, '<span class="comment">$&</span>');
}

// Mobile menu toggle functionality
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        menuToggle.innerHTML = sidebar.classList.contains('active') 
            ? '<i class="fas fa-times"></i>' 
            : '<i class="fas fa-bars"></i>';
    });

    // Close sidebar when clicking outside
    mainContent.addEventListener('click', () => {
        if (sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
        }
    });

    // Handle window resize
    let windowWidth = window.innerWidth;
    window.addEventListener('resize', () => {
        if (window.innerWidth !== windowWidth) {
            windowWidth = window.innerWidth;
            if (windowWidth > 768) {
                sidebar.classList.remove('active');
                menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
            }
        }
    });
});

// Add notification function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// ---- Command router + image helpers ----
async function handleCommands(inputText) {
    const trimmed = (inputText || '').trim();
    if (!trimmed) return false;
    // Image generation commands
    const imgCmdMatch = trimmed.match(/\/(imagine|image|img|im)\b/i);
    if (imgCmdMatch) {
        let prompt = trimmed.replace(/.*?\/(imagine|image|img|im)\b\s*/i, '');
        prompt = prompt.replace(/^generate(\s+an)?(\s+image)?(\s+of)?\s*/i, '').trim();
        if (!prompt) {
            addMessage('Usage: /imagine your prompt here', 'bot');
            return true;
        }
        await generateImageWithPollinations(prompt);
        return true;
    }
    // OCR command
    if (/^\/?ocr\b/i.test(trimmed)) {
        if (!uploadedFile || !uploadedFile.type || !uploadedFile.type.startsWith('image/')) {
            addMessage('Please upload an image first, then send /ocr', 'bot');
            return true;
        }
        // If user adds a question after /ocr, treat it as a request to describe the image
        const after = trimmed.replace(/^\/?ocr\b\s*/i, '');
        if (after && /\b(what|who|where|why|how|describe|about|explain)\b/i.test(after)) {
            const prompt = after.trim() || 'Describe this image in detail.';
            await describeUploadedImage(prompt);
            return true;
        }
        await runOcrOnUploadedImage();
        return true;
    }
    // Describe uploaded image
    if (/^\/?(describe|vision|des)\b/i.test(trimmed)) {
        if (!uploadedFile || !uploadedFile.type || !uploadedFile.type.startsWith('image/')) {
            addMessage('Please upload an image first, then send /describe', 'bot');
            return true;
        }
        const prompt = trimmed.replace(/^\/?(describe|vision|des)\b\s*/i, '').trim() || 'Describe this image in detail.';
        await describeUploadedImage(prompt);
        return true;
    }
    return false;
}

async function generateImageWithPollinations(prompt) {
    const encoded = encodeURIComponent(prompt);
    const url = `${POLLINATIONS_BASE}${encoded}?nologo=true&enhance=true&model=flux&aspect=1:1`;
    addMessage(`Generating image for: ${prompt}`, 'bot');
    addImageBubble(url, prompt, 'bot');
}

async function runOcrOnUploadedImage() {
    try {
        addTypingIndicator();

        // Show a quick preview immediately so UI doesn't feel stuck
        try {
            const previewUrl = URL.createObjectURL(uploadedFile);
            addImageBubble(previewUrl, 'OCR input image', 'bot');
        } catch (_) {}

        const base64 = await fileToBase64(uploadedFile);
        const form = new FormData();
        form.append('base64Image', base64);
        form.append('language', 'eng');
        form.append('isOverlayRequired', 'false');
        form.append('detectOrientation', 'true');
        form.append('scale', 'true');
        form.append('OCREngine', '2');
        form.append('apikey', OCR_SPACE_API_KEY);

        // Add a timeout to prevent indefinite loading
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 20000);
        const resp = await fetch(OCR_SPACE_URL, { method: 'POST', body: form, signal: controller.signal });
        clearTimeout(t);
        const data = await resp.json();
        removeTypingIndicator();

        const parsedText = (data && !data.IsErroredOnProcessing && data.ParsedResults && data.ParsedResults[0] && data.ParsedResults[0].ParsedText) || '';
        addMessage(parsedText.trim() || 'OCR failed. Please try again later.', 'bot');
    } catch (e) {
        console.error('OCR error:', e);
        removeTypingIndicator();
        const isAbort = (e && (e.name === 'AbortError' || String(e).includes('AbortError')));
        addMessage(isAbort ? 'OCR timed out. Please try again.' : 'Error during OCR. Please try again.', 'bot');
    }
}

// Describe the uploaded image using the existing Gemini endpoint
async function describeUploadedImage(promptText) {
    try {
        addTypingIndicator();
        const imageDataUrl = await fileToBase64(uploadedFile);
        const base64 = imageDataUrl.split(',')[1];
        const requestBody = {
            contents: [{
                parts: [
                    { text: promptText || 'Describe this image.' },
                    { inlineData: { mimeType: uploadedFile.type, data: base64 } }
                ]
            }],
            generationConfig: {
                maxOutputTokens: 1024,
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                stopSequences: []
            }
        };

        // Use same direct key pattern as sendMessage for consistency
        const DIRECT_API_KEY = 'AIzaSyCw9litrf3O8zjaG3sfm0oVqToUXV6rsKE';
        const resp = await fetch(`${API_URL}?key=${DIRECT_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        const data = await resp.json();
        removeTypingIndicator();

        const textOut = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
        if (textOut && textOut.trim()) {
            addMessage(textOut, 'bot');
        } else {
            addMessage('I could not describe this image. Please try again.', 'bot');
        }
    }catch (e) {
        console.error('Describe error:', e);
        removeTypingIndicator();
        addMessage('Error while describing the image. Please try again.', 'bot');
    }
}
