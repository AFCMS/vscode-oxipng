import * as vscode from "vscode";
import { Memory, WasmContext } from "@vscode/wasm-component-model";
import { Worker } from "node:worker_threads";

import { vscOxipng } from "./vscOxipng";

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

    const worker = new Worker(vscode.Uri.joinPath(context.extensionUri, "./dist/worker.js").fsPath);

    // The context for the WASM module
    //const wasmContext: WasmContext.Default = new WasmContext.Default();

    // Instantiate the module
    // const instance = await WebAssembly.instantiate(module, {});

    // Bind the WASM memory to the context
    //wasmContext.initialize(new Memory.Default(instance.exports));

    const service: vscOxipng.Imports.Promisified = {
        log: (msg: string) => {
            log.info(msg);
        },
    };

    // Bind the TypeScript Api
    const api = await vscOxipng._.bind(service, module, worker);

    //const api = vscOxipng._.exports.bind(instance.exports as vscOxipng._.Exports, wasmContext);

    return api;
}

function savingsString(in_len: number, out_len: number): string {
    return in_len >= out_len
        ? `${out_len} bytes (${(((in_len - out_len) / in_len) * 100).toFixed(2)}% smaller)`
        : `${out_len} bytes (${(((out_len - in_len) / in_len) * 100).toFixed(2)}% larger)`;
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "oxipng" is now active!');

    const api = await loadWasmModule(context);

    const disposable = vscode.commands.registerCommand("oxipng.helloWorld", async () => {
        const n = await api.add(BigInt(2), BigInt(2));
        vscode.window.showInformationMessage("Hello World from Oxipng! 2+2=" + n.toString());
    });

    const commandOptimise = vscode.commands.registerCommand("oxipng.optimisePng", async (param: vscode.Uri) => {
        vscode.window.showInformationMessage("Called: " + param.fsPath);
        const in_data = await vscode.workspace.fs.readFile(param);
        const out_data = await api.optimise(in_data);
        vscode.window.showInformationMessage("Optimised: " + param.fsPath);

        const savings = savingsString(in_data.length, out_data.length);

        vscode.window.showInformationMessage(savings);
        vscode.workspace.fs.writeFile(param, out_data);
    });

    context.subscriptions.push(disposable, commandOptimise);
}

export function deactivate() {}
