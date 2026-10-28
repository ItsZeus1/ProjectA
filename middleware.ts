import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/** Pages that require a logged-in user. Admin role is verified again in app/admin/layout.tsx. */
const PROTECTED_PREFIXES = ["/orders", "/admin"];

/** Pages a logged-in user has no reason to see. */
const AUTH_PAGES = ["/login", "/register"];

/** Throttle cookie so the presence heartbeat hits the database at most once a minute. */
const PRESENCE_COOKIE = "nc_seen";

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "";
}

export async function middleware(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Missing env vars must never take the whole site down.
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.next({ request });
    }

    let response = NextResponse.next({ request });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    // getUser() re-validates the token with Supabase and refreshes it when needed.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    // --- Route protection -------------------------------------------------
    if (!user && matchesPrefix(pathname, PROTECTED_PREFIXES)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("next", pathname);

      const redirect = NextResponse.redirect(loginUrl);
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }

    if (user && matchesPrefix(pathname, AUTH_PAGES)) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      homeUrl.search = "";

      const redirect = NextResponse.redirect(homeUrl);
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }

    // --- Presence heartbeat (powers "Online Sessions" + IP in the admin panel)
    const isPrefetch =
      request.headers.get("next-router-prefetch") === "1" ||
      request.headers.get("purpose") === "prefetch";

    if (user && !isPrefetch && !request.cookies.get(PRESENCE_COOKIE)) {
      try {
        await supabase.rpc("touch_presence", { p_ip: getClientIp(request) });
        response.cookies.set(PRESENCE_COOKIE, "1", {
          maxAge: 60,
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        });
      } catch {
        // Presence is best-effort and must never block a page load.
      }
    }

    return response;
  } catch {
    // Any unexpected failure: let the request through untouched.
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    /*
     * Run on everything except Next.js internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff|woff2)$).*)",
  ],
};
