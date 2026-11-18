
import { redirect } from "next/navigation";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";
import ChangePasswordForm from "../(authenticated)/change-password/ChangePasswordForm";

export default async function ChangePasswordPage() {
  const profile = await getStaffProfile();

  if (!profile) {
    redirect("/login?next=/change-password");
  }

  if (profile.must_change_password !== true) {
    redirect("/");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#f4f7fb",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 460,
          padding: 32,
          background: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>
          Set Your New Password
        </h1>

        <p style={{ color: "#64748b", lineHeight: 1.6, marginBottom: 24 }}>
          Welcome to Action Force Hub, {profile.full_name}. For your account
          security, please replace your temporary password before continuing.
        </p>

        <ChangePasswordForm />
      </section>
    </main>
  );
}
