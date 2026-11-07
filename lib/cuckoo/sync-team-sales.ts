
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncCuckooSales } from "@/lib/cuckoo/sync-sales";
import { getMalaysiaMonthRange } from "@/lib/cuckoo/personal-sales";

const FRESHNESS_MINUTES = 15;
const MEMBER_CONCURRENCY = 2;
const IN_PROGRESS_TIMEOUT_MINUTES = 10;

type StaffProfile = {
  id: string;
  member_code: string;
  role: string;
  manager_id: string | null;
  created_at: string | null;
};

const ALLOWED_CHILD_ROLES: Record<string, string[]> = {
  DIRECTOR: ["GAM", "ID"],
  GAM: ["AM", "SC", "ID"],
  AM: ["SC"],
  SC: [],
  ID: [],
};

function getAuthorisedTeam(
  manager: StaffProfile,
  allStaff: StaffProfile[]
): StaffProfile[] {
  const childrenByManager = new Map<string, StaffProfile[]>();

  for (const staff of allStaff) {
    if (!staff.manager_id) continue;

    const children = childrenByManager.get(staff.manager_id) ?? [];
    children.push(staff);
    childrenByManager.set(staff.manager_id, children);
  }

  const result: StaffProfile[] = [];
  const visited = new Set<string>([manager.id]);

  function visit(current: StaffProfile) {
    const allowedRoles = ALLOWED_CHILD_ROLES[current.role] ?? [];
    const children = childrenByManager.get(current.id) ?? [];

    for (const child of children) {
      if (visited.has(child.id)) continue;
      if (!allowedRoles.includes(child.role)) continue;

      visited.add(child.id);
      result.push(child);

      visit(child);
    }
  }

  visit(manager);

  return result;
}

export async function getAuthorisedTeamMembers(
  supabase: SupabaseClient,
  manager: StaffProfile
) {
  const { data: allStaff, error } = await supabase
    .from("staff_profiles")
    .select("id, member_code, role, manager_id, created_at")
    .eq("status", "ACTIVE");

  if (error) {
    throw new Error(
      `Unable to retrieve team members: ${error.message}`
    );
  }

  const team = getAuthorisedTeam(manager, allStaff ?? []);
  const { from, toExclusive } = getMalaysiaMonthRange();

  const newRecruitsThisMonth = team.filter((member) => {
    if (!member.created_at) return false;

    const createdAt = new Date(member.created_at);

    return (
      !Number.isNaN(createdAt.getTime()) &&
      createdAt >= new Date(`${from}T00:00:00+08:00`) &&
      createdAt < new Date(`${toExclusive}T00:00:00+08:00`)
    );
  }).length;

  return {
    teamMemberCount: team.length,
    newRecruitsThisMonth,
    teamMemberCodes: team.map((member) => member.member_code),
    team,
  };
}

export async function syncMemberIfStale(
  supabase: SupabaseClient,
  memberCode: string,
  force = false
) {
  const { data: status, error: statusError } = await supabase
    .from("cuckoo_sales_sync_status")
    .select("last_synced_at, sync_status, updated_at")
    .eq("member_code", memberCode)
    .maybeSingle();

  if (statusError) {
    throw new Error(
      `Unable to check sync status for ${memberCode}: ${statusError.message}`
    );
  }

  // Do not start a duplicate sync if another request is
  // already synchronising this member.
  const lastUpdatedAt = status?.updated_at
    ? new Date(status.updated_at).getTime()
    : 0;

  const isCurrentlySyncing =
    status?.sync_status === "IN_PROGRESS" &&
    Date.now() - lastUpdatedAt <
      IN_PROGRESS_TIMEOUT_MINUTES * 60 * 1000;

  if (isCurrentlySyncing) {
    return {
      memberCode,
      status: "IN_PROGRESS",
      message: "A synchronisation is already running.",
    };
  }

  const lastSyncedAt = status?.last_synced_at
    ? new Date(status.last_synced_at).getTime()
    : 0;

  const isFresh =
    status?.sync_status === "SUCCESS" &&
    Date.now() - lastSyncedAt <
      FRESHNESS_MINUTES * 60 * 1000;

  if (!force && isFresh) {
    return {
      memberCode,
      status: "SKIPPED",
      message: "Recent successful sync.",
    };
  }

  const now = new Date().toISOString();

  const { error: startError } = await supabase
    .from("cuckoo_sales_sync_status")
    .upsert(
      {
        member_code: memberCode,
        sync_status: "IN_PROGRESS",
        last_error: null,
        updated_at: now,
      },
      { onConflict: "member_code" }
    );

  if (startError) {
    throw new Error(
      `Unable to start sync for ${memberCode}: ${startError.message}`
    );
  }

  try {
    const result = await syncCuckooSales(supabase, memberCode);
    const completedAt = new Date().toISOString();

    const { error: successError } = await supabase
      .from("cuckoo_sales_sync_status")
      .upsert(
        {
          member_code: memberCode,
          last_synced_at: completedAt,
          sync_status: "SUCCESS",
          last_error: null,
          updated_at: completedAt,
        },
        { onConflict: "member_code" }
      );

    if (successError) {
      throw new Error(
        `Sales synced, but status update failed: ${successError.message}`
      );
    }

    return {
      memberCode,
      status: "SUCCESS",
      synced: result.synced,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown sync error";

    await supabase
      .from("cuckoo_sales_sync_status")
      .upsert(
        {
          member_code: memberCode,
          sync_status: "FAILED",
          last_error: message,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "member_code" }
      );

    return {
      memberCode,
      status: "FAILED",
      message,
    };
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex++;

      if (index >= items.length) return;

      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(limit, items.length) },
      () => runWorker()
    )
  );

  return results;
}

export async function syncAuthorisedTeamSales(
  supabase: SupabaseClient,
  manager: StaffProfile,
  force = false
) {
  const teamInfo = await getAuthorisedTeamMembers(supabase, manager);

  const results = await runWithConcurrency(
    teamInfo.team,
    MEMBER_CONCURRENCY,
    (member) =>
      syncMemberIfStale(
        supabase,
        member.member_code,
        force
      )
  );

  return {
    teamMemberCount: teamInfo.teamMemberCount,
    newRecruitsThisMonth: teamInfo.newRecruitsThisMonth,
    teamMemberCodes: teamInfo.teamMemberCodes,
    results,
  };
}
