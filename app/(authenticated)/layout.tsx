
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { getStaffProfile } from "@/lib/staff/get-staff-profile";
import BottomNav from "@/components/BottomNav";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  const profile = await getStaffProfile();

  if (!profile) {
    redirect("/login");
  }

  // First-time users must change their temporary password.
  // The change-password page is now outside this layout.
  if (profile.must_change_password) {
    redirect("/change-password");
  }

  return (
    <>
      {children}
      <BottomNav role={profile.role} />
    </>
  );
}
