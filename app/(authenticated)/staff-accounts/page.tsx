
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { getStaffProfile } from "@/lib/staff/get-staff-profile";
import StaffAccountsForm from "./StaffAccountsForm";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";

export const instant = false;

export default async function StaffAccountsPage() {
  await connection();

  const profile = await getStaffProfile();

  if (!profile) {
    redirect("/login");
  }

  // Only Directors can access this page.
  if (profile.role !== "DIRECTOR") {
    redirect("/");
  }

  return (
    <main className="app-shell">
      <TopBar
        role={profile.role}
        memberCode={profile.member_code}
      />

      <div
        style={{
          maxWidth: 1100,
          margin: "40px auto",
          padding: "24px",
          width: "100%",
          paddingBottom: 110,
        }}
      >
        <a
          href="/staff"
          style={{
            color: "#234B87",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ← Back to Staff
        </a>

        <h1 style={{ marginTop: 24 }}>
          Staff Login Accounts
        </h1>

        <p style={{ color: "#666", marginTop: 8 }}>
          Create login accounts for registered Action Force
          staff and Independent Distributors.
        </p>

        <section
          style={{
            marginTop: 24,
            padding: 24,
            border: "1px solid #ddd",
            borderRadius: 12,
          }}
        >
          <StaffAccountsForm />
        </section>
      </div>

      {/*<BottomNav role={profile.role} />*/}
    </main>
  );
}
