import type {
  BranchSummary,
  EventSeriesSummary,
  EventSummary,
  StoreSummary,
} from "@/lib/frontend/domain";

export const stores: StoreSummary[] = [
  {
    id: "store-iron-gate",
    slug: "iron-gate-games",
    name: "Iron Gate Games",
    description: "Torneos, ligas semanales y comunidad TCG en Madrid.",
    timezone: "Europe/Madrid",
    status: "active",
    cityLabel: "Madrid",
    logoUrl: "/demo/store-logo-placeholder.png",
  },
  {
    id: "store-card-kingdom",
    slug: "card-kingdom",
    name: "Card Kingdom",
    description: "Eventos casuales y competitivos para todos los niveles.",
    timezone: "Europe/Madrid",
    status: "active",
    cityLabel: "Barcelona",
    logoUrl: "/demo/store-logo-placeholder.png",
  },
];

export const branches: BranchSummary[] = [
  {
    id: "branch-iron-centro",
    storeId: "store-iron-gate",
    slug: "madrid-centro",
    name: "Madrid Centro",
    city: "Madrid",
    address: "Calle del Vórtice 24",
    region: "Comunidad de Madrid",
    countryCode: "ES",
    latitude: 40.416775,
    longitude: -3.70379,
    timezone: "Europe/Madrid",
    status: "active",
  },
  {
    id: "branch-iron-norte",
    storeId: "store-iron-gate",
    slug: "madrid-norte",
    name: "Madrid Norte",
    city: "Madrid",
    address: "Avenida Mana 81",
    region: "Comunidad de Madrid",
    countryCode: "ES",
    latitude: 40.483936,
    longitude: -3.687972,
    timezone: "Europe/Madrid",
    status: "active",
  },
  {
    id: "branch-card-barcelona",
    storeId: "store-card-kingdom",
    slug: "barcelona-centro",
    name: "Barcelona Centro",
    city: "Barcelona",
    address: "Carrer del Deck 12",
    region: "Cataluña",
    countryCode: "ES",
    latitude: 41.387397,
    longitude: 2.168568,
    timezone: "Europe/Madrid",
    status: "active",
  },
];

