# Cursor Scratchpad

[![Open VSX](https://img.shields.io/open-vsx/v/ryanlockqr/scratchpad)](https://open-vsx.org/extension/ryanlockqr/scratchpad)
[![CI](https://github.com/ryanlockqr/cursor-scratchpad/actions/workflows/ci.yml/badge.svg)](https://github.com/ryanlockqr/cursor-scratchpad/actions/workflows/ci.yml)

Park the thought. Keep coding.

A Cursor sidebar for dumping stray ideas as you work. Chuck thoughts in. Stay on the task. Ask the agent to organize the dump when you want.

## Why

Mid-task ideas pull focus. Dump them here instead of chasing them. The agent is told not to chase the dump — and can triage it when you ask.

Per project. The dump stays off git. A small rule and organize skill are seeded so the agent knows what to do.

## Usage

Open the Scratchpad icon in the activity bar.

| You do | What happens |
| --- | --- |
| Type a thought, press **Enter** | Appends `- [ ]` to the dump |
| Check or Remove | Mark done or drop it |
| Ask the agent to organize / triage the dump | Uses the `organize-scratchpad` skill |

Command Palette: Quick Dump, Clear Dump.

## How it works

| Path | Role |
| --- | --- |
| `.cursor/scratchpad.md` | Parked thoughts (hidden from explorer; off git) |
| `.cursor/rules/scratchpad.mdc` | Don’t chase parked thoughts |
| `.cursor/skills/organize-scratchpad/SKILL.md` | Triage the dump on request |

The dump is a normal markdown file so the agent can read and rewrite it. Rule and skill can be committed if you want teammates to get the same agent behavior.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for develop and release steps.

## License

MIT. See [LICENSE](LICENSE).
