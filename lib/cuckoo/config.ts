const DEFAULT_BASE_URL =
  "https://mapi.cuckoo.com.my/SalesAPI";

export function getCuckooConfig() {
  const apiKey = process.env.CUCKOO_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing CUCKOO_API_KEY environment variable.");
  }

  return {
    apiKey,
    baseUrl: (
      process.env.CUCKOO_API_BASE_URL || DEFAULT_BASE_URL
    ).replace(/\/+$/, ""),
    apiAppName: "AspExclusive" as const,
  };
}