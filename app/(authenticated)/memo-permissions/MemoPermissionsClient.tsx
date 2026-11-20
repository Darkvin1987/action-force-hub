"use client";

import { useCallback, useEffect, useState } from "react";

type MemoCategory = "Announcement" | "Promotion" | "SOP" | "Training";

type PermissionStaff = {
  id: string;
  member_code: string;
  full_name: string;
  role: string;
  categories: string[];
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  staff?: PermissionStaff[];
};

const CATEGORIES: MemoCategory[] = [
  "Announcement",
  "Promotion",
  "SOP",
  "Training",
];

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 11,
  marginTop: 7,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  color: "#222",
};

export default function MemoPermissionsClient() {
  const [staff, setStaff] = useState<PermissionStaff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<MemoCategory>("Announcement");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/announcement-permissions", {
        method: "GET",
        cache: "no-store",
      });
      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to load memo permissions.");
      }

      setStaff(result.staff ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load memo permissions."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPermissions();
  }, [loadPermissions]);

  async function assignPermission() {
    if (!selectedStaffId) {
      setMessage("Please select a staff member.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/announcement-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_profile_id: selectedStaffId,
          category: selectedCategory,
        }),
      });
      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to assign memo permission.");
      }

      setMessage("Memo permission assigned successfully.");
      await loadPermissions();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to assign memo permission."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removePermission(staffProfileId: string, category: string) {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/announcement-permissions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_profile_id: staffProfileId,
          category,
        }),
      });
      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to remove memo permission.");
      }

      setMessage(`${category} permission removed successfully.`);
      await loadPermissions();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to remove memo permission."
      );
    } finally {
      setSaving(false);
    }
  }

  // The current-permissions list should only show staff who have
  // at least one category assigned. Keep the full staff list above
  // for the Director to assign permissions to new people.
  const filteredStaff = staff.filter((person) => {
    if (person.categories.length === 0) return false;

    const term = search.trim().toLowerCase();
    if (!term) return true;

    return (
      person.full_name.toLowerCase().includes(term) ||
      person.member_code.toLowerCase().includes(term) ||
      person.role.toLowerCase().includes(term)
    );
  });

  return (
    <section
      style={{
        marginTop: 28,
        padding: 24,
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        background: "#fff",
      }}
    >
      {message && (
        <p
          role="status"
          aria-live="polite"
          style={{
            padding: 12,
            margin: "0 0 20px",
            borderRadius: 8,
            background: message.toLowerCase().includes("successfully")
              ? "#e8f5e9"
              : "#fdecea",
            color: message.toLowerCase().includes("successfully")
              ? "#237a38"
              : "#c62828",
            fontSize: 14,
          }}
        >
          {message}
        </p>
      )}

      <h2 style={{ fontSize: 20, fontWeight: 700 }}>
        Assign Memo Creation Permission
      </h2>
      <p style={{ color: "#64748b", fontSize: 14, marginTop: 6 }}>
        Select a staff member and the memo category they are allowed to create.
        Staff can be assigned more than one category.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          alignItems: "end",
          marginTop: 22,
        }}
      >
        <label style={{ fontSize: 14, fontWeight: 600 }}>
          Staff Member
          <select
            value={selectedStaffId}
            onChange={(event) => setSelectedStaffId(event.target.value)}
            style={inputStyle}
          >
            <option value="">Select staff member</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name} ({person.member_code}) — {person.role}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 14, fontWeight: 600 }}>
          Memo Category
          <select
            value={selectedCategory}
            onChange={(event) =>
              setSelectedCategory(event.target.value as MemoCategory)
            }
            style={inputStyle}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={assignPermission}
          disabled={saving || loading || !selectedStaffId}
          style={{
            padding: 12,
            background: "#234B87",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            cursor: saving || !selectedStaffId ? "not-allowed" : "pointer",
            opacity: saving || loading || !selectedStaffId ? 0.6 : 1,
            fontWeight: 600,
          }}
        >
          {saving ? "Saving..." : "Assign Permission"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 36,
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>
            Current Memo Permissions
          </h2>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 5 }}>
            Remove a category individually to revoke that staff member&apos;s access.
          </p>
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, staff ID or role"
          aria-label="Search staff"
          style={{ ...inputStyle, marginTop: 0, maxWidth: 300 }}
        />
      </div>

      {loading ? (
        <p style={{ color: "#64748b" }}>Loading permissions...</p>
      ) : filteredStaff.length === 0 ? (
        <p style={{ color: "#64748b" }}>
          {staff.some((person) => person.categories.length > 0)
            ? "No matching staff members found."
            : "No memo permissions have been assigned yet."}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filteredStaff.map((person) => (
            <div
              key={person.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong style={{ color: "#1e293b" }}>
                    {person.full_name}
                  </strong>
                  <p style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                    {person.member_code} · {person.role}
                  </p>
                </div>
                <span style={{ color: "#64748b", fontSize: 13 }}>
                  {person.categories.length} categor
                  {person.categories.length === 1 ? "y" : "ies"} assigned
                </span>
              </div>

              {person.categories.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 14,
                  }}
                >
                  {person.categories.map((category) => (
                    <div
                      key={category}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 9px",
                        borderRadius: 20,
                        background: "#eaf1fb",
                        color: "#234B87",
                        fontSize: 13,
                      }}
                    >
                      <span>{category}</span>
                      <button
                        type="button"
                        onClick={() => void removePermission(person.id, category)}
                        disabled={saving}
                        aria-label={`Remove ${category} permission from ${person.full_name}`}
                        title={`Remove ${category} permission`}
                        style={{
                          border: 0,
                          background: "transparent",
                          color: "#234B87",
                          cursor: saving ? "not-allowed" : "pointer",
                          fontWeight: 700,
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 12 }}>
                  No memo creation permissions assigned.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
