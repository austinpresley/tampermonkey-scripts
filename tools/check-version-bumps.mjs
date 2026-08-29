#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const semverPattern = /^\d+\.\d+\.\d+$/;

function git(args, options = {}) {
  const { trim = true, ...execOptions } = options;
  const output = execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...execOptions,
  });
  return trim ? output.trim() : output;
}

function tryGit(args, options) {
  try {
    return git(args, options);
  } catch {
    return null;
  }
}

function versionFrom(source) {
  const match = source.match(/^\/\/\s+@version\s+(\S+)\s*$/m);
  return match?.[1] ?? null;
}

function compareVersions(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function eventBase() {
  if (!process.env.GITHUB_EVENT_PATH || !existsSync(process.env.GITHUB_EVENT_PATH)) return null;
  try {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    return event.pull_request?.base?.sha ?? (event.before && !/^0+$/.test(event.before) ? event.before : null);
  } catch {
    return null;
  }
}

function selectBase() {
  const explicitIndex = process.argv.indexOf('--base');
  const explicit = explicitIndex >= 0 ? process.argv[explicitIndex + 1] : null;
  const candidate = explicit ?? process.env.USERSCRIPT_BASE ?? eventBase();
  if (candidate) return tryGit(['rev-parse', '--verify', `${candidate}^{commit}`]);

  const branch = tryGit(['branch', '--show-current']);
  if (branch && branch !== 'main') {
    for (const mainRef of ['origin/main', 'main']) {
      const base = tryGit(['merge-base', 'HEAD', mainRef]);
      if (base) return base;
    }
  }
  if (tryGit(['status', '--porcelain'])) {
    return tryGit(['rev-parse', '--verify', 'HEAD']);
  }
  return tryGit(['rev-parse', '--verify', 'HEAD^']);
}

async function listUserscripts(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listUserscripts(path);
    return entry.isFile() && entry.name.endsWith('.user.js') ? [path] : [];
  }));
  return results.flat();
}

if (!tryGit(['rev-parse', '--is-inside-work-tree'])) {
  console.log('Version comparison skipped: this is not yet a Git worktree. New files are checked by the validator.');
  process.exit(0);
}

const base = selectBase();
if (!base) {
  console.log('Version comparison skipped: no usable Git base exists (expected on the first commit or a shallow clone).');
  process.exit(0);
}

const files = await listUserscripts(resolve(root, 'scripts'));
const failures = [];
let compared = 0;
let newFiles = 0;
for (const absolutePath of files) {
  const path = relative(root, absolutePath).split(sep).join('/');
  const previous = tryGit(['show', `${base}:${path}`], { trim: false });
  const current = await readFile(absolutePath, 'utf8');
  const currentVersion = versionFrom(current);
  if (!currentVersion || !semverPattern.test(currentVersion)) {
    failures.push(`${path}: current @version is missing or invalid.`);
    continue;
  }
  if (previous === null) {
    newFiles += 1;
    continue;
  }
  if (previous === current) continue;
  compared += 1;
  const previousVersion = versionFrom(previous);
  if (!previousVersion || !semverPattern.test(previousVersion)) {
    failures.push(`${path}: base revision has a missing or invalid @version; fix the repository history deliberately.`);
  } else if (compareVersions(currentVersion, previousVersion) <= 0) {
    failures.push(`${path}: content changed but @version ${currentVersion} is not greater than base version ${previousVersion}.`);
  }
}

if (failures.length) {
  console.error(`Version-bump validation failed against ${base.slice(0, 12)}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Version comparison passed against ${base.slice(0, 12)} (${compared} changed existing, ${newFiles} new).`);
