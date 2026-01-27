// Simple spaced-repetition using SM-2 algorithm

// ==================== AUTHENTICATION ====================

// Initialize Supabase and check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded - Starting app initialization');

    const authSection = document.getElementById('auth-section');
    const appContainer = document.getElementById('app-container');
    const loginFormContainer = document.getElementById('login-form-container');
    const registerFormContainer = document.getElementById('register-form-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const logoutBtn = document.getElementById('logout-btn');
    const userEmailSpan = document.getElementById('user-email');

    // Track whether Supabase was initialized successfully
    let supabaseInitialized = false;

    // Set up login/register toggle handlers FIRST so they always work
    // even if Supabase or authService fails to load
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginFormContainer.classList.add('hidden');
        registerFormContainer.classList.remove('hidden');
        document.getElementById('login-error').classList.add('hidden');
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerFormContainer.classList.add('hidden');
        loginFormContainer.classList.remove('hidden');
        document.getElementById('register-error').classList.add('hidden');
        document.getElementById('register-success').classList.add('hidden');
    });

    // Handle registration - register handler BEFORE any async work
    registerForm.addEventListener('submit', async (e) => {
        console.log('Register form submitted');
        e.preventDefault();

        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-password-confirm').value;
        const errorEl = document.getElementById('register-error');
        const successEl = document.getElementById('register-success');

        console.log('Registration attempt for email:', email);

        errorEl.classList.add('hidden');
        successEl.classList.add('hidden');

        if (password !== confirmPassword) {
            console.log('Password mismatch');
            errorEl.textContent = 'Passwords do not match';
            errorEl.classList.remove('hidden');
            return;
        }

        if (password.length < 6) {
            console.log('Password too short');
            errorEl.textContent = 'Password must be at least 6 characters';
            errorEl.classList.remove('hidden');
            return;
        }

        if (!supabaseInitialized) {
            console.error('Cannot register - Supabase not configured');
            errorEl.textContent = 'Error: Supabase is not configured. Please update config.js with your Supabase credentials.';
            errorEl.classList.remove('hidden');
            return;
        }

        const submitBtn = registerForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering...';

        try {
            console.log('Calling authService.register...');
            const result = await window.authService.register(email, password);
            console.log('Register result:', result);

            if (result.success) {
                registerForm.reset();

                // If Supabase returned a session, the user is already confirmed
                // (email confirmation is disabled) — log them in directly
                if (result.data && result.data.session) {
                    console.log('Session returned — email confirmation not required, logging in');
                    showApp(result.data.session.user);
                    return;
                }

                // Otherwise email confirmation is required
                successEl.textContent = 'Registration successful! Please check your email to verify your account, then login.';
                successEl.classList.remove('hidden');

                // Auto-switch to login after 3 seconds
                setTimeout(() => {
                    registerFormContainer.classList.add('hidden');
                    loginFormContainer.classList.remove('hidden');
                    successEl.classList.add('hidden');
                }, 3000);
            } else {
                errorEl.textContent = result.error || 'Registration failed. Please try again.';
                errorEl.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Registration error:', error);
            errorEl.textContent = 'An unexpected error occurred: ' + error.message;
            errorEl.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register';
        }
    });

    // Handle login - register handler BEFORE any async work
    loginForm.addEventListener('submit', async (e) => {
        console.log('Login form submitted');
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');

        console.log('Login attempt for email:', email);

        errorEl.classList.add('hidden');

        if (!supabaseInitialized) {
            console.error('Cannot login - Supabase not configured');
            errorEl.textContent = 'Error: Supabase is not configured. Please update config.js with your Supabase credentials.';
            errorEl.classList.remove('hidden');
            return;
        }

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';

        try {
            console.log('Calling authService.login...');
            const result = await window.authService.login(email, password);
            console.log('Login result:', result);

            if (result.success) {
                showApp(result.user);
            } else {
                errorEl.textContent = result.error || 'Login failed. Please try again.';
                errorEl.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Login error:', error);
            errorEl.textContent = 'An unexpected error occurred: ' + error.message;
            errorEl.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    });

    // Handle logout
    logoutBtn.addEventListener('click', async () => {
        const result = await window.authService.logout();
        if (result.success) {
            appContainer.classList.add('hidden');
            authSection.classList.remove('hidden');
            loginForm.reset();
            registerForm.reset();

            // Clear any local state
            cards = [];
            renderCardList();
            renderReviewList();
        }
    });

    // Show the main app after successful authentication
    async function showApp(user) {
        window.authService.currentUser = user;
        userEmailSpan.textContent = user.email;
        authSection.classList.add('hidden');
        appContainer.classList.remove('hidden');

        // Load user's cards from Supabase
        await initApp();
    }

    // Initialize app - load cards and render
    async function initApp() {
        cards = await window.authService.loadCards();
        normalizeOrders();

        renderCardList();
        renderReviewList();

        // Default landing view: Study section
        startStudy();
        reviewSection.classList.add("hidden");
        addSection.classList.add('hidden');
        studySection.classList.remove('hidden');
    }

    console.log('All event handlers registered.');

    // --- Now do async initialization (after all handlers are registered) ---

    // Check if required scripts are loaded
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase library not loaded');
        authSection.classList.remove('hidden');
        return;
    }

    if (typeof window.authService === 'undefined') {
        console.error('authService not found - auth.js may have failed to load');
        authSection.classList.remove('hidden');
        return;
    }

    if (typeof window.SUPABASE_CONFIG === 'undefined') {
        console.error('SUPABASE_CONFIG not found - config.js may have failed to load');
        authSection.classList.remove('hidden');
        return;
    }

    console.log('All required scripts loaded');

    // Initialize Supabase
    supabaseInitialized = window.authService.initSupabase();
    console.log('Supabase initialized:', supabaseInitialized);

    if (!supabaseInitialized) {
        console.error('Supabase initialization failed - config not set');
        authSection.classList.remove('hidden');
    } else {
        // Check if user is already logged in
        try {
            const user = await window.authService.getCurrentUser();
            console.log('Current user:', user ? user.email : 'none');
            if (user) {
                showApp(user);
            } else {
                authSection.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error checking current user:', error);
            authSection.classList.remove('hidden');
        }
    }

    console.log('App initialization complete.');
});

// --- Persistence (SUPABASE - replaced IndexedDB) -------------------------------------------------

// All card data is now stored in Supabase cloud database instead of IndexedDB.
// The loadCards() and saveCards() functions are now provided by auth.js

// Use auth service functions
const loadCards = () => window.authService.loadCards();
const saveCards = (cards) => window.authService.saveCards(cards);

function normalizeOrders() {
    const pinned = cards.filter(c => c.pinned).sort((a, b) => a.order - b.order);
    const unpinned = cards.filter(c => !c.pinned).sort((a, b) => a.order - b.order);
    cards = [...pinned, ...unpinned];
    cards.forEach((c, idx) => c.order = idx);
}

/**
 * @typedef Flashcard
 * @property {string} id - unique id
 * @property {string} question
 * @property {string} answer
 * @property {string|null} audioData - DataURL for audio or null
 * @property {number} interval - days between reviews
 * @property {number} repetitions - how many times reviewed successfully
 * @property {number} easeFactor - difficulty factor (EF)
 * @property {number} nextReview - timestamp (ms) when due
 * @property {boolean} pinned - whether the card is pinned to the top of lists
 * @property {number} order - manual sort order within pinned/unpinned groups
 */

// DOM references
const addSection = document.getElementById('add-section');
const studySection = document.getElementById('study-section');

const reviewSection = document.getElementById("review-section");
const navAdd = document.getElementById('nav-add');
const navStudy = document.getElementById('nav-study');
const navReview = document.getElementById("nav-review");
const navExport = document.getElementById('nav-export');
const navImport = document.getElementById('nav-import');
const importFileInput = document.getElementById('import-file');

const questionInput = document.getElementById('question');
const answerInput = document.getElementById('answer');
const audioInput = document.getElementById('audio'); // may be null if upload option removed
const generateAudioBtn = document.getElementById('generate-audio-btn');
const generateStatus = document.getElementById('generate-status');

// New elements for advanced AI flow
const promptInput = document.getElementById('prompt');
const genSentenceBtn = document.getElementById('generate-sentence-btn');
const genSentenceStatus = document.getElementById('gen-sentence-status');
const genVoiceBtn = document.getElementById('generate-voice-trans-btn');
const genVoiceStatus = document.getElementById('gen-voice-status');

// Button & status for paragraph voice generation
const genParagraphVoiceBtn = document.getElementById('generate-paragraph-voice-btn');
const genParagraphVoiceStatus = document.getElementById('gen-paragraph-voice-status');
// Button & status for paragraph translation
const genParagraphTranslationBtn = document.getElementById('generate-paragraph-translation-btn');
const genParagraphTranslationStatus = document.getElementById('gen-paragraph-translation-status');

let generatedAudioData = null; // dataURL produced by AI TTS if any

// Utility: fetch with a timeout to avoid indefinite waiting
async function fetchWithTimeout(url, options = {}, timeout = 20000) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeout);
    try {
        return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
        clearTimeout(id);
    }
}

