# ADHD Scratchpad

[![Open VSX](https://img.shields.io/open-vsx/v/ryanlockqr/adhd-scratchpad)](https://open-vsx.org/extension/ryanlockqr/adhd-scratchpad)
[![CI](https://github.com/ryanlockqr/adhd-scratchpad/actions/workflows/ci.yml/badge.svg)](https://github.com/ryanlockqr/adhd-scratchpad/actions/workflows/ci.yml)

A Cursor sidebar for ADHD workflows: dump the thought that just hijacked your attention, pin the one task you are actually doing. Per project, personal — Cursor reads it, git does not.

## Install

1. In Cursor, open the Extensions view.
2. Search **ADHD Scratchpad**.
3. Install.

Listing: [open-vsx.org/extension/ryanlockqr/adhd-scratchpad](https://open-vsx.org/extension/ryanlockqr/adhd-scratchpad)

Open a project folder and use the Scratchpad icon in the activity bar.

## Usage

1. Open the project folder you are working in.
2. Open the Scratchpad icon in the activity bar.
3. Dump a thought → press **Enter** (appends `- [ ]`).
4. Set the **Active anchor task** — the agent is told this is the only current goal.
5. Check off, remove, or **Focus** an inbox item to promote it.

Command Palette: Quick Dump, Set Focus Anchor, Clear Inbox, Clear Focus Anchor.

## What it writes

In **that project folder** (so this repo’s agent sees it):

| Path | Role |
| --- | --- |
| `.cursor/rules/adhd_inbox.mdc` | Parked thoughts (`alwaysApply: true`) |
| `.cursor/rules/adhd_anchor.mdc` | Current focus (`alwaysApply: true`) |

Those two files are added to **`.git/info/exclude`** (your local git ignore, not committed). Other `.cursor/rules` stay normal shared rules. Teammates never get your dumps. The project `.gitignore` is left alone.

## Publish

Cursor installs from Open VSX. After a version lands on `main`, tag it; GitHub Actions publishes.

**Once:** create publisher `ryanlockqr` on [Open VSX](https://open-vsx.org/), add GitHub secret `OVSX_PAT`, then:

```bash
npx ovsx create-namespace ryanlockqr -p "$OVSX_PAT"
```

**Each release:** bump `version` in `package.json`, update `CHANGELOG.md`, merge to `main`, then:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Develop

```bash
npm install
```

Press **F5** to launch an Extension Development Host.

## License

MIT. See [LICENSE](LICENSE).
