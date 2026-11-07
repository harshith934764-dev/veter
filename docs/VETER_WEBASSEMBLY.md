# Veter Compiler WebAssembly Build

Veter Core 1.0 can be compiled to WebAssembly with Emscripten. The generated JavaScript loader and `.wasm` module can run in a browser or Node.js without launching a Windows executable.

## Build locally

Install the Emscripten SDK and make sure `em++` is available on your PATH. Then run:

```sh
mkdir -p build/wasm
em++ downloads/veter_core_1_0.cpp \
  -std=c++20 -O2 \
  -sMODULARIZE=1 \
  -sEXPORT_NAME=createVeterModule \
  -sENVIRONMENT=web,node \
  -sALLOW_MEMORY_GROWTH=1 \
  -sEXIT_RUNTIME=0 \
  -sEXPORTED_RUNTIME_METHODS='["FS","callMain"]' \
  -o build/wasm/veterc.js
```

Run the smoke test from the repository root:

```sh
node tests/wasm_smoke_test.cjs
```

## Veter Studio integration

The Studio page loads `/assets/wasm/veterc.js` and its companion `veterc.wasm` on the first Run click. It writes the active editor file into Emscripten's virtual filesystem and invokes the actual compiler entry point. Compiler output and errors are shown in the output panel.

The GitHub Actions workflow builds and smoke-tests the module on pull requests. When the workflow runs on `main`, it publishes the generated browser assets to `assets/wasm/` in a bot commit so the static-site host can deploy them. Changes to the generated asset directory do not trigger another build.

## Current limitations

- Studio currently runs the active editor file only; it does not yet compile/import a complete multi-file project as one program.
- Programs that request keyboard input need a host-provided stdin strategy and are not supported by the Studio runner yet.
- Compiler-generated files stay in Emscripten's temporary virtual filesystem and are not automatically downloaded.
- Website-generation behavior and other filesystem-heavy compiler features need dedicated browser tests before being advertised as fully supported.
- The native Windows executable and native compiler workflow remain available.

This is the real C++ Veter Core 1.0 compiler running in a WebAssembly runtime, not the former limited JavaScript demo interpreter.
