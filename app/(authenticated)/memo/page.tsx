
import { connection } from "next/server";
import { redirect } from "next/navigation";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";
import MemoClient from "./MemoClient";

export const instant = false;

export default async function MemoPage() {
  await connection();

  const staff = await getStaffProfile();

  if (!staff) {
    redirect("/login");
  }

  return (
    <main className="memo-page">
      <TopBar
        role={staff.role}
        memberCode={staff.member_code}
      />

      <MemoClient role={staff.role} />

      {/*<BottomNav />*/}
    </main>
  );
}
