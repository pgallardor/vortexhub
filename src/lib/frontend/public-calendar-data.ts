import type {
  BranchSummary,
  EventSummary,
  GameSummary,
  PublicStoreCalendar,
  StoreSummary,
} from "@/lib/frontend/domain";

export type PublicCalendarItem = {
  storeSlug: string;
  storeName: string;
  eventSlug: string;
  title: string;
  gameSlug: string;
  gameName: string;
  startsAt: string;
  endsAt: string | null;
  city: string | null;
  registrationMode: EventSummary["registrationMode"];
  locationMode: EventSummary["locationMode"];
  status: EventSummary["status"];
  bannerMode: "platform" | "custom";
  bannerPosition: string | null;
  platformBannerName: string | null;
  platformBannerStoragePath: string | null;
  customBannerOptimizedStoragePath: string | null;
};

export type PublicCalendarResult = {
  items: PublicCalendarItem[];
  nextCursor: string | null;
};

export type PublicEventDetail = {
  storeSlug: string;
  storeName: string;
  eventSlug: string;
  title: string;
  description: string | null;
  formatName: string | null;
  status: EventSummary["status"];
  gameSlug: string;
  gameName: string;
  otherGameName: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  registrationMode: EventSummary["registrationMode"];
  externalRegistrationUrl: string | null;
  locationMode: EventSummary["locationMode"];
  locationText: string | null;
  locationCity: string | null;
  locationRegion: string | null;
  locationCountryCode: string | null;
  branchId?: string | null;
  branchName: string | null;
  branchAddressLine: string | null;
  branchLatitude?: number | string | null;
  branchLongitude?: number | string | null;
  entryFeeAmount: number | string | null;
  entryFeeCurrency: string | null;
  bannerMode: "platform" | "custom";
  bannerPosition: string | null;
  platformBannerName: string | null;
  platformBannerStoragePath: string | null;
  customBannerOptimizedStoragePath: string | null;
  cancellationMessage: string | null;
  archivedAt: string | null;
};

export type PublicStoreCalendarPayload = {
  store: StoreSummary;
  branches: BranchSummary[];
  games: GameSummary[];
  events: PublicEventDetail[];
};

function bannerToneForGame(gameSlug: string): EventSummary["bannerTone"] {
  const tones: Record<string, EventSummary["bannerTone"]> = {
    "one-piece-tcg": "blue",
    "pokemon-tcg": "amber",
    yugioh: "violet",
  };

  return tones[gameSlug] ?? "rose";
}

function cityLabel(item: PublicCalendarItem) {
  return item.locationMode === "online" ? "Online" : item.city ?? "Por confirmar";
}

