# ADHD Scratchpad

[![Open VSX](https://img.shields.io/open-vsx/v/ryanlockqr/adhd-scratchpad)](https://open-vsx.org/extension/ryanlockqr/adhd-scratchpad)
[![CI](https://github.com/ryanlockqr/adhd-scratchpad/actions/workflows/ci.yml/badge.svg)](https://github.com/ryanlockqr/adhd-scratchpad/actions/workflows/ci.yml)

A tiny second brain for Cursor: dump the thought, lock the task.

Built for agent-assisted coding — when you want the model to stay on one job, and you need somewhere private to park everything else.

## Why

Cursor is good at chasing whatever you just typed. That is a problem if your head is faster than the task.

Scratchpad splits the two:

- **Dump** — capture a stray idea as a checkbox. It is out of your head. It is not the work.
- **Anchor** — one sentence for what you are actually finishing. Agents are told to protect that and ignore the inbox unless you ask.

Per project. Personal. The agent in that folder can read it. Git cannot.

## Install

Cursor pulls extensions from Open VSX.

1. Open the Extensions view.
2. Search **ADHD Scratchpad**.
3. Install, then open a project folder.

[open-vsx.org/extension/ryanlockqr/adhd-scratchpad](https://open-vsx.org/extension/ryanlockqr/adhd-scratchpad)

## Usage

Open the Scratchpad icon in the activity bar.

| You do | What happens |
| --- | --- |
| Type a thought, press **Enter** | Appends `- [ ]` to the inbox |
| Fill **Active anchor task** | Pins the current goal for the agent |
| Check / Remove / **Focus** | Done, drop it, or promote an inbox item to the anchor |

Command Palette: Quick Dump, Set Focus Anchor, Clear Inbox, Clear Focus Anchor.

## How it works

Writes two Cursor rules in the **open project folder**:

| Path | Role |
| --- | --- |
| `.cursor/rules/adhd_inbox.mdc` | Parked thoughts (`alwaysApply: true`) |
| `.cursor/rules/adhd_anchor.mdc` | Current focus (`alwaysApply: true`) |

Those two paths are added to **`.git/info/exclude`** — your local ignore list, not a commit. Shared `.cursor/rules` stay shared. The project `.gitignore` is left alone. Teammates never see your dumps.

UI state lives in Cursor `workspaceState` for that folder. No account, no database, no extra editor targets.

## Develop

```bash
npm install
```

Press **F5** to launch an Extension Development Host. Open a folder in that window, dump a thought, and confirm the two `.mdc` files plus the exclude entries.

## Release

After a version lands on `main`, tag it. GitHub Actions packages the VSIX, publishes to Open VSX, and attaches the build to the GitHub release.

```bash
git tag v0.1.0
git push origin v0.1.0
```

Tag must match `package.json` `version`. First-time Open VSX setup: create publisher `ryanlockqr`, store `OVSX_PAT` as a GitHub Actions secret, then `npx ovsx create-namespace ryanlockqr -p "$OVSX_PAT"`.

## License

MIT. See [LICENSE](LICENSE).
