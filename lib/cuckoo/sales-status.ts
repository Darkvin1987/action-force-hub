
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
    configure: (query: any) => any
  ) {
    let query = supabase
      .from("cuckoo_sales_orders")
      .select("sales_no", { count: "exact", head: true })
      .in("member_code", memberCodes)
      .gte("sales_date", from)
      .lt("sales_date", toExclusive);

    query = configure(query);

    const { count, error } = await query;

    if (error) {
      console.error("SUPABASE SALES STATUS QUERY ERROR:", {
        error,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        ownProperties: Object.getOwnPropertyNames(error),
        stack: error.stack,
      });
    
      throw new Error(
        `Unable to retrieve sales status: ${
          error.message || error.code || "Unknown Supabase error"
        }`
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
    // NET Sales
    countOrders((q) =>
      q.not("net_date", "is", null)
    ),

    // Incomplete Payment
    countOrders((q) =>
      q.filter("psi_unit_count", "is", "null").eq("status_name", "Active")
    ),

    // Installation Stage
    countOrders((q) =>
      q.eq("step_name", "Installation Stage")
    ),
    
    // Call Log Stage
    countOrders((q) =>
      q.eq("step_name", "Call-Log Stage")
    ),

    // Pending Risk Assessment
    countOrders((q) =>
      q.eq(
        "step_name",
        "Pending Risk Assessment"
      )
    ),

    // Pending Sales Info
    countOrders((q) =>
      q.eq("step_name", "Pending Document Verifying")
    ),

    // Pending Document Submission
    countOrders((q) =>
      q.eq("step_name", "Pending Document Submission")
    ),

    // Combined Pending Payment / Pending Deduction
    countOrders((q) =>
      q.in("step_name", [
        "Pending Payment",
        "Pending Deduction Result",
        "Pending Deduction Submission",
        "Pending Re-Attempt Deduction",
      ])
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