function publicStorageUrl(bucket: string, storagePath: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return null;

  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function demoPlatformBannerUrl(storagePath: string | null) {
  if (!storagePath) return null;

  const demoPaths = new Set([
    "platform/default.webp",
    "platform/one-piece-tcg-default.webp",
    "platform/pokemon-tcg-default.webp",
    "platform/yugioh-default.webp",
  ]);

  return demoPaths.has(storagePath) ? `/demo/platform-banners/${storagePath}` : null;
}

function platformBannerUrl(storagePath: string | null) {
  if (!storagePath) return null;

  return publicStorageUrl("platform-event-banners", storagePath)
    ?? demoPlatformBannerUrl(storagePath);
}

function customBannerUrl(storagePath: string | null) {
  if (!storagePath) return null;
  return publicStorageUrl("store-media-optimized", storagePath);
}

function defaultPlatformBannerPath(gameSlug: string) {
  const paths: Record<string, string> = {
    "one-piece-tcg": "platform/one-piece-tcg-default.webp",
    "pokemon-tcg": "platform/pokemon-tcg-default.webp",
    yugioh: "platform/yugioh-default.webp",
  };

  return paths[gameSlug] ?? "platform/default.webp";
}

function gameNameForDisplay(gameSlug: string, gameName: string, otherGameName?: string | null) {
  return gameSlug === "otros" && otherGameName ? otherGameName : gameName;
}

function locationLabelForDetail(item: PublicEventDetail) {
  if (item.locationMode === "online") return item.locationText ?? "Online";
  if (item.locationMode === "custom") return item.locationText ?? "Ubicación personalizada";

  return item.branchName ? `${item.storeName} · ${item.branchName}` : item.storeName;
}

function addressForDetail(item: PublicEventDetail) {
  if (item.locationMode === "online") return item.locationText ?? "Online";

  const parts = item.locationMode === "branch"
    ? [item.branchAddressLine, item.locationCity, item.locationRegion]
    : [item.locationText, item.locationCity, item.locationRegion];

  return parts.filter(Boolean).join(", ") || "Dirección por confirmar";
}

function entryFeeForDetail(item: PublicEventDetail): EventSummary["entryFee"] {
  if (item.entryFeeAmount == null || item.entryFeeCurrency == null) return null;

  return {
    amount: Number(item.entryFeeAmount),
    currency: item.entryFeeCurrency,
  };
}

export function mapPublicCalendarItem(
  item: PublicCalendarItem,
  timeZone: string,
): EventSummary {
  const locationLabel = item.locationMode === "online"
    ? "Online"
    : `${item.storeName} · ${cityLabel(item)}`;
  const platformBannerPath = item.platformBannerStoragePath ?? defaultPlatformBannerPath(item.gameSlug);
  const bannerUrl = item.bannerMode === "custom"
    ? customBannerUrl(item.customBannerOptimizedStoragePath) ?? platformBannerUrl(platformBannerPath)
    : platformBannerUrl(platformBannerPath);

  return {
    id: `${item.storeSlug}:${item.eventSlug}`,
    slug: item.eventSlug,
    storeId: item.storeSlug,
    storeSlug: item.storeSlug,
    storeName: item.storeName,
    branchId: null,
    title: item.title,
    description: "",
    game: { slug: item.gameSlug, name: item.gameName },
    formatName: null,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    timezone: timeZone,
    status: item.status,
    registrationMode: item.registrationMode,
    externalRegistrationUrl: null,
    locationMode: item.locationMode,
    locationLabel,
    branchName: item.locationMode === "online" ? "Online" : "Sucursal",
    address: locationLabel,
    city: item.locationMode === "online" ? null : item.city,
    entryFee: null,
    seriesId: null,
    seriesName: null,
    bannerTone: bannerToneForGame(item.gameSlug),
    bannerUrl: bannerUrl ?? undefined,
    bannerPosition: item.bannerPosition ?? "center",
  };
}

export function mapPublicEventDetail(item: PublicEventDetail): EventSummary {
  const platformBannerPath = item.platformBannerStoragePath ?? defaultPlatformBannerPath(item.gameSlug);
  const timezone = item.timezone ?? "America/Santiago";
  const bannerUrl = item.bannerMode === "custom"
    ? customBannerUrl(item.customBannerOptimizedStoragePath) ?? platformBannerUrl(platformBannerPath)
    : platformBannerUrl(platformBannerPath);

  return {
    id: `${item.storeSlug}:${item.eventSlug}`,
    slug: item.eventSlug,
    storeId: item.storeSlug,
    storeSlug: item.storeSlug,
    storeName: item.storeName,
    branchId: item.branchId ?? null,
    title: item.title,
    description: item.description ?? "",
    game: {
      slug: item.gameSlug,
      name: gameNameForDisplay(item.gameSlug, item.gameName, item.otherGameName),
    },
    formatName: item.formatName,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    timezone,
    status: item.status,
    registrationMode: item.registrationMode,
    externalRegistrationUrl: item.externalRegistrationUrl,
    locationMode: item.locationMode,
    locationLabel: locationLabelForDetail(item),
    branchName: item.locationMode === "online" ? "Online" : item.branchName ?? "Ubicación",
    address: addressForDetail(item),
    city: item.locationMode === "online" ? null : item.locationCity,
    region: item.locationMode === "online" ? null : item.locationRegion,
    countryCode: item.locationMode === "online" ? null : item.locationCountryCode,
    latitude: item.locationMode === "branch" && item.branchLatitude != null
      ? Number(item.branchLatitude)
      : null,
    longitude: item.locationMode === "branch" && item.branchLongitude != null
      ? Number(item.branchLongitude)
      : null,
    entryFee: entryFeeForDetail(item),
    seriesId: null,
    seriesName: null,
    bannerTone: bannerToneForGame(item.gameSlug),
    bannerUrl: bannerUrl ?? undefined,
    bannerPosition: item.bannerPosition ?? "center",
  };
}

export function mapPublicStoreCalendar(
  payload: PublicStoreCalendarPayload,
): PublicStoreCalendar {
  const events = payload.events.map(mapPublicEventDetail);
  const games = Array.from(
    events.reduce((items, event) => {
      items.set(event.game.slug, event.game);
      return items;
    }, new Map<string, GameSummary>()),
  ).map(([, game]) => game)
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    store: { ...payload.store, isPubliclyVisible: payload.store.isPubliclyVisible ?? true },
    branches: payload.branches,
    games,
    events,
  };
}

export function deriveStoresFromEvents(
  events: EventSummary[],
  storeCatalog: StoreSummary[] = [],
): StoreSummary[] {
  const storesBySlug = new Map(storeCatalog.map((store) => [store.slug, store]));

  return Array.from(
    events.reduce((stores, event) => {
      if (!stores.has(event.storeSlug)) {
        const catalogStore = storesBySlug.get(event.storeSlug);

        stores.set(event.storeSlug, {
          id: catalogStore?.id ?? event.storeId,
          slug: event.storeSlug,
          name: catalogStore?.name ?? event.storeName,
          description: catalogStore?.description || `Eventos publicados por ${event.storeName}.`,
          timezone: catalogStore?.timezone ?? event.timezone,
          status: "active",
          isPubliclyVisible: catalogStore?.isPubliclyVisible ?? true,
          cityLabel: catalogStore?.cityLabel ?? event.city ?? "Online",
          logoUrl: catalogStore?.logoUrl,
        });
      }
      return stores;
    }, new Map<string, StoreSummary>()),
  ).map(([, store]) => store);
}
