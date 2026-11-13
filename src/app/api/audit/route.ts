import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getBusinessContext } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const context = await getBusinessContext({ id: session.user.id, name: session.user.name });
    const [events, transactions] = await Promise.all([
      context.sql`
        SELECT id, actor_user_id, event_type, entity_type, entity_id, details, created_at
        FROM public.treasury_audit_events
        WHERE business_id = ${context.businessId}
        ORDER BY created_at DESC
        LIMIT 100
      `,
      context.sql`
        SELECT id, provider, provider_reference, tx_hash, amount_minor, currency_code,
               chain_id, destination_address, status, created_at, updated_at
        FROM public.treasury_transactions
        WHERE business_id = ${context.businessId}
        ORDER BY created_at DESC
        LIMIT 100
      `,
    ]);
    return NextResponse.json({ events, transactions });
  } catch {
    return NextResponse.json({ error: "Unable to load treasury audit history." }, { status: 503 });
  }
}
