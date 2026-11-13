
"use client";

import { useEffect, useState } from "react";

import TopBar from "@/components/TopBar";
import TeamSalesBreakdown from "../TeamSalesBreakdown";

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
  overallBranded: number;
  overallCoCreated: number;
  overallTotal: number;
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

export default function DashboardClient({
  profile,
}: {
  profile: DashboardProfile;
}) {
  const [today, setToday] = useState("");

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

        const result = (await response.json()) as DashboardData;

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

  // NET Sales - used for monthly target calculations
  const personalActual = personalSales?.total ?? 0;
  const teamActual = teamSales?.total ?? 0;

  // Overall Sales - all sales recorded within the month
  const personalOverall = personalSales?.overallTotal ?? 0;
  const teamOverall = teamSales?.overallTotal ?? 0;

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

            {/* PERSONAL NET SALES */}
            <article className="home-sales-card">
              <p className="home-sales-label">
                PERSONAL NET SALES
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

              <p className="home-sales-target">
                Overall Sales:{" "}
                {salesLoading
                  ? "..."
                  : `${formatUnits(personalOverall)} units`}
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
                      ? `${personalProgress.toFixed(1)}%`
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
                          getRemaining(
                            personalActual,
                            personalTarget
                          )
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

            {/* TEAM NET SALES */}
            <article className="home-sales-card">
              <p className="home-sales-label">
                TEAM NET SALES
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

              <p className="home-sales-target">
                Overall Sales:{" "}
                {salesLoading
                  ? "..."
                  : `${formatUnits(teamOverall)} units`}
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
                      ? `${teamProgress.toFixed(1)}%`
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
                          getRemaining(
                            teamActual,
                            teamTarget
                          )
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

        {/* Sales by Team */}
        <TeamSalesBreakdown
          memberCode={profile.memberCode}
        />

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
    </main>
  );
}
