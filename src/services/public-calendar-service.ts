import type { SupabaseClient } from "@supabase/supabase-js";
import { PublicCalendarRepository } from "@/repositories/public-calendar-repository";

export class PublicCalendarService {
  private readonly repository: PublicCalendarRepository;

  constructor(client: SupabaseClient) {
    this.repository = new PublicCalendarRepository(client);
  }

  listGames() {
    return this.repository.listGames();
  }

  listCalendar(filters: Parameters<PublicCalendarRepository["listCalendar"]>[0]) {
    return this.repository.listCalendar(filters);
  }

  listStores() {
    return this.repository.listStores();
  }

  getStoreCalendar(storeSlug: string) {
    return this.repository.getStoreCalendar(storeSlug);
  }

  getEvent(storeSlug: string, eventSlug: string) {
    return this.repository.getEvent(storeSlug, eventSlug);
  }
}
