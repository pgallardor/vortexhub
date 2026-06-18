import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

function clearSupabaseCookies(request: NextRequest, response: NextResponse) {
  request.cookies
    .getAll()
    .filter((cookie) => cookie.name.startsWith("sb-"))
    .forEach((cookie) => {
      response.cookies.delete(cookie.name);
      response.cookies.set(cookie.name, "", {
        expires: new Date(0),
        maxAge: 0,
        path: "/",
      });
    });
}

export async function POST(request: NextRequest) {
  revalidatePath("/", "layout");
  const response = NextResponse.redirect(new URL("/auth/login", request.url), { status: 303 });
  response.headers.set("Cache-Control", "private, no-store");
  clearSupabaseCookies(request, response);

  return response;
}
