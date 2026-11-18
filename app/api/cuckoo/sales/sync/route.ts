
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";

import {
  getAuthorisedTeamMembers,
  syncMemberIfStale,
  type StaffProfile,
} from "@/lib/cuckoo/sync-team-sales";

export async function POST(request: Request) {
  try {
    // 1. Authenticate the logged-in staff member.
    const staff = await getStaffProfile();

    if (!staff) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorised access.",
        },
        { status: 401 }
      );
    }

    // 2. Read the request body safely.
    const rawBody: unknown = await request.json().catch(() => ({}));

    const body =
      typeof rawBody === "object" &&
      rawBody !== null &&
      !Array.isArray(rawBody)
        ? (rawBody as Record<string, unknown>)
        : {};

    const action = body.action;
    const force = body.force === true;

    // 3. Create the server-side database client.
    const admin = createAdminClient();

    // 4. Prepare the authenticated manager profile.
    const manager: StaffProfile = {
      id: staff.id,
      member_code: staff.member_code,
      role: staff.role,
      manager_id: staff.manager_id,
      created_at: null,
    };

    // 5. Retrieve the authorised team.
    const teamInfo = await getAuthorisedTeamMembers(
      admin,
      manager
    );

    // ACTION A: Return the authorised member list.
    if (action === "list") {
      return NextResponse.json(
        {
          success: true,
          personalMemberCode: staff.member_code,
          teamMemberCount: teamInfo.teamMemberCount,
          newRecruitsThisMonth:
            teamInfo.newRecruitsThisMonth,
          teamMemberCodes: teamInfo.teamMemberCodes,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // ACTION B: Synchronise one member only.
    if (action === "sync") {
      const memberCode =
        typeof body.memberCode === "string"
          ? body.memberCode.trim().toUpperCase()
          : "";

      if (!memberCode) {
        return NextResponse.json(
          {
            success: false,
            error: "Member Code is required.",
          },
          { status: 400 }
        );
      }

      // The user may synchronise their own sales.
      const isOwnMember =
        staff.member_code.toUpperCase() === memberCode;

      // Or synchronise a member within their authorised team.
      const isAuthorisedTeamMember =
        teamInfo.team.some(
          (member) =>
            member.member_code.toUpperCase() === memberCode
        );

      if (!isOwnMember && !isAuthorisedTeamMember) {
        return NextResponse.json(
          {
            success: false,
            error: "You are not authorised to synchronise this member.",
          },
          { status: 403 }
        );
      }

      const result = await syncMemberIfStale(
        admin,
        memberCode,
        force
      );

      return NextResponse.json(
        {
          success: true,
          result,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Invalid synchronisation action.",
      },
      { status: 400 }
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
