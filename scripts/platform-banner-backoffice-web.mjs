import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import sharp from "sharp";

const bucket = "platform-event-banners";
const maxFileSize = 5 * 1024 * 1024;
const maxJsonBodySize = 8 * 1024 * 1024;

function printUsage() {
  console.error("Usage: npm run backoffice:banners:web -- --env-file .env.production [--port 4317]");
}

function parseArgs(args) {
  let envFile;
  let port = 4317;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") return { help: true, envFile, port };

    if (arg === "--env-file") {
      envFile = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      envFile = arg.slice("--env-file=".length);
      continue;
    }

    if (arg === "--port") {
      port = Number.parseInt(args[index + 1], 10);
      index += 1;
      continue;
    }

    if (arg.startsWith("--port=")) {
      port = Number.parseInt(arg.slice("--port=".length), 10);
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Port must be a number between 1 and 65535.");
  }

  return { help: false, envFile, port };
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
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "banner";
}

function defaultStoragePath({ name, gameId, games }) {
  const game = games.find((item) => item.id === gameId);
  const prefix = game?.slug ?? "global";
  return `platform/${prefix}-${slugify(name)}.webp`;
}

function parseImageDataUrl(dataUrl) {
  if (!dataUrl) return null;

  const value = String(dataUrl);
  if (!value.startsWith("data:")) {
    throw new Error("The upload payload must be an in-memory image data URL, not a local file path.");
  }

  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) throw new Error("Only image data URLs are accepted.");

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > maxJsonBodySize) throw new Error("Source image payload is too large.");

  return { buffer, contentType: match[1] };
}

