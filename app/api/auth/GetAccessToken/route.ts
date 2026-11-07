import { NextResponse } from "next/server";
import { getCuckooAccessToken } from "@/lib/cuckoo/token-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const token = await getCuckooAccessToken();

    return NextResponse.json(
      {
        success: true,
        message: "CUCKOO access token is available.",
        data: {
          tokenType: token.tokenType,
          expiresAt: token.expiresAt,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "CUCKOO authentication failed.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}