// ---- AI Text-to-Speech generation ----
if (generateAudioBtn) {
    generateAudioBtn.addEventListener('click', async () => {
        const text = questionInput.value.trim();
        if (!text) {
            alert('Please type a question/sentence first.');
            return;
        }

        // Ask for API key (stored in Supabase user settings)
        let apiKey = await getApiKey();
        if (!apiKey) return;

        try {
            generateStatus.classList.remove('hidden');
            generateStatus.textContent = 'Generating…';
            generateAudioBtn.disabled = true;

            const dataUrl = await generateTTS(text, apiKey);
            generatedAudioData = dataUrl;

            // Clear any file selection to avoid confusion
            if (audioInput) audioInput.value = '';

            generateStatus.textContent = 'Voice ready! (will be attached)';
        } catch (err) {
            console.error(err);
            alert('Failed to generate audio.');
            generateStatus.textContent = 'Error';
        } finally {
            generateAudioBtn.disabled = false;
            setTimeout(() => generateStatus.classList.add('hidden'), 4000);
        }
    });
}

// ---- Generate paragraph voice (Australian female, slow) ----
if (genParagraphVoiceBtn) {
    genParagraphVoiceBtn.addEventListener('click', async () => {
        const paragraph = questionInput.value.trim();
        if (!paragraph) {
            alert('Please type an English paragraph first.');
            return;
        }

        let apiKey = await getApiKey();
        if (!apiKey) return;

        try {
            genParagraphVoiceStatus.classList.remove('hidden');
            genParagraphVoiceStatus.textContent = 'Generating voice…';
            genParagraphVoiceBtn.disabled = true;

            const dataUrl = await generateTTS(paragraph, apiKey);
            generatedAudioData = dataUrl;
            if (audioInput) audioInput.value = '';
            genParagraphVoiceStatus.textContent = 'Voice ready! (will be attached)';
        } catch (err) {
            console.error(err);
            alert('Failed to generate voice. Please check your API key/quota.');
            genParagraphVoiceStatus.textContent = 'Error';
        } finally {
            genParagraphVoiceBtn.disabled = false;
            setTimeout(() => genParagraphVoiceStatus.classList.add('hidden'), 4000);
        }
    });
}

