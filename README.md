# ADHD Scratchpad

[![Open VSX](https://img.shields.io/open-vsx/v/ryanlockqr/adhd-scratchpad)](https://open-vsx.org/extension/ryanlockqr/adhd-scratchpad)
[![CI](https://github.com/ryanlockqr/context-scratchpad/actions/workflows/ci.yml/badge.svg)](https://github.com/ryanlockqr/context-scratchpad/actions/workflows/ci.yml)

A Cursor sidebar for ADHD / neurodivergent workflows: dump the thought that just hijacked your attention, pin the one task you are actually doing. Every change is written as always-on Cursor rules so the agent in this repo sees it.

## Install

1. In Cursor, open the Extensions view.
2. Search **ADHD Scratchpad**.
3. Install.

Listing: [open-vsx.org/extension/ryanlockqr/adhd-scratchpad](https://open-vsx.org/extension/ryanlockqr/adhd-scratchpad)

Open a project folder and use the Scratchpad icon in the activity bar.

## Usage

1. Open a workspace folder.
2. Dump a thought → press **Enter** (appends `- [ ]`).
3. Set the **Active anchor task** — Cursor is told this is the only current goal.
4. Check off, remove, or **Focus** an inbox item to promote it.

Command Palette: Quick Dump, Set Focus Anchor, Clear Inbox, Clear Focus Anchor.

## What it writes

| Path | Role |
| --- | --- |
| `.cursor/rules/adhd_inbox.mdc` | Parked thoughts (`alwaysApply: true`) |
| `.cursor/rules/adhd_anchor.mdc` | Current focus task (`alwaysApply: true`) |

If dumps should not be committed, gitignore those two files.

## Publish

Cursor installs from Open VSX. Tag `vX.Y.Z` → GitHub Actions publishes.

**Once:** create publisher `ryanlockqr` on [Open VSX](https://open-vsx.org/), add GitHub secret `OVSX_PAT`, then:

```bash
npx ovsx create-namespace ryanlockqr -p "$OVSX_PAT"
```

**Each release:** update `CHANGELOG.md`, then:

```bash
npm version patch
git push origin main --follow-tags
```

## Develop

```bash
npm install
```

Press **F5** to launch an Extension Development Host.

## License

MIT. See [LICENSE](LICENSE).
