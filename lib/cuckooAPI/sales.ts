
import { env } from "cloudflare:workers";
import {
  getCuckooAccessToken,
  clearCuckooAccessToken,
} from "./auth";

export type CuckooSalesOrder = Record<string, unknown>;
export type CuckooSalesPage = {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  salesOrders: CuckooSalesOrder[];
};

// Calculate the first and last day of the current month
// using Malaysia time.
function getCurrentMalaysiaMonthRange() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = Number(
    parts.find((part) => part.type === "year")?.value
  );

  const month = Number(
    parts.find((part) => part.type === "month")?.value
  );

  const lastDay = new Date(
    Date.UTC(year, month, 0)
  ).getUTCDate();

  return {
    salesDateFrom:
      `${year}-${String(month).padStart(2, "0")}-01`,

    salesDateTo:
      `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export async function getCuckooSales(
  memberCode: string,
  pageNumber = 1,
  pageSize = 30
) {
  const baseUrl = env.CUCKOO_API_BASE_URL;

  if (!baseUrl) {
    throw new Error("CUCKOO API base URL is missing.");
  }

  // Current month's date range.
  const { salesDateFrom, salesDateTo } =
    getCurrentMalaysiaMonthRange();

  const params = new URLSearchParams({
    memberCode,
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
    salesDateFrom,
    salesDateTo,
  });

  async function requestSales(token: string) {
    return fetch(
      `${baseUrl}/api/GetSalesOrderList?${params}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
  }

  let token = await getCuckooAccessToken();
  let response = await requestSales(token);

  // Refresh token and retry once if expired.
  if (response.status === 401) {
    clearCuckooAccessToken();

    token = await getCuckooAccessToken();
    response = await requestSales(token);
  }

  if (!response.ok) {
    throw new Error(
      `CUCKOO Sales API failed: ${response.status}`
    );
  }

  const result = (await response.json()) as {
    result?: string;
    message?: string;
    data: CuckooSalesPage;
  };

  if (result.result !== "1") {
    throw new Error(
      result.message || "Unable to retrieve sales"
    );
  }

  return result.data;
}
