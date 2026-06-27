import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const bucket = "platform-event-banners";
const maxFileSize = 5 * 1024 * 1024;

function printUsage() {
  console.error("Usage: npm run backoffice:banners -- --env-file .env.production");
  console.error("");
  console.error("Required env:");
  console.error("  NEXT_PUBLIC_SUPABASE_URL");
  console.error("  SUPABASE_SERVICE_ROLE_KEY");
  console.error("");
  console.error("Optional env:");
  console.error("  VORTEXHUB_BACKOFFICE_ACTOR_ACCOUNT_ID=<uuid for audit metadata>");
}

function parseArgs(args) {
  let envFile;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }

    if (arg === "--env-file") {
      envFile = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      envFile = arg.slice("--env-file=".length);
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  return { envFile, help: false };
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

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isWebp(buffer) {
  return buffer.length >= 12
    && buffer.toString("ascii", 0, 4) === "RIFF"
    && buffer.toString("ascii", 8, 12) === "WEBP";
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "banner";
}

function formatGame(gameId, games) {
  if (!gameId) return "Global";
  return games.find((game) => game.id === gameId)?.name ?? gameId;
}

function formatBanner(banner, games) {
  const game = formatGame(banner.game_id, games);
  const defaultLabel = banner.is_default ? "default" : "extra";
  return `${banner.name} | ${game} | ${banner.status} | ${defaultLabel} | ${banner.storage_path}`;
}

function defaultStoragePath({ name, gameId, games, existingPath }) {
  if (existingPath) return existingPath;
  const game = games.find((item) => item.id === gameId);
  const prefix = game?.slug ?? "global";
  return `platform/${prefix}-${slugify(name)}.webp`;
}

async function askRequired(rl, question, currentValue) {
  const suffix = currentValue ? ` [${currentValue}]` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  const value = answer || currentValue;

  if (!value) {
    console.log("This field is required.");
    return askRequired(rl, question, currentValue);
  }

  return value;
}

async function askOptional(rl, question, currentValue = "") {
  const suffix = currentValue ? ` [${currentValue}]` : "";
  return (await rl.question(`${question}${suffix}: `)).trim() || currentValue;
}

async function askYesNo(rl, question, defaultValue = false) {
  const label = defaultValue ? "Y/n" : "y/N";
  const answer = (await rl.question(`${question} (${label}): `)).trim().toLowerCase();

  if (!answer) return defaultValue;
  return ["y", "yes", "s", "si"].includes(answer);
}

async function chooseGame(rl, games, currentGameId = null) {
  console.log("");
  console.log("Games:");
  console.log("  0) Global fallback");
  games.forEach((game, index) => {
    const current = game.id === currentGameId ? " *" : "";
    console.log(`  ${index + 1}) ${game.name} (${game.slug})${current}`);
  });

  const currentLabel = currentGameId ? formatGame(currentGameId, games) : "Global";
  const answer = (await rl.question(`Game [${currentLabel}]: `)).trim();

  if (!answer) return currentGameId;
  if (answer === "0") return null;

  const index = Number.parseInt(answer, 10);
  if (!Number.isInteger(index) || index < 1 || index > games.length) {
    console.log("Choose a valid game number.");
    return chooseGame(rl, games, currentGameId);
  }

  return games[index - 1].id;
}

async function chooseBanner(rl, banners, games, prompt = "Banner number") {
  if (!banners.length) {
    console.log("No banners found.");
    return null;
  }

  console.log("");
  banners.forEach((banner, index) => {
    console.log(`  ${index + 1}) ${formatBanner(banner, games)}`);
  });

  const answer = (await rl.question(`${prompt}: `)).trim();
  const index = Number.parseInt(answer, 10);

  if (!Number.isInteger(index) || index < 1 || index > banners.length) {
    console.log("Choose a valid banner number.");
    return chooseBanner(rl, banners, games, prompt);
  }

  return banners[index - 1];
}

async function ensureBucket(supabase) {
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (!error && data) return;

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: maxFileSize,
    allowedMimeTypes: ["image/webp"],
  });

  if (createError && createError.message !== "The resource already exists") {
    throw createError;
  }
}

