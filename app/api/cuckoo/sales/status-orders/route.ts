
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";
import { getMalaysiaMonthRange } from "@/lib/cuckoo/personal-sales";

type StaffRecord = {
  id: string;
  member_code: string;
  full_name: string;
  role: string;
  manager_id: string | null;
  status: string;
};

type Category =
  | "netSales"
  | "incompletePayment"
  | "installationStage"
  | "callLogStage"
  | "pendingRiskAssessment"
  | "pendingSalesInfo"
  | "pendingDocumentSubmission"
  | "pendingPayment";

type RawOrder = {
  customerName?: string;
  stockName?: string;
  stockCode?: string;
  installation?: {
    address?: {
      line1?: string;
      line2?: string;
      line3?: string;
      area?: string;
      state?: string;
      postcode?: string;
      country?: string;
    };
    serviceContact?: {
      name?: string;
      mobile?: string;
      house?: string;
      office?: string;
      email?: string;
    };
    appDate?: string | null;
    actionDate?: string | null;
    statusName?: string;
    remark?: string;
    resultRemark?: string;
  };
  callLog?: unknown;
};

const allowedRoles: Record<string, string[]> = {
  DIRECTOR: ["GAM", "ID"],
  GAM: ["AM"],
  AM: ["SC"],
  SC: [],
  ID: [],
};

const validCategories: Category[] = [
  "netSales",
  "incompletePayment",
  "installationStage",
  "callLogStage",
  "pendingRiskAssessment",
  "pendingSalesInfo",
  "pendingDocumentSubmission",
  "pendingPayment",
];

function getAuthorisedTeam(
  manager: StaffRecord,
  allStaff: StaffRecord[]
): StaffRecord[] {
  const result: StaffRecord[] = [];
  const visited = new Set<string>([manager.id]);

  function visit(current: StaffRecord) {
    const allowedChildren = allowedRoles[current.role] ?? [];

    const children = allStaff.filter(
      (person) =>
        person.manager_id === current.id &&
        person.status === "ACTIVE" &&
        allowedChildren.includes(person.role)
    );

    for (const child of children) {
      if (visited.has(child.id)) continue;

      visited.add(child.id);
      result.push(child);
      visit(child);
    }
  }

  visit(manager);
  return result;
}

function getRawOrder(value: unknown): RawOrder {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as RawOrder;
}

function sanitiseCallLog(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  function clean(item: unknown): unknown {
    if (Array.isArray(item)) {
      return item.map(clean);
    }

    if (item && typeof item === "object") {
      const output: Record<string, unknown> = {};

      for (const [key, child] of Object.entries(item)) {
        if (/nric|identity|icnumber|password|token/i.test(key)) {
          continue;
        }

        output[key] = clean(child);
      }

      return output;
    }

    return item;
  }

  const safeValue = clean(value);

  return typeof safeValue === "string"
    ? safeValue
    : JSON.stringify(safeValue, null, 2);
}

