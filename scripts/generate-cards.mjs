#!/usr/bin/env node
/**
 * Card Generator Script for Dad's English App
 *
 * This script generates cards.json from audio+text file pairs.
 *
 * Usage:
 *   node scripts/generate-cards.mjs /path/to/your/source/folder
 *
 * Expected source folder structure:
 *   /your-folder/
 *     lesson001.mp3
 *     lesson001.txt    (first line = question/English text, rest = answer/translation)
 *     lesson002.mp3
 *     lesson002.txt
 *     ...
 *
 * Output:
 *   - Copies all audio files to content/audio/
 *   - Generates content/cards.json with card definitions
 */

import { readdir, readFile, copyFile, writeFile, mkdir } from 'fs/promises';
import { join, basename, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg', '.webm'];
const TEXT_EXTENSIONS = ['.txt'];

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('Usage: node scripts/generate-cards.mjs /path/to/source/folder');
  console.error('');
  console.error('Expected folder structure:');
  console.error('  lesson001.mp3 + lesson001.txt');
  console.error('  lesson002.mp3 + lesson002.txt');
  console.error('  ...');
  console.error('');
  console.error('Text file format:');
  console.error('  Line 1: English text (question)');
  console.error('  Lines 2+: Chinese translation (answer)');
  process.exit(1);
}

async function findFilePairs(folderPath) {
  const files = await readdir(folderPath);
  const pairs = new Map();

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const baseName = basename(file, ext);

    if (!pairs.has(baseName)) {
      pairs.set(baseName, { audio: null, text: null });
    }

    if (AUDIO_EXTENSIONS.includes(ext)) {
      pairs.get(baseName).audio = file;
    } else if (TEXT_EXTENSIONS.includes(ext)) {
      pairs.get(baseName).text = file;
    }
  }

  // Filter to only complete pairs
  const completePairs = [];
  const incomplete = [];

  for (const [name, pair] of pairs) {
    if (pair.audio && pair.text) {
      completePairs.push({ name, ...pair });
    } else if (pair.audio || pair.text) {
      incomplete.push({ name, ...pair });
    }
  }

  // Sort by name for consistent ordering
  completePairs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  return { completePairs, incomplete };
}

function parseTextFile(content) {
  const lines = content.trim().split('\n');
  const question = lines[0]?.trim() || '';
  const answer = lines.slice(1).join('\n').trim() || '';
  return { question, answer };
}

function generateCardId(name) {
  // Convert filename to a URL-safe ID
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  console.log('Scanning source folder:', sourcePath);
  console.log('');

  const { completePairs, incomplete } = await findFilePairs(sourcePath);

  if (incomplete.length > 0) {
    console.log('Warning: Found incomplete pairs (skipping):');
    for (const item of incomplete) {
      console.log(`  - ${item.name}: has ${item.audio ? 'audio' : 'text'} only`);
    }
    console.log('');
  }

  if (completePairs.length === 0) {
    console.error('Error: No complete audio+text pairs found');
    process.exit(1);
  }

  console.log(`Found ${completePairs.length} complete pairs`);
  console.log('');

  // Ensure content/audio directory exists
  const audioDir = join(PROJECT_ROOT, 'content', 'audio');
  await mkdir(audioDir, { recursive: true });

  const cards = [];

  for (let i = 0; i < completePairs.length; i++) {
    const pair = completePairs[i];
    const progress = `[${i + 1}/${completePairs.length}]`;

    try {
      // Read text file
      const textContent = await readFile(join(sourcePath, pair.text), 'utf-8');
      const { question, answer } = parseTextFile(textContent);

      if (!question) {
        console.log(`${progress} Skipping ${pair.name}: empty question`);
        continue;
      }

      // Copy audio file
      const audioSrc = join(sourcePath, pair.audio);
      const audioDest = join(audioDir, pair.audio);
      await copyFile(audioSrc, audioDest);

      // Generate card
      const card = {
        id: generateCardId(pair.name),
        question,
        answer,
        audioFile: pair.audio
      };
      cards.push(card);

      console.log(`${progress} ${pair.name}`);
    } catch (error) {
      console.error(`${progress} Error processing ${pair.name}: ${error.message}`);
    }
  }

  // Write cards.json
  const cardsJson = { cards };
  const cardsPath = join(PROJECT_ROOT, 'content', 'cards.json');
  await writeFile(cardsPath, JSON.stringify(cardsJson, null, 2));

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`Generated ${cards.length} cards`);
  console.log(`Audio files copied to: content/audio/`);
  console.log(`Cards written to: content/cards.json`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review content/cards.json');
  console.log('  2. git add content/');
  console.log('  3. git commit -m "Add flashcard content"');
  console.log('  4. git push');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
