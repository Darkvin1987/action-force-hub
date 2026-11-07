
"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";

type DashboardProfile = {
  fullName: string;
  memberCode: string;
  role: string;
  organizationType: string;
};

type SalesFigures = {
  branded: number;
  coCreated: number;
  total: number;
  monthFrom: string;
  monthTo: string;
};

type DashboardData = {
  success: boolean;
  personalSales: SalesFigures;
  teamSales: SalesFigures & {
    memberCount: number;
  };
  monthlyTargets: {
    targetMonth: string;
    personal: number;
    team: number;
  };
  teamSync: {
    teamMemberCount: number;
    newRecruitsThisMonth: number;
    results: Array<{
      memberCode: string;
      status: string;
    }>;
  };
  error?: string;
};

const announcements = [
  {
    category: "SALES TARGET",
    date: "9 Oct 2026",
    title: "October Sales Target: 2,500 Units",
    description:
      "Stay focused, support your team and make every opportunity count.",
  },
  {
    category: "LEADERSHIP",
    date: "8 Oct 2026",
    title: "Action Force Leadership Updates",
    description:
      "Check the latest announcements and important team reminders.",
  },
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

function getMonthLabel(dateString: string) {
  if (!dateString) return "";

  const [year, month] = dateString.split("-").map(Number);

  if (!year || !month) return "";

  return new Date(year, month - 1, 1).toLocaleDateString(
    "en-MY",
    {
      month: "long",
      year: "numeric",
    }
  );
}

function getPercentageLabel(actual: number, target: number) {
  if (target <= 0) return "Target not set";

  return `${((actual / target) * 100)
    .toFixed(1)
    .replace(/\.0$/, "")}% achieved`;
}

export default function DashboardClient({
  profile,
}: {
  profile: DashboardProfile;
}) {
  const [today, setToday] = useState("");
  const [active, setActive] = useState("Home");

  const [dashboardData, setDashboardData] =
    useState<DashboardData | null>(null);

  const [salesLoading, setSalesLoading] = useState(true);
  const [salesError, setSalesError] = useState("");

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-MY", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kuala_Lumpur",
      })
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboardSales() {
      try {
        setSalesLoading(true);
        setSalesError("");

        const response = await fetch(
          `/api/cuckoo/sales?memberCode=${encodeURIComponent(
            profile.memberCode
          )}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Unable to retrieve dashboard sales."
          );
        }

        setDashboardData(result);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error("Dashboard sales error:", error);

        setSalesError(
          error instanceof Error
            ? error.message
            : "Unable to retrieve dashboard sales."
        );
      } finally {
        if (!controller.signal.aborted) {
          setSalesLoading(false);
        }
      }
    }

    if (profile.memberCode) {
      loadDashboardSales();
    } else {
      setSalesError("Staff member code is missing.");
      setSalesLoading(false);
    }

    return () => controller.abort();
  }, [profile.memberCode]);

  const personalSales = dashboardData?.personalSales;
  const teamSales = dashboardData?.teamSales;
  const monthlyTargets = dashboardData?.monthlyTargets;
  const teamSync = dashboardData?.teamSync;

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

  const salesMonth = getMonthLabel(
    personalSales?.monthFrom ?? ""
  );

  return (
    <main className="app-shell">
      <TopBar
        role={profile.role}
        memberCode={profile.memberCode}
      />

      <div className="dashboard">

        {/* Welcome */}
        <section className="welcome">
          <p className="eyebrow">{today}</p>

          <h1>
            Welcome back,
            <strong> {profile.fullName}!</strong>
          </h1>
        </section>

        {/* Personal and Team Sales */}
        <section className="section">
          <div className="home-sales-grid">

            {/* PERSONAL SALES */}
            <article className="home-sales-card">
              <p className="home-sales-label">
                PERSONAL SALES
              </p>

              <h2>
                {salesLoading
                  ? "..."
                  : formatUnits(personalActual)}
                <span> units</span>
              </h2>

              <p className="home-sales-target">
                Monthly personal target:{" "}
                {formatUnits(personalTarget)} units
              </p>

              <div className="home-sales-progress-track">
                <div
                  className="home-sales-progress-fill"
                  style={{
                    width: `${personalProgress}%`,
                  }}
                />
              </div>

              <div className="home-sales-percentage-row">
                <strong>
                  {salesLoading
                    ? "..."
                    : personalTarget > 0
                      ? `${personalProgress.toFixed(1).replace(/\.0$/, "")}%`
                      : "—"}
                </strong>

                <span>Target achieved</span>
              </div>

              <div className="home-sales-bottom">
                <span>
                  {salesLoading
                    ? "Loading..."
                    : personalTarget > 0
                      ? `${formatUnits(
                          getRemaining(personalActual, personalTarget)
                        )} units to target`
                      : "Personal target not set"}
                </span>

                <span>
                  {!salesLoading &&
                  personalTarget > 0 &&
                  personalActual >= personalTarget
                    ? "Target achieved!"
                    : "Keep pushing!"}
                </span>
              </div>
            </article>

            {/* TEAM SALES */}
            <article className="home-sales-card">
              <p className="home-sales-label">
                TEAM SALES
              </p>

              <h2>
                {salesLoading
                  ? "..."
                  : formatUnits(teamActual)}
                <span> units</span>
              </h2>

              <p className="home-sales-target">
                Monthly team target:{" "}
                {formatUnits(teamTarget)} units
              </p>

              <div className="home-sales-progress-track">
                <div
                  className="home-sales-progress-fill"
                  style={{
                    width: `${teamProgress}%`,
                  }}
                />
              </div>

              <div className="home-sales-percentage-row">
                <strong>
                  {salesLoading
                    ? "..."
                    : teamTarget > 0
                      ? `${teamProgress.toFixed(1).replace(/\.0$/, "")}%`
                      : "—"}
                </strong>

                <span>Target achieved</span>
              </div>

              <div className="home-sales-bottom">
                <span>
                  {salesLoading
                    ? "Loading..."
                    : teamTarget > 0
                      ? `${formatUnits(
                          getRemaining(teamActual, teamTarget)
                        )} units to target`
                      : "Team target not set"}
                </span>

                <span>
                  {!salesLoading &&
                  teamTarget > 0 &&
                  teamActual >= teamTarget
                    ? "Target achieved!"
                    : "Keep pushing!"}
                </span>
              </div>
            </article>

          </div>

          {salesError && (
            <p className="sales-error" role="alert">
              Unable to load sales information: {salesError}
            </p>
          )}

          {salesMonth && (
            <p className="sales-period">
              Sales period: {salesMonth}
            </p>
          )}
        </section>

        {/*{/* Sales Status */}
        {/*<section className="section sales-status-section">
          <div className="section-heading sales-status-heading">
            <div>
              <h2>Sales Status</h2>

              <p className="sales-status-description">
                Overview of sales processing and pending actions in{" "}
                {salesStatus
                  ? getMonthLabel(salesStatus.monthFrom)
                  : "the current month"}
              </p>
            </div>

            <span className="sales-status-badge">
              {salesStatus
                ? getMonthLabel(salesStatus.monthFrom)
                : "Loading..."}
            </span>
          </div>

          <div className="sales-status-grid">
            {[
              {
                title: "NET Sales",
                count: salesStatus?.netSales ?? 0,
                color: "completed",
                icon: "✓",
              },
              {
                title: "Incomplete Payment",
                count: salesStatus?.incompletePayment ?? 0,
                color: "payment",
                icon: "!",
              },
              {
                title: "Installation Stage",
                count: salesStatus?.installationStage ?? 0,
                color: "installation",
                icon: "↻",
              },
              {
                title: "Call Log Stage",
                count: salesStatus?.callLogStage ?? 0,
                color: "call-log",
                icon: "☎",
              },
              {
                title: "Pending Risk Assessment / Doc. Verification",
                count: salesStatus?.pendingRiskAssessment ?? 0,
                color: "risk",
                icon: "⌕",
              },
              {
                title: "Pending Sales Info",
                count: salesStatus?.pendingSalesInfo ?? 0,
                color: "sales-info",
                icon: "▤",
              },
              {
                title: "Pending Doc. Submission",
                count: salesStatus?.pendingDocumentSubmission ?? 0,
                color: "documents",
                icon: "▤",
              },
              {
                title: "Pending Payment",
                count: salesStatus?.pendingPayment ?? 0,
                color: "pending-payment",
                icon: "RM",
              },
            ].map((item) => (
              <article
                className={`sales-status-card ${item.color}`}
                key={item.title}
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
                    {salesLoading
                      ? "..."
                      : item.count.toLocaleString("en-MY")}
                  </strong>

                  <span className="sales-status-unit">
                    sales
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>*/}

        {/* Quick Access */}
        {/*<section className="section">
          <div className="section-heading">
            <h2>Quick Access</h2>
          </div>

          <div className="quick-grid">
            {[
              {
                name: "Customer CRM",
                icon: "♙",
                page: "CRM",
              },
              {
                name: "Sales Results",
                icon: "▥",
                page: "Sales",
              },
              {
                name: "Announcements",
                icon: "▤",
                page: "Memo",
              },
              {
                name: "Organization",
                icon: "♧",
                page: "Team",
              },
            ].map((item) => (
              <button
                key={item.name}
                className="quick-link"
                onClick={() => {
                  if (item.page === "CRM") {
                    window.location.href = "/crm";
                  } else if (item.page === "Sales") {
                    window.location.href = "/sales";
                  } else if (item.page === "Memo") {
                    window.location.href = "/memo";
                  } else if (item.page === "Team") {
                    window.location.href = "/team";
                  } else {
                    setActive(item.page);
                  }
                }}
              >
                <span className="quick-icon">
                  {item.icon}
                </span>

                <span>{item.name}</span>

                <span className="quick-arrow">→</span>
              </button>
            ))}
          </div>
        </section>*/}

        {/* Latest Announcements */}
        {/*<section className="section announcements">
          <div className="section-heading">
            <h2>Latest Announcements</h2>

            <button
              className="text-button"
              onClick={() => {
                window.location.href = "/memo";
              }}
            >
              View all
            </button>
          </div>

          {announcements.map((item) => (
            <article
              className="announcement-card"
              key={item.title}
            >
              <div className="announcement-meta">
                <span className="announcement-category">
                  {item.category}
                </span>

                <span className="announcement-date">
                  {item.date}
                </span>
              </div>

              <h3>{item.title}</h3>

              <p>{item.description}</p>

              <button
                className="read-button"
                onClick={() => {
                  window.location.href = "/memo";
                }}
              >
                Read announcement →
              </button>
            </article>
          ))}
        </section>*/}

        {/* Footer */}
        <footer className="footer">
          <strong>ACTION FORCE UNITED SDN BHD</strong>

          <p />

          <span>
            Core Purpose • Trust & Believe • Focus • Gratitude • Positivity
          </span>

          <p />

          <span>Prototype v1.0</span>
        </footer>
      </div>

      {/*<BottomNav role={profile.role} />*/}

      {active !== "Home" && (
        <div className="toast" role="status">
          <span>
            <strong>{active}</strong> module selected.
          </span>

          <button onClick={() => setActive("Home")}>
            Back to Home
          </button>
        </div>
      )}
    </main>
  );
}
