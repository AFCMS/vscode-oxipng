import { Connection, RAL } from "@vscode/wasm-component-model";
import { vscOxipng } from "./vscOxipng";

async function main(): Promise<void> {
    const connection = await Connection.createWorker(vscOxipng._);
    connection.listen();
}

main().catch(RAL().console.error);
