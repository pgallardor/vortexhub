import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/http/errors";
import { mapDatabaseError } from "@/lib/database/rpc-repository";

export class PublicCalendarRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listGames() {
    const { data, error } = await this.client
      .from("games")
      .select("name,slug,publisher")
      .eq("is_active", true)
      .order("name");
    if (error) throw mapDatabaseError(error);
    return data;
  }

  async listCalendar(filters: {
    game?: string;
    store?: string;
    city?: string;
    from?: string;
    to?: string;
    limit: number;
    cursor?: string;
  }) {
    const { data, error } = await this.client.rpc("list_public_calendar", {
      p_game_slug: filters.game,
      p_store_slug: filters.store,
      p_city: filters.city,
      p_from_date: filters.from,
      p_to_date: filters.to,
      p_limit: filters.limit,
      p_cursor: filters.cursor,
    });
    if (error) throw mapDatabaseError(error);
    return data;
  }

  async listStores() {
    const { data, error } = await this.client.rpc("list_public_stores");
    if (error) throw mapDatabaseError(error);
    return data;
  }

  async getStoreCalendar(storeSlug: string) {
    const { data, error } = await this.client.rpc("get_public_store_calendar", {
      p_store_slug: storeSlug,
    });
    if (error) throw mapDatabaseError(error);
    if (!data) throw new ApiError(404, "NOT_FOUND", "Tienda no encontrada.");
    return data;
  }

  async getEvent(storeSlug: string, eventSlug: string) {
    const { data, error } = await this.client.rpc("get_public_event", {
      p_store_slug: storeSlug,
      p_event_slug: eventSlug,
    });
    if (error) throw mapDatabaseError(error);
    if (!data) throw new ApiError(404, "NOT_FOUND", "Evento no encontrado.");
    return data;
  }
}
