#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [packageJson, manifest] = await Promise.all([
  readFile(resolve(root, 'package.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'userscripts.json'), 'utf8').then(JSON.parse),
]);
const config = packageJson.userscriptRepository;
if (!config?.owner || !config?.name || !config?.defaultBranch) {
  console.error('package.json must define userscriptRepository.owner, name, and defaultBranch.');
  process.exit(1);
}
if (!Array.isArray(manifest.userscripts)) {
  console.error('userscripts.json must contain a userscripts array.');
  process.exit(1);
}
if (!manifest.userscripts.length) {
  console.log('No userscripts are registered yet. Create one with npm run new -- --help.');
  process.exit(0);
}

for (const entry of manifest.userscripts) {
  console.log(`${entry.name}: https://raw.githubusercontent.com/${config.owner}/${config.name}/${config.defaultBranch}/${entry.path}`);
}
