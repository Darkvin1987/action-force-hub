"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AppFooter from "@/components/AppFooter";

type SalesSummary = {
  total: number;
  branded: number;
  coCreated: number;
  monthFrom?: string;
  monthTo?: string;
};

type SalesStatusCounts = {
  netSales: number;
  incompletePayment: number;
  installationStage: number;
  callLogStage: number;
  pendingRiskAssessment: number;
  pendingSalesInfo: number;
  pendingDocumentSubmission: number;
  pendingPayment: number;
  monthFrom: string;
  monthTo: string;
};

type SalesApiResponse = {
  success: boolean;
  selectedPeriod: {
    month: number;
    year: number;
    targetMonth: string;
  };
  personalSales: SalesSummary;
  teamSales: SalesSummary;
  monthlyTargets: {
    personal: number;
    team: number;
    targetMonth: string;
  };
  teamSync: {
    teamMemberCount: number;
    newRecruitsThisMonth: number;
  };
  salesStatus: SalesStatusCounts;
  error?: string;
};

type StatusCategory =
  | "netSales"
  | "incompletePayment"
  | "installationStage"
  | "callLogStage"
  | "pendingRiskAssessment"
  | "pendingSalesInfo"
  | "pendingDocumentSubmission"
  | "pendingPayment";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatUnits(value: number) {
  return value.toLocaleString("en-MY");
}

function getProgress(actual: number, target: number) {
  if (target <= 0) return 0;
  return Math.min((actual / target) * 100, 100);
}

function getRemaining(actual: number, target: number) {
  return Math.max(target - actual, 0);
}

function formatPercentage(actual: number, target: number) {
  if (target <= 0) return "Target not set";

  return `${((actual / target) * 100)
    .toFixed(1)
    .replace(/\.0$/, "")}% achieved`;
}

