import { spawn } from "node:child_process";

const env = { ...process.env };

if (!env.VERCEL && !env.NEXT_DIST_DIR) {
  env.NEXT_DIST_DIR = ".next-build";
}

const child = spawn("next", ["build"], {
  env,
  shell: true,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
