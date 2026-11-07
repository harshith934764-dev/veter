# Veter Compiler WebAssembly Build

This document describes the experimental WebAssembly build of the native Veter Core 1.0 compiler.

## What this enables

The C++ compiler can be compiled to WebAssembly with Emscripten. The generated JavaScript loader and `.wasm` module can run in a JavaScript host, including a browser or Node.js, without launching a Windows executable.

The compiler still reads a source file from its virtual filesystem. A host must write the `.vtr` source into Emscripten's virtual filesystem and call the compiler entry point with that file path.

## Build locally

Install the Emscripten SDK and make sure `em++` is available on your PATH. Then run:

```sh
mkdir -p build/wasm
em++ downloads/veter_core_1_0.cpp \
  -std=c++20 -O2 \
  -sMODULARIZE=1 \
  -sEXPORT_NAME=createVeterModule \
  -sENVIRONMENT=node \
  -sALLOW_MEMORY_GROWTH=1 \
  -sEXIT_RUNTIME=0 \
  -sEXPORTED_RUNTIME_METHODS='["FS","callMain"]' \
  -o build/wasm/veterc.js
```

Run the smoke test from the repository root:

```sh
node tests/wasm_smoke_test.cjs
```

## Current limitations

- This is an experimental build target, not yet the default Studio execution engine.
- The current build targets Node.js for repeatable CI smoke testing. A browser build needs a browser-compatible Emscripten environment setting and a browser integration test.
- Programs that request input need a host-provided stdin strategy.
- Website generation and file-writing features need separate tests against Emscripten's virtual filesystem before being advertised as fully supported.
- The native Windows executable and native compiler workflow remain available.

The GitHub Actions workflow `Veter WebAssembly build` compiles the module, runs the smoke test, and uploads the generated compiler bundle as an artifact.
