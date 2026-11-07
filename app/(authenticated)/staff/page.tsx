
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { getStaffProfile } from "@/lib/staff/get-staff-profile";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";

export const instant = false;

export default async function StaffPage() {
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
          margin: "0 auto",
          padding: "32px 24px 110px",
          width: "100%",
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>
            Staff
          </h1>

          <p style={{ color: "#64748b", marginTop: 8 }}>
            Manage staff profiles, reporting relationships and login accounts.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
          }}
        >
          {/* Staff Management */}
          <Link
            href="/team-management"
            style={{
              display: "block",
              textDecoration: "none",
              color: "inherit",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: "#eaf1fb",
                color: "#234B87",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                marginBottom: 20,
              }}
            >
              ♙
            </div>

            <h2 style={{ fontSize: 19, fontWeight: 700 }}>
              Staff Management
            </h2>

            <p
              style={{
                color: "#64748b",
                fontSize: 14,
                lineHeight: 1.6,
                marginTop: 8,
              }}
            >
              Register new staff members and manage their reporting
              relationships within the organisation.
            </p>

            <div
              style={{
                color: "#234B87",
                fontWeight: 600,
                fontSize: 14,
                marginTop: 24,
              }}
            >
              Manage Staff →
            </div>
          </Link>

          {/* Staff Login Accounts */}
          <Link
            href="/staff-accounts"
            style={{
              display: "block",
              textDecoration: "none",
              color: "inherit",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: "#eaf1fb",
                color: "#234B87",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                marginBottom: 20,
              }}
            >
              ⚙
            </div>

            <h2 style={{ fontSize: 19, fontWeight: 700 }}>
              Staff Login Accounts
            </h2>

            <p
              style={{
                color: "#64748b",
                fontSize: 14,
                lineHeight: 1.6,
                marginTop: 8,
              }}
            >
              Create login accounts for registered staff members
              and Independent Distributors.
            </p>

            <div
              style={{
                color: "#234B87",
                fontWeight: 600,
                fontSize: 14,
                marginTop: 24,
              }}
            >
              Manage Login Accounts →
            </div>
          </Link>
        </div>
      </div>

      {/*<BottomNav role={profile.role} />*/}
    </main>
  );
}
