
import { createClient } from "@supabase/supabase-js";

const e = process.env;
const url = e.SUPABASE_URL || e.NEXT_PUBLIC_SUPABASE_URL;

const required = {
  SUPABASE_URL: url,
  SUPABASE_SECRET_KEY: e.SUPABASE_SECRET_KEY,
  CUCKOO_API_BASE_URL: e.CUCKOO_API_BASE_URL,
  CUCKOO_API_APP_NAME: e.CUCKOO_API_APP_NAME,
  CUCKOO_API_KEY: e.CUCKOO_API_KEY,
};

for (const [key, value] of Object.entries(required)) {
  if (!value) throw new Error(`Missing environment variable: ${key}`);
}

const db = createClient(url, e.SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const PAGE_SIZE = 30;
const BATCH_SIZE = 500;

let token = null;
let tokenExpiry = 0;
let tokenPromise = null;

// Malaysia calendar date
function malaysiaMonthParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  return {
    year: Number(parts.find(x => x.type === "year").value),
    month: Number(parts.find(x => x.type === "month").value),
  };
}

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Get previous N completed calendar months.
// Example: November + 2 months = September 1 to October 31.
function getHistoricalRange(monthsBack) {
  const { year, month } = malaysiaMonthParts();

  const end = new Date(Date.UTC(year, month - 1, 0));
  const start = new Date(
    Date.UTC(year, month - 1 - monthsBack, 1)
  );

  return {
    from: formatDate(
      start.getUTCFullYear(),
      start.getUTCMonth() + 1,
      1
    ),
    to: formatDate(
      end.getUTCFullYear(),
      end.getUTCMonth() + 1,
      end.getUTCDate()
    ),
  };
}

function expiryFromJwt(value) {
  try {
    const payload = JSON.parse(
      Buffer.from(value.split(".")[1], "base64url").toString("utf8")
    );

    if (typeof payload.exp === "number") {
      return payload.exp * 1000;
    }
  } catch {}

  return Date.now() + 4 * 60_000;
}

// CUCKOO authentication
async function getToken(force = false) {
  if (!force && token && Date.now() < tokenExpiry - 60_000) {
    return token;
  }

  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    const r = await fetch(
      `${e.CUCKOO_API_BASE_URL}/api/auth/GetAccessToken`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiAppName: e.CUCKOO_API_APP_NAME,
          apiKey: e.CUCKOO_API_KEY,
        }),
      }
    );

    const body = await r.text();
    let data;

    try {
      data = JSON.parse(body);
    } catch {
      throw new Error(
        `CUCKOO auth returned HTTP ${r.status} with invalid JSON`
      );
    }

    if (!r.ok) {
      throw new Error(
        `CUCKOO auth failed: HTTP ${r.status}: ${data.message || body}`
      );
    }

    if (data.result !== "1" || !data.data?.accessToken) {
      throw new Error(data.message || "CUCKOO authentication failed");
    }

    token = data.data.accessToken;

    const expires =
      typeof data.data.expiresIn === "number"
        ? data.data.expiresIn * 1000
        : 0;

    tokenExpiry =
      expires > 0
        ? Date.now() + expires
        : expiryFromJwt(token);

    return token;
  })();

  try {
    return await tokenPromise;
  } finally {
    tokenPromise = null;
  }
}

// Retrieve one page of sales
async function getPage(memberCode, pageNumber, range) {
  const qs = new URLSearchParams({
    memberCode,
    pageNumber: String(pageNumber),
    pageSize: String(PAGE_SIZE),
    salesDateFrom: range.from,
    salesDateTo: range.to,
  });

  const request = t =>
    fetch(
      `${e.CUCKOO_API_BASE_URL}/api/GetSalesOrderList?${qs}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${t}`,
          Accept: "application/json",
        },
      }
    );

  let r = await request(await getToken());

  if (r.status === 401) {
    token = null;
    tokenExpiry = 0;
    r = await request(await getToken(true));
  }

  if (!r.ok) {
    throw new Error(
      `CUCKOO Sales API ${r.status}; member ${memberCode}; page ${pageNumber}`
    );
  }

  const result = await r.json();

  if (result.result !== "1" || !result.data) {
    throw new Error(
      result.message || `No sales data for ${memberCode}`
    );
  }

  return result.data;
}

