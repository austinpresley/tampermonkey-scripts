#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function git(args, errorMessage) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    fail(errorMessage);
  }
}

function encodedPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: npm run test-url -- <slug>');
  process.exit(0);
}
if (args.length !== 1) fail('Usage: npm run test-url -- <slug>');

const [packageJson, manifest] = await Promise.all([
  readFile(resolve(root, 'package.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'userscripts.json'), 'utf8').then(JSON.parse),
]);
const config = packageJson.userscriptRepository;
if (!config?.owner || !config?.name || !config?.defaultBranch) {
  fail('package.json must define userscriptRepository.owner, name, and defaultBranch.');
}

const [slug] = args;
const entry = manifest.userscripts?.find((candidate) => candidate.slug === slug);
if (!entry) fail(`Unknown userscript slug: ${slug}`);

const branch = git(
  ['branch', '--show-current'],
  'Could not read the current Git branch.',
);
if (!branch) fail('Create or switch to a focused branch before generating a test URL.');
if (branch === config.defaultBranch) {
  fail(`Test builds must use a focused branch, not ${config.defaultBranch}.`);
}

const dirtyScript = git(
  ['status', '--porcelain', '--', entry.path],
  `Could not check ${entry.path}.`,
);
if (dirtyScript) fail(`Commit ${entry.path} before generating its test URL.`);

git(
  ['cat-file', '-e', `HEAD:${entry.path}`],
  `Commit ${entry.path} before generating its test URL.`,
);

const expectedUpstream = `origin/${branch}`;
const upstream = git(
  ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
  `Push ${branch} to origin and set its upstream before generating a test URL.`,
);
if (upstream !== expectedUpstream) {
  fail(`The current branch must track ${expectedUpstream}; it tracks ${upstream}.`);
}

const localCommit = git(['rev-parse', 'HEAD'], 'Could not read the local commit.');
const pushedCommit = git(
  ['rev-parse', '@{upstream}'],
  `Could not read the pushed commit for ${branch}.`,
);
if (localCommit !== pushedCommit) {
  fail(`Push ${branch} before generating a test URL. Local HEAD does not match ${upstream}.`);
}

const url = [
  'https://raw.githubusercontent.com',
  encodeURIComponent(config.owner),
  encodeURIComponent(config.name),
  'refs/heads',
  encodedPath(branch),
  encodedPath(entry.path),
].join('/');

console.log(`${entry.name} test install:`);
console.log(`${url}?v=${localCommit.slice(0, 12)}`);
