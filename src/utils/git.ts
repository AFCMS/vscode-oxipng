// SPDX-FileCopyrightText: 2024 AFCMS <afcm.contact@gmail.com>
// SPDX-License-Identifier: MIT

import path from "node:path";

import * as vscode from "vscode";

import { Repository } from "../types/git";

async function gitModifiedFiles(repo: Repository): Promise<vscode.Uri[]> {
    return (await repo.diffIndexWithHEAD()).map((change) => change.uri);
}

async function gitModifiedPNGs(repo: Repository): Promise<vscode.Uri[]> {
    const modifiedFiles = await gitModifiedFiles(repo);
    return modifiedFiles.filter((file) => [".png", ".apng"].some((ext) => path.parse(file.fsPath).ext === ext));
}

export { gitModifiedFiles, gitModifiedPNGs };