async function convertSourceImageToWebp(sourceImage) {
  if (!sourceImage) return null;

  const buffer = await sharp(sourceImage.buffer, { failOn: "none" })
    .resize({
      width: 1400,
      height: 720,
      fit: "cover",
      position: "center",
    })
    .webp({ quality: 86 })
    .toBuffer();

  if (buffer.length > maxFileSize) throw new Error("Converted WebP is larger than 5 MB.");
  if (!isWebp(buffer)) throw new Error("Converted banner is not a valid WebP.");

  return { buffer, contentType: "image/webp" };
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendHtml(response, html) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(html);
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxJsonBodySize) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function bannerSelectColumns() {
  return "id, game_id, name, storage_path, is_default, status, created_at, updated_at";
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
    .select(bannerSelectColumns())
    .order("status", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
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

async function fetchStorageFiles(supabase) {
  const { data, error } = await supabase.storage.from(bucket).list("platform", {
    limit: 200,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) throw error;

  return (data ?? [])
    .filter((item) => item.name && item.name !== ".emptyFolderPlaceholder")
    .map((item) => {
      const storagePath = `platform/${item.name}`;
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);

      return {
        name: item.name,
        storagePath,
        publicUrl: urlData.publicUrl,
        updatedAt: item.updated_at,
        size: item.metadata?.size ?? null,
      };
    });
}

async function statePayload(supabase, targetLabel) {
  const [games, banners, storageFiles] = await Promise.all([
    fetchGames(supabase),
    fetchBanners(supabase),
    fetchStorageFiles(supabase),
  ]);

  const references = await Promise.all(banners.map((banner) => fetchReferences(supabase, banner.id)));

  return {
    targetLabel,
    bucket,
    games,
    storageFiles,
    banners: banners.map((banner, index) => {
      const { data } = supabase.storage.from(bucket).getPublicUrl(banner.storage_path);
      return {
        id: banner.id,
        gameId: banner.game_id,
        name: banner.name,
        storagePath: banner.storage_path,
        isDefault: banner.is_default,
        status: banner.status,
        createdAt: banner.created_at,
        updatedAt: banner.updated_at,
        publicUrl: data.publicUrl,
        references: references[index],
      };
    }),
  };
}

async function auditBannerChange(supabase, { actorAccountId, bannerId, action, before, after, reason }) {
  const metadata = {
    tool: "platform-banner-backoffice-web",
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

async function clearCompetingDefault(supabase, { actorAccountId, gameId, exceptBannerId, reason }) {
  const query = supabase
    .from("platform_event_banners")
    .select(bannerSelectColumns())
    .eq("is_default", true)
    .eq("status", "active");

  const { data, error } = gameId ? await query.eq("game_id", gameId) : await query.is("game_id", null);
  if (error) throw error;

  const competing = (data ?? []).filter((banner) => banner.id !== exceptBannerId);
  if (!competing.length) return;

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

function normalizeBannerInput(payload, games) {
  const bannerId = payload.bannerId ? String(payload.bannerId) : null;
  const gameId = payload.gameId ? String(payload.gameId) : null;
  const name = String(payload.name ?? "").trim();
  const storagePath = String(payload.storagePath ?? "").trim();
  const status = payload.status === "inactive" ? "inactive" : "active";
  const isDefault = Boolean(payload.isDefault) && status === "active";
  const reason = String(payload.reason ?? "").trim();

  if (bannerId && !isUuid(bannerId)) throw new Error("Invalid banner id.");
  if (gameId && !games.some((game) => game.id === gameId)) throw new Error("Invalid game id.");
  if (name.length < 1 || name.length > 160) throw new Error("Banner name must be between 1 and 160 characters.");
  if (!storagePath || !storagePath.startsWith("platform/") || !storagePath.endsWith(".webp")) {
    throw new Error("Storage path must look like platform/name.webp.");
  }
  if (reason.length < 5 || reason.length > 500) throw new Error("Audit reason must be between 5 and 500 characters.");

  return {
    bannerId,
    input: {
      game_id: gameId,
      name,
      storage_path: storagePath,
      is_default: isDefault,
      status,
    },
    reason,
  };
}

async function saveBanner(supabase, payload, context) {
  const games = await fetchGames(supabase);
  const { bannerId, input, reason } = normalizeBannerInput(payload, games);
  const sourceImage = parseImageDataUrl(payload.fileDataUrl);
  const file = await convertSourceImageToWebp(sourceImage);

  let previous = null;
  if (bannerId) {
    const { data, error } = await supabase
      .from("platform_event_banners")
      .select(bannerSelectColumns())
      .eq("id", bannerId)
      .single();

    if (error) throw error;
    previous = data;
  }

  if (file) {
    const { error } = await supabase.storage.from(bucket).upload(input.storage_path, file.buffer, {
      contentType: file.contentType,
      upsert: Boolean(payload.overwrite),
    });

    if (error) throw error;
  }

  if (input.is_default) {
    await clearCompetingDefault(supabase, {
      actorAccountId: context.actorAccountId,
      gameId: input.game_id,
      exceptBannerId: bannerId,
      reason,
    });
  }

  if (bannerId) {
    const { data, error } = await supabase
      .from("platform_event_banners")
      .update(input)
      .eq("id", bannerId)
      .select(bannerSelectColumns())
      .single();

    if (error) throw error;

    await auditBannerChange(supabase, {
      actorAccountId: context.actorAccountId,
      bannerId: data.id,
      action: "update",
      before: previous,
      after: data,
      reason,
    });

    return data;
  }

  const { data, error } = await supabase
    .from("platform_event_banners")
    .insert(input)
    .select(bannerSelectColumns())
    .single();

  if (error) throw error;

  await auditBannerChange(supabase, {
    actorAccountId: context.actorAccountId,
    bannerId: data.id,
    action: "create",
    before: null,
    after: data,
    reason,
  });

  return data;
}

async function deactivateBanner(supabase, payload, context) {
  const bannerId = String(payload.bannerId ?? "");
  const reason = String(payload.reason ?? "").trim();

  if (!isUuid(bannerId)) throw new Error("Invalid banner id.");
  if (reason.length < 5 || reason.length > 500) throw new Error("Audit reason must be between 5 and 500 characters.");

  const { data: previous, error: selectError } = await supabase
    .from("platform_event_banners")
    .select(bannerSelectColumns())
    .eq("id", bannerId)
    .single();

  if (selectError) throw selectError;

  const input = {
    game_id: previous.game_id,
    name: previous.name,
    storage_path: previous.storage_path,
    is_default: false,
    status: "inactive",
  };

  const { data, error } = await supabase
    .from("platform_event_banners")
    .update(input)
    .eq("id", bannerId)
    .select(bannerSelectColumns())
    .single();

  if (error) throw error;

  await auditBannerChange(supabase, {
    actorAccountId: context.actorAccountId,
    bannerId: data.id,
    action: "deactivate",
    before: previous,
    after: data,
    reason,
  });

  return data;
}

async function validateActorAccount(supabase, actorAccountId) {
  if (!actorAccountId) return null;

  const { data, error } = await supabase
    .from("user_accounts")
    .select("id, display_name, status")
    .eq("id", actorAccountId)
    .single();

  if (error) throw error;
  return data;
}

function pageHtml({ targetLabel, actorLabel }) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VortexHub Banners</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0a0d12;
      --panel: #111722;
      --panel-2: #151d2a;
      --border: #2a3546;
      --text: #eef3fb;
      --muted: #94a3b8;
      --accent: #67a9ff;
      --good: #57d68d;
      --warn: #f5bf4f;
      --bad: #ff7b7b;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 14px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 24px;
      border-bottom: 1px solid var(--border);
      background: #0d121b;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    h1, h2, p { margin: 0; }
    h1 { font-size: 18px; }
    h2 { font-size: 15px; }
    small { color: var(--muted); }

    main {
      display: grid;
      grid-template-columns: minmax(340px, 430px) 1fr;
      min-height: calc(100vh - 74px);
    }

    aside {
      border-right: 1px solid var(--border);
      background: var(--panel);
      padding: 18px;
      position: sticky;
      top: 74px;
      height: calc(100vh - 74px);
      overflow: auto;
    }

    section.content {
      padding: 18px;
      overflow: hidden;
    }

    .toolbar, .row, .card-footer {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .toolbar { justify-content: space-between; margin-bottom: 16px; }

    button, input, select, textarea {
      border: 1px solid var(--border);
      background: #0d131d;
      color: var(--text);
      border-radius: 8px;
      font: inherit;
    }

    button {
      min-height: 38px;
      padding: 0 13px;
      cursor: pointer;
      font-weight: 700;
    }

    button.primary { background: var(--accent); border-color: var(--accent); color: #07111f; }
    button.danger { border-color: #6b2b35; color: #ffd6d6; }
    button:disabled { opacity: .55; cursor: wait; }

    label { display: grid; gap: 6px; margin-top: 12px; color: var(--muted); }
    input, select, textarea { width: 100%; min-height: 38px; padding: 8px 10px; }
    textarea { min-height: 76px; resize: vertical; }

    .preview {
      aspect-ratio: 1400 / 720;
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #080c12;
      display: grid;
      place-items: center;
      overflow: hidden;
      margin-bottom: 14px;
    }

    .preview img, .banner-card img, .storage-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .preview span { color: var(--muted); }
    .file-info {
      color: var(--muted);
      font-size: 12px;
      margin-top: 8px;
    }

    .checkbox {
      display: flex;
      grid-template-columns: none;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
    }

    .checkbox input { width: auto; min-height: auto; }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 14px;
    }

    .banner-card, .storage-card {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel);
      overflow: hidden;
    }

    .banner-card figure, .storage-card figure {
      margin: 0;
      aspect-ratio: 1400 / 720;
      background: #070b11;
    }

    .card-body { padding: 12px; display: grid; gap: 8px; }
    .card-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .muted { color: var(--muted); }
    .path { color: var(--muted); word-break: break-all; font-size: 12px; }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 0 8px;
      border-radius: 999px;
      border: 1px solid var(--border);
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }
    .pill.active { color: #d7ffe6; border-color: #23653e; }
    .pill.inactive { color: #ffd4d4; border-color: #69313a; }
    .pill.default { color: #fff0bf; border-color: #6d5422; }

    .tabs { display: flex; gap: 8px; margin-bottom: 14px; }
    .tab.selected { background: var(--panel-2); border-color: var(--accent); }
    .notice {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 12px;
      background: #0d131d;
      color: var(--muted);
      margin-bottom: 14px;
    }
    .error { color: var(--bad); }
    .success { color: var(--good); }

    @media (max-width: 900px) {
      main { grid-template-columns: 1fr; }
      aside { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--border); }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>VortexHub Platform Banners</h1>
      <small>${targetLabel}${actorLabel ? ` · ${actorLabel}` : ""}</small>
    </div>
    <div class="row">
      <button id="refreshButton" type="button">Refrescar</button>
      <button id="newButton" class="primary" type="button">Nuevo banner</button>
    </div>
  </header>
  <main>
    <aside>
      <div class="preview" id="preview"><span>Selecciona una imagen o un banner existente</span></div>
      <form id="bannerForm">
        <input id="bannerId" type="hidden">
        <label>Imagen fuente
          <input id="fileInput" type="file" accept="image/*">
          <p class="file-info" id="fileInfo">PNG, JPG, WebP, AVIF u otro formato soportado por el navegador. Se convierte a WebP 1400 x 720 en memoria.</p>
        </label>
        <label>Nombre
          <input id="nameInput" maxlength="160" placeholder="Pokemon TCG Default">
        </label>
        <label>Juego
          <select id="gameInput"></select>
        </label>
        <label>Storage path
          <input id="pathInput" placeholder="platform/pokemon-tcg-default.webp">
        </label>
        <label>Estado
          <select id="statusInput">
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </label>
        <label class="checkbox"><input id="defaultInput" type="checkbox"> Default para este juego/global</label>
        <label class="checkbox"><input id="overwriteInput" type="checkbox"> Sobrescribir archivo si ya existe</label>
        <label>Razón de auditoría
          <textarea id="reasonInput">platform banner visual backoffice</textarea>
        </label>
        <div class="row" style="margin-top:14px">
          <button class="primary" id="saveButton" type="submit">Guardar</button>
          <button id="resetButton" type="button">Limpiar</button>
          <button class="danger" id="deactivateButton" type="button">Desactivar</button>
        </div>
        <p id="formMessage" style="margin-top:12px"></p>
      </form>
    </aside>
    <section class="content">
      <div class="toolbar">
        <div>
          <h2 id="sectionTitle">Banners registrados</h2>
          <small id="sectionSubtitle"></small>
        </div>
        <div class="tabs">
          <button class="tab selected" data-tab="banners" type="button">Banners</button>
          <button class="tab" data-tab="storage" type="button">Storage</button>
        </div>
      </div>
      <div class="notice">La service key queda solo en este servidor local. El browser habla con APIs locales y nunca recibe credenciales de Supabase.</div>
      <div id="grid" class="grid"></div>
    </section>
  </main>
  <script>
    const state = {
      games: [],
      banners: [],
      storageFiles: [],
      selectedTab: "banners",
      selectedFileDataUrl: null,
      isConverting: false,
    };
    const els = {
      refreshButton: document.getElementById("refreshButton"),
      newButton: document.getElementById("newButton"),
      bannerForm: document.getElementById("bannerForm"),
      bannerId: document.getElementById("bannerId"),
      fileInput: document.getElementById("fileInput"),
      fileInfo: document.getElementById("fileInfo"),
      nameInput: document.getElementById("nameInput"),
      gameInput: document.getElementById("gameInput"),
      pathInput: document.getElementById("pathInput"),
      statusInput: document.getElementById("statusInput"),
      defaultInput: document.getElementById("defaultInput"),
      overwriteInput: document.getElementById("overwriteInput"),
      reasonInput: document.getElementById("reasonInput"),
      saveButton: document.getElementById("saveButton"),
      resetButton: document.getElementById("resetButton"),
      deactivateButton: document.getElementById("deactivateButton"),
      formMessage: document.getElementById("formMessage"),
      preview: document.getElementById("preview"),
      grid: document.getElementById("grid"),
      sectionTitle: document.getElementById("sectionTitle"),
      sectionSubtitle: document.getElementById("sectionSubtitle"),
      tabs: Array.from(document.querySelectorAll(".tab")),
    };

    function slugify(value) {
      return String(value)
        .normalize("NFD")
        .replace(/[\\u0300-\\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "banner";
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function gameName(gameId) {
      if (!gameId) return "Global";
      return state.games.find((game) => game.id === gameId)?.name ?? gameId;
    }

    function defaultPath() {
      const game = state.games.find((item) => item.id === els.gameInput.value);
      return "platform/" + (game?.slug ?? "global") + "-" + slugify(els.nameInput.value || "banner") + ".webp";
    }

    function setMessage(message, type = "") {
      els.formMessage.className = type;
      els.formMessage.textContent = message;
    }

    function renderPreview(url) {
      els.preview.innerHTML = url ? '<img alt="Preview" src="' + url + '">' : '<span>Selecciona una imagen o un banner existente</span>';
    }

    function formatBytes(bytes) {
      if (!Number.isFinite(bytes)) return "tamano desconocido";
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
      return (bytes / 1024 / 1024).toFixed(2) + " MB";
    }

    function blobToDataUrl(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("No se pudo preparar el WebP convertido."));
        reader.readAsDataURL(blob);
      });
    }

    function loadImageFromFile(file) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
          URL.revokeObjectURL(url);
          resolve(image);
        };
        image.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("El navegador no pudo leer esta imagen."));
        };
        image.src = url;
      });
    }

    function canvasToImageBlob(canvas, quality) {
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("El navegador no pudo preparar la imagen."));
            return;
          }
          resolve(blob);
        }, "image/webp", quality);
      });
    }

    async function convertImageToBannerWebp(file) {
      const image = await loadImageFromFile(file);
      const targetWidth = 1400;
      const targetHeight = 720;
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo preparar el lienzo de conversion.");

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const sourceWidth = image.naturalWidth || image.width;
      const sourceHeight = image.naturalHeight || image.height;
      const sourceRatio = sourceWidth / sourceHeight;
      const targetRatio = targetWidth / targetHeight;
      let cropX = 0;
      let cropY = 0;
      let cropWidth = sourceWidth;
      let cropHeight = sourceHeight;

      if (sourceRatio > targetRatio) {
        cropWidth = sourceHeight * targetRatio;
        cropX = (sourceWidth - cropWidth) / 2;
      } else {
        cropHeight = sourceWidth / targetRatio;
        cropY = (sourceHeight - cropHeight) / 2;
      }

      context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);

      const blob = await canvasToImageBlob(canvas, 0.86);
      if (blob.size > ${maxJsonBodySize}) {
        throw new Error("La imagen preparada supera el limite de memoria del backoffice.");
      }

      return {
        dataUrl: await blobToDataUrl(blob),
        outputBytes: blob.size,
        outputMime: blob.type || "image/unknown",
        sourceWidth,
        sourceHeight,
        targetWidth,
        targetHeight,
      };
    }

    function resetForm() {
      els.bannerId.value = "";
      els.fileInput.value = "";
      els.nameInput.value = "";
      els.gameInput.value = "";
      els.pathInput.value = "";
      els.statusInput.value = "active";
      els.defaultInput.checked = false;
      els.overwriteInput.checked = false;
      els.reasonInput.value = "platform banner visual backoffice";
      state.selectedFileDataUrl = null;
      state.isConverting = false;
      els.saveButton.disabled = false;
      els.fileInfo.textContent = "PNG, JPG, WebP, AVIF u otro formato soportado por el navegador. Se convierte a WebP 1400 x 720 en memoria.";
      renderPreview(null);
      setMessage("");
    }

    function editBanner(banner) {
      els.bannerId.value = banner.id;
      els.fileInput.value = "";
      els.nameInput.value = banner.name;
      els.gameInput.value = banner.gameId ?? "";
      els.pathInput.value = banner.storagePath;
      els.statusInput.value = banner.status;
      els.defaultInput.checked = banner.isDefault;
      els.overwriteInput.checked = false;
      state.selectedFileDataUrl = null;
      state.isConverting = false;
      els.saveButton.disabled = false;
      els.fileInfo.textContent = "Usando archivo ya publicado en Storage.";
      renderPreview(banner.publicUrl);
      setMessage("Editando " + banner.name);
    }

    function useStorageFile(file) {
      els.fileInput.value = "";
      els.pathInput.value = file.storagePath;
      state.selectedFileDataUrl = null;
      state.isConverting = false;
      els.saveButton.disabled = false;
      els.fileInfo.textContent = "Usando archivo ya publicado en Storage.";
      renderPreview(file.publicUrl);
      setMessage("Usando archivo existente: " + file.storagePath);
    }

    function renderGameOptions() {
      els.gameInput.innerHTML = '<option value="">Global fallback</option>' + state.games
        .filter((game) => game.is_active)
        .map((game) => '<option value="' + game.id + '">' + escapeHtml(game.name) + '</option>')
        .join("");
    }

    function renderBanners() {
      els.sectionTitle.textContent = "Banners registrados";
      els.sectionSubtitle.textContent = state.banners.length + " registros en platform_event_banners";
      els.grid.innerHTML = state.banners.map((banner) => {
        const refs = banner.references ?? { events: 0, series: 0 };
        return '<article class="banner-card">' +
          '<figure><img alt="' + escapeHtml(banner.name) + '" src="' + escapeHtml(banner.publicUrl) + '"></figure>' +
          '<div class="card-body">' +
          '<div class="card-title"><h2>' + escapeHtml(banner.name) + '</h2><span class="pill ' + banner.status + '">' + banner.status + '</span></div>' +
          '<div class="row"><span class="pill">' + escapeHtml(gameName(banner.gameId)) + '</span>' +
          (banner.isDefault ? '<span class="pill default">default</span>' : '<span class="pill">extra</span>') + '</div>' +
          '<p class="path">' + escapeHtml(banner.storagePath) + '</p>' +
          '<small>' + refs.events + ' eventos · ' + refs.series + ' series</small>' +
          '<div class="card-footer"><button type="button" data-edit="' + banner.id + '">Editar</button></div>' +
          '</div></article>';
      }).join("");

      els.grid.querySelectorAll("[data-edit]").forEach((button) => {
        button.addEventListener("click", () => editBanner(state.banners.find((banner) => banner.id === button.dataset.edit)));
      });
    }

    function renderStorage() {
      els.sectionTitle.textContent = "Archivos en Storage";
      els.sectionSubtitle.textContent = state.storageFiles.length + " archivos en platform/";
      els.grid.innerHTML = state.storageFiles.map((file) => {
        return '<article class="storage-card">' +
          '<figure><img alt="' + escapeHtml(file.name) + '" src="' + escapeHtml(file.publicUrl) + '"></figure>' +
          '<div class="card-body">' +
          '<h2>' + escapeHtml(file.name) + '</h2>' +
          '<p class="path">' + escapeHtml(file.storagePath) + '</p>' +
          '<small>' + (file.size ? Math.round(file.size / 1024) + " KB" : "Tamano desconocido") + '</small>' +
          '<div class="card-footer"><button type="button" data-use="' + escapeHtml(file.storagePath) + '">Usar archivo</button></div>' +
          '</div></article>';
      }).join("");

      els.grid.querySelectorAll("[data-use]").forEach((button) => {
        button.addEventListener("click", () => useStorageFile(state.storageFiles.find((file) => file.storagePath === button.dataset.use)));
      });
    }

    function render() {
      renderGameOptions();
      if (state.selectedTab === "storage") renderStorage();
      else renderBanners();
      els.tabs.forEach((tab) => tab.classList.toggle("selected", tab.dataset.tab === state.selectedTab));
    }

    async function loadState() {
      const response = await fetch("/api/state");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar estado.");
      state.games = payload.games;
      state.banners = payload.banners;
      state.storageFiles = payload.storageFiles;
      render();
    }

    async function saveBanner(event) {
      event.preventDefault();
      if (state.isConverting) {
        setMessage("Espera a que termine la conversion antes de guardar.", "error");
        return;
      }

      if (state.selectedFileDataUrl && !state.selectedFileDataUrl.startsWith("data:image/")) {
        setMessage("La imagen seleccionada no quedo preparada como data URL. Seleccionala de nuevo.", "error");
        return;
      }

      els.saveButton.disabled = true;
      setMessage("Guardando...");

      try {
        const payload = {
          bannerId: els.bannerId.value || null,
          name: els.nameInput.value,
          gameId: els.gameInput.value || null,
          storagePath: els.pathInput.value || defaultPath(),
          status: els.statusInput.value,
          isDefault: els.defaultInput.checked,
          overwrite: els.overwriteInput.checked,
          reason: els.reasonInput.value,
          fileDataUrl: state.selectedFileDataUrl,
        };

        const response = await fetch("/api/banners/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "No se pudo guardar.");

        await loadState();
        editBanner(state.banners.find((banner) => banner.id === result.banner.id));
        setMessage("Guardado correctamente.", "success");
      } catch (error) {
        setMessage(error.message, "error");
      } finally {
        els.saveButton.disabled = false;
      }
    }

    async function deactivateSelected() {
      if (!els.bannerId.value) {
        setMessage("Selecciona un banner registrado primero.", "error");
        return;
      }

      if (!confirm("Desactivar este banner? Los eventos historicos conservaran la referencia.")) return;

      const response = await fetch("/api/banners/deactivate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bannerId: els.bannerId.value, reason: els.reasonInput.value }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "No se pudo desactivar.", "error");
        return;
      }

      await loadState();
      editBanner(state.banners.find((banner) => banner.id === result.banner.id));
      setMessage("Banner desactivado.", "success");
    }

    els.fileInput.addEventListener("change", async () => {
      const file = els.fileInput.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setMessage("Selecciona un archivo de imagen.", "error");
        els.fileInput.value = "";
        return;
      }

      setMessage("Convirtiendo imagen a WebP...");
      els.fileInfo.textContent = "Convirtiendo " + file.name + " desde " + (file.type || "formato desconocido") + "...";
      state.isConverting = true;
      els.saveButton.disabled = true;

      try {
        const converted = await convertImageToBannerWebp(file);
        state.selectedFileDataUrl = converted.dataUrl;
        renderPreview(converted.dataUrl);
        if (!els.nameInput.value) els.nameInput.value = file.name.replace(/\\.[^.]+$/i, "").replace(/[-_]+/g, " ");
        if (!els.pathInput.value) els.pathInput.value = defaultPath();
        const finalNote = converted.outputMime === "image/webp"
          ? "WebP listo para subir"
          : "preview listo; el servidor local lo convertira a WebP al guardar";
        els.fileInfo.textContent = "Original: " + converted.sourceWidth + " x " + converted.sourceHeight + " · "
          + formatBytes(file.size) + ". Preparado: "
          + converted.targetWidth + " x " + converted.targetHeight + " · "
          + formatBytes(converted.outputBytes) + " · " + finalNote + ".";
        setMessage("Imagen preparada en memoria. Aun no se ha subido a Storage.", "success");
      } catch (error) {
        state.selectedFileDataUrl = null;
        renderPreview(null);
        els.fileInput.value = "";
        els.fileInfo.textContent = "No se pudo convertir esta imagen.";
        setMessage(error.message, "error");
      } finally {
        state.isConverting = false;
        els.saveButton.disabled = false;
      }
    });

    els.nameInput.addEventListener("input", () => {
      if (!els.bannerId.value && !els.pathInput.value) els.pathInput.value = defaultPath();
    });
    els.gameInput.addEventListener("change", () => {
      if (!els.bannerId.value) els.pathInput.value = defaultPath();
    });
    els.bannerForm.addEventListener("submit", saveBanner);
    els.resetButton.addEventListener("click", resetForm);
    els.newButton.addEventListener("click", resetForm);
    els.refreshButton.addEventListener("click", loadState);
    els.deactivateButton.addEventListener("click", deactivateSelected);
    els.tabs.forEach((tab) => tab.addEventListener("click", () => {
      state.selectedTab = tab.dataset.tab;
      render();
    }));

    loadState().catch((error) => setMessage(error.message, "error"));
  </script>
