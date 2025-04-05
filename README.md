# VSCode Oxipng

## Features

This VSCode Extension aims to integrate with the [**oxipng**](https://github.com/shssoichiro/oxipng) PNG's optimisation tool.

It isn't affiliated with the oxipng project.

-   Support for workspaces, Git, remote and local development.
-   Expose common settings.

## Requirements

Some features require the builtin Git extension, which is enabled by default.

## Extension Settings

This extension contributes the following settings:

-   `oxipng.hostBinary`: Path to the `oxipng` binary.
-   `oxipng.optimisationLevel`: The optimisation level preset to use. The default level 2. (0-6)
-   `oxipng.stripMetadata`: `none`, `safe`, `all`. The default is `none`.
-   `oxipng.useZopfli`: Use the Zopfli algorithm. The default is `false`.

By design, not all of oxipng params are configurable. The extension aims to be simple and easy to use.

## Known Issues

### You still have to install `oxipng` by hand

The extension does not install `oxipng` for you. You can install it via `cargo` if you have a [Rust](https://www.rust-lang.org) toolchain installed:

```bash
cargo install oxipng
```

If you want you can even try to get a bit more performance by compiling for your exact CPU architecture:

```toml
# .cargo/config.toml
[rust]
lto = "thin"
jemalloc = true

[target.'cfg(all())']
rustflags = ["-C", "target-cpu=native"]

[llvm]
cxxflags = "-march=native"
cflags = "-march=native"
```

Ultimatly I have plans to support detecting a binary in path, as well as installing from `cargo` and downloading a precompiled binary.

### It doesn't support the web version of VSCode

Since it solely relies on a binary, it won't work in the web version of VSCode.

The original plan was to use a WASM version of `oxipng`, but I never got WASI threads to work and without them the performance is abysmal.

### No exported API yet

I designed the base class to be able to abstract from multiple ways of running oxipng, mostly to be able to support a WASM version in the future.

I plan to export the `OxipngOptimiser` class, as well as it's TypeScript definition file, so you can integrate with this extension in your owns.

## Release Notes

### 0.0.1

Initial release
