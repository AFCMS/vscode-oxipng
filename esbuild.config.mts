/// <reference types="node" />

import esbuild from "esbuild";

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
    const ctx = await esbuild.context({
        entryPoints: ["src/extension.ts", "src/worker.ts"],
        bundle: true,
        format: "cjs",
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: "node",
        outdir: "dist",
        external: ["vscode"],
        logLevel: "silent",
        plugins: [
            /* add to the end of plugins array */
            esbuildProblemMatcherPlugin,
        ],
    });

    await ctx.rebuild();
    await ctx.dispose();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
