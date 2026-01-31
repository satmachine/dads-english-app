#!/usr/bin/env node
/**
 * Translation Script for Dad's English App
 *
 * This script translates English questions in cards.json to Traditional Chinese
 * and populates the answer field with the translations.
 *
 * Usage:
 *   OPENAI_API_KEY=your-api-key node scripts/translate-cards.mjs
 *   ANTHROPIC_API_KEY=your-api-key node scripts/translate-cards.mjs
 *
 * Or set the environment variable:
 *   export OPENAI_API_KEY=your-api-key
 *   node scripts/translate-cards.mjs
 *
 * Options:
 *   --dry-run    Preview translations without saving
 *   --force      Re-translate cards that already have answers
 *
 * Supports both OpenAI and Anthropic APIs (automatically detects which key is set)
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const CARDS_PATH = join(PROJECT_ROOT, 'content', 'cards.json');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const forceRetranslate = args.includes('--force');

// Check for API keys (supports both OpenAI and Anthropic)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const API_PROVIDER = ANTHROPIC_API_KEY ? 'anthropic' : (OPENAI_API_KEY ? 'openai' : null);

if (!API_PROVIDER) {
  console.error('Error: Either OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable is required');
  console.error('');
  console.error('Usage:');
  console.error('  OPENAI_API_KEY=your-api-key node scripts/translate-cards.mjs');
  console.error('  ANTHROPIC_API_KEY=your-api-key node scripts/translate-cards.mjs');
  console.error('');
  console.error('Options:');
  console.error('  --dry-run    Preview translations without saving');
  console.error('  --force      Re-translate cards that already have answers');
  process.exit(1);
}

const TRANSLATION_PROMPT = `You are a professional English to Traditional Chinese translator.
Translate the following English paragraph into Traditional Chinese (繁體中文).
Requirements:
- Use Traditional Chinese characters (not Simplified)
- Maintain the same tone and style as the original
- Preserve paragraph structure
- Translate naturally, not word-for-word
- Only output the translation, no explanations`;

/**
 * Translate English text to Traditional Chinese using OpenAI API
 */
async function translateWithOpenAI(englishText) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: TRANSLATION_PROMPT },
        { role: 'user', content: englishText }
      ],
      temperature: 0.3,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || '';
}

/**
 * Translate English text to Traditional Chinese using Anthropic API
 */
async function translateWithAnthropic(englishText) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      system: TRANSLATION_PROMPT,
      messages: [
        { role: 'user', content: englishText }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.content[0]?.text?.trim() || '';
}

/**
 * Translate using the configured API provider
 */
async function translateToTraditionalChinese(englishText) {
  if (API_PROVIDER === 'anthropic') {
    return translateWithAnthropic(englishText);
  }
  return translateWithOpenAI(englishText);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main function
 */
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Dad\'s English App - Card Translator  ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`Using ${API_PROVIDER.toUpperCase()} API for translations`);
  console.log('');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be saved');
    console.log('');
  }

  // Read cards.json
  console.log('Reading cards.json...');
  const cardsData = JSON.parse(await readFile(CARDS_PATH, 'utf-8'));
  const cards = cardsData.cards;
  console.log(`Found ${cards.length} cards`);
  console.log('');

  // Find cards that need translation
  const cardsToTranslate = forceRetranslate
    ? cards
    : cards.filter(card => !card.answer || card.answer.trim() === '');

  console.log(`Cards needing translation: ${cardsToTranslate.length}`);
  if (!forceRetranslate && cards.length !== cardsToTranslate.length) {
    console.log(`(${cards.length - cardsToTranslate.length} cards already have translations)`);
  }
  console.log('');

  if (cardsToTranslate.length === 0) {
    console.log('✓ All cards already have translations!');
    return;
  }

  // Translate cards
  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  // Translate cards with concurrency
  const CONCURRENCY = 50;
  let processedCount = 0;

  for (let i = 0; i < cardsToTranslate.length; i += CONCURRENCY) {
    const batch = cardsToTranslate.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async (card, batchIndex) => {
      const globalIndex = i + batchIndex;
      const progress = `[${globalIndex + 1}/${cardsToTranslate.length}]`;
      const cardIndex = cards.findIndex(c => c.id === card.id);

      try {
        console.log(`${progress} Translating "${card.title || card.id}"...`);

        const translation = await translateToTraditionalChinese(card.question);

        if (!isDryRun) {
          cards[cardIndex].answer = translation;
        }

        successCount++;
        processedCount++;

        if (isDryRun && processedCount <= 3) {
          // Show sample translations in dry run mode
          console.log('    English: ' + card.question.substring(0, 80) + '...');
          console.log('    Chinese: ' + translation.substring(0, 80) + '...');
          console.log('');
        }

      } catch (error) {
        errorCount++;
        console.log(` ✗ Error translating "${card.title || card.id}": ${error.message}`);

        // If we hit rate limits, we should probably pause globally, but for simplicity in parallel mode
        // we'll just log it. Retrying in parallel mode is more complex without a queue.
        // Given we are restartable, we can just let it fail and run again for failed ones.
      }
    }));

    // Save progress periodically
    if (!isDryRun) {
      await writeFile(CARDS_PATH, JSON.stringify(cardsData, null, 2));
      console.log(`    💾 Progress saved (${Math.min(i + CONCURRENCY, cardsToTranslate.length)} cards processed)`);
    }

    // Small delay between batches to be nice to API
    await sleep(200);
  }

  // Final save
  if (!isDryRun && successCount > 0) {
    await writeFile(CARDS_PATH, JSON.stringify(cardsData, null, 2));
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`Completed in ${duration} seconds`);
  console.log(`✓ Successfully translated: ${successCount} cards`);
  if (errorCount > 0) {
    console.log(`✗ Errors: ${errorCount} cards`);
  }
  if (!isDryRun) {
    console.log(`💾 Saved to: content/cards.json`);
  }
  console.log('');

  if (!isDryRun && successCount > 0) {
    console.log('Next steps:');
    console.log('  1. Review the translations in content/cards.json');
    console.log('  2. git add content/cards.json');
    console.log('  3. git commit -m "Add Traditional Chinese translations"');
    console.log('  4. git push');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