export async function GET(request: Request) {
  try {
    // 1. Authenticate the logged-in staff member.
    const staff = await getStaffProfile();

    if (!staff) {
      return NextResponse.json(
        { success: false, error: "Unauthorised access." },
        { status: 401 }
      );
    }

    // 2. Read the selected category and period.
    const { searchParams } = new URL(request.url);

    const category = searchParams.get("category") as Category | null;
    const month = Number(searchParams.get("month"));
    const year = Number(searchParams.get("year"));
    const page = Number(searchParams.get("page") ?? "1");

    if (!category || !validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: "Invalid sales status category." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100 ||
      !Number.isInteger(page) ||
      page < 1
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid month, year or page." },
        { status: 400 }
      );
    }

    // 3. Retrieve staff hierarchy from Supabase.
    const admin = createAdminClient();

    const { data: staffRows, error: staffError } = await admin
      .from("staff_profiles")
      .select("id, member_code, full_name, role, manager_id, status")
      .eq("status", "ACTIVE");

    if (staffError) {
      throw new Error(staffError.message);
    }

    const allStaff = (staffRows ?? []) as StaffRecord[];

    const currentStaff = allStaff.find(
      (person) => person.id === staff.id
    );

    if (!currentStaff) {
      throw new Error("Your active staff profile could not be found.");
    }

    const authorisedTeam = getAuthorisedTeam(
      currentStaff,
      allStaff
    );

    const visibleStaff = [currentStaff, ...authorisedTeam];

    const memberCodes = [
      ...new Set(
        visibleStaff
          .map((person) => person.member_code)
          .filter(Boolean)
      ),
    ];

    if (memberCodes.length === 0) {
      return NextResponse.json({
        success: true,
        orders: [],
        total: 0,
        page,
        pageSize: 25,
        totalPages: 0,
      });
    }

    // 4. Apply the selected month.
    const { from, toExclusive } =
      getMalaysiaMonthRange(year, month);

    // 5. Retrieve only orders matching the selected category.
    let query = admin
      .from("cuckoo_sales_orders")
      .select(
        "sales_no, member_code, brand, sales_date, step_name, status_name, net_date, is_paid, raw_order",
        { count: "exact" }
      )
      .in("member_code", memberCodes)
      .gte("sales_date", from)
      .lt("sales_date", toExclusive);

    // Keep these rules identical to sales-status.ts.
    switch (category) {
      case "netSales":
        query = query.not("net_date", "is", null);
        break;

      case "incompletePayment":
        query = query
          .eq("is_paid", false)
          .eq("status_name", "Active");
        break;

      case "installationStage":
        query = query.eq("step_name", "Installation Stage");
        break;

      case "callLogStage":
        query = query.eq("step_name", "Call-Log Stage");
        break;

      case "pendingRiskAssessment":
        query = query.eq(
          "step_name",
          "Pending Risk Assessment / Doc. Verification"
        );
        break;

      case "pendingSalesInfo":
        query = query.eq("step_name", "Pending Sales Info");
        break;

      case "pendingDocumentSubmission":
        query = query.eq(
          "step_name",
          "Pending Document Submission"
        );
        break;

      case "pendingPayment":
        query = query.eq("step_name", "Pending Payment");
        break;
    }

    // 6. Pagination: 25 orders per page.
    const pageSize = 25;
    const offset = (page - 1) * pageSize;

    const { data, count, error } = await query
      .order("sales_date", { ascending: false })
      .order("sales_no", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(
        `Unable to retrieve order details: ${error.message}`
      );
    }

    // 7. Map member codes to consultant names.
    const consultantNames = new Map(
      visibleStaff.map((person) => [
        person.member_code,
        person.full_name,
      ])
    );

    // 8. Prepare customer details.
    const orders = (data ?? []).map((order) => {
      const raw = getRawOrder(order.raw_order);
      const installation = raw.installation;
      const contact = installation?.serviceContact;
      const address = installation?.address;

      const addressLines = [
        address?.line1,
        address?.line2,
        address?.line3,
        address?.area,
        address?.state,
        address?.postcode,
        address?.country,
      ].filter(
        (value): value is string =>
          Boolean(value?.trim())
      );

      return {
        id: `${order.member_code}-${order.sales_no}`,
        salesOrderId: order.sales_no,

        customerName:
          raw.customerName ||
          contact?.name ||
          "Name unavailable",

        phone:
          contact?.mobile ||
          contact?.house ||
          contact?.office ||
          "",

        email: contact?.email || "",
        address: addressLines,

        product: raw.stockName || "Product unavailable",
        stockCode: raw.stockCode || "",

        consultant:
          consultantNames.get(order.member_code) ||
          order.member_code,

        salesDate: order.sales_date,
        netDate: order.net_date,
        salesStatus: order.status_name || "Unknown",
        salesStep: order.step_name || "Not available",
        brand: order.brand,
        isPaid: order.is_paid,

        installation: {
          appointmentDate: installation?.appDate || null,
          actionDate: installation?.actionDate || null,
          status: installation?.statusName || "",
          remark: installation?.remark || "",
          resultRemark: installation?.resultRemark || "",
        },

        callLog: sanitiseCallLog(raw.callLog),
      };
    });

    const total = count ?? 0;

    // 9. Return the order details.
    return NextResponse.json(
      {
        success: true,
        orders,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Sales status order details error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to retrieve order details.",
      },
      { status: 500 }
    );
  }
}
