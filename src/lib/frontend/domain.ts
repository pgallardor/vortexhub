export type StoreStatus = "pending" | "active" | "suspended" | "closed";
export type BranchStatus = "draft" | "active" | "inactive";
export type EventStatus = "draft" | "published" | "cancelled" | "completed";
export type RegistrationMode = "disabled" | "external";
export type LocationMode = "branch" | "custom" | "online";
export type EventSeriesStatus = "draft" | "active" | "ended";

export interface GameSummary {
  slug: string;
  name: string;
}

export interface StoreSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  timezone: string;
  status: StoreStatus;
  isPubliclyVisible: boolean;
  cityLabel: string;
  logoUrl?: string;
  viewerMembership?: {
    role: StoreMembershipRole;
    scope: StoreMembershipScope;
    status: StoreMembershipStatus;
  };
}

export interface BranchSummary {
  id: string;
  storeId: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  region: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  status: BranchStatus;
}

export interface EventSummary {
  id: string;
  slug: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  branchId: string | null;
  title: string;
  description: string;
  game: GameSummary;
  formatName: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: EventStatus;
  registrationMode: RegistrationMode;
  externalRegistrationUrl: string | null;
  locationMode: LocationMode;
  locationLabel: string;
  branchName: string;
  address: string;
  city: string | null;
  region?: string | null;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  entryFee: {
    amount: number;
    currency: string;
  } | null;
  seriesId: string | null;
  seriesName: string | null;
  bannerTone: "blue" | "violet" | "amber" | "rose";
  bannerUrl?: string;
  bannerPosition?: string;
  bannerMode?: "platform" | "custom";
  platformBannerId?: string | null;
  customBannerAssetId?: string | null;
}

export interface EventSeriesSummary {
  id: string;
  slug: string;
  storeId: string;
  branchId: string | null;
  title: string;
  description: string;
  game: GameSummary;
  otherGameName?: string | null;
  formatName: string | null;
  status: EventSeriesStatus;
  weekdays: number[];
  localStartTime: string;
  durationMinutes: number | null;
  timezone: string;
  startsOn: string;
  endsOn: string | null;
  registrationMode: RegistrationMode;
  externalRegistrationUrl: string | null;
  locationMode: LocationMode;
  locationLabel: string;
  locationCity?: string | null;
  locationRegion?: string | null;
  locationCountryCode?: string | null;
  entryFee: {
    amount: number;
    currency: string;
  } | null;
  bannerMode: "platform" | "custom";
  bannerPosition?: string;
  platformBannerId?: string | null;
  customBannerAssetId?: string | null;
}

export interface PublicStoreCalendar {
  store: StoreSummary;
  branches: BranchSummary[];
  games: GameSummary[];
  events: EventSummary[];
}

export interface AdminStoreOverview {
  store: StoreSummary;
  branchCount: number;
  upcomingEventCount: number;
  publishedEventCount: number;
  draftEventCount: number;
}

export interface AdminStoreWorkspace {
  overview: AdminStoreOverview;
  branches: BranchSummary[];
  events: EventSummary[];
  series: EventSeriesSummary[];
}

export type StoreMembershipRole = "owner" | "admin" | "staff";
export type StoreMembershipScope = "store" | "branches";
export type StoreMembershipStatus = "active" | "disabled";
export type StoreInvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface StoreTeamMember {
  id: string;
  storeId: string;
  userAccountId: string;
  displayName: string;
  accountStatus: "pending" | "active" | "suspended";
  role: StoreMembershipRole;
  scope: StoreMembershipScope;
  status: StoreMembershipStatus;
  acceptedAt: string;
  branchIds: string[];
  branchNames: string[];
}

export interface StorePendingInvitation {
  id: string;
  storeId: string;
  email: string;
  role: StoreMembershipRole;
  scope: StoreMembershipScope;
  status: StoreInvitationStatus;
  expiresAt: string;
  createdAt: string;
  branchIds: string[];
  branchNames: string[];
}

export interface AdminStoreTeam {
  store: StoreSummary;
  branches: BranchSummary[];
  members: StoreTeamMember[];
  invitations: StorePendingInvitation[];
}

export interface AdminDashboard {
  stores: AdminStoreOverview[];
  totals: {
    storeCount: number;
    branchCount: number;
    upcomingEventCount: number;
    draftEventCount: number;
  };
  upcomingEvents: EventSummary[];
}
