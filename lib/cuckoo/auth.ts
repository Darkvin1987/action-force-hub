import { getCuckooConfig } from "./config";
import {
  CuckooApiError,
  getHttpErrorMessage,
} from "./error-handler";

export interface CuckooToken {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
}

interface TokenResponse {
  result?: string | number;
  message?: string;
  data?: {
    accessToken?: string;
    tokenType?: string;
    expiresAt?: string;
  };
}

export async function requestCuckooAccessToken(): Promise<CuckooToken> {
  const config = getCuckooConfig();

  let response: Response;

  try {
    response = await fetch(
      `${config.baseUrl}/api/auth/GetAccessToken`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          apiAppName: config.apiAppName,
          apiKey: config.apiKey,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      }
    );
  } catch {
    throw new CuckooApiError(
      "Unable to connect to CUCKOO API."
    );
  }

  if (!response.ok) {
    throw new CuckooApiError(
      getHttpErrorMessage(response.status),
      response.status
    );
  }

  let result: TokenResponse;

  try {
    result = await response.json();
  } catch {
    throw new CuckooApiError(
      "Invalid JSON response from CUCKOO."
    );
  }

  const resultCode = String(result.result ?? "");

  if (resultCode !== "1") {
    throw new CuckooApiError(
      result.message || "CUCKOO authentication unsuccessful.",
      response.status,
      resultCode
    );
  }

  const accessToken = result.data?.accessToken;
  const tokenType = result.data?.tokenType;
  const expiresAt = result.data?.expiresAt;

  if (!accessToken || !tokenType || !expiresAt) {
    throw new CuckooApiError(
      "Missing token information in CUCKOO response."
    );
  }

  const expiry = Date.parse(expiresAt);

  if (!Number.isFinite(expiry) || expiry <= Date.now()) {
    throw new CuckooApiError(
      "Invalid or expired access token."
    );
  }

  return {
    accessToken,
    tokenType,
    expiresAt,
  };
}