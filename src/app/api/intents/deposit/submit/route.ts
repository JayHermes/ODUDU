import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getBusinessContext } from "@/lib/db";
import { buildDepositSubmitRequest, depositSubmitInputSchema, getTidepoolBaseUrl } from "@/lib/near-intents";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const parsed = depositSubmitInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid deposit submission.", details: parsed.error.flatten() }, { status: 400 });
    }

    const context = await getBusinessContext({ id: session.user.id, name: session.user.name });
    const transaction = await context.sql`
      SELECT id FROM public.treasury_transactions
      WHERE business_id = ${context.businessId}
        AND provider_reference = ${parsed.data.depositAddress}
      LIMIT 1
    `;
    if (!transaction.length) return NextResponse.json({ error: "Deposit address is not linked to a transaction in this business." }, { status: 404 });

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

    await context.sql`
      UPDATE public.treasury_transactions
      SET status = 'processing', tx_hash = ${parsed.data.txHash}, updated_at = now()
      WHERE id = ${String(transaction[0].id)}
    `;
    return NextResponse.json({ status: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit deposit." }, { status: 503 });
  }
}
