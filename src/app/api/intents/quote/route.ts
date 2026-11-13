import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { evaluateBusinessPayment, getBusinessContext } from "@/lib/db";
import { paymentRequestSchema } from "@/lib/policy";
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
      return NextResponse.json({ error: "Invalid quote request.", details: parsed.error.flatten() }, { status: 400 });
    }
    const mode = new URL(request.url).searchParams.get("mode") ?? "dry";
    if (mode !== "dry" && mode !== "live") {
      return NextResponse.json({ error: "Invalid quote mode." }, { status: 400 });
    }

    if (mode === "live") {
      const { data: session } = await auth.getSession();
      if (!session?.user) {
        return NextResponse.json({ error: "Sign in before creating a live quote." }, { status: 401 });
      }
      const payment = paymentRequestSchema.safeParse(payload.policyRequest);
      if (!payment.success) {
        return NextResponse.json(
          { error: "A valid payment policy request is required before creating a live quote.", details: payment.error.flatten() },
          { status: 400 },
        );
      }
      if (payment.data.recipient !== parsed.data.recipient) {
        return NextResponse.json({ error: "Policy recipient must exactly match the Tidepool destination." }, { status: 403 });
      }
      const user = { id: session.user.id, name: session.user.name };
      const context = await getBusinessContext(user);
      const refundWallet = context.recipients.find(item => item.recipient_key === "owner-refund");
      if (!refundWallet || refundWallet.destination_address !== parsed.data.refundTo || (parsed.data.originAsset.startsWith("nep141:") && refundWallet.chain_id !== "near:testnet")) {
        return NextResponse.json({ error: "Set and use your business owner-refund wallet before creating a live quote." }, { status: 403 });
      }
      const policy = await evaluateBusinessPayment(user, payment.data, "address");
      if (policy.decision === "rejected") {
        return NextResponse.json({ error: "This payment was rejected by Odudu policy. A live quote has not been created.", policy }, { status: 403 });
      }
      if (policy.decision === "needs_approval") {
        const approvalId = typeof payload.approvalId === "string" ? payload.approvalId : "";
        if (!approvalId) {
          return NextResponse.json({ error: "Human approval is required before a live quote can be created.", policy }, { status: 403 });
        }
        const approved = await context.sql`
          SELECT id
          FROM public.payment_approvals
          WHERE id = ${approvalId}
            AND business_id = ${context.businessId}
            AND status = 'approved'
            AND amount_minor = ${Math.round(payment.data.amountUsd * 100)}
            AND category = ${payment.data.category}
            AND description = ${payment.data.description}
            AND destination_address = ${parsed.data.recipient}
            AND expires_at > now()
          LIMIT 1
        `;
        if (!approved.length) {
          return NextResponse.json({ error: "The matching payment approval is missing, expired, or not approved.", policy }, { status: 403 });
        }
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
