
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppFooter from "@/components/AppFooter";

type SalesSummary = {
  total: number;
  branded: number;
  coCreated: number;

  // Overall Sales figures, calculated using sales_date.
  overallTotal: number;
  overallBranded: number;
  overallCoCreated: number;

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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshMessage, setRefreshMessage] = useState("");

  const years = Array.from(
    { length: initialYear - 2025 + 1 },
    (_, index) => 2025 + index
  );

  // Retrieve the selected period's saved figures from Supabase.
  useEffect(() => {
    const controller = new AbortController();

    async function loadSalesData() {
      try {
        setLoading(true);
        setError("");
        setRefreshMessage("");

        const response = await fetch(
          `/api/cuckoo/sales?month=${month}&year=${year}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result =
          (await response.json()) as SalesApiResponse;

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Unable to load sales results."
          );
        }

        if (!controller.signal.aborted) {
          setSalesData(result);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        console.error("Sales Results error:", err);

        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load sales results."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadSalesData();

    return () => controller.abort();
  }, [month, year]);

  // Refresh only retrieves the latest saved figures from Supabase.
  // It does not call the CUCKOO API or trigger synchronisation.
  async function handleManualRefresh() {
    if (refreshing || loading) return;

    setRefreshing(true);
    setError("");
    setRefreshMessage("");

    try {
      const response = await fetch(
        `/api/cuckoo/sales?month=${month}&year=${year}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result =
        (await response.json()) as SalesApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Unable to reload sales figures."
        );
      }

      setSalesData(result);
      setRefreshMessage(
        "Sales figures successfully refreshed from Supabase."
      );
    } catch (err) {
      console.error("Sales data refresh error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to refresh sales figures."
      );
    } finally {
      setRefreshing(false);
    }
  }

  // Navigate to CRM with the selected Sales Status.
  function openStatusDetails(category: StatusCategory) {
    router.push(
      `/crm?status=${encodeURIComponent(category)}`
    );
  }

  const personalSales = salesData?.personalSales;
  const teamSales = salesData?.teamSales;
  const monthlyTargets = salesData?.monthlyTargets;
  const teamSync = salesData?.teamSync;
  const salesStatus = salesData?.salesStatus;

  // MONTHLY TARGET CALCULATION:
  // Use Overall Sales (sales_date), NOT NET Sales (net_date).
  const personalActual = personalSales?.overallTotal ?? 0;
  const teamActual = teamSales?.overallTotal ?? 0;

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

  // NET SALES CARD:
  // Keep NET Sales figures separate from target calculations.
  const personalNetTotal = personalSales?.total ?? 0;
  const teamNetTotal = teamSales?.total ?? 0;

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

        {/* Selected period and manual refresh */}
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
            disabled={refreshing || loading}
            style={{
              padding: "10px 16px",
              background: refreshing ? "#7890b5" : "#234B87",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor:
                refreshing || loading ? "not-allowed" : "pointer",
              opacity: refreshing || loading ? 0.75 : 1,
            }}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh Sales"}
          </button>
        </div>

        {refreshMessage && (
          <p
            role="status"
            aria-live="polite"
            style={{
              margin: "0 0 16px",
              padding: 12,
              borderRadius: 8,
              background: "#e8f5e9",
              color: "#237a38",
              fontSize: 13,
            }}
          >
            {refreshMessage}
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

            {/* Monthly Sales Targets - based on Overall Sales */}
            <article className="dashboard-info-card">
              <div className="dashboard-card-heading">
                <div className="stat-icon blue">◎</div>
                <div>
                  <h3>Monthly Sales Targets</h3>
                  <span className="dashboard-card-subtitle">
                    Overall Sales: Target vs Actual
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

            {/* NET Sales - based on net_date */}
            <article className="dashboard-info-card">
              <div className="dashboard-card-heading">
                <div className="stat-icon orange">▥</div>
                <div>
                  <h3>NET Sales</h3>
                  <span className="dashboard-card-subtitle">
                    Sales based on NET Date
                  </span>
                </div>
              </div>

              <div className="net-sales-section">
                <h4>Personal NET Sales</h4>

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
                  <span>Personal NET Total</span>
                  <strong>
                    {loading
                      ? "..."
                      : `${formatUnits(personalNetTotal)} units`}
                  </strong>
                </div>
              </div>

              <div className="net-sales-section">
                <h4>Authorised Team NET Sales</h4>

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
                  <span>Team NET Total</span>
                  <strong>
                    {loading
                      ? "..."
                      : `${formatUnits(teamNetTotal)} units`}
                  </strong>
                </div>
              </div>

              <p className="sales-period">
                NET Date Period: {year}-{String(month).padStart(2, "0")}-01
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
