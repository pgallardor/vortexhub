import { NextResponse } from "next/server";
import { normalizeError } from "./errors";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function fail(error: unknown) {
  const normalized = normalizeError(error);
  return NextResponse.json(
    {
      error: {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details,
      },
    },
    { status: normalized.status },
  );
}
