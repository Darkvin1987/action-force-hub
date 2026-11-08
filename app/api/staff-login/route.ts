
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { env } from "cloudflare:workers";

export async function POST(request: NextRequest) {
  try {
    const rawBody: unknown = await request.json();

    const body =
      typeof rawBody === "object" && rawBody !== null
        ? (rawBody as Record<string, unknown>)
        : {};

    const memberCode =
      typeof body.memberCode === "string"
        ? body.memberCode.trim().toUpperCase()
        : "";

    const password =
      typeof body.password === "string" ? body.password : "";

    if (
      !/^[A-Z0-9_-]{3,40}$/.test(memberCode) ||
      password.length < 1 ||
      password.length > 256
    ) {
      return NextResponse.json(
        { error: "Invalid Member Code or password." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const secretKey =
      env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !publishableKey || !secretKey) {
      console.error("Staff login server configuration is missing.");
      {/*console.error("Staff login configuration check:", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasPublishableKey: Boolean(publishableKey),
        hasSecretKey: Boolean(secretKey),
      });*/}

      return NextResponse.json(
        { error: "Login service is not configured." },
        { status: 500 }
      );
    }

    // Server-only client: look up the Member Code securely.
    const admin = createSupabaseClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: mapping, error: mappingError } = await admin
      .from("staff_login_map")
      .select("user_id")
      .eq("member_code", memberCode)
      .maybeSingle();

    if (mappingError) {
      console.error("Member Code lookup failed:", mappingError.message);

      return NextResponse.json(
        { error: "Login lookup failed. Check the server terminal." },
        { status: 500 }
      );
    }

    if (!mapping) {
      console.error("No staff mapping found for submitted Member Code.");

      return NextResponse.json(
        { error: "Member Code is not registered." },
        { status: 401 }
      );
    }

    const { data: userResult, error: userError } =
      await admin.auth.admin.getUserById(mapping.user_id);

    const email = userResult?.user?.email;

    if (userError || !email) {
      console.error(
        "Mapped Supabase user could not be retrieved:",
        userError?.message ?? "User email is missing."
      );

      return NextResponse.json(
        { error: "Mapped account could not be retrieved." },
        { status: 401 }
      );
    }

    // Supabase SSR client: sign in and store the session in response cookies.
    const response = NextResponse.json({ ok: true });

    const supabase = createServerClient(
      supabaseUrl,
      publishableKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError) {
      console.error(
        "Supabase password sign-in failed:",
        signInError.message
      );

      return NextResponse.json(
        { error: "Supabase rejected the login. Check the server terminal." },
        { status: 401 }
      );
    }

    return response;

  } catch (error) {
    console.error("Staff login request failed:", error);

    return NextResponse.json(
      { error: "Unable to process login request." },
      { status: 400 }
    );
  }
}
