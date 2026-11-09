import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  let createdUserId: string | null = null;
  let linkedProfileId: string | null = null;
  let admin: ReturnType<typeof createAdminClient> | null = null;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (error || !userId) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { data: director, error: directorError } =
      await supabase
        .from("staff_profiles")
        .select("id, role, status")
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .maybeSingle();

    if (directorError || director?.role !== "DIRECTOR") {
      return NextResponse.json(
        { error: "Director access required." },
        { status: 403 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      !("staff_profile_id" in body) ||
      !("email" in body) ||
      typeof body.staff_profile_id !== "string" ||
      typeof body.email !== "string"
    ) {
      return NextResponse.json(
        { error: "Staff profile and email are required." },
        { status: 400 }
      );
    }

    const profileId = body.staff_profile_id.trim();
    const email = body.email.trim().toLowerCase();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId) ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { error: "Please provide a valid profile and email." },
        { status: 400 }
      );
    }

    admin = createAdminClient();

    const { data: profile, error: profileError } =
      await admin
        .from("staff_profiles")
        .select(
          "id, member_code, full_name, role, status, user_id, phone_number"
        )
        .eq("id", profileId)
        .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Staff profile not found." },
        { status: 404 }
      );
    }

    if (
      profile.status !== "ACTIVE" ||
      !["GAM", "AM", "SC", "ID"].includes(profile.role) ||
      profile.user_id
    ) {
      return NextResponse.json(
        { error: "This profile is not eligible for a new login account." },
        { status: 409 }
      );
    }

    const initialPassword =
      typeof profile.phone_number === "string"
        ? profile.phone_number.trim()
        : "";

    if (!/^\+[1-9]\d{7,14}$/.test(initialPassword)) {
      return NextResponse.json(
        {
          error:
            "This staff profile does not have a valid registered mobile number. Update the profile before creating the login account.",
        },
        { status: 400 }
      );
    }

    const { data: existingMapping, error: mappingCheckError } =
      await admin
        .from("staff_login_map")
        .select("member_code")
        .eq("member_code", profile.member_code)
        .maybeSingle();

    if (mappingCheckError) {
      console.error(
        "Staff mapping check failed:",
        mappingCheckError.message
      );

      return NextResponse.json(
        { error: "Unable to verify the existing login mapping." },
        { status: 500 }
      );
    }

    if (existingMapping) {
      return NextResponse.json(
        { error: "This staff ID already has a login mapping." },
        { status: 409 }
      );
    }

    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
          member_code: profile.member_code,
          must_change_password: true,
        },
      });

    if (authError || !authData.user) {
      console.error(
        "Auth user creation failed:",
        authError?.message
      );

      return NextResponse.json(
        {
          error:
            "Unable to create the login account. Check whether the email is already registered.",
        },
        { status: 400 }
      );
    }

    createdUserId = authData.user.id;

    const { data: linkedProfile, error: linkError } =
      await admin
        .from("staff_profiles")
        .update({
          user_id: createdUserId,
          must_change_password: true,
        })
        .eq("id", profile.id)
        .is("user_id", null)
        .select("id")
        .maybeSingle();

    if (linkError || !linkedProfile) {
      throw new Error(
        "Unable to link the Auth account to the staff profile."
      );
    }

    linkedProfileId = linkedProfile.id;

    const { error: mappingError } = await admin
      .from("staff_login_map")
      .insert({
        member_code: profile.member_code,
        user_id: createdUserId,
      });

    if (mappingError) {
      throw new Error(
        "Unable to create the staff login mapping."
      );
    }

    return NextResponse.json(
      {
        message: "Staff login account created successfully.",
        staff: {
          member_code: profile.member_code,
          full_name: profile.full_name,
          email,
        },
        temporary_password: initialPassword,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Staff account creation failed:",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    if (admin && createdUserId) {
      if (linkedProfileId) {
        await admin
          .from("staff_login_map")
          .delete()
          .eq("user_id", createdUserId);

        await admin
          .from("staff_profiles")
          .update({
            user_id: null,
            must_change_password: false,
          })
          .eq("id", linkedProfileId)
          .eq("user_id", createdUserId);
      }

      await admin.auth.admin.deleteUser(createdUserId);
    }

    return NextResponse.json(
      { error: "Unable to complete staff account creation." },
      { status: 500 }
    );
  }
}