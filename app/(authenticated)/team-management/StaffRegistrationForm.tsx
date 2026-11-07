
"use client";

import { useEffect, useState } from "react";

type StaffRole = "GAM" | "AM" | "SC" | "ID";

type OrganizationType =
  | "ACTION_FORCE"
  | "INDEPENDENT_DISTRIBUTOR";

type Staff = {
  id: string;
  member_code: string;
  full_name: string;
  role: string;
  organization_type: string;
  manager_id: string | null;
  status: string;
};

export default function StaffRegistrationForm() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffId, setStaffId] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<StaffRole>("GAM");
  const [organization, setOrganization] =
    useState<OrganizationType>("ACTION_FORCE");
  const [managerId, setManagerId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadStaff() {
    const response = await fetch("/api/staff-management");
    const result = await response.json();

    if (response.ok) {
      setStaff(result.staff ?? []);
    } else {
      setMessage(result.error ?? "Unable to load staff.");
    }
  }

  useEffect(() => {
    void loadStaff();
  }, []);

  const isSuccess = message.includes("successfully");

  const managers = staff.filter((person) => {
    if (person.status !== "ACTIVE") return false;

    if (role === "GAM") {
      return (
        person.role === "DIRECTOR" &&
        person.organization_type === "ACTION_FORCE"
      );
    }

    if (role === "ID") {
      return (
        ["DIRECTOR", "GAM"].includes(person.role) &&
        person.organization_type === "ACTION_FORCE"
      );
    }

    if (role === "AM") {
      return (
        person.role === "GAM" &&
        person.organization_type === "ACTION_FORCE"
      );
    }

    if (role === "SC") {
      return (
        ["AM", "GAM"].includes(person.role) &&
        person.organization_type === "ACTION_FORCE"
      );
    }

    return false;
  });

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    if (!managerId) {
      setMessage("Please select a reporting manager.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/staff-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_code: staffId.trim().toUpperCase(),
          full_name: fullName.trim(),
          role,
          organization_type: organization,
          manager_id: managerId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to create staff profile.");
        return;
      }

      setMessage("Staff profile created successfully.");

      setStaffId("");
      setFullName("");
      setRole("GAM");
      setOrganization("ACTION_FORCE");
      setManagerId("");

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
      {message && (
        <p
          role="status"
          aria-live="polite"
          style={{
            padding: 12,
            margin: "0 0 16px",
            borderRadius: 8,
            background: isSuccess ? "#e8f5e9" : "#fdecea",
            color: isSuccess ? "#237a38" : "#c62828",
            fontSize: 14,
          }}
        >
          {message}
        </p>
      )}

      <h2>Register Staff Profile</h2>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: 16,
          maxWidth: 560,
          marginTop: 20,
        }}
      >
        <label>
          Staff ID
          <input
            required
            minLength={3}
            maxLength={40}
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            placeholder="e.g. AF000001"
            style={inputStyle}
          />
        </label>

        <label>
          Full Name
          <input
            required
            minLength={2}
            maxLength={100}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter full name"
            style={inputStyle}
          />
        </label>

        <label>
          Role
          <select
            value={role}
            onChange={(e) => {
              const nextRole = e.target.value as StaffRole;

              setRole(nextRole);
              setManagerId("");
              setOrganization(
                nextRole === "ID"
                  ? "INDEPENDENT_DISTRIBUTOR"
                  : "ACTION_FORCE"
              );
              setMessage("");
            }}
            style={inputStyle}
          >
            <option value="GAM">Group Agency Manager (GAM)</option>
            <option value="AM">Agency Manager (AM)</option>
            <option value="SC">Sales Consultant (SC)</option>
            <option value="ID">Independent Distributor (ID)</option>
          </select>
        </label>

        <label>
          Organization
          <select
            value={organization}
            disabled
            style={{
              ...inputStyle,
              background: "#f1f3f5",
              cursor: "not-allowed",
            }}
          >
            <option value="ACTION_FORCE">Action Force</option>
            <option value="INDEPENDENT_DISTRIBUTOR">
              Independent Distributor
            </option>
          </select>

          <small style={{ color: "#666" }}>
            Automatically determined by the selected role.
          </small>
        </label>

        <label>
          Reporting Manager
          <select
            required
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select reporting manager</option>

            {managers.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name} ({person.role})
              </option>
            ))}
          </select>

          {managers.length === 0 && (
            <small>
              No eligible active manager is available for this role.
            </small>
          )}
        </label>

        <button
          type="submit"
          disabled={loading || managers.length === 0}
          style={{
            padding: 12,
            background: "#234B87",
            color: "white",
            border: 0,
            borderRadius: 8,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Creating..." : "Create Staff Profile"}
        </button>
      </form>
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
