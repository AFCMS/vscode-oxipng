// SPDX-FileCopyrightText: 2024 AFCMS <afcm.contact@gmail.com>
// SPDX-License-Identifier: MIT

import path from "node:path";

import * as vscode from "vscode";

import { GitExtension, Repository } from "./types/git";
import { gitModifiedPNGs } from "./utils/git";
import { fileName, readDirectoryRecursivePNGs } from "./utils/files";
import { OxipngOptimiser, OxipngSavings, OxipngStripLevel } from "./optimiser";

/**
 * Returns a string describing the savings in bytes and percentage.
 */
function savingsString(s: OxipngSavings): string {
    return s.in_len >= s.out_len
        ? `${s.out_len} bytes (${(((s.in_len - s.out_len) / s.in_len) * 100).toFixed(2)}% smaller)`
        : `${s.out_len} bytes (${(((s.out_len - s.in_len) / s.in_len) * 100).toFixed(2)}% larger)`;
}

function savingsStringPercent(s: OxipngSavings): string {
    return s.in_len >= s.out_len
        ? `(${(((s.in_len - s.out_len) / s.in_len) * 100).toFixed(2)}% smaller)`
        : `(${(((s.out_len - s.in_len) / s.in_len) * 100).toFixed(2)}% larger)`;
}

function showNoOxipng() {
    vscode.window.showErrorMessage("Invalid Oxipng host configuration", "Edit", "Download").then((value) => {
        if (value === "Edit") {
            vscode.commands.executeCommand("workbench.action.openSettings", "oxipng.hostBinary");
        } else if (value === "Download") {
            vscode.env.openExternal(vscode.Uri.parse("https://github.com/oxipng/oxipng"));
        }
    });
}

export async function activate(context: vscode.ExtensionContext) {
    const gitExt = vscode.extensions.getExtension<GitExtension>("vscode.git")?.exports;

    const gitApi = gitExt?.getAPI(1);

    vscode.commands.executeCommand(
        "setContext",
        "oxipng.webOnly",
        context.extension.extensionKind === vscode.ExtensionKind.UI && vscode.env.uiKind === vscode.UIKind.Web
    );

    const api = new OxipngOptimiser(context);

    const commandCheckHostInstall = vscode.commands.registerCommand("oxipng.checkHostInstall", async () => {
        if (context.extension.extensionKind === vscode.ExtensionKind.UI && vscode.env.uiKind === vscode.UIKind.Web) {
            vscode.window.showErrorMessage("This command isn't available in the web editor");
            return;
        }

        const version = api.checkHostInstall();

        if (version) {
            vscode.window.showInformationMessage(`Oxipng version: ${version.major}.${version.minor}.${version.patch}`);
        } else {
            showNoOxipng();
            return;
        }
    });

    const commandOptimise = vscode.commands.registerCommand("oxipng.optimisePng", async (param: vscode.Uri) => {
        if (!api.checkHostInstall()) {
            showNoOxipng();
            return;
        }

        const savings = await api.optimiseFile(param, api.getConfig(param));

        vscode.window.showInformationMessage("Optimised: " + param.fsPath);
        vscode.window.showInformationMessage(savingsString(savings));
    });

    const commandOptimiseFolder = vscode.commands.registerCommand(
        "oxipng.optimisePngFolder",
        async (param: vscode.Uri) => {
            if (!api.checkHostInstall()) {
                showNoOxipng();
                return;
            }

            const files = await readDirectoryRecursivePNGs(param);

            const pngFilesCount = files.length;

            if (pngFilesCount === 0) {
                vscode.window.showInformationMessage("No PNGs found");
                return;
            }

            const overallSavings: OxipngSavings = { in_len: 0, out_len: 0 };

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: "Optimising PNGs" },
                async (progress) => {
                    progress.report({ increment: 0, message: "Starting..." });

                    for (let i = 0; i < pngFilesCount; i++) {
                        const file = files[i];
                        progress.report({
                            increment: 100 / pngFilesCount,
                            message: `(${i + 1}/${pngFilesCount}) ` + fileName(file),
                        });

                        const savings = await api.optimiseFile(file, api.getConfig(file));

                        overallSavings.in_len += savings.in_len;
                        overallSavings.out_len += savings.out_len;
                    }
                }
            );

            vscode.window.showInformationMessage(
                "Optimised " + pngFilesCount + " PNGs " + savingsStringPercent(overallSavings)
            );
        }
    );

    const commandOptimiseGitChanges = vscode.commands.registerCommand(
        "oxipng.optimisePngGitChanges",
        async (param: vscode.SourceControl | undefined) => {
            if (!api.checkHostInstall()) {
                showNoOxipng();
                return;
            }

            if (!gitApi) {
                vscode.window.showErrorMessage("Git extension isn't enabled");
                return;
            }

            let repo: Repository | undefined;

            if (param === undefined) {
                if (gitApi.repositories.length === 0) {
                    repo = undefined;
                } else if (gitApi.repositories.length === 1) {
                    repo = gitApi.repositories[0];
                } else {
                    // TODO: fancier picker
                    const result = await vscode.window.showQuickPick(
                        gitApi.repositories.map((repo) => repo.rootUri?.fsPath),
                        { canPickMany: false }
                    );

                    if (result) {
                        repo = gitApi.getRepository(vscode.Uri.file(result)) ?? undefined;
                    }
                }
            } else {
                repo = gitApi.getRepository(param.rootUri!) ?? undefined;
            }

            if (!repo) {
                vscode.window.showErrorMessage("No repository found");
                return;
            }

            const pngFiles = await gitModifiedPNGs(repo);
            const pngFilesCount = pngFiles.length;

            if (pngFilesCount === 0) {
                vscode.window.showInformationMessage("No PNGs found");
                return;
            }

            const overallSavings: OxipngSavings = { in_len: 0, out_len: 0 };

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: "Optimising PNGs" },
                async (progress) => {
                    progress.report({ increment: 0, message: "Starting..." });

                    for (let i = 0; i < pngFilesCount; i++) {
                        const file = pngFiles[i];
                        progress.report({
                            increment: 100 / pngFilesCount,
                            message: `(${i + 1}/${pngFilesCount}) ` + path.parse(file.fsPath).base,
                        });

                        const in_data = await vscode.workspace.fs.readFile(file);
                        const [out_data, savings] = await api.optimiseData(in_data, api.getConfig(file));

                        await new Promise((resolve) => setTimeout(resolve, 2000));

                        overallSavings.in_len += savings.in_len;
                        overallSavings.out_len += savings.out_len;

                        vscode.workspace.fs.writeFile(file, out_data);
                    }
                }
            );

            vscode.window.showInformationMessage(
                "Optimised " + pngFilesCount + " PNGs " + savingsStringPercent(overallSavings)
            );
        }
    );

    context.subscriptions.push(
        commandCheckHostInstall,
        commandOptimise,
        commandOptimiseFolder,
        commandOptimiseGitChanges
    );
}

export function deactivate() {}
