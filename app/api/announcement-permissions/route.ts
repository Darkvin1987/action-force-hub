import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";

const CATEGORIES = ["Announcement", "Promotion", "SOP", "Training"] as const;
type MemoCategory = (typeof CATEGORIES)[number];

function isDirector(role: string) {
  return role.trim().toUpperCase() === "DIRECTOR";
}

export async function GET() {
  try {
    const staff = await getStaffProfile();

    if (!staff) {
      return NextResponse.json(
        { success: false, error: "Unauthorised access." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    const { data: ownPermissions, error: ownError } = await admin
      .from("announcement_permissions")
      .select("category")
      .eq("staff_profile_id", staff.id);

    if (ownError) {
      throw new Error(`Unable to retrieve memo permissions: ${ownError.message}`);
    }

    const response: {
      success: boolean;
      categories: string[];
      staff?: Array<{
        id: string;
        member_code: string;
        full_name: string;
        role: string;
        categories: string[];
      }>;
      error?: string;
    } = {
      success: true,
      categories: (ownPermissions ?? []).map((item) => item.category),
    };

    // Directors can manage permissions, but still need their own category
    // assignments before the Create Memo button becomes visible.
    if (isDirector(staff.role)) {
      const [{ data: staffRows, error: staffError }, { data: permissionRows, error: permissionError }] =
        await Promise.all([
          admin
            .from("staff_profiles")
            .select("id, member_code, full_name, role")
            .order("full_name", { ascending: true }),
          admin
            .from("announcement_permissions")
            .select("staff_profile_id, category"),
        ]);

      if (staffError) {
        throw new Error(`Unable to retrieve staff list: ${staffError.message}`);
      }
      if (permissionError) {
        throw new Error(`Unable to retrieve permission list: ${permissionError.message}`);
      }

      const permissionsByStaff = new Map<string, string[]>();
      for (const item of permissionRows ?? []) {
        const current = permissionsByStaff.get(item.staff_profile_id) ?? [];
        current.push(item.category);
        permissionsByStaff.set(item.staff_profile_id, current);
      }

      response.staff = (staffRows ?? []).map((person) => ({
        ...person,
        categories: permissionsByStaff.get(person.id) ?? [],
      }));
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("Announcement permissions GET API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to retrieve memo permissions.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const staff = await getStaffProfile();

    if (!staff) {
      return NextResponse.json(
        { success: false, error: "Unauthorised access." },
        { status: 401 }
      );
    }
    if (!isDirector(staff.role)) {
      return NextResponse.json(
        { success: false, error: "Only Directors can manage memo permissions." },
        { status: 403 }
      );
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const staffProfileId = String(payload.staff_profile_id ?? "").trim();
    const category = String(payload.category ?? "").trim();

    if (!staffProfileId || !(CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json(
        { success: false, error: "Select a staff member and a valid category." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("announcement_permissions")
      .upsert(
        { staff_profile_id: staffProfileId, category },
        { onConflict: "staff_profile_id,category", ignoreDuplicates: true }
      );

    if (error) {
      throw new Error(`Unable to assign memo permission: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Announcement permissions POST API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to assign memo permission.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const staff = await getStaffProfile();

    if (!staff) {
      return NextResponse.json(
        { success: false, error: "Unauthorised access." },
        { status: 401 }
      );
    }
    if (!isDirector(staff.role)) {
      return NextResponse.json(
        { success: false, error: "Only Directors can manage memo permissions." },
        { status: 403 }
      );
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const staffProfileId = String(payload.staff_profile_id ?? "").trim();
    const category = String(payload.category ?? "").trim();

    if (!staffProfileId || !(CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json(
        { success: false, error: "Select a staff member and a valid category." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("announcement_permissions")
      .delete()
      .eq("staff_profile_id", staffProfileId)
      .eq("category", category);

    if (error) {
      throw new Error(`Unable to remove memo permission: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Announcement permissions DELETE API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to remove memo permission.",
      },
      { status: 500 }
    );
  }
}
