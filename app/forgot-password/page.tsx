
"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [memberCode, setMemberCode] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");

  async function handleReset(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");
    setMaskedPhone("");
    setLoading(true);

    try {
      const normalizedCode = memberCode.trim().toUpperCase();
      const normalizedEmail = email.trim().toLowerCase();

      if (!/^[A-Z0-9_-]{3,40}$/.test(normalizedCode)) {
        setErrorMessage("Please enter a valid Member Code.");
        return;
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      ) {
        setErrorMessage("Please enter a valid email address.");
        return;
      }

      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberCode: normalizedCode,
          email: normalizedEmail,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        maskedPhone?: string;
      };

      if (!response.ok || !result.ok) {
        setErrorMessage(
          result.message ||
            result.error ||
            "Unable to reset your password. Please check your details."
        );
        return;
      }

      setMaskedPhone(result.maskedPhone || "+6••••••••");
      setSuccessMessage(
        result.message ||
          "Your password has been reset successfully."
      );

    } catch {
      setErrorMessage(
        "A connection error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">ACTION FORCE</div>

        <h1>Reset Your Password</h1>

        {!successMessage ? (
          <>
            <p className="login-subtitle">
              Enter your Member Code and registered email address
              to reset your password.
            </p>

            <form onSubmit={handleReset}>
              <label htmlFor="memberCode">
                Member Code
              </label>

              <input
                id="memberCode"
                type="text"
                autoComplete="username"
                placeholder="Enter your Member Code"
                value={memberCode}
                onChange={(event) =>
                  setMemberCode(event.target.value)
                }
                minLength={3}
                maxLength={40}
                required
              />

              <label htmlFor="email">
                Registered Email Address
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="Enter your registered email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                maxLength={254}
                required
              />

              {errorMessage && (
                <p
                  className="login-error"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}

              <button type="submit" disabled={loading}>
                {loading
                  ? "Resetting Password..."
                  : "Reset Password"}
              </button>
            </form>

            <p className="login-footer">
              Your Member Code and email address must match
              your registered staff account.
            </p>
          </>
        ) : (
          <>
            <div
              role="status"
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 10,
                padding: 18,
                marginTop: 20,
                marginBottom: 20,
              }}
            >
              <h2
                style={{
                  color: "#166534",
                  fontSize: 19,
                  marginBottom: 10,
                }}
              >
                Password Reset Successful!
              </h2>

              <p
                style={{
                  color: "#166534",
                  lineHeight: 1.6,
                  marginBottom: 14,
                }}
              >
                {successMessage}
              </p>

              <p
                style={{
                  color: "#166534",
                  fontSize: 14,
                  marginBottom: 6,
                }}
              >
                Your temporary password is now your registered
                phone number:
              </p>

              <p
                style={{
                  color: "#166534",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: 1,
                  marginBottom: 12,
                }}
              >
                {maskedPhone}
              </p>

              <p
                style={{
                  color: "#166534",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                Please use your full registered phone number,
                including the +6 prefix, together with your
                Member Code to log in. You will be required
                to create a new password.
              </p>
            </div>

            <Link
              href="/login"
              style={{
                display: "block",
                width: "100%",
                boxSizing: "border-box",
                padding: 14,
                borderRadius: 8,
                background: "#234b87",
                color: "#ffffff",
                fontWeight: 600,
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              Return to Login
            </Link>
          </>
        )}

        {!successMessage && (
          <p className="login-footer">
            <Link
              href="/login"
              style={{
                color: "#24518D",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Back to Login
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}