export default function SalesClient({
  initialMonth,
  initialYear,
}: {
  initialMonth: number;
  initialYear: number;
}) {
  const router = useRouter();

  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  const [salesData, setSalesData] =
    useState<SalesApiResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const years = Array.from(
    { length: initialYear - 2025 + 1 },
    (_, index) => 2025 + index
  );

  
  // Prevent duplicate sync requests for the same month
  // during React development Strict Mode.
  const syncStartedFor = useRef(new Set<string>());

  // Load saved Sales Results first, then synchronise separately.
  useEffect(() => {
    const controller = new AbortController();

    async function loadSalesData() {
      try {
        setLoading(true);
        setError("");

        // STEP 1: Load saved Supabase figures immediately.
        const response = await fetch(
          `/api/cuckoo/sales?month=${month}&year=${year}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result = (await response.json()) as SalesApiResponse;

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Unable to load sales results."
          );
        }

        // Display the saved figures without waiting for CUCKOO sync.
        setSalesData(result);
        setLoading(false);

        // STEP 2: Only synchronise the current Malaysia month.
        const nowParts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kuala_Lumpur",
          year: "numeric",
          month: "2-digit",
        }).formatToParts(new Date());

        const currentYear = Number(
          nowParts.find((part) => part.type === "year")?.value
        );

        const currentMonth = Number(
          nowParts.find((part) => part.type === "month")?.value
        );

        if (month !== currentMonth || year !== currentYear) {
          return;
        }

        const syncKey = `${year}-${String(month).padStart(2, "0")}`;

        if (syncStartedFor.current.has(syncKey)) {
          return;
        }

        syncStartedFor.current.add(syncKey);

        console.log(
          "[SALES DASHBOARD] Starting separate sales synchronisation."
        );

        try {
          // This request can take longer, but the dashboard is
          // already displaying the saved figures.
          const syncResponse = await fetch(
            "/api/cuckoo/sales/sync",
            {
              method: "POST",
              cache: "no-store",
            }
          );

          const syncResult = (await syncResponse.json()) as { success: boolean; error?: string };

          if (!syncResponse.ok || !syncResult.success) {
            throw new Error(
              syncResult.error || "Sales synchronisation failed."
            );
          }

          console.log(
            "[SALES DASHBOARD] Synchronisation completed."
          );

          // STEP 3: Refresh dashboard figures after sync.
          if (controller.signal.aborted) {
            return;
          }

          const refreshResponse = await fetch(
            `/api/cuckoo/sales?month=${month}&year=${year}`,
            {
              method: "GET",
              cache: "no-store",
              signal: controller.signal,
            }
          );

          const refreshedResult = (await refreshResponse.json()) as SalesApiResponse;

          if (!refreshResponse.ok || !refreshedResult.success) {
            throw new Error(
              refreshedResult.error ||
                "Unable to refresh sales results."
            );
          }

          if (!controller.signal.aborted) {
            setSalesData(refreshedResult);
          }

        } catch (syncError) {
          syncStartedFor.current.delete(syncKey);

          console.error(
            "[SALES DASHBOARD] Background sync error:",
            syncError
          );
        }

      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        console.error("Sales Results error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load sales results."
        );

      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadSalesData();

    return () => controller.abort();
  }, [month, year]);

  async function handleManualRefresh() {
    if (syncing || loading) return;

    setSyncing(true);
    setSyncMessage("");
    setError("");

    try {
      const response = await fetch("/api/cuckoo/sales/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force: true }),
        cache: "no-store",
      });

      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        failedCount: number;
        inProgressCount: number;
      };

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to refresh sales."
        );
      }

      // Reload the dashboard figures from Supabase.
      const refreshResponse = await fetch(
        `/api/cuckoo/sales?month=${month}&year=${year}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const refreshedResult = (await refreshResponse.json()) as SalesApiResponse;

      if (!refreshResponse.ok || !refreshedResult.success) {
        throw new Error(
          refreshedResult.error || "Unable to reload sales figures."
        );
      }

      setSalesData(refreshedResult);

      if (result.failedCount > 0) {
        setSyncMessage(
          `Refresh completed with ${result.failedCount} failed member sync(s).`
        );
      } else if (result.inProgressCount > 0) {
        setSyncMessage(
          "Some members are already synchronising. Please try again shortly."
        );
      } else {
        setSyncMessage(
          "Sales figures successfully refreshed from CUCKOO."
        );
      }
    } catch (err) {
      console.error("Manual sales refresh error:", err);

      setSyncMessage(
        err instanceof Error
          ? err.message
          : "Unable to refresh sales."
      );
    } finally {
      setSyncing(false);
    }
  }

  // Navigate to CRM with the selected Sales Status.
  function openStatusDetails(category: StatusCategory) {
    router.push(`/crm?status=${encodeURIComponent(category)}`);
  }

  const personalSales = salesData?.personalSales;
  const teamSales = salesData?.teamSales;
  const monthlyTargets = salesData?.monthlyTargets;
  const teamSync = salesData?.teamSync;
  const salesStatus = salesData?.salesStatus;

  const personalActual = personalSales?.total ?? 0;
  const teamActual = teamSales?.total ?? 0;

  const personalTarget = monthlyTargets?.personal ?? 0;
  const teamTarget = monthlyTargets?.team ?? 0;

  const personalProgress = getProgress(
    personalActual,
    personalTarget
  );

  const teamProgress = getProgress(
    teamActual,
    teamTarget
  );

  const activeMembers = teamSync?.teamMemberCount ?? 0;
  const newRecruits = teamSync?.newRecruitsThisMonth ?? 0;

  const periodLabel = `${months[month - 1]} ${year}`;

  const statusCards: {
    title: string;
    category: StatusCategory;
    count: number;
    color: string;
    icon: string;
  }[] = [
    {
      title: "NET Sales",
      category: "netSales",
      count: salesStatus?.netSales ?? 0,
      color: "completed",
      icon: "✓",
    },
    {
      title: "Incomplete Payment",
      category: "incompletePayment",
      count: salesStatus?.incompletePayment ?? 0,
      color: "payment",
      icon: "!",
    },
    {
      title: "Installation Stage",
      category: "installationStage",
      count: salesStatus?.installationStage ?? 0,
      color: "installation",
      icon: "↻",
    },
    {
      title: "Call Log Stage",
      category: "callLogStage",
      count: salesStatus?.callLogStage ?? 0,
      color: "call-log",
      icon: "☎",
    },
    {
      title: "Pending Risk Assessment / Doc. Verification",
      category: "pendingRiskAssessment",
      count: salesStatus?.pendingRiskAssessment ?? 0,
      color: "risk",
      icon: "⌕",
    },
    {
      title: "Pending Sales Info",
      category: "pendingSalesInfo",
      count: salesStatus?.pendingSalesInfo ?? 0,
      color: "sales-info",
      icon: "▤",
    },
    {
      title: "Pending Doc. Submission",
      category: "pendingDocumentSubmission",
      count: salesStatus?.pendingDocumentSubmission ?? 0,
      color: "documents",
      icon: "▤",
    },
    {
      title: "Pending Payment",
      category: "pendingPayment",
      count: salesStatus?.pendingPayment ?? 0,
      color: "pending-payment",
      icon: "RM",
    },
  ];

  return (
    <>
      <div className="sales-container">
        {/* Page heading */}
        <div className="sales-title-row">
          <div>
            <p className="sales-eyebrow">ACTION FORCE HUB</p>
            <h1>Sales Results</h1>
            <p className="sales-muted">
              Track your performance and your team's progress.
            </p>
          </div>
        </div>

        {/* Month and year selection */}
        <section className="sales-filters">
          <label>
            Month
            <select
              value={month}
              onChange={(event) =>
                setMonth(Number(event.target.value))
              }
            >
              {months.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Year
            <select
              value={year}
              onChange={(event) =>
                setYear(Number(event.target.value))
              }
            >
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </section>

        {/*<div className="sales-period-label">
          Showing results for {periodLabel}
        </div>*/}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
        <div className="sales-period-label">
          Showing results for {periodLabel}
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={syncing || loading}
          style={{
            padding: "10px 16px",
            background: syncing ? "#7890b5" : "#234B87",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: syncing || loading ? "not-allowed" : "pointer",
            opacity: syncing || loading ? 0.75 : 1,
          }}
          >
          {syncing ? "Refreshing Sales..." : "↻ Refresh Sales"}
        </button>
    </div>

    {syncMessage && (
      <p
        role="status"
        aria-live="polite"
        style={{
          margin: "0 0 16px",
          padding: 12,
          borderRadius: 8,
          background: syncMessage.includes("successfully")
            ? "#e8f5e9"
            : "#fff4e5",
          color: syncMessage.includes("successfully")
            ? "#237a38"
            : "#8a5700",
          fontSize: 13,
        }}
      >
        {syncMessage}
      </p>
    )}

        {error && (
          <p className="sales-error" role="alert">
            Unable to load sales information: {error}
          </p>
        )}

        {/* Main dashboard cards */}
        <section className="section">
          <div className="dashboard-cards-grid">
            {/* Monthly Sales Targets */}
            <article className="dashboard-info-card">
              <div className="dashboard-card-heading">
                <div className="stat-icon blue">◎</div>
                <div>
                  <h3>Monthly Sales Targets</h3>
                  <span className="dashboard-card-subtitle">
                    Target vs Actual Performance
                  </span>
                </div>
              </div>

              <div className="target-block">
                <div className="target-row">
                  <span>Personal Sales</span>
                  <strong>
                    {loading
                      ? "Loading..."
                      : `${formatUnits(personalActual)} / ${formatUnits(personalTarget)} units`}
                  </strong>
                </div>

                <div className="dashboard-progress-track">
                  <div
                    className="dashboard-progress-fill"
                    style={{ width: `${personalProgress}%` }}
                  />
                </div>

                <div className="target-summary">
                  <span>
                    {formatPercentage(personalActual, personalTarget)}
                  </span>
                  <span>
                    {formatUnits(
                      getRemaining(personalActual, personalTarget)
                    )}{" "}
                    units to go
                  </span>
                </div>
              </div>

              <div className="target-block">
                <div className="target-row">
                  <span>Team Sales</span>
                  <strong>
                    {loading
                      ? "Loading..."
                      : `${formatUnits(teamActual)} / ${formatUnits(teamTarget)} units`}
                  </strong>
                </div>

                <div className="dashboard-progress-track">
                  <div
                    className="dashboard-progress-fill"
                    style={{ width: `${teamProgress}%` }}
                  />
                </div>

                <div className="target-summary">
                  <span>
                    {formatPercentage(teamActual, teamTarget)}
                  </span>
                  <span>
                    {formatUnits(
                      getRemaining(teamActual, teamTarget)
                    )}{" "}
                    units to go
                  </span>
                </div>
              </div>
            </article>

            {/* Team Members */}
            <article className="dashboard-info-card">
              <div className="dashboard-card-heading">
                <div className="stat-icon green">♧</div>
                <div>
                  <h3>Team Members</h3>
                  <span className="dashboard-card-subtitle">
                    Team growth for {periodLabel}
                  </span>
                </div>
              </div>

              <div className="member-stat">
                <div>
                  <span className="member-stat-label">
                    Total Active Members
                  </span>
                  <strong className="member-stat-value">
                    {loading ? "..." : formatUnits(activeMembers)}
                  </strong>
                </div>
                <span className="member-stat-tag">ACTIVE</span>
              </div>

              <div className="member-stat recruit-stat">
                <div>
                  <span className="member-stat-label">
                    New Recruits This Month
                  </span>
                  <strong className="member-stat-value">
                    {loading ? "..." : formatUnits(newRecruits)}
                  </strong>
                </div>
                <div className="recruit-indicator">
                  +{formatUnits(newRecruits)}
                </div>
              </div>

              <p className="dashboard-card-note">
                New members who joined in {periodLabel}.
              </p>
            </article>

            {/* Net Sales */}
            <article className="dashboard-info-card">
              <div className="dashboard-card-heading">
                <div className="stat-icon orange">▥</div>
                <div>
                  <h3>Net Sales</h3>
                  <span className="dashboard-card-subtitle">
                    Personal and Team Sales
                  </span>
                </div>
              </div>

              <div className="net-sales-section">
                <h4>Personal Sales</h4>

                <div className="net-sales-row">
                  <span>CUCKOO Branded</span>
                  <strong>
                    {loading
                      ? "..."
                      : `${formatUnits(personalSales?.branded ?? 0)} units`}
                  </strong>
                </div>

                <div className="net-sales-row">
                  <span>CUCKOO Co-Created</span>
                  <strong>
                    {loading
                      ? "..."
                      : `${formatUnits(personalSales?.coCreated ?? 0)} units`}
                  </strong>
                </div>

                <div className="net-sales-total team-net-total">
                  <span>Personal Total</span>
                  <strong>
                    {loading
                      ? "..."
                      : `${formatUnits(personalActual)} units`}
                  </strong>
                </div>
              </div>

              <div className="net-sales-section">
                <h4>Authorised Team Sales</h4>

                <div className="net-sales-row">
                  <span>CUCKOO Branded</span>
                  <strong>
                    {loading
                      ? "..."
                      : `${formatUnits(teamSales?.branded ?? 0)} units`}
                  </strong>
                </div>

                <div className="net-sales-row">
                  <span>CUCKOO Co-Created</span>
                  <strong>
                    {loading
                      ? "..."
                      : `${formatUnits(teamSales?.coCreated ?? 0)} units`}
                  </strong>
                </div>

                <div className="net-sales-total team-net-total">
                  <span>Team Total</span>
                  <strong>
                    {loading
                      ? "..."
                      : `${formatUnits(teamActual)} units`}
                  </strong>
                </div>
              </div>

              <p className="sales-period">
                Period: {year}-{String(month).padStart(2, "0")}-01
                {" "}to{" "}
                {personalSales?.monthTo ?? ""}
              </p>
            </article>
          </div>
        </section>

        {/* Sales Status */}
        <section className="section sales-status-section">
          <div className="section-heading sales-status-heading">
            <div>
              <h2>Sales Status</h2>
              <p className="sales-status-description">
                Overview of sales processing and pending actions in{" "}
                {periodLabel}
              </p>
            </div>

            <span className="sales-status-badge">
              {loading ? "Loading..." : periodLabel}
            </span>
          </div>

          <div className="sales-status-grid">
            {statusCards.map((item) => (
              <button
                type="button"
                className={`sales-status-card ${item.color} sales-status-clickable`}
                key={item.title}
                onClick={() => openStatusDetails(item.category)}
                disabled={loading || item.count === 0}
                aria-label={`View ${item.title} orders`}
              >
                <div className="sales-status-card-top">
                  <span
                    className="sales-status-icon"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                </div>

                <h3>{item.title}</h3>

                <div className="sales-status-count-row">
                  <strong className="sales-status-count">
                    {loading
                      ? "..."
                      : item.count.toLocaleString("en-MY")}
                  </strong>

                  <span className="sales-status-unit">
                    sales
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <AppFooter />
      </div>
    </>
  );
}