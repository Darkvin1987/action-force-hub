
"use client";

import { useMemo, useState } from "react";

type Member = {
  id: string;
  memberCode: string;
  name: string;
  role: string;
  organization: string;
  parentId: string | null;
  status: string;
};

const roleOrder = ["DIRECTOR", "GAM", "AM", "SC", "ID"];

const roleTitles: Record<string, string> = {
  DIRECTOR: "Director",
  GAM: "Group Agency Manager",
  AM: "Agency Manager",
  SC: "Sales Consultant",
  ID: "Independent Distributor",
};

type TeamClientProps = {
  members: Member[];
  loadError: string | null;
};

function getDescendants(id: string, members: Member[]): Member[] {
  const result: Member[] = [];
  const visited = new Set<string>([id]);

  function walk(parentId: string) {
    const children = members.filter(
      (member) =>
        member.parentId === parentId && !visited.has(member.id)
    );

    for (const child of children) {
      visited.add(child.id);
      result.push(child);
      walk(child.id);
    }
  }

  walk(id);
  return result;
}

function getDirectReports(id: string, members: Member[]) {
  return members.filter((member) => member.parentId === id);
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function roleLabel(role: string) {
  return roleTitles[role] ?? role;
}

export default function TeamClient({
  members,
  loadError,
}: TeamClientProps) {
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("All");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const roles = useMemo(
    () =>
      roleOrder.filter((role) =>
        members.some((member) => member.role === role)
      ),
    [members]
  );

  const leadershipLevels = new Set(
    members
      .filter((member) => member.role !== "DIRECTOR")
      .map((member) => member.role)
  ).size;

  const salesConsultants = members.filter(
    (member) => member.role === "SC"
  ).length;

  const roots = useMemo(() => {
    const memberIds = new Set(members.map((member) => member.id));

    return members.filter(
      (member) =>
        !member.parentId || !memberIds.has(member.parentId)
    );
  }, [members]);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return members.filter((member) => {
      const matchesText =
        !term ||
        member.name.toLowerCase().includes(term) ||
        member.role.toLowerCase().includes(term) ||
        member.organization.toLowerCase().includes(term) ||
        member.memberCode.toLowerCase().includes(term);

      const matchesRole =
        selectedRole === "All" || member.role === selectedRole;

      return matchesText && matchesRole;
    });
  }, [members, search, selectedRole]);

  const searchActive =
    search.trim() !== "" || selectedRole !== "All";

  function toggleExpanded(id: string) {
    setExpanded((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function expandAll() {
    setExpanded(members.map((member) => member.id));
  }

  function collapseAll() {
    setExpanded([]);
  }

  function renderMember(
    member: Member,
    depth = 0
  ): React.ReactNode {
    const children = getDirectReports(member.id, members);
    const descendants = getDescendants(member.id, members);
    const isExpanded = expanded.includes(member.id);
    const isSelected = selectedMember?.id === member.id;

    return (
      <div className="team-node" key={member.id}>
        <div
          className={`team-member-card ${isSelected ? "is-selected" : ""}`}
          style={{ "--team-depth": depth } as React.CSSProperties}
        >
          <button
            className={`team-avatar role-${member.role.toLowerCase()}`}
            onClick={() => setSelectedMember(member)}
            aria-label={`View ${member.name}`}
          >
            {initials(member.name)}
          </button>

          <button
            className="team-member-main"
            onClick={() => setSelectedMember(member)}
          >
            <strong>{member.name}</strong>
            <span className="team-member-role">
              {member.role}
            </span>
            <span className="team-member-title">
              {member.organization || roleLabel(member.role)}
            </span>
          </button>

          <div className="team-member-counts">
            <span>{children.length} direct</span>
            <span>{descendants.length} total</span>
          </div>

          {children.length > 0 && (
            <button
              className="team-expand-button"
              onClick={() => toggleExpanded(member.id)}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${member.name}'s team`}
            >
              {isExpanded ? "−" : "+"}
            </button>
          )}
        </div>

        {children.length > 0 && isExpanded && (
          <div className="team-children">
            {children.map((child) =>
              renderMember(child, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="team-page">
      <header className="team-header">
        <a href="/" className="team-brand">
          <span className="team-logo">AF</span>
          <span>
            <strong>ACTION FORCE</strong>
            <small>HUB · ORGANIZATION</small>
          </span>
        </a>

        <a href="/sales" className="team-header-link">
          Sales Results →
        </a>
      </header>

      <div className="team-container">
        <div className="team-title-row">
          <div>
            <p className="team-eyebrow">ACTION FORCE HUB</p>
            <h1>Organization Chart</h1>
            <p className="team-muted">
              Explore your leadership structure and team members.
            </p>
          </div>
        </div>

        <div className="team-stats">
          <article>
            <span>Total Members</span>
            <strong>{members.length}</strong>
          </article>

          <article>
            <span>Leadership Levels</span>
            <strong>{leadershipLevels}</strong>
          </article>

          <article>
            <span>Sales Consultants</span>
            <strong>{salesConsultants}</strong>
          </article>
        </div>

        <section className="team-search-panel">
          <input
            type="search"
            className="team-search"
            placeholder="Search name, role, organization or member ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            className="team-role-filter"
            value={selectedRole}
            onChange={(event) =>
              setSelectedRole(event.target.value)
            }
            aria-label="Filter by role"
          >
            <option value="All">All roles</option>

            {roles.map((role) => (
              <option key={role} value={role}>
                {role} — {roleLabel(role)}
              </option>
            ))}
          </select>
        </section>

        <div className="team-toolbar">
          <span>
            {searchActive
              ? `${filteredMembers.length} matching member(s)`
              : "Reporting hierarchy"}
          </span>

          <div>
            <button onClick={expandAll}>Expand all</button>
            <button onClick={collapseAll}>Collapse all</button>
          </div>
        </div>

        {loadError ? (
          <section className="team-tree-panel">
            <div className="team-empty">
              <h3>Unable to load organization chart</h3>
              <p>{loadError}</p>
            </div>
          </section>
        ) : searchActive ? (
          <section className="team-search-results">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => {
                const total = getDescendants(
                  member.id,
                  members
                ).length;

                const direct = getDirectReports(
                  member.id,
                  members
                ).length;

                return (
                  <button
                    className="team-result-card"
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                  >
                    <span
                      className={`team-avatar role-${member.role.toLowerCase()}`}
                    >
                      {initials(member.name)}
                    </span>

                    <span className="team-result-info">
                      <strong>{member.name}</strong>
                      <span>
                        {member.role} · {roleLabel(member.role)}
                      </span>
                    </span>

                    <span className="team-result-count">
                      {direct} direct · {total} total
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="team-empty">
                <h3>No team members found</h3>
                <p>Try another name or role.</p>
              </div>
            )}
          </section>
        ) : (
          <section className="team-tree-panel">
            <div className="team-tree-heading">
              <div>
                <h2>Action Force Leadership</h2>
                {/*<p>Director → GAM → AM → SC | ID</p>*/}
              </div>
              
              <span>{members.length} active members</span>
            </div>

            {roots.length > 0 ? (
              roots.map((root) => renderMember(root))
            ) : (
              <div className="team-empty">
                <h3>No reporting hierarchy available</h3>
                <p>
                  Check that staff profiles have the correct
                  reporting manager assigned.
                </p>
              </div>
            )}
          </section>
        )}

        {selectedMember && (
          <div
            className="team-modal-backdrop"
            onClick={() => setSelectedMember(null)}
          >
            <section
              className="team-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="team-detail-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="team-close"
                onClick={() => setSelectedMember(null)}
                aria-label="Close member profile"
              >
                ×
              </button>

              <span
                className={`team-avatar team-avatar-large role-${selectedMember.role.toLowerCase()}`}
              >
                {initials(selectedMember.name)}
              </span>

              <p className="team-eyebrow">
                TEAM MEMBER PROFILE
              </p>

              <h2 id="team-detail-title">
                {selectedMember.name}
              </h2>

              <span className="team-profile-role">
                {selectedMember.role} · {roleLabel(selectedMember.role)}
              </span>

              <div className="team-profile-details">
                <div>
                  <span>Member ID</span>
                  <strong>{selectedMember.memberCode}</strong>
                </div>

                <div>
                  <span>Organization</span>
                  <strong>
                    {selectedMember.organization || "—"}
                  </strong>
                </div>

                <div>
                  <span>Direct Reports</span>
                  <strong>
                    {getDirectReports(
                      selectedMember.id,
                      members
                    ).length}
                  </strong>
                </div>

                <div>
                  <span>Total Downline</span>
                  <strong>
                    {getDescendants(
                      selectedMember.id,
                      members
                    ).length}
                  </strong>
                </div>

                <div>
                  <span>Account Status</span>
                  <strong>{selectedMember.status}</strong>
                </div>
              </div>

              <button
                className="team-primary-button"
                onClick={() => setSelectedMember(null)}
              >
                Close Profile
              </button>
            </section>
          </div>
        )}

        <footer className="team-footer">
          CORE PURPOSE • TRUST &amp; BELIEVE • FOCUS
          <br />
          GRATITUDE • POSITIVITY
          <p>Action Force Hub · Organization Chart</p>
        </footer>
      </div>
    </main>
  );
}
