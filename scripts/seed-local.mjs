import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

function parseArgs(args) {
  const options = {
    envFile: ".env.local",
    seedDevUsers: true,
    seedPlatformBanners: true,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--env-file") {
      options.envFile = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      options.envFile = arg.slice("--env-file=".length);
      continue;
    }

    if (arg === "--skip-dev-users") {
      options.seedDevUsers = false;
      continue;
    }

    if (arg === "--skip-platform-banners") {
      options.seedPlatformBanners = false;
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  return options;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: options.stdin ? ["pipe", "inherit", "inherit"] : "inherit",
    });

    if (options.stdin) {
      options.stdin.pipe(child.stdin);
    }

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? `exit code ${code}`}`));
    });
  });
}

async function ensureReadable(filePath) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Required seed file not found: ${filePath}`);
  }
}

let options;

try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  console.error("Usage: node scripts/seed-local.mjs [--env-file .env.local] [--skip-dev-users] [--skip-platform-banners]");
  process.exit(1);
}

try {
  if (options.seedPlatformBanners) {
    console.log("Seeding local platform banner Storage objects...");
    await runCommand(process.execPath, [
      "scripts/upload-platform-banners.mjs",
      "--env-file",
      options.envFile,
    ]);
  }

  if (options.seedDevUsers) {
    const seedPath = path.join(process.cwd(), "supabase/seeds/02_dev_users.sql");
    await ensureReadable(seedPath);

    console.log("Seeding local development users...");
    await runCommand("docker", [
      "exec",
      "-i",
      process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_HubVortex",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-f",
      "-",
    ], {
      stdin: createReadStream(seedPath),
    });
  }

  console.log("Local Supabase seed completed.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
