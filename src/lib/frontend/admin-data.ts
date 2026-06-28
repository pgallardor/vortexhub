import type {
  AdminDashboard,
  AdminStoreOverview,
  AdminStoreTeam,
  AdminStoreWorkspace,
  BranchSummary,
  EventSeriesSummary,
  EventSummary,
  StorePendingInvitation,
  StoreSummary,
  StoreTeamMember,
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
  is_publicly_visible: boolean | null;
};

type ViewerMembershipRow = {
  store_id: string;
  role: StoreTeamMember["role"];
  scope: StoreTeamMember["scope"];
  status: StoreTeamMember["status"];
};

type BranchRow = {
  id: string;
  store_id: string;
  slug: string;
  name: string;
  address_line: string | null;
  city: string | null;
  region: string | null;
  country_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  timezone: string | null;
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
  displayName: string | null;
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
  other_game_name: string | null;
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
  location_region: string | null;
  location_country_code: string | null;
  entry_fee_amount: number | string | null;
  entry_fee_currency: string | null;
  game_id: string;
  banner_mode: "platform" | "custom";
  platform_banner_id: string | null;
  custom_banner_asset_id: string | null;
  banner_position: string | null;
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
  display_name: string | null;
  optimized_storage_path: string | null;
  width: number;
  height: number;
  status: AdminStoreMediaAsset["status"];
  created_at: string;
};

type MembershipAssignmentRow = {
  branch_id: string;
  branches: {
    name: string;
  } | { name: string }[] | null;
};

type StoreMembershipRow = {
  id: string;
  store_id: string;
  user_account_id: string;
  role: StoreTeamMember["role"];
  scope: StoreTeamMember["scope"];
  status: StoreTeamMember["status"];
  accepted_at: string;
  user_accounts: {
    display_name: string;
    status: StoreTeamMember["accountStatus"];
  } | { display_name: string; status: StoreTeamMember["accountStatus"] }[] | null;
  branch_membership_assignments: MembershipAssignmentRow[] | null;
};

type InvitationBranchRow = {
  branch_id: string;
  branches: {
    name: string;
  } | { name: string }[] | null;
};

