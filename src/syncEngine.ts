import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export interface InboxItem {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
  readonly createdAt: string;
}

export interface ScratchpadState {
  readonly inbox: readonly InboxItem[];
  readonly anchor: string;
  readonly updatedAt: string;
}

export interface SyncTargets {
  readonly writeCursorRules: boolean;
  readonly writeWindsurfRules: boolean;
  readonly writeAgentsMd: boolean;
  readonly writeClaudeMd: boolean;
}

export const EMPTY_STATE: ScratchpadState = {
  inbox: [],
  anchor: "",
  updatedAt: new Date(0).toISOString(),
};

export const MAX_ITEM_LENGTH = 2_000;
export const MAX_INBOX_ITEMS = 500;

const CURSOR_RULES_DIR = path.join(".cursor", "rules");
const WINDSURF_RULES_DIR = path.join(".windsurf", "rules");

const SECTION_START = "<!-- ADHD-SCRATCHPAD:START -->";
const SECTION_END = "<!-- ADHD-SCRATCHPAD:END -->";

const CHECKBOX_LINE = /^- \[([ xX])\] (.*)$/;

export class SyncError extends Error {
  public override readonly name = "SyncError";

  public constructor(
    message: string,
    public readonly causes: readonly Error[] = [],
  ) {
    super(message);
  }
}

/**
 * Formats inbox + anchor state and writes it to every supported agent
 * convention in the workspace root. No database — filesystem only.
 */
export class SyncEngine {
  private writeChain: Promise<void> = Promise.resolve();

  public constructor(private readonly getRoot: () => string | undefined) {}

  public getRootSafe(): string | undefined {
    return this.getRoot();
  }

  public resolveRoot(): string {
    const root = this.getRootSafe();
    if (!root) {
      throw new SyncError(
        "No workspace folder is open. Open a folder to sync ADHD Scratchpad files.",
      );
    }
    return root;
  }

  /**
   * Creates `.cursor/rules/` and `.windsurf/rules/` when missing.
   * Safe to call on every activation.
   */
  public async ensureRuleDirectories(): Promise<void> {
    const root = this.resolveRoot();
    await Promise.all([
      fs.mkdir(path.join(root, CURSOR_RULES_DIR), { recursive: true }),
      fs.mkdir(path.join(root, WINDSURF_RULES_DIR), { recursive: true }),
    ]);
  }

  /**
   * Serializes writes so rapid inbox dumps cannot interleave file updates.
   */
  public sync(state: ScratchpadState, targets: SyncTargets): Promise<void> {
    const snapshot = cloneState(state);
    const run = (): Promise<void> => this.writeAll(snapshot, targets);
    this.writeChain = this.writeChain.then(run, run);
    return this.writeChain;
  }

  /**
   * Best-effort restore when workspaceState is empty but generated files exist.
   */
  public async tryHydrateFromDisk(): Promise<ScratchpadState | undefined> {
    let root: string;
    try {
      root = this.resolveRoot();
    } catch {
      return undefined;
    }

    const inboxPath = path.join(root, CURSOR_RULES_DIR, "adhd_inbox.mdc");
    const anchorPath = path.join(root, CURSOR_RULES_DIR, "adhd_anchor.mdc");

    const [inboxRaw, anchorRaw] = await Promise.all([
      readIfExists(inboxPath),
      readIfExists(anchorPath),
    ]);

    if (inboxRaw === undefined && anchorRaw === undefined) {
      return undefined;
    }

    const inbox = inboxRaw ? parseInboxCheckboxes(inboxRaw) : [];
    const anchor = anchorRaw ? parseAnchorBody(anchorRaw) : "";

    if (inbox.length === 0 && anchor.length === 0) {
      return undefined;
    }

    return {
      inbox,
      anchor,
      updatedAt: new Date().toISOString(),
    };
  }

