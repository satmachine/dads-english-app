// Authentication and Supabase Integration
// Cards are loaded from GitHub, only progress is stored in Supabase

(function () {
    "use strict";

    // Initialize Supabase client (inside IIFE to avoid global scope conflicts)
    var supabaseClient = null;
    var currentUser = null;

    // Cache for cards loaded from GitHub
    var cachedCards = null;

    /**
     * Initialize the Supabase client
     */
    function initSupabase() {
        console.log('initSupabase called');
        console.log('SUPABASE_CONFIG:', window.SUPABASE_CONFIG);

        if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
            console.error('Supabase configuration is missing. Please update config.js with your Supabase credentials.');
            return false;
        }

        if (window.SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL' || window.SUPABASE_CONFIG.anonKey === 'YOUR_SUPABASE_ANON_KEY') {
            console.error('Please update config.js with your actual Supabase credentials.');
            console.error('Current URL:', window.SUPABASE_CONFIG.url);
            console.error('Current key:', window.SUPABASE_CONFIG.anonKey.substring(0, 20) + '...');
            showError('login-error', 'Supabase is not configured. Please check config.js');
            return false;
        }

        console.log('Creating Supabase client with URL:', window.SUPABASE_CONFIG.url);
        supabaseClient = window.supabase.createClient(
            window.SUPABASE_CONFIG.url,
            window.SUPABASE_CONFIG.anonKey
        );
        console.log('Supabase client created successfully');

        return true;
    }

    /**
     * Show error message
     */
    function showError(elementId, message) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = message;
            el.classList.remove('hidden');
        }
    }

    /**
     * Hide error message
     */
    function hideError(elementId) {
        const el = document.getElementById(elementId);
        if (el) {
            el.classList.add('hidden');
        }
    }

    /**
     * Show success message
     */
    function showSuccess(elementId, message) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = message;
            el.classList.remove('hidden');
        }
    }

    /**
     * Register a new user
     */
    async function register(email, password) {
        console.log('register() called with email:', email);
        try {
            if (!supabaseClient) {
                throw new Error('Supabase client not initialized');
            }

            console.log('Calling supabaseClient.auth.signUp...');
            const redirectUrl = window.location.origin + window.location.pathname;
            console.log('Email redirect URL:', redirectUrl);
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    emailRedirectTo: redirectUrl
                }
            });

            console.log('signUp response - data:', data, 'error:', error);

            if (error) throw error;

            console.log('Registration successful');
            return { success: true, data };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Login user
     */
    async function login(email, password) {
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            currentUser = data.user;
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Logout user
     */
    async function logout() {
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;

            currentUser = null;
            cachedCards = null;
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get current user session
     */
    async function getCurrentUser() {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            currentUser = user;
            return user;
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }

    /**
     * Check if user is authenticated
     */
    async function isAuthenticated() {
        const user = await getCurrentUser();
        return user !== null;
    }

    // ==================== CARD OPERATIONS ====================

    /**
     * Build the audio URL for a card based on its audioFile field
     */
    function getAudioUrl(audioFile) {
        if (!audioFile) return null;
        const config = window.SUPABASE_CONFIG;
        // Use configured content base URL or default to relative path
        const baseUrl = config.contentBaseUrl || './content/audio/';
        return baseUrl + audioFile;
    }

    /**
     * Fetch cards from GitHub (content/cards.json)
     */
    async function fetchCardsFromGitHub() {
        try {
            const config = window.SUPABASE_CONFIG;
            const cardsUrl = config.cardsJsonUrl || './content/cards.json';

            const response = await fetch(cardsUrl, {
                cache: 'no-store' // Always get fresh content
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch cards: ${response.status}`);
            }

            const data = await response.json();
            return data.cards || [];
        } catch (error) {
            console.error('Error fetching cards from GitHub:', error);
            return [];
        }
    }

    /**
     * Fetch progress from Supabase for the current user
     */
    async function fetchProgressFromSupabase() {
        try {
            if (!currentUser) {
                console.error('No user logged in');
                return {};
            }

            const { data, error } = await supabaseClient
                .from('card_progress')
                .select('*')
                .eq('user_id', currentUser.id);

            if (error) throw error;

            console.log('[fetchProgressFromSupabase] Raw data from Supabase:', data);

            // Check if starred columns exist in the database schema
            if (data && data.length > 0) {
                const sampleRow = data[0];
                const hasIsStarred = 'is_starred' in sampleRow;
                const hasStarredAt = 'starred_at' in sampleRow;

                if (!hasIsStarred || !hasStarredAt) {
                    console.error('⚠️ STARRED COLUMNS MISSING IN DATABASE!');
                    console.error('The is_starred and/or starred_at columns do not exist in card_progress table.');
                    console.error('Please run the migration in Supabase SQL Editor:');
                    console.error('ALTER TABLE card_progress ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;');
                    console.error('ALTER TABLE card_progress ADD COLUMN IF NOT EXISTS starred_at TIMESTAMP WITH TIME ZONE;');
                    console.error('Missing columns:', {
                        is_starred: !hasIsStarred,
                        starred_at: !hasStarredAt
                    });
                }
            }

            // Convert array to map by card_id
            const progressMap = {};
            (data || []).forEach(p => {
                progressMap[p.card_id] = {
                    interval: p.interval || 0,
                    repetitions: p.repetitions || 0,
                    easeFactor: parseFloat(p.ease_factor) || 2.5,
                    nextReview: p.next_review || Date.now(),
                    isStarred: p.is_starred || false,
                    starredAt: p.starred_at || null,
                    lastReviewed: p.last_reviewed || null
                };
            });

            // Log starred cards for debugging
            const starredCards = Object.entries(progressMap)
                .filter(([id, p]) => p.isStarred)
                .map(([id, p]) => ({ id, isStarred: p.isStarred, starredAt: p.starredAt }));
            console.log('[fetchProgressFromSupabase] Starred cards found:', starredCards);

            return progressMap;
        } catch (error) {
            console.error('Error fetching progress:', error);
            return {};
        }
    }

    /**
     * Load all cards - fetches content from GitHub and merges with progress from Supabase
     */
    async function loadCards() {
        try {
            if (!currentUser) {
                console.error('No user logged in');
                return [];
            }

            // Fetch cards from GitHub and progress from Supabase in parallel
            const [githubCards, progressMap] = await Promise.all([
                fetchCardsFromGitHub(),
                fetchProgressFromSupabase()
            ]);

            // Merge cards with progress
            const cards = githubCards.map((card, index) => {
                const progress = progressMap[card.id] || {};
                return {
                    id: card.id,
                    title: card.title || card.id,
                    question: card.question,
                    answer: card.answer,
                    audioData: getAudioUrl(card.audioFile),
                    interval: progress.interval || 0,
                    repetitions: progress.repetitions || 0,
                    easeFactor: progress.easeFactor || 2.5,
                    nextReview: progress.nextReview || Date.now(),
                    isStarred: progress.isStarred || false,
                    starredAt: progress.starredAt || null,
                    lastReviewed: progress.lastReviewed || null,
                    pinned: false,
                    order: index
                };
            });

            cachedCards = cards;
            return cards;
        } catch (error) {
            console.error('Error loading cards:', error);
            alert('Failed to load cards: ' + error.message);
            return [];
        }
    }

    /**
     * Save progress to Supabase (only saves spaced repetition data, not card content)
     */
    async function saveCards(cards) {
        try {
            if (!currentUser) {
                console.error('No user logged in');
                return;
            }

            // Only save progress data for cards that have been reviewed, starred, or viewed
            const progressToSave = cards
                .filter(card => card.repetitions > 0 || card.nextReview !== Date.now() || card.isStarred || card.lastReviewed)
                .map(card => ({
                    card_id: card.id,
                    user_id: currentUser.id,
                    interval: card.interval || 0,
                    repetitions: card.repetitions || 0,
                    ease_factor: card.easeFactor || 2.5,
                    next_review: card.nextReview || Date.now(),
                    is_starred: card.isStarred || false,
                    starred_at: card.starredAt || null,
                    last_reviewed: card.lastReviewed || null
                }));

            if (progressToSave.length > 0) {
                const { error } = await supabaseClient
                    .from('card_progress')
                    .upsert(progressToSave, {
                        onConflict: 'card_id,user_id'
                    });

                if (error) throw error;
            }

            cachedCards = cards;
        } catch (error) {
            console.error('Error saving progress:', error);
            alert('Failed to save progress: ' + error.message);
        }
    }

    /**
     * Save progress for a single card
     */
    async function saveCardProgress(card) {
        try {
            if (!currentUser) {
                console.error('No user logged in');
                return { success: false, error: 'Not logged in' };
            }

            const progressData = {
                card_id: card.id,
                user_id: currentUser.id,
                interval: card.interval || 0,
                repetitions: card.repetitions || 0,
                ease_factor: card.easeFactor || 2.5,
                next_review: card.nextReview || Date.now(),
                is_starred: card.isStarred || false,
                starred_at: card.starredAt || null,
                last_reviewed: card.lastReviewed || null
            };

            console.log('[saveCardProgress] Saving card progress:', {
                card_id: progressData.card_id,
                is_starred: progressData.is_starred,
                starred_at: progressData.starred_at,
                last_reviewed: progressData.last_reviewed
            });

            const { data, error } = await supabaseClient
                .from('card_progress')
                .upsert(progressData, {
                    onConflict: 'card_id,user_id'
                })
                .select();

            if (error) {
                console.error('[saveCardProgress] Supabase error:', error);
                // Check if error is about missing columns
                if (error.message && (error.message.includes('is_starred') || error.message.includes('starred_at'))) {
                    console.error('⚠️ STARRED COLUMNS MISSING! Run migration_add_starred.sql in Supabase SQL Editor');
                }
                throw error;
            }

            console.log('[saveCardProgress] Save successful, returned data:', data);

            // Verify the starred data was actually saved
            if (data && data.length > 0) {
                const savedRow = data[0];
                if (!('is_starred' in savedRow)) {
                    console.error('⚠️ WARNING: is_starred column missing from saved data!');
                    console.error('The starred columns may not exist in the database.');
                    console.error('Run: ALTER TABLE card_progress ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;');
                } else if (savedRow.is_starred !== progressData.is_starred) {
                    console.error('⚠️ WARNING: Saved is_starred value does not match!');
                    console.error('Expected:', progressData.is_starred, 'Got:', savedRow.is_starred);
                }
            }

            return { success: true };
        } catch (error) {
            console.error('Error saving card progress:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== USER SETTINGS ====================

    /**
     * Save user's OpenAI API key (encrypted on server)
     */
    async function saveUserAPIKey(apiKey) {
        try {
            if (!currentUser) return { success: false };

            const { data, error } = await supabaseClient
                .from('user_settings')
                .upsert({
                    id: currentUser.id,
                    openai_api_key: apiKey
                });

            if (error) throw error;

            return { success: true };
        } catch (error) {
            console.error('Error saving API key:', error);
            return { success: false };
        }
    }

    /**
     * Get user's OpenAI API key
     */
    async function getUserAPIKey() {
        try {
            if (!currentUser) return null;

            const { data, error } = await supabaseClient
                .from('user_settings')
                .select('openai_api_key')
                .eq('id', currentUser.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found

            return data?.openai_api_key || null;
        } catch (error) {
            console.error('Error getting API key:', error);
            return null;
        }
    }

    // Export functions for use in app.js
    window.authService = {
        initSupabase,
        register,
        login,
        logout,
        getCurrentUser,
        isAuthenticated,
        loadCards,
        saveCards,
        saveCardProgress,
        saveUserAPIKey,
        getUserAPIKey,
        get currentUser() { return currentUser; },
        set currentUser(user) { currentUser = user; }
    };

})(); // end IIFE