// Map CUCKOO API fields to existing Supabase columns
function toRow(memberCode, page, o) {
  return {
    member_code: memberCode,
    page_number: page.pageNumber,
    page_size: page.pageSize,
    total_count: page.totalCount,
    total_pages: page.totalPages,
    has_previous_page: page.hasPreviousPage,
    has_next_page: page.hasNextPage,
    sales_no: o.salesNo,
    is_combo_order: o.isComboOrder,
    child_orders: o.childOrders,
    step_name: o.stepName,
    step_no: o.stepNo,
    pay_mode_id: o.payModeId,
    pay_mode_name: o.payModeName,
    card_type_id: o.cardTypeId,
    is_card_payment: o.isCardPayment,
    is_outright_payment: o.isOutrightPayment,
    is_returned: o.isReturned,
    return_reason: o.returnReason,
    is_paid: o.isPaid,
    requires_debit_agreement: o.requiresDebitAgreement,
    status_id: o.statusID,
    status_name: o.statusName,
    app_type: o.appType,
    sales_date: o.salesDate,
    stock_code: o.stockCode,
    stock_name: o.stockName,
    platform_sales: o.platformSales,
    platform_sales_type: o.platformSalesType,
    brand: o.brand,
    customer_name: o.customerName,
    customer_nric: o.customerNRIC,
    is_company: o.isCompany,
    customer_type_name: o.customerTypeName,
    amount: o.amount,
    processing_fee_amount: o.processingFeeAmount,
    contract_months: o.contractMonths,
    obligation_period_months: o.obligationPeriodMonths,
    rental_scheme: o.rentalScheme,
    promo_code: o.promoCode,
    promo_description: o.promoDescription,
    pre_application_form_url: o.preApplicationFormUrl,
    payment_link: o.paymentLink,
    documents_submitted_at: o.documentsSubmittedAt,
    net_date: o.netDate,
    psi_unit_count: o.psiUnitCount,
    is_pending: o.isPending,
    installation: o.installation,
    call_log: o.callLog,
    cancel_request: o.cancelRequest,
    raw_order: o,
    updated_at: new Date().toISOString(),
  };
}

// Sync one staff member
async function syncMember(memberCode, range) {
  console.log(
    `[START] ${memberCode}: ${range.from} to ${range.to}`
  );

  const first = await getPage(memberCode, 1, range);

  const count = Math.max(
    Number(first.totalPages) || 1,
    1
  );

  const pages = [first];

  for (let n = 2; n <= count; n++) {
    pages.push(await getPage(memberCode, n, range));
  }

  const rows = pages.flatMap(p =>
    (p.salesOrders || []).map(o =>
      toRow(memberCode, p, o)
    )
  );

  let synced = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const { error } = await db
      .from("cuckoo_sales_orders")
      .upsert(batch, {
        onConflict: "member_code,sales_no",
      });

    if (error) {
      throw new Error(
        `Database upsert failed for ${memberCode}: ${error.message}`
      );
    }

    synced += batch.length;
  }

  console.log(
    `[SUCCESS] ${memberCode}: ${synced} records; ${count} page(s)`
  );

  return synced;
}

// Main historical sync
export async function runHistoricalSync(monthsBack) {
  if (!Number.isInteger(monthsBack) || monthsBack < 1) {
    throw new Error("monthsBack must be a positive integer");
  }

  const range = getHistoricalRange(monthsBack);

  console.log(
    `Starting CUCKOO historical sync for previous ${monthsBack} completed month(s).`
  );
  console.log("Malaysia date range:", range);

  const { data, error } = await db
    .from("staff_profiles")
    .select("member_code")
    .eq("status", "ACTIVE")
    .not("member_code", "is", null);

  if (error) {
    throw new Error(
      `Cannot retrieve active staff: ${error.message}`
    );
  }

  const codes = [
    ...new Set(
      (data || [])
        .map(x => String(x.member_code || "").trim())
        .filter(Boolean)
    ),
  ];

  console.log(
    `Found ${codes.length} unique active staff member code(s).`
  );

  const totals = {
    SUCCESS: 0,
    FAILED: 0,
    records: 0,
  };

  const failures = [];

  for (const code of codes) {
    try {
      totals.records += await syncMember(code, range);
      totals.SUCCESS += 1;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";

      totals.FAILED += 1;
      failures.push({ memberCode: code, message });

      console.error(`[FAILED] ${code}: ${message}`);
    }
  }

  console.log("Historical sync summary:", totals);

  if (failures.length) {
    throw new Error(
      `${failures.length} staff sync(s) failed: ${JSON.stringify(failures)}`
    );
  }
}
