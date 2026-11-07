
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

  return (
    <>
      {children}

      <BottomNav role={profile.role} />
    </>
  );
}
