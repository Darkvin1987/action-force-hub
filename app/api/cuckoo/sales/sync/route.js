
import { NextResponse } from "next/server";

import {
  syncMemberIfStale,
  syncAuthorisedTeamSales,
} from "@/lib/cuckoo/sync-team-sales";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";

export async function POST(request) {
  try {
    const staff = await getStaffProfile();

    if (!staff) {
      return NextResponse.json(
        { error: "Unauthorised access." },
        { status: 401 }
      );
    }

    // Manual refresh bypasses the 15-minute freshness rule.
    // Normal automatic sync continues to respect that rule.
    let force = false;

    try {
      const body = await request.json();
      force = body?.force === true;
    } catch {
      // An empty request body means automatic sync.
      force = false;
    }

    const admin = createAdminClient();

    const [personalSync, teamSync] = await Promise.all([
      syncMemberIfStale(
        admin,
        staff.member_code,
        force
      ),

      syncAuthorisedTeamSales(
        admin,
        {
          id: staff.id,
          member_code: staff.member_code,
          role: staff.role,
          manager_id: staff.manager_id,
        },
        force
      ),
    ]);

    const results = [
      personalSync,
      ...teamSync.results,
    ];

    const failedCount = results.filter(
      (item) => item.status === "FAILED"
    ).length;

    const inProgressCount = results.filter(
      (item) => item.status === "IN_PROGRESS"
    ).length;

    return NextResponse.json({
      success: failedCount === 0,
      force,
      personalSync,
      teamSync: {
        teamMemberCount: teamSync.teamMemberCount,
        results: teamSync.results,
      },
      failedCount,
      inProgressCount,
    });
  } catch (error) {
    console.error("CUCKOO Sales Sync API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to synchronise CUCKOO sales.",
      },
      { status: 500 }
    );
  }
}
