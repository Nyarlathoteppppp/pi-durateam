#!/usr/bin/env node
/**
 * Claude Code status line segment for pi delegates.
 *
 * Claude Code allows exactly one statusLine command, so this wraps whatever you already
 * run and appends the pi segment:
 *
 *   { "statusLine": { "type": "command",
 *                     "command": "PI_DELEGATE_STATUSLINE_WRAP=ccstatusline pi-delegate-statusline" } }
 *
 * The wrapped command receives the same stdin JSON it would have received alone.
 */
import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { segment } from "./render.js";

const readStdin = (): Promise<string> =>
  new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve("");
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (d: string) => (buf += d));
    process.stdin.on("end", () => resolve(buf));
  });

interface HostPayload {
  workspace?: { current_dir?: string };
}

const raw = await readStdin();

if (process.env.PI_DELEGATE_STATUSLINE_LOG) {
  try {
    appendFileSync(process.env.PI_DELEGATE_STATUSLINE_LOG, `${Date.now()}\n`);
  } catch {
    // Logging is opt-in debug help, never a reason to fail a render.
  }
}

let cwd: string | undefined;
try {
  cwd = (JSON.parse(raw) as HostPayload)?.workspace?.current_dir;
} catch {
  // A malformed payload just means we cannot scope to a workspace.
}

const pi = segment(cwd);
const wrap = process.env.PI_DELEGATE_STATUSLINE_WRAP;

if (!wrap) {
  if (pi) process.stdout.write(`${pi}\n`);
  process.exit(0);
}

const child = spawn(wrap, { shell: true, stdio: ["pipe", "pipe", "inherit"] });
let out = "";
child.stdout.setEncoding("utf8");
child.stdout.on("data", (d: string) => (out += d));
child.on("error", () => {
  process.stdout.write(pi ? `${pi}\n` : "\n");
});
child.on("close", () => {
  const base = out.replace(/\n+$/, "");
  const lines = base ? base.split("\n") : [];
  if (pi) lines.push(pi);
  process.stdout.write(`${lines.join("\n")}\n`);
});
// A wrapped command that exits without reading stdin fails this write with EPIPE; the close
// handler still renders what it printed.
child.stdin.on("error", () => {});
child.stdin.end(raw);
