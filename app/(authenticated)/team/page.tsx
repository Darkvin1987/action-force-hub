
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import TeamClient from "./TeamClient";

export const instant = false;

export default async function TeamPage() {
  // Render this page at request time.
  await connection();

  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from("staff_profiles")
    .select(
      "id, member_code, full_name, role, organization_type, manager_id, status"
    )
    .eq("status", "ACTIVE")
    .order("full_name", { ascending: true });

  if (error) {
    console.error(
      "Unable to load organization chart:",
      error.message
    );
  }

  return (
    <TeamClient
      members={(members ?? []).map((member) => ({
        id: member.id,
        memberCode: member.member_code,
        name: member.full_name,
        role: member.role,
        organization: member.organization_type ?? "",
        parentId: member.manager_id,
        status: member.status,
      }))}
      loadError={
        error
          ? "Unable to load staff records. Please try again."
          : null
      }
    />
  );
}
