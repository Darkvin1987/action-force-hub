
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";
import { getMalaysiaMonthRange } from "@/lib/cuckoo/personal-sales";

type LeaderboardRole = "GAM" | "AM" | "SC";

type StaffRow = {
  id: string;
  member_code: string;
  full_name: string | null;
  role: string;
  manager_id: string | null;
};

type SalesOrderRow = {
  member_code: string;
  psi_unit_count: number | string | null;
};

type SalesTotals = {
  netSales: number;
  commUnits: number;
};

type LeaderboardEntry = {
  rank: number;
  memberCode: string;
  staffName: string;
  netSales: number;
  psiUnits: number;
};

function getVisibleRoles(role: string): LeaderboardRole[] {
  switch (role.toUpperCase()) {
    case "DIRECTOR":
    case "GAM":
      return ["GAM", "AM", "SC"];

    case "AM":
      return ["AM", "SC"];

    case "SC":
      return ["SC"];

    default:
      return [];
  }
}

async function getAllActiveStaff(
  admin: ReturnType<typeof createAdminClient>
): Promise<StaffRow[]> {
  const allStaff: StaffRow[] = [];
  const pageSize = 1000;

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await admin
      .from("staff_profiles")
      .select("id, member_code, full_name, role, manager_id")
      .eq("status", "ACTIVE")
      .not("member_code", "is", null)
      .range(start, start + pageSize - 1);

    if (error) {
      throw new Error(
        `Unable to retrieve leaderboard staff: ${error.message}`
      );
    }

    const page = (data ?? []) as StaffRow[];
    allStaff.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return allStaff;
}

async function getLeaderboardSales(
  admin: ReturnType<typeof createAdminClient>,
  staff: StaffRow[],
  from: string,
  toExclusive: string
): Promise<Map<string, SalesTotals>> {
  const totals = new Map<string, SalesTotals>();

  for (const person of staff) {
    totals.set(person.member_code, {
      netSales: 0,
      commUnits: 0,
    });
  }

  const memberCodes = staff.map((person) => person.member_code);
  const memberCodeChunkSize = 100;
  const pageSize = 1000;

  for (
    let chunkStart = 0;
    chunkStart < memberCodes.length;
    chunkStart += memberCodeChunkSize
  ) {
    const memberCodeChunk = memberCodes.slice(
      chunkStart,
      chunkStart + memberCodeChunkSize
    );

    for (let start = 0; ; start += pageSize) {
      const { data, error } = await admin
        .from("cuckoo_sales_orders")
        .select("member_code, psi_unit_count")
        .in("member_code", memberCodeChunk)
        .gte("net_date", from)
        .lt("net_date", toExclusive)
        .range(start, start + pageSize - 1);

      if (error) {
        throw new Error(
          `Unable to retrieve leaderboard sales: ${error.message}`
        );
      }

      const orders = (data ?? []) as SalesOrderRow[];

      for (const order of orders) {
        const current = totals.get(order.member_code);

        if (!current) {
          continue;
        }

        current.netSales += 1;
        current.commUnits += Number(order.psi_unit_count ?? 0);
      }

      if (orders.length < pageSize) {
        break;
      }
    }
  }

  return totals;
}

function buildChildrenMap(
  staff: StaffRow[]
): Map<string, StaffRow[]> {
  const childrenByManager = new Map<string, StaffRow[]>();

  for (const person of staff) {
    if (!person.manager_id) {
      continue;
    }

    const children =
      childrenByManager.get(person.manager_id) ?? [];

    children.push(person);
    childrenByManager.set(person.manager_id, children);
  }

  return childrenByManager;
}

function getGroupTotals(
  root: StaffRow,
  childrenByManager: Map<string, StaffRow[]>,
  totals: Map<string, SalesTotals>
): SalesTotals {
  const result: SalesTotals = {
    netSales: 0,
    commUnits: 0,
  };

  const visited = new Set<string>();

  function addBranch(person: StaffRow) {
    if (visited.has(person.id)) {
      return;
    }

    visited.add(person.id);

    // ID staff are excluded from GAM and AM group totals.
    if (person.role.toUpperCase() !== "ID") {
      const sales = totals.get(person.member_code);

      if (sales) {
        result.netSales += sales.netSales;
        result.commUnits += sales.commUnits;
      }
    }

    // Continue traversing descendants even if the current
    // staff member is ID.
    const children = childrenByManager.get(person.id) ?? [];

    for (const child of children) {
      addBranch(child);
    }
  }

  addBranch(root);

  return result;
}

function buildLeaderboard(
  role: LeaderboardRole,
  staff: StaffRow[],
  totals: Map<string, SalesTotals>,
  childrenByManager: Map<string, StaffRow[]>
): LeaderboardEntry[] {
  const roleStaff = staff
    .filter(
      (person) => person.role.toUpperCase() === role
    )
    .map((person) => {
      const individualSales = totals.get(person.member_code);

      // GAM and AM use their complete group totals.
      // SC continues to use individual sales.
      const sales =
        role === "SC"
          ? individualSales ?? { netSales: 0, commUnits: 0 }
          : getGroupTotals(
              person,
              childrenByManager,
              totals
            );

      return {
        memberCode: person.member_code,
        staffName:
          person.full_name?.trim() || person.member_code,
        netSales: sales.netSales,
        psiUnits: sales.commUnits,
      };
    });

  roleStaff.sort((a, b) => {
    if (b.netSales !== a.netSales) {
      return b.netSales - a.netSales;
    }

    return a.staffName.localeCompare(b.staffName);
  });

  return roleStaff.slice(0, 10).map((person, index) => ({
    rank: index + 1,
    ...person,
  }));
}

export async function GET() {
  try {
    const currentStaff = await getStaffProfile();

    if (!currentStaff) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorised access.",
        },
        { status: 401 }
      );
    }

    const visibleRoles = getVisibleRoles(currentStaff.role);

    if (visibleRoles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "You are not authorised to view leaderboards.",
        },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    // Current calendar month based on Malaysia time.
    const { from, toExclusive, toDisplay } =
      getMalaysiaMonthRange();

    // Retrieve all active staff so the complete reporting
    // hierarchy can be calculated across the organisation.
    const staff = await getAllActiveStaff(admin);

    // Retrieve monthly net sales and commission units.
    const totals = await getLeaderboardSales(
      admin,
      staff,
      from,
      toExclusive
    );

    // Build the reporting hierarchy.
    const childrenByManager = buildChildrenMap(staff);

    // Only return boards that the logged-in role can view.
    const leaderboards = visibleRoles.map((role) => ({
      role,
      title: `Top 10 ${role} Sales Performance`,
      entries: buildLeaderboard(
        role,
        staff,
        totals,
        childrenByManager
      ),
    }));

    return NextResponse.json(
      {
        success: true,
        period: {
          from,
          to: toDisplay,
        },
        leaderboards,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Sales leaderboards API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to retrieve sales leaderboards.",
      },
      { status: 500 }
    );
  }
}
