
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMalaysiaMonthRange } from "@/lib/cuckoo/personal-sales";

export type SalesStatusCounts = {
  netSales: number;
  incompletePayment: number;
  installationStage: number;
  callLogStage: number;
  pendingRiskAssessment: number;
  pendingSalesInfo: number;
  pendingDocumentSubmission: number;
  pendingPayment: number;
  monthFrom: string;
  monthTo: string;
};

export async function getSalesStatusCounts(
  supabase: SupabaseClient,
  memberCodes: string[],
  year?: number,
  month?: number
): Promise<SalesStatusCounts> {
  const { from, toExclusive, toDisplay } =
    getMalaysiaMonthRange(year, month);

  const emptyResult: SalesStatusCounts = {
    netSales: 0,
    incompletePayment: 0,
    installationStage: 0,
    callLogStage: 0,
    pendingRiskAssessment: 0,
    pendingSalesInfo: 0,
    pendingDocumentSubmission: 0,
    pendingPayment: 0,
    monthFrom: from,
    monthTo: toDisplay,
  };

  if (memberCodes.length === 0) {
    return emptyResult;
  }

  async function countOrders(
    configure: (query: any) => any,
    dateColumn: "sales_date" | "net_date" = "sales_date"
  ) {
    let query = supabase
      .from("cuckoo_sales_orders")
      .select("sales_no", { count: "exact", head: true })
      .in("member_code", memberCodes)
      .gte(dateColumn, from)
      .lt(dateColumn, toExclusive);

    query = configure(query);

    const { count, error } = await query;

    if (error) {
      throw new Error(
        `Unable to retrieve sales status: ${error.message}`
      );
    }

    return count ?? 0;
  }

  const [
    netSales,
    incompletePayment,
    installationStage,
    callLogStage,
    pendingRiskAssessment,
    pendingSalesInfo,
    pendingDocumentSubmission,
    pendingPayment,
  ] = await Promise.all([
    // NET Sales: calculate using net_date
    countOrders(
      (q) => q.not("net_date", "is", null),
      "net_date"
    ),

    // Other categories: continue using sales_date
    countOrders((q) =>
      q.eq("is_paid", false).eq("step_name", "Installation Complete")
    ),
    countOrders((q) =>
      q.eq("step_name", "Installation Stage")
    ),
    countOrders((q) =>
      q.eq("step_name", "Call-Log Stage")
    ),
    countOrders((q) =>
      q.eq("step_name", "Pending Risk Assessment / Doc. Verification")
    ),
    countOrders((q) =>
      q.eq("step_name", "Pending Sales Info")
    ),
    countOrders((q) =>
      q.eq("step_name", "Pending Document Submission")
    ),
    countOrders((q) =>
      q.eq("step_name", "Pending Payment")
    ),
  ]);

  return {
    netSales,
    incompletePayment,
    installationStage,
    callLogStage,
    pendingRiskAssessment,
    pendingSalesInfo,
    pendingDocumentSubmission,
    pendingPayment,
    monthFrom: from,
    monthTo: toDisplay,
  };
}
