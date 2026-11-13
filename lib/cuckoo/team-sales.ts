
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMalaysiaMonthRange } from "@/lib/cuckoo/personal-sales";

export async function getTeamSales(
  supabase: SupabaseClient,
  memberCodes: string[],
  year?: number,
  month?: number
) {
  const { from, toExclusive, toDisplay } =
    getMalaysiaMonthRange(year, month);

  if (memberCodes.length === 0) {
    return {
      branded: 0,
      coCreated: 0,
      total: 0,

      overallBranded: 0,
      overallCoCreated: 0,
      overallTotal: 0,

      memberCount: 0,
      monthFrom: from,
      monthTo: toDisplay,
    };
  }

  async function countSales(
    dateColumn: "net_date" | "sales_date",
    brand?: string
  ) {
    let query = supabase
      .from("cuckoo_sales_orders")
      .select("sales_no", { count: "exact", head: true })
      .in("member_code", memberCodes)
      .gte(dateColumn, from)
      .lt(dateColumn, toExclusive);

    if (brand) {
      query = query.eq("brand", brand);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(
        `Unable to retrieve team sales: ${error.message}`
      );
    }

    return count ?? 0;
  }

  const [
    branded,
    coCreated,
    total,
    overallBranded,
    overallCoCreated,
    overallTotal,
  ] = await Promise.all([
    countSales("net_date", "Cuckoo Branded"),
    countSales("net_date", "Co-Created"),
    countSales("net_date"),

    countSales("sales_date", "Cuckoo Branded"),
    countSales("sales_date", "Co-Created"),
    countSales("sales_date"),
  ]);

  return {
    branded,
    coCreated,
    total,

    overallBranded,
    overallCoCreated,
    overallTotal,

    memberCount: memberCodes.length,
    monthFrom: from,
    monthTo: toDisplay,
  };
}
