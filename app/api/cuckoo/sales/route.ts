
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";

import { getPersonalSales } from "@/lib/cuckoo/personal-sales";
import { getTeamSales } from "@/lib/cuckoo/team-sales";
import { getSalesStatusCounts } from "@/lib/cuckoo/sales-status";
import { getAuthorisedTeamMembers } from "@/lib/cuckoo/sync-team-sales";

type TargetType = "PERSONAL" | "TEAM";

function getCurrentMalaysiaPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
  };
}

async function getMonthlyTarget(
  admin: ReturnType<typeof createAdminClient>,
  targetMonth: string,
  targetType: TargetType,
  memberCode: string
): Promise<number> {
  // First, look for a target assigned specifically to this staff member.
  const { data: personalTarget, error: personalError } = await admin
    .from("monthly_sales_targets")
    .select("target_units")
    .eq("target_month", targetMonth)
    .eq("target_type", targetType)
    .eq("owner_member_code", memberCode)
    .maybeSingle();

  if (personalError) {
    throw new Error(
      `Unable to retrieve ${targetType.toLowerCase()} target: ${personalError.message}`
    );
  }

  if (personalTarget) {
    return personalTarget.target_units;
  }

  // If no individual target exists, use the global target.
  const { data: globalTarget, error: globalError } = await admin
    .from("monthly_sales_targets")
    .select("target_units")
    .eq("target_month", targetMonth)
    .eq("target_type", targetType)
    .is("owner_member_code", null)
    .maybeSingle();

  if (globalError) {
    throw new Error(
      `Unable to retrieve global ${targetType.toLowerCase()} target: ${globalError.message}`
    );
  }

  return globalTarget?.target_units ?? 0;
}

export async function GET(request: Request) {
  try {
    // 1. Authenticate the logged-in staff member.
    const staff = await getStaffProfile();

    if (!staff) {
      return NextResponse.json(
        { success: false, error: "Unauthorised access." },
        { status: 401 }
      );
    }

    // 2. Read the selected period.
    // The main Dashboard does not send a month or year,
    // so it will automatically use the current Malaysia month.
    const { searchParams } = new URL(request.url);

    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

    const currentPeriod = getCurrentMalaysiaPeriod();

    const month = monthParam
      ? Number(monthParam)
      : currentPeriod.month;

    const year = yearParam
      ? Number(yearParam)
      : currentPeriod.year;

    if (
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid month or year." },
        { status: 400 }
      );
    }

    const targetMonth =
      `${year}-${String(month).padStart(2, "0")}-01`;

    // 3. Use the admin client for server-side database queries.
    // Access is still restricted by the authenticated staff profile.
    const admin = createAdminClient();

    // 4. Retrieve the authorised reporting team.
    const teamInfo = await getAuthorisedTeamMembers(admin, {
      id: staff.id,
      member_code: staff.member_code,
      role: staff.role,
      manager_id: staff.manager_id,
      created_at: null,
    });

    // 5. Retrieve personal and team sales figures.
    const [
      personalSales,
      teamSales,
      personalTarget,
      teamTarget,
      salesStatus,
    ] = await Promise.all([
      getPersonalSales(admin, staff.member_code, year, month),

      getTeamSales(admin, teamInfo.teamMemberCodes, year, month),

      getMonthlyTarget(
        admin,
        targetMonth,
        "PERSONAL",
        staff.member_code
      ),

      getMonthlyTarget(
        admin,
        targetMonth,
        "TEAM",
        staff.member_code
      ),

      getSalesStatusCounts(
        admin,
        [staff.member_code, ...teamInfo.teamMemberCodes],
        year,
        month
      ),
    ]);

    // 6. Retrieve the latest sync status for authorised team members.
    let syncResults: Array<{
      memberCode: string;
      status: string;
    }> = [];

    if (teamInfo.teamMemberCodes.length > 0) {
      const { data: syncStatuses, error: syncError } = await admin
        .from("cuckoo_sales_sync_status")
        .select("member_code, sync_status")
        .in("member_code", teamInfo.teamMemberCodes);

      if (syncError) {
        throw new Error(
          `Unable to retrieve team sync status: ${syncError.message}`
        );
      }

      syncResults = (syncStatuses ?? []).map((item) => ({
        memberCode: item.member_code,
        status: item.sync_status,
      }));
    }

    // 7. Return the response expected by both dashboard pages.
    return NextResponse.json(
      {
        success: true,

        selectedPeriod: {
          month,
          year,
          targetMonth,
        },

        personalSales,
        teamSales,

        monthlyTargets: {
          personal: personalTarget,
          team: teamTarget,
          targetMonth,
        },

        teamSync: {
          teamMemberCount: teamInfo.teamMemberCount,
          newRecruitsThisMonth: teamInfo.newRecruitsThisMonth,
          results: syncResults,
        },

        salesStatus,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Sales dashboard API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to retrieve sales data.",
      },
      { status: 500 }
    );
  }
}
