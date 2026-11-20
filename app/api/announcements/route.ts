import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";

const CATEGORIES = [
  "Announcement",
  "Promotion",
  "SOP",
  "Training",
] as const;

const AUDIENCES = [
  "All Action Force Members",
  "Sales Consultants",
  "Agency Managers and Above",
  "Group Agency Managers and Above",
] as const;

type Audience = (typeof AUDIENCES)[number];

function canViewAudience(role: string, audience: Audience) {
  const normalizedRole = role.trim().toUpperCase();

  switch (audience) {
    case "All Action Force Members":
      return ["DIRECTOR", "GAM", "AM", "SC", "ID"].includes(normalizedRole);

    case "Sales Consultants":
      return normalizedRole === "SC";

    case "Agency Managers and Above":
      return ["DIRECTOR", "GAM", "AM"].includes(normalizedRole);

    case "Group Agency Managers and Above":
      return ["DIRECTOR", "GAM"].includes(normalizedRole);

    default:
      return false;
  }
}

function isValidGoogleLink(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    return (
      url.protocol === "https:" &&
      (hostname === "google.com" ||
        hostname.endsWith(".google.com"))
    );
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const staff = await getStaffProfile();

    if (!staff) {
      return NextResponse.json(
        { success: false, error: "Unauthorised access." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("announcements")
      .select(
        "id, title, category, publication_date, target_audience, google_link, content, created_by, created_at, updated_at"
      )
      .order("publication_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Unable to retrieve announcements: ${error.message}`);
    }

    const announcements = (data ?? []).filter(
      (announcement: { target_audience: string }) =>
        canViewAudience(staff.role, announcement.target_audience as Audience)
    );

    return NextResponse.json(
      { success: true, announcements },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Announcements GET API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to retrieve announcements.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const staff = await getStaffProfile();

    if (!staff) {
      return NextResponse.json(
        { success: false, error: "Unauthorised access." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: "Invalid request body." },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;

    const title = String(payload.title ?? "").trim();
    const category = String(payload.category ?? "").trim();
    const publicationDate = String(payload.publication_date ?? "").trim();
    const targetAudience = String(
      payload.target_audience ?? "All Action Force Members"
    ).trim();
    const googleLink = String(payload.google_link ?? "").trim();
    const content = String(payload.content ?? "").trim();

    if (
      !title ||
      !category ||
      !publicationDate ||
      !googleLink ||
      !content
    ) {
      return NextResponse.json(
        { success: false, error: "Please complete all required fields." },
        { status: 400 }
      );
    }

    if (title.length > 120) {
      return NextResponse.json(
        { success: false, error: "Memo Title cannot exceed 120 characters." },
        { status: 400 }
      );
    }

    if (!(CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json(
        { success: false, error: "Invalid announcement category." },
        { status: 400 }
      );
    }

    const { data: permission, error: permissionError } = await admin
      .from("announcement_permissions")
      .select("id")
      .eq("staff_profile_id", staff.id)
      .eq("category", category)
      .maybeSingle();

    if (permissionError) {
      throw new Error(`Unable to verify memo permission: ${permissionError.message}`);
    }

    if (!permission) {
      return NextResponse.json(
        { success: false, error: "You are not authorised to create a memo in this category." },
        { status: 403 }
      );
    }

    if (!(AUDIENCES as readonly string[]).includes(targetAudience)) {
      return NextResponse.json(
        { success: false, error: "Invalid target audience." },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(publicationDate)) {
      return NextResponse.json(
        { success: false, error: "Invalid publication date." },
        { status: 400 }
      );
    }

    if (!isValidGoogleLink(googleLink)) {
      return NextResponse.json(
        {
          success: false,
          error: "Please provide a valid HTTPS Google link.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("announcements")
      .insert({
        title,
        category,
        publication_date: publicationDate,
        target_audience: targetAudience,
        google_link: googleLink,
        content,
      })
      .select(
        "id, title, category, publication_date, target_audience, google_link, content, created_by, created_at, updated_at"
      )
      .single();

    if (error) {
      throw new Error(`Unable to publish announcement: ${error.message}`);
    }

    return NextResponse.json(
      { success: true, announcement: data },
      { status: 201 }
    );
  } catch (error) {
    console.error("Announcements POST API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to publish announcement.",
      },
      { status: 500 }
    );
  }
}
