
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  let memberCode = "";

  try {
    // 1. Get login details
    const body: {
      memberCode?: string;
      password?: string;
    } = await request.json();

    memberCode =
      typeof body.memberCode === "string"
        ? body.memberCode.trim().toUpperCase()
        : "";

    const password =
      typeof body.password === "string" ? body.password : "";

    console.log("[STAFF LOGIN ATTEMPT]", {
      memberCode,
      timestamp: new Date().toISOString(),
    });

    if (
      !/^[A-Z0-9_-]{3,40}$/.test(memberCode) ||
      password.length < 1 ||
      password.length > 256
    ) {
      console.error("[STAFF LOGIN FAILED]", {
        memberCode,
        stage: "INPUT_VALIDATION",
        reason: "INVALID_MEMBER_CODE_OR_PASSWORD_FORMAT",
      });

      return NextResponse.json(
        { ok: false, message: "Invalid member code or password." },
        { status: 401 }
      );
    }

    // 2. Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabasePublishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabasePublishableKey) {
      console.error("[STAFF LOGIN FAILED]", {
        memberCode,
        stage: "ENVIRONMENT_CHECK",
        reason: "MISSING_SUPABASE_ENVIRONMENT_VARIABLES",
      });

      return NextResponse.json(
        { ok: false, message: "Server configuration error." },
        { status: 500 }
      );
    }

    // 3. Create Supabase admin client
    const admin = createAdminClient();

    // 4. Find staff profile using Member Code
    const { data: profile, error: profileError } = await admin
      .from("staff_profiles")
      .select(
        "id, user_id, member_code, phone_number, must_change_password, status"
      )
      .eq("member_code", memberCode)
      .maybeSingle();

    if (profileError) {
      console.error("[STAFF LOGIN FAILED]", {
        memberCode,
        stage: "PROFILE_LOOKUP",
        reason: profileError.message,
      });

      return NextResponse.json(
        { ok: false, message: "Unable to verify staff account." },
        { status: 500 }
      );
    }

    // 5. Check staff account
    if (!profile || profile.status !== "ACTIVE") {
      console.error("[STAFF LOGIN FAILED]", {
        memberCode,
        stage: "PROFILE_CHECK",
        reason: !profile
          ? "STAFF_PROFILE_NOT_FOUND"
          : "STAFF_ACCOUNT_INACTIVE",
        status: profile?.status ?? null,
      });

      return NextResponse.json(
        { ok: false, message: "Invalid member code or password." },
        { status: 401 }
      );
    }

    // 6. Check whether staff has a linked Supabase Auth account
    if (!profile.user_id) {
      console.error("[STAFF LOGIN FAILED]", {
        memberCode,
        stage: "PROFILE_LINK_CHECK",
        reason: "STAFF_PROFILE_NOT_LINKED",
      });

      return NextResponse.json(
        {
          ok: false,
          message:
            "Your staff account is not linked to a login account. Please contact your administrator.",
        },
        { status: 403 }
      );
    }

    // 7. Retrieve email from Supabase Auth using user_id
    const { data: userData, error: userError } =
      await admin.auth.admin.getUserById(profile.user_id);

    if (userError || !userData.user?.email) {
      console.error("[STAFF LOGIN FAILED]", {
        memberCode,
        stage: "AUTH_USER_LOOKUP",
        reason: userError?.message ?? "AUTH_USER_EMAIL_MISSING",
        userId: profile.user_id,
      });

      return NextResponse.json(
        {
          ok: false,
          message: "Unable to verify your login account.",
        },
        { status: 500 }
      );
    }

    const email = userData.user.email;

    // 8. Check first-time login
    const mustChangePassword =
      profile.must_change_password === true;

    if (mustChangePassword) {
      const registeredPhone = profile.phone_number;

      if (!registeredPhone || password !== registeredPhone) {
        console.error("[STAFF LOGIN FAILED]", {
          memberCode,
          stage: "INITIAL_PASSWORD_CHECK",
          reason: !registeredPhone
            ? "REGISTERED_PHONE_MISSING"
            : "INITIAL_PASSWORD_MISMATCH",
        });

        return NextResponse.json(
          { ok: false, message: "Invalid member code or password." },
          { status: 401 }
        );
      }

      // 9. Synchronise initial password with Supabase Auth
      const { error: updateError } =
        await admin.auth.admin.updateUserById(profile.user_id, {
          password: registeredPhone,
        });

      if (updateError) {
        console.error("[STAFF LOGIN FAILED]", {
          memberCode,
          stage: "PASSWORD_SYNC",
          reason: updateError.message,
          userId: profile.user_id,
        });

        return NextResponse.json(
          {
            ok: false,
            message: "Unable to initialise your account.",
          },
          { status: 500 }
        );
      }
    }

    // 10. Create Supabase session
    const response = NextResponse.json({
      ok: true,
      mustChangePassword,
      message: mustChangePassword
        ? "First login successful. Please set a new password."
        : "Login successful.",
    });

    const supabase = createServerClient(
      supabaseUrl,
      supabasePublishableKey,
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

    // 11. Sign in using Supabase Auth
    const { error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError) {
      console.error("[STAFF LOGIN FAILED]", {
        memberCode,
        stage: "SUPABASE_SIGN_IN",
        reason: signInError.message,
        userId: profile.user_id,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          ok: false,
          message: "Invalid member code or password.",
        },
        { status: 401 }
      );
    }

    // 12. Successful login
    console.log("[STAFF LOGIN SUCCESS]", {
      memberCode,
      userId: profile.user_id,
      mustChangePassword,
      timestamp: new Date().toISOString(),
    });

    return response;

  } catch (error) {
    console.error("[STAFF LOGIN FAILED]", {
      memberCode,
      stage: "UNEXPECTED_ERROR",
      reason:
        error instanceof Error ? error.message : "UNKNOWN_ERROR",
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        ok: false,
        message: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}
