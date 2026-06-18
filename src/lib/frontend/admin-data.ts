import type {
  AdminDashboard,
  AdminStoreOverview,
  AdminStoreWorkspace,
  BranchSummary,
  EventSeriesSummary,
  EventSummary,
  StoreSummary,
} from "@/lib/frontend/domain";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class AdminDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminDataError";
  }
}

type StoreRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  timezone: string;
  status: StoreSummary["status"];
};

type BranchRow = {
  id: string;
  store_id: string;
  slug: string;
  name: string;
  address_line: string | null;
  city: string | null;
  region: string | null;
  status: BranchSummary["status"];
};

type GameRow = {
  id: string;
  slug: string;
  name: string;
};

export type AdminGameOption = {
  id: string;
  slug: string;
  name: string;
};

export type AdminPlatformBannerOption = {
  id: string;
  gameId: string | null;
  name: string;
  isDefault: boolean;
  storagePath: string;
  bannerUrl: string | null;
};

export type AdminStoreMediaAsset = {
  id: string;
  storeId: string;
  assetType: "store_logo" | "event_banner";
  optimizedStoragePath: string | null;
  publicUrl: string | null;
  width: number;
  height: number;
  status: "processing" | "active" | "pending_removal" | "removed" | "rejected";
  createdAt: string;
};

type GameSummary = Omit<AdminGameOption, "id">;

type PlatformBannerRow = {
  id: string;
  game_id: string | null;
  name: string;
  is_default: boolean;
  storage_path: string;
};

type EventSeriesRow = {
  id: string;
  slug: string;
  store_id: string;
  branch_id: string | null;
  title: string;
  description: string | null;
  format_name: string | null;
  status: EventSeriesSummary["status"];
  weekdays: number[];
  local_start_time: string;
  duration_minutes: number | null;
  timezone: string;
  starts_on: string;
  ends_on: string | null;
  registration_mode: EventSeriesSummary["registrationMode"];
  external_registration_url: string | null;
  location_mode: EventSeriesSummary["locationMode"];
  location_text: string | null;
  location_city: string | null;
  entry_fee_amount: number | string | null;
  entry_fee_currency: string | null;
  game_id: string;
};

type EventRow = {
  id: string;
  slug: string;
  store_id: string;
  branch_id: string | null;
  event_series_id: string | null;
  title: string;
  description: string | null;
  format_name: string | null;
  status: EventSummary["status"];
  registration_mode: EventSummary["registrationMode"];
  external_registration_url: string | null;
  starts_at: string;
  ends_at: string | null;
  entry_fee_amount: number | string | null;
  entry_fee_currency: string | null;
  location_mode: EventSummary["locationMode"];
  location_text: string | null;
  location_city: string | null;
  location_region: string | null;
  game_id: string;
  banner_mode: "platform" | "custom";
  platform_banner_id: string | null;
  custom_banner_asset_id: string | null;
  banner_position: string | null;
};

type StoreMediaAssetRow = {
  id: string;
  store_id: string;
  asset_type: "store_logo" | "event_banner";
  optimized_storage_path: string | null;
  width: number;
  height: number;
  status: AdminStoreMediaAsset["status"];
  created_at: string;
};

type AdminDataSet = {
  stores: StoreSummary[];
  branches: BranchSummary[];
  events: EventSummary[];
  series: EventSeriesSummary[];
  mediaAssets: AdminStoreMediaAsset[];
};

function bannerToneForGame(gameSlug: string): EventSummary["bannerTone"] {
  const tones: Record<string, EventSummary["bannerTone"]> = {
    "one-piece-tcg": "blue",
    "pokemon-tcg": "amber",
    yugioh: "violet",
  };

  return tones[gameSlug] ?? "rose";
}