export const events: EventSummary[] = [
  {
    id: "event-gathering-storm",
    slug: "gathering-storm-open",
    storeId: "store-iron-gate",
    storeSlug: "iron-gate-games",
    storeName: "Iron Gate Games",
    branchId: "branch-iron-centro",
    title: "Gathering Storm Open",
    description: "Torneo abierto de Modern con rondas suizas y top 8.",
    game: { slug: "magic-the-gathering", name: "Magic: The Gathering" },
    formatName: "Modern",
    startsAt: "2026-06-15T16:00:00.000Z",
    endsAt: "2026-06-15T22:00:00.000Z",
    timezone: "Europe/Madrid",
    status: "published",
    registrationMode: "external",
    externalRegistrationUrl: "https://melee.gg",
    locationMode: "branch",
    locationLabel: "Iron Gate Games · Madrid Centro",
    branchName: "Madrid Centro",
    address: "Calle del Vórtice 24, Madrid",
    city: "Madrid",
    entryFee: { amount: 15, currency: "EUR" },
    seriesId: null,
    seriesName: null,
    bannerTone: "blue",
    bannerUrl: "/demo/magic-event-banner.png",
    bannerPosition: "center 42%",
  },
  {
    id: "event-friday-night-magic",
    slug: "friday-night-magic-2026-06-19",
    storeId: "store-iron-gate",
    storeSlug: "iron-gate-games",
    storeName: "Iron Gate Games",
    branchId: "branch-iron-norte",
    title: "Friday Night Magic",
    description: "Ocurrencia semanal publicada para la comunidad local.",
    game: { slug: "magic-the-gathering", name: "Magic: The Gathering" },
    formatName: "Standard",
    startsAt: "2026-06-19T17:00:00.000Z",
    endsAt: "2026-06-19T21:00:00.000Z",
    timezone: "Europe/Madrid",
    status: "published",
    registrationMode: "disabled",
    externalRegistrationUrl: null,
    locationMode: "branch",
    locationLabel: "Iron Gate Games · Madrid Norte",
    branchName: "Madrid Norte",
    address: "Avenida Mana 81, Madrid",
    city: "Madrid",
    entryFee: { amount: 5, currency: "EUR" },
    seriesId: "series-friday-night-magic",
    seriesName: "Friday Night Magic",
    bannerTone: "violet",
    bannerUrl: "/demo/magic-event-banner.png",
    bannerPosition: "center 42%",
  },
  {
    id: "event-paldea-league",
    slug: "paldea-league-challenge",
    storeId: "store-card-kingdom",
    storeSlug: "card-kingdom",
    storeName: "Card Kingdom",
    branchId: "branch-card-barcelona",
    title: "Paldea League Challenge",
    description: "Liga casual de Pokémon TCG abierta a todos los niveles.",
    game: { slug: "pokemon-tcg", name: "Pokémon TCG" },
    formatName: "Standard",
    startsAt: "2026-06-15T16:00:00.000Z",
    endsAt: null,
    timezone: "Europe/Madrid",
    status: "published",
    registrationMode: "disabled",
    externalRegistrationUrl: null,
    locationMode: "branch",
    locationLabel: "Card Kingdom · Barcelona Centro",
    branchName: "Barcelona Centro",
    address: "Carrer del Deck 12, Barcelona",
    city: "Barcelona",
    entryFee: null,
    seriesId: null,
    seriesName: null,
    bannerTone: "amber",
    bannerUrl: "/demo/pokemon-event-banner.png",
    bannerPosition: "center 42%",
  },
  {
    id: "event-online-community",
    slug: "community-online-night",
    storeId: "store-iron-gate",
    storeSlug: "iron-gate-games",
    storeName: "Iron Gate Games",
    branchId: null,
    title: "Noche comunitaria online",
    description: "Encuentro remoto para conversar y jugar distintos TCG.",
    game: { slug: "miscelaneo", name: "Miscelaneo" },
    formatName: null,
    startsAt: "2026-06-16T18:00:00.000Z",
    endsAt: "2026-06-16T21:00:00.000Z",
    timezone: "Europe/Madrid",
    status: "published",
    registrationMode: "disabled",
    externalRegistrationUrl: null,
    locationMode: "online",
    locationLabel: "Discord de Iron Gate Games",
    branchName: "Online",
    address: "Discord de Iron Gate Games",
    city: null,
    entryFee: null,
    seriesId: null,
    seriesName: null,
    bannerTone: "rose",
  },
  {
    id: "event-draft",
    slug: "draft-indie-game",
    storeId: "store-iron-gate",
    storeSlug: "iron-gate-games",
    storeName: "Iron Gate Games",
    branchId: null,
    title: "Presentación de juego independiente",
    description: "Borrador interno pendiente de publicación.",
    game: { slug: "otros", name: "Otros" },
    formatName: "Juego invitado",
    startsAt: "2026-11-08T11:00:00.000Z",
    endsAt: null,
    timezone: "Europe/Madrid",
    status: "draft",
    registrationMode: "disabled",
    externalRegistrationUrl: null,
    locationMode: "custom",
    locationLabel: "Centro Cultural Norte",
    branchName: "Ubicación personalizada",
    address: "Centro Cultural Norte, Madrid",
    city: "Madrid",
    entryFee: null,
    seriesId: null,
    seriesName: null,
    bannerTone: "amber",
  },
];

