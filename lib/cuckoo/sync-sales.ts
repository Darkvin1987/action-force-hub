
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCuckooSales } from "@/lib/cuckooAPI/sales";

const PAGE_SIZE = 30;
const PAGE_CONCURRENCY = 3;
const UPSERT_BATCH_SIZE = 500;

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex++;

      if (index >= items.length) return;

      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(limit, items.length) },
      () => runWorker()
    )
  );

  return results;
}

export async function syncCuckooSales(
  supabase: SupabaseClient,
  memberCode: string
) {
  const totalStart = Date.now();

  // 1. Retrieve first API page.
  const firstPageStart = Date.now();

  const firstPage = await getCuckooSales(
    memberCode,
    1,
    PAGE_SIZE
  );

  console.log(
    `[SYNC TIMING] ${memberCode} - First API Page: ${Date.now() - firstPageStart}ms`
  );

  const totalPages = Math.max(
    firstPage.totalPages ?? 1,
    1
  );

  console.log(
    `[SYNC INFO] ${memberCode} - Total Pages: ${totalPages}`
  );

  // 2. Retrieve remaining pages concurrently.
  const pageNumbers = Array.from(
    { length: totalPages - 1 },
    (_, index) => index + 2
  );

  const remainingPagesStart = Date.now();

  const remainingPages = await runWithConcurrency(
    pageNumbers,
    PAGE_CONCURRENCY,
    (pageNumber) =>
      getCuckooSales(
        memberCode,
        pageNumber,
        PAGE_SIZE
      )
  );

  console.log(
    `[SYNC TIMING] ${memberCode} - Remaining API Pages (${pageNumbers.length}): ${Date.now() - remainingPagesStart}ms`
  );

  const pages = [firstPage, ...remainingPages];

  // 3. Convert API records into database rows.
  const mappingStart = Date.now();

  const rows = pages.flatMap((page) =>
    (page.salesOrders ?? []).map((order: any) => ({
      member_code: memberCode,
      page_number: page.pageNumber,
      page_size: page.pageSize,
      total_count: page.totalCount,
      total_pages: page.totalPages,
      has_previous_page: page.hasPreviousPage,
      has_next_page: page.hasNextPage,

      sales_no: order.salesNo,
      is_combo_order: order.isComboOrder,
      child_orders: order.childOrders,
      step_name: order.stepName,
      step_no: order.stepNo,
      pay_mode_id: order.payModeId,
      pay_mode_name: order.payModeName,
      card_type_id: order.cardTypeId,
      is_card_payment: order.isCardPayment,
      is_outright_payment: order.isOutrightPayment,
      is_returned: order.isReturned,
      return_reason: order.returnReason,
      is_paid: order.isPaid,
      requires_debit_agreement: order.requiresDebitAgreement,
      status_id: order.statusID,
      status_name: order.statusName,
      app_type: order.appType,
      sales_date: order.salesDate,
      stock_code: order.stockCode,
      stock_name: order.stockName,
      platform_sales: order.platformSales,
      platform_sales_type: order.platformSalesType,
      brand: order.brand,
      customer_name: order.customerName,
      customer_nric: order.customerNRIC,
      is_company: order.isCompany,
      customer_type_name: order.customerTypeName,
      amount: order.amount,
      processing_fee_amount: order.processingFeeAmount,
      contract_months: order.contractMonths,
      obligation_period_months: order.obligationPeriodMonths,
      rental_scheme: order.rentalScheme,
      promo_code: order.promoCode,
      promo_description: order.promoDescription,
      pre_application_form_url: order.preApplicationFormUrl,
      payment_link: order.paymentLink,
      documents_submitted_at: order.documentsSubmittedAt,
      net_date: order.netDate,
      psi_unit_count: order.psiUnitCount,
      is_pending: order.isPending,
      installation: order.installation,
      call_log: order.callLog,
      cancel_request: order.cancelRequest,

      raw_order: order,
      updated_at: new Date().toISOString(),
    }))
  );

  console.log(
    `[SYNC TIMING] ${memberCode} - Record Mapping: ${Date.now() - mappingStart}ms`
  );

  console.log(
    `[SYNC INFO] ${memberCode} - Records Retrieved: ${rows.length}`
  );

  if (rows.length === 0) {
    console.log(
      `[SYNC TIMING] ${memberCode} - Total: ${Date.now() - totalStart}ms`
    );

    return {
      success: true,
      synced: 0,
      totalPages,
      message: "No sales orders returned by CUCKOO.",
    };
  }

  // 4. Save records in batches.
  let synced = 0;

  const upsertStart = Date.now();

  for (
    let start = 0;
    start < rows.length;
    start += UPSERT_BATCH_SIZE
  ) {
    const batch = rows.slice(
      start,
      start + UPSERT_BATCH_SIZE
    );

    const batchStart = Date.now();

    const { error } = await supabase
      .from("cuckoo_sales_orders")
      .upsert(batch, {
        onConflict: "member_code,sales_no",
      });

    if (error) {
      throw new Error(
        `Unable to sync CUCKOO sales for ${memberCode}: ${error.message}`
      );
    }

    synced += batch.length;

    console.log(
      `[SYNC TIMING] ${memberCode} - Upsert Batch (${batch.length} records): ${Date.now() - batchStart}ms`
    );
  }

  console.log(
    `[SYNC TIMING] ${memberCode} - Total Database Upsert: ${Date.now() - upsertStart}ms`
  );

  console.log(
    `[SYNC TIMING] ${memberCode} - Total: ${Date.now() - totalStart}ms`
  );

  return {
    success: true,
    synced,
    totalPages,
  };
}
