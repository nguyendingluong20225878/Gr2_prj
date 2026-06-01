import { spawn } from "node:child_process";

const commands = process.argv.slice(2);
if (commands.length === 0) {
  console.error("Usage: node scripts/run-concurrent.mjs \"npm run a\" \"npm run b\"");
  process.exit(1);
}

let shuttingDown = false;
const children = commands.map((command, index) => {
  const child = spawn(command, {
    shell: true,
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code) => {
    if (!shuttingDown && code && code !== 0) {
      shuttingDown = true;
      for (const other of children) {
        if (other !== child && !other.killed) other.kill("SIGTERM");
      }
      process.exitCode = code;
    }
  });

  child.on("error", (error) => {
    console.error(`[concurrent:${index}] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });

  return child;
});

function shutdown() {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
