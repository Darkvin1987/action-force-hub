
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile } from "@/lib/staff/get-staff-profile";

type StaffRecord = {
  id: string;
  member_code: string;
  full_name: string;
  role: string;
  manager_id: string | null;
  status: string;
};

type RawOrder = {
  customerName?: string;
  stockName?: string;
  stockCode?: string;
  salesNo?: string;
  salesDate?: string;
  netDate?: string | null;
  brand?: string;
  amount?: number;
  processingFeeAmount?: number;
  isPaid?: boolean;
  isCardPayment?: boolean;
  isOutrightPayment?: boolean;
  payModeName?: string;
  rentalScheme?: string;
  contractMonths?: number;
  obligationPeriodMonths?: number;
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
    hasAppointment?: boolean;
  };
  callLog?: unknown;
};

type StatusCategory = {
  key: string;
  label: string;
};

const STATUS_CATEGORIES: StatusCategory[] = [
  { key: "netSales", label: "NET Sales" },
  { key: "incompletePayment", label: "Incomplete Payment" },
  { key: "installationStage", label: "Installation Stage" },
  { key: "callLogStage", label: "Call Log Stage" },
  {
    key: "pendingRiskAssessment",
    label: "Pending Risk Assessment / Doc. Verification",
  },
  { key: "pendingSalesInfo", label: "Pending Sales Info" },
  {
    key: "pendingDocumentSubmission",
    label: "Pending Doc. Submission",
  },
  { key: "pendingPayment", label: "Pending Payment" },
];

const allowedRoles: Record<string, string[]> = {
  DIRECTOR: ["GAM", "ID"],
  GAM: ["AM", "SC", "ID"],
  AM: ["SC"],
  SC: [],
  ID: [],
};

