import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;

  // Check for Supabase auth session (DMA)
  const { data: { user } } = await supabase.auth.getUser();

  // Check for volunteer session cookie
  const volunteerCookie = request.cookies.get('volunteer_session');
  const hasVolunteerSession = volunteerCookie ? JSON.parse(volunteerCookie.value) : null;

  // DMA routes require Supabase auth session (except login page)
  if (pathname.startsWith('/dma') && !pathname.startsWith('/dma/login')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/dma/login';
      return NextResponse.redirect(url);
    }
  }

  // Volunteer routes require volunteer session cookie (except login page)
  if (pathname.startsWith('/volunteer') && !pathname.startsWith('/volunteer/login')) {
    if (!hasVolunteerSession) {
      const url = request.nextUrl.clone();
      url.pathname = '/volunteer/login';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
