
import { createClient } from "@/lib/supabase/server";

export async function getStaffProfile() {
  const supabase = await createClient();

  const {
    data: claims,
    error: claimsError,
  } = await supabase.auth.getClaims();

  if (claimsError || !claims?.claims?.sub) {
    return null;
  }

  const userId = claims.claims.sub;

  const { data: profile, error } = await supabase
    .from("staff_profiles")
    .select(
      "id, user_id, member_code, full_name, role, organization_type, manager_id, status, must_change_password"
    )
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (error) {
    console.error("Unable to load staff profile:", error.message);
    return null;
  }

  return profile;
}
