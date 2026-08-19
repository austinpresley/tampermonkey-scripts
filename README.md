# Tampermonkey Scripts

Public monorepo for readable Tampermonkey userscripts whose published copies are synchronized by Greasy Fork from GitHub `main`.

The repository currently tracks four scripts already published under the [austinpresley Greasy Fork profile](https://greasyfork.org/en/users/1549077-austinpresley). Their one-time GitHub source-sync and repository webhook configuration remains pending.

## Layout

Each script lives at `scripts/<slug>/<slug>.user.js`, with its supporting notes at `scripts/<slug>/README.md`. `userscripts.json` is the inventory and publication-status record. Allowed statuses are:

- `draft`: under development; not publishable.
- `ready`: validated and intentionally prepared for its first Greasy Fork import.
- `published`: linked to a live Greasy Fork listing.

An exceptional namespace may be represented by `namespace` and a nonempty `namespaceReason` on its manifest entry. A non-MIT script license is recorded explicitly as `license`. Published names, namespaces, and paths should otherwise remain stable.

## Create a script

Start from the generator rather than copying a folder:

```sh
npm run new -- \
  --name "Example Name" \
  --slug example-name \
  --description "Describe the behavior precisely" \
  --match "https://example.com/*"
```

Repeat `--match` for multiple page patterns. Run `npm run new -- --help` for all options. The generator creates the script and README without overwriting an existing path and registers the script in `userscripts.json`.

The generated script begins at `1.0.0` unless `--version` is supplied. Replace the implementation placeholder, choose only the grants the code needs, document manual tests, and keep matches narrow.

## Validate

```sh
npm test
```

Validation checks the inventory, paths, userscript metadata, namespace, semantic versions, JavaScript syntax, placeholders, duplicates, and likely secrets. The version check compares changed existing userscripts with the available Git base and requires a strictly higher `@version`. New files may begin at any valid numeric semantic version.

Run an individual command when useful:

```sh
npm run validate
npm run check:versions
npm run raw-urls
```

## Versioning and publication

Every code or metadata change to an existing userscript that could be published needs a higher numeric semantic version (`MAJOR.MINOR.PATCH`). Use a focused branch and pull request for normal work. GitHub Actions runs `npm test`; the user reviews and authorizes merging.

Only `main` is a publication boundary. Merging to `main` makes the branch-based raw file current and can trigger Greasy Fork's repository webhook for scripts already registered there. GitHub Actions validates—it does not upload code to Greasy Fork.

`npm run raw-urls` prints each manifest entry's stable, branch-based raw URL. Never configure Greasy Fork with a commit-pinned URL.

## First-time Greasy Fork work

Every brand-new script must be imported manually once from its raw GitHub URL. After import, record its Greasy Fork ID and URL in the manifest and script README. The four existing listings need their source-sync URLs pointed at this repository before the webhook is enabled. See [docs/GREASY_FORK_SETUP.md](docs/GREASY_FORK_SETUP.md) for the exact checklist.

The root MIT license covers repository tooling and scripts marked MIT. Scripts whose metadata and manifest specify another license remain under that stated license.

For headless maintenance and safe `codex exec` examples, see [docs/HEADLESS_CODEX.md](docs/HEADLESS_CODEX.md).