  private async writeAll(
    state: ScratchpadState,
    targets: SyncTargets,
  ): Promise<void> {
    const root = this.resolveRoot();
    await this.ensureRuleDirectories();

    const jobs: Array<Promise<void>> = [];

    if (targets.writeCursorRules) {
      jobs.push(
        atomicWrite(
          path.join(root, CURSOR_RULES_DIR, "adhd_inbox.mdc"),
          renderCursorInbox(state),
        ),
        atomicWrite(
          path.join(root, CURSOR_RULES_DIR, "adhd_anchor.mdc"),
          renderCursorAnchor(state),
        ),
      );
    }

    if (targets.writeWindsurfRules) {
      jobs.push(
        atomicWrite(
          path.join(root, WINDSURF_RULES_DIR, "adhd_inbox.md"),
          renderWindsurfInbox(state),
        ),
        atomicWrite(
          path.join(root, WINDSURF_RULES_DIR, "adhd_anchor.md"),
          renderWindsurfAnchor(state),
        ),
      );
    }

    if (targets.writeAgentsMd) {
      jobs.push(
        upsertMarkedSection(
          path.join(root, "AGENTS.md"),
          renderCombinedSection(state, "AGENTS.md"),
        ),
      );
    }

    if (targets.writeClaudeMd) {
      jobs.push(
        upsertMarkedSection(
          path.join(root, "CLAUDE.md"),
          renderCombinedSection(state, "CLAUDE.md"),
        ),
      );
    }

    const results = await Promise.allSettled(jobs);
    const failures = results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => toError(result.reason));

    if (failures.length > 0) {
      throw new SyncError(
        `Failed to write ${failures.length} ADHD Scratchpad file(s).`,
        failures,
      );
    }
  }
}

export function createInboxItem(text: string): InboxItem {
  const trimmed = sanitizeUserText(text);
  if (trimmed.length === 0) {
    throw new SyncError("Inbox thoughts cannot be empty.");
  }

  return {
    id: createId(),
    text: trimmed,
    done: false,
    createdAt: new Date().toISOString(),
  };
}

export function sanitizeUserText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(SECTION_START, "")
    .replace(SECTION_END, "")
    .trim()
    .slice(0, MAX_ITEM_LENGTH);
}

export function cloneState(state: ScratchpadState): ScratchpadState {
  return {
    inbox: state.inbox.map((item) => ({ ...item })),
    anchor: state.anchor,
    updatedAt: state.updatedAt,
  };
}

export function isScratchpadState(value: unknown): value is ScratchpadState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ScratchpadState>;
  if (!Array.isArray(candidate.inbox) || typeof candidate.anchor !== "string") {
    return false;
  }

  return candidate.inbox.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as InboxItem).id === "string" &&
      typeof (item as InboxItem).text === "string" &&
      typeof (item as InboxItem).done === "boolean" &&
      typeof (item as InboxItem).createdAt === "string",
  );
}

function renderCursorInbox(state: ScratchpadState): string {
  return [
    "---",
    "description: ADHD Scratchpad capture inbox — parked thoughts, not the current task. Do not context-switch to these unless the developer asks.",
    "alwaysApply: true",
    "---",
    "",
    "# ADHD Inbox",
    "",
    "Parked thoughts captured from the ADHD Scratchpad sidebar.",
    "Treat these as a holding area. The **Focus Anchor** is the active task.",
    "",
    renderInboxMarkdown(state.inbox),
    "",
    renderFooter(state.updatedAt),
    "",
  ].join("\n");
}

function renderCursorAnchor(state: ScratchpadState): string {
  return [
    "---",
    "description: ADHD Scratchpad focus anchor — the single task the developer is actively working on. Prioritize this over inbox items.",
    "alwaysApply: true",
    "---",
    "",
    "# ADHD Focus Anchor",
    "",
    "The developer is currently focused on **this** task.",
    "Do not switch to inbox items or invent a new goal unless they ask.",
    "",
    "## Current Anchor",
    "",
    "<!-- anchor:start -->",
    renderAnchorBody(state.anchor),
    "<!-- anchor:end -->",
    "",
    renderFooter(state.updatedAt),
    "",
  ].join("\n");
}

function renderWindsurfInbox(state: ScratchpadState): string {
  return [
    "---",
    "trigger: always_on",
    "description: ADHD Scratchpad capture inbox — parked thoughts, not the current task.",
    "---",
    "",
    "# ADHD Inbox",
    "",
    "Parked thoughts captured from the ADHD Scratchpad sidebar.",
    "Treat these as a holding area. The **Focus Anchor** is the active task.",
    "",
    renderInboxMarkdown(state.inbox),
    "",
    renderFooter(state.updatedAt),
    "",
  ].join("\n");
}

function renderWindsurfAnchor(state: ScratchpadState): string {
  return [
    "---",
    "trigger: always_on",
    "description: ADHD Scratchpad focus anchor — the single task the developer is actively working on.",
    "---",
    "",
    "# ADHD Focus Anchor",
    "",
    "The developer is currently focused on **this** task.",
    "Do not switch to inbox items or invent a new goal unless they ask.",
    "",
    "## Current Anchor",
    "",
    "<!-- anchor:start -->",
    renderAnchorBody(state.anchor),
    "<!-- anchor:end -->",
    "",
    renderFooter(state.updatedAt),
    "",
  ].join("\n");
}

