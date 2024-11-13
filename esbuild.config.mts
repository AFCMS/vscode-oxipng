/// <reference types="node" />

import esbuild from "esbuild";

import { nodeModulesPolyfillPlugin } from "esbuild-plugins-node-modules-polyfill";

const production = process.argv.includes("--production");

const esbuildProblemMatcherPlugin: esbuild.Plugin = {
    name: "esbuild-problem-matcher",

    setup(build) {
        build.onStart(() => {
            console.log("[esbuild] build started");
        });
        build.onEnd((result) => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                if (location) {
                    console.error(`    ${location.file}:${location.line}:${location.column}:`);
                }
            });
            console.log("[esbuild] build finished");
        });
    },
};

async function main() {
    const sharedOptions: esbuild.BuildOptions = {
        entryPoints: ["src/extension.ts", "src/worker.ts"],
        bundle: true,
        target: "es2020",
        format: "cjs",
        external: ["vscode"],
        minify: production,
        sourcemap: !production,
        logLevel: "silent",
    };

    const mainOptions: esbuild.BuildOptions = {
        ...sharedOptions,
        platform: "node",
        outdir: "dist/main",
        plugins: [esbuildProblemMatcherPlugin],
    };

    const webOptions: esbuild.BuildOptions = {
        ...sharedOptions,
        platform: "browser",
        outdir: "dist/web",
        plugins: [
            nodeModulesPolyfillPlugin({
                modules: ["node:path", "node:worker_threads"],
            }),
            esbuildProblemMatcherPlugin,
        ],
    };

    const ctxMain = await esbuild.context(mainOptions);
    const ctxWeb = await esbuild.context(webOptions);

    await ctxMain.rebuild();
    await ctxMain.dispose();

    // await ctxWeb.rebuild();
    // await ctxWeb.dispose();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