function publicStorageUrl(bucket: string, storagePath: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return null;

  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function mapStoreMediaAsset(row: StoreMediaAssetRow): AdminStoreMediaAsset {
  return {
    id: row.id,
    storeId: row.store_id,
    assetType: row.asset_type,
    optimizedStoragePath: row.optimized_storage_path,
    publicUrl: row.optimized_storage_path
      ? publicStorageUrl("store-media-optimized", row.optimized_storage_path)
      : null,
    width: row.width,
    height: row.height,
    status: row.status,
    createdAt: row.created_at,
  };
}

function isUpcoming(event: EventSummary) {
  return new Date(event.startsAt).getTime() > Date.now() && event.status !== "cancelled";
}

function cityLabelForStore(storeId: string, branches: BranchSummary[]) {
  return branches.find((branch) => branch.storeId === storeId)?.city ?? "Online";
}

function branchAddress(branch: BranchRow) {
  return [branch.address_line, branch.city, branch.region].filter(Boolean).join(", ");
}

function mapStore(row: StoreRow, branches: BranchSummary[]): StoreSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    timezone: row.timezone,
    status: row.status,
    cityLabel: cityLabelForStore(row.id, branches),
    logoUrl: row.logo_url ?? undefined,
  };
}

function mapBranch(row: BranchRow): BranchSummary {
  return {
    id: row.id,
    storeId: row.store_id,
    slug: row.slug,
    name: row.name,
    city: row.city ?? "Sin ciudad",
    address: branchAddress(row) || "Dirección por confirmar",
    status: row.status,
  };
}

function entryFee(
  amount: number | string | null,
  currency: string | null,
): EventSummary["entryFee"] {
  if (amount == null || currency == null) return null;
  return { amount: Number(amount), currency };
}

function eventLocationLabel(row: EventRow, branch: BranchSummary | undefined) {
  if (row.location_mode === "branch") return branch?.name ?? "Sucursal";
  if (row.location_mode === "online") return row.location_text ?? "Online";
  return row.location_text ?? "Ubicación personalizada";
}

function eventCity(row: EventRow, branch: BranchSummary | undefined) {
  if (row.location_mode === "branch") return branch?.city ?? null;
  if (row.location_mode === "online") return null;
  return row.location_city;
}

function mapEvent(
  row: EventRow,
  stores: StoreSummary[],
  branches: BranchSummary[],
  series: EventSeriesSummary[],
  gamesById: Map<string, GameSummary>,
): EventSummary {
  const store = stores.find((item) => item.id === row.store_id);
  if (!store) throw new AdminDataError("Evento sin tienda accesible.");

  const game = gamesById.get(row.game_id) ?? { slug: "otros", name: "Otros" };
  const branch = branches.find((item) => item.id === row.branch_id);
  const sourceSeries = series.find((item) => item.id === row.event_series_id);
  const locationLabel = eventLocationLabel(row, branch);

  return {
    id: row.id,
    slug: row.slug,
    storeId: store.id,
    storeSlug: store.slug,
    storeName: store.name,
    branchId: row.branch_id,
    title: row.title,
    description: row.description ?? "",
    game,
    formatName: row.format_name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: store.timezone,
    status: row.status,
    registrationMode: row.registration_mode,
    externalRegistrationUrl: row.external_registration_url,
    locationMode: row.location_mode,
    locationLabel,
    branchName: locationLabel,
    address: branch?.address ?? row.location_text ?? "Dirección por confirmar",
    city: eventCity(row, branch),
    entryFee: entryFee(row.entry_fee_amount, row.entry_fee_currency),
    seriesId: row.event_series_id,
    seriesName: sourceSeries?.title ?? null,
    bannerTone: bannerToneForGame(game.slug),
    bannerMode: row.banner_mode,
    bannerPosition: row.banner_position ?? "center",
    platformBannerId: row.platform_banner_id,
    customBannerAssetId: row.custom_banner_asset_id,
  };
}

