
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";
import StaffRegistrationForm from "./StaffRegistrationForm";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";

export const instant = false;

export default async function TeamManagementPage() {
  // Render this page at request time.
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
        }}
      >
              
      <a
        href="/staff"
        style={{
          color: "#234B87",
          textDecoration: "none",
          fontWeight: 600,
          display: "inline-block",
          marginBottom: 24,
        }}
      >
        ← Back to Staff
      </a>
      
        <h1>Staff Management</h1>

        <p style={{ color: "#666" }}>
          Manage Action Force staff profiles and reporting relationships.
        </p>

        <section
          style={{
            marginTop: 24,
            padding: 24,
            border: "1px solid #ddd",
            borderRadius: 12,
          }}
        >
          <h2>Team Structure</h2>

          <StaffRegistrationForm />
          
        </section>
      </div>

      {/*<BottomNav role={profile.role} />*/}
    </main>
  );
}
