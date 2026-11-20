"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Category =
  | "All"
  | "Announcement"
  | "Promotion"
  | "SOP"
  | "Training";

type Announcement = {
  id: string;
  title: string;
  category: Exclude<Category, "All">;
  publication_date: string;
  target_audience: string;
  google_link: string;
  content: string;
  created_at: string;
  created_by: string | null;
};

type MemoClientProps = {
  role: string;
};

type PermissionsApiResponse = {
  success?: boolean;
  error?: string;
  categories?: string[];
};

type AnnouncementApiResponse = {
  success?: boolean;
  error?: string;
  announcements?: Announcement[];
  current_staff_id?: string;
};

const categories: Category[] = [
  "All",
  "Announcement",
  "Promotion",
  "SOP",
  "Training",
];

const formCategories: Exclude<Category, "All">[] = [
  "Announcement",
  "Promotion",
  "SOP",
  "Training",
];

const audiences = [
  "All Action Force Members",
  "Sales Consultants",
  "Agency Managers and Above",
  "Group Agency Managers and Above",
] as const;

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getMalaysiaToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export default function MemoClient(_props: MemoClientProps) {

  // React state below is only for temporary interface state.
  // Announcement records are always loaded from and saved to Supabase via the API.
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentStaffId, setCurrentStaffId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [permittedCategories, setPermittedCategories] = useState<string[]>([]);
  const loadPermissions = useCallback(async () => {
    try {
      const response = await fetch("/api/announcement-permissions", {
        method: "GET",
        cache: "no-store",
      });
      const result = (await response.json()) as PermissionsApiResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to load memo permissions.");
      }
      setPermittedCategories(result.categories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load memo permissions.");
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/announcements", {
        method: "GET",
        cache: "no-store",
      });

      const result = (await response.json()) as AnnouncementApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to load announcements.");
      }

      setAnnouncements(result.announcements ?? []);
      setCurrentStaffId(result.current_staff_id ?? "");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load announcements."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnnouncements();
    void loadPermissions();
  }, [loadAnnouncements, loadPermissions]);

  const filteredAnnouncements = useMemo(() => {
    const term = search.toLowerCase().trim();

    return announcements
      .filter((announcement) => {
        const matchesCategory =
          category === "All" || announcement.category === category;

        const matchesSearch = [
          announcement.title,
          announcement.content,
          announcement.target_audience,
          announcement.category,
          announcement.google_link,
        ].some((value) => value.toLowerCase().includes(term));

        return matchesCategory && matchesSearch;
      })
      .sort(
        (a, b) =>
          b.publication_date.localeCompare(a.publication_date) ||
          b.created_at.localeCompare(a.created_at)
      );
  }, [announcements, search, category]);

  async function publishAnnouncement(formData: FormData) {
    const chosenCategory = String(formData.get("category") ?? "");
    if (!permittedCategories.includes(chosenCategory)) {
      setNotice("You are not authorised to create a memo in this category.");
      setShowForm(false);
      return;
    }

    const payload = {
      title: String(formData.get("title") ?? "").trim(),
      category: String(formData.get("category") ?? "Announcement"),
      publication_date: String(formData.get("date") ?? ""),
      target_audience: String(
        formData.get("audience") ?? "All Action Force Members"
      ),
      google_link: String(formData.get("google_link") ?? "").trim(),
      content: String(formData.get("content") ?? "").trim(),
    };

    setSaving(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as AnnouncementApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to publish announcement.");
      }

      setShowForm(false);
      setSelected(null);
      setCategory("All");
      setSearch("");
      setNotice("Announcement published successfully.");

      await loadAnnouncements();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to publish announcement."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateAnnouncement(formData: FormData) {
    if (!editing) return;

    const payload = {
      title: String(formData.get("title") ?? "").trim(),
      category: String(formData.get("category") ?? ""),
      publication_date: String(formData.get("date") ?? ""),
      target_audience: String(formData.get("audience") ?? ""),
      google_link: String(formData.get("google_link") ?? "").trim(),
      content: String(formData.get("content") ?? "").trim(),
    };

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/announcements/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to update announcement.");
      }

      setEditing(null);
      setNotice("Announcement updated successfully.");
      await loadAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAnnouncement(announcement: Announcement) {
    const confirmed = window.confirm(
      `Delete "${announcement.title}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/announcements/${announcement.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to delete announcement.");
      }

      if (selected?.id === announcement.id) setSelected(null);
      setNotice("Announcement deleted successfully.");
      await loadAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete announcement.");
    } finally {
      setSaving(false);
    }
  }

  const unreadCount = announcements.length;

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

          {permittedCategories.length > 0 && (
            <button
              className="memo-primary-button"
              type="button"
              onClick={() => {
                setSelected(null);
                setShowForm((current) => !current);
                setNotice("");
                setError("");
              }}
            >
              + Create Announcement
            </button>
          )}
        </div>

        <section className="memo-summary">
          <article>
            <span>Total Announcements</span>
            <strong>{announcements.length}</strong>
          </article>
          <article>
            <span>Showing</span>
            <strong>{filteredAnnouncements.length}</strong>
          </article>
          <article>
            <span>Categories</span>
            <strong>
              {new Set(announcements.map((item) => item.category)).size}
            </strong>
          </article>
        </section>

        {permittedCategories.length > 0 && showForm && (
          <section className="memo-panel memo-form-panel">
            <div className="memo-detail-heading">
              <div>
                <h2>Create Announcement</h2>
              </div>
              <button
                className="memo-close"
                type="button"
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
              action={publishAnnouncement}
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
                <select name="category" defaultValue={permittedCategories[0]} required>
                  {formCategories.filter((item) => permittedCategories.includes(item)).map((item) => (
                    <option key={item} value={item}>
                      {item}
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
                  defaultValue={getMalaysiaToday()}
                />
              </label>

              <label className="memo-full">
                Target Audience
                <select
                  name="audience"
                  defaultValue="All Action Force Members"
                >
                  {audiences.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="memo-full">
                Google Link *
                <input
                  name="google_link"
                  type="url"
                  required
                  placeholder="Paste the Google Drive or Docs link here"
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
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="memo-primary-button"
                  disabled={saving}
                >
                  {saving ? "Publishing..." : "Publish Announcement"}
                </button>
              </div>
            </form>
          </section>
        )}

        {error && (
          <div className="memo-notice" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}

        {notice && (
          <div className="memo-notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")}>
              Dismiss
            </button>
          </div>
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
                type="button"
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
            Showing {filteredAnnouncements.length} announcement(s)
          </div>
        </section>

        <section className="memo-feed">
          {loading ? (
            <div className="memo-empty">
              <p>Loading announcements...</p>
            </div>
          ) : filteredAnnouncements.length > 0 ? (
            filteredAnnouncements.map((announcement) => (
              <article className="memo-card" key={announcement.id}>
                <div className="memo-card-top">
                  <div className="memo-card-tags">
                    <span
                      className={`memo-category-label memo-cat-${announcement.category.toLowerCase()}`}
                    >
                      {announcement.category}
                    </span>
                  </div>
                  <span className="memo-read-state">
                    {announcement.target_audience}
                  </span>
                </div>

                <h2>{announcement.title}</h2>
                <p className="memo-card-summary">
                  {announcement.content.length > 180
                    ? `${announcement.content.slice(0, 180)}…`
                    : announcement.content}
                </p>

                <div className="memo-card-meta">
                  <span>
                    Published {formatDate(announcement.publication_date)}
                  </span>
                  <span>{announcement.target_audience}</span>
                </div>

                <div className="memo-form-actions">
                  <button
                    className="memo-read-button"
                    type="button"
                    onClick={() => setSelected(announcement)}
                  >
                    Read full announcement →
                  </button>
                  <a
                    className="memo-read-button"
                    href={announcement.google_link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Google Link ↗
                  </a>
                </div>

                {announcement.created_by === currentStaffId && currentStaffId !== "" && (
                  <div className="memo-form-actions" style={{ justifyContent: "flex-end", marginTop: 12 }}>
                    <button
                      className="memo-read-button"
                      type="button"
                      onClick={() => setEditing(announcement)}
                    >
                      Edit
                    </button>
                    <button
                      className="memo-read-button"
                      type="button"
                      disabled={saving}
                      onClick={() => void deleteAnnouncement(announcement)}
                      style={{ color: "#b42318" }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="memo-empty">
              <span>⌕</span>
              <h3>No announcements found</h3>
              <p>
                {announcements.length === 0
                  ? "There are currently no announcements available for your account."
                  : "Try another search term or category."}
              </p>
            </div>
          )}
        </section>

        {editing && (
          <div className="memo-modal-backdrop" onClick={() => setEditing(null)}>
            <section
              className="memo-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="memo-edit-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="memo-detail-heading">
                <h2 id="memo-edit-title">Edit Announcement</h2>
                <button className="memo-close" type="button" onClick={() => setEditing(null)} aria-label="Close edit form">×</button>
              </div>

              <form action={updateAnnouncement} className="memo-form">
                <label>
                  Memo Title
                  <input name="title" defaultValue={editing.title} maxLength={120} required />
                </label>
                <label>
                  Category
                  <select name="category" defaultValue={editing.category} required>
                    {formCategories.filter((item) => permittedCategories.includes(item)).map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Publication Date
                  <input name="date" type="date" defaultValue={editing.publication_date} required />
                </label>
                <label>
                  Target Audience
                  <select name="audience" defaultValue={editing.target_audience} required>
                    {audiences.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  Google Link
                  <input name="google_link" type="url" defaultValue={editing.google_link} required />
                </label>
                <label>
                  Full Announcement
                  <textarea name="content" defaultValue={editing.content} rows={6} required />
                </label>
                <div className="memo-form-actions">
                  <button className="memo-primary-button" type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button className="memo-read-button" type="button" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

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
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close announcement"
                >
                  ×
                </button>
              </div>

              <h2 id="memo-detail-title">{selected.title}</h2>
              <p className="memo-detail-date">
                Published {formatDate(selected.publication_date)} ·{" "}
                {selected.target_audience}
              </p>

              <div className="memo-detail-content">
                {selected.content}
              </div>

              <p>
                <a
                  href={selected.google_link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Google Link ↗
                </a>
              </p>

              <button
                className="memo-primary-button memo-done-button"
                type="button"
                onClick={() => setSelected(null)}
              >
                Done
              </button>
            </section>
          </div>
        )}

        <footer className="memo-footer">
          CORE PURPOSE • TRUST &amp; BELIEVE • FOCUS
          <br />
          GRATITUDE • POSITIVITY
          <p>Action Force Hub · Announcements</p>
        </footer>
      </div>

      {/*<BottomNav />*/}
    </>
  );
}
