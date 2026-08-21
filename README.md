# Scratchpad

[![Open VSX](https://img.shields.io/open-vsx/v/ryanlockqr/scratchpad)](https://open-vsx.org/extension/ryanlockqr/scratchpad)
[![CI](https://github.com/ryanlockqr/cursor-scratchpad/actions/workflows/ci.yml/badge.svg)](https://github.com/ryanlockqr/cursor-scratchpad/actions/workflows/ci.yml)

Park the thought. Keep coding.

A Cursor sidebar for dumping stray ideas **as you work**. Chuck thoughts in. Stay on the task. Ask the agent to organize the dump when you want.

Built for **Cursor** (Open VSX). The dump feeds Cursor rules/skills so the agent can respect parked thoughts.

## Why

Heads fill up mid-task. If you chase the new thought, the original work dies. If you try to remember it, it sits there and pulls.

Dump it. Stay on the work. The agent is told not to chase the dump — and can triage it when you ask.

Per project. The dump is personal and stays off git. The small rule and organize skill are seeded into the project so the agent knows what to do.

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
| Ask the agent to organize / triage the dump | Uses the `organize-scratchpad` skill |

Command Palette: Quick Dump, Clear Dump.

## How it works

Three layers in the **open project folder**:

| Path | Who writes it | Role |
| --- | --- | --- |
| `.cursor/scratchpad.md` | Sidebar + agent | **Source of truth** for parked thoughts (hidden from explorer) |
| `.cursor/rules/scratchpad.mdc` | Extension (stable) | Always-on: don’t chase parked thoughts |
| `.cursor/skills/organize-scratchpad/SKILL.md` | Extension (stable) | On request: triage / clean up the dump |

Only the dump is added to **`.git/info/exclude`**. It is also hidden from the explorer/search so you manage thoughts in the sidebar, not as a loose markdown file. The sidebar always reads/writes that file, and reloads when the agent rewrites it. Rule and skill can be committed if you want teammates to get the same agent behavior.

Why a markdown file under `.cursor/`? The agent has to read and rewrite the dump with normal tools. Extension-only storage would hide it from Cursor’s agent. `.cursor/scratchpad.md` is project-local Cursor state: not a rule, not a skill — the inbox the rule/skill point at.

## Develop

```bash
npm install
```

Press **F5** to launch an Extension Development Host. Open a folder, dump a thought, and confirm `.cursor/scratchpad.md` plus the exclude entry, rule, and skill.

## Release

After a version lands on `main`, tag it. GitHub Actions packages the VSIX, publishes to Open VSX, and attaches the build to the GitHub release.

```bash
git tag v0.1.0
git push origin v0.1.0
```

Tag must match `package.json` `version`. First-time Open VSX setup: create publisher `ryanlockqr`, store `OVSX_PAT` as a GitHub Actions secret, then `npx ovsx create-namespace ryanlockqr -p "$OVSX_PAT"`.

## License

MIT. See [LICENSE](LICENSE).
