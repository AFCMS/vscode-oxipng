// SPDX-FileCopyrightText: 2024 AFCMS <afcm.contact@gmail.com>
// SPDX-License-Identifier: MIT

import path from "node:path";

import * as vscode from "vscode";
import { Worker } from "node:worker_threads";

import { vscOxipng } from "./vscOxipng";
import { GitExtension, Repository } from "./types/git";

async function loadWasmModule(context: vscode.ExtensionContext) {
    const filename = vscode.Uri.joinPath(
        context.extensionUri,
        "target",
        "wasm32-unknown-unknown",
        "debug", // TODO: Change to release
        "vsc_oxipng.wasm"
    );

    // The channel for printing the log.
    const log = vscode.window.createOutputChannel("Oxipng - Worker", { log: true });
    context.subscriptions.push(log);

    const bits = await vscode.workspace.fs.readFile(filename);
    const module = await WebAssembly.compile(bits);

    const worker = new Worker(
        vscode.Uri.joinPath(
            context.extensionUri,
            `./dist/${
                context.extension.extensionKind === vscode.ExtensionKind.UI && vscode.env.uiKind === vscode.UIKind.Web
                    ? "web"
                    : "main"
            }/worker.js`
        ).fsPath
    );

    const service: vscOxipng.Imports.Promisified = {
        log: (msg: string) => {
            log.info(msg);
        },
    };

    // Bind the TypeScript Api
    return await vscOxipng._.bind(service, module, worker);
}

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

async function gitModifiedFiles(repo: Repository): Promise<vscode.Uri[]> {
    return (await repo.diffWithHEAD()).map((change) => change.uri);
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "oxipng" is now active!');

    const api = await loadWasmModule(context);
    const gitExt = vscode.extensions.getExtension<GitExtension>("vscode.git")?.exports;

    const gitApi = gitExt?.getAPI(1);

    const commandOptimise = vscode.commands.registerCommand("oxipng.optimisePng", async (param: vscode.Uri) => {
        vscode.window.showInformationMessage("Called: " + param.fsPath);
        const in_data = await vscode.workspace.fs.readFile(param);
        const out_data = await api.optimise(in_data, 2, vscOxipng.StripMetadata.safe);
        vscode.window.showInformationMessage("Optimised: " + param.fsPath);

        const savings = savingsString(in_data.length, out_data.length);

        vscode.window.showInformationMessage(savings);
        vscode.workspace.fs.writeFile(param, out_data);
    });

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

            const modifiedFiles = await gitModifiedFiles(repo);

            const pngFiles = modifiedFiles.filter((file) => file.fsPath.endsWith(".png"));
            const pngFilesCount = pngFiles.length;

            let pngSavingsIn = 0;
            let pngSavingsOut = 0;

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: "Optimising PNGs" },
                async (progress) => {
                    progress.report({ increment: 0, message: "Starting..." });

                    for (let i = 0; i < pngFilesCount; i++) {
                        const file = pngFiles[i];
                        progress.report({ increment: 100 / pngFilesCount, message: path.parse(file.fsPath).base });

                        const in_data = await vscode.workspace.fs.readFile(file);
                        const out_data = await api.optimise(in_data, 1, vscOxipng.StripMetadata.safe);

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

    context.subscriptions.push(commandOptimise, commandOptimiseGitChanges);
}

export function deactivate() {}
