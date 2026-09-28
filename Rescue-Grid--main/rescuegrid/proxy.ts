import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDmaUser } from "@/lib/auth/dmaAccess";
import { isVolunteerAuthUser, LEGACY_VOLUNTEER_COOKIE } from "@/lib/auth/volunteerAccess";
import { getAuthUser } from "@/lib/auth/session";

function redirectTo(request: NextRequest, pathname: string, from?: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  // Keep any refreshed auth cookies on the redirect.
  from?.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

/**
 * Loads (and refreshes, when needed) the Supabase Auth session from cookies.
 * Both DMA operators and volunteers have Supabase sessions.
 */
async function getSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Verified locally from the JWT: no round trip to Supabase Auth per page.
  const user = await getAuthUser(supabase);
  return { user, response: () => response };
}

async function handleDma(request: NextRequest, pathname: string) {
  const { user, response } = await getSession(request);
  const isOperator = isDmaUser(user);

  if (pathname.startsWith("/api/dma")) {
    if (!isOperator) {
      return NextResponse.json({ error: user ? "Forbidden" : "Unauthorized" }, { status: user ? 403 : 401 });
    }
    return response();
  }

  if (pathname === "/dma" || pathname === "/dma/") {
    return redirectTo(request, isOperator ? "/dma/dashboard" : "/dma/login", response());
  }

  const isLoginPage = pathname.startsWith("/dma/login");
  if (!isOperator && !isLoginPage) return redirectTo(request, "/dma/login", response());
  if (isOperator && isLoginPage) return redirectTo(request, "/dma/dashboard", response());

  return response();
}

async function handleVolunteer(request: NextRequest, pathname: string) {
  const { user, response } = await getSession(request);
  const isVolunteer = isVolunteerAuthUser(user);
  const isLoginPage = pathname.startsWith("/volunteer/login");

  let result: NextResponse;
  if (pathname === "/volunteer" || pathname === "/volunteer/") {
    result = redirectTo(request, isVolunteer ? "/volunteer/missions" : "/volunteer/login", response());
  } else if (!isVolunteer && !isLoginPage) {
    result = redirectTo(request, "/volunteer/login", response());
  } else if (isVolunteer && isLoginPage) {
    result = redirectTo(request, "/volunteer/missions", response());
  } else {
    result = response();
  }

  // Retire the pre-Supabase-Auth signed cookie.
  if (request.cookies.has(LEGACY_VOLUNTEER_COOKIE)) {
    result.cookies.delete(LEGACY_VOLUNTEER_COOKIE);
  }
  return result;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/dma")) {
    return handleDma(request, pathname);
  }
  if (pathname.startsWith("/volunteer")) {
    return handleVolunteer(request, pathname);
  }
  return NextResponse.next();
}

export const config = {
  // Only pages need the redirect logic. API routes are left out on purpose:
  // every /api/dma route calls requireDma() and every private /api/volunteer
  // route calls requireVolunteer(), which also refresh the session cookies.
  // Skipping the proxy there saves a step on every data request. Victim pages
  // and public APIs need no auth at all.
  matcher: ["/dma", "/dma/:path*", "/volunteer", "/volunteer/:path*"],
};
