
"use client";

import { useEffect, useState } from "react";

type Staff = {
  id: string;
  member_code: string;
  full_name: string;
  role: string;
  organization_type: string;
  status: string;
  user_id?: string | null;
};

type CreatedAccount = {
  staff: {
    member_code: string;
    full_name: string;
    email: string;
  };
  temporary_password: string;
};

export default function StaffAccountsForm() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffProfileId, setStaffProfileId] = useState("");
  const [email, setEmail] = useState("");
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadStaff() {
    try {
      const response = await fetch("/api/staff-management");
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to load staff.");
        return;
      }

      setStaff(result.staff ?? []);
    } catch {
      setMessage("Unable to connect to the server.");
    }
  }

  useEffect(() => {
    void loadStaff();
  }, []);

  const eligibleStaff = staff.filter(
    (person) =>
      person.status === "ACTIVE" &&
      ["GAM", "AM", "SC", "ID"].includes(person.role) &&
      !person.user_id
  );

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");
    setCreated(null);

    if (!staffProfileId || !email.trim()) {
      setMessage("Please select a staff member and enter an email.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/staff-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_profile_id: staffProfileId,
          email: email.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to create the account.");
        return;
      }

      setCreated(result);
      setMessage(result.message ?? "Account created successfully.");
      setStaffProfileId("");
      setEmail("");

      await loadStaff();
    } catch {
      setMessage("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        marginTop: 24,
        padding: 24,
        border: "1px solid #ddd",
        borderRadius: 12,
      }}
    >
      <h2>Create Staff Login</h2>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: 16,
          maxWidth: 600,
          marginTop: 20,
        }}
      >
        <label>
          Staff Member
          <select
            required
            value={staffProfileId}
            onChange={(event) =>
              setStaffProfileId(event.target.value)
            }
            style={inputStyle}
          >
            <option value="">Select staff member</option>

            {eligibleStaff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name} — {person.member_code} ({person.role})
              </option>
            ))}
          </select>
        </label>

        {eligibleStaff.length === 0 && (
          <p style={{ color: "#666" }}>
            No eligible staff without a linked login account were
            found. If you have just registered staff, refresh this page.
          </p>
        )}

        <label>
          Staff Email Address
          <input
            required
            type="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="staff@example.com"
            style={inputStyle}
          />
        </label>

        <button
          type="submit"
          disabled={loading || eligibleStaff.length === 0}
          style={{
            padding: 12,
            background: "#234B87",
            color: "white",
            border: 0,
            borderRadius: 8,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Creating account..." : "Create Login Account"}
        </button>
      </form>

      {message && (
        <p role="status" aria-live="polite">{message}</p>
      )}

      {created && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            border: "1px solid #d6b65c",
            borderRadius: 10,
            background: "#fffbea",
            color: "#222",
          }}
        >
          <h3>Temporary Password — Copy Now</h3>

          <p>
            <strong>Staff:</strong> {created.staff.full_name}
          </p>
          <p>
            <strong>Staff ID:</strong> {created.staff.member_code}
          </p>
          <p>
            <strong>Email:</strong> {created.staff.email}
          </p>

          <p>
            <strong>Temporary password:</strong>
          </p>

          <code
            style={{
              display: "block",
              padding: 12,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 6,
              overflowWrap: "anywhere",
            }}
          >
            {created.temporary_password}
          </code>

          <button
            type="button"
            onClick={() =>
              void navigator.clipboard.writeText(
                created.temporary_password
              )
            }
            style={{
              marginTop: 12,
              padding: 10,
              background: "#234B87",
              color: "white",
              border: 0,
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Copy Temporary Password
          </button>

          <p style={{ fontSize: 13 }}>
            Copy and deliver this password securely to the staff member.
            It will not be shown again after you leave this page.
          </p>
        </div>
      )}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 10,
  marginTop: 6,
  border: "1px solid #ccc",
  borderRadius: 6,
  background: "white",
  color: "#222",
};