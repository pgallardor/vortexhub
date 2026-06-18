import { ZodError } from "zod";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof SyntaxError) {
    return new ApiError(400, "BAD_REQUEST", "El cuerpo JSON no es válido.");
  }

  if (error instanceof ZodError) {
    return new ApiError(
      422,
      "VALIDATION_ERROR",
      "La solicitud contiene datos inválidos.",
      error.flatten(),
    );
  }

  console.error(error);
  return new ApiError(500, "INTERNAL_ERROR", "Ocurrió un error interno.");
}