// ---- Generate paragraph translation (Traditional Chinese) ----
if (genParagraphTranslationBtn) {
    genParagraphTranslationBtn.addEventListener('click', async () => {
        const paragraph = questionInput.value.trim();
        if (!paragraph) {
            alert('Please type an English paragraph first.');
            return;
        }

        let apiKey = await getApiKey();
        if (!apiKey) return;

        try {
            genParagraphTranslationStatus.classList.remove('hidden');
            genParagraphTranslationStatus.textContent = 'Generating translation…';
            genParagraphTranslationBtn.disabled = true;

            const chinese = await translateToTraditionalChinese(paragraph, apiKey);
            answerInput.value = chinese;

            genParagraphTranslationStatus.textContent = 'Translation ready!';
        } catch (err) {
            console.error(err);
            alert('Failed to generate translation.');
            genParagraphTranslationStatus.textContent = 'Error';
        } finally {
            genParagraphTranslationBtn.disabled = false;
            setTimeout(() => genParagraphTranslationStatus.classList.add('hidden'), 4000);
        }
    });
}

// ---- Generate English sentence from prompt ----
if (genSentenceBtn) {
    genSentenceBtn.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        if (!prompt) {
            alert('Please type a prompt/topic first.');
            return;
        }

        let apiKey = await getApiKey();
        if (!apiKey) return;

        try {
            genSentenceStatus.classList.remove('hidden');
            genSentenceStatus.textContent = 'Generating…';
            genSentenceBtn.disabled = true;

            const sentence = await generateSentence(prompt, apiKey);
            questionInput.value = sentence;

            // First, get the Chinese translation
            const chinese = await translateToTraditionalChinese(sentence, apiKey);
            answerInput.value = chinese;

            // Next, attempt to produce TTS voice (non-critical)
            let audioUrl = null;
            try {
                audioUrl = await generateTTS(sentence, apiKey);
                generatedAudioData = audioUrl;
            } catch (ttsErr) {
                console.warn('TTS generation failed', ttsErr);
            }

            genSentenceStatus.textContent = audioUrl ? 'Sentence & audio ready. Click Save.' : 'Sentence ready. Click Save.';
        } catch (err) {
            console.error(err);
            genSentenceStatus.textContent = 'Error generating. Check API key / quota.';
        } finally {
            genSentenceBtn.disabled = false;
            setTimeout(() => genSentenceStatus.classList.add('hidden'), 4000);
        }
    });
}

// ---- Generate voice + Chinese translation ----
if (genVoiceBtn) {
    genVoiceBtn.addEventListener('click', async () => {
        const sentence = questionInput.value.trim();
        if (!sentence) {
            alert('Please ensure the English sentence is filled.');
            return;
        }

        let apiKey = await getApiKey();
        if (!apiKey) return;

        try {
            genVoiceStatus.classList.remove('hidden');
            genVoiceStatus.textContent = 'Generating…';
            genVoiceBtn.disabled = true;

            // Parallel generation
            const [audioUrl, chinese] = await Promise.all([
                generateTTS(sentence, apiKey),
                translateToTraditionalChinese(sentence, apiKey)
            ]);

            generatedAudioData = audioUrl;
            if (audioInput) audioInput.value = '';
            answerInput.value = chinese;

            genVoiceStatus.textContent = 'Voice & translation ready!';
        } catch (err) {
            console.error(err);
            alert('Failed to generate voice/translation.');
            genVoiceStatus.textContent = 'Error';
        } finally {
            genVoiceBtn.disabled = false;
            setTimeout(() => genVoiceStatus.classList.add('hidden'), 4000);
        }
    });
}

async function getApiKey() {
    // Try to get from Supabase user settings
    let key = await window.authService.getUserAPIKey();
    if (!key) {
        key = prompt('Enter your OpenAI API key (it will be stored securely in the cloud):');
        if (key) {
            await window.authService.saveUserAPIKey(key);
        }
    }
    return key;
}

async function generateSentence(prompt, apiKey) {
    const payload = {
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: 'You are an assistant who creates longer English paragraphs (6-10 sentences) suitable for ESL learners.' },
            { role: 'user', content: `Create one longer English paragraph (6-10 sentences) based on: "${prompt}". Do NOT include translations. Do NOT wrap in quotes.` }
        ],
        max_tokens: 300,
        temperature: 0.7
    };

    const resp = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error('OpenAI completion failed: ' + errText);
    }

    const data = await resp.json();
    const sentence = data.choices[0].message.content.trim();
    return sentence;
}

async function translateToTraditionalChinese(text, apiKey) {
    // Break very long input into approximate 3500-char chunks so each request
    // comfortably fits within token limits and avoids truncation. The
    // resulting Chinese segments are then re-joined with blank lines,
    // preserving paragraph structure.

    const CHUNK_SIZE = 3500;
    const chunks = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
        chunks.push(text.slice(i, i + CHUNK_SIZE));
    }

    const translations = [];
    for (const chunk of chunks) {
        translations.push(await translateChunk(chunk, apiKey));
    }

    return translations.join('\n\n');
}

async function translateChunk(englishText, apiKey) {
    // Provide a generous max_tokens based on input length (chars * 1.5 ≈ tokens).
    const maxTokens = Math.min(4096, Math.ceil(englishText.length * 1.5));

    const payload = {
        model: 'gpt-3.5-turbo-16k',
        messages: [
            { role: 'system', content: 'You are a strict translator. Return ONLY the full Traditional Chinese translation of the user provided text. Preserve paragraph breaks. Do NOT omit or summarise.' },
            { role: 'user', content: `請完整翻譯下列內容為繁體中文（僅中文、請保留段落換行）：\n\n${englishText}` }
        ],
        temperature: 0.2,
        max_tokens: maxTokens
    };

    const resp = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    }, 60000);

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error('OpenAI completion failed: ' + errText);
    }

    const data = await resp.json();
    return data.choices[0].message.content.trim();
}

