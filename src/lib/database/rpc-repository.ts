import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/http/errors";

export class RpcRepository {
  constructor(private readonly client: SupabaseClient) {}

  async call<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await this.client.rpc(name, args);
    if (error) throw mapDatabaseError(error);
    return data as T;
  }
}

export function mapDatabaseError(error: {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}) {
  if (error.code === "PGRST116") {
    return new ApiError(404, "NOT_FOUND", "Recurso no encontrado.");
  }

  if (error.code === "23505" || error.code === "23P01") {
    return new ApiError(409, "CONFLICT", "El recurso entra en conflicto con datos existentes.");
  }

  if (error.code?.startsWith("22") || error.code?.startsWith("23")) {
    return new ApiError(422, "VALIDATION_ERROR", "La operación viola una regla del dominio.");
  }

  if (error.code === "42501") {
    return new ApiError(403, "FORBIDDEN", "No tienes permiso para realizar esta acción.");
  }

  console.error("Supabase database error", error);
  return new ApiError(500, "INTERNAL_ERROR", "La operación de base de datos falló.");
}
