import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and login API without an existing session.
  if (pathname === "/login" || pathname === "/api/staff-login") {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  if (!claims || error) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);

    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  const userId = claims.sub;

  // Check whether this staff member must change their temporary password.
  const { data: profile, error: profileError } = await supabase
    .from("staff_profiles")
    .select("must_change_password, status")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (profileError) {
    console.error(
      "Unable to check password-change requirement:",
      profileError.message
    );

    return NextResponse.json(
      { error: "Unable to verify your account. Please try again." },
      { status: 500 }
    );
  }

  const isChangePasswordPage = pathname === "/change-password";
  const isChangePasswordApi = pathname === "/api/change-password";

  if (profile?.must_change_password) {
    // Allow only the password-change page and its API while setup is pending.
    if (isChangePasswordPage || isChangePasswordApi) {
      return response;
    }

    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Please change your temporary password first." },
        { status: 403 }
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = "/change-password";
    url.search = "";

    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  // If setup is complete, prevent unnecessary access to the change page.
  if (isChangePasswordPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";

    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};