#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function usage() {
  console.log(`Usage:
  npm run new -- --name "Script Name" --slug script-slug \\
    --description "What the script does" --match "https://example.com/*"

Options:
  --name <text>          Human-readable script name (required)
  --slug <slug>          Lowercase letters, digits, and single hyphens (required)
  --description <text>   Nonempty description (required)
  --match <pattern>      Page match; repeat for multiple patterns (required)
  --version <semver>     Initial version (default: 1.0.0)
  --status <status>      draft, ready, or published (default: draft)
  --help                 Show this help
`);
}

function parseArgs(args) {
  const values = { matches: [], version: '1.0.0', status: 'draft' };
  const mapping = new Map([
    ['--name', 'name'],
    ['--slug', 'slug'],
    ['--description', 'description'],
    ['--version', 'version'],
    ['--status', 'status'],
  ]);

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') {
      usage();
      process.exit(0);
    }
    if (argument === '--match') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) fail('--match requires a value.');
      values.matches.push(value);
      index += 1;
      continue;
    }
    const key = mapping.get(argument);
    if (!key) fail(`Unknown argument: ${argument}. Run with --help for usage.`);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) fail(`${argument} requires a value.`);
    values[key] = value;
    index += 1;
  }
  return values;
}

function assertInput(input, allowedStatuses) {
  for (const field of ['name', 'slug', 'description']) {
    if (!input[field]?.trim()) fail(`--${field} is required and cannot be empty.`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    fail('--slug must contain lowercase letters or digits separated by single hyphens.');
  }
  if (!/^\d+\.\d+\.\d+$/.test(input.version)) {
    fail('--version must be a semantic version such as 1.0.0.');
  }
  if (!input.matches.length || input.matches.some((pattern) => !pattern.trim())) {
    fail('Provide at least one nonempty --match pattern.');
  }
  if (!allowedStatuses.includes(input.status)) {
    fail(`--status must be one of: ${allowedStatuses.join(', ')}.`);
  }
}

function replaceTemplate(template, replacements) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (placeholder, key) => {
    if (!(key in replacements)) fail(`Template contains unknown placeholder ${placeholder}.`);
    return replacements[key];
  });
}

function insertManifestEntry(source, entry) {
  const parsed = JSON.parse(source);
  if (!Array.isArray(parsed.userscripts)) fail('userscripts.json must contain a userscripts array.');
  const closingIndex = source.lastIndexOf(']');
  if (closingIndex === -1) fail('Could not find the userscripts array in userscripts.json.');

  const entryText = JSON.stringify(entry, null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
  const before = source.slice(0, closingIndex).replace(/\s*$/, '');
  const separator = parsed.userscripts.length === 0 ? '\n' : ',\n';
  return `${before}${separator}${entryText}\n${source.slice(closingIndex)}`;
}

const input = parseArgs(process.argv.slice(2));
const packagePath = resolve(root, 'package.json');
const manifestPath = resolve(root, 'userscripts.json');
const templatePath = resolve(root, 'templates/userscript.js.tpl');
const [packageJson, manifestSource, template] = await Promise.all([
  readFile(packagePath, 'utf8').then(JSON.parse),
  readFile(manifestPath, 'utf8'),
  readFile(templatePath, 'utf8'),
]);
const manifest = JSON.parse(manifestSource);
assertInput(input, manifest.allowedStatuses ?? []);

const config = packageJson.userscriptRepository;
for (const key of ['owner', 'name', 'defaultBranch', 'namespace']) {
  if (!config?.[key]) fail(`package.json userscriptRepository.${key} is required.`);
}

if (manifest.userscripts.some((entry) => entry.slug === input.slug)) {
  fail(`Manifest already contains slug "${input.slug}".`);
}
if (manifest.userscripts.some((entry) => entry.name === input.name)) {
  fail(`Manifest already contains name "${input.name}".`);
}

const relativePath = `scripts/${input.slug}/${input.slug}.user.js`;
const targetDirectory = resolve(root, 'scripts', input.slug);
const scriptPath = resolve(root, relativePath);
const readmePath = resolve(targetDirectory, 'README.md');
if (existsSync(targetDirectory) || existsSync(scriptPath) || existsSync(readmePath)) {
  fail(`Target already exists: ${targetDirectory}. Refusing to overwrite it.`);
}

const repositoryUrl = `https://github.com/${config.owner}/${config.name}`;
const matchLines = input.matches.map((pattern) => `// @match        ${pattern}`).join('\n');
const script = replaceTemplate(template, {
  NAME: input.name,
  NAMESPACE: config.namespace,
  VERSION: input.version,
  DESCRIPTION: input.description,
  MATCH_LINES: matchLines,
  SCRIPT_DIRECTORY_URL: `${repositoryUrl}/tree/${config.defaultBranch}/scripts/${input.slug}`,
  ISSUES_URL: `${repositoryUrl}/issues`,
});

const readme = `# ${input.name}

## Purpose

${input.description}

## Supported pages

${input.matches.map((pattern) => `- \`${pattern}\``).join('\n')}

## Testing notes

- [ ] Install the local file in Tampermonkey.
- [ ] Verify the expected behavior on every supported page pattern.
- [ ] Verify failure and edge cases from the script brief.

## Greasy Fork status

- Status: ${input.status}
- Listing: pending
- Raw source: [GitHub raw URL](${repositoryUrl.replace('https://github.com', 'https://raw.githubusercontent.com')}/${config.defaultBranch}/${relativePath})

Do not mark this script published until its Greasy Fork listing confirms publication.
`;

const entry = {
  slug: input.slug,
  name: input.name,
  path: relativePath,
  greasyForkId: null,
  greasyForkUrl: null,
  status: input.status,
};

await mkdir(targetDirectory);
try {
  await Promise.all([
    writeFile(scriptPath, script, { encoding: 'utf8', flag: 'wx' }),
    writeFile(readmePath, readme, { encoding: 'utf8', flag: 'wx' }),
  ]);
  await writeFile(manifestPath, insertManifestEntry(manifestSource, entry), {
    encoding: 'utf8',
    flag: 'w',
  });
} catch (error) {
  fail(`Creation stopped: ${error.message}. Inspect ${targetDirectory} before retrying.`);
}

console.log(`Created ${relativePath}`);
console.log(`Created scripts/${input.slug}/README.md`);
console.log('Updated userscripts.json');
console.log('Next: implement the script, update its README, and run npm test.');
