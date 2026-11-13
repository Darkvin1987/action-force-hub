
"use client";

import { useEffect, useState } from "react";

type SalesNode = {
  memberCode: string;
  name: string;
  role: string;
  netSales: number;
  overallSales: number;
  groupNetSales: number;
  groupOverallSales: number;
  children: SalesNode[];
};

type SalesGroup = {
  title: string;
  netSales: number;
  overallSales: number;
  members: SalesNode[];
};

type SalesBreakdownResponse = {
  success: boolean;
  selectedPeriod?: {
    month: number;
    year: number;
  };
  groups?: SalesGroup[];
  error?: string;
};

function formatNumber(value: number) {
  return value.toLocaleString("en-MY");
}

function getMonthLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString(
    "en-MY",
    {
      month: "long",
      year: "numeric",
    }
  );
}

function isAM(member: SalesNode) {
  return member.role.toUpperCase() === "AM";
}

// Shared column headings.
// Used by both GAM and expanded AM sections.
function SalesTableHeader() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "minmax(120px, 0.9fr) minmax(150px, 1.5fr) minmax(85px, 0.7fr) minmax(100px, 0.8fr)",
        gap: 12,
        padding: "0 14px 10px",
        color: "#64748b",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      <span>MEMBER CODE</span>
      <span>NAME</span>
      <span style={{ textAlign: "right" }}>
        NET SALES
      </span>
      <span style={{ textAlign: "right" }}>
        OVERALL SALES
      </span>
    </div>
  );
}

// Shared member row.
function MemberSalesRow({
  member,
  netSales,
  overallSales,
  depth = 0,
}: {
  member: SalesNode;
  netSales: number;
  overallSales: number;
  depth?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "minmax(120px, 0.9fr) minmax(150px, 1.5fr) minmax(85px, 0.7fr) minmax(100px, 0.8fr)",
        gap: 12,
        alignItems: "center",
        padding: "12px 14px",
        background: depth === 0 ? "#f8fafc" : "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "#64748b",
          fontWeight: 600,
        }}
      >
        {member.memberCode}
      </span>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#1e293b",
          }}
        >
          {member.name}
        </div>

        <div
          style={{
            fontSize: 11,
            color: "#64748b",
            marginTop: 3,
          }}
        >
          {member.role}
        </div>
      </div>

      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          textAlign: "right",
          color: "#1e293b",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatNumber(netSales)}
      </span>

      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          textAlign: "right",
          color: "#1e293b",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatNumber(overallSales)}
      </span>
    </div>
  );
}

// Reusable table body for an expanded AM.
//
// The first row is the AM's own sales.
// Following rows are the AM's reporting members.
function AMExpandedTable({
  member,
}: {
  member: SalesNode;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderTop: "1px solid #e2e8f0",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 540 }}>
          <SalesTableHeader />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {/* AM's own individual sales */}
            <MemberSalesRow
              member={member}
              netSales={member.netSales}
              overallSales={member.overallSales}
            />

            {/* Individual reporting members */}
            {member.children.map((child) => (
              <SalesTreeNode
                key={child.memberCode}
                member={child}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Displays an expandable staff member.
//
// AM heading: shows combined group sales.
// AM expanded content: shows a complete table with
// AM own sales and reporting members.
//
// Other roles: retain their individual sales display
// and existing expandable hierarchy.
function SalesTreeNode({
  member,
  depth = 0,
}: {
  member: SalesNode;
  depth?: number;
}) {
  const hasChildren = member.children.length > 0;
  const memberIsAM = isAM(member);

  const displayedNetSales = memberIsAM
    ? member.groupNetSales
    : member.netSales;

  const displayedOverallSales = memberIsAM
    ? member.groupOverallSales
    : member.overallSales;

  return (
    <div
      style={{
        position: "relative",
        marginLeft: depth === 0 ? 0 : 22,
        paddingLeft: depth === 0 ? 0 : 16,
        borderLeft:
          depth === 0 ? "none" : "2px solid #e2e8f0",
        paddingTop: depth === 0 ? 0 : 8,
        marginTop: depth === 0 ? 0 : 4,
      }}
    >
      {hasChildren ? (
        <details>
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              aria-hidden="true"
              className="sales-tree-arrow"
            >
              <span className="arrow-right">▶</span>
              <span className="arrow-down">▼</span>
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <MemberSalesRow
                member={member}
                netSales={displayedNetSales}
                overallSales={displayedOverallSales}
                depth={depth}
              />
            </div>
          </summary>

          {memberIsAM ? (
            // AM expansion uses the same table layout
            // as the GAM expansion.
            <AMExpandedTable member={member} />
          ) : (
            // GAM and other expandable members
            // continue displaying their children.
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {member.children.map((child) => (
                <SalesTreeNode
                  key={child.memberCode}
                  member={child}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </details>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 13,
              flexShrink: 0,
            }}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <MemberSalesRow
              member={member}
              netSales={member.netSales}
              overallSales={member.overallSales}
              depth={depth}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeamSalesBreakdown({
  memberCode,
}: {
  memberCode: string;
}) {
  const [groups, setGroups] = useState<SalesGroup[]>([]);
  const [period, setPeriod] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadTeamSales() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "/api/cuckoo/sales/team-sales-breakdown",
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result =
          (await response.json()) as SalesBreakdownResponse;

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Unable to retrieve team sales."
          );
        }

        setGroups(result.groups ?? []);

        if (result.selectedPeriod) {
          setPeriod(
            getMonthLabel(
              result.selectedPeriod.month,
              result.selectedPeriod.year
            )
          );
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Team sales breakdown error:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Unable to retrieve team sales."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    if (memberCode) {
      loadTeamSales();
    } else {
      setError("Staff member code is missing.");
      setLoading(false);
    }

    return () => controller.abort();
  }, [memberCode]);

  return (
    <section
      className="section"
      style={{ marginTop: 28 }}
    >
      <div className="section-heading">
        <div>
          <h2>Sales by Team</h2>

          {period && (
            <p className="sales-period">
              Sales period: {period}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <p className="muted">
          Loading team sales...
        </p>
      ) : error ? (
        <p className="sales-error" role="alert">
          Unable to load team sales: {error}
        </p>
      ) : groups.length === 0 ? (
        <p className="muted">
          No reporting team members found.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {groups.map((group) => (
            <details
              key={group.title}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                background: "#ffffff",
                overflow: "hidden",
              }}
            >
              <summary
                style={{
                  listStyle: "none",
                  cursor: "pointer",
                  padding: 16,
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="sales-tree-arrow"
                    >
                      <span className="arrow-right">▶</span>
                      <span className="arrow-down">▼</span>
                    </span>

                    <strong
                      style={{
                        fontSize: 14,
                        color: "#1e293b",
                      }}
                    >
                      {group.title}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 18,
                    }}
                  >
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#64748b",
                        }}
                      >
                        Net Sales
                      </div>

                      <strong
                        style={{
                          fontSize: 15,
                          color: "#1e293b",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatNumber(group.netSales)}
                      </strong>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#64748b",
                        }}
                      >
                        Overall Sales
                      </div>

                      <strong
                        style={{
                          fontSize: 15,
                          color: "#1e293b",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatNumber(group.overallSales)}
                      </strong>
                    </div>
                  </div>
                </div>
              </summary>

              <div
                style={{
                  padding: 16,
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: 540 }}>
                    <SalesTableHeader />

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {group.members.map((member) => (
                        <SalesTreeNode
                          key={member.memberCode}
                          member={member}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
