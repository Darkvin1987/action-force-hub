
import { connection } from "next/server";
import { redirect } from "next/navigation";
import TopBar from "@/components/TopBar";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";
import SalesClient from "./SalesClient";

export const instant = false;

function getCurrentMalaysiaPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  return {
    year: Number(
      parts.find((part) => part.type === "year")?.value
    ),
    month: Number(
      parts.find((part) => part.type === "month")?.value
    ),
  };
}

export default async function SalesPage() {
  await connection();

  const staff = await getStaffProfile();

  if (!staff) {
    redirect("/login");
  }

  const period = getCurrentMalaysiaPeriod();

  return (
    <main className="sales-page">
      <TopBar
        role={staff.role}
        memberCode={staff.member_code}
      />

      <SalesClient
        initialMonth={period.month}
        initialYear={period.year}
      />
    </main>
  );
}