async function generateTTS(text, apiKey) {
    const payload = {
        // Higher-fidelity model
        model: 'tts-1-hd',
        input: text,
        // Upbeat female voice
        voice: 'shimmer',
        // Slightly higher pitch for extra brightness
        voice_preset: {
            pitch: 4  // +4 semitones for a younger, lighter tone
        },
        format: 'mp3'
    };

    const resp = await fetchWithTimeout('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error('OpenAI TTS failed: ' + errText);
    }

    const arrayBuffer = await resp.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    return `data:audio/mp3;base64,${base64}`;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

const form = document.getElementById('card-form');

const dueCountEl = document.getElementById('due-count');
const skipDayBtn = document.getElementById('skip-day-btn');
const cardBox = document.getElementById('card-box');
const cardQuestionEl = document.getElementById('card-question');
const cardAnswerEl = document.getElementById('card-answer');
const revealArea = document.getElementById('reveal-area');
const cardAudio = document.getElementById('card-audio');
const audioToggleBtn = document.getElementById('audio-toggle-btn');
const rewindBtn = document.getElementById('rewind-5-btn');
const restartBtn = document.getElementById('restart-btn');
const speedToggleBtn = document.getElementById('speed-toggle-btn');
const showAnswerBtn = document.getElementById('show-answer');
const cardList = document.getElementById('card-list');
const saveCardBtn = document.getElementById('save-card-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const noDueEl = document.getElementById('no-due');
const reviewList = document.getElementById("review-list");
const reviewCardBox = document.getElementById("review-card-box");
const reviewCardQuestionEl = document.getElementById("review-card-question");
const reviewCardAnswerEl = document.getElementById("review-card-answer");
const reviewRevealArea = document.getElementById("review-reveal-area");
const reviewAudio = document.getElementById("review-card-audio");
const reviewAudioToggleBtn = document.getElementById("review-audio-toggle-btn");
const reviewRewindBtn = document.getElementById("review-rewind-5-btn");
const reviewRestartBtn = document.getElementById("review-restart-btn");
const reviewSpeedToggleBtn = document.getElementById("review-speed-toggle-btn");
const reviewShowAnswerBtn = document.getElementById("review-show-answer");
const saveStatusEl = document.getElementById('save-status');

async function autoSaveCard(question, answer, audioData) {
    if (editingCardId) {
        await updateExistingCard(editingCardId, question, answer, audioData);
    } else {
        await createCard(question, answer, audioData);
    }
    showSavedStatus('Card saved!');
}

// utility to stop any ongoing audio and looping timer
function stopAudio() {
    clearTimeout(audioLoopTimeout);
    audioLoopTimeout = null;
    if (cardAudio) {
        cardAudio.pause();
        cardAudio.onended = null;
        cardAudio.currentTime = 0;
    }
    if (audioToggleBtn) {
        audioToggleBtn.textContent = '▶️';
    }
}

function stopReviewAudio() {
    clearTimeout(reviewAudioAdvanceTimeout);
    reviewAudioAdvanceTimeout = null;
    if (reviewAudio) {
        reviewAudio.pause();
        reviewAudio.onended = null;
        reviewAudio.currentTime = 0;
    }
    if (reviewAudioToggleBtn) {
        reviewAudioToggleBtn.textContent = "▶️";
    }
}

function setupReviewAutoAdvance() {
    if (!reviewAudio) return;
    reviewAudio.onended = () => {
        clearTimeout(reviewAudioAdvanceTimeout);
        reviewAudioAdvanceTimeout = setTimeout(() => {
            advanceToNextReviewCard();
        }, 500);
    };
}

function advanceToNextReviewCard() {
    const orderedIds = getCardsInReviewOrder().map(card => card.id);
    reviewPlaybackOrder = orderedIds;
    if (reviewPlaybackOrder.length === 0) return;

    if (currentReviewCard) {
        const currentIndex = reviewPlaybackOrder.indexOf(currentReviewCard.id);
        if (currentIndex !== -1) {
            reviewPlaybackIndex = currentIndex;
        }
    }

    reviewPlaybackIndex = (reviewPlaybackIndex + 1 + reviewPlaybackOrder.length) % reviewPlaybackOrder.length;
    const nextId = reviewPlaybackOrder[reviewPlaybackIndex];
    const nextCard = cards.find(c => c.id === nextId);
    if (nextCard) {
        openReviewCard(nextCard.id);
    }
}
function setupAudioLooping() {
    if (!cardAudio) return;
    cardAudio.onended = () => {
        audioLoopTimeout = setTimeout(() => {
            cardAudio.currentTime = 0;
            cardAudio.play().catch(() => {/* autoplay may be blocked */});
        }, 5000); // 5 second pause before replay
    };
}

const ratingButtons = document.querySelectorAll('.rating-buttons button');

let audioLoopTimeout = null;
let reviewAudioAdvanceTimeout = null;
let fastPlayback = false; // global playback speed state (true = 1.2x)

let reviewPlaybackOrder = [];
let reviewPlaybackIndex = -1;

let editingCardId = null; // if not null, we're editing existing card

function showSavedStatus(msg) {
    if (!saveStatusEl) return;
    saveStatusEl.textContent = msg;
    saveStatusEl.classList.remove('hidden');
    clearTimeout(showSavedStatus._timer);
    showSavedStatus._timer = setTimeout(() => saveStatusEl.classList.add('hidden'), 3000);
}

// ---- Card list rendering and CRUD ----
function renderCardList() {
    if (!cardList) return;
    cardList.innerHTML = '';
    if (cards.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No cards yet.';
        cardList.appendChild(li);
        return;
    }

    // sort cards by days until next review (ascending)
    const sortedCards = [...cards].sort((a, b) => a.nextReview - b.nextReview);

    sortedCards.forEach((card) => {
        const li = document.createElement('li');

        const textSpan = document.createElement('span');
        textSpan.textContent = card.question.length > 60 ? card.question.slice(0, 60) + '…' : card.question;
        li.appendChild(textSpan);

        const btnContainer = document.createElement('span');

        // days until due
        const millisInDay = 24 * 60 * 60 * 1000;
        const daysLeft = Math.max(0, Math.ceil((card.nextReview - Date.now()) / millisInDay));
        const daysEl = document.createElement('span');
        daysEl.textContent = `${daysLeft}d`;
        daysEl.classList.add('days-left');
        btnContainer.appendChild(daysEl);

        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.classList.add('edit-btn');
        editBtn.addEventListener('click', () => beginEdit(card.id));
        // play audio button
        if (card.audioData) {
            const playBtn = document.createElement('button');
            playBtn.textContent = 'Play';
            playBtn.classList.add('play-btn');
            playBtn.addEventListener('click', () => {
                const audio = new Audio(card.audioData);
                audio.play();
            });
            btnContainer.appendChild(playBtn);
        }


        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete';
        delBtn.classList.add('delete-btn');
        delBtn.addEventListener('click', async () => await deleteCard(card.id));

        btnContainer.appendChild(editBtn);
        btnContainer.appendChild(delBtn);
        li.appendChild(btnContainer);

        cardList.appendChild(li);
    });
}
function getCardsInReviewOrder() {
    return [...cards].sort((a, b) => a.order - b.order);
}

function renderReviewList() {
    if (!reviewList) return;
    reviewList.innerHTML = "";
    if (cards.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No cards yet.";
        reviewList.appendChild(li);
        reviewPlaybackOrder = [];
        reviewPlaybackIndex = -1;
        return;
    }
    const sorted = getCardsInReviewOrder();
    sorted.forEach(card => {
        const li = document.createElement("li");
        const textSpan = document.createElement("span");
        textSpan.textContent = card.question.length > 60 ? card.question.slice(0,60) + "…" : card.question;
        li.appendChild(textSpan);
        li.addEventListener("click", () => openReviewCard(card.id));

        li.draggable = true;
        li.dataset.id = card.id;
        li.addEventListener('dragstart', () => {
            dragSrcId = card.id;
            li.classList.add('dragging');
        });
        li.addEventListener('dragend', () => {
            dragSrcId = null;
            li.classList.remove('dragging');
        });

        const pinBtn = document.createElement("button");
        pinBtn.className = "pin-btn" + (card.pinned ? " pinned" : "");
        pinBtn.textContent = card.pinned ? "📌" : "📍";
        pinBtn.title = card.pinned ? "Unpin" : "Pin";
        pinBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            card.pinned = !card.pinned;
            if (card.pinned) {
                const minPinned = Math.min(...cards.filter(c => c.pinned && c.id !== card.id).map(c => c.order), Infinity);
                card.order = isFinite(minPinned) ? minPinned - 1 : 0;
            } else {
                const maxOrder = Math.max(...cards.map(c => c.order));
                card.order = maxOrder + 1;
            }
            normalizeOrders();
            await saveCards(cards);
            renderReviewList();
        });
        li.appendChild(pinBtn);

        reviewList.appendChild(li);
    });

    if (!reviewList._dragBound) {
        reviewList.addEventListener('dragover', (e) => e.preventDefault());
        reviewList.addEventListener('drop', handleReviewDrop);
        reviewList._dragBound = true;
    }

    reviewPlaybackOrder = sorted.map(card => card.id);
    if (currentReviewCard) {
        reviewPlaybackIndex = reviewPlaybackOrder.indexOf(currentReviewCard.id);
    }
}

