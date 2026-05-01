#!/usr/bin/env node
/**
 * Structural guard for src/main/log-service.ts disk writes vs CodeQL js/http-to-file-access.
 * Default GitHub CodeQL does not read .github/codeql/codeql-config.yml; keeping the sanitizer
 * call as the direct data argument helps the analyzer and documents intent.
 *
 * See .github/codeql/README.md (http-to-file-access, argument-level sinks).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '..', 'src', 'main', 'log-service.ts');

const REQUIRED_SNIPPETS = [
  ".appendFile(p, sanitizeLogPayloadForDisk(lines.join('')), 'utf8')",
  "fs.promises.appendFile(getLogFilePath(), sanitizeLogPayloadForDisk(line), 'utf8')",
  // writeFileSync options may be formatted across lines; require sanitizer at data argument.
  'fs.writeFileSync(getLogFilePath(), sanitizeLogPayloadForDisk(line)',
];

function main() {
  const src = fs.readFileSync(FILE, 'utf8');
  const missing = REQUIRED_SNIPPETS.filter((s) => !src.includes(s));
  if (missing.length === 0) {
    process.exit(0);
    return;
  }
  console.error('check-log-service-sinks: log-service.ts must keep disk sinks wrapped:\n');
  for (const s of missing) {
    console.error(`  missing: ${s}\n`);
  }
  console.error('See scripts/check-log-service-sinks.mjs header.');
  process.exit(1);
}

main();
