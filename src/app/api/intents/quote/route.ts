import { NextResponse } from "next/server";
import { buildDryQuoteRequest, getTidepoolBaseUrl, intentsQuoteInputSchema } from "@/lib/near-intents";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = intentsQuoteInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid quote request.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const baseUrl = getTidepoolBaseUrl();
    const quoteRequest = buildDryQuoteRequest(parsed.data);
    const response = await fetch(`${baseUrl}/v0/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(quoteRequest),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(
        { error: "Tidepool rejected the quote request.", providerResponse: data },
        { status: response.status >= 400 && response.status < 500 ? 422 : 502 },
      );
    }

    return NextResponse.json({ mode: "dry-run", quote: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to request a quote.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
