/**
 * Verification script for openReviewCard() changes
 * Validates that the code contains the expected modifications:
 * 1. scrollIntoView is called on reviewCardBox
 * 2. playAudioWithRetry is called for auto-play
 */

const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'app.js');
const appJs = fs.readFileSync(appJsPath, 'utf-8');

// Extract the openReviewCard function
const functionMatch = appJs.match(/function openReviewCard\(id\)\s*\{[\s\S]*?\n\}/);

if (!functionMatch) {
    console.error('❌ FAIL: Could not find openReviewCard function');
    process.exit(1);
}

const functionCode = functionMatch[0];

console.log('Testing openReviewCard() function modifications...\n');

let allPassed = true;

// Test 1: scrollIntoView is called
const hasScrollIntoView = functionCode.includes('scrollIntoView');
const hasScrollOptions = functionCode.includes("behavior: 'smooth'") || functionCode.includes('behavior: "smooth"');

if (hasScrollIntoView && hasScrollOptions) {
    console.log('✅ PASS: scrollIntoView is called with smooth behavior');
} else if (hasScrollIntoView) {
    console.log('⚠️  WARN: scrollIntoView is called but may not have smooth behavior');
} else {
    console.log('❌ FAIL: scrollIntoView is NOT called in openReviewCard');
    allPassed = false;
}

// Test 2: scrollIntoView is called on reviewCardBox
const scrollOnReviewCard = functionCode.includes('reviewCardBox.scrollIntoView');
if (scrollOnReviewCard) {
    console.log('✅ PASS: scrollIntoView is called on reviewCardBox');
} else {
    console.log('❌ FAIL: scrollIntoView should be called on reviewCardBox');
    allPassed = false;
}

// Test 3: playAudioWithRetry is called for auto-play
const hasPlayAudioWithRetry = functionCode.includes('playAudioWithRetry(reviewAudio');
if (hasPlayAudioWithRetry) {
    console.log('✅ PASS: playAudioWithRetry is called with reviewAudio');
} else {
    console.log('❌ FAIL: playAudioWithRetry should be called with reviewAudio for auto-play');
    allPassed = false;
}

// Test 4: playAudioWithRetry is in the audio branch (not always called)
const audioDataCheck = functionCode.includes('if (card.audioData && reviewAudio)');
const playInAudioBranch = functionCode.match(/if\s*\(\s*card\.audioData\s*&&\s*reviewAudio\s*\)\s*\{[\s\S]*?playAudioWithRetry/);
if (playInAudioBranch) {
    console.log('✅ PASS: playAudioWithRetry is called only when card has audioData');
} else if (hasPlayAudioWithRetry) {
    console.log('⚠️  WARN: playAudioWithRetry is called but verify it\'s in the correct branch');
} else {
    console.log('❌ FAIL: playAudioWithRetry should be inside the audioData check');
    allPassed = false;
}

// Test 5: scrollIntoView is called after card is shown
const scrollAfterShow = functionCode.match(/classList\.remove\s*\(\s*["']hidden["']\s*\)[\s\S]*scrollIntoView/);
if (scrollAfterShow) {
    console.log('✅ PASS: scrollIntoView is called after card is shown (hidden class removed)');
} else {
    console.log('⚠️  WARN: Verify scrollIntoView is called after the card becomes visible');
}

console.log('\n' + '='.repeat(50));
if (allPassed) {
    console.log('✅ All critical tests PASSED');
    process.exit(0);
} else {
    console.log('❌ Some tests FAILED');
    process.exit(1);
}