type StoreInvitationRow = {
  id: string;
  store_id: string;
  email_normalized: string;
  role: StorePendingInvitation["role"];
  scope: StorePendingInvitation["scope"];
  status: StorePendingInvitation["status"];
  expires_at: string;
  created_at: string;
  accepted_by_account_id: string | null;
  store_membership_invitation_branches: InvitationBranchRow[] | null;
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
    displayName: row.display_name,
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

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapStoreTeamMember(row: StoreMembershipRow, invitedEmailByAccountId = new Map<string, string>()): StoreTeamMember {
  const assignments = row.branch_membership_assignments ?? [];
  const account = firstRelation(row.user_accounts);
  const invitedEmail = invitedEmailByAccountId.get(row.user_account_id);

  return {
    id: row.id,
    storeId: row.store_id,
    userAccountId: row.user_account_id,
    displayName: account?.display_name ?? invitedEmail ?? "Usuario de tienda",
    accountStatus: account?.status ?? "pending",
    role: row.role,
    scope: row.scope,
    status: row.status,
    acceptedAt: row.accepted_at,
    branchIds: assignments.map((assignment) => assignment.branch_id),
    branchNames: assignments
      .map((assignment) => firstRelation(assignment.branches)?.name)
      .filter((name): name is string => Boolean(name)),
  };
}

function mapStoreInvitation(row: StoreInvitationRow): StorePendingInvitation {
  const branches = row.store_membership_invitation_branches ?? [];

  return {
    id: row.id,
    storeId: row.store_id,
    email: row.email_normalized,
    role: row.role,
    scope: row.scope,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    branchIds: branches.map((branch) => branch.branch_id),
    branchNames: branches
      .map((branch) => firstRelation(branch.branches)?.name)
      .filter((name): name is string => Boolean(name)),
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

function mapStore(
  row: StoreRow,
  branches: BranchSummary[],
  viewerMembershipsByStoreId = new Map<string, ViewerMembershipRow>(),
): StoreSummary {
  const viewerMembership = viewerMembershipsByStoreId.get(row.id);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    timezone: row.timezone,
    status: row.status,
    isPubliclyVisible: row.is_publicly_visible ?? true,
    cityLabel: cityLabelForStore(row.id, branches),
    logoUrl: row.logo_url ?? undefined,
    viewerMembership: viewerMembership
      ? {
        role: viewerMembership.role,
        scope: viewerMembership.scope,
        status: viewerMembership.status,
      }
      : undefined,
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
    region: row.region,
    countryCode: row.country_code,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    timezone: row.timezone,
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
    region: branch?.region ?? row.location_region,
    countryCode: branch?.countryCode ?? null,
    latitude: branch?.latitude ?? null,
    longitude: branch?.longitude ?? null,
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
    otherGameName: row.other_game_name,
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
    locationCity: row.location_city,
    locationRegion: row.location_region,
    locationCountryCode: row.location_country_code,
    entryFee: entryFee(row.entry_fee_amount, row.entry_fee_currency),
    bannerMode: row.banner_mode,
    bannerPosition: row.banner_position ?? "center",
    platformBannerId: row.platform_banner_id,
    customBannerAssetId: row.custom_banner_asset_id,
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
  const user = await requireUser(client);

  const { data: branchRows, error: branchError } = await client
    .from("branches")
    .select("id,store_id,slug,name,address_line,city,region,country_code,latitude,longitude,timezone,status")
    .is("deleted_at", null)
    .order("name");
  if (branchError) throw branchError;

  const branches = (branchRows as BranchRow[]).map(mapBranch);

  const { data: storeRows, error: storeError } = await client
    .from("stores")
    .select("id,slug,name,description,logo_url,timezone,status,is_publicly_visible")
    .is("deleted_at", null)
    .order("name");
  if (storeError) throw storeError;

  const storeIdsFromRows = (storeRows as StoreRow[]).map((store) => store.id);
  let viewerMembershipRows: ViewerMembershipRow[] = [];
  if (storeIdsFromRows.length) {
    const { data, error: viewerMembershipError } = await client
      .from("store_memberships")
      .select("store_id,role,scope,status")
      .eq("user_account_id", user.id)
      .eq("status", "active")
      .is("deleted_at", null)
      .in("store_id", storeIdsFromRows);
    if (viewerMembershipError) throw viewerMembershipError;
    viewerMembershipRows = data as ViewerMembershipRow[];
  }

  const viewerMembershipsByStoreId = new Map(
    viewerMembershipRows.map((membership) => [membership.store_id, membership]),
  );
  const stores = (storeRows as StoreRow[]).map((row) => mapStore(row, branches, viewerMembershipsByStoreId));
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
      location_region,location_country_code,entry_fee_amount,entry_fee_currency,game_id,other_game_name,
      banner_mode,platform_banner_id,custom_banner_asset_id,banner_position
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
    .select("id,store_id,asset_type,display_name,optimized_storage_path,width,height,status,created_at")
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
      .select("id,store_id,asset_type,display_name,optimized_storage_path,width,height,status,created_at")
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

export async function getAdminStoreTeam(storeId: string): Promise<AdminStoreTeam | null> {
  const workspace = await getAdminStore(storeId);
  if (!workspace) return null;
  if (!["owner", "admin"].includes(workspace.overview.store.viewerMembership?.role ?? "")) {
    return null;
  }

  const client = await createSupabaseServerClient();
  await requireUser(client);

  const { data: memberRows, error: memberError } = await client
    .from("store_memberships")
    .select(`
      id,store_id,user_account_id,role,scope,status,accepted_at,
      user_accounts(display_name,status),
      branch_membership_assignments(branch_id,branches(name))
    `)
    .eq("store_id", storeId)
    .is("deleted_at", null)
    .order("role")
    .order("accepted_at");
  if (memberError) throw memberError;

  const { data: invitationRows, error: invitationError } = await client
    .from("store_membership_invitations")
    .select(`
      id,store_id,email_normalized,role,scope,status,expires_at,created_at,accepted_by_account_id,
      store_membership_invitation_branches(branch_id,branches(name))
    `)
    .eq("store_id", storeId)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false });
  if (invitationError) throw invitationError;
  const invitations = (invitationRows as unknown as StoreInvitationRow[]).map(mapStoreInvitation);
  const invitedEmailByAccountId = new Map(
    (invitationRows as unknown as StoreInvitationRow[])
      .filter((invitation) => invitation.status === "accepted" && invitation.accepted_by_account_id)
      .map((invitation) => [invitation.accepted_by_account_id as string, invitation.email_normalized]),
  );

  return {
    store: workspace.overview.store,
    branches: workspace.branches,
    members: (memberRows as unknown as StoreMembershipRow[])
      .map((member) => mapStoreTeamMember(member, invitedEmailByAccountId)),
    invitations: invitations.filter((invitation) => invitation.status === "pending"),
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
