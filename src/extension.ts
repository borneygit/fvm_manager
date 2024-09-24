import * as vscode from "vscode";
import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";

function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "fvm-manager" is now active!');

  const outputChannel = vscode.window.createOutputChannel("FVM Manager");
  const terminal = vscode.window.createTerminal("Fvm Manager");

  registerNormalCommands(context, outputChannel);
  registerInstallCommand(context, terminal);
  registerUseCommand(context, terminal);
  registerGlobalCommand(context, terminal);
}

function registerInstallCommand(
  context: vscode.ExtensionContext,
  terminal: vscode.Terminal
) {
  const disposable = vscode.commands.registerCommand("fvm.install", () => {
    let command = "dart pub global activate fvm";

    switch (process.platform) {
      case "win32":
        command = "choco install fvm";
        break;
      case "darwin":
        command = "curl -fsSL https://fvm.app/install.sh | bash";
        break;
      case "linux":
        command = "curl -fsSL https://fvm.app/install.sh | bash";
        break;
    }
    terminal.show();
    terminal.sendText(command);
  });

  context.subscriptions.push(disposable);
}

function registerUseCommand(
  context: vscode.ExtensionContext,
  terminal: vscode.Terminal
) {
  const disposable = vscode.commands.registerCommand("fvm.use", async () => {
    const input = await vscode.window.showInputBox({
      prompt: `Please enter input for the local flutter version:`,
      placeHolder: "Your input here",
      validateInput: (value) => {
        const versionRegex = /^\d+\.\d+\.\d+$/;
        return versionRegex.test(value)
          ? null
          : "Invalid version format. Use x.x.x";
      },
    });
    if (!input) {
      return;
    }
    const flutterVersion = input.trim();
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder is open.");
      return;
    }

    const vscodeDir = path.join(workspaceFolder, ".vscode");
    const ideaDir = path.join(workspaceFolder, ".idea");
    const settingsFile = path.join(vscodeDir, "settings.json");
    const workspaceFile = path.join(ideaDir, "workspace.xml");

    const config = vscode.workspace.getConfiguration("fvmManager");
    const createVscodeDir = config.get<boolean>("createVscodeDirectory", true);
    const createIdeaDir = config.get<boolean>("createIdeaDirectory", true);

    if (createVscodeDir) {
      if (!fs.existsSync(vscodeDir)) {
        fs.mkdirSync(vscodeDir); // 创建 .vscode 目录
      }

      let settings: Record<string, any> = {};
      if (fs.existsSync(settingsFile)) {
        settings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
      }

      settings["dart.flutterSdkPath"] = `.fvm/versions/${flutterVersion}`;

      fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    }
    if (createIdeaDir) {
      if (!fs.existsSync(ideaDir)) {
        fs.mkdirSync(ideaDir); // 创建 .idea 目录
      }
      let workspaceXmlContent = "";
      if (fs.existsSync(workspaceFile)) {
        workspaceXmlContent = fs.readFileSync(workspaceFile, "utf8");
      }

      // 定义需要插入的 XML 内容
      const vcsManagerConfig = `
  <component name="VcsManagerConfiguration">
    <ignored-roots>
      <path value="\$PROJECT_DIR\$/.fvm/flutter_sdk" />
    </ignored-roots>
  </component>`;

      // 如果 workspace.xml 文件存在，则修改它
      if (workspaceXmlContent) {
        if (
          !workspaceXmlContent.includes(
            '<component name="VcsManagerConfiguration">'
          )
        ) {
          // 在适当的位置插入新的内容
          const insertPosition = workspaceXmlContent.indexOf("</project>");
          workspaceXmlContent =
            workspaceXmlContent.substring(0, insertPosition) +
            vcsManagerConfig +
            workspaceXmlContent.substring(insertPosition);
        }
      } else {
        // 如果文件不存在，创建新的内容
        workspaceXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  ${vcsManagerConfig}
</project>`;
      }

      // 写回 workspace.xml 文件
      fs.writeFileSync(workspaceFile, workspaceXmlContent.trim());
    }

    const finalCommand = `fvm use ${flutterVersion}`;
    terminal.show();
    terminal.sendText(finalCommand);
  });

  context.subscriptions.push(disposable);
}

function registerGlobalCommand(
  context: vscode.ExtensionContext,
  terminal: vscode.Terminal
) {
  const disposable = vscode.commands.registerCommand("fvm.global", async () => {
    const input = await vscode.window.showInputBox({
      prompt: `Please enter input for the global flutter version:`,
      placeHolder: "Your input here",
      validateInput: (value) => {
        const versionRegex = /^\d+\.\d+\.\d+$/;
        return versionRegex.test(value)
          ? null
          : "Invalid version format. Use x.x.x";
      },
    });
    if (!input) {
      return;
    }
    const flutterVersion = input.trim();

    const finalCommand = `fvm global ${flutterVersion}`;
    terminal.show();
    terminal.sendText(finalCommand);
  });

  context.subscriptions.push(disposable);
}

function registerNormalCommands(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
) {
  registerCommand(
    context,
    outputChannel,
    "fvm.versions",
    "fvm list",
    "fvm list"
  );
  registerCommand(
    context,
    outputChannel,
    "fvm.releases",
    "fvm releases",
    "fvm releases"
  );
  registerCommand(
    context,
    outputChannel,
    "fvm.doctor",
    "fvm doctor",
    "fvm doctor"
  );
  registerCommand(context, outputChannel, "fvm.help", "fvm help", "fvm help");
}

function registerCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  command: string,
  execCommand: string,
  description: string,
  callback?: () => void,
  input?: () => Promise<string | undefined>
) {
  const disposable = vscode.commands.registerCommand(command, async () => {
    outputChannel.show(true);
    outputChannel.appendLine(`Starting command...`);

    let userInput: string | undefined = undefined;
    if (input) {
      userInput = await input();
    }

    const finalCommand = userInput
      ? `${execCommand} ${userInput}`
      : execCommand;

    const commands = exec(finalCommand);

    const ansiRegex =
      /[\u001b\u009b][[\]()#;?]*(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007|(?:\d{1,4}(?:;\d{0,4})*)?[a-zA-Z\d])/g;

    commands.stdout?.on("data", (data: { toString: () => string }) => {
      const cleanOutput = data.toString().replace(ansiRegex, ""); // 去除 ANSI 转义码
      const lines = cleanOutput.split("\n");
      lines.forEach((line: string) => {
        if (line.trim() !== "") {
          outputChannel.appendLine(line);
        }
      });
    });

    commands.stderr?.on("data", (data: { toString: () => any }) => {
      outputChannel.appendLine(`Error: ${data.toString()}`);
    });

    commands.on("close", (code: number) => {
      outputChannel.appendLine(`Command finished with exit code ${code}`);

      // 如果命令执行成功，则调用回调函数
      if (code === 0 && callback) {
        callback();
      }
    });

    commands.on("error", (err: { message: any }) => {
      outputChannel.appendLine(`Error executing command: ${err.message}`);
    });
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

export { activate, deactivate };
