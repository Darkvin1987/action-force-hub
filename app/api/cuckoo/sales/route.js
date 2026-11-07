
import { NextResponse } from "next/server";

import {
  getAuthorisedTeamMembers,
} from "@/lib/cuckoo/sync-team-sales";

import { getPersonalSales } from "@/lib/cuckoo/personal-sales";
import { getTeamSales } from "@/lib/cuckoo/team-sales";
import { getSalesStatusCounts } from "@/lib/cuckoo/sales-status";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";

async function getMonthlySalesTargets(
  admin,
  memberCode,
  targetMonth
) {
  const { data: profile, error: profileError } = await admin
    .from("staff_profiles")
    .select("role")
    .eq("member_code", memberCode)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error(
      profileError?.message || "Unable to retrieve staff role."
    );
  }

  const { data: targets, error } = await admin
    .from("monthly_sales_targets")
    .select("target_type, owner_member_code, target_units")
    .eq("target_month", targetMonth);

  if (error) {
    throw new Error(
      `Unable to retrieve monthly targets: ${error.message}`
    );
  }

  function getTarget(targetType) {
    const matchingTargets = targets ?? [];

    const personalOverride = matchingTargets.find(
      (item) =>
        item.target_type === targetType &&
        item.owner_member_code === memberCode
    );

    const defaultTarget = matchingTargets.find(
      (item) =>
        item.target_type === targetType &&
        item.owner_member_code === null
    );

    return (
      personalOverride?.target_units ??
      defaultTarget?.target_units ??
      0
    );
  }

  return {
    targetMonth,
    personal: getTarget("PERSONAL"),
    team: getTarget("TEAM"),
  };
}

async function getNewRecruitsForPeriod(
  admin,
  teamMemberCodes,
  year,
  month
) {
  if (teamMemberCodes.length === 0) return 0;

  const from = `${year}-${String(month).padStart(2, "0")}-01`;

  const nextMonth = new Date(Date.UTC(year, month, 1));

  const toExclusive = [
    nextMonth.getUTCFullYear(),
    String(nextMonth.getUTCMonth() + 1).padStart(2, "0"),
    "01",
  ].join("-");

  const { count, error } = await admin
    .from("staff_profiles")
    .select("id", { count: "exact", head: true })
    .in("member_code", teamMemberCodes)
    .gte("created_at", `${from}T00:00:00+08:00`)
    .lt("created_at", `${toExclusive}T00:00:00+08:00`)
    .eq("status", "ACTIVE");

  if (error) {
    throw new Error(
      `Unable to retrieve new recruits: ${error.message}`
    );
  }

  return count ?? 0;
}

export async function GET(request) {
  try {
    const staff = await getStaffProfile();

    if (!staff) {
      return NextResponse.json(
        { error: "Unauthorised access." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

    const nowParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());

    const currentYear = Number(
      nowParts.find((part) => part.type === "year")?.value
    );

    const currentMonth = Number(
      nowParts.find((part) => part.type === "month")?.value
    );

    const month =
      monthParam === null ? currentMonth : Number(monthParam);

    const year =
      yearParam === null ? currentYear : Number(yearParam);

    if (
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isInteger(year) ||
      year < 2000 ||
      year > currentYear + 1
    ) {
      return NextResponse.json(
        { error: "Invalid month or year selected." },
        { status: 400 }
      );
    }

    const targetMonth =
      `${year}-${String(month).padStart(2, "0")}-01`;

    const admin = createAdminClient();

    // Retrieve authorised team membership, without syncing sales.
    const teamInfo = await getAuthorisedTeamMembers(admin, {
      id: staff.id,
      member_code: staff.member_code,
      role: staff.role,
      manager_id: staff.manager_id,
    });

    const [
      newRecruitsForPeriod,
      personalSales,
      teamSales,
      monthlyTargets,
      salesStatus,
    ] = await Promise.all([
      getNewRecruitsForPeriod(
        admin,
        teamInfo.teamMemberCodes,
        year,
        month
      ),

      getPersonalSales(
        admin,
        staff.member_code,
        year,
        month
      ),

      getTeamSales(
        admin,
        teamInfo.teamMemberCodes,
        year,
        month
      ),

      getMonthlySalesTargets(
        admin,
        staff.member_code,
        targetMonth
      ),

      getSalesStatusCounts(
        admin,
        [...new Set([
          staff.member_code,
          ...teamInfo.teamMemberCodes,
        ])],
        year,
        month
      ),
    ]);

    return NextResponse.json(
      {
        success: true,

        selectedPeriod: {
          month,
          year,
          targetMonth,
        },

        // Kept in the response for compatibility with SalesClient.
        personalSync: {
          status: "NOT_RUN",
          message: "Dashboard data loaded from saved records.",
        },

        teamSync: {
          teamMemberCount: teamInfo.teamMemberCount,
          newRecruitsThisMonth: newRecruitsForPeriod,
          results: [],
        },

        personalSales,
        teamSales,
        monthlyTargets,
        salesStatus,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("CUCKOO Sales API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to retrieve CUCKOO sales.",
      },
      { status: 500 }
    );
  }
}
