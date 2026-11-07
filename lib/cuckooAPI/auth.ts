
let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let tokenRequest: Promise<string> | null = null;

function getTokenExpiry(token: string): number {
  try {
    const payload = token.split(".")[1];

    if (payload) {
      const decoded = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8")
      );

      if (typeof decoded.exp === "number") {
        return decoded.exp * 1000;
      }
    }
  } catch {
    // Use the conservative fallback below for opaque tokens.
  }

  // Fallback when CUCKOO does not provide a readable JWT expiry.
  return Date.now() + 4 * 60 * 1000;
}

export function clearCuckooAccessToken() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

export async function getCuckooAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  // Prevent simultaneous requests from requesting multiple tokens.
  if (tokenRequest) {
    return tokenRequest;
  }

  tokenRequest = (async () => {
    const baseUrl = process.env.CUCKOO_API_BASE_URL;
    const apiAppName = process.env.CUCKOO_API_APP_NAME;
    const apiKey = process.env.CUCKOO_API_KEY;

    if (!baseUrl || !apiAppName || !apiKey) {
      throw new Error("CUCKOO API configuration missing");
    }

    const response = await fetch(
      `${baseUrl}/api/auth/GetAccessToken`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiAppName,
          apiKey,
        }),
        cache: "no-store",
      }
    );

    const responseText = await response.text();

    let result: any;

    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(
        `CUCKOO authentication returned HTTP ${response.status}. Response was not valid JSON.`
      );
    }

    if (!response.ok) {
      throw new Error(
        `CUCKOO authentication failed: ${response.status} - ${
          result.message || JSON.stringify(result)
        }`
      );
    }

    if (result.result !== "1" || !result.data?.accessToken) {
      throw new Error(
        result.message || "Authentication failed"
      );
    }

    const token = result.data.accessToken as string;

    cachedToken = token;

    const expiresIn =
      typeof result.data.expiresIn === "number"
        ? result.data.expiresIn * 1000
        : null;

    tokenExpiresAt =
      expiresIn && expiresIn > 0
        ? Date.now() + expiresIn
        : getTokenExpiry(token);

    return token;
  })();

  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}
