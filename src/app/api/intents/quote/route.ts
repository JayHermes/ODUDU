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

    let liveContext: Awaited<ReturnType<typeof getBusinessContext>> | null = null;
    let livePayment: { amountUsd: number; recipient: string } | null = null;
    const baseUrl = getTidepoolBaseUrl();
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
      const tokenResponse = await fetch(`${baseUrl}/v0/tokens`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!tokenResponse.ok) {
        return NextResponse.json({ error: "Unable to verify the Tidepool origin asset." }, { status: 502 });
      }
      const tokenPayload: unknown = await tokenResponse.json();
      const tokenList = Array.isArray(tokenPayload)
        ? tokenPayload
        : typeof tokenPayload === "object" && tokenPayload !== null && "tokens" in tokenPayload && Array.isArray((tokenPayload as { tokens?: unknown[] }).tokens)
          ? (tokenPayload as { tokens: unknown[] }).tokens
          : [];
      const originToken = tokenList.find((item): item is { assetId?: string; asset_id?: string; symbol?: string; decimals?: number } =>
        typeof item === "object" && item !== null &&
        ((item as { assetId?: string; asset_id?: string }).assetId === parsed.data.originAsset ||
         (item as { assetId?: string; asset_id?: string }).asset_id === parsed.data.originAsset)
      );
      if (!originToken || originToken.symbol?.toUpperCase() !== "USDC" || originToken.decimals !== 6) {
        return NextResponse.json({ error: "Live V1 settlement currently accepts a 6-decimal USDC origin asset only." }, { status: 400 });
      }
      const expectedAmount = (BigInt(Math.round(payment.data.amountUsd * 100)) * 10_000n).toString();
      if (parsed.data.amount !== expectedAmount) {
        return NextResponse.json({ error: "Live quote amount must exactly match the USD payment amount in USDC base units." }, { status: 403 });
      }
      if (payment.data.recipient !== parsed.data.recipient) {
        return NextResponse.json({ error: "Policy recipient must exactly match the Tidepool destination." }, { status: 403 });
      }
      const user = { id: session.user.id, name: session.user.name };
      const context = await getBusinessContext(user);
      liveContext = context;
      livePayment = { amountUsd: payment.data.amountUsd, recipient: payment.data.recipient };
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
    if (mode === "live" && liveContext && livePayment) {
      const responseData = data as { quote?: { depositAddress?: string; deadline?: string } };
      const depositAddress = responseData.quote?.depositAddress;
      const recipient = liveContext.recipients.find(item => item.destination_address === parsed.data.recipient);
      if (!depositAddress || !recipient) {
        return NextResponse.json({ error: "Tidepool quote is missing a deposit address or authorized recipient." }, { status: 502 });
      }
      const saved = await liveContext.sql`
        INSERT INTO public.treasury_transactions
          (business_id, provider, provider_reference, amount_minor, currency_code,
           chain_id, destination_address, status, metadata)
        VALUES (
          ${liveContext.businessId}, 'near_intents', ${depositAddress},
          ${Math.round(livePayment.amountUsd * 100)}, 'USD',
          ${String(recipient.chain_id)}, ${String(recipient.destination_address)},
          'pending', ${JSON.stringify({ recipientKey: recipient.recipient_key, deadline: responseData.quote?.deadline ?? null })}::jsonb
        )
        RETURNING id
      `;
      return NextResponse.json({ mode, quote: data, transactionId: saved[0].id });
    }
    return NextResponse.json({ mode, quote: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to request a quote.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
