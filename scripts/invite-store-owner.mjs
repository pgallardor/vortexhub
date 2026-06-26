import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function printUsage() {
  console.error("Usage: npm run onboard:store-owner -- [--env-file .env.production] owner@example.com");
}

function parseArgs(args) {
  let envFile;
  let email;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--env-file") {
      envFile = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      envFile = arg.slice("--env-file=".length);
      continue;
    }

    if (!email) {
      email = arg;
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  return {
    email: email?.trim().toLowerCase(),
    envFile,
  };
}

function unquoteEnvValue(value) {
  const trimmed = value.trim();
  const quote = trimmed[0];

  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed
      .slice(1, -1)
      .replaceAll("\\n", "\n")
      .replaceAll("\\r", "\r")
      .replaceAll("\\t", "\t")
      .replaceAll("\\\"", '"')
      .replaceAll("\\'", "'");
  }

  return trimmed;
}

function loadEnvFile(envFile) {
  if (!envFile) return;

  const envPath = resolve(process.cwd(), envFile);

  if (!existsSync(envPath)) {
    throw new Error(`Env file not found: ${envPath}`);
  }

  const content = readFileSync(envPath, "utf8");

  for (const [lineIndex, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const normalizedLine = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const match = normalizedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (!match) {
      throw new Error(`Invalid env syntax in ${envPath}:${lineIndex + 1}`);
    }

    process.env[match[1]] = unquoteEnvValue(match[2]);
  }
}

let parsedArgs;

try {
  parsedArgs = parseArgs(process.argv.slice(2));
  loadEnvFile(parsedArgs.envFile);
} catch (error) {
  console.error(error.message);
  printUsage();
  process.exit(1);
}

const email = parsedArgs.email;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = (process.env.VORTEXHUB_APP_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const inviteRedirectUrl = `${appUrl}/auth/onboarding`;
const emailProvider = (
  process.env.INVITE_EMAIL_PROVIDER
  ?? (process.env.RESEND_API_KEY ? "resend" : "supabase")
).trim().toLowerCase();
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;
const resendReplyToEmail = process.env.RESEND_REPLY_TO_EMAIL;

if (!email) {
  printUsage();
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Get it from `supabase status`, then run:");
  console.error("SUPABASE_SERVICE_ROLE_KEY='<service_role_key>' npm run onboard:store-owner -- owner@example.com");
  process.exit(1);
}

if (!["resend", "supabase"].includes(emailProvider)) {
  console.error("INVITE_EMAIL_PROVIDER must be either `resend` or `supabase`.");
  process.exit(1);
}

if (emailProvider === "resend") {
  if (!resendApiKey) {
    console.error("Missing RESEND_API_KEY.");
    process.exit(1);
  }

  if (!resendFromEmail) {
    console.error("Missing RESEND_FROM_EMAIL. Example: VortexHub <no-reply@your-domain.com>");
    process.exit(1);
  }
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInviteEmail({ acceptUrl }) {
  const safeAcceptUrl = escapeHtml(acceptUrl);
  const safeAppUrl = escapeHtml(appUrl);
  const safeEmail = escapeHtml(email);

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Bienvenido a VortexHub</title>
  </head>
  <body style="margin:0;background:#090c12;color:#eef3fb;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#090c12;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#111722;border:1px solid #2b3545;border-radius:16px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.26);">
            <tr>
              <td style="height:5px;background:#67a9ff;"></td>
            </tr>
            <tr>
              <td style="padding:32px 32px 14px;">
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:22px;">
                  <tr>
                    <td style="width:54px;height:54px;border:1px solid #67a9ff55;border-radius:16px;background:#0a101a;text-align:center;vertical-align:middle;">
                      <img src="${safeAppUrl}/brand/vortex-logo.png" width="30" height="38" alt="" style="display:inline-block;vertical-align:middle;">
                    </td>
                    <td style="padding-left:12px;color:#eef3fb;font-size:18px;font-weight:800;letter-spacing:.06em;">VORTEXHUB</td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;color:#67a9ff;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Bienvenido a VortexHub</p>
                <h1 style="margin:0 0 12px;color:#eef3fb;font-size:30px;line-height:1.15;">Activa el acceso de tu tienda</h1>
                <p style="margin:0 0 24px;color:#b6c1d2;font-size:16px;line-height:1.65;">
                  Te invitamos a crear tu cuenta de administrador para publicar el calendario,
                  identidad visual y eventos de tu tienda.
                </p>
                <a href="${safeAcceptUrl}" style="display:inline-block;background:#67a9ff;color:#08101b;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:10px;">
                  Crear mi cuenta
                </a>
                <p style="margin:24px 0 0;color:#94a1b5;font-size:13px;line-height:1.6;">
                  Este enlace es personal, expira pronto y solo debe ser usado por ${safeEmail}.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;color:#94a1b5;font-size:12px;line-height:1.55;">
                <p style="margin:0 0 10px;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
                <p style="margin:0 0 18px;word-break:break-all;">
                  <a href="${safeAcceptUrl}" style="color:#9ec9ff;">${safeAcceptUrl}</a>
                </p>
                <p style="margin:0;">Si no esperabas esta invitación, puedes ignorar este correo.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendWithResend({ acceptUrl }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [email],
      subject: "Bienvenido a VortexHub",
      html: renderInviteEmail({ acceptUrl }),
      text: [
        "Bienvenido a VortexHub",
        "",
        "Te invitamos a crear tu cuenta de administrador para publicar el calendario, identidad visual y eventos de tu tienda.",
        "",
        `Crear mi cuenta: ${acceptUrl}`,
        "",
        `Este enlace es personal y solo debe ser usado por ${email}.`,
      ].join("\n"),
      ...(resendReplyToEmail ? { reply_to: resendReplyToEmail } : {}),
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message ?? payload?.error ?? response.statusText;
    throw new Error(`Resend rejected the email (${response.status}): ${message}`);
  }

  return payload?.id ?? "unknown";
}

let data;
let error;

if (emailProvider === "resend") {
  ({ data, error } = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: inviteRedirectUrl,
      data: {
        onboarding: "store_owner",
      },
    },
  }));

  if (!error) {
    const acceptUrl = data.properties?.action_link;

    if (!acceptUrl) {
      console.error(`Could not invite ${email}: Supabase did not return an action link.`);
      process.exit(1);
    }

    try {
      const messageId = await sendWithResend({ acceptUrl });
      console.log(`Invitation sent to ${email} with Resend.`);
      console.log(`Resend message id: ${messageId}`);
    } catch (sendError) {
      console.error(`Could not send invite email to ${email}: ${sendError.message}`);
      process.exit(1);
    }
  }
} else {
  ({ data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteRedirectUrl,
    data: {
      onboarding: "store_owner",
    },
  }));
}

if (error) {
  console.error(`Could not invite ${email}: ${error.message}`);
  process.exit(1);
}

if (emailProvider === "supabase") {
  console.log(`Invitation sent to ${email} with Supabase Auth email.`);
}

console.log(`Auth user id: ${data.user?.id ?? "unknown"}`);
