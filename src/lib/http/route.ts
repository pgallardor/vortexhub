import type { NextRequest } from "next/server";
import type { output, ZodTypeAny } from "zod";
import { fail } from "./responses";

export async function parseJson<TSchema extends ZodTypeAny>(
  request: NextRequest,
  schema: TSchema,
): Promise<output<TSchema>> {
  return schema.parse(await request.json());
}

export async function parseQuery<TSchema extends ZodTypeAny>(
  request: NextRequest,
  schema: TSchema,
): Promise<output<TSchema>> {
  return schema.parse(Object.fromEntries(request.nextUrl.searchParams));
}

export function route<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response>,
) {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error) {
      return fail(error);
    }
  };
}
