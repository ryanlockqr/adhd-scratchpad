# Changelog

## [0.1.1] - 2026-08-21

- Marketplace / UI name: **Cursor Scratchpad**

## [0.1.0] - 2026-08-18

- Scratchpad sidebar: Enter parks a thought as `- [ ]` while you work
- Dump file `.cursor/scratchpad.md` is the source of truth (sidebar reads/writes/watches it)
- Dump is hidden from explorer; sidebar is the UI
- Stable always-on rule: don’t chase parked thoughts
- `organize-scratchpad` skill for triage when asked
- Keep the dump off git via local `.git/info/exclude` (does not change `.gitignore`)
- Command Palette dump / clear commands
