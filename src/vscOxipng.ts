/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as $wcm from "@vscode/wasm-component-model";
import type { u64, i32, i64, ptr } from "@vscode/wasm-component-model";

export namespace vscOxipng {
    export type Imports = {
        log: (msg: string) => void;
    };
    export namespace Imports {
        export type Promisified = $wcm.$imports.Promisify<Imports>;
    }
    export namespace imports {
        export type Promisify<T> = $wcm.$imports.Promisify<T>;
    }
    export type Exports = {
        add: (left: u64, right: u64) => u64;
        optimise: (data: Uint8Array) => Uint8Array;
    };
    export namespace Exports {
        export type Promisified = $wcm.$exports.Promisify<Exports>;
    }
    export namespace exports {
        export type Promisify<T> = $wcm.$exports.Promisify<T>;
    }
}

export namespace vscOxipng.$ {
    export namespace imports {
        export const log = new $wcm.FunctionType<vscOxipng.Imports["log"]>("log", [["msg", $wcm.wstring]], undefined);
    }
    export namespace exports {
        export const add = new $wcm.FunctionType<vscOxipng.Exports["add"]>(
            "add",
            [
                ["left", $wcm.u64],
                ["right", $wcm.u64],
            ],
            $wcm.u64
        );
        export const optimise = new $wcm.FunctionType<vscOxipng.Exports["optimise"]>(
            "optimise",
            [["data", new $wcm.Uint8ArrayType()]],
            new $wcm.Uint8ArrayType()
        );
    }
}
export namespace vscOxipng._ {
    export const id = "afcms:vsc-oxipng/vsc-oxipng" as const;
    export const witName = "vsc-oxipng" as const;
    export type $Root = {
        log: (msg_ptr: i32, msg_len: i32) => void;
    };
    export namespace imports {
        export const functions: Map<string, $wcm.FunctionType> = new Map([["log", $.imports.log]]);
        export function create(service: vscOxipng.Imports, context: $wcm.WasmContext): Imports {
            return $wcm.$imports.create<Imports>(_, service, context);
        }
        export function loop(service: vscOxipng.Imports, context: $wcm.WasmContext): vscOxipng.Imports {
            return $wcm.$imports.loop<vscOxipng.Imports>(_, service, context);
        }
    }
    export type Imports = {
        $root: $Root;
    };
    export namespace exports {
        export const functions: Map<string, $wcm.FunctionType> = new Map([
            ["add", $.exports.add],
            ["optimise", $.exports.optimise],
        ]);
        export function bind(exports: Exports, context: $wcm.WasmContext): vscOxipng.Exports {
            return $wcm.$exports.bind<vscOxipng.Exports>(_, exports, context);
        }
    }
    export type Exports = {
        add: (left: i64, right: i64) => i64;
        optimise: (data_ptr: i32, data_len: i32, result: ptr<Uint8Array>) => void;
    };
    export function bind(
        service: vscOxipng.Imports,
        code: $wcm.Code,
        context?: $wcm.ComponentModelContext
    ): Promise<vscOxipng.Exports>;
    export function bind(
        service: vscOxipng.Imports.Promisified,
        code: $wcm.Code,
        port: $wcm.RAL.ConnectionPort,
        context?: $wcm.ComponentModelContext
    ): Promise<vscOxipng.Exports.Promisified>;
    export function bind(
        service: vscOxipng.Imports | vscOxipng.Imports.Promisified,
        code: $wcm.Code,
        portOrContext?: $wcm.RAL.ConnectionPort | $wcm.ComponentModelContext,
        context?: $wcm.ComponentModelContext | undefined
    ): Promise<vscOxipng.Exports> | Promise<vscOxipng.Exports.Promisified> {
        return $wcm.$main.bind(_, service, code, portOrContext, context);
    }
}