function mapSeries(
  row: EventSeriesRow,
  stores: StoreSummary[],
  branches: BranchSummary[],
  gamesById: Map<string, GameSummary>,
): EventSeriesSummary {
  const store = stores.find((item) => item.id === row.store_id);
  if (!store) throw new AdminDataError("Serie sin tienda accesible.");

  const game = gamesById.get(row.game_id) ?? { slug: "otros", name: "Otros" };
  const branch = branches.find((item) => item.id === row.branch_id);
  const locationLabel = row.location_mode === "branch"
    ? branch?.name ?? "Sucursal"
    : row.location_text ?? (row.location_mode === "online" ? "Online" : "Ubicación personalizada");

  return {
    id: row.id,
    slug: row.slug,
    storeId: row.store_id,
    branchId: row.branch_id,
    title: row.title,
    description: row.description ?? "",
    game,
    formatName: row.format_name,
    status: row.status,
    weekdays: row.weekdays,
    localStartTime: row.local_start_time.slice(0, 5),
    durationMinutes: row.duration_minutes,
    timezone: row.timezone,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    registrationMode: row.registration_mode,
    externalRegistrationUrl: row.external_registration_url,
    locationMode: row.location_mode,
    locationLabel,
    entryFee: entryFee(row.entry_fee_amount, row.entry_fee_currency),
  };
}

function buildOverview(store: StoreSummary, data: AdminDataSet): AdminStoreOverview {
  const storeEvents = data.events.filter((event) => event.storeId === store.id);

  return {
    store,
    branchCount: data.branches.filter((branch) => branch.storeId === store.id).length,
    upcomingEventCount: storeEvents.filter(isUpcoming).length,
    publishedEventCount: storeEvents.filter((event) => event.status === "published").length,
    draftEventCount: storeEvents.filter((event) => event.status === "draft").length,
  };
}

async function loadAdminData(): Promise<AdminDataSet> {
  const client = await createSupabaseServerClient();
  await requireUser(client);

  const { data: branchRows, error: branchError } = await client
    .from("branches")
    .select("id,store_id,slug,name,address_line,city,region,status")
    .is("deleted_at", null)
    .order("name");
  if (branchError) throw branchError;

  const branches = (branchRows as BranchRow[]).map(mapBranch);

  const { data: storeRows, error: storeError } = await client
    .from("stores")
    .select("id,slug,name,description,logo_url,timezone,status")
    .is("deleted_at", null)
    .order("name");
  if (storeError) throw storeError;

  const stores = (storeRows as StoreRow[]).map((row) => mapStore(row, branches));
  const storeIds = stores.map((store) => store.id);

  if (!storeIds.length) {
    return { stores, branches: [], events: [], series: [], mediaAssets: [] };
  }

  const { data: gameRows, error: gameError } = await client
    .from("games")
    .select("id,slug,name")
    .eq("is_active", true);
  if (gameError) throw gameError;

  const gamesById = new Map(
    (gameRows as GameRow[]).map((game) => [game.id, { slug: game.slug, name: game.name }]),
  );

  const { data: seriesRows, error: seriesError } = await client
    .from("event_series")
    .select(`
      id,slug,store_id,branch_id,title,description,format_name,status,weekdays,
      local_start_time,duration_minutes,timezone,starts_on,ends_on,
      registration_mode,external_registration_url,location_mode,location_text,location_city,
      entry_fee_amount,entry_fee_currency,game_id
    `)
    .in("store_id", storeIds)
    .is("deleted_at", null)
    .order("starts_on");
  if (seriesError) throw seriesError;

  const series = (seriesRows as EventSeriesRow[]).map((row) => mapSeries(row, stores, branches, gamesById));

  const { data: eventRows, error: eventError } = await client
    .from("events")
    .select(`
      id,slug,store_id,branch_id,event_series_id,title,description,format_name,status,
      registration_mode,external_registration_url,starts_at,ends_at,
      entry_fee_amount,entry_fee_currency,location_mode,location_text,location_city,location_region,
      game_id,banner_mode,platform_banner_id,custom_banner_asset_id,banner_position
    `)
    .in("store_id", storeIds)
    .is("deleted_at", null)
    .order("starts_at");
  if (eventError) throw eventError;

  const events = (eventRows as EventRow[]).map((row) => mapEvent(row, stores, branches, series, gamesById));

  const { data: mediaRows, error: mediaError } = await client
    .from("store_media_assets")
    .select("id,store_id,asset_type,optimized_storage_path,width,height,status,created_at")
    .in("store_id", storeIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (mediaError) throw mediaError;

  const mediaAssets = (mediaRows as StoreMediaAssetRow[]).map(mapStoreMediaAsset);

  return { stores, branches, events, series, mediaAssets };
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const data = await loadAdminData();
  const storeOverviews = data.stores.map((store) => buildOverview(store, data));
  const upcomingEvents = data.events
    .filter(isUpcoming)
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));

  return {
    stores: storeOverviews,
    totals: {
      storeCount: storeOverviews.length,
      branchCount: data.branches.length,
      upcomingEventCount: upcomingEvents.length,
      draftEventCount: data.events.filter((event) => event.status === "draft").length,
    },
    upcomingEvents,
  };
}

