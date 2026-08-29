# Headless Codex maintenance

This repository supports user-directed interactive work and narrowly scoped non-interactive work. This setup does not enable a launch daemon, scheduler, automatic pull-request merge, or unattended publication.

## Mode 1: interactive Codex over SSH

SSH into the Mac, enter this repository, and start Codex normally. A cached ChatGPT login can support ongoing interactive use. Check both required sessions before work:

```sh
codex login status
gh auth status
```

If Codex needs authentication on a headless session, prefer the supported device-code flow:

```sh
codex login --device-auth
```

Complete login directly on a trusted device. Never paste credentials into a task or commit them.

## Mode 2: non-interactive `codex exec`

Use this for trusted, focused, repeatable tasks. `codex exec` is read-only by default. Select edit access explicitly and use the least privilege needed:

```sh
codex exec --sandbox workspace-write "Run npm test, fix only userscript validation defects, and summarize the changes"
```

Reserve `danger-full-access` for separately approved, controlled environments. Do not expose a Codex execution endpoint to untrusted users.

For programmatic workflows such as private CI, API-key authentication is the recommended default. An eligible ChatGPT Enterprise workspace may instead provide a Codex access token for trusted automation. Enter credentials directly on the Mac using supported login input; do not include them in prompts, logs, shell history, or repository files.

## Credential safety

- Check the active method with `codex login status`.
- Check GitHub access with `gh auth status`.
- Do not copy cached credential files between machines as part of this repository workflow.
- Never commit anything from `~/.codex`; cached credentials must be treated like passwords.
- Keep tasks narrow and run `npm test` before proposing a commit.

Current official guidance: [Codex authentication](https://learn.chatgpt.com/docs/auth) and [non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode).

## Test on another computer

When the browser used for testing is not on the headless machine, follow the repository's [cross-device testing workflow](REMOTE_TESTING.md). It uses a pushed feature branch and a direct Tampermonkey install URL, so script size does not matter.
