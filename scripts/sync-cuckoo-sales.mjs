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
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const PAGE_SIZE = 30;
const FRESH_MIN = 15;
const LOCK_MIN = 10;
const BATCH_SIZE = 500;
let token = null;
let tokenExpiry = 0;
let tokenPromise = null;

function monthRangeMY() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find(x => x.type === "year").value);
  const month = Number(parts.find(x => x.type === "month").value);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

function expiryFromJwt(value) {
  try {
    const payload = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString("utf8"));
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch {}
  return Date.now() + 4 * 60_000;
}

async function getToken(force = false) {
  if (!force && token && Date.now() < tokenExpiry - 60_000) return token;
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async () => {
    const r = await fetch(`${e.CUCKOO_API_BASE_URL}/api/auth/GetAccessToken`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiAppName: e.CUCKOO_API_APP_NAME, apiKey: e.CUCKOO_API_KEY }),
    });
    const body = await r.text();
    let data;
    try { data = JSON.parse(body); }
    catch { throw new Error(`CUCKOO auth returned HTTP ${r.status} with invalid JSON`); }
    if (!r.ok) throw new Error(`CUCKOO auth failed: HTTP ${r.status}: ${data.message || body}`);
    if (data.result !== "1" || !data.data?.accessToken) throw new Error(data.message || "CUCKOO authentication failed");
    token = data.data.accessToken;
    const expires = typeof data.data.expiresIn === "number" ? data.data.expiresIn * 1000 : 0;
    tokenExpiry = expires > 0 ? Date.now() + expires : expiryFromJwt(token);
    return token;
  })();
  try { return await tokenPromise; } finally { tokenPromise = null; }
}

async function getPage(memberCode, pageNumber) {
  const range = monthRangeMY();
  const qs = new URLSearchParams({
    memberCode, pageNumber: String(pageNumber), pageSize: String(PAGE_SIZE),
    salesDateFrom: range.from, salesDateTo: range.to,
  });
  const request = t => fetch(`${e.CUCKOO_API_BASE_URL}/api/GetSalesOrderList?${qs}`, {
    method: "GET", headers: { Authorization: `Bearer ${t}`, Accept: "application/json" },
  });
  let r = await request(await getToken());
  if (r.status === 401) {
    token = null; tokenExpiry = 0;
    r = await request(await getToken(true));
  }
  if (!r.ok) throw new Error(`CUCKOO Sales API ${r.status}; member ${memberCode}; page ${pageNumber}`);
  const result = await r.json();
  if (result.result !== "1" || !result.data) throw new Error(result.message || `No sales data for ${memberCode}`);
  return result.data;
}

function toRow(memberCode, page, o) {
  return {
    member_code: memberCode, page_number: page.pageNumber, page_size: page.pageSize,
    total_count: page.totalCount, total_pages: page.totalPages,
    has_previous_page: page.hasPreviousPage, has_next_page: page.hasNextPage,
    sales_no: o.salesNo, is_combo_order: o.isComboOrder, child_orders: o.childOrders,
    step_name: o.stepName, step_no: o.stepNo, pay_mode_id: o.payModeId,
    pay_mode_name: o.payModeName, card_type_id: o.cardTypeId,
    is_card_payment: o.isCardPayment, is_outright_payment: o.isOutrightPayment,
    is_returned: o.isReturned, return_reason: o.returnReason, is_paid: o.isPaid,
    requires_debit_agreement: o.requiresDebitAgreement, status_id: o.statusID,
    status_name: o.statusName, app_type: o.appType, sales_date: o.salesDate,
    stock_code: o.stockCode, stock_name: o.stockName, platform_sales: o.platformSales,
    platform_sales_type: o.platformSalesType, brand: o.brand, customer_name: o.customerName,
    customer_nric: o.customerNRIC, is_company: o.isCompany,
    customer_type_name: o.customerTypeName, amount: o.amount,
    processing_fee_amount: o.processingFeeAmount, contract_months: o.contractMonths,
    obligation_period_months: o.obligationPeriodMonths, rental_scheme: o.rentalScheme,
    promo_code: o.promoCode, promo_description: o.promoDescription,
    pre_application_form_url: o.preApplicationFormUrl, payment_link: o.paymentLink,
    documents_submitted_at: o.documentsSubmittedAt, net_date: o.netDate,
    psi_unit_count: o.psiUnitCount, is_pending: o.isPending,
    installation: o.installation, call_log: o.callLog, cancel_request: o.cancelRequest,
    raw_order: o, updated_at: new Date().toISOString(),
  };
}

