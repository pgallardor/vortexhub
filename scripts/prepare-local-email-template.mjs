import { chmod, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const source = path.join(process.cwd(), "supabase/templates/invite.html");
const targetDir = "/private/tmp/vortexhub-email-templates";
const target = path.join(targetDir, "invite.html");

await mkdir(targetDir, { recursive: true });
await copyFile(source, target);
await chmod(target, 0o644);

console.log(`Prepared local Supabase Auth email template: ${target}`);
