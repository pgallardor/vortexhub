import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ApiError } from "@/lib/http/errors";

export async function requireUser(client: SupabaseClient): Promise<User> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Debes iniciar sesión.");
  }

  return user;
}