async function handleReviewDrop(e) {
    e.preventDefault();
    if (!dragSrcId) return;
    const targetLi = e.target.closest('li');
    const dragged = cards.find(c => c.id === dragSrcId);
    if (!dragged) return;

    const pinned = cards.filter(c => c.pinned).sort((a, b) => a.order - b.order);
    const unpinned = cards.filter(c => !c.pinned).sort((a, b) => a.order - b.order);

    if (targetLi) {
        const targetId = targetLi.dataset.id;
        const target = cards.find(c => c.id === targetId);
        if (target) {
            if (dragged.pinned !== target.pinned) {
                if (dragged.pinned) {
                    const fromIndex = pinned.findIndex(c => c.id === dragSrcId);
                    pinned.splice(fromIndex, 1);
                    pinned.push(dragged);
                } else {
                    const fromIndex = unpinned.findIndex(c => c.id === dragSrcId);
                    unpinned.splice(fromIndex, 1);
                    unpinned.unshift(dragged);
                }
            } else {
                const group = dragged.pinned ? pinned : unpinned;
                const fromIndex = group.findIndex(c => c.id === dragSrcId);
                const toIndex = group.findIndex(c => c.id === targetId);
                group.splice(fromIndex, 1);
                group.splice(toIndex, 0, dragged);
            }
        }
    } else {
        if (dragged.pinned) {
            const fromIndex = pinned.findIndex(c => c.id === dragSrcId);
            pinned.splice(fromIndex, 1);
            pinned.push(dragged);
        } else {
            const fromIndex = unpinned.findIndex(c => c.id === dragSrcId);
            unpinned.splice(fromIndex, 1);
            unpinned.push(dragged);
        }
    }

    cards = [...pinned, ...unpinned];
    normalizeOrders();
    await saveCards(cards);
    renderReviewList();
}


function beginEdit(id) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    editingCardId = id;
    questionInput.value = card.question;
    answerInput.value = card.answer;
    if (audioInput) audioInput.value = '';

    saveCardBtn.textContent = 'Update Card';
    cancelEditBtn.classList.remove('hidden');

    // Switch to Add section
    addSection.classList.remove('hidden');
    studySection.classList.add('hidden');
}

