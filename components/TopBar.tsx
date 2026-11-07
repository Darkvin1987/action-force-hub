
"use client";

import LogoutButton from "@/components/LogoutButton";

type TopBarProps = {
  role: string;
  memberCode: string;
};

export default function TopBar({ role, memberCode }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">AF</div>

        <div>
          <div className="brand-name">{role}</div>
          <div className="brand-subtitle">{memberCode}</div>
        </div>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="avatar"
          aria-label="User profile"
        >
          AH
        </button>

        <LogoutButton />
      </div>
    </header>
  );
}
