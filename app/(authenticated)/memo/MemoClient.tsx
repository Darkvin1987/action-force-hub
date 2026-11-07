
"use client";

import { useMemo, useState } from "react";
import BottomNav from "@/components/BottomNav";

type Category =
  | "All"
  | "Announcement"
  | "Promotion"
  | "SOP"
  | "Training";

type Memo = {
  id: number;
  title: string;
  category: Exclude<Category, "All">;
  date: string;
  audience: string;
  summary: string;
  content: string;
  pinned: boolean;
};

type MemoClientProps = {
  role: string;
};

const initialMemos: Memo[] = [
  {
    id: 1,
    title: "October 2026 Sales Target: 2,500 Units",
    category: "Announcement",
    date: "2026-10-09",
    audience: "All Action Force Members",
    summary: "Stay focused and work together to achieve our monthly target.",
    content:
      "Our October sales target is 2,500 units. Every sales consultant and leader plays an important role. Review your personal targets, support your teammates and maintain consistent follow-up with customers. These figures are illustrative demo content.",
    pinned: true,
  },
  {
    id: 2,
    title: "Sales Process and Documentation Reminder",
    category: "SOP",
    date: "2026-10-08",
    audience: "All Sales Members",
    summary:
      "Remember to follow approved sales processes and documentation requirements.",
    content:
      "Please follow the current company-approved sales process. Ensure that customer information is accurate, required documents are completed and all submissions follow official HQ procedures. Refer to the latest approved SOP for the actual requirements.",
    pinned: false,
  },
  {
    id: 3,
    title: "October Product Promotion Briefing",
    category: "Promotion",
    date: "2026-10-07",
    audience: "Sales Consultants and Leaders",
    summary:
      "Review the latest product campaign information before presenting offers.",
    content:
      "This demo memo reminds team members to review official promotion terms, eligibility requirements and validity dates before discussing any offer with customers. Always refer to current HQ-approved promotional materials.",
    pinned: false,
  },
  {
    id: 4,
    title: "Action Force Leadership Training",
    category: "Training",
    date: "2026-10-06",
    audience: "Agency Managers and Above",
    summary:
      "Prepare for upcoming leadership development and team-building sessions.",
    content:
      "This sample training announcement highlights leadership development, recruitment, coaching and team performance. The actual training date, time and venue should be confirmed through an official announcement.",
    pinned: false,
  },
];

