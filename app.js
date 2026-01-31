// Simple spaced-repetition using SM-2 algorithm
// Cards are loaded from GitHub, progress is stored in Supabase

// ==================== AUTHENTICATION ====================

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

    let supabaseInitialized = false;

    // Set up login/register toggle handlers
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

    // Handle registration
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-password-confirm').value;
        const errorEl = document.getElementById('register-error');
        const successEl = document.getElementById('register-success');

        errorEl.classList.add('hidden');
        successEl.classList.add('hidden');

        if (password !== confirmPassword) {
            errorEl.textContent = 'Passwords do not match';
            errorEl.classList.remove('hidden');
            return;
        }

        if (password.length < 6) {
            errorEl.textContent = 'Password must be at least 6 characters';
            errorEl.classList.remove('hidden');
            return;
        }

        if (!supabaseInitialized) {
            errorEl.textContent = 'Error: Supabase is not configured. Please update config.js with your Supabase credentials.';
            errorEl.classList.remove('hidden');
            return;
        }

        const submitBtn = registerForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering...';

        try {
            const result = await window.authService.register(email, password);

            if (result.success) {
                registerForm.reset();

                if (result.data && result.data.session) {
                    showApp(result.data.session.user);
                    return;
                }

                successEl.textContent = 'Registration successful! Please check your email to verify your account, then login.';
                successEl.classList.remove('hidden');

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
            errorEl.textContent = 'An unexpected error occurred: ' + error.message;
            errorEl.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register';
        }
    });

    // Handle login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');

        errorEl.classList.add('hidden');

        if (!supabaseInitialized) {
            errorEl.textContent = 'Error: Supabase is not configured. Please update config.js with your Supabase credentials.';
            errorEl.classList.remove('hidden');
            return;
        }

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';

        try {
            const result = await window.authService.login(email, password);

            if (result.success) {
                showApp(result.user);
            } else {
                errorEl.textContent = result.error || 'Login failed. Please try again.';
                errorEl.classList.remove('hidden');
            }
        } catch (error) {
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

            cards = [];
            renderReviewList();
        }
    });

    // Show the main app after successful authentication
    async function showApp(user) {
        window.authService.currentUser = user;
        userEmailSpan.textContent = user.email;
        authSection.classList.add('hidden');
        appContainer.classList.remove('hidden');

        await initApp();
    }

    // Initialize app - load cards and render
    async function initApp() {
        cards = await window.authService.loadCards();

        renderReviewList();

        // Default landing view: Study section
        startStudy();
        reviewSection.classList.add("hidden");
        studySection.classList.remove('hidden');
    }

    // Check required scripts
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

    // Initialize Supabase
    supabaseInitialized = window.authService.initSupabase();

    if (!supabaseInitialized) {
        authSection.classList.remove('hidden');
    } else {
        try {
            const user = await window.authService.getCurrentUser();
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
});

// ==================== CARD DATA ====================

let cards = [];
let currentCard = null;
let currentReviewCard = null;

// ==================== DOM REFERENCES ====================

const studySection = document.getElementById('study-section');
const reviewSection = document.getElementById("review-section");
const recentSection = document.getElementById("recent-section");
const starredSection = document.getElementById("starred-section");

const navStudy = document.getElementById('nav-study');
const navReview = document.getElementById("nav-review");
const navRecent = document.getElementById("nav-recent");
const navStarred = document.getElementById("nav-starred");

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
const ratingButtons = document.querySelectorAll('.rating-buttons button');
const starButtons = document.querySelectorAll('.star-btn');
const recentList = document.getElementById("recent-list");
const starredList = document.getElementById("starred-list");

const celebrationModal = document.getElementById('celebration-modal');
const closeCelebrationBtn = document.getElementById('close-celebration-btn');


// ==================== AUDIO STATE ====================

let audioLoopTimeout = null;
let reviewAudioAdvanceTimeout = null;
let fastPlayback = false;
let reviewPlaybackOrder = [];
let reviewPlaybackIndex = -1;
let cardAudioRetryCount = 0;
let reviewAudioRetryCount = 0;
let cardAudioRetryTimeout = null;
let reviewAudioRetryTimeout = null;
const MAX_AUDIO_RETRIES = 3;

// ==================== AUDIO CONTROLS ====================