</body>
</html>`;
}

async function route(request, response, context) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === "GET" && url.pathname === "/") {
      sendHtml(response, pageHtml(context));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/state") {
      sendJson(response, 200, await statePayload(context.supabase, context.targetLabel));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/banners/save") {
      const payload = await readJsonBody(request);
      const banner = await saveBanner(context.supabase, payload, context);
      sendJson(response, 200, { banner });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/banners/deactivate") {
      const payload = await readJsonBody(request);
      const banner = await deactivateBanner(context.supabase, payload, context);
      sendJson(response, 200, { banner });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 400, { error: error.message });
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
const actorAccountId = process.env.VORTEXHUB_BACKOFFICE_ACTOR_ACCOUNT_ID || null;

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

await ensureBucket(supabase);
const actor = await validateActorAccount(supabase, actorAccountId);
const actorLabel = actor ? `${actor.display_name} (${actor.status})` : "";
const context = {
  actorAccountId,
  actorLabel,
  supabase,
  targetLabel: supabaseUrl,
};

const server = createServer((request, response) => {
  route(request, response, context);
});

server.listen(args.port, "127.0.0.1", () => {
  console.log(`Platform banner visual backoffice: http://127.0.0.1:${args.port}`);
  console.log(`Connected target: ${supabaseUrl}`);
  if (actorLabel) console.log(`Audit actor: ${actorLabel}`);
});
