// SPDX-FileCopyrightText: 2024 AFCMS <afcm.contact@gmail.com>
// SPDX-License-Identifier: MIT

import { Worker } from "node:worker_threads";
import { spawnSync } from "node:child_process";

import * as vscode from "vscode";

import { vscOxipng } from "./vscOxipng";

enum OxipngStripLevel {
    None = 0,
    Safe = 1,
    All = 2,
}

type OxipngSavings = {
    in_len: number;
    out_len: number;
};

type OxipngVersion = {
    major: number;
    minor: number;
    patch: number;
};

class OxipngOptimiser {
    private context: vscode.ExtensionContext;
    private logWorker: vscode.LogOutputChannel;
    private log: vscode.OutputChannel;
    private wasmApi: vscOxipng.Exports.Promisified | undefined;

    constructor(context: vscode.ExtensionContext) {
        this.logWorker = vscode.window.createOutputChannel("Oxipng - Worker", { log: true });
        this.log = vscode.window.createOutputChannel("Oxipng", { log: true });
        this.context = context;

        this.context.subscriptions.push(this.logWorker);
    }

    private isRunningInWeb(): boolean {
        return (
            this.context.extension.extensionKind === vscode.ExtensionKind.UI && vscode.env.uiKind === vscode.UIKind.Web
        );
    }

    private getWasmStripLevel(level: OxipngStripLevel) {
        switch (level) {
            case OxipngStripLevel.None:
                return vscOxipng.StripMetadata.none;
            case OxipngStripLevel.Safe:
                return vscOxipng.StripMetadata.safe;
            case OxipngStripLevel.All:
                return vscOxipng.StripMetadata.all;
        }
    }

    private async loadWasmAPI() {
        const filename = vscode.Uri.joinPath(
            this.context.extensionUri,
            "target",
            "wasm32-unknown-unknown",
            this.context.extensionMode === vscode.ExtensionMode.Production ? "release" : "debug",
            "vsc_oxipng.wasm"
        );

        const bits = await vscode.workspace.fs.readFile(filename);
        const module = await WebAssembly.compile(bits);

        const worker = new Worker(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                `./dist/${this.isRunningInWeb() ? "web" : "main"}/worker.js`
            ).fsPath
        );

        const service: vscOxipng.Imports.Promisified = {
            log: (msg: string) => {
                this.logWorker.info(msg);
            },
        };

        // Bind the TypeScript Api
        this.wasmApi = await vscOxipng._.bind(service, module, worker);
    }

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

    static oxipngParameterBuilder(level: number, strip: OxipngStripLevel, zopfli: boolean = false): string[] {
        const options = ["-", "-o", level.toString(), "--stdout"];

        switch (strip) {
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

        if (zopfli) {
            options.push("--zopfli");
        }

        return options;
    }

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

    public getConfigPreferBundeled(): boolean {
        return vscode.workspace.getConfiguration("oxipng").get<boolean>("preferBundeled") === true;
    }

    public getConfigOptimisationLevel(): number {
        return vscode.workspace.getConfiguration("oxipng").get<number>("optimisationLevel") || 2;
    }

    public getConfigZopfli(): boolean {
        return vscode.workspace.getConfiguration("oxipng").get<boolean>("useZopfli") === true;
    }

    /**
     * Use to call optimiseData or optimiseFile with workspace configuration
     *
     * @returns [optimisationLevel, stripLevel, useZopfli]
     */
    public getConfig(): [number, OxipngStripLevel, boolean] {
        return [this.getConfigOptimisationLevel(), this.getConfigStripLevel(), this.getConfigZopfli()];
    }

    private async optimiseDataWasm(
        data: Uint8Array,
        level: number,
        strip: OxipngStripLevel,
        zopfli: boolean
    ): Promise<[Uint8Array, OxipngSavings]> {
        if (this.wasmApi === undefined) {
            await this.loadWasmAPI();
            this.wasmApi = this.wasmApi as unknown as vscOxipng.Exports.Promisified;
        }

        const outData = await this.wasmApi?.optimise(data, level, this.getWasmStripLevel(strip), zopfli);

        return [outData, { in_len: data.length, out_len: outData.length }];
    }

    /**
     * @throws Error
     */
    private async optimiseDataHost(
        data: Uint8Array,
        level: number,
        strip: OxipngStripLevel,
        zopfli: boolean
    ): Promise<[Uint8Array, OxipngSavings]> {
        const hostPath = this.hostOxipng();
        if (hostPath === undefined) {
            throw new Error("No host binary found");
        }

        const options = OxipngOptimiser.oxipngParameterBuilder(level, strip, zopfli);

        const t = spawnSync(hostPath, options, { input: data });
        if (t.status !== 0) {
            throw new Error("Oxipng failed: " + t.stderr.toString());
        }

        return [t.stdout, { in_len: data.length, out_len: t.stdout.length }];
    }

    public async optimiseData(
        data: Uint8Array,
        level: number,
        strip: OxipngStripLevel,
        zopfli: boolean
    ): Promise<[Uint8Array, OxipngSavings]> {
        if (this.isRunningInWeb() || this.getConfigPreferBundeled()) {
            return this.optimiseDataWasm(data, level, strip, zopfli);
        }

        return this.optimiseDataHost(data, level, strip, zopfli);
    }

    public async optimiseFile(
        uri: vscode.Uri,
        level: number,
        strip: OxipngStripLevel,
        zopfli: boolean
    ): Promise<OxipngSavings> {
        // return this.optimiseFileHost(uri, level, strip);
        // return this.optimiseFileWasm(uri, level, strip);

        const in_data = await vscode.workspace.fs.readFile(uri);

        if (this.getConfigPreferBundeled()) {
            //this.optimiseDataWasm(in_data, level, strip, zopfli);
            //const [out_data, savings] = await this.optimiseDataHost(in_data, level, strip, zopfli);
        }

        const [out_data, savings] = await this.optimiseData(in_data, level, strip, zopfli);

        await vscode.workspace.fs.writeFile(uri, out_data);

        return savings;
    }
}

export { OxipngStripLevel, OxipngSavings, OxipngOptimiser };
