# ADHD Scratchpad

A zero-friction **capture inbox** and **focus anchor** for developers with ADHD or neurodivergent workflows. Dump the thought that just hijacked your attention, pin the one task you are actually doing, and keep coding.

The sidebar lives inside VS Code, Cursor, and Windsurf. Every change is written out as ordinary markdown so **any** AI agent working in the repo can ingest it — not just one proprietary chat panel.

## Why this exists

Context switching is expensive. Parking a stray idea in a chat thread, a sticky note, or a half-remembered mental stack is worse. ADHD Scratchpad is a dedicated capture surface that:

1. Gets the thought out of your head in one Enter keystroke.
2. Keeps a single **anchor task** visually and semantically separate from the inbox.
3. Broadcasts both to every common agent instruction file in the workspace, in real time.

Agents are instructed to protect the anchor and treat inbox items as parked context, not new goals.

## Universal sync map

On every inbox dump or anchor edit, the extension updates:

| Tool | Path | Format |
| --- | --- | --- |
| **Cursor** | `.cursor/rules/adhd_inbox.mdc` | `.mdc` with YAML frontmatter (`alwaysApply: true`) |
| **Cursor** | `.cursor/rules/adhd_anchor.mdc` | same |
| **Windsurf** | `.windsurf/rules/adhd_inbox.md` | `.md` with `trigger: always_on` |
| **Windsurf** | `.windsurf/rules/adhd_anchor.md` | same |
| **Zed, Aider, Codex, Copilot, …** | `AGENTS.md` | marked section, never a full-file overwrite |
| **Claude Code & Aider** | `CLAUDE.md` | marked section, never a full-file overwrite |

`AGENTS.md` and `CLAUDE.md` are patched between these markers so existing project instructions stay intact:

```markdown
<!-- ADHD-SCRATCHPAD:START -->
...generated inbox + anchor...
<!-- ADHD-SCRATCHPAD:END -->
```

There is no database. State for the sidebar is stored in VS Code `workspaceState`. Agent context is plain files.

## Install

### From source (development)

Requirements: Node.js 18+ and VS Code, Cursor, or Windsurf.

```bash
git clone https://github.com/ryanlockqr/context-scratchpad.git
cd context-scratchpad
npm install
```

Press **F5** (`Run Extension`) to launch an Extension Development Host. Open any project folder in that window and look for the Scratchpad icon in the activity bar.

### From a VSIX

```bash
npm install
npm run compile
npx @vscode/vsce package
```

Then `Extensions: Install from VSIX…` in the editor.

## Usage

1. Open a workspace folder (required — files are written into that root).
2. Open the **Scratchpad** view in the activity bar.
3. Type a stray thought in **Quick brain dump** and press **Enter**. It is appended as `- [ ]`.
4. Put the current job in **Active anchor task**. Agents are told this is the only active goal.
5. Optionally check off, remove, or **Focus** an inbox item to promote it to the anchor.

Command Palette extras:

- `ADHD Scratchpad: Quick Dump Thought`
- `ADHD Scratchpad: Set Focus Anchor`
- `ADHD Scratchpad: Clear Inbox`
- `ADHD Scratchpad: Clear Focus Anchor`
- `ADHD Scratchpad: Focus Sidebar`

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `adhdScratchpad.writeCursorRules` | `true` | Write `.cursor/rules/adhd_*.mdc` |
| `adhdScratchpad.writeWindsurfRules` | `true` | Write `.windsurf/rules/adhd_*.md` |
| `adhdScratchpad.writeAgentsMd` | `true` | Upsert the marked section in `AGENTS.md` |
| `adhdScratchpad.writeClaudeMd` | `true` | Upsert the marked section in `CLAUDE.md` |

## Privacy

Inbox thoughts and the anchor are written into the **project root**. If those thoughts should not be committed:

```gitignore
.cursor/rules/adhd_inbox.mdc
.cursor/rules/adhd_anchor.mdc
.windsurf/rules/adhd_inbox.md
.windsurf/rules/adhd_anchor.md
```

Keep `AGENTS.md` / `CLAUDE.md` if the rest of the file is shared; only the marked scratchpad block contains personal captures.

## Project layout

```
adhd-scratchpad/
├── package.json                 # Sidebar view container + commands
├── tsconfig.json
├── src/
│   ├── extension.ts             # Activation, folder bootstrap, commands
│   ├── syncEngine.ts            # Formats and writes universal agent files
│   └── adhdWebviewProvider.ts   # Native-themed capture UI
├── media/icon.svg               # Activity bar icon
└── README.md
```

## Development

```bash
npm install
npm run watch
```

Then F5. `src/` compiles to `out/`.

## License

MIT. See [LICENSE](LICENSE).
