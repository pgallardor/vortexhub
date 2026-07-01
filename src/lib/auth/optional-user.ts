import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function getOptionalUser(client: SupabaseClient): Promise<User | null> {
  try {
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error) return null;
    return user;
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) return null;
    throw error;
  }
}

function isInvalidRefreshTokenError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("refresh token") || message.includes("invalid refresh");
}
