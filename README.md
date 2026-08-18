# Scratchpad

[![Open VSX](https://img.shields.io/open-vsx/v/ryanlockqr/scratchpad)](https://open-vsx.org/extension/ryanlockqr/scratchpad)
[![CI](https://github.com/ryanlockqr/adhd-scratchpad/actions/workflows/ci.yml/badge.svg)](https://github.com/ryanlockqr/adhd-scratchpad/actions/workflows/ci.yml)

Park the thought. Keep coding.

A Cursor sidebar for dumping stray ideas **as you work**. You maintain the dump. The agent is told not to chase it.

## Why

Heads fill up mid-task. If you chase the new thought, the original work dies. If you try to remember it, it sits there and pulls.

Dump it. Stay on the work. The agent is told not to chase the dump.

Per project. Personal. The agent in that folder can read it. Git cannot.

## Install

Cursor pulls extensions from Open VSX.

1. Open the Extensions view.
2. Search **Scratchpad**.
3. Install, then open a project folder.

[open-vsx.org/extension/ryanlockqr/scratchpad](https://open-vsx.org/extension/ryanlockqr/scratchpad)

## Usage

Open the Scratchpad icon in the activity bar.

| You do | What happens |
| --- | --- |
| Type a thought, press **Enter** | Appends `- [ ]` to the dump |
| Check or Remove | Mark done or drop it |

Command Palette: Quick Dump, Clear Dump.

## How it works

Writes one Cursor rule in the **open project folder**:

| Path | Who writes it | Role |
| --- | --- | --- |
| `.cursor/rules/scratchpad.mdc` | You (via the sidebar) | Parked thoughts. Tells the agent not to chase them. |

That path is added to **`.git/info/exclude`** — your local ignore list, not a commit. Shared `.cursor/rules` stay shared. The project `.gitignore` is left alone.

## Develop

```bash
npm install
```

Press **F5** to launch an Extension Development Host. Open a folder, dump a thought, and confirm `scratchpad.mdc` plus the exclude entry.

## Release

After a version lands on `main`, tag it. GitHub Actions packages the VSIX, publishes to Open VSX, and attaches the build to the GitHub release.

```bash
git tag v0.1.0
git push origin v0.1.0
```

Tag must match `package.json` `version`. First-time Open VSX setup: create publisher `ryanlockqr`, store `OVSX_PAT` as a GitHub Actions secret, then `npx ovsx create-namespace ryanlockqr -p "$OVSX_PAT"`.

## License

MIT. See [LICENSE](LICENSE).
