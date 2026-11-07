
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // Verify the current user's authenticated session.
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims();

    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    // Read and validate the new password.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      !("new_password" in body) ||
      typeof body.new_password !== "string"
    ) {
      return NextResponse.json(
        { error: "A new password is required." },
        { status: 400 }
      );
    }

    const newPassword = body.new_password;

    if (
      newPassword.length < 12 ||
      newPassword.length > 128 ||
      !/[a-z]/.test(newPassword) ||
      !/[A-Z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      return NextResponse.json(
        {
          error:
            "Use 12–128 characters with at least one lowercase letter, uppercase letter and number.",
        },
        { status: 400 }
      );
    }

    // Confirm that the user has an active staff profile.
    const { data: profile, error: profileError } =
      await supabase
        .from("staff_profiles")
        .select("id, must_change_password, status")
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Active staff profile not found." },
        { status: 403 }
      );
    }

    // Update the authenticated user's own Supabase Auth password.
    const { error: passwordError } =
      await supabase.auth.updateUser({
        password: newPassword,
      });

    if (passwordError) {
      return NextResponse.json(
        { error: "Unable to update password. Please try again." },
        { status: 400 }
      );
    }

    // Clear the first-login flag using the server-only admin client.
    const admin = createAdminClient();

    const { data: updatedProfile, error: updateError } =
      await admin
        .from("staff_profiles")
        .update({ must_change_password: false })
        .eq("id", profile.id)
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .select("id")
        .maybeSingle();

    if (updateError || !updatedProfile) {
      console.error(
        "Unable to clear first-login password flag:",
        updateError?.message ?? "Profile was not updated"
      );

      return NextResponse.json(
        {
          error:
            "Your password was updated, but setup is not complete. Please try again or contact the Director.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error(
      "Password change failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to process the password change." },
      { status: 500 }
    );
  }
}
