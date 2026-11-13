import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedRoles = ["GAM", "AM", "SC", "ID"] as const;

const allowedOrganizations = [
  "ACTION_FORCE",
  "INDEPENDENT_DISTRIBUTOR",
] as const;

function isAllowedRole(
  value: unknown
): value is (typeof allowedRoles)[number] {
  return (
    typeof value === "string" &&
    (allowedRoles as readonly string[]).includes(value)
  );
}

function isAllowedOrganization(
  value: unknown
): value is (typeof allowedOrganizations)[number] {
  return (
    typeof value === "string" &&
    (allowedOrganizations as readonly string[]).includes(value)
  );
}

export async function GET() {
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

  const admin = createAdminClient();

  const { data: staff, error: staffError } = await admin
    .from("staff_profiles")
    .select(
      "id, member_code, full_name, role, organization_type, manager_id, status, user_id"
    )
    .order("full_name", { ascending: true });

  if (staffError) {
    console.error(
      "Unable to load staff profiles:",
      staffError.message
    );

    return NextResponse.json(
      { error: "Unable to load staff profiles." },
      { status: 500 }
    );
  }

  return NextResponse.json({ staff: staff ?? [] });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: claimsData,
      error: claimsError,
    } = await supabase.auth.getClaims();

    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
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

    const rawBody: unknown = await request.json();

    const body: Record<string, unknown> =
      typeof rawBody === "object" &&
      rawBody !== null &&
      !Array.isArray(rawBody)
        ? rawBody as Record<string, unknown>
        : {};

    const memberCode =
      typeof body.member_code === "string"
        ? body.member_code.trim().toUpperCase()
        : "";

    const fullName =
      typeof body.full_name === "string"
        ? body.full_name.trim()
        : "";

    const phoneNumber =
      typeof body.phone_number === "string"
        ? body.phone_number.trim()
        : "";

    const role = body.role;
    const organizationType = body.organization_type;

    const managerId =
      typeof body.manager_id === "string"
        ? body.manager_id
        : null;

    if (
      !/^[A-Z0-9_-]{3,40}$/.test(memberCode) ||
      fullName.length < 2 ||
      fullName.length > 100 ||
      !/^\+[1-9]\d{7,14}$/.test(phoneNumber) ||
      !isAllowedRole(role) ||
      !isAllowedOrganization(organizationType)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid staff details. Check the Member Code, name, phone number and role.",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    if (!managerId) {
      return NextResponse.json(
        { error: "A reporting manager is required." },
        { status: 400 }
      );
    }

    const { data: manager, error: managerError } =
      await admin
        .from("staff_profiles")
        .select("id, role, organization_type, status")
        .eq("id", managerId)
        .eq("status", "ACTIVE")
        .maybeSingle();

    if (managerError || !manager) {
      return NextResponse.json(
        { error: "Invalid reporting manager." },
        { status: 400 }
      );
    }

    const validReportingLine =
      (
        role === "GAM" &&
        manager.role === "DIRECTOR" &&
        organizationType === "ACTION_FORCE"
      ) ||
      (
        role === "ID" &&
        ["DIRECTOR", "GAM"].includes(manager.role) &&
        (
          manager.role === "DIRECTOR" ||
          (
            manager.role === "GAM" &&
            manager.organization_type === "ACTION_FORCE"
          )
        ) &&
        organizationType === "INDEPENDENT_DISTRIBUTOR"
      ) ||
      (
        role === "AM" &&
        manager.role === "GAM" &&
        manager.organization_type === "ACTION_FORCE" &&
        organizationType === "ACTION_FORCE"
      ) ||
      (
        role === "SC" &&
        ["AM", "GAM"].includes(manager.role) &&
        manager.organization_type === "ACTION_FORCE" &&
        organizationType === "ACTION_FORCE"
      );

    if (!validReportingLine) {
      return NextResponse.json(
        { error: "Invalid reporting hierarchy." },
        { status: 400 }
      );
    }

    const { data: created, error: insertError } =
      await admin
        .from("staff_profiles")
        .insert({
          member_code: memberCode,
          full_name: fullName,
          phone_number: phoneNumber,
          role,
          organization_type: organizationType,
          manager_id: managerId,
          status: "ACTIVE",
          user_id: null,
        })
        .select(
          "id, member_code, full_name, role, organization_type, manager_id, status"
        )
        .single();

    if (insertError) {
      console.error(
        "Staff profile creation failed:",
        insertError.code,
        insertError.message
      );

      return NextResponse.json(
        {
          error:
            insertError.code === "23505"
              ? "This Member Code already exists."
              : "Unable to create staff profile.",
        },
        {
          status:
            insertError.code === "23505" ? 409 : 400,
        }
      );
    }

    return NextResponse.json(
      { staff: created },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Staff management request failed:",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to process staff request." },
      { status: 500 }
    );
  }
}