// Helper function to play audio with retry logic
function playAudioWithRetry(audioElement, retryCountRef, toggleBtn, audioType = 'card') {
    const isCardAudio = audioType === 'card';
    const maxRetries = MAX_AUDIO_RETRIES;

    return audioElement.play().catch((error) => {
        console.error(`Audio playback failed for ${audioType}:`, error);

        const currentRetry = isCardAudio ? cardAudioRetryCount : reviewAudioRetryCount;

        if (currentRetry < maxRetries) {
            // Increment retry count
            if (isCardAudio) {
                cardAudioRetryCount++;
            } else {
                reviewAudioRetryCount++;
            }

            // Update UI to show retry attempt
            if (toggleBtn) {
                toggleBtn.textContent = `🔄 ${currentRetry + 1}/${maxRetries}`;
                toggleBtn.disabled = true;
            }

            // Exponential backoff: 500ms, 1000ms, 2000ms
            const retryDelay = 500 * Math.pow(2, currentRetry);

            console.log(`Retrying audio playback in ${retryDelay}ms (attempt ${currentRetry + 1}/${maxRetries})`);

            const retryAction = () => {
                if (toggleBtn) {
                    toggleBtn.disabled = false;
                }
                playAudioWithRetry(audioElement, retryCountRef, toggleBtn, audioType);
            };

            if (isCardAudio) {
                cardAudioRetryTimeout = setTimeout(retryAction, retryDelay);
            } else {
                reviewAudioRetryTimeout = setTimeout(retryAction, retryDelay);
            }
        } else {
            // All retries exhausted
            console.error(`Audio playback failed after ${maxRetries} retries`);
            if (toggleBtn) {
                toggleBtn.textContent = '❌';
                toggleBtn.disabled = false;
                toggleBtn.title = 'Audio failed to load. Click to retry.';
            }
            // Reset retry count for next attempt
            if (isCardAudio) {
                cardAudioRetryCount = 0;
            } else {
                reviewAudioRetryCount = 0;
            }
        }
    });
}

function stopAudio() {
    clearTimeout(audioLoopTimeout);
    audioLoopTimeout = null;
    clearTimeout(cardAudioRetryTimeout);
    cardAudioRetryTimeout = null;
    cardAudioRetryCount = 0;
    if (cardAudio) {
        cardAudio.pause();
        cardAudio.onended = null;
        cardAudio.currentTime = 0;
    }
    if (audioToggleBtn) {
        audioToggleBtn.textContent = '▶️';
        audioToggleBtn.disabled = false;
        audioToggleBtn.title = 'Play/Pause';
    }
}

function stopReviewAudio() {
    clearTimeout(reviewAudioAdvanceTimeout);
    reviewAudioAdvanceTimeout = null;
    clearTimeout(reviewAudioRetryTimeout);
    reviewAudioRetryTimeout = null;
    reviewAudioRetryCount = 0;
    if (reviewAudio) {
        reviewAudio.pause();
        reviewAudio.onended = null;
        reviewAudio.currentTime = 0;
    }
    if (reviewAudioToggleBtn) {
        reviewAudioToggleBtn.textContent = "▶️";
        reviewAudioToggleBtn.disabled = false;
        reviewAudioToggleBtn.title = 'Play/Pause';
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
    const orderedIds = cards.map(card => card.id);
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
            cardAudioRetryCount = 0; // Reset retry count for loop playback
            playAudioWithRetry(cardAudio, cardAudioRetryCount, audioToggleBtn, 'card');
        }, 5000);
    };
}

// ==================== REVIEW LIST ====================

function renderReviewList() {
    if (!reviewList) return;
    reviewList.innerHTML = "";
    if (cards.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No cards yet. Add cards via GitHub.";
        reviewList.appendChild(li);
        reviewPlaybackOrder = [];
        reviewPlaybackIndex = -1;
        return;
    }

    // Sort cards alphabetically by title for display
    const sortedCards = [...cards].sort((a, b) => {
        const titleA = (a.title || a.id).toLowerCase();
        const titleB = (b.title || b.id).toLowerCase();
        return titleA.localeCompare(titleB);
    });

    // Group cards by first letter
    const grouped = {};
    sortedCards.forEach(card => {
        const title = card.title || card.id;
        const firstLetter = title.charAt(0).toUpperCase();
        if (!grouped[firstLetter]) {
            grouped[firstLetter] = [];
        }
        grouped[firstLetter].push(card);
    });

    // Get sorted list of letters
    const letters = Object.keys(grouped).sort();

    // Create cluster grid container
    const clusterGrid = document.createElement("div");
    clusterGrid.className = "cluster-grid";

    letters.forEach(letter => {
        // Create cluster container
        const cluster = document.createElement("div");
        cluster.className = "letter-cluster";

        // Letter heading
        const heading = document.createElement("div");
        heading.className = "cluster-heading";
        heading.textContent = letter;
        cluster.appendChild(heading);

        // Cards list for this letter
        const cardList = document.createElement("ul");
        cardList.className = "cluster-cards";

        grouped[letter].forEach(card => {
            const li = document.createElement("li");
            li.textContent = card.title || card.id;
            li.addEventListener("click", () => openReviewCard(card.id));
            cardList.appendChild(li);
        });

        cluster.appendChild(cardList);
        clusterGrid.appendChild(cluster);
    });

    reviewList.appendChild(clusterGrid);

    // Use sorted order for playback
    reviewPlaybackOrder = sortedCards.map(card => card.id);
    if (currentReviewCard) {
        reviewPlaybackIndex = reviewPlaybackOrder.indexOf(currentReviewCard.id);
    }
}