async function deleteCard(id) {
    // Straight-forward deletion without confirmation dialog
    const card = cards.find(c => c.id === id);

    // Delete audio from storage if it exists
    if (card && card.audioData) {
        await window.authService.deleteAudio(card.audioData);
    }

    cards = cards.filter((c) => c.id !== id);
    await saveCards(cards);
    renderCardList();
    renderReviewList();
    updateDueCount();
}

if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
        editingCardId = null;
        questionInput.value = '';
        answerInput.value = '';
        if (audioInput) audioInput.value = '';
        saveCardBtn.textContent = 'Save Card';
        cancelEditBtn.classList.add('hidden');
    });
}

// All card data will reside here after asynchronous initialisation.
let cards = [];

// Card currently displayed during study mode
let currentCard = null;
let currentReviewCard = null;
let dragSrcId = null;

// Kick-off once everything is parsed. By placing this at the end of the file
// we make sure all functions & event-listeners are already defined.
// NOTE: This is now called from the DOMContentLoaded event after authentication
// (async function init() {
//     cards = await loadCards();
//     normalizeOrders();
//     saveCards(cards);

//     renderCardList();
//     renderReviewList();

//     renderReviewList();
//     // Default landing view: Study section
//     startStudy();
//     reviewSection.classList.add("hidden");
//     addSection.classList.add('hidden');
//     studySection.classList.remove('hidden');
// })();

// ---- Navigation ----
navAdd.addEventListener('click', () => {
    reviewSection.classList.add("hidden");
    stopAudio();
    addSection.classList.remove('hidden');
    studySection.classList.add('hidden');
});

navStudy.addEventListener('click', () => {
    startStudy();
    reviewSection.classList.add("hidden");
    addSection.classList.add('hidden');
    studySection.classList.remove('hidden');
});

navReview.addEventListener("click", () => {
    stopAudio();
    stopReviewAudio();
    addSection.classList.add("hidden");
    studySection.classList.add("hidden");
    reviewSection.classList.remove("hidden");
    renderReviewList();
});
navExport.addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' +
        encodeURIComponent(JSON.stringify(cards, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', 'flashcards.json');
    dl.click();
});

navImport.addEventListener('click', () => importFileInput.click());

// ---- Skip Day ----
if (skipDayBtn) {
    skipDayBtn.addEventListener('click', async () => {
        await skipOneDay();
    });
}

async function skipOneDay() {
    const millisInDay = 24 * 60 * 60 * 1000;
    cards.forEach((card) => {
        card.nextReview -= millisInDay;
    });
    await saveCards(cards);
    updateDueCount();
    showNextCard();
}

importFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const imported = JSON.parse(ev.target.result);
            if (Array.isArray(imported)) {
                // Show progress message
                alert('Importing cards... This may take a moment if there are audio files to upload.');

                // Process cards and upload audio if needed
                const processedCards = [];
                for (let i = 0; i < imported.length; i++) {
                    const c = imported[i];
                    let audioUrl = c.audioData;

                    // If audio is a base64 data URL, upload to Supabase Storage
                    if (audioUrl && audioUrl.startsWith('data:')) {
                        try {
                            const audioBlob = window.authService.dataURLtoBlob(audioUrl);
                            const cardId = c.id || crypto.randomUUID();
                            audioUrl = await window.authService.uploadAudio(audioBlob, cardId);
                            console.log(`Uploaded audio for card ${i + 1}/${imported.length}`);
                        } catch (error) {
                            console.error('Error uploading audio for card:', c.id, error);
                            // Keep the data URL if upload fails
                        }
                    }

                    processedCards.push({
                        ...c,
                        audioData: audioUrl,
                        pinned: !!c.pinned,
                        order: typeof c.order === 'number' ? c.order : i
                    });
                }

                cards = processedCards;
                normalizeOrders();
                await saveCards(cards);
                renderCardList();
                renderReviewList();
                alert('Import successful! All cards have been uploaded to the cloud.');
            } else {
                alert('Invalid file');
            }
        } catch (err) {
            console.error('Import error:', err);
            alert('Error importing file: ' + err.message);
        }
    };
    reader.readAsText(file);
    // reset
    importFileInput.value = '';
});

// ---- Add card ----

if (saveCardBtn) {
    saveCardBtn.addEventListener('click', async () => {
    const question = questionInput.value.trim();
    const answer = answerInput.value.trim();
    if (!question || !answer) return;

    const handleData = async (audioData) => {
        if (editingCardId) {
            await updateExistingCard(editingCardId, question, answer, audioData);
        } else {
            await createCard(question, answer, audioData);
        }
    };

    const file = audioInput ? audioInput.files[0] : null;
    let audioData = null;

    if (file) {
        try {
            audioData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target.result);
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(file);
            });
        } catch (err) {
            console.error('Error reading attached audio file', err);
            alert('Failed to read attached audio file.');
            return;
        }
    } else if (generatedAudioData) {
        audioData = generatedAudioData;
        generatedAudioData = null;
    } else if (editingCardId) {
        const existing = cards.find(c => c.id === editingCardId);
        audioData = existing ? existing.audioData : null;
    }

    await handleData(audioData);
});
}

async function createCard(question, answer, audioData) {
    const maxOrder = cards.reduce((m, c) => Math.max(m, typeof c.order === 'number' ? c.order : -1), -1);
    const cardId = crypto.randomUUID();

    // Upload audio to Supabase Storage if it's a data URL
    let audioUrl = null;
    if (audioData && audioData.startsWith('data:')) {
        try {
            const audioBlob = window.authService.dataURLtoBlob(audioData);
            audioUrl = await window.authService.uploadAudio(audioBlob, cardId);
        } catch (error) {
            console.error('Error uploading audio:', error);
            alert('Failed to upload audio. The card will be saved without audio.');
        }
    } else if (audioData) {
        // Already a URL (from cloud storage)
        audioUrl = audioData;
    }

    const card = {
        id: cardId,
        question,
        answer,
        audioData: audioUrl, // Cloud storage URL or null
        interval: 0,
        repetitions: 0,
        easeFactor: 2.5,
        nextReview: Date.now(),
        pinned: false,
        order: maxOrder + 1
    };
    cards.push(card);
    normalizeOrders();
    await saveCards(cards);

    // reset form
    if (promptInput) promptInput.value = '';
    questionInput.value = '';
    answerInput.value = '';
    if (audioInput) audioInput.value = '';

    showSavedStatus('Card saved!');

    renderCardList();
    renderReviewList();
    renderReviewList();
}

