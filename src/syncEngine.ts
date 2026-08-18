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

export const EMPTY_STATE: ScratchpadState = {
  inbox: [],
  anchor: "",
  updatedAt: new Date(0).toISOString(),
};

export const MAX_ITEM_LENGTH = 2_000;
export const MAX_INBOX_ITEMS = 500;

const RULES_DIR = path.join(".cursor", "rules");
const INBOX_REL = path.join(RULES_DIR, "adhd_inbox.mdc");
const ANCHOR_REL = path.join(RULES_DIR, "adhd_anchor.mdc");
const EXCLUDE_MARKERS = [INBOX_REL.replace(/\\/g, "/"), ANCHOR_REL.replace(/\\/g, "/")];

export class SyncError extends Error {
  public override readonly name = "SyncError";

  public constructor(
    message: string,
    public readonly causes: readonly Error[] = [],
  ) {
    super(message);
  }
}

export class SyncEngine {
  private writeChain: Promise<void> = Promise.resolve();

  public constructor(private readonly getWorkspace: () => string | undefined) {}

  public getRootSafe(): string | undefined {
    return this.getWorkspace();
  }

  public resolveRoot(): string {
    const root = this.getRootSafe();
    if (!root) {
      throw new SyncError(
        "No workspace folder is open. Open a folder to sync the scratchpad for that project.",
      );
    }
    return root;
  }

  public async ensureProjectStore(): Promise<void> {
    const root = this.resolveRoot();
    await fs.mkdir(path.join(root, RULES_DIR), { recursive: true });
    await ensureLocalGitExclude(root);
  }

  public sync(state: ScratchpadState): Promise<void> {
    const snapshot = cloneState(state);
    const run = (): Promise<void> => this.writeAll(snapshot);
    this.writeChain = this.writeChain.then(run, run);
    return this.writeChain;
  }

  private async writeAll(state: ScratchpadState): Promise<void> {
    const root = this.resolveRoot();
    await this.ensureProjectStore();

    const results = await Promise.allSettled([
      atomicWrite(path.join(root, INBOX_REL), renderInbox(state)),
      atomicWrite(path.join(root, ANCHOR_REL), renderAnchor(state)),
    ]);

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

function renderInbox(state: ScratchpadState): string {
  return withFrontmatter(
    "ADHD Scratchpad capture inbox — parked thoughts, not the current task.",
    [
      "# ADHD Inbox",
      "",
      "Parked thoughts. The **Focus Anchor** is the active task.",
      "",
      renderInboxMarkdown(state.inbox),
      "",
      renderFooter(state.updatedAt),
    ],
  );
}

function renderAnchor(state: ScratchpadState): string {
  return withFrontmatter(
    "ADHD Scratchpad focus anchor — the single task the developer is actively working on.",
    [
      "# ADHD Focus Anchor",
      "",
      "Prioritize this task. Do not switch to inbox items unless asked.",
      "",
      "## Current Anchor",
      "",
      renderAnchorBody(state.anchor),
      "",
      renderFooter(state.updatedAt),
    ],
  );
}

function withFrontmatter(description: string, body: string[]): string {
  return ["---", `description: ${description}`, "alwaysApply: true", "---", "", ...body, ""].join(
    "\n",
  );
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
  return `- [${item.done ? "x" : " "}] ${item.text.replace(/\n+/g, " ").trim()}`;
}

function renderAnchorBody(anchor: string): string {
  const trimmed = sanitizeUserText(anchor);
  return trimmed.length === 0 ? "_No active anchor set._" : trimmed;
}

function renderFooter(updatedAt: string): string {
  return `_Last synced: ${updatedAt} by adhd-scratchpad_`;
}

async function ensureLocalGitExclude(root: string): Promise<void> {
  const gitDir = await resolveGitDir(root);
  if (!gitDir) {
    return;
  }

  const excludePath = path.join(gitDir, "info", "exclude");
  await fs.mkdir(path.dirname(excludePath), { recursive: true });

  let existing = "";
  try {
    existing = await fs.readFile(excludePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw toError(error);
    }
  }

  const present = new Set(
    existing
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#")),
  );

  const missing = EXCLUDE_MARKERS.filter((line) => !present.has(line));
  if (missing.length === 0) {
    return;
  }

  let next = existing;
  if (next.length > 0 && !next.endsWith("\n")) {
    next += "\n";
  }
  if (!next.includes("# adhd-scratchpad")) {
    next += "\n# adhd-scratchpad (local only, not committed)\n";
  }
  next += `${missing.join("\n")}\n`;
  await atomicWrite(excludePath, next);
}

async function resolveGitDir(root: string): Promise<string | undefined> {
  const gitPath = path.join(root, ".git");
  try {
    const stat = await fs.stat(gitPath);
    if (stat.isDirectory()) {
      return gitPath;
    }
    if (!stat.isFile()) {
      return undefined;
    }
    const text = await fs.readFile(gitPath, "utf8");
    const match = /^gitdir:\s*(.+)$/m.exec(text);
    if (!match?.[1]) {
      return undefined;
    }
    return path.resolve(root, match[1].trim());
  } catch {
    return undefined;
  }
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
      const code = (err as NodeJS.ErrnoException).code;
      if (os.platform() === "win32" && (code === "EPERM" || code === "EEXIST")) {
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

function createId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}
