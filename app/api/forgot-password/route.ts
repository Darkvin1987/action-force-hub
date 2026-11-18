
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function maskPhoneNumber(phone: string) {
  if (phone.length <= 7) {
    return "+6" + "•".repeat(Math.max(phone.length - 2, 4));
  }

  const firstPart = phone.slice(0, 4);
  const lastPart = phone.slice(-3);
  const hiddenLength = Math.max(phone.length - 7, 4);

  return firstPart + "•".repeat(hiddenLength) + lastPart;
}

export async function POST(request: NextRequest) {
  let memberCode = "";

  try {
    // 1. Read submitted details
    const body = await request.json() as {
      memberCode?: string;
      email?: string;
    };

    memberCode =
      typeof body.memberCode === "string"
        ? body.memberCode.trim().toUpperCase()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    // 2. Validate input
    if (
      !/^[A-Z0-9_-]{3,40}$/.test(memberCode) ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Please enter a valid Member Code and email address.",
        },
        400
      );
    }

    const admin = createAdminClient();

    // 3. Find the staff profile
    const { data: profile, error: profileError } =
      await admin
        .from("staff_profiles")
        .select(
          "id, user_id, member_code, phone_number, must_change_password, status"
        )
        .eq("member_code", memberCode)
        .maybeSingle();

    if (profileError) {
      console.error("[FORGOT PASSWORD FAILED]", {
        memberCode,
        stage: "PROFILE_LOOKUP",
        reason: profileError.message,
      });

      return jsonResponse(
        {
          ok: false,
          message: "Unable to process your request. Please try again.",
        },
        500
      );
    }

    // 4. Confirm active profile and linked Auth account
    if (
      !profile ||
      profile.status !== "ACTIVE" ||
      !profile.user_id
    ) {
      console.warn("[FORGOT PASSWORD REJECTED]", {
        memberCode,
        stage: "PROFILE_VALIDATION",
        reason: !profile
          ? "PROFILE_NOT_FOUND"
          : profile.status !== "ACTIVE"
            ? "PROFILE_INACTIVE"
            : "AUTH_ACCOUNT_NOT_LINKED",
      });

      return jsonResponse(
        {
          ok: false,
          message:
            "The Member Code or registered email address could not be verified.",
        },
        400
      );
    }

    // 5. Retrieve the linked Supabase Auth user
    const { data: userData, error: userError } =
      await admin.auth.admin.getUserById(profile.user_id);

    if (userError || !userData.user?.email) {
      console.error("[FORGOT PASSWORD FAILED]", {
        memberCode,
        stage: "AUTH_USER_LOOKUP",
        userId: profile.user_id,
        reason: userError?.message ?? "AUTH_EMAIL_MISSING",
      });

      return jsonResponse(
        {
          ok: false,
          message:
            "Unable to verify your account. Please contact your administrator.",
        },
        500
      );
    }

    // 6. Match the registered Auth email
    const registeredEmail =
      userData.user.email.trim().toLowerCase();

    if (registeredEmail !== email) {
      console.warn("[FORGOT PASSWORD REJECTED]", {
        memberCode,
        stage: "EMAIL_VALIDATION",
        reason: "EMAIL_MISMATCH",
      });

      return jsonResponse(
        {
          ok: false,
          message:
            "The Member Code or registered email address could not be verified.",
        },
        400
      );
    }

    // 7. Validate the registered phone number
    const registeredPhone =
      typeof profile.phone_number === "string"
        ? profile.phone_number.trim()
        : "";

    if (!/^\+6[0-9]{8,14}$/.test(registeredPhone)) {
      console.error("[FORGOT PASSWORD FAILED]", {
        memberCode,
        stage: "PHONE_VALIDATION",
        reason: "INVALID_REGISTERED_PHONE_FORMAT",
      });

      return jsonResponse(
        {
          ok: false,
          message:
            "Your registered phone number is missing or invalid. Please contact your administrator.",
        },
        400
      );
    }

    // 8. Mark the staff profile as requiring a password change
    const { data: updatedProfile, error: profileUpdateError } =
      await admin
        .from("staff_profiles")
        .update({
          must_change_password: true,
        })
        .eq("id", profile.id)
        .eq("user_id", profile.user_id)
        .eq("status", "ACTIVE")
        .select("id")
        .maybeSingle();

    if (profileUpdateError || !updatedProfile) {
      console.error("[FORGOT PASSWORD FAILED]", {
        memberCode,
        stage: "PROFILE_RESET_FLAG",
        reason:
          profileUpdateError?.message ??
          "PROFILE_UPDATE_NOT_CONFIRMED",
      });

      return jsonResponse(
        {
          ok: false,
          message:
            "Unable to activate password reset. Please try again.",
        },
        500
      );
    }

    // 9. Reset Supabase Auth password to registered phone number
    const { error: passwordUpdateError } =
      await admin.auth.admin.updateUserById(profile.user_id, {
        password: registeredPhone,
      });

    if (passwordUpdateError) {
      console.error("[FORGOT PASSWORD FAILED]", {
        memberCode,
        stage: "AUTH_PASSWORD_RESET",
        userId: profile.user_id,
        reason: passwordUpdateError.message,
      });

      // Roll back the reset flag if Auth password update fails
      const { error: rollbackError } = await admin
        .from("staff_profiles")
        .update({
          must_change_password:
            profile.must_change_password === true,
        })
        .eq("id", profile.id)
        .eq("user_id", profile.user_id);

      if (rollbackError) {
        console.error("[FORGOT PASSWORD ROLLBACK FAILED]", {
          memberCode,
          userId: profile.user_id,
          reason: rollbackError.message,
        });
      }

      return jsonResponse(
        {
          ok: false,
          message:
            "Unable to reset your password. Please try again or contact your administrator.",
        },
        500
      );
    }

    // 10. Reset successful
    console.log("[FORGOT PASSWORD SUCCESS]", {
      memberCode,
      userId: profile.user_id,
      timestamp: new Date().toISOString(),
    });

    return jsonResponse({
      ok: true,
      message:
        "Your password has been reset successfully.",
      maskedPhone: maskPhoneNumber(registeredPhone),
    });

  } catch (error) {
    console.error("[FORGOT PASSWORD FAILED]", {
      memberCode,
      stage: "UNEXPECTED_ERROR",
      reason:
        error instanceof Error
          ? error.message
          : "UNKNOWN_ERROR",
      timestamp: new Date().toISOString(),
    });

    return jsonResponse(
      {
        ok: false,
        message:
          "An unexpected error occurred. Please try again.",
      },
      500
    );
  }
}