function openReviewCard(id) {
    // Stop any currently playing audio first (prevents multiple tracks)
    stopAudio();
    stopReviewAudio();

    const card = cards.find(c => c.id === id);
    if (!card) return;

    // Use sorted order for playback
    const sortedCards = [...cards].sort((a, b) => {
        const titleA = (a.title || a.id).toLowerCase();
        const titleB = (b.title || b.id).toLowerCase();
        return titleA.localeCompare(titleB);
    });
    reviewPlaybackOrder = sortedCards.map(c => c.id);
    reviewPlaybackIndex = reviewPlaybackOrder.indexOf(card.id);
    if (reviewPlaybackIndex === -1 && reviewPlaybackOrder.length > 0) {
        reviewPlaybackIndex = 0;
    }
    currentReviewCard = card;
    reviewRevealArea.classList.add("hidden");
    reviewShowAnswerBtn.classList.remove("hidden");
    reviewCardQuestionEl.textContent = card.question;
    reviewCardAnswerEl.textContent = card.answer;
    updateStarButtons(card);
    if (card.audioData) {
        reviewAudio.src = card.audioData;
        reviewAudio.load();
        reviewAudio.playbackRate = fastPlayback ? 1.2 : 1;
        setupReviewAutoAdvance();
        reviewAudioRetryCount = 0; // Reset retry count for new playback
        playAudioWithRetry(reviewAudio, reviewAudioRetryCount, reviewAudioToggleBtn, 'review');
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

function renderRecentList() {
    if (!recentList) return;
    recentList.innerHTML = "";

    const recentCards = cards
        .filter(c => c.repetitions > 0 && c.nextReview !== Date.now()) // roughly checks if played
        .sort((a, b) => (b.nextReview - a.nextReview)); // approximating "recently played" by nextReview time (newly reviewed cards have future dates)

    // Better approximation: we really should track 'lastReview' time, but 'nextReview' implies recently modified
    // A more accurate sort would be by updated_at if available, but nextReview works as a proxy for now.

    if (recentCards.length === 0) {
        recentList.innerHTML = "<li>No recently played cards.</li>";
        return;
    }

    recentCards.forEach(card => {
        const li = document.createElement("li");
        li.textContent = card.title || card.id;
        li.addEventListener("click", () => {
            // When clicking from recent, open in Review mode for simplicity
            stopAudio();
            stopReviewAudio();
            studySection.classList.add("hidden");
            recentSection.classList.add("hidden");
            starredSection.classList.add("hidden");
            reviewSection.classList.remove("hidden");
            renderReviewList(); // ensure list is ready
            openReviewCard(card.id);
        });
        recentList.appendChild(li);
    });
}

function renderStarredList() {
    if (!starredList) return;
    starredList.innerHTML = "";

    const starredCards = cards
        .filter(c => c.isStarred)
        .sort((a, b) => {
            const timeA = new Date(a.starredAt || 0).getTime();
            const timeB = new Date(b.starredAt || 0).getTime();
            return timeB - timeA;
        });

    if (starredCards.length === 0) {
        starredList.innerHTML = "<li>No starred cards yet.</li>";
        return;
    }

    starredCards.forEach(card => {
        const li = document.createElement("li");
        li.textContent = card.title || card.id;
        li.addEventListener("click", () => {
            // When clicking from starred, open in Review mode
            stopAudio();
            stopReviewAudio();
            studySection.classList.add("hidden");
            recentSection.classList.add("hidden");
            starredSection.classList.add("hidden");
            reviewSection.classList.remove("hidden");
            renderReviewList();
            openReviewCard(card.id);
        });
        starredList.appendChild(li);
    });
}

function updateStarButtons(card) {
    starButtons.forEach(btn => {
        btn.textContent = card.isStarred ? "★" : "☆";
        btn.classList.toggle("filled", card.isStarred);
    });
}

// ==================== NAVIGATION ====================

navStudy.addEventListener('click', () => {
    stopAudio();
    stopReviewAudio();
    startStudy();
    reviewSection.classList.add("hidden");
    recentSection.classList.add("hidden");
    starredSection.classList.add("hidden");
    studySection.classList.remove('hidden');

    // Update active state
    updateNavActive(navStudy);
});

navReview.addEventListener("click", () => {
    stopAudio();
    stopReviewAudio();
    studySection.classList.add("hidden");
    recentSection.classList.add("hidden");
    starredSection.classList.add("hidden");
    reviewSection.classList.remove("hidden");
    renderReviewList();

    updateNavActive(navReview);
});

navRecent.addEventListener("click", () => {
    stopAudio();
    stopReviewAudio();
    studySection.classList.add("hidden");
    reviewSection.classList.add("hidden");
    starredSection.classList.add("hidden");
    recentSection.classList.remove("hidden");
    renderRecentList();

    updateNavActive(navRecent);
});

navStarred.addEventListener("click", () => {
    stopAudio();
    stopReviewAudio();
    studySection.classList.add("hidden");
    reviewSection.classList.add("hidden");
    recentSection.classList.add("hidden");
    starredSection.classList.remove("hidden");
    renderStarredList();

    updateNavActive(navStarred);
});

function updateNavActive(activeBtn) {
    [navStudy, navReview, navRecent, navStarred].forEach(btn => btn.classList.remove("active"));
    activeBtn.classList.add("active");
}

// ==================== SKIP DAY ====================

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
    await window.authService.saveCards(cards);
    updateDueCount();
    showNextCard();
}

// ==================== STUDY FLOW ====================

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

    stopAudio();

    const dueCards = cards.filter((c) => c.nextReview <= Date.now());
    if (dueCards.length === 0) {
        noDueEl.classList.remove('hidden');
        // If we just finished a card (implied by this function being called), show celebration
        if (currentCard) {
            celebrationModal.classList.remove('hidden');
        }
        return;
    }

    currentCard = dueCards.sort((a, b) => a.nextReview - b.nextReview)[0];
    cardQuestionEl.textContent = currentCard.question;
    cardAnswerEl.textContent = currentCard.answer;
    updateStarButtons(currentCard);

    if (currentCard.audioData) {
        cardAudio.src = currentCard.audioData;
        cardAudio.load();
        cardAudio.playbackRate = fastPlayback ? 1.2 : 1;
        setupAudioLooping();
        cardAudioRetryCount = 0; // Reset retry count for new playback
        playAudioWithRetry(cardAudio, cardAudioRetryCount, audioToggleBtn, 'card');
        if (audioToggleBtn) {
            audioToggleBtn.classList.remove('hidden');
            audioToggleBtn.textContent = '▶️';
        }
        if (rewindBtn) rewindBtn.classList.remove('hidden');
        if (restartBtn) restartBtn.classList.remove('hidden');
        if (speedToggleBtn) {
            speedToggleBtn.classList.remove('hidden');
            speedToggleBtn.textContent = fastPlayback ? '1.2x' : '1x';
        }
    } else {
        cardAudio.removeAttribute('src');
        cardAudio.load();
        if (audioToggleBtn) audioToggleBtn.classList.add('hidden');
        if (rewindBtn) rewindBtn.classList.add('hidden');
        if (restartBtn) restartBtn.classList.add('hidden');
        if (speedToggleBtn) speedToggleBtn.classList.add('hidden');
    }

    cardBox.classList.remove('hidden');
}

