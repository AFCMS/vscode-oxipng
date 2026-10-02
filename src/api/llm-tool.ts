// SPDX-FileCopyrightText: 2026 AFCMS <afcm.contact@gmail.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

import { fileName } from "../utils/files";
import { savingsStringPercent } from "../utils/savings";
import { OxipngOptimiser, type OxipngSavings } from "./optimiser";

export class OxipngCheckHostInstallTool implements vscode.LanguageModelTool<{}> {
  constructor(private api: OxipngOptimiser) {}

  invoke() {
    const version = this.api.checkHostInstall();

    if (!version) {
      throw new Error("Oxipng host binary is not configured or not found.");
    }

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(
        `Oxipng is installed on the system: ${version.major}.${version.minor}.${version.patch}`,
      ),
    ]);
  }
}

interface OxipngOptimisePNGsToolOptions {
  files: string[];
}

export class OxipngOptimisePNGsTool implements vscode.LanguageModelTool<OxipngOptimisePNGsToolOptions> {
  constructor(private api: OxipngOptimiser) {}

  async invoke(options: vscode.LanguageModelToolInvocationOptions<OxipngOptimisePNGsToolOptions>) {
    if (!this.api.checkHostInstall()) {
      throw new Error("Oxipng host binary is not configured or not found.");
    }

    if (options.input.files.length === 0) {
      throw new Error("No files provided for optimisation.");
    }

    const fileURIs = options.input.files.map((file) => vscode.Uri.file(file));
    const pngFilesCount = fileURIs.length;

    const overallSavings: OxipngSavings = { in_len: 0, out_len: 0 };

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Optimising PNGs" },
      async (progress) => {
        progress.report({ increment: 0, message: "Starting..." });

        for (let i = 0; i < pngFilesCount; i++) {
          const file = fileURIs[i];
          progress.report({
            increment: 100 / pngFilesCount,
            message: `(${i + 1}/${pngFilesCount}) ` + fileName(file),
          });

          const savings = await this.api.optimiseFile(file, this.api.getConfig(file));

          overallSavings.in_len += savings.in_len;
          overallSavings.out_len += savings.out_len;
        }
      },
    );

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(
        "PNG optimisation completed : " +
          pngFilesCount +
          " PNGs " +
          savingsStringPercent(overallSavings),
      ),
    ]);
  }
}
