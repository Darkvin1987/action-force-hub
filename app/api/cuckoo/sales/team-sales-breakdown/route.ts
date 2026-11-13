
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";
import { getAuthorisedTeamMembers } from "@/lib/cuckoo/sync-team-sales";

type TeamMember = {
  id: string;
  member_code: string;
  full_name: string;
  role: string;
  manager_id: string | null;
};

type SalesNode = {
  memberCode: string;
  name: string;
  role: string;

  // The member's own sales only.
  netSales: number;
  overallSales: number;

  // This member's own sales plus all descendants.
  groupNetSales: number;
  groupOverallSales: number;

  children: SalesNode[];
};

type SalesGroup = {
  title: string;
  netSales: number;
  overallSales: number;
  members: SalesNode[];
};

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

function getMonthRange(year: number, month: number) {
  const monthStart =
    `${year}-${String(month).padStart(2, "0")}-01`;

  const nextMonth = new Date(Date.UTC(year, month, 1));

  const nextMonthStart = [
    nextMonth.getUTCFullYear(),
    String(nextMonth.getUTCMonth() + 1).padStart(2, "0"),
    "01",
  ].join("-");

  return { monthStart, nextMonthStart };
}

function sortMembers(members: TeamMember[]) {
  return [...members].sort((a, b) =>
    a.full_name.localeCompare(b.full_name)
  );
}

export async function GET(request: Request) {
  try {
    // 1. Authenticate the current staff member.
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

    const authenticatedStaff = staff;

    // 2. Get the selected month and year.
    const { searchParams } = new URL(request.url);
    const currentPeriod = getCurrentMalaysiaPeriod();

    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

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
        {
          success: false,
          error: "Invalid month or year.",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 3. Retrieve the authorised reporting team.
    const teamInfo = await getAuthorisedTeamMembers(admin, {
      id: authenticatedStaff.id,
      member_code: authenticatedStaff.member_code,
      role: authenticatedStaff.role,
      manager_id: authenticatedStaff.manager_id,
      created_at: null,
    });

    const teamCodes = teamInfo.teamMemberCodes;

    if (teamCodes.length === 0) {
      return NextResponse.json(
        {
          success: true,
          selectedPeriod: { month, year },
          groups: [],
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // 4. Retrieve authorised member profiles.
    const { data: profiles, error: profileError } = await admin
      .from("staff_profiles")
      .select("id, member_code, full_name, role, manager_id")
      .eq("status", "ACTIVE")
      .in("member_code", teamCodes);

    if (profileError) {
      throw new Error(
        `Unable to retrieve team profiles: ${profileError.message}`
      );
    }

    const members: TeamMember[] = profiles ?? [];

    // 5. Retrieve sales counts for the selected month.
    const { monthStart, nextMonthStart } =
      getMonthRange(year, month);

    const { data: salesData, error: salesError } =
      await admin.rpc("get_cuckoo_member_monthly_sales", {
        p_member_codes: teamCodes,
        p_month_start: monthStart,
        p_next_month_start: nextMonthStart,
      });

    if (salesError) {
      throw new Error(
        `Unable to retrieve team sales: ${salesError.message}`
      );
    }

    const salesByMember = new Map<
      string,
      {
        netSales: number;
        overallSales: number;
      }
    >();

    for (const item of salesData ?? []) {
      salesByMember.set(item.member_code, {
        netSales: Number(item.net_sales ?? 0),
        overallSales: Number(item.overall_sales ?? 0),
      });
    }

    // 6. Build the reporting relationships.
    const childrenByManager = new Map<string, TeamMember[]>();

    for (const member of members) {
      if (!member.manager_id) continue;

      const children =
        childrenByManager.get(member.manager_id) ?? [];

      children.push(member);
      childrenByManager.set(member.manager_id, children);
    }

    // 7. Build each member's tree node and calculate
    // their total group sales recursively.
    function buildTree(
      member: TeamMember,
      visited: Set<string>
    ): SalesNode {
      if (visited.has(member.id)) {
        throw new Error(
          `Circular reporting relationship detected for ${member.member_code}.`
        );
      }

      const nextVisited = new Set(visited);
      nextVisited.add(member.id);

      const ownSales = salesByMember.get(member.member_code);

      const children = sortMembers(
        childrenByManager.get(member.id) ?? []
      ).map((child) => buildTree(child, nextVisited));

      const ownNetSales = ownSales?.netSales ?? 0;
      const ownOverallSales = ownSales?.overallSales ?? 0;

      const groupNetSales =
        ownNetSales +
        children.reduce(
          (total, child) => total + child.groupNetSales,
          0
        );

      const groupOverallSales =
        ownOverallSales +
        children.reduce(
          (total, child) => total + child.groupOverallSales,
          0
        );

      return {
        memberCode: member.member_code,
        name: member.full_name,
        role: member.role,
        netSales: ownNetSales,
        overallSales: ownOverallSales,
        groupNetSales,
        groupOverallSales,
        children,
      };
    }

    // 8. Identify authorised direct reports.
    const directReports = sortMembers(
      members.filter(
        (member) =>
          member.manager_id === authenticatedStaff.id
      )
    );

    const groups: SalesGroup[] = [];
    const directReportRoots: TeamMember[] = [];

    for (const directReport of directReports) {
      // GAM and AM receive their own separate sections.
      if (
        directReport.role === "GAM" ||
        directReport.role === "AM"
      ) {
        const root = buildTree(
          directReport,
          new Set<string>()
        );

        groups.push({
          title: `${directReport.role} — ${directReport.full_name}`,
          netSales: root.groupNetSales,
          overallSales: root.groupOverallSales,
          members: [root],
        });
      } else {
        // Direct SC / ID reports are grouped together.
        directReportRoots.push(directReport);
      }
    }

    // 9. Include Direct Reports only when applicable.
    if (directReportRoots.length > 0) {
      const roots = directReportRoots.map((member) =>
        buildTree(member, new Set<string>())
      );

      groups.push({
        title: "Direct Reports",
        netSales: roots.reduce(
          (total, node) => total + node.groupNetSales,
          0
        ),
        overallSales: roots.reduce(
          (total, node) => total + node.groupOverallSales,
          0
        ),
        members: roots,
      });
    }

    // 10. Return the completed hierarchy.
    return NextResponse.json(
      {
        success: true,
        selectedPeriod: {
          month,
          year,
        },
        groups,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Team sales breakdown API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to retrieve team sales.",
      },
      { status: 500 }
    );
  }
}
