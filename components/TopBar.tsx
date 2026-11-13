
"use client";

import Image from "next/image";
import LogoutButton from "@/components/LogoutButton";

type TopBarProps = {
  role: string;
  memberCode: string;
};

export default function TopBar({ role, memberCode }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <Image
            src="/action-force-logo.png"
            alt="Action Force"
            width={44}
            height={44}
            priority
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </div>

        <div>
          <div className="brand-name">{role}</div>
          <div className="brand-subtitle">{memberCode}</div>
        </div>
      </div>
      
      <div className="topbar-actions">
        <button
          type="button"
          className="avatar avatar-logo"
          aria-label="Action Force logo"
        >
          <Image
            src="/action-force-logo.png"
            alt="Action Force"
            width={44}
            height={44}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </button>
          
        <LogoutButton />
      </div>

    </header>
  );
}
