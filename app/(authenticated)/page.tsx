
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";
import DashboardClient from "./DashboardClient";

function DashboardLoading() {
  return (
    <main className="app-shell">
      <div className="dashboard">
        <section className="welcome">
          <h1>Loading Action Force Hub...</h1>
          <p className="muted">Checking your staff account.</p>
        </section>
      </div>
    </main>
  );
}

async function DashboardContent() {
  await connection();

  const staff = await getStaffProfile();

  if (!staff) {
    redirect("/login");
  }

  if (!staff.member_code) {
    throw new Error("Staff member code is missing.");
  }

  return (
    <DashboardClient
      profile={{
        fullName: staff.full_name,
        memberCode: staff.member_code,
        role: staff.role,
        organizationType: staff.organization_type,
      }}
    />
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