async function fetchGames(supabase) {
  const { data, error } = await supabase
    .from("games")
    .select("id, name, slug, is_active")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

async function fetchBanners(supabase) {
  const { data, error } = await supabase
    .from("platform_event_banners")
    .select("id, game_id, name, storage_path, is_default, status, created_at, updated_at")
    .order("status", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

async function validateActorAccount(supabase, actorAccountId) {
  if (!actorAccountId) return;

  const { data, error } = await supabase
    .from("user_accounts")
    .select("id, display_name, status")
    .eq("id", actorAccountId)
    .single();

  if (error) throw error;
  if (!data) throw new Error("VORTEXHUB_BACKOFFICE_ACTOR_ACCOUNT_ID was not found.");

  console.log(`Audit actor: ${data.display_name} (${data.status})`);
}

async function fetchReferences(supabase, bannerId) {
  const [eventsResult, seriesResult] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }).eq("platform_banner_id", bannerId),
    supabase.from("event_series").select("id", { count: "exact", head: true }).eq("platform_banner_id", bannerId),
  ]);

  if (eventsResult.error) throw eventsResult.error;
  if (seriesResult.error) throw seriesResult.error;

  return {
    events: eventsResult.count ?? 0,
    series: seriesResult.count ?? 0,
  };
}

async function uploadWebp(supabase, rl, { name, gameId, games, existingPath }) {
  const filePath = await askOptional(rl, "Local WebP file to upload (empty to keep/type storage path)");
  if (!filePath) return null;

  const absolutePath = resolve(process.cwd(), filePath);
  const bytes = await readFile(absolutePath);

  if (bytes.length > maxFileSize) {
    throw new Error("Banner file is larger than 5 MB.");
  }

  if (!isWebp(bytes)) {
    throw new Error("Platform banners must be WebP files.");
  }

  const storagePath = await askRequired(
    rl,
    "Storage path",
    defaultStoragePath({ name, gameId, games, existingPath }),
  );

  const upsert = await askYesNo(rl, `Upload to ${bucket}/${storagePath} with overwrite if it exists`, false);
  const { error } = await supabase.storage.from(bucket).upload(storagePath, bytes, {
    contentType: "image/webp",
    upsert,
  });

  if (error) throw error;

  return storagePath;
}

async function clearCompetingDefault(supabase, rl, {
  actorAccountId,
  gameId,
  exceptBannerId = null,
  reason,
}) {
  const query = supabase
    .from("platform_event_banners")
    .select("id, game_id, name, storage_path, is_default, status, created_at, updated_at")
    .eq("is_default", true)
    .eq("status", "active");

  const { data, error } = gameId
    ? await query.eq("game_id", gameId)
    : await query.is("game_id", null);

  if (error) throw error;

  const competing = (data ?? []).filter((banner) => banner.id !== exceptBannerId);
  if (!competing.length) return;

  console.log("");
  console.log("There is already an active default banner in this scope:");
  competing.forEach((banner) => console.log(`  - ${banner.name} (${banner.id})`));

  const confirmed = await askYesNo(rl, "Unset the existing default so this banner can become default", true);
  if (!confirmed) {
    throw new Error("Cancelled to preserve the existing default banner.");
  }

  const { error: updateError } = await supabase
    .from("platform_event_banners")
    .update({ is_default: false })
    .in("id", competing.map((banner) => banner.id));

  if (updateError) throw updateError;

  for (const banner of competing) {
    await auditBannerChange(supabase, {
      actorAccountId,
      bannerId: banner.id,
      action: "unset-competing-default",
      before: banner,
      after: { ...banner, is_default: false },
      reason,
    });
  }
}

