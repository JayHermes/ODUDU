import { NextResponse } from "next/server";
import { buildDepositSubmitRequest, depositSubmitInputSchema, getTidepoolBaseUrl } from "@/lib/near-intents";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = depositSubmitInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid deposit submission.", details: parsed.error.flatten() }, { status: 400 });
    }

    const response = await fetch(`${getTidepoolBaseUrl()}/v0/deposit/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(buildDepositSubmitRequest(parsed.data)),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json({ error: "Tidepool rejected the deposit submission.", providerResponse: data }, { status: response.status === 404 ? 404 : response.status >= 400 && response.status < 500 ? 422 : 502 });
    }

    return NextResponse.json({ status: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit deposit." }, { status: 503 });
  }
}
