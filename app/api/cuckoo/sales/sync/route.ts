
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";

import {
  syncMemberIfStale,
  syncAuthorisedTeamSales,
} from "@/lib/cuckoo/sync-team-sales";

export async function POST(request: Request) {
  try {
    // 1. Authenticate the logged-in staff member.
    const staff = await getStaffProfile();

    if (!staff) {
      return NextResponse.json(
        { success: false, error: "Unauthorised access." },
        { status: 401 }
      );
    }

    // 2. Read the optional force flag.
    const rawBody: unknown = await request.json().catch(() => ({}));

    const force =
      typeof rawBody === "object" &&
      rawBody !== null &&
      !Array.isArray(rawBody) &&
      "force" in rawBody &&
      rawBody.force === true;

    // 3. Create the server-side database client.
    const admin = createAdminClient();

    // 4. Prepare the authenticated staff profile.
    const manager = {
      id: staff.id,
      member_code: staff.member_code,
      role: staff.role,
      manager_id: staff.manager_id,
      created_at: null,
    };

    // 5. Synchronise personal sales and authorised team sales.
    const [personalResult, teamResult] = await Promise.all([
      syncMemberIfStale(admin, staff.member_code, force),
      syncAuthorisedTeamSales(admin, manager, force),
    ]);

    // 6. Combine all sync results.
    const results = [
      personalResult,
      ...teamResult.results,
    ];

    const failedCount = results.filter(
      (item) => item.status === "FAILED"
    ).length;

    const inProgressCount = results.filter(
      (item) => item.status === "IN_PROGRESS"
    ).length;

    // 7. Return the response expected by SalesClient.
    return NextResponse.json(
      {
        success: true,
        message: "Sales synchronisation process completed.",
        force,
        teamMemberCount: teamResult.teamMemberCount,
        newRecruitsThisMonth: teamResult.newRecruitsThisMonth,
        failedCount,
        inProgressCount,
        results,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Sales synchronisation API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to synchronise sales.",
      },
      { status: 500 }
    );
  }
}