function getAuthorisedTeam(
  currentStaff: StaffRecord,
  allStaff: StaffRecord[]
): StaffRecord[] {
  const result: StaffRecord[] = [];
  const visited = new Set<string>([currentStaff.id]);

  function findSubordinates(manager: StaffRecord) {
    const allowedChildRoles = allowedRoles[manager.role] ?? [];

    const directReports = allStaff.filter(
      (person) =>
        person.manager_id === manager.id &&
        person.status === "ACTIVE" &&
        allowedChildRoles.includes(person.role)
    );

    for (const person of directReports) {
      if (visited.has(person.id)) continue;

      visited.add(person.id);
      result.push(person);

      findSubordinates(person);
    }
  }

  findSubordinates(currentStaff);

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

function getAddress(raw: RawOrder): string[] {
  const address = raw.installation?.address;

  if (!address) return [];

  return [
    address.line1,
    address.line2,
    address.line3,
    address.area,
    address.state,
    address.postcode,
    address.country,
  ].filter(
    (part): part is string =>
      Boolean(part && part.trim())
  );
}

function sanitiseCallLog(value: unknown): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
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

function getCustomerStatuses(order: {
  net_date: string | null;
  is_paid: boolean | null;
  status_name: string | null;
  step_name: string | null;
}): string[] {
  const statuses: string[] = [];

  // Same conditions as lib/cuckoo/sales-status.ts.

  if (order.net_date !== null) {
    statuses.push("NET Sales");
  }

  if (
    order.is_paid === false &&
    order.step_name === "Installation Complete"
  ) {
    statuses.push("Incomplete Payment");
  }

  if (order.step_name === "Installation Stage") {
    statuses.push("Installation Stage");
  }

  if (order.step_name === "Call-Log Stage") {
    statuses.push("Call Log Stage");
  }

  if (
    order.step_name ===
    "Pending Risk Assessment / Doc. Verification"
  ) {
    statuses.push(
      "Pending Risk Assessment / Doc. Verification"
    );
  }

  if (order.step_name === "Pending Sales Info") {
    statuses.push("Pending Sales Info");
  }

  if (order.step_name === "Pending Document Submission") {
    statuses.push("Pending Doc. Submission");
  }

  if (order.step_name === "Pending Payment") {
    statuses.push("Pending Payment");
  }

  return statuses;
}

export async function GET() {
  try {
    // 1. Authenticate the logged-in staff member.
    const staff = await getStaffProfile();

    if (!staff) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorised access.",
        },
        { status: 401 }
      );
    }

    if (!staff.member_code) {
      return NextResponse.json(
        {
          success: false,
          error: "Staff member code is missing.",
        },
        { status: 400 }
      );
    }

    // 2. Connect to Supabase.
    // CRM does not trigger CUCKOO API synchronisation.
    const admin = createAdminClient();

    // 3. Retrieve active staff profiles.
    const { data: staffRows, error: staffError } = await admin
      .from("staff_profiles")
      .select(
        "id, member_code, full_name, role, manager_id, status"
      )
      .eq("status", "ACTIVE");

    if (staffError) {
      throw new Error(
        `Unable to retrieve staff profiles: ${staffError.message}`
      );
    }

    const allStaff = (staffRows ?? []) as StaffRecord[];

    const currentStaff = allStaff.find(
      (person) => person.id === staff.id
    );

    if (!currentStaff) {
      throw new Error(
        "Your active staff profile could not be found."
      );
    }

    // 4. Determine the authorised team.
    const authorisedTeam = getAuthorisedTeam(
      currentStaff,
      allStaff
    );

    const visibleStaff = [
      currentStaff,
      ...authorisedTeam,
    ];

    const memberCodes = [
      ...new Set(
        visibleStaff
          .map((person) => person.member_code)
          .filter(Boolean)
      ),
    ];

    const emptySummary = {
      total: 0,
      netSales: 0,
      incompletePayment: 0,
      installationStage: 0,
      callLogStage: 0,
      pendingRiskAssessment: 0,
      pendingSalesInfo: 0,
      pendingDocumentSubmission: 0,
      pendingPayment: 0,
    };

    if (memberCodes.length === 0) {
      return NextResponse.json({
        success: true,
        customers: [],
        summary: emptySummary,
        statuses: STATUS_CATEGORIES,
      });
    }

    // 5. Retrieve ALL historical sales records from Supabase.
    // No sales_date filter is applied.
    // Retrieve records in batches of 1,000.

    const pageSize = 1000;
    let offset = 0;

    const salesOrders: Array<{
      sales_no: string;
      member_code: string;
      brand: string | null;
      sales_date: string | null;
      net_date: string | null;
      step_name: string | null;
      status_name: string | null;
      is_paid: boolean | null;
      amount: number | null;
      raw_order: unknown;
    }> = [];

    while (true) {
      const { data, error } = await admin
        .from("cuckoo_sales_orders")
        .select(
          "sales_no, member_code, brand, sales_date, net_date, step_name, status_name, is_paid, amount, raw_order"
        )
        .in("member_code", memberCodes)
        .order("sales_date", { ascending: false })
        .order("sales_no", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new Error(
          `Unable to retrieve customer sales: ${error.message}`
        );
      }

      const rows = data ?? [];

      salesOrders.push(...rows);

      if (rows.length < pageSize) {
        break;
      }

      offset += pageSize;
    }

    // Remove duplicate sales orders.
    // Each member_code + sales_no combination should appear only once.
    const uniqueSalesOrders = Array.from(
      new Map(
        salesOrders.map((order) => [
          `${order.member_code}-${order.sales_no}`,
          order,
        ])
      ).values()
    );

    // 6. Map member codes to consultant names.
    const consultantNames = new Map(
      visibleStaff.map((person) => [
        person.member_code,
        person.full_name,
      ])
    );

    // 7. Convert stored sales orders into CRM records.
    const customers = salesOrders.map((order) => {
      const raw = getRawOrder(order.raw_order);

      const contact = raw.installation?.serviceContact;

      const customerStatuses = getCustomerStatuses(order);

      return {
        id: `${order.member_code}-${order.sales_no}`,

        salesOrderId: order.sales_no,

        name:
          raw.customerName ||
          contact?.name ||
          "Name unavailable",

        phone:
          contact?.mobile ||
          contact?.house ||
          contact?.office ||
          "",

        email: contact?.email || "",

        address: getAddress(raw),

        product:
          raw.stockName ||
          "Product unavailable",

        stockCode: raw.stockCode || "",

        consultant:
          consultantNames.get(order.member_code) ||
          order.member_code,

        salesStatus:
          order.status_name || "Unknown",

        salesStep:
          order.step_name || "Not available",

        customerStatuses,

        salesDate: order.sales_date,
        netDate: order.net_date,

        memberCode: order.member_code,
        brand: order.brand,

        amount:
          order.amount ??
          raw.amount ??
          null,

        isPaid: order.is_paid,

        paymentMethod:
          raw.payModeName || "Not available",

        isCardPayment:
          raw.isCardPayment ?? false,

        isOutrightPayment:
          raw.isOutrightPayment ?? false,

        rentalScheme:
          raw.rentalScheme || "",

        contractMonths:
          raw.contractMonths ?? null,

        obligationPeriodMonths:
          raw.obligationPeriodMonths ?? null,

        installation: {
          appointmentDate:
            raw.installation?.appDate || null,

          actionDate:
            raw.installation?.actionDate || null,

          status:
            raw.installation?.statusName || "",

          remark:
            raw.installation?.remark || "",

          resultRemark:
            raw.installation?.resultRemark || "",

          hasAppointment:
            raw.installation?.hasAppointment ?? false,
        },

        // Call Log information from CUCKOO raw order.
        callLog: sanitiseCallLog(raw.callLog),
      };
    });

    // 8. Calculate the eight category counts.
    // An order can belong to more than one category.
    const summary = {
      total: customers.length,

      netSales: customers.filter((customer) =>
        customer.customerStatuses.includes("NET Sales")
      ).length,

      incompletePayment: customers.filter((customer) =>
        customer.customerStatuses.includes("Incomplete Payment")
      ).length,

      installationStage: customers.filter((customer) =>
        customer.customerStatuses.includes("Installation Stage")
      ).length,

      callLogStage: customers.filter((customer) =>
        customer.customerStatuses.includes("Call Log Stage")
      ).length,

      pendingRiskAssessment: customers.filter((customer) =>
        customer.customerStatuses.includes(
          "Pending Risk Assessment / Doc. Verification"
        )
      ).length,

      pendingSalesInfo: customers.filter((customer) =>
        customer.customerStatuses.includes("Pending Sales Info")
      ).length,

      pendingDocumentSubmission: customers.filter((customer) =>
        customer.customerStatuses.includes("Pending Doc. Submission")
      ).length,

      pendingPayment: customers.filter((customer) =>
        customer.customerStatuses.includes("Pending Payment")
      ).length,
    };

    // 9. Return the CRM records.
    return NextResponse.json(
      {
        success: true,
        customers,
        summary,
        statuses: STATUS_CATEGORIES,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("CRM customers API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to retrieve CRM customers.",
      },
      { status: 500 }
    );
  }
}