async function updateExistingCard(id, question, answer, audioData) {
    const card = cards.find(c => c.id === id);
    if (!card) return;

    card.question = question;
    card.answer = answer;

    // Handle audio update
    if (audioData !== undefined) {
        // If new audio is a data URL, upload to Supabase Storage
        if (audioData && audioData.startsWith('data:')) {
            try {
                // Delete old audio if it exists
                if (card.audioData) {
                    await window.authService.deleteAudio(card.audioData);
                }
                // Upload new audio
                const audioBlob = window.authService.dataURLtoBlob(audioData);
                card.audioData = await window.authService.uploadAudio(audioBlob, id);
            } catch (error) {
                console.error('Error uploading audio:', error);
                alert('Failed to upload audio. The card will be saved with previous audio.');
            }
        } else {
            // Either null (remove audio) or already a URL
            if (audioData === null && card.audioData) {
                // Delete audio from storage
                await window.authService.deleteAudio(card.audioData);
            }
            card.audioData = audioData;
        }
    }

    await saveCards(cards);

    editingCardId = null;
    saveCardBtn.textContent = 'Save Card';
    cancelEditBtn.classList.add('hidden');

    // reset form inputs
    questionInput.value = '';
    answerInput.value = '';
    if (audioInput) audioInput.value = '';

    showSavedStatus('Card updated!');

    renderCardList();
    renderReviewList();
}

// ---- Study flow ----

function startStudy() {
    reviewSection.classList.add("hidden");
    updateDueCount();
    showNextCard();
}

function updateDueCount() {
    const dueCards = cards.filter((c) => c.nextReview <= Date.now());
    dueCountEl.textContent = `Cards due: ${dueCards.length}`;
}

function showNextCard() {
    revealArea.classList.add('hidden');
    noDueEl.classList.add('hidden');
    cardBox.classList.add('hidden');
    showAnswerBtn.classList.remove('hidden');

    // stop any previous looping audio
    stopAudio();

    const dueCards = cards.filter((c) => c.nextReview <= Date.now());
    if (dueCards.length === 0) {
        noDueEl.classList.remove('hidden');
        return;
    }

    currentCard = dueCards.sort((a, b) => a.nextReview - b.nextReview)[0];
    cardQuestionEl.textContent = currentCard.question;
    cardAnswerEl.textContent = currentCard.answer;

    if (currentCard.audioData) {
        cardAudio.src = currentCard.audioData;
        cardAudio.load();

        cardAudio.playbackRate = fastPlayback ? 1.2 : 1;

        setupAudioLooping();
        cardAudio.play().catch(() => {/* autoplay might be blocked */});
        if (audioToggleBtn) {
            audioToggleBtn.classList.remove('hidden');
            audioToggleBtn.textContent = '▶️';
        }
        if (rewindBtn) {
            rewindBtn.classList.remove('hidden');
        }
        if (restartBtn) {
            restartBtn.classList.remove('hidden');
        }
        if (speedToggleBtn) {
            speedToggleBtn.classList.remove('hidden');
            speedToggleBtn.textContent = fastPlayback ? '1.2x' : '1x';
        }
    } else {
        cardAudio.removeAttribute('src');
        cardAudio.load();
        if (audioToggleBtn) {
            audioToggleBtn.classList.add('hidden');
        }
        if (rewindBtn) {
            rewindBtn.classList.add('hidden');
        }
        if (restartBtn) {
            restartBtn.classList.add('hidden');
        }
        if (speedToggleBtn) {
            speedToggleBtn.classList.add('hidden');
        }
    }

    cardBox.classList.remove('hidden');
}

function revealAnswer() {
    revealArea.classList.remove('hidden');
    showAnswerBtn.classList.add('hidden');
}
function openReviewCard(id) {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    reviewPlaybackOrder = getCardsInReviewOrder().map(c => c.id);
    reviewPlaybackIndex = reviewPlaybackOrder.indexOf(card.id);
    if (reviewPlaybackIndex === -1 && reviewPlaybackOrder.length > 0) {
        reviewPlaybackIndex = 0;
    }
    currentReviewCard = card;
    reviewRevealArea.classList.add("hidden");
    reviewShowAnswerBtn.classList.remove("hidden");
    stopReviewAudio();
    reviewCardQuestionEl.textContent = card.question;
    reviewCardAnswerEl.textContent = card.answer;
    if (card.audioData) {
        reviewAudio.src = card.audioData;
        reviewAudio.load();
        reviewAudio.playbackRate = fastPlayback ? 1.2 : 1;
        setupReviewAutoAdvance();
        reviewAudio.play().catch(() => {});
        reviewAudioToggleBtn.classList.remove("hidden");
        reviewRewindBtn.classList.remove("hidden");
        reviewRestartBtn.classList.remove("hidden");
        reviewSpeedToggleBtn.classList.remove("hidden");
        reviewSpeedToggleBtn.textContent = fastPlayback ? "1.2x" : "1x";
    } else {
        reviewAudio.removeAttribute("src");
        reviewAudio.load();
        reviewAudioToggleBtn.classList.add("hidden");
        reviewRewindBtn.classList.add("hidden");
        reviewRestartBtn.classList.add("hidden");
        reviewSpeedToggleBtn.classList.add("hidden");
    }
    reviewCardBox.classList.remove("hidden");
}

