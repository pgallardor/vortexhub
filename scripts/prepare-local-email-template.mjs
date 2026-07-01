import { chmod, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const targetDir = "/private/tmp/vortexhub-email-templates";
const templates = ["invite.html", "magic_link.html"];

await mkdir(targetDir, { recursive: true });

for (const template of templates) {
  const source = path.join(process.cwd(), "supabase/templates", template);
  const target = path.join(targetDir, template);

  await copyFile(source, target);
  await chmod(target, 0o644);
  console.log(`Prepared local Supabase Auth email template: ${target}`);
}
