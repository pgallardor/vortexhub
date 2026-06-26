import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function requestOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");

  if (!host) return request.nextUrl.origin;

  const protocol = forwardedProto ?? request.nextUrl.protocol.replace(/:$/, "");
  return `${protocol}://${host}`;
}

function safeRedirect(request: NextRequest) {
  const origin = requestOrigin(request);
  const fallback = new URL("/auth/onboarding", origin);
  const redirectTo = request.nextUrl.searchParams.get("redirect_to")
    ?? request.nextUrl.searchParams.get("next");

  if (!redirectTo) return fallback;

  try {
    const parsed = new URL(redirectTo, origin);
    if (parsed.origin !== origin) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const code = request.nextUrl.searchParams.get("code");
  const redirectTo = safeRedirect(request);
  const errorRedirect = new URL("/auth/login", request.url);
  errorRedirect.searchParams.set("redirectTo", "/auth/onboarding");

  const supabase = await createSupabaseServerClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(redirectTo, { status: 303 });
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(redirectTo, { status: 303 });
  }

  errorRedirect.searchParams.set("message", "El enlace de invitación expiró o ya fue usado.");
  return NextResponse.redirect(errorRedirect, { status: 303 });
}