function revealReviewAnswer() {
    reviewRevealArea.classList.remove("hidden");
    reviewShowAnswerBtn.classList.add("hidden");
}


// Reveal answer via question click or explicit button
cardQuestionEl.addEventListener('click', revealAnswer);
showAnswerBtn.addEventListener('click', revealAnswer);
// Toggle play/stop for audio
if (audioToggleBtn) {
    audioToggleBtn.addEventListener('click', () => {
        if (cardAudio.paused) {
            // Resume playback from current position
            setupAudioLooping();
            cardAudio.play().catch(() => {});
        } else {
            // Just pause – don't reset to the beginning
            clearTimeout(audioLoopTimeout);
            audioLoopTimeout = null;
            cardAudio.pause();
        }
    });
    cardAudio.addEventListener('play', () => {
        audioToggleBtn.textContent = '⏸️';
    });
    cardAudio.addEventListener('pause', () => {
        audioToggleBtn.textContent = '▶️';
    });
}

// Rewind 5 seconds button
if (rewindBtn) {
    rewindBtn.addEventListener('click', () => {
        if (!cardAudio.duration) return;
        cardAudio.currentTime = Math.max(0, cardAudio.currentTime - 5);
    });
}

// Restart button (jump to beginning)
if (restartBtn) {
    restartBtn.addEventListener('click', () => {
        if (!cardAudio.duration) return;
        cardAudio.currentTime = 0;
        if (!cardAudio.paused) {
            cardAudio.play().catch(() => {});
        }
    });
}

// Playback speed toggle (1x / 1.2x)
if (speedToggleBtn) {
    speedToggleBtn.addEventListener('click', () => {
        fastPlayback = !fastPlayback;
        cardAudio.playbackRate = fastPlayback ? 1.2 : 1;
        speedToggleBtn.textContent = fastPlayback ? '1.2x' : '1x';
    });
}

// rating buttons
ratingButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
        const value = btn.dataset.rating;
        if (!currentCard) return;
        const isEasy = value === 'easy';
        processRatingBinary(currentCard, isEasy);
        await saveCards(cards);
        updateDueCount();
        showNextCard();
    });
});

reviewCardQuestionEl.addEventListener("click", revealReviewAnswer);
reviewShowAnswerBtn.addEventListener("click", revealReviewAnswer);
if (reviewAudioToggleBtn) {
    reviewAudioToggleBtn.addEventListener("click", () => {
        if (reviewAudio.paused) {
            clearTimeout(reviewAudioAdvanceTimeout);
            reviewAudioAdvanceTimeout = null;
            setupReviewAutoAdvance();
            reviewAudio.play().catch(() => {});
        } else {
            clearTimeout(reviewAudioAdvanceTimeout);
            reviewAudioAdvanceTimeout = null;
            reviewAudio.pause();
        }
    });
    reviewAudio.addEventListener("play", () => {
        clearTimeout(reviewAudioAdvanceTimeout);
        reviewAudioAdvanceTimeout = null;
        reviewAudioToggleBtn.textContent = "⏸️";
    });
    reviewAudio.addEventListener("pause", () => {
        reviewAudioToggleBtn.textContent = "▶️";
    });
}
if (reviewRewindBtn) {
    reviewRewindBtn.addEventListener("click", () => {
        if (!reviewAudio.duration) return;
        clearTimeout(reviewAudioAdvanceTimeout);
        reviewAudioAdvanceTimeout = null;
        reviewAudio.currentTime = Math.max(0, reviewAudio.currentTime - 5);
    });
}
if (reviewRestartBtn) {
    reviewRestartBtn.addEventListener("click", () => {
        if (!reviewAudio.duration) return;
        clearTimeout(reviewAudioAdvanceTimeout);
        reviewAudioAdvanceTimeout = null;
        reviewAudio.currentTime = 0;
        if (!reviewAudio.paused) {
            reviewAudio.play().catch(() => {});
        }
    });
}
if (reviewSpeedToggleBtn) {
    reviewSpeedToggleBtn.addEventListener("click", () => {
        fastPlayback = !fastPlayback;
        reviewAudio.playbackRate = fastPlayback ? 1.2 : 1;
        reviewSpeedToggleBtn.textContent = fastPlayback ? "1.2x" : "1x";
    });
}
// SM-2 algorithm implementation
function processRating(card, quality) {
    // Quality 0-5
    if (quality < 3) {
        card.repetitions = 0;
        card.interval = 1;
    } else {
        if (card.repetitions === 0) {
            card.interval = 1;
        } else if (card.repetitions === 1) {
            card.interval = 6;
        } else {
            card.interval = Math.round(card.interval * card.easeFactor);
        }
        card.repetitions += 1;

        // Update Ease Factor
        card.easeFactor = Math.max(1.3, card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    }
    // set next review date
    const millisInDay = 24 * 60 * 60 * 1000;
    card.nextReview = Date.now() + card.interval * millisInDay;
}

// Simplified 2-option algorithm (easy / hard)
function processRatingBinary(card, isEasy) {
    const millisInDay = 24 * 60 * 60 * 1000;

    if (!isEasy) {
        // Hard: reset learning cycle.
        card.repetitions = 0;
        card.interval = 1;
        card.easeFactor = Math.max(1.3, card.easeFactor - 0.15);
    } else {
        // Easy: grow interval.
        if (card.repetitions === 0) {
            card.interval = 1;
        } else if (card.repetitions === 1) {
            card.interval = 3;
        } else {
            card.interval = Math.round(card.interval * card.easeFactor);
        }
        card.repetitions += 1;
        card.easeFactor = Math.min(card.easeFactor + 0.05, 2.5);
    }

    card.nextReview = Date.now() + card.interval * millisInDay;
}

// Initialize default view
// NOTE: Study mode begins when the user clicks the “Study” nav button.
