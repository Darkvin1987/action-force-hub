"use client";

import { useState } from "react";
import LogoutButton from "@/components/LogoutButton";

const menu = [
  { name: "Home", icon: "⌂" },
  { name: "CRM", icon: "♙" },
  { name: "Sales", icon: "▥" },
  { name: "Memo", icon: "▤" },
  { name: "Team", icon: "♧" },
];

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

export default function Home() {
  const [active, setActive] = useState("Home");

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">AF</div>
          <div>
            <div className="brand-name">ACTION FORCE</div>
            <div className="brand-subtitle">HUB · SALES PORTAL</div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="avatar" aria-label="User profile">
            AH
          </button>
          <LogoutButton />
        </div>
      </header>

      <div className="dashboard">
        <section className="welcome">
          <p className="eyebrow">FRIDAY, 9 OCTOBER 2026</p>
          <h1>Welcome back, Arick!</h1>
          <p className="muted">
            Believe in the mission. Focus on the results.
          </p>
        </section>

        <section className="hero-card">
          <div className="hero-top">
            <div>
              <p className="hero-label">ACTION FORCE</p>
              <h2>October Sales Target</h2>
            </div>
            <span className="demo-badge">DEMO DATA</span>
          </div>

          <div className="target-number">
            <strong>1,680</strong>
            <span> / 2,500 units</span>
          </div>

          <div className="progress-track">
            <div className="progress-fill" style={{ width: "67.2%" }} />
          </div>

          <div className="hero-bottom">
            <span>67.2% achieved</span>
            <span>820 units to go</span>
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <h2>Sales Overview</h2>
            <span className="period">OCT 2026</span>
          </div>

          <div className="stats-grid">
            <article className="stat-card">
              <div className="stat-icon blue">♙</div>
              <p className="stat-label">Personal Sales</p>
              <strong className="stat-value">18</strong>
              <span className="stat-note">Units this month</span>
            </article>

            <article className="stat-card">
              <div className="stat-icon green">▥</div>
              <p className="stat-label">Team Sales</p>
              <strong className="stat-value">1,680</strong>
              <span className="stat-note">Units this month</span>
            </article>

            <article className="stat-card">
              <div className="stat-icon orange">◎</div>
              <p className="stat-label">Team Members</p>
              <strong className="stat-value">68</strong>
              <span className="stat-note">Demo headcount</span>
            </article>

            <article className="stat-card">
              <div className="stat-icon purple">↗</div>
              <p className="stat-label">Target Progress</p>
              <strong className="stat-value">67.2%</strong>
              <span className="stat-note">Monthly achievement</span>
            </article>
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <h2>Quick Access</h2>
          </div>

          <div className="quick-grid">
            {[
              { name: "Customer CRM", icon: "♙", page: "CRM" },
              { name: "Sales Results", icon: "▥", page: "Sales" },
              { name: "Announcements", icon: "▤", page: "Memo" },
              { name: "Organization", icon: "♧", page: "Team" },
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
                <span className="quick-icon">{item.icon}</span>
                <span>{item.name}</span>
                <span className="quick-arrow">→</span>
              </button>
            ))}
          </div>
        </section>

        <section className="section announcements">
          <div className="section-heading">
            <h2>Latest Announcements</h2>
            <button
              className="text-button"
              onClick={() => setActive("Memo")}
            >
              View all
            </button>
          </div>

          {announcements.map((item) => (
            <article className="announcement-card" key={item.title}>
              <div className="announcement-meta">
                <span className="announcement-category">
                  {item.category}
                </span>
                <span className="announcement-date">{item.date}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <button
                className="read-button"
                onClick={() => setActive("Memo")}
              >
                Read announcement →
              </button>
            </article>
          ))}
        </section>

        <footer className="footer">
          <strong>CORE PURPOSE • TRUST & BELIEVE • FOCUS</strong>
          <p>GRATITUDE • POSITIVITY</p>
          <span>Action Force Hub · Prototype v1.0</span>
        </footer>
      </div>

      <nav className="bottom-nav" aria-label="Main navigation">
        {menu.map((item) => (
  <button
    key={item.name}
    className={`nav-item ${active === item.name ? "selected" : ""}`}
    onClick={() => {
      if (item.name === "Home") {
        window.location.href = "/";
      } else if (item.name === "CRM") {
        window.location.href = "/crm";
      } else if (item.name === "Sales") {
        window.location.href = "/sales";
      } else if (item.name === "Memo") {
        window.location.href = "/memo";
      } else if (item.name === "Team") {
        window.location.href = "/team";
      } else {
        setActive(item.name);
      }
    }}
  >
    <span className="nav-icon">{item.icon}</span>
    <span>{item.name}</span>
  </button>
))}
      </nav>

      {active !== "Home" && (
        <div className="toast" role="status">
          <span>
            <strong>{active}</strong> module selected.
          </span>
          <button onClick={() => setActive("Home")}>Back to Home</button>
        </div>
      )}
    </main>
  );
}