import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getBusinessContext } from "@/lib/db";
import { buildStatusPath, getTidepoolBaseUrl, statusInputSchema } from "@/lib/near-intents";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const parsed = statusInputSchema.safeParse({
      depositAddress: params.get("depositAddress"),
      depositMemo: params.get("depositMemo") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status request.", details: parsed.error.flatten() }, { status: 400 });
    }

    const context = await getBusinessContext({ id: session.user.id, name: session.user.name });
    const transaction = await context.sql`
      SELECT id FROM public.treasury_transactions
      WHERE business_id = ${context.businessId}
        AND provider_reference = ${parsed.data.depositAddress}
      LIMIT 1
    `;
    if (!transaction.length) return NextResponse.json({ error: "Deposit address is not linked to a transaction in this business." }, { status: 404 });

    const response = await fetch(`${getTidepoolBaseUrl()}${buildStatusPath(parsed.data)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json({ error: "Tidepool could not return settlement status.", providerResponse: data }, { status: response.status === 404 ? 404 : 502 });
    }

    const providerStatus = typeof data === "object" && data !== null && "status" in data
      ? String((data as { status?: unknown }).status)
      : "";
    const finalStatuses: Record<string, "success" | "refunded" | "failed"> = {
      SUCCESS: "success", REFUNDED: "refunded", FAILED: "failed",
    };
    const finalStatus = finalStatuses[providerStatus];
    if (finalStatus) {
      await context.sql`
        UPDATE public.treasury_transactions
        SET status = ${finalStatus}, updated_at = now()
        WHERE id = ${String(transaction[0].id)}
      `;
    } else if (providerStatus === "PROCESSING" || providerStatus === "KNOWN_DEPOSIT_TX") {
      await context.sql`
        UPDATE public.treasury_transactions
        SET status = 'processing', updated_at = now()
        WHERE id = ${String(transaction[0].id)}
      `;
    }
    return NextResponse.json({ status: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check settlement status." }, { status: 503 });
  }
}
