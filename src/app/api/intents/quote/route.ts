import { NextResponse } from "next/server";
import { evaluatePayment, paymentRequestSchema } from "@/lib/policy";
import { buildDryQuoteRequest, buildLiveQuoteRequest, getTidepoolBaseUrl, intentsQuoteInputSchema } from "@/lib/near-intents";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid quote request." }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const parsed = intentsQuoteInputSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid quote request.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const mode = new URL(request.url).searchParams.get("mode") ?? "dry";
    if (mode !== "dry" && mode !== "live") {
      return NextResponse.json({ error: "Invalid quote mode." }, { status: 400 });
    }

    if (mode === "live") {
      const payment = paymentRequestSchema.safeParse(payload.policyRequest);
      if (!payment.success) {
        return NextResponse.json(
          { error: "A valid payment policy request is required before creating a live quote.", details: payment.error.flatten() },
          { status: 400 },
        );
      }

      // The policy identity must be the exact destination sent to Tidepool.
      // A separate vendor label must never authorize a different on-chain account.
      if (payment.data.recipient !== parsed.data.recipient) {
        return NextResponse.json(
          { error: "Policy recipient must exactly match the Tidepool destination." },
          { status: 403 },
        );
      }

      const policy = evaluatePayment(payment.data);
      if (policy.decision !== "approved") {
        return NextResponse.json(
          {
            error: policy.decision === "needs_approval"
              ? "This payment requires human approval. A live quote has not been created."
              : "This payment was rejected by Odudu policy. A live quote has not been created.",
            policy,
          },
          { status: 403 },
        );
      }
    }

    const baseUrl = getTidepoolBaseUrl();
    const quoteRequest = mode === "live" ? buildLiveQuoteRequest(parsed.data) : buildDryQuoteRequest(parsed.data);
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

    return NextResponse.json({ mode, quote: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to request a quote.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
