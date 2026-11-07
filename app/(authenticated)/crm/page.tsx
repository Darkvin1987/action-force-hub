
import { connection } from "next/server";
import { redirect } from "next/navigation";
import TopBar from "@/components/TopBar";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";
import CRMClient from "./CRMClient";

export const instant = false;

export default async function CRMPage() {
  // Render this page at request time.
  await connection();

  const staff = await getStaffProfile();

  if (!staff) {
    redirect("/login");
  }

  return (
    <main className="crm-page">
      <TopBar
        role={staff.role}
        memberCode={staff.member_code}
      />

      <CRMClient />
    </main>
  );
}