export async function getAdminStores(): Promise<AdminStoreOverview[]> {
  const data = await loadAdminData();
  return data.stores.map((store) => buildOverview(store, data));
}

export async function getAdminEventFormOptions(storeId?: string): Promise<{
  games: AdminGameOption[];
  platformBanners: AdminPlatformBannerOption[];
  customBanners: AdminStoreMediaAsset[];
}> {
  const client = await createSupabaseServerClient();
  await requireUser(client);

  const { data: gameRows, error: gameError } = await client
    .from("games")
    .select("id,slug,name")
    .eq("is_active", true)
    .order("name");
  if (gameError) throw gameError;

  const { data: bannerRows, error: bannerError } = await client
    .from("platform_event_banners")
    .select("id,game_id,name,is_default,storage_path")
    .eq("status", "active")
    .order("name");
  if (bannerError) throw bannerError;

  let customBanners: AdminStoreMediaAsset[] = [];
  if (storeId) {
    const { data: customRows, error: customError } = await client
      .from("store_media_assets")
      .select("id,store_id,asset_type,optimized_storage_path,width,height,status,created_at")
      .eq("store_id", storeId)
      .eq("asset_type", "event_banner")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (customError) throw customError;
    customBanners = (customRows as StoreMediaAssetRow[]).map(mapStoreMediaAsset);
  }

  return {
    games: (gameRows as GameRow[]).map((game) => ({
      id: game.id,
      slug: game.slug,
      name: game.name,
    })),
    platformBanners: (bannerRows as PlatformBannerRow[]).map((banner) => ({
      id: banner.id,
      gameId: banner.game_id,
      name: banner.name,
      isDefault: banner.is_default,
      storagePath: banner.storage_path,
      bannerUrl: publicStorageUrl("platform-event-banners", banner.storage_path),
    })),
    customBanners,
  };
}

export async function getAdminStoreMedia(storeId: string): Promise<AdminStoreMediaAsset[] | null> {
  const data = await loadAdminData();
  if (!data.stores.some((store) => store.id === storeId)) return null;

  return data.mediaAssets.filter((asset) => asset.storeId === storeId);
}

export async function getAdminStore(storeId: string): Promise<AdminStoreWorkspace | null> {
  const data = await loadAdminData();
  const store = data.stores.find((candidate) => candidate.id === storeId);

  if (!store) return null;

  return {
    overview: buildOverview(store, data),
    branches: data.branches.filter((branch) => branch.storeId === store.id),
    events: data.events
      .filter((event) => event.storeId === store.id)
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
    series: data.series.filter((item) => item.storeId === store.id),
  };
}

export async function getAdminStoreEvents(storeId: string): Promise<EventSummary[] | null> {
  const workspace = await getAdminStore(storeId);
  return workspace?.events ?? null;
}

export async function getAdminStoreBranches(storeId: string): Promise<BranchSummary[] | null> {
  const workspace = await getAdminStore(storeId);
  return workspace?.branches ?? null;
}

export async function getAdminEvent(storeId: string, eventId: string): Promise<EventSummary | null> {
  const storeEvents = await getAdminStoreEvents(storeId);
  return storeEvents?.find((event) => event.id === eventId) ?? null;
}

export async function getAdminStoreSeries(storeId: string): Promise<EventSeriesSummary[] | null> {
  const workspace = await getAdminStore(storeId);
  return workspace?.series ?? null;
}

export async function getAdminSeries(
  storeId: string,
  seriesId: string,
): Promise<EventSeriesSummary | null> {
  const storeSeries = await getAdminStoreSeries(storeId);
  return storeSeries?.find((series) => series.id === seriesId) ?? null;
}
