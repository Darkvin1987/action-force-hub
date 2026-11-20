import { connection } from "next/server";
import { redirect } from "next/navigation";

import { getStaffProfile } from "@/lib/staff/get-staff-profile";
import TopBar from "@/components/TopBar";
import MemoPermissionsClient from "./MemoPermissionsClient";

export const instant = false;

export default async function MemoPermissionsPage() {
  await connection();

  const profile = await getStaffProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "DIRECTOR") {
    redirect("/");
  }

  return (
    <main className="app-shell">
      <TopBar role={profile.role} memberCode={profile.member_code} />

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

        <h1 style={{ marginTop: 24 }}>Memo Permissions</h1>

        <p style={{ color: "#64748b", marginTop: 8 }}>
          Assign and manage which staff members can create memos in each category.
        </p>

        <MemoPermissionsClient />
      </div>
    </main>
  );
}