async function auditBannerChange(supabase, { actorAccountId, bannerId, action, before, after, reason }) {
  const metadata = {
    tool: "platform-banner-backoffice",
    action,
    reason,
    before,
    after,
  };

  const { error } = await supabase.from("audit_events").insert({
    actor_account_id: actorAccountId || null,
    action: "platform_banner.changed",
    subject_type: "platform_event_banner",
    subject_id: bannerId,
    outcome: "succeeded",
    metadata,
  });

  if (error) throw error;
}

async function saveBanner(supabase, rl, { actorAccountId, banner, input, reason }) {
  if (input.status === "active" && input.is_default) {
    await clearCompetingDefault(supabase, rl, {
      actorAccountId,
      gameId: input.game_id,
      exceptBannerId: banner?.id ?? null,
      reason,
    });
  }

  if (banner) {
    const { data, error } = await supabase
      .from("platform_event_banners")
      .update(input)
      .eq("id", banner.id)
      .select("id, game_id, name, storage_path, is_default, status, created_at, updated_at")
      .single();

    if (error) throw error;

    await auditBannerChange(supabase, {
      actorAccountId,
      bannerId: data.id,
      action: "update",
      before: banner,
      after: data,
      reason,
    });

    return data;
  }

  const { data, error } = await supabase
    .from("platform_event_banners")
    .insert(input)
    .select("id, game_id, name, storage_path, is_default, status, created_at, updated_at")
    .single();

  if (error) throw error;

  await auditBannerChange(supabase, {
    actorAccountId,
    bannerId: data.id,
    action: "create",
    before: null,
    after: data,
    reason,
  });

  return data;
}

async function confirmBannerInput(rl, games, input, action) {
  console.log("");
  console.log(`${action} summary:`);
  console.log(`  name: ${input.name}`);
  console.log(`  game: ${formatGame(input.game_id, games)}`);
  console.log(`  storage: ${input.storage_path}`);
  console.log(`  status: ${input.status}`);
  console.log(`  default: ${input.is_default ? "yes" : "no"}`);

  return askYesNo(rl, "Apply this change", false);
}

async function createBanner(supabase, rl, context) {
  const games = await fetchGames(supabase);
  const name = await askRequired(rl, "Banner name");
  const gameId = await chooseGame(rl, games, null);
  const uploadPath = await uploadWebp(supabase, rl, { name, gameId, games });
  const storagePath = uploadPath ?? await askRequired(
    rl,
    "Existing storage path",
    defaultStoragePath({ name, gameId, games }),
  );
  const isDefault = await askYesNo(rl, "Make this the default banner for this scope", false);
  const status = await askYesNo(rl, "Activate banner now", true) ? "active" : "inactive";
  const reason = await askRequired(rl, "Audit reason", "platform banner backoffice create");
  const input = {
    game_id: gameId,
    name,
    storage_path: storagePath,
    is_default: isDefault && status === "active",
    status,
  };

  if (!await confirmBannerInput(rl, games, input, "Create")) return;

  const banner = await saveBanner(supabase, rl, {
    ...context,
    banner: null,
    reason,
    input,
  });

  console.log("");
  console.log(`Created: ${formatBanner(banner, games)}`);
}

async function editBanner(supabase, rl, context) {
  const games = await fetchGames(supabase);
  const banners = await fetchBanners(supabase);
  const banner = await chooseBanner(rl, banners, games, "Banner to edit");
  if (!banner) return;

  const name = await askRequired(rl, "Banner name", banner.name);
  const gameId = await chooseGame(rl, games, banner.game_id);
  const uploadPath = await uploadWebp(supabase, rl, {
    name,
    gameId,
    games,
    existingPath: banner.storage_path,
  });
  const storagePath = uploadPath ?? await askRequired(rl, "Storage path", banner.storage_path);
  const status = await askYesNo(rl, "Active", banner.status === "active") ? "active" : "inactive";
  const isDefault = status === "active"
    ? await askYesNo(rl, "Default for this scope", banner.is_default)
    : false;
  const reason = await askRequired(rl, "Audit reason", "platform banner backoffice update");
  const input = {
    game_id: gameId,
    name,
    storage_path: storagePath,
    is_default: isDefault,
    status,
  };

  if (!await confirmBannerInput(rl, games, input, "Update")) return;

  const updated = await saveBanner(supabase, rl, {
    ...context,
    banner,
    reason,
    input,
  });

  console.log("");
  console.log(`Updated: ${formatBanner(updated, games)}`);
}

