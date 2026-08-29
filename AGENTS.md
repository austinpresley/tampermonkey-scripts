# Agent-led repository instructions

This repository is agent-led: coding agents are the primary maintainers for routine implementation, validation, documentation, and pull-request preparation. Human authorization still controls merges, Greasy Fork publication, credentials, and consequential external actions.

Before editing, read `docs/DEVELOPMENT.md`, `userscripts.json`, and the affected script's README. Read the root `README.md` when a change affects the end-user experience.

- Keep each userscript at `scripts/<slug>/<slug>.user.js` and keep `userscripts.json` synchronized.
- Start scripts with `npm run new -- ...`; do not copy an existing script folder.
- Preserve a published script's `@name`, `@namespace`, license, and path unless a deliberate migration is approved.
- Increment `@version` for every publishable code or metadata change.
- Keep userscripts readable, unminified, unobfuscated, and compliant with Greasy Fork rules.
- Use the narrowest practical `@match`/`@include` patterns and Tampermonkey grants.
- Keep primary behavior in the submitted script; do not load remotely hosted executable code.
- Test affected behavior in proportion to risk and run `npm test` before committing.
- Never commit credentials, API keys, Greasy Fork cookies, webhook secrets, or cached Codex files.
- Use a focused branch and pull request for normal work. Do not merge without user authorization.
- For cross-device testing, follow [`docs/REMOTE_TESTING.md`](docs/REMOTE_TESTING.md). Deliver a tested, pushed non-`main` build with `npm run test-url -- <slug>` instead of stopping at a local path or pasting a large script into chat.
- Never push or merge a broken userscript, and never claim publication until Greasy Fork confirms it.

Only `main` is publishable. A push to `main` can notify Greasy Fork for already registered scripts.
