import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Wrap mode hands the host JSON to the wrapped command on stdin. A command that never reads it
// and exits first makes that write fail with EPIPE; the status line must still render.
const directory = mkdtempSync(join(tmpdir(), "pi-statusline-cli-"));
const run = (wrap, input) => spawnSync(process.execPath, ["dist/statusline/cli.js"], {
  input, encoding: "utf8", env: { ...process.env, PI_DELEGATE_STATE_DIR: directory, PI_DELEGATE_STATUSLINE_WRAP: wrap },
});

try {
  const payload = JSON.stringify({ workspace: { current_dir: directory } });
  const passed = run("wc -c", payload);
  assert.equal(passed.status, 0, passed.stderr);
  assert.equal(passed.stdout.trim(), String(Buffer.byteLength(payload)), "the wrapped command gets the host JSON");

  // Larger than a pipe buffer, so the write is still pending when the command exits.
  const large = JSON.stringify({ workspace: { current_dir: directory }, padding: "x".repeat(1 << 20) });
  const ignored = run("echo wrapped", large);
  assert.equal(ignored.status, 0, ignored.stderr);
  assert.equal(ignored.stdout, "wrapped\n", "a command that ignores stdin still renders");

  console.log("  OK -> statusline wrap mode passes the host JSON through and survives a command that ignores stdin");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
