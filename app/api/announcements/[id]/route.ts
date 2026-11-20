import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";

const CATEGORIES = ["Announcement", "Promotion", "SOP", "Training"] as const;
const AUDIENCES = [
  "All Action Force Members",
  "Sales Consultants",
  "Agency Managers and Above",
  "Group Agency Managers and Above",
] as const;

type Context = { params: Promise<{ id: string }> };

async function getOwnedAnnouncement(id: string, staffId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("announcements")
    .select("id, created_by")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Unable to verify announcement ownership: ${error.message}`);
  if (!data) return { admin, status: 404 as const };
  if (data.created_by !== staffId) return { admin, status: 403 as const };
  return { admin, status: 200 as const };
}

export async function PATCH(request: Request, context: Context) {
  try {
    const staff = await getStaffProfile();
    if (!staff) {
      return NextResponse.json({ success: false, error: "Unauthorised access." }, { status: 401 });
    }

    const { id } = await context.params;
    const ownership = await getOwnedAnnouncement(id, staff.id);
    if (ownership.status !== 200) {
      return NextResponse.json(
        { success: false, error: ownership.status === 404 ? "Announcement not found." : "You can only edit announcements you created." },
        { status: ownership.status }
      );
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    const title = String(payload.title ?? "").trim();
    const category = String(payload.category ?? "").trim();
    const publicationDate = String(payload.publication_date ?? "").trim();
    const targetAudience = String(payload.target_audience ?? "").trim();
    const googleLink = String(payload.google_link ?? "").trim();
    const content = String(payload.content ?? "").trim();

    if (!title || !category || !publicationDate || !targetAudience || !googleLink || !content) {
      return NextResponse.json({ success: false, error: "Please complete all required fields." }, { status: 400 });
    }
    if (title.length > 120) {
      return NextResponse.json({ success: false, error: "Memo Title cannot exceed 120 characters." }, { status: 400 });
    }
    if (!(CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json({ success: false, error: "Invalid announcement category." }, { status: 400 });
    }
    if (!(AUDIENCES as readonly string[]).includes(targetAudience)) {
      return NextResponse.json({ success: false, error: "Invalid target audience." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(publicationDate)) {
      return NextResponse.json({ success: false, error: "Invalid publication date." }, { status: 400 });
    }
    let url: URL;
    try {
      url = new URL(googleLink);
    } catch {
      return NextResponse.json({ success: false, error: "Please provide a valid HTTPS Google link." }, { status: 400 });
    }
    if (url.protocol !== "https:" || !(url.hostname === "google.com" || url.hostname.endsWith(".google.com"))) {
      return NextResponse.json({ success: false, error: "Please provide a valid HTTPS Google link." }, { status: 400 });
    }

    const { data: permission, error: permissionError } = await ownership.admin
      .from("announcement_permissions")
      .select("id")
      .eq("staff_profile_id", staff.id)
      .eq("category", category)
      .maybeSingle();

    if (permissionError) throw new Error(`Unable to verify memo permission: ${permissionError.message}`);
    if (!permission) {
      return NextResponse.json({ success: false, error: "You are not authorised to create a memo in this category." }, { status: 403 });
    }

    const { data, error } = await ownership.admin
      .from("announcements")
      .update({
        title,
        category,
        publication_date: publicationDate,
        target_audience: targetAudience,
        google_link: googleLink,
        content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("created_by", staff.id)
      .select("id, title, category, publication_date, target_audience, google_link, content, created_by, created_at, updated_at")
      .single();

    if (error) throw new Error(`Unable to update announcement: ${error.message}`);
    return NextResponse.json({ success: true, announcement: data });
  } catch (error) {
    console.error("Announcement PATCH API error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to update announcement." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const staff = await getStaffProfile();
    if (!staff) {
      return NextResponse.json({ success: false, error: "Unauthorised access." }, { status: 401 });
    }

    const { id } = await context.params;
    const ownership = await getOwnedAnnouncement(id, staff.id);
    if (ownership.status !== 200) {
      return NextResponse.json(
        { success: false, error: ownership.status === 404 ? "Announcement not found." : "You can only delete announcements you created." },
        { status: ownership.status }
      );
    }

    const { error } = await ownership.admin
      .from("announcements")
      .delete()
      .eq("id", id)
      .eq("created_by", staff.id);

    if (error) throw new Error(`Unable to delete announcement: ${error.message}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Announcement DELETE API error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to delete announcement." }, { status: 500 });
  }
}
