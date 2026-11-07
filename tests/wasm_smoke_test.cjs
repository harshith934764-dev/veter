const assert = require("node:assert/strict");
const path = require("node:path");

const createVeterModule = require(path.resolve("build/wasm/veterc.js"));

(async () => {
  let stdout = "";
  let stderr = "";

  const runtime = await createVeterModule({
    noInitialRun: true,
    print: (line) => { stdout += line + "\n"; },
    printErr: (line) => { stderr += line + "\n"; }
  });

  runtime.FS.mkdir("/workspace");
  runtime.FS.writeFile(
    "/workspace/main.vtr",
    'remember answer as 40 + 2\ndisplay answer\n'
  );

  const exitCode = runtime.callMain(["/workspace/main.vtr"]);
  assert.equal(exitCode, 0, stderr || "Veter compiler returned a non-zero exit code.");
  assert.equal(stdout, "42\n");
  process.stdout.write("WebAssembly compiler smoke test passed: expected output 42.\n");
})().catch((error) => {
  process.stderr.write(String(error.stack || error) + "\n");
  process.exitCode = 1;
});
