// SPDX-FileCopyrightText: 2024 AFCMS <afcm.contact@gmail.com>
// SPDX-License-Identifier: MIT

import path from "node:path";

import * as vscode from "vscode";

import { GitExtension, Repository } from "./types/git";
import { gitModifiedPNGs } from "./utils/git";
import { fileName, readDirectoryRecursivePNGs } from "./utils/files";
import { OxipngOptimiser, OxipngStripLevel } from "./optimiser";

/**
 * Returns a string describing the savings in bytes and percentage.
 */
function savingsString(in_len: number, out_len: number): string {
    return in_len >= out_len
        ? `${out_len} bytes (${(((in_len - out_len) / in_len) * 100).toFixed(2)}% smaller)`
        : `${out_len} bytes (${(((out_len - in_len) / in_len) * 100).toFixed(2)}% larger)`;
}

function savingsStringPercent(in_len: number, out_len: number): string {
    return in_len >= out_len
        ? `(${(((in_len - out_len) / in_len) * 100).toFixed(2)}% smaller)`
        : `(${(((out_len - in_len) / in_len) * 100).toFixed(2)}% larger)`;
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "oxipng" is now active!');

    const gitExt = vscode.extensions.getExtension<GitExtension>("vscode.git")?.exports;

    const gitApi = gitExt?.getAPI(1);

    vscode.commands.executeCommand(
        "setContext",
        "oxipng.webOnly",
        context.extension.extensionKind === vscode.ExtensionKind.UI && vscode.env.uiKind === vscode.UIKind.Web
    );

    const api = new OxipngOptimiser(context);

    const commandOptimise = vscode.commands.registerCommand("oxipng.optimisePng", async (param: vscode.Uri) => {
        vscode.window.showInformationMessage("Called: " + param.fsPath);
        const in_data = await vscode.workspace.fs.readFile(param);
        const out_data = await api.optimiseData(in_data, 2, OxipngStripLevel.Safe);
        vscode.window.showInformationMessage("Optimised: " + param.fsPath);

        const savings = savingsString(in_data.length, out_data.length);

        vscode.window.showInformationMessage(savings);
        vscode.workspace.fs.writeFile(param, out_data);
    });

    const commandOptimiseFolder = vscode.commands.registerCommand(
        "oxipng.optimisePngFolder",
        async (param: vscode.Uri) => {
            const files = await readDirectoryRecursivePNGs(param);

            const pngFilesCount = files.length;

            if (pngFilesCount === 0) {
                vscode.window.showInformationMessage("No PNGs found");
                return;
            }

            let pngSavingsIn = 0;
            let pngSavingsOut = 0;

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

                        const in_data = await vscode.workspace.fs.readFile(file);
                        const out_data = await api.optimiseData(in_data, 6, OxipngStripLevel.Safe);

                        pngSavingsIn += in_data.length;
                        pngSavingsOut += out_data.length;

                        vscode.workspace.fs.writeFile(file, out_data);
                    }
                }
            );

            vscode.window.showInformationMessage(
                "Optimised " + pngFilesCount + " PNGs " + savingsStringPercent(pngSavingsIn, pngSavingsOut)
            );
        }
    );

    const commandOptimiseGitChanges = vscode.commands.registerCommand(
        "oxipng.optimisePngGitChanges",
        async (param: vscode.SourceControl | undefined) => {
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

            let pngSavingsIn = 0;
            let pngSavingsOut = 0;

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
                        const out_data = await api.optimiseData(in_data, 1, OxipngStripLevel.Safe);

                        await new Promise((resolve) => setTimeout(resolve, 2000));

                        pngSavingsIn += in_data.length;
                        pngSavingsOut += out_data.length;

                        vscode.workspace.fs.writeFile(file, out_data);
                    }
                }
            );

            vscode.window.showInformationMessage(
                "Optimised " + pngFilesCount + " PNGs " + savingsStringPercent(pngSavingsIn, pngSavingsOut)
            );
        }
    );

    context.subscriptions.push(commandOptimise, commandOptimiseFolder, commandOptimiseGitChanges);
}

export function deactivate() {}