async function deactivateBanner(supabase, rl, context) {
  const games = await fetchGames(supabase);
  const banners = (await fetchBanners(supabase)).filter((banner) => banner.status === "active");
  const banner = await chooseBanner(rl, banners, games, "Banner to deactivate");
  if (!banner) return;

  const references = await fetchReferences(supabase, banner.id);
  console.log("");
  console.log(`References: ${references.events} events, ${references.series} series.`);
  console.log("The row will remain available for historical pages, but it will no longer be selectable.");

  if (!await askYesNo(rl, `Deactivate ${banner.name}`, false)) return;

  const reason = await askRequired(rl, "Audit reason", "platform banner backoffice deactivate");
  const updated = await saveBanner(supabase, rl, {
    ...context,
    banner,
    reason,
    input: {
      game_id: banner.game_id,
      name: banner.name,
      storage_path: banner.storage_path,
      is_default: false,
      status: "inactive",
    },
  });

  console.log("");
  console.log(`Deactivated: ${formatBanner(updated, games)}`);
}

async function listBanners(supabase) {
  const [games, banners] = await Promise.all([fetchGames(supabase), fetchBanners(supabase)]);
  console.log("");

  if (!banners.length) {
    console.log("No platform banners found.");
    return;
  }

  for (const banner of banners) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(banner.storage_path);
    console.log(`- ${formatBanner(banner, games)}`);
    console.log(`  id: ${banner.id}`);
    console.log(`  url: ${data.publicUrl}`);
  }
}

async function mainMenu(supabase, rl, context) {
  while (true) {
    console.log("");
    console.log("Platform Banner Backoffice");
    console.log("  1) List banners");
    console.log("  2) Add banner");
    console.log("  3) Edit banner");
    console.log("  4) Deactivate banner");
    console.log("  5) Exit");

    const answer = (await rl.question("Choose an option: ")).trim();

    try {
      if (answer === "1") await listBanners(supabase);
      else if (answer === "2") await createBanner(supabase, rl, context);
      else if (answer === "3") await editBanner(supabase, rl, context);
      else if (answer === "4") await deactivateBanner(supabase, rl, context);
      else if (answer === "5" || answer.toLowerCase() === "q") return;
      else console.log("Choose 1, 2, 3, 4, or 5.");
    } catch (error) {
      console.error("");
      console.error(`Operation failed: ${error.message}`);
    }
  }
}

let args;

try {
  args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    process.exit(0);
  }
  loadEnvFile(args.envFile);
} catch (error) {
  console.error(error.message);
  printUsage();
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const actorAccountId = process.env.VORTEXHUB_BACKOFFICE_ACTOR_ACCOUNT_ID;

if (!serviceRoleKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  printUsage();
  process.exit(1);
}

if (actorAccountId && !isUuid(actorAccountId)) {
  console.error("VORTEXHUB_BACKOFFICE_ACTOR_ACCOUNT_ID must be a UUID.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const rl = createInterface({ input, output });

try {
  console.log(`Connected target: ${supabaseUrl}`);
  if (!args.envFile && supabaseUrl.includes("supabase.co")) {
    console.log("Tip: pass --env-file .env.production so the target is explicit.");
  }

  await ensureBucket(supabase);
  await validateActorAccount(supabase, actorAccountId || null);
  await mainMenu(supabase, rl, { actorAccountId: actorAccountId || null });
} finally {
  rl.close();
}
