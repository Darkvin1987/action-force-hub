
"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";

  const [memberCode, setMemberCode] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      const normalizedCode = memberCode.trim().toUpperCase();

      if (!/^[A-Z0-9_-]{3,40}$/.test(normalizedCode)) {
        setErrorMessage(
          "Enter a valid Member Code (3–40 letters, numbers, hyphens or underscores)."
        );
        return;
      }

      const response = await fetch("/api/staff-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberCode: normalizedCode,
          password,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(
          result.message ||
            result.error ||
            "Login failed. Please try again."
        );
        return;
      }

      const destination =
        nextPath.startsWith("/") && !nextPath.startsWith("//")
          ? nextPath
          : "/";

      window.location.href = destination;

    } catch {
      setErrorMessage(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">

        <div className="login-brand">
          ACTION FORCE
        </div>

        <h1>Action Force Hub</h1>

        <p className="login-subtitle">
          Sign in using your ASPE Code and password.
        </p>

        <form onSubmit={handleLogin}>

          <label htmlFor="memberCode">
            ASPE Code
          </label>

          <input
            id="memberCode"
            type="text"
            autoComplete="username"
            placeholder="Enter your ASPE Code"
            value={memberCode}
            onChange={(event) =>
              setMemberCode(event.target.value)
            }
            minLength={3}
            maxLength={40}
            required
          />

          <label htmlFor="password">
            Password
          </label>

          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
          />

          {/* Forgot Password Link */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 8,
              marginBottom: 18,
            }}
          >
            <Link
              href="/forgot-password"
              style={{
                color: "#24518D",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              Forgot Password?
            </Link>
          </div>

          {errorMessage && (
            <p
              className="login-error"
              role="alert"
            >
              {errorMessage}
            </p>
          )}

          {/* Normal Sign In Button */}
          <button
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

        </form>

        <p className="login-footer">
          Authorized Action Force members only.
        </p>

      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div>Loading login page...</div>}
    >
      <LoginForm />
    </Suspense>
  );
}
