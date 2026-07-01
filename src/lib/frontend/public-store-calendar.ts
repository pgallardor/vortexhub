import type { PublicStoreCalendar } from "@/lib/frontend/domain";
import {
  mapPublicStoreCalendar,
  type PublicStoreCalendarPayload,
} from "@/lib/frontend/public-calendar-data";
import { createSupabasePublicServerClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/http/errors";
import { PublicCalendarService } from "@/services/public-calendar-service";

export async function getPublicStoreCalendar(storeSlug: string): Promise<PublicStoreCalendar | null> {
  const service = new PublicCalendarService(createSupabasePublicServerClient());

  try {
    const payload = await service.getStoreCalendar(storeSlug) as PublicStoreCalendarPayload;
    return mapPublicStoreCalendar(payload);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
