import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";

function runScript(script) {
  if (isWindows) {
    return spawn(`npm.cmd run ${script}`, {
      shell: true,
      stdio: "inherit",
    });
  }

  return spawn("npm", ["run", script], {
    stdio: "inherit",
  });
}

const children = [runScript("dev:backend"), runScript("dev:frontend")];

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(code);
}

for (const child of children) {
  child.on("exit", (code) => {
    if (!shuttingDown && code && code !== 0) {
      shutdown(code);
    }
  });
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
