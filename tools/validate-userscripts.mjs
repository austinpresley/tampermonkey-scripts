#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptsRoot = resolve(root, 'scripts');
const errors = [];
const semverPattern = /^\d+\.\d+\.\d+$/;

function report(file, message) {
  errors.push(`${file}: ${message}`);
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    if (entry.isDirectory() && ['.git', 'node_modules'].includes(entry.name)) return [];
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    return entry.isFile() ? [path] : [];
  }));
  return nested.flat();
}

function parseMetadata(source, file) {
  const starts = [...source.matchAll(/^\/\/ ==UserScript==\s*$/gm)];
  const ends = [...source.matchAll(/^\/\/ ==\/UserScript==\s*$/gm)];
  if (starts.length !== 1 || ends.length !== 1 || ends[0]?.index <= starts[0]?.index) {
    report(file, 'must contain exactly one valid userscript metadata block.');
    return null;
  }
  const block = source.slice(starts[0].index, ends[0].index + ends[0][0].length);
  const metadata = new Map();
  for (const match of block.matchAll(/^\/\/\s+@(\S+)\s*(.*)$/gm)) {
    const [, key, value] = match;
    const existing = metadata.get(key) ?? [];
    existing.push(value.trim());
    metadata.set(key, existing);
  }
  return metadata;
}

function oneValue(metadata, key, file) {
  const values = metadata.get(key) ?? [];
  if (values.length !== 1 || !values[0]) {
    report(file, `must contain exactly one nonempty @${key}.`);
    return null;
  }
  return values[0];
}

const [packageJson, manifest, allProjectFiles] = await Promise.all([
  readFile(resolve(root, 'package.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'userscripts.json'), 'utf8').then(JSON.parse),
  listFiles(root),
]);

if (!Array.isArray(manifest.allowedStatuses) || !manifest.allowedStatuses.length) {
  report('userscripts.json', 'allowedStatuses must be a nonempty array.');
}
if (!Array.isArray(manifest.userscripts)) {
  report('userscripts.json', 'userscripts must be an array.');
  manifest.userscripts = [];
}

const config = packageJson.userscriptRepository ?? {};
for (const key of ['owner', 'name', 'defaultBranch', 'namespace']) {
  if (!config[key]) report('package.json', `userscriptRepository.${key} is required.`);
}

for (const field of ['slug', 'name', 'path']) {
  const seen = new Map();
  for (const [index, entry] of manifest.userscripts.entries()) {
    const value = entry[field];
    if (!value) {
      report('userscripts.json', `entry ${index + 1} is missing ${field}.`);
    } else if (seen.has(value)) {
      report('userscripts.json', `duplicate ${field} "${value}" in entries ${seen.get(value) + 1} and ${index + 1}.`);
    } else {
      seen.set(value, index);
    }
  }
}

const manifestByPath = new Map();
for (const [index, entry] of manifest.userscripts.entries()) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug ?? '')) {
    report('userscripts.json', `entry ${index + 1} has an unsafe slug.`);
  }
  const expectedPath = `scripts/${entry.slug}/${entry.slug}.user.js`;
  if (entry.path !== expectedPath) {
    report('userscripts.json', `entry ${index + 1} path must be ${expectedPath}.`);
  }
  if (!manifest.allowedStatuses?.includes(entry.status)) {
    report('userscripts.json', `entry ${index + 1} has unsupported status "${entry.status}".`);
  }
  if (entry.status === 'published' && (!entry.greasyForkId || !entry.greasyForkUrl)) {
    report('userscripts.json', `entry ${index + 1} is published but lacks its Greasy Fork ID or URL.`);
  }
  if (entry.namespace && !entry.namespaceReason?.trim()) {
    report('userscripts.json', `entry ${index + 1} needs namespaceReason when overriding the default namespace.`);
  }
  manifestByPath.set(entry.path, entry);
}

const userscriptFiles = allProjectFiles
  .filter((path) => path.endsWith('.user.js'))
  .map((path) => relative(root, path).split(sep).join('/'))
  .sort();

