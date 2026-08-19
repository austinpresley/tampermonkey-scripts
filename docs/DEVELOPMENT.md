# Development and publishing

This repository is maintained primarily by coding agents under human direction. Agents handle routine implementation, validation, documentation, and pull-request preparation. A human retains control of merges, Greasy Fork publication, credentials, and other consequential external actions.

## Repository layout

Each script lives at `scripts/<slug>/<slug>.user.js`, with supporting notes at `scripts/<slug>/README.md`. `userscripts.json` is the inventory and publication-status record.

Allowed statuses are:

- `draft`: under development; not publishable.
- `ready`: validated and intentionally prepared for its first Greasy Fork import.
- `published`: linked to a live Greasy Fork listing.

An exceptional namespace requires `namespace` and a nonempty `namespaceReason` on its manifest entry. A non-MIT script license is recorded explicitly as `license`. Published names, namespaces, licenses, and paths remain stable unless a deliberate migration is approved.

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

New scripts begin at `1.0.0` unless `--version` is supplied. Replace the implementation placeholder, choose only necessary grants, document manual tests, and keep page matches narrow.

## Validate

```sh
npm test
```

Validation checks inventory agreement, paths, userscript metadata, namespaces, semantic versions, JavaScript syntax, placeholders, duplicates, Greasy Fork-managed URLs, and likely secrets. The version check compares changed existing scripts with the available Git base and requires a strictly higher `@version`.

Individual commands are also available:

```sh
npm run validate
npm run check:versions
npm run raw-urls
```

## Versioning and publication

Every executable or metadata change to an existing userscript needs a higher numeric semantic version (`MAJOR.MINOR.PATCH`). Normal work uses a focused branch and pull request. GitHub Actions runs `npm test`; a human reviews and authorizes merging.

Only `main` is publishable. Merging to `main` updates the branch-based raw source and can notify Greasy Fork for registered scripts. GitHub Actions validates the repository; it does not upload code to Greasy Fork.

`npm run raw-urls` prints every stable, branch-based source URL. Never configure Greasy Fork with a commit-pinned URL.

For source synchronization, webhook setup, and new-listing instructions, see [GREASY_FORK_SETUP.md](GREASY_FORK_SETUP.md). For safe headless agent operation, see [HEADLESS_CODEX.md](HEADLESS_CODEX.md). Repository-specific agent rules live in [`AGENTS.md`](../AGENTS.md).

## Licenses

Each userscript's metadata header governs that script. Repository tooling and scripts marked MIT are covered by the root MIT license. Scripts declaring another license remain under that stated license.
