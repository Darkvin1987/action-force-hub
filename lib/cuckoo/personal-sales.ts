
import type { SupabaseClient } from "@supabase/supabase-js";

export function getMalaysiaMonthRange(
  selectedYear?: number,
  selectedMonth?: number
) {
  let year = selectedYear;
  let month = selectedMonth;

  if (!year || !month) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());

    year = Number(parts.find((p) => p.type === "year")?.value);
    month = Number(parts.find((p) => p.type === "month")?.value);
  }

  const from = `${year}-${String(month).padStart(2, "0")}-01`;

  const nextMonth = new Date(Date.UTC(year, month, 1));

  const toExclusive = [
    nextMonth.getUTCFullYear(),
    String(nextMonth.getUTCMonth() + 1).padStart(2, "0"),
    "01",
  ].join("-");

  const lastDay = new Date(
    Date.UTC(year, month, 0)
  ).toISOString().slice(0, 10);

  return {
    from,
    toExclusive,
    toDisplay: lastDay,
  };
}

export async function getPersonalSales(
  supabase: SupabaseClient,
  memberCode: string,
  year?: number,
  month?: number
) {
  const { from, toExclusive, toDisplay } =
    getMalaysiaMonthRange(year, month);

  async function countSales(
    dateColumn: "net_date" | "sales_date",
    brand?: string
  ) {
    let query = supabase
      .from("cuckoo_sales_orders")
      .select("sales_no", { count: "exact", head: true })
      .eq("member_code", memberCode)
      .gte(dateColumn, from)
      .lt(dateColumn, toExclusive);

    if (brand) {
      query = query.eq("brand", brand);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(
        `Unable to retrieve personal sales: ${error.message}`
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

    monthFrom: from,
    monthTo: toDisplay,
  };
}
