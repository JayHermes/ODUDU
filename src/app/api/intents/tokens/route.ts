import { NextResponse } from "next/server";
import { getTidepoolBaseUrl } from "@/lib/near-intents";

export const runtime = "nodejs";

export async function GET() {
  try {
    const baseUrl = getTidepoolBaseUrl();
    const response = await fetch(`${baseUrl}/v0/tokens`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Tidepool could not return its supported token list." }, { status: 502 });
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: "Unexpected token-list response from Tidepool." }, { status: 502 });
    }

    return NextResponse.json({ tokens: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach Tidepool.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
