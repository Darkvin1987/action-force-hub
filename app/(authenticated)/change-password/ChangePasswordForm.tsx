"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordForm() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 12 || password.length > 128) {
      setError("Your password must contain between 12 and 128 characters.");
      return;
    }

    if (
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      setError(
        "Include at least one lowercase letter, one uppercase letter, and one number."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: password }),
      });

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        setError(result.error || "Unable to change your password.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("A connection error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label
        htmlFor="new-password"
        style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
      >
        New password
      </label>

      <input
        id="new-password"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Enter your new password"
        style={inputStyle}
      />

      <label
        htmlFor="confirm-password"
        style={{
          display: "block",
          marginTop: 18,
          marginBottom: 8,
          fontWeight: 600,
        }}
      >
        Confirm new password
      </label>

      <input
        id="confirm-password"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        placeholder="Enter your new password again"
        style={inputStyle}
      />

      <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
        Use 12–128 characters, including uppercase and lowercase letters and at
        least one number.
      </p>

      {error && (
        <p
          role="alert"
          style={{
            color: "#b91c1c",
            background: "#fef2f2",
            padding: 12,
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          marginTop: 12,
          padding: 14,
          border: "none",
          borderRadius: 8,
          background: loading ? "#94a3b8" : "#234b87",
          color: "#ffffff",
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Updating password..." : "Change Password"}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  fontSize: 15,
};