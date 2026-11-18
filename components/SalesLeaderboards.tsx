
"use client";

import { useEffect, useState } from "react";

type LeaderboardRole = "GAM" | "AM" | "SC";

type LeaderboardEntry = {
  rank: number;
  memberCode: string;
  staffName: string;
  netSales: number;
  psiUnits: number;
};

type Leaderboard = {
  role: LeaderboardRole;
  title: string;
  entries: LeaderboardEntry[];
};

type LeaderboardResponse = {
  success: boolean;
  period?: {
    from: string;
    to: string;
  };
  leaderboards?: Leaderboard[];
  error?: string;
};

const ROLE_STYLES = {
  GAM: {
    accent: "#7C3AED",
    soft: "#EDE9FE",
    label: "GAM",
  },
  AM: {
    accent: "#16A34A",
    soft: "#DCFCE7",
    label: "AM",
  },
  SC: {
    accent: "#D4A017",
    soft: "#FEF3C7",
    label: "SC",
  },
};

function formatUnits(value: number) {
  return value.toLocaleString("en-MY");
}

function formatPeriod(from: string, to: string) {
  if (!from || !to) return "";

  const [year, month] = from.split("-").map(Number);

  const monthLabel = new Date(
    year,
    month - 1,
    1
  ).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });

  return `${monthLabel} (${from} to ${to})`;
}

export default function SalesLeaderboards() {
  const [leaderboards, setLeaderboards] = useState<Leaderboard[]>([]);
  const [period, setPeriod] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadLeaderboards() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "/api/cuckoo/sales/leaderboards",
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result =
          (await response.json()) as LeaderboardResponse;

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Unable to load sales leaderboards."
          );
        }

        setLeaderboards(result.leaderboards ?? []);

        if (result.period) {
          setPeriod(
            formatPeriod(result.period.from, result.period.to)
          );
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load sales leaderboards."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadLeaderboards();

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <section style={{ marginTop: 28 }}>
        <p style={{ color: "#64748b" }}>
          Loading sales leaderboards...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section style={{ marginTop: 28 }}>
        <p role="alert" style={{ color: "#dc2626" }}>
          Unable to load sales leaderboards: {error}
        </p>
      </section>
    );
  }

  if (leaderboards.length === 0) {
    return null;
  }

  return (
    <section style={{ marginTop: 28 }}>
      {/* Section heading */}
      <div style={{ marginBottom: 18 }}>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: "#172033",
            margin: 0,
          }}
        >
          Monthly Sales Leaderboards
        </h2>

        <p
          style={{
            fontSize: 13,
            color: "#64748b",
            marginTop: 6,
          }}
        >
          Organisation-wide performance · {period}
        </p>
      </div>

      {/* Three leaderboard cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 12,
          width: "100%",
        }}
      >
        {leaderboards.map((board) => {
          const colors = ROLE_STYLES[board.role];

          return (
            <article
              key={board.role}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 16,
                padding: 24,
                minWidth: 0,
                minHeight: 520,
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
              }}
            >
              {/* Category icon */}
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: colors.soft,
                  color: colors.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  fontWeight: 900,
                  marginBottom: 14,
                }}
              >
                {colors.label}
              </div>

              {/* Category heading */}
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: colors.accent,
                  margin: "0 0 16px",
                }}
              >
                {board.title}
              </h3>

              {board.entries.length === 0 ? (
                <p
                  style={{
                    color: "#64748b",
                    fontSize: 13,
                  }}
                >
                  No active staff found for this category.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      tableLayout: "fixed",
                      borderCollapse: "separate",
                      borderSpacing: 0,
                      fontSize: 13,
                      textAlign: "left",
                    }}
                  >
                    {/* Column width allocation */}
                    <colgroup>
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "35%" }} />
                      <col style={{ width: "25%" }} />
                      <col style={{ width: "25%" }} />
                    </colgroup>

                    <thead>
                      <tr
                        style={{
                          color: "#64748b",
                        }}
                      >
                        <th
                          style={{
                            padding: "9px 3px",
                            textAlign: "left",
                            whiteSpace: "nowrap",
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          Rank
                        </th>

                        <th
                          style={{
                            padding: "9px 3px",
                            textAlign: "left",
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          Staff Name
                        </th>

                        <th
                          style={{
                            padding: "9px 3px",
                            textAlign: "right",
                            whiteSpace: "normal",
                            lineHeight: 1.3,
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          <div>
                            {board.role === "SC" ? "NET" : "Group"}
                          </div>
                          <div>Sales</div>
                        </th>

                        <th
                          style={{
                            padding: "9px 3px",
                            textAlign: "right",
                            whiteSpace: "normal",
                            lineHeight: 1.3,
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          <div>COMM</div>
                          <div>Units</div>
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {board.entries.map((entry) => (
                        <tr key={entry.memberCode}>
                          {/* Rank */}
                          <td
                            style={{
                              padding: "11px 3px",
                              fontWeight: 800,
                              color: "#334155",
                              verticalAlign: "top",
                              borderTop: `4px solid ${colors.accent}`,
                              borderTopLeftRadius: 8,
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            {entry.rank}
                          </td>

                          {/* Staff Name */}
                          <td
                            style={{
                              padding: "11px 3px",
                              fontWeight: 700,
                              color: "#172033",
                              minWidth: 0,
                              verticalAlign: "top",
                              overflowWrap: "anywhere",
                              borderTop: `4px solid ${colors.accent}`,
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            {entry.staffName}
                          </td>

                          {/* Group Sales / NET Sales */}
                          <td
                            style={{
                              padding: "11px 3px",
                              textAlign: "right",
                              fontWeight: 800,
                              color: "#172033",
                              fontVariantNumeric: "tabular-nums",
                              verticalAlign: "top",
                              whiteSpace: "nowrap",
                              borderTop: `4px solid ${colors.accent}`,
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            {formatUnits(entry.netSales)}
                          </td>

                          {/* COMM Units */}
                          <td
                            style={{
                              padding: "11px 3px",
                              textAlign: "right",
                              color: "#334155",
                              fontVariantNumeric: "tabular-nums",
                              verticalAlign: "top",
                              whiteSpace: "nowrap",
                              borderTop: `4px solid ${colors.accent}`,
                              borderTopRightRadius: 8,
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            {formatUnits(entry.psiUnits)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
