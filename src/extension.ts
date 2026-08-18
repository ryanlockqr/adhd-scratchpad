import * as vscode from "vscode";
import { AdhdWebviewProvider } from "./adhdWebviewProvider";
import { SyncEngine } from "./syncEngine";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const engine = new SyncEngine(() => resolveWorkspaceRoot());
  const provider = new AdhdWebviewProvider(
    context.extensionUri,
    engine,
    context.workspaceState,
  );

  await bootstrapProject(engine);

  try {
    await provider.initialize();
  } catch (error) {
    showActivationError(error);
  }

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AdhdWebviewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void (async () => {
        await bootstrapProject(engine);
        await provider.resync();
      })();
    }),
    vscode.commands.registerCommand("adhdScratchpad.focusSidebar", () => {
      provider.reveal();
    }),
    vscode.commands.registerCommand("adhdScratchpad.quickDump", async () => {
      const text = await vscode.window.showInputBox({
        title: "ADHD Scratchpad",
        prompt: "Park a thought. It will not become the focus anchor.",
        placeHolder: "that other idea I should not chase right now",
        ignoreFocusOut: true,
      });
      if (text !== undefined) {
        await provider.dumpThought(text);
      }
    }),
    vscode.commands.registerCommand("adhdScratchpad.setAnchor", async () => {
      const text = await vscode.window.showInputBox({
        title: "Set Focus Anchor",
        prompt: "What are you actually trying to finish right now?",
        ignoreFocusOut: true,
      });
      if (text !== undefined) {
        await provider.setAnchor(text);
      }
    }),
    vscode.commands.registerCommand("adhdScratchpad.clearInbox", async () => {
      const choice = await vscode.window.showWarningMessage(
        "Clear every parked thought in the ADHD inbox?",
        { modal: true },
        "Clear inbox",
      );
      if (choice === "Clear inbox") {
        await provider.clearInbox();
      }
    }),
    vscode.commands.registerCommand("adhdScratchpad.clearAnchor", async () => {
      await provider.clearAnchor();
    }),
  );
}

export function deactivate(): void {
  // No long-lived processes to tear down.
}

async function bootstrapProject(engine: SyncEngine): Promise<void> {
  try {
    await engine.ensureProjectStore();
  } catch (error) {
    if (error instanceof Error && error.message.includes("No workspace folder")) {
      return;
    }
    showActivationError(error);
  }
}

function resolveWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }

  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri) {
    const matched = vscode.workspace.getWorkspaceFolder(activeUri);
    if (matched) {
      return matched.uri.fsPath;
    }
  }

  return folders[0]?.uri.fsPath;
}

function showActivationError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  void vscode.window.showErrorMessage(`ADHD Scratchpad: ${message}`);
}
