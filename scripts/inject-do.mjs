/**
 * Post-build script: compile the SessionDO Durable Object and inject its export
 * into .open-next/worker.js so Wrangler can pick it up.
 */

import { spawnSync } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const esbuildBin = resolve(root, "node_modules/.bin/esbuild");

// Compile worker/session-do.ts → .open-next/session-do.js
const result = spawnSync(
  esbuildBin,
  [
    resolve(root, "worker/session-do.ts"),
    "--bundle",
    "--format=esm",
    "--platform=browser",
    "--external:cloudflare:workers",
    `--outfile=${resolve(root, ".open-next/session-do.js")}`,
  ],
  { stdio: "inherit" },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

// Append the DO export to the generated worker entrypoint
await appendFile(resolve(root, ".open-next/worker.js"), '\nexport { SessionDO } from "./session-do.js";\n');

console.log("✅ SessionDO injected into .open-next/worker.js");
