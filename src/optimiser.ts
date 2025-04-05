// SPDX-FileCopyrightText: 2024 AFCMS <afcm.contact@gmail.com>
// SPDX-License-Identifier: MIT

import { spawnSync } from "node:child_process";

import * as vscode from "vscode";

enum OxipngStripLevel {
    None = 0,
    Safe = 1,
    All = 2,
}

interface OxipngConfig {
    level: number;
    strip: OxipngStripLevel;
    zopfli: boolean;
}

interface OxipngSavings {
    in_len: number;
    out_len: number;
}

interface OxipngVersion {
    major: number;
    minor: number;
    patch: number;
}

class OxipngOptimiser {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        this.context.subscriptions.push();
    }

    /* private isRunningInWeb(): boolean {
        return (
            this.context.extension.extensionKind === vscode.ExtensionKind.UI && vscode.env.uiKind === vscode.UIKind.Web
        );
    } */

    static oxipngVersionPattern = new RegExp(/^oxipng (\d+).(\d+).(\d+)/);

    static parseVersionString(version: string): OxipngVersion | undefined {
        const result = OxipngOptimiser.oxipngVersionPattern.exec(version);
        if (result) {
            return {
                major: parseInt(result[1]),
                minor: parseInt(result[2]),
                patch: parseInt(result[3]),
            };
        } else {
            return undefined;
        }
    }

    public hostOxipng(): string | undefined {
        const p = this.getConfigHostBinary();
        return p === "" ? undefined : p;
    }

    public hasHostOxipng(): boolean {
        return this.hostOxipng() !== undefined;
    }

    public checkHostInstall(): OxipngVersion | undefined {
        const hostPath = this.hostOxipng();
        if (hostPath) {
            const ttt = spawnSync(hostPath, ["--version"], {});
            return OxipngOptimiser.parseVersionString(ttt.stdout.toString());
        }
        return undefined;
    }

    static oxipngParameterBuilder(config: OxipngConfig): string[] {
        const options = ["-", "-o", config.level.toString(), "--stdout"];

        switch (config.strip) {
            case OxipngStripLevel.None:
                options.push("--strip", "none");
                break;
            case OxipngStripLevel.Safe:
                options.push("--strip", "safe");
                break;
            case OxipngStripLevel.All:
                options.push("--keep", "acTL,fcTL,fdAT");
                break;
        }

        if (config.zopfli) {
            options.push("--zopfli");
        }

        return options;
    }

    // TODO: context aware config detection (workspace folder, uri, etc)

    public getConfigStripLevel(): OxipngStripLevel {
        const t = vscode.workspace.getConfiguration("oxipng").get<string>("stripLevel");

        switch (t) {
            case "none":
                return OxipngStripLevel.None;
            case "safe":
                return OxipngStripLevel.Safe;
            case "all":
                return OxipngStripLevel.All;
            default:
                return OxipngStripLevel.None;
        }
    }

    public getConfigHostBinary(): string | undefined {
        return vscode.workspace.getConfiguration("oxipng").get<string>("hostBinary");
    }

    public getConfigOptimisationLevel(): number {
        return vscode.workspace.getConfiguration("oxipng").get<number>("optimisationLevel") || 2;
    }

    public getConfigZopfli(): boolean {
        return vscode.workspace.getConfiguration("oxipng").get<boolean>("useZopfli") === true;
    }

    /**
     * Use to call optimiseData or optimiseFile with workspace configuration
     */
    public getConfig(): OxipngConfig {
        return {
            level: this.getConfigOptimisationLevel(),
            strip: this.getConfigStripLevel(),
            zopfli: this.getConfigZopfli(),
        };
    }

    /**
     * @throws Error
     */
    private async optimiseDataHost(data: Uint8Array, config: OxipngConfig): Promise<[Uint8Array, OxipngSavings]> {
        const hostPath = this.hostOxipng();
        if (hostPath === undefined) {
            throw new Error("No host binary found");
        }

        const options = OxipngOptimiser.oxipngParameterBuilder(config);

        const t = spawnSync(hostPath, options, { input: data });
        if (t.status !== 0) {
            throw new Error("Oxipng failed: " + t.stderr.toString());
        }

        return [t.stdout, { in_len: data.length, out_len: t.stdout.length }];
    }

    public async optimiseData(data: Uint8Array, config: OxipngConfig): Promise<[Uint8Array, OxipngSavings]> {
        return this.optimiseDataHost(data, config);
    }

    public async optimiseFile(uri: vscode.Uri, config: OxipngConfig): Promise<OxipngSavings> {
        const in_data = await vscode.workspace.fs.readFile(uri);

        const [out_data, savings] = await this.optimiseData(in_data, config);

        await vscode.workspace.fs.writeFile(uri, out_data);

        return savings;
    }
}

export { OxipngStripLevel, OxipngSavings, OxipngOptimiser };
