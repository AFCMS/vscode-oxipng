// SPDX-FileCopyrightText: 2024 AFCMS <afcm.contact@gmail.com>
// SPDX-License-Identifier: MIT

import { Worker } from "node:worker_threads";

import * as vscode from "vscode";

import { vscOxipng } from "./vscOxipng";

enum OxipngStripLevel {
    None = 0,
    Safe = 1,
    All = 2,
}

class OxipngOptimiser {
    private context: vscode.ExtensionContext;
    private log: vscode.LogOutputChannel;
    private wasmApi: vscOxipng.Exports.Promisified | undefined;

    constructor(context: vscode.ExtensionContext) {
        this.log = vscode.window.createOutputChannel("Oxipng - Worker", { log: true });
        this.context = context;

        this.context.subscriptions.push(this.log);
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
                `./dist/${
                    this.context.extension.extensionKind === vscode.ExtensionKind.UI &&
                    vscode.env.uiKind === vscode.UIKind.Web
                        ? "web"
                        : "main"
                }/worker.js`
            ).fsPath
        );

        const service: vscOxipng.Imports.Promisified = {
            log: (msg: string) => {
                this.log.info(msg);
            },
        };

        // Bind the TypeScript Api
        this.wasmApi = await vscOxipng._.bind(service, module, worker);
    }

    public hostOxipng(): string | undefined {
        return undefined;
    }

    public hasHostOxipng(): boolean {
        return this.hostOxipng() !== undefined;
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

    private async optimiseDataWasm(data: Uint8Array, level: number, strip: OxipngStripLevel): Promise<Uint8Array> {
        if (this.wasmApi === undefined) {
            await this.loadWasmAPI();
            this.wasmApi = this.wasmApi as unknown as vscOxipng.Exports.Promisified;
        }

        return this.wasmApi?.optimise(data, level, this.getWasmStripLevel(strip));
    }

    private async optimiseFileWasm(uri: vscode.Uri, level: number, strip: OxipngStripLevel): Promise<void> {
        if (this.wasmApi === undefined) {
            await this.loadWasmAPI();
            this.wasmApi = this.wasmApi as unknown as vscOxipng.Exports.Promisified;
        }

        const in_data = await vscode.workspace.fs.readFile(uri);

        const out_data = await this.wasmApi.optimise(in_data, level, this.getWasmStripLevel(strip));

        await vscode.workspace.fs.writeFile(uri, out_data);
    }

    public async optimiseData(data: Uint8Array, level: number, strip: OxipngStripLevel): Promise<Uint8Array> {
        return this.optimiseDataWasm(data, level, strip);
    }

    public async optimiseFile(uri: vscode.Uri, level: number, strip: OxipngStripLevel) {
        return this.optimiseFileWasm(uri, level, strip);
    }
}

export { OxipngStripLevel, OxipngOptimiser };
