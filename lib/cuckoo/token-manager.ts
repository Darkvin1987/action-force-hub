import {
  requestCuckooAccessToken,
  type CuckooToken,
} from "./auth";

const EXPIRY_BUFFER = 60 * 1000;

let cachedToken: CuckooToken | null = null;

let pendingRequest: Promise<CuckooToken> | null = null;

function isTokenValid(
  token: CuckooToken | null
): token is CuckooToken {
  if (!token) return false;

  return (
    Date.parse(token.expiresAt) - Date.now() >
    EXPIRY_BUFFER
  );
}

export async function getCuckooAccessToken(): Promise<CuckooToken> {
  if (isTokenValid(cachedToken)) {
    return cachedToken;
  }

  if (!pendingRequest) {
    pendingRequest = requestCuckooAccessToken()
      .then((token) => {
        cachedToken = token;
        return token;
      })
      .finally(() => {
        pendingRequest = null;
      });
  }

  return pendingRequest;
}

export function clearCuckooTokenCache(): void {
  cachedToken = null;
}