// Authentication and Supabase Integration
// This file handles user authentication and replaces IndexedDB with Supabase

(function() {
"use strict";

// Initialize Supabase client (inside IIFE to avoid global scope conflicts)
var supabaseClient = null;
var currentUser = null;

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
        // Use current page URL as the redirect so the confirmation email
        // links back to wherever the app is actually hosted (not localhost)
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
 * Load all cards for the current user from Supabase
 * Replaces the old IndexedDB loadCards() function
 */
async function loadCards() {
    try {
        if (!currentUser) {
            console.error('No user logged in');
            return [];
        }

        const { data, error } = await supabaseClient
            .from('cards')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('order_index', { ascending: true });

        if (error) throw error;

        // Transform from Supabase format to app format
        const cards = (data || []).map(card => ({
            id: card.id,
            question: card.question,
            answer: card.answer,
            audioData: card.audio_url, // Changed from audioData to audio_url
            interval: card.interval || 0,
            repetitions: card.repetitions || 0,
            easeFactor: parseFloat(card.ease_factor) || 2.5,
            nextReview: card.next_review || Date.now(),
            pinned: card.pinned || false,
            order: card.order_index || 0
        }));

        return cards;
    } catch (error) {
        console.error('Error loading cards:', error);
        alert('Failed to load cards from cloud: ' + error.message);
        return [];
    }
}

/**
 * Save all cards to Supabase
 * Replaces the old IndexedDB saveCards() function
 */
async function saveCards(cards) {
    try {
        if (!currentUser) {
            console.error('No user logged in');
            return;
        }

        // Fetch existing card IDs so we can detect deletions
        const { data: existingCards, error: fetchError } = await supabaseClient
            .from('cards')
            .select('id')
            .eq('user_id', currentUser.id);

        if (fetchError) throw fetchError;

        // Upsert all current cards (safe: creates or updates, never deletes)
        if (cards.length > 0) {
            const cardsToUpsert = cards.map(card => ({
                id: card.id,
                user_id: currentUser.id,
                question: card.question,
                answer: card.answer,
                audio_url: card.audioData,
                interval: card.interval || 0,
                repetitions: card.repetitions || 0,
                ease_factor: card.easeFactor || 2.5,
                next_review: card.nextReview || Date.now(),
                pinned: card.pinned || false,
                order_index: card.order || 0
            }));

            const { error: upsertError } = await supabaseClient
                .from('cards')
                .upsert(cardsToUpsert);

            if (upsertError) throw upsertError;
        }

        // Only delete cards the user explicitly removed (exist in DB but not locally)
        if (existingCards && existingCards.length > 0) {
            const localIds = new Set(cards.map(c => c.id));
            const toDelete = existingCards.filter(c => !localIds.has(c.id)).map(c => c.id);
            if (toDelete.length > 0) {
                const { error: deleteError } = await supabaseClient
                    .from('cards')
                    .delete()
                    .in('id', toDelete);

                if (deleteError) throw deleteError;
            }
        }
    } catch (error) {
        console.error('Error saving cards:', error);
        alert('Failed to save cards to cloud: ' + error.message);
    }
}

/**
 * Save a single card to Supabase (upsert)
 */
async function saveCard(card) {
    try {
        if (!currentUser) {
            console.error('No user logged in');
            return { success: false, error: 'Not logged in' };
        }

        const cardData = {
            id: card.id,
            user_id: currentUser.id,
            question: card.question,
            answer: card.answer,
            audio_url: card.audioData || null,
            interval: card.interval || 0,
            repetitions: card.repetitions || 0,
            ease_factor: card.easeFactor || 2.5,
            next_review: card.nextReview || Date.now(),
            pinned: card.pinned || false,
            order_index: card.order || 0
        };

        const { data, error } = await supabaseClient
            .from('cards')
            .upsert(cardData)
            .select();

        if (error) throw error;

        return { success: true, data: data[0] };
    } catch (error) {
        console.error('Error saving card:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a card from Supabase
 */
async function deleteCardFromDB(cardId) {
    try {
        if (!currentUser) {
            console.error('No user logged in');
            return { success: false, error: 'Not logged in' };
        }

        const { error } = await supabaseClient
            .from('cards')
            .delete()
            .eq('id', cardId)
            .eq('user_id', currentUser.id);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('Error deleting card:', error);
        return { success: false, error: error.message };
    }
}

// ==================== AUDIO STORAGE ====================

/**
 * Upload audio file to Supabase Storage
 * @param {Blob} audioBlob - The audio blob to upload
 * @param {string} cardId - The card ID for naming the file
 * @returns {Promise<string>} - The public URL of the uploaded audio
 */
async function uploadAudio(audioBlob, cardId) {
    try {
        if (!currentUser) {
            throw new Error('No user logged in');
        }

        const fileName = `${currentUser.id}/${cardId}.mp3`;

        const { data, error } = await supabaseClient.storage
            .from('audio-files')
            .upload(fileName, audioBlob, {
                cacheControl: '3600',
                upsert: true // Replace if exists
            });

        if (error) throw error;

        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('audio-files')
            .getPublicUrl(fileName);

        return urlData.publicUrl;
    } catch (error) {
        console.error('Error uploading audio:', error);
        throw error;
    }
}

/**
 * Delete audio file from Supabase Storage
 * @param {string} audioUrl - The URL of the audio to delete
 */
async function deleteAudio(audioUrl) {
    try {
        if (!currentUser || !audioUrl) return;

        // Extract file path from URL
        const urlParts = audioUrl.split('/');
        const fileName = `${currentUser.id}/${urlParts[urlParts.length - 1]}`;

        const { error } = await supabaseClient.storage
            .from('audio-files')
            .remove([fileName]);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting audio:', error);
    }
}

/**
 * Convert data URL to Blob
 */
function dataURLtoBlob(dataURL) {
    const parts = dataURL.split(',');
    const byteString = atob(parts[1]);
    const mimeString = parts[0].split(':')[1].split(';')[0];

    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ab], { type: mimeString });
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
    saveCard,
    deleteCardFromDB,
    uploadAudio,
    deleteAudio,
    dataURLtoBlob,
    saveUserAPIKey,
    getUserAPIKey,
    get currentUser() { return currentUser; },
    set currentUser(user) { currentUser = user; }
};

})(); // end IIFE