async function setStatus(memberCode, values) {
  const { error } = await db.from("cuckoo_sales_sync_status")
    .upsert({ member_code: memberCode, ...values }, { onConflict: "member_code" });
  if (error) throw new Error(`Sync status update failed for ${memberCode}: ${error.message}`);
}

async function syncMember(memberCode) {
  const { data: s, error } = await db.from("cuckoo_sales_sync_status")
    .select("last_synced_at,sync_status,updated_at").eq("member_code", memberCode).maybeSingle();
  if (error) throw new Error(`Cannot read sync status for ${memberCode}: ${error.message}`);
  const updated = s?.updated_at ? Date.parse(s.updated_at) : 0;
  if (s?.sync_status === "IN_PROGRESS" && Date.now() - updated < LOCK_MIN * 60_000) {
    console.log(`[SKIP] ${memberCode}: IN_PROGRESS`); return { status: "IN_PROGRESS", synced: 0 };
  }
  const last = s?.last_synced_at ? Date.parse(s.last_synced_at) : 0;
  if (s?.sync_status === "SUCCESS" && Date.now() - last < FRESH_MIN * 60_000) {
    console.log(`[SKIP] ${memberCode}: recent successful sync`); return { status: "SKIPPED", synced: 0 };
  }

  await setStatus(memberCode, { sync_status: "IN_PROGRESS", last_error: null, updated_at: new Date().toISOString() });
  try {
    const first = await getPage(memberCode, 1);
    const count = Math.max(Number(first.totalPages) || 1, 1);
    const pages = [first];
    for (let n = 2; n <= count; n++) pages.push(await getPage(memberCode, n));
    const rows = pages.flatMap(p => (p.salesOrders || []).map(o => toRow(memberCode, p, o)));
    let synced = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const { error: upsertError } = await db.from("cuckoo_sales_orders")
        .upsert(rows.slice(i, i + BATCH_SIZE), { onConflict: "member_code,sales_no" });
      if (upsertError) throw new Error(upsertError.message);
      synced += Math.min(BATCH_SIZE, rows.length - i);
    }
    const now = new Date().toISOString();
    await setStatus(memberCode, { last_synced_at: now, sync_status: "SUCCESS", last_error: null, updated_at: now });
    console.log(`[SUCCESS] ${memberCode}: ${synced} records; ${count} page(s)`);
    return { status: "SUCCESS", synced };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    try { await setStatus(memberCode, { sync_status: "FAILED", last_error: message, updated_at: new Date().toISOString() }); }
    catch (statusErr) { console.error(`[ERROR] Failed to save failure status for ${memberCode}:`, statusErr); }
    console.error(`[FAILED] ${memberCode}: ${message}`);
    return { status: "FAILED", synced: 0, error: message };
  }
}

async function main() {
  console.log("Starting 30-minute CUCKOO sales sync for all active staff.");
  console.log("Malaysia date range:", monthRangeMY());
  const { data, error } = await db.from("staff_profiles").select("member_code")
    .eq("status", "ACTIVE").not("member_code", "is", null);
  if (error) throw new Error(`Cannot retrieve active staff: ${error.message}`);
  const codes = [...new Set((data || []).map(x => String(x.member_code || "").trim()).filter(Boolean))];
  console.log(`Found ${codes.length} unique active staff member code(s).`);
  const totals = { SUCCESS: 0, SKIPPED: 0, IN_PROGRESS: 0, FAILED: 0, records: 0 };
  for (const code of codes) {
    const result = await syncMember(code);
    totals[result.status] = (totals[result.status] || 0) + 1;
    totals.records += result.synced || 0;
  }
  console.log("Sync summary:", totals);
  if (totals.FAILED) throw new Error(`${totals.FAILED} staff sync(s) failed; inspect logs.`);
}

main().catch(err => { console.error("Scheduled CUCKOO sync failed:", err); process.exitCode = 1; });