const categories: Category[] = [
  "All",
  "Announcement",
  "Promotion",
  "SOP",
  "Training",
];

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MemoClient({ role }: MemoClientProps) {
  const isDirector = role === "DIRECTOR";

  const [memos, setMemos] = useState(initialMemos);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [selected, setSelected] = useState<Memo | null>(null);
  const [readIds, setReadIds] = useState<number[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");

  const filteredMemos = useMemo(() => {
    const term = search.toLowerCase().trim();

    return memos
      .filter((memo) => {
        const matchesCategory =
          category === "All" || memo.category === category;

        const matchesSearch = [
          memo.title,
          memo.summary,
          memo.content,
          memo.audience,
          memo.category,
        ].some((value) => value.toLowerCase().includes(term));

        return matchesCategory && matchesSearch;
      })
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          b.date.localeCompare(a.date)
      );
  }, [memos, search, category]);

  function openMemo(memo: Memo) {
    setSelected(memo);
    setShowForm(false);

    setReadIds((current) =>
      current.includes(memo.id) ? current : [...current, memo.id]
    );

    setNotice("");
  }

  function publishMemo(formData: FormData) {
    // Only Directors can publish through this interface.
    if (!isDirector) {
      setNotice("You are not authorised to create memos.");
      setShowForm(false);
      return;
    }

    const title = String(formData.get("title") || "").trim();
    const summary = String(formData.get("summary") || "").trim();
    const content = String(formData.get("content") || "").trim();

    const memoCategory = String(
      formData.get("category") || "Announcement"
    ) as Exclude<Category, "All">;

    const audience = String(
      formData.get("audience") || "All Action Force Members"
    );

    const date = String(formData.get("date") || "");

    if (!title || !summary || !content || !date) {
      setNotice("Please complete all required fields.");
      return;
    }

    const newMemo: Memo = {
      id: Date.now(),
      title,
      category: memoCategory,
      date,
      audience,
      summary,
      content,
      pinned: false,
    };

    setMemos((current) => [newMemo, ...current]);
    setCategory("All");
    setSearch("");
    setShowForm(false);
    setSelected(null);

    setNotice("Demo memo published. It is visible in this session only.");
  }

  const unreadCount = memos.filter(
    (memo) => !readIds.includes(memo.id)
  ).length;

  return (
    <>
      <div className="memo-container">
        <div className="memo-title-row">
          <div>
            <p className="memo-eyebrow">ACTION FORCE HUB</p>

            <h1>Announcement &amp; Memo</h1>

            <p className="memo-muted">
              All your important updates in one place.
            </p>
          </div>

          {isDirector && (
            <button
              className="memo-primary-button"
              onClick={() => {
                setSelected(null);
                setShowForm((current) => !current);
                setNotice("");
              }}
            >
              + Create Memo
            </button>
          )}
        </div>

        <section className="memo-summary">
          <article>
            <span>Total Memos</span>
            <strong>{memos.length}</strong>
          </article>

          <article>
            <span>Unread</span>
            <strong>{unreadCount}</strong>
          </article>

          <article>
            <span>Categories</span>
            <strong>
              {new Set(memos.map((memo) => memo.category)).size}
            </strong>
          </article>
        </section>

        {isDirector && showForm && (
          <section className="memo-panel memo-form-panel">
            <div className="memo-detail-heading">
              <div>
                <p className="memo-eyebrow">DIRECTOR ACCESS</p>
                <h2>Create Announcement</h2>
              </div>

              <button
                className="memo-close"
                onClick={() => setShowForm(false)}
                aria-label="Close form"
              >
                ×
              </button>
            </div>

            <p className="memo-muted">
              Create an announcement for your selected Action Force audience.
            </p>

            <form
              className="memo-form"
              action={(formData) => publishMemo(formData)}
            >
              <label className="memo-full">
                Memo Title *
                <input
                  name="title"
                  required
                  maxLength={120}
                  placeholder="Enter announcement title"
                />
              </label>

              <label>
                Category *
                <select name="category" defaultValue="Announcement">
                  {categories
                    .filter((c) => c !== "All")
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Publication Date *
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue="2026-10-09"
                />
              </label>

              <label className="memo-full">
                Target Audience
                <select
                  name="audience"
                  defaultValue="All Action Force Members"
                >
                  <option>All Action Force Members</option>
                  <option>Sales Consultants</option>
                  <option>Agency Managers and Above</option>
                  <option>Group Agency Managers and Above</option>
                  <option>Branch Sales Managers and Above</option>
                </select>
              </label>

              <label className="memo-full">
                Short Summary *
                <input
                  name="summary"
                  required
                  maxLength={200}
                  placeholder="Briefly describe the memo"
                />
              </label>

              <label className="memo-full">
                Full Announcement *
                <textarea
                  name="content"
                  required
                  rows={5}
                  placeholder="Write the announcement details..."
                />
              </label>

              <div className="memo-form-actions">
                <button
                  type="button"
                  className="memo-secondary-button"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="memo-primary-button"
                >
                  Publish Demo Memo
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="memo-toolbar-panel">
          <input
            className="memo-search"
            type="search"
            placeholder="Search announcements and memos..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="memo-category-row">
            {categories.map((item) => (
              <button
                key={item}
                className={`memo-category-chip ${
                  category === item ? "active" : ""
                }`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="memo-results-count">
            Showing {filteredMemos.length} memo(s)
          </div>
        </section>

        <section className="memo-feed">
          {filteredMemos.map((memo) => (
            <article className="memo-card" key={memo.id}>
              <div className="memo-card-top">
                <div className="memo-card-tags">
                  <span
                    className={`memo-category-label memo-cat-${memo.category.toLowerCase()}`}
                  >
                    {memo.category}
                  </span>

                  {memo.pinned && (
                    <span className="memo-pinned">★ Pinned</span>
                  )}
                </div>

                <span
                  className={`memo-read-state ${
                    readIds.includes(memo.id) ? "is-read" : ""
                  }`}
                >
                  {readIds.includes(memo.id) ? "✓ Read" : "Unread"}
                </span>
              </div>

              <h2>{memo.title}</h2>

              <p className="memo-card-summary">{memo.summary}</p>

              <div className="memo-card-meta">
                <span>Published {formatDate(memo.date)}</span>
                <span>{memo.audience}</span>
              </div>

              <button
                className="memo-read-button"
                onClick={() => openMemo(memo)}
              >
                Read full memo →
              </button>
            </article>
          ))}

          {filteredMemos.length === 0 && (
            <div className="memo-empty">
              <span>⌕</span>
              <h3>No memos found</h3>
              <p>Try another search term or category.</p>
            </div>
          )}
        </section>

        {selected && (
          <div
            className="memo-modal-backdrop"
            onClick={() => setSelected(null)}
          >
            <section
              className="memo-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="memo-detail-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="memo-detail-heading">
                <span
                  className={`memo-category-label memo-cat-${selected.category.toLowerCase()}`}
                >
                  {selected.category}
                </span>

                <button
                  className="memo-close"
                  onClick={() => setSelected(null)}
                  aria-label="Close announcement"
                >
                  ×
                </button>
              </div>

              <h2 id="memo-detail-title">{selected.title}</h2>

              <p className="memo-detail-date">
                Published {formatDate(selected.date)} · {selected.audience}
              </p>

              <div className="memo-detail-content">
                {selected.content}
              </div>

              <div className="memo-acknowledgement">
                <span>✓ Marked as read in this demo session</span>
              </div>

              <button
                className="memo-primary-button memo-done-button"
                onClick={() => setSelected(null)}
              >
                Done
              </button>
            </section>
          </div>
        )}

        {notice && (
          <div className="memo-notice" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice("")}>Dismiss</button>
          </div>
        )}

        <footer className="memo-footer">
          CORE PURPOSE • TRUST &amp; BELIEVE • FOCUS
          <br />
          GRATITUDE • POSITIVITY
          <p>Action Force Hub · Memo Prototype</p>
        </footer>
      </div>

      {/*<BottomNav />*/}
    </>
  );
}