function revealAnswer() {
    revealArea.classList.remove('hidden');
    showAnswerBtn.classList.add('hidden');
}

// ==================== EVENT LISTENERS ====================

cardQuestionEl.addEventListener('click', revealAnswer);
showAnswerBtn.addEventListener('click', revealAnswer);

if (audioToggleBtn) {
    audioToggleBtn.addEventListener('click', () => {
        if (cardAudio.paused) {
            setupAudioLooping();
            cardAudioRetryCount = 0; // Reset retry count
            playAudioWithRetry(cardAudio, cardAudioRetryCount, audioToggleBtn, 'card');
        } else {
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

    // Error handling for card audio
    cardAudio.addEventListener('error', (e) => {
        console.error('Card audio error:', e);
        console.error('Audio error code:', cardAudio.error?.code, 'message:', cardAudio.error?.message);
        if (audioToggleBtn) {
            audioToggleBtn.textContent = '❌';
            audioToggleBtn.title = 'Audio failed to load. Click to retry.';
        }
    });

    cardAudio.addEventListener('stalled', () => {
        console.warn('Card audio stalled - network issue detected');
        if (audioToggleBtn) {
            audioToggleBtn.textContent = '⏳';
            audioToggleBtn.title = 'Audio loading stalled...';
        }
    });

    cardAudio.addEventListener('waiting', () => {
        if (audioToggleBtn) {
            audioToggleBtn.textContent = '⏳';
        }
    });

    cardAudio.addEventListener('canplay', () => {
        if (audioToggleBtn && audioToggleBtn.textContent === '⏳') {
            audioToggleBtn.textContent = cardAudio.paused ? '▶️' : '⏸️';
            audioToggleBtn.title = 'Play/Pause';
        }
    });
}

if (rewindBtn) {
    rewindBtn.addEventListener('click', () => {
        if (!cardAudio.duration) return;
        cardAudio.currentTime = Math.max(0, cardAudio.currentTime - 5);
    });
}

if (restartBtn) {
    restartBtn.addEventListener('click', () => {
        if (!cardAudio.duration) return;
        cardAudio.currentTime = 0;
        if (!cardAudio.paused) {
            cardAudioRetryCount = 0; // Reset retry count
            playAudioWithRetry(cardAudio, cardAudioRetryCount, audioToggleBtn, 'card');
        }
    });
}

if (speedToggleBtn) {
    speedToggleBtn.addEventListener('click', () => {
        fastPlayback = !fastPlayback;
        cardAudio.playbackRate = fastPlayback ? 1.2 : 1;
        speedToggleBtn.textContent = fastPlayback ? '1.2x' : '1x';
    });
}

ratingButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
        const value = btn.dataset.rating;
        if (!currentCard) return;
        const isEasy = value === 'easy';
        processRatingBinary(currentCard, isEasy);
        await window.authService.saveCards(cards);
        updateDueCount();
        showNextCard();
    });
});



starButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // prevent triggering card click/flip if bubbled
        const card = currentReviewCard && !reviewCardBox.classList.contains("hidden")
            ? currentReviewCard
            : currentCard;

        if (!card) return;

        card.isStarred = !card.isStarred;
        card.starredAt = card.isStarred ? new Date().toISOString() : null;
        updateStarButtons(card);

        await window.authService.saveCardProgress(card);
    });
});

reviewCardQuestionEl.addEventListener("click", revealReviewAnswer);
reviewShowAnswerBtn.addEventListener("click", revealReviewAnswer);

if (closeCelebrationBtn) {
    closeCelebrationBtn.addEventListener('click', () => {
        celebrationModal.classList.add('hidden');
    });
}

if (reviewAudioToggleBtn) {
    reviewAudioToggleBtn.addEventListener("click", () => {
        if (reviewAudio.paused) {
            clearTimeout(reviewAudioAdvanceTimeout);
            reviewAudioAdvanceTimeout = null;
            setupReviewAutoAdvance();
            reviewAudioRetryCount = 0; // Reset retry count
            playAudioWithRetry(reviewAudio, reviewAudioRetryCount, reviewAudioToggleBtn, 'review');
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

    // Error handling for review audio
    reviewAudio.addEventListener('error', (e) => {
        console.error('Review audio error:', e);
        console.error('Audio error code:', reviewAudio.error?.code, 'message:', reviewAudio.error?.message);
        if (reviewAudioToggleBtn) {
            reviewAudioToggleBtn.textContent = '❌';
            reviewAudioToggleBtn.title = 'Audio failed to load. Click to retry.';
        }
    });

    reviewAudio.addEventListener('stalled', () => {
        console.warn('Review audio stalled - network issue detected');
        if (reviewAudioToggleBtn) {
            reviewAudioToggleBtn.textContent = '⏳';
            reviewAudioToggleBtn.title = 'Audio loading stalled...';
        }
    });

    reviewAudio.addEventListener('waiting', () => {
        if (reviewAudioToggleBtn) {
            reviewAudioToggleBtn.textContent = '⏳';
        }
    });

    reviewAudio.addEventListener('canplay', () => {
        if (reviewAudioToggleBtn && reviewAudioToggleBtn.textContent === '⏳') {
            reviewAudioToggleBtn.textContent = reviewAudio.paused ? '▶️' : '⏸️';
            reviewAudioToggleBtn.title = 'Play/Pause';
        }
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
            reviewAudioRetryCount = 0; // Reset retry count
            playAudioWithRetry(reviewAudio, reviewAudioRetryCount, reviewAudioToggleBtn, 'review');
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

// ==================== SM-2 ALGORITHM ====================

function processRatingBinary(card, isEasy) {
    const millisInDay = 24 * 60 * 60 * 1000;

    if (!isEasy) {
        card.repetitions = 0;
        card.interval = 1;
        card.easeFactor = Math.max(1.3, card.easeFactor - 0.15);
    } else {
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
