import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export interface InboxItem {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
  readonly createdAt: string;
}

export interface DumpState {
  readonly inbox: readonly InboxItem[];
  readonly updatedAt: string;
}

export const EMPTY_STATE: DumpState = {
  inbox: [],
  updatedAt: new Date(0).toISOString(),
};

export const MAX_ITEM_LENGTH = 2_000;
export const MAX_INBOX_ITEMS = 500;

export const DUMP_REL = ".cursor/rules/scratchpad.mdc";
export const CURRENT_TASK_REL = ".cursor/rules/current_task.mdc";

const RULES_DIR = path.join(".cursor", "rules");
const EXCLUDE_MARKERS = [DUMP_REL, CURRENT_TASK_REL];

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
        "No workspace folder is open. Open a folder to dump thoughts for that project.",
      );
    }
    return root;
  }

  public async ensureProjectStore(): Promise<void> {
    const root = this.resolveRoot();
    await fs.mkdir(path.join(root, RULES_DIR), { recursive: true });
    await ensureLocalGitExclude(root);
    await seedFileIfMissing(path.join(root, DUMP_REL), renderDump(EMPTY_STATE));
    await seedFileIfMissing(path.join(root, CURRENT_TASK_REL), renderCurrentTaskSeed());
  }

  public syncDump(state: DumpState): Promise<void> {
    const snapshot = cloneState(state);
    const run = (): Promise<void> => this.writeDump(snapshot);
    this.writeChain = this.writeChain.then(run, run);
    return this.writeChain;
  }

  public async readCurrentTask(): Promise<string> {
    const root = this.getRootSafe();
    if (!root) {
      return "";
    }

    try {
      const contents = await fs.readFile(path.join(root, CURRENT_TASK_REL), "utf8");
      return parseCurrentTask(contents);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return "";
      }
      throw toError(error);
    }
  }

  private async writeDump(state: DumpState): Promise<void> {
    const root = this.resolveRoot();
    await this.ensureProjectStore();
    try {
      await atomicWrite(path.join(root, DUMP_REL), renderDump(state));
    } catch (error) {
      throw new SyncError("Failed to write the thought dump.", [toError(error)]);
    }
  }
}

export function createInboxItem(text: string): InboxItem {
  const trimmed = sanitizeUserText(text);
  if (trimmed.length === 0) {
    throw new SyncError("Dumped thoughts cannot be empty.");
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

export function cloneState(state: DumpState): DumpState {
  return {
    inbox: state.inbox.map((item) => ({ ...item })),
    updatedAt: state.updatedAt,
  };
}

export function isDumpState(value: unknown): value is DumpState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<DumpState>;
  if (!Array.isArray(candidate.inbox)) {
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

export function parseCurrentTask(contents: string): string {
  const withoutFrontmatter = contents.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const nowMatch = /## Now\s*\r?\n+([\s\S]*?)(?=\r?\n## |\s*$)/.exec(withoutFrontmatter);
  const raw = (nowMatch?.[1] ?? withoutFrontmatter).trim();
  const withoutHeading = raw.replace(/^#.*$/m, "").trim();
  if (
    withoutHeading.length === 0 ||
    withoutHeading.startsWith("_No task recorded yet") ||
    withoutHeading === "_No task recorded yet._"
  ) {
    return "";
  }
  return sanitizeUserText(withoutHeading.replace(/\n+/g, " "));
}

function renderDump(state: DumpState): string {
  return withFrontmatter(
    "Thought dump — parked ideas from the human. Not the current task. Do not chase these unless asked.",
    [
      "# Scratchpad",
      "",
      "The human parks stray thoughts here while working. They are **not** the current task.",
      "",
      "Do not switch to dump items unless asked.",
      "",
      "You own `.cursor/rules/current_task.mdc`. As the actual work changes, rewrite that file so `## Now` matches what you are doing. Keep `alwaysApply: true` in its frontmatter. The human will not maintain it.",
      "",
      renderInboxMarkdown(state.inbox),
      "",
      renderFooter(state.updatedAt),
    ],
  );
}

function renderCurrentTaskSeed(): string {
  return withFrontmatter(
    "Current task for this project. The agent owns this file — update it as the work changes.",
    [
      "# Current task",
      "",
      "You own this file. Rewrite `## Now` whenever the work in this session changes. Do not wait for the human. Do not replace it with scratchpad dump items unless they asked you to.",
      "",
      "## Now",
      "",
      "_No task recorded yet. Set this on the first real piece of work._",
      "",
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
    return "_Nothing dumped yet._";
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

function renderFooter(updatedAt: string): string {
  return `_Last synced: ${updatedAt} by scratchpad_`;
}

async function seedFileIfMissing(filePath: string, contents: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw toError(error);
    }
    await atomicWrite(filePath, contents);
  }
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
  if (!next.includes("# scratchpad")) {
    next += "\n# scratchpad (local only, not committed)\n";
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