function renderCombinedSection(state: ScratchpadState, filename: string): string {
  return [
    `# ADHD Scratchpad Context`,
    ``,
    `Auto-generated by the ADHD Scratchpad extension for \`${filename}\`.`,
    `Do not edit this section by hand — use the sidebar.`,
    ``,
    `## Focus Anchor`,
    ``,
    renderAnchorBody(state.anchor),
    ``,
    `## Inbox`,
    ``,
    renderInboxMarkdown(state.inbox),
    ``,
    renderFooter(state.updatedAt),
  ].join("\n");
}

function renderInboxMarkdown(inbox: readonly InboxItem[]): string {
  if (inbox.length === 0) {
    return "_Inbox is empty._";
  }

  const open = inbox.filter((item) => !item.done);
  const done = inbox.filter((item) => item.done);
  const blocks: string[] = [];

  if (open.length > 0) {
    blocks.push("### Open", "", ...open.map(toCheckboxLine));
  }

  if (done.length > 0) {
    if (blocks.length > 0) {
      blocks.push("");
    }
    blocks.push("### Done", "", ...done.map(toCheckboxLine));
  }

  return blocks.join("\n");
}

function toCheckboxLine(item: InboxItem): string {
  const mark = item.done ? "x" : " ";
  return `- [${mark}] ${flattenForMarkdown(item.text)}`;
}

function renderAnchorBody(anchor: string): string {
  const trimmed = sanitizeUserText(anchor);
  if (trimmed.length === 0) {
    return "_No active anchor set._";
  }
  return trimmed;
}

function renderFooter(updatedAt: string): string {
  return `_Last synced: ${updatedAt} by adhd-scratchpad_`;
}

function flattenForMarkdown(text: string): string {
  return text.replace(/\n+/g, " ").trim();
}

function parseInboxCheckboxes(raw: string): InboxItem[] {
  const items: InboxItem[] = [];
  for (const line of raw.split("\n")) {
    const match = CHECKBOX_LINE.exec(line);
    if (!match) {
      continue;
    }
    const mark = match[1] ?? " ";
    const text = sanitizeUserText(match[2] ?? "");
    if (text.length === 0) {
      continue;
    }
    items.push({
      id: createId(),
      text,
      done: mark !== " ",
      createdAt: new Date().toISOString(),
    });
    if (items.length >= MAX_INBOX_ITEMS) {
      break;
    }
  }
  return items;
}

function parseAnchorBody(raw: string): string {
  const start = raw.indexOf("<!-- anchor:start -->");
  const end = raw.indexOf("<!-- anchor:end -->");
  if (start === -1 || end === -1 || end <= start) {
    return "";
  }

  const inner = raw.slice(start + "<!-- anchor:start -->".length, end).trim();
  if (inner === "_No active anchor set._") {
    return "";
  }
  return sanitizeUserText(inner);
}

async function upsertMarkedSection(
  filePath: string,
  sectionBody: string,
): Promise<void> {
  const block = `${SECTION_START}\n${sectionBody.trim()}\n${SECTION_END}\n`;
  const existing = await readIfExists(filePath);

  if (existing === undefined || existing.trim().length === 0) {
    await atomicWrite(filePath, block);
    return;
  }

  const startIdx = existing.indexOf(SECTION_START);
  const endIdx = existing.indexOf(SECTION_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const after = existing.slice(endIdx + SECTION_END.length).replace(/^\n/, "");
    const next = existing.slice(0, startIdx) + block + after;
    await atomicWrite(filePath, next);
    return;
  }

  const prefix = existing.replace(/\s*$/, "\n\n");
  await atomicWrite(filePath, prefix + block);
}

async function atomicWrite(filePath: string, contents: string): Promise<void> {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });

  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random()
      .toString(36)
      .slice(2, 8)}.tmp`,
  );

  try {
    await fs.writeFile(tempPath, contents, { encoding: "utf8", flag: "wx" });
    try {
      await fs.rename(tempPath, filePath);
    } catch (renameError) {
      const err = toError(renameError);
      if (isWindowsRenameCollision(err)) {
        await fs.copyFile(tempPath, filePath);
        await fs.unlink(tempPath);
        return;
      }
      throw err;
    }
  } catch (error) {
    await fs.unlink(tempPath).catch(() => undefined);
    throw toError(error);
  }
}

function isWindowsRenameCollision(error: Error): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return os.platform() === "win32" && (code === "EPERM" || code === "EEXIST");
}

async function readIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return undefined;
    }
    throw toError(error);
  }
}

function createId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }
  return new Error(String(reason));
}
