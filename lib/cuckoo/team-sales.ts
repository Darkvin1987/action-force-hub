
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMalaysiaMonthRange } from "@/lib/cuckoo/personal-sales";

export async function getTeamSales(
  supabase: SupabaseClient,
  memberCodes: string[],
  year?: number,
  month?: number
) {
  const {
    from,
    toExclusive,
    toDisplay,
  } = getMalaysiaMonthRange(year, month);

  if (memberCodes.length === 0) {
    return {
      branded: 0,
      coCreated: 0,
      total: 0,
      memberCount: 0,
      monthFrom: from,
      monthTo: toDisplay,
    };
  }

  async function countSales(brand?: string) {
    let query = supabase
      .from("cuckoo_sales_orders")
      .select("sales_no", { count: "exact", head: true })
      .in("member_code", memberCodes)
      .gte("sales_date", from)
      .lt("sales_date", toExclusive);

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

  const [branded, coCreated, total] = await Promise.all([
    countSales("Cuckoo Branded"),
    countSales("Co-Created"),
    countSales(),
  ]);

  return {
    branded,
    coCreated,
    total,
    memberCount: memberCodes.length,
    monthFrom: from,
    monthTo: toDisplay,
  };
}