export const eventSeries: EventSeriesSummary[] = [
  {
    id: "series-friday-night-magic",
    slug: "friday-night-magic",
    storeId: "store-iron-gate",
    branchId: "branch-iron-norte",
    title: "Friday Night Magic",
    description: "Encuentro semanal de Standard para la comunidad local.",
    game: { slug: "magic-the-gathering", name: "Magic: The Gathering" },
    formatName: "Standard",
    status: "active",
    weekdays: [5],
    localStartTime: "19:00",
    durationMinutes: 240,
    timezone: "Europe/Madrid",
    startsOn: "2026-09-04",
    endsOn: null,
    registrationMode: "disabled",
    externalRegistrationUrl: null,
    locationMode: "branch",
    locationLabel: "Madrid Norte",
    entryFee: { amount: 5, currency: "EUR" },
  },
  {
    id: "series-weekend-league",
    slug: "liga-fin-de-semana",
    storeId: "store-card-kingdom",
    branchId: "branch-card-barcelona",
    title: "Liga de fin de semana",
    description: "Plantilla semanal para encuentros casuales de Pokémon TCG.",
    game: { slug: "pokemon-tcg", name: "Pokémon TCG" },
    formatName: "Standard",
    status: "draft",
    weekdays: [6, 7],
    localStartTime: "11:00",
    durationMinutes: 180,
    timezone: "Europe/Madrid",
    startsOn: "2026-11-01",
    endsOn: "2027-01-31",
    registrationMode: "external",
    externalRegistrationUrl: "https://example.com/league",
    locationMode: "branch",
    locationLabel: "Barcelona Centro",
    entryFee: null,
  },
];

export function findStoreBySlug(slug: string) {
  return stores.find((store) => store.slug === slug);
}

export function findStoreById(id: string) {
  return stores.find((store) => store.id === id);
}

export function findPublicEvent(storeSlug: string, eventSlug: string) {
  return getCurrentDemoEvents().find(
    (event) => event.storeSlug === storeSlug && event.slug === eventSlug && event.status !== "draft",
  );
}

export function findAdminEvent(storeId: string, eventId: string) {
  return events.find((event) => event.storeId === storeId && event.id === eventId);
}

function dateKeyInTimeZone(value: Date | string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function isoWeekday(dateKey: string) {
  const weekday = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function eventDateTime(dateKey: string, utcHour: number) {
  return `${dateKey}T${String(utcHour).padStart(2, "0")}:00:00.000Z`;
}

export function getCurrentDemoEvents(referenceDate = new Date().toISOString(), timeZone = "Europe/Madrid") {
  const todayKey = dateKeyInTimeZone(referenceDate, timeZone);
  const tomorrowKey = shiftDateKey(todayKey, 1);
  const weekday = isoWeekday(todayKey);
  const fridayOffset = weekday < 5 ? 5 - weekday : 1;
  const fridayKey = shiftDateKey(todayKey, fridayOffset);

  return events.map((event) => {
    if (event.id === "event-gathering-storm") {
      return {
        ...event,
        startsAt: eventDateTime(todayKey, 16),
        endsAt: eventDateTime(todayKey, 22),
      };
    }

    if (event.id === "event-paldea-league") {
      return {
        ...event,
        startsAt: eventDateTime(todayKey, 16),
      };
    }

    if (event.id === "event-online-community") {
      return {
        ...event,
        startsAt: eventDateTime(tomorrowKey, 18),
        endsAt: eventDateTime(tomorrowKey, 21),
      };
    }

    if (event.id === "event-friday-night-magic") {
      return {
        ...event,
        startsAt: eventDateTime(fridayKey, 17),
        endsAt: eventDateTime(fridayKey, 21),
      };
    }

    if (event.id === "event-draft") {
      return {
        ...event,
        startsAt: eventDateTime(todayKey, 17),
        endsAt: eventDateTime(todayKey, 19),
      };
    }

    return event;
  });
}

export function getHomeDemoEvents(referenceDate: string, timeZone = "Europe/Madrid") {
  return getCurrentDemoEvents(referenceDate, timeZone);
}

export function formatEventDate(event: EventSummary) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: event.timezone,
  }).format(new Date(event.startsAt));
}
