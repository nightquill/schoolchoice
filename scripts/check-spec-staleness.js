#!/usr/bin/env node
/**
 * Spec Staleness Checker
 *
 * Compares git modification times of spec files vs the source files they track.
 * If a tracked source file was modified more recently than its spec, flags it as potentially stale.
 *
 * Usage:
 *   node scripts/check-spec-staleness.js          # Check all specs
 *   node scripts/check-spec-staleness.js --ci      # Exit code 1 if any stale (for CI)
 *
 * Each spec file must contain a comment like:
 *   <!-- spec-tracks: file1.js, file2.py, file3.jsx -->
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SPEC_DIR = path.join(__dirname, '..', 'docs', 'spec');
const ROOT = path.join(__dirname, '..');
const ciMode = process.argv.includes('--ci');

function getLastCommitTime(filePath) {
  try {
    const result = execSync(
      `git log -1 --format=%ct -- "${filePath}"`,
      { cwd: ROOT, encoding: 'utf8' }
    ).trim();
    return result ? parseInt(result, 10) : 0;
  } catch {
    return 0;
  }
}

function extractTrackedFiles(specContent) {
  const match = specContent.match(/<!--\s*spec-tracks:\s*(.+?)\s*-->/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map(f => f.trim())
    .filter(f => f.length > 0);
}

function main() {
  const specFiles = fs.readdirSync(SPEC_DIR).filter(f => f.endsWith('.md') && f !== 'INDEX.md');
  let staleCount = 0;
  const results = [];

  for (const specFile of specFiles) {
    const specPath = path.join(SPEC_DIR, specFile);
    const specContent = fs.readFileSync(specPath, 'utf8');
    const trackedFiles = extractTrackedFiles(specContent);

    if (trackedFiles.length === 0) {
      results.push({ spec: specFile, status: 'NO_TRACKING', files: [] });
      continue;
    }

    const specTime = getLastCommitTime(path.join('docs', 'spec', specFile));
    const staleFiles = [];

    for (const tracked of trackedFiles) {
      const trackedTime = getLastCommitTime(tracked);
      if (trackedTime > specTime) {
        staleFiles.push({ file: tracked, sourceTime: trackedTime, specTime });
      }
    }

    if (staleFiles.length > 0) {
      staleCount++;
      results.push({ spec: specFile, status: 'STALE', files: staleFiles });
    } else {
      results.push({ spec: specFile, status: 'OK', files: [] });
    }
  }

  // Output
  console.log('\n📋 Spec Staleness Report\n');
  console.log(`${'Spec File'.padEnd(30)} ${'Status'.padEnd(12)} Stale Sources`);
  console.log('-'.repeat(80));

  for (const r of results) {
    const icon = r.status === 'OK' ? '✅' : r.status === 'STALE' ? '⚠️ ' : '❓';
    const staleList = r.files.map(f => f.file).join(', ');
    console.log(`${icon} ${r.spec.padEnd(28)} ${r.status.padEnd(12)} ${staleList}`);
  }

  console.log(`\n${staleCount === 0 ? '✅ All specs up to date.' : `⚠️  ${staleCount} spec(s) may be stale.`}\n`);

  if (ciMode && staleCount > 0) {
    process.exit(1);
  }
}

main();
