import { NextRequest, NextResponse } from "next/server";
import { slugSchema } from "@/lib/validation/common";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeSlug: string }> },
) {
  const { storeSlug } = await params;
  const parsedSlug = slugSchema.safeParse(storeSlug);

  if (!parsedSlug.success) {
    return NextResponse.redirect(new URL("/stores", request.url));
  }

  return NextResponse.redirect(new URL(`/stores/${parsedSlug.data}`, request.url));
}
