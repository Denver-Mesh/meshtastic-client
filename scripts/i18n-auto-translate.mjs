#!/usr/bin/env node
/**
 * Auto-translate missing keys in non-English locale files.
 *
 * Supports backends:
 *   1. LibreTranslate  — set LIBRETRANSLATE_URL + optionally LIBRETRANSLATE_KEY
 *   2. MyMemory        — default; set MYMEMORY_EMAIL for 50 k words/day (free, no account)
 *
 * Usage:
 *   node scripts/i18n-auto-translate.mjs
 *   LIBRETRANSLATE_URL=https://lt.example.com LIBRETRANSLATE_KEY=xxx node scripts/i18n-auto-translate.mjs
 *   MYMEMORY_EMAIL=you@example.com node scripts/i18n-auto-translate.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '../src/renderer/locales');

const LT_URL = process.env.LIBRETRANSLATE_URL ?? '';
const LT_KEY = process.env.LIBRETRANSLATE_KEY ?? '';
const MM_EMAIL = process.env.MYMEMORY_EMAIL ?? '';

// Language code mappings for each backend
const LANG_CODES = [
  { dir: 'es', lt: 'es', mm: 'ES' },
  { dir: 'uk', lt: 'uk', mm: 'UK' },
  { dir: 'de', lt: 'de', mm: 'DE' },
  { dir: 'zh', lt: 'zh-Hans', mm: 'ZH' },
  { dir: 'pt-BR', lt: 'pt-BR', mm: 'PT-BR' },
  { dir: 'fr', lt: 'fr', mm: 'FR' },
  { dir: 'it', lt: 'it', mm: 'IT' },
  { dir: 'pl', lt: 'pl', mm: 'PL' },
  { dir: 'cs', lt: 'cs', mm: 'CS' },
  { dir: 'ja', lt: 'ja', mm: 'JA' },
  { dir: 'ru', lt: 'ru', mm: 'RU' },
  { dir: 'nl', lt: 'nl', mm: 'NL' },
  { dir: 'ko', lt: 'ko', mm: 'KO' },
  { dir: 'tr', lt: 'tr', mm: 'TR' },
  { dir: 'id', lt: 'id', mm: 'ID' },
];

// ── Utilities ─────────────────────────────────────────────────────────────────

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

function setDeep(obj, dotKey, value) {
  const parts = dotKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === undefined || typeof cur[parts[i]] !== 'object') {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function stripPlaceholders(str) {
  const placeholders = [];
  const stripped = str.replace(/\{\{[^}]+\}\}/g, (m) => {
    const idx = placeholders.length;
    placeholders.push(m);
    return `__PH${idx}__`;
  });
  return { stripped, placeholders };
}

function restorePlaceholders(str, placeholders) {
  return str.replace(/__PH(\d+)__/g, (_, idx) => placeholders[Number(idx)] ?? '');
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

// Small delay to be kind to free APIs
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── LibreTranslate backend ────────────────────────────────────────────────────

async function translateLibreTranslate(text, targetLt) {
  const { stripped, placeholders } = stripPlaceholders(text);
  const body = {
    q: stripped,
    source: 'en',
    target: targetLt,
    format: 'text',
    ...(LT_KEY ? { api_key: LT_KEY } : {}),
  };
  const res = await fetch(`${LT_URL}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`LibreTranslate ${res.status}: ${txt}`);
  }
  const json = await res.json();
  return restorePlaceholders(json.translatedText ?? stripped, placeholders);
}

// ── MyMemory backend ──────────────────────────────────────────────────────────

async function translateMyMemory(text, targetMm) {
  const { stripped, placeholders } = stripPlaceholders(text);
  const params = new URLSearchParams({
    q: stripped,
    langpair: `en|${targetMm}`,
    ...(MM_EMAIL ? { de: MM_EMAIL } : {}),
  });
  const url = `https://api.mymemory.translated.net/get?${params.toString()}`;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const wait = attempt === 1 ? 60_000 : 120_000;
      console.log(`  Rate limited — waiting ${wait / 1000}s before retry ${attempt}…`);
      await sleep(wait);
    }
    const res = await fetch(url);
    if (res.status === 429) {
      lastErr = new Error(`MyMemory 429`);
      continue;
    }
    if (!res.ok) {
      throw new Error(`MyMemory ${res.status}`);
    }
    const json = await res.json();
    if (json.quotaFinished) {
      throw new Error(
        'MyMemory daily quota finished. ' +
          'Set MYMEMORY_EMAIL to your email address for 50 k words/day (free, no account needed). ' +
          'Or set LIBRETRANSLATE_URL + LIBRETRANSLATE_KEY to use a LibreTranslate instance.',
      );
    }
    const translated = json.responseData?.translatedText ?? stripped;
    return restorePlaceholders(translated, placeholders);
  }
  throw lastErr;
}

// ── Router ────────────────────────────────────────────────────────────────────

async function translate(text, lang) {
  if (LT_URL) {
    return translateLibreTranslate(text, lang.lt);
  }
  return translateMyMemory(text, lang.mm);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const enPath = join(LOCALES_DIR, 'en/translation.json');
  const en = readJson(enPath);
  const enFlat = flatten(en);
  const enKeys = Object.keys(enFlat);

  let anyMissing = false;
  let anyKeysFailed = false;
  const missingByLang = new Map();
  for (const lang of LANG_CODES) {
    const existing = flatten(readJson(join(LOCALES_DIR, `${lang.dir}/translation.json`)));
    const missing = enKeys.filter((k) => !(k in existing));
    if (missing.length > 0) {
      anyMissing = true;
      missingByLang.set(lang, { existing, missing });
    }
  }

  if (!anyMissing) {
    console.log('All translation files are up to date.');
    process.exit(0);
  }

  const backend = LT_URL ? `LibreTranslate (${LT_URL})` : 'MyMemory';
  console.log(`Using backend: ${backend}`);

  for (const [lang, { missing }] of missingByLang) {
    const target = readJson(join(LOCALES_DIR, `${lang.dir}/translation.json`));

    console.log(`Translating ${missing.length} key(s) for ${lang.dir}…`);
    let count = 0;
    let failed = 0;
    for (const key of missing) {
      const englishValue = enFlat[key];
      if (typeof englishValue !== 'string') continue;
      try {
        const translated = await translate(englishValue, lang);
        setDeep(target, key, translated);
        count++;
        await sleep(300);
      } catch (err) {
        console.error(`  Error translating "${key}" for ${lang.dir}: ${err.message}`);
        failed++;
      }
    }
    if (failed > 0) {
      anyKeysFailed = true;
      console.error(`  ${failed} key(s) failed for ${lang.dir} — run again to retry.`);
    }

    const outPath = join(LOCALES_DIR, `${lang.dir}/translation.json`);
    writeFileSync(outPath, JSON.stringify(target, null, 2) + '\n', 'utf8');
    console.log(`  Wrote ${count} translation(s) to ${outPath}`);
  }

  console.log('Done.');
  return anyKeysFailed;
}

main()
  .then((hadFailures) => {
    process.exit(hadFailures ? 1 : 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
