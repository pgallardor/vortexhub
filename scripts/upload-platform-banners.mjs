import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function parseArgs(args) {
  let envFile;

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

    throw new Error(`Unexpected argument: ${arg}`);
  }

  return { envFile };
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

  const envPath = path.resolve(process.cwd(), envFile);

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

try {
  const { envFile } = parseArgs(process.argv.slice(2));
  loadEnvFile(envFile);
} catch (error) {
  console.error(error.message);
  console.error("Usage: node scripts/upload-platform-banners.mjs [--env-file .env.local]");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = "platform-event-banners";
const sourceDir = path.join(process.cwd(), "public/Banners/optimized/platform");

if (!serviceRoleKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Get it from `npm run supabase:status`, then add it to `.env.local`.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const bannerMappings = [
  { gameSlug: null, name: "VortexHub Default", fileName: "default.webp", storagePath: "platform/default.webp" },
  { gameSlug: "miscelaneo", name: "Miscelaneo Default", fileName: "miscelaneo-default.webp", storagePath: "platform/miscelaneo-default.webp" },
  { gameSlug: "otros", name: "Otros Default", fileName: "otros-default.webp", storagePath: "platform/otros-default.webp" },
  { gameSlug: "pokemon-tcg", name: "Pokemon TCG Default", fileName: "pokemon-tcg-default.webp", storagePath: "platform/pokemon-tcg-default.webp" },
  { gameSlug: "one-piece-tcg", name: "One Piece TCG Default", fileName: "one-piece-tcg-default.webp", storagePath: "platform/one-piece-tcg-default.webp" },
  { gameSlug: "mitos-y-leyendas", name: "Mitos y Leyendas Default", fileName: "mitos-y-leyendas-default.webp", storagePath: "platform/mitos-y-leyendas-default.webp" },
  { gameSlug: "digimon-tcg", name: "Digimon TCG Default", fileName: "digimon-tcg-default.webp", storagePath: "platform/digimon-tcg-default.webp" },
  { gameSlug: "yugioh", name: "Yu-Gi-Oh! Default", fileName: "yugioh-default.webp", storagePath: "platform/yugioh-default.webp" },
  { gameSlug: "riftbound", name: "Riftbound Default", fileName: "riftbound-default.webp", storagePath: "platform/riftbound-default.webp" },
  { gameSlug: "beyblade", name: "Beyblade Default", fileName: "beyblade-default.webp", storagePath: "platform/beyblade-default.webp" },
  { gameSlug: "gundam-tcg", name: "Gundam TCG Default", fileName: "gundam-tcg-default.webp", storagePath: "platform/gundam-tcg-default.webp" },
  { gameSlug: "flesh-and-blood", name: "Flesh and Blood Default", fileName: "flesh-and-blood-default.webp", storagePath: "platform/flesh-and-blood-default.webp" },
  { gameSlug: "grand-archive", name: "Grand Archive Default", fileName: "grand-archive-default.webp", storagePath: "platform/grand-archive-default.webp" },
  { gameSlug: "shadowverse-evolve", name: "Shadowverse: Evolve Default", fileName: "shadowverse-evolve-default.webp", storagePath: "platform/shadowverse-evolve-default.webp" },
];

async function ensureBucket() {
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (!error && data) return;

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/webp"],
  });

  if (createError && createError.message !== "The resource already exists") {
    throw createError;
  }
}

async function gameIdForSlug(slug) {
  if (!slug) return null;

  const { data, error } = await supabase
    .from("games")
    .select("id")
    .eq("slug", slug)
    .single();

  if (error) throw error;
  return data.id;
}

async function uploadBanner(mapping) {
  const file = await readFile(path.join(sourceDir, mapping.fileName));
  const { error } = await supabase.storage
    .from(bucket)
    .upload(mapping.storagePath, file, {
      contentType: "image/webp",
      upsert: true,
    });

  if (error) throw error;
}

async function linkBanner(mapping) {
  const gameId = await gameIdForSlug(mapping.gameSlug);
  const selectQuery = supabase
    .from("platform_event_banners")
    .select("id")
    .eq("is_default", true)
    .eq("status", "active");

  const { data: existing, error: selectError } = gameId
    ? await selectQuery.eq("game_id", gameId).maybeSingle()
    : await selectQuery.is("game_id", null).maybeSingle();

  if (selectError) throw selectError;

  if (existing) {
    const { error } = await supabase
      .from("platform_event_banners")
      .update({
        name: mapping.name,
        storage_path: mapping.storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase
    .from("platform_event_banners")
    .insert({
      game_id: gameId,
      name: mapping.name,
      storage_path: mapping.storagePath,
      is_default: true,
      status: "active",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

await ensureBucket();

for (const mapping of bannerMappings) {
  await uploadBanner(mapping);
  const bannerId = await linkBanner(mapping);
  const publicUrl = supabase.storage.from(bucket).getPublicUrl(mapping.storagePath).data.publicUrl;
  console.log(`${mapping.storagePath} -> ${bannerId}`);
  console.log(publicUrl);
}
