// SPDX-FileCopyrightText: 2024 AFCMS <afcm.contact@gmail.com>
// SPDX-License-Identifier: MIT

import path from "node:path";

import * as vscode from "vscode";

async function readDirectoryRecursive(uri: vscode.Uri, ext: string[]): Promise<vscode.Uri[]> {
    const results: vscode.Uri[] = [];
    const files = await vscode.workspace.fs.readDirectory(uri);

    for (const file of files) {
        if (file[1] === vscode.FileType.Directory) {
            const subFiles = await readDirectoryRecursive(vscode.Uri.joinPath(uri, file[0]), ext);
            results.push(...subFiles);
        } else {
            const fname = file[0];
            const lfname = fname.toLowerCase();

            if (ext.some((e) => lfname.endsWith(e))) {
                results.push(vscode.Uri.joinPath(uri, fname));
            }
        }
    }

    return results;
}

async function readDirectoryRecursivePNGs(uri: vscode.Uri) {
    return readDirectoryRecursive(uri, [".png", ".apng"]);
}

function fileName(uri: vscode.Uri): string {
    return path.parse(uri.fsPath).base;
}

export { readDirectoryRecursive, readDirectoryRecursivePNGs, fileName };