for (const relativePath of userscriptFiles) {
  const parts = relativePath.split('/');
  const file = parts.at(-1);
  const slug = parts.at(-2);
  if (parts.length !== 3 || parts[0] !== 'scripts' || file !== `${slug}.user.js` || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    report(relativePath, 'must be located at scripts/<slug>/<slug>.user.js using a safe slug.');
  }

  const entry = manifestByPath.get(relativePath);
  if (!entry) report(relativePath, 'is missing from userscripts.json.');
  const source = await readFile(resolve(root, relativePath), 'utf8');
  const metadata = parseMetadata(source, relativePath);
  if (!metadata) continue;

  const name = oneValue(metadata, 'name', relativePath);
  const namespace = oneValue(metadata, 'namespace', relativePath);
  const version = oneValue(metadata, 'version', relativePath);
  const description = oneValue(metadata, 'description', relativePath);
  const license = oneValue(metadata, 'license', relativePath);
  const pagePatterns = [...(metadata.get('match') ?? []), ...(metadata.get('include') ?? [])];
  if (!pagePatterns.length || pagePatterns.some((value) => !value)) {
    report(relativePath, 'must contain at least one nonempty @match or @include.');
  }
  if (name && entry && name !== entry.name) report(relativePath, `@name must agree with manifest name "${entry.name}".`);
  const expectedNamespace = entry?.namespace ?? config.namespace;
  if (namespace && namespace !== expectedNamespace) {
    report(relativePath, `@namespace must be "${expectedNamespace}" or use a documented manifest override.`);
  }
  if (version && !semverPattern.test(version)) report(relativePath, '@version must use numeric semantic version format, such as 1.0.0.');
  if (description && /^(?:todo|tbd|description|script_description)$/i.test(description)) report(relativePath, '@description is still a placeholder.');
  const expectedLicense = entry?.license ?? 'MIT';
  if (license && license !== expectedLicense) report(relativePath, `@license must agree with manifest license "${expectedLicense}".`);
  for (const managedUrl of ['downloadURL', 'updateURL', 'installURL']) {
    if (metadata.has(managedUrl)) report(relativePath, `must not define @${managedUrl}; Greasy Fork manages installed update URLs.`);
  }
  if ((metadata.get('author') ?? []).some((value) => /^(?:you|your name|author)$/i.test(value))) {
    report(relativePath, '@author contains a placeholder value.');
  }

  const unresolvedTemplate = /(?:\{\{[A-Z_]+\}\}|SCRIPT_NAME|SCRIPT_DESCRIPTION|MATCH_PATTERN|REPOSITORY_(?:NAMESPACE|URL))/i;
  if (unresolvedTemplate.test(source)) report(relativePath, 'contains an unresolved template placeholder.');
  if (entry?.status !== 'draft' && /IMPLEMENTATION GOES HERE/i.test(source)) {
    report(relativePath, 'contains an implementation placeholder but is marked publishable.');
  }

  const syntax = spawnSync(process.execPath, ['--check', resolve(root, relativePath)], { encoding: 'utf8' });
  if (syntax.status !== 0) {
    const detail = (syntax.stderr || syntax.stdout).trim().split('\n').slice(-2).join(' ');
    report(relativePath, `JavaScript syntax check failed: ${detail}`);
  }
}

const filesystemPaths = new Set(userscriptFiles);
for (const entry of manifest.userscripts) {
  if (entry.path && !filesystemPaths.has(entry.path)) report('userscripts.json', `references missing file ${entry.path}.`);
}

const configExtensions = new Set(['.json', '.yml', '.yaml', '.toml', '.ini']);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[opusr]_[A-Za-z0-9_]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /(?:api[_-]?key|access[_-]?token|password|webhook[_-]?secret)\s*[:=]\s*["']?[A-Za-z0-9_./+-]{16,}/i,
];
for (const absolutePath of allProjectFiles) {
  const rel = relative(root, absolutePath).split(sep).join('/');
  if (rel.startsWith('.git/') || (!configExtensions.has(extname(rel)) && !rel.startsWith('.env'))) continue;
  const source = await readFile(absolutePath, 'utf8');
  if (secretPatterns.some((pattern) => pattern.test(source))) report(rel, 'appears to contain a committed secret or credential.');
}

if (errors.length) {
  console.error(`Userscript validation failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${userscriptFiles.length} userscript${userscriptFiles.length === 1 ? '' : 's'} and ${manifest.userscripts.length} manifest entr${manifest.userscripts.length === 1 ? 'y' : 'ies'}.`);
