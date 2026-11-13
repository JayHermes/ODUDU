import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { getBusinessContext } from "@/lib/db";

export const runtime = "nodejs";

const recipientSchema = z.object({
  recipientKey: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/),
  displayName: z.string().trim().min(2).max(120),
  chainId: z.string().trim().min(2).max(80),
  destinationAddress: z.string().trim().min(3).max(256),
  assetId: z.string().trim().min(3).max(256).optional(),
  confirmOwnership: z.literal(true),
});

export async function GET() {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const context = await getBusinessContext({ id: session.user.id, name: session.user.name });
    return NextResponse.json({ recipients: context.recipients });
  } catch {
    return NextResponse.json({ error: "Unable to load recipients." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const parsed = recipientSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid recipient.", details: parsed.error.flatten() }, { status: 400 });
    }
    const context = await getBusinessContext({ id: session.user.id, name: session.user.name });
    const item = parsed.data;
    const rows = await context.sql`
      INSERT INTO public.approved_recipients
        (business_id, recipient_key, display_name, chain_id, destination_address, asset_id, status, verified_at)
      VALUES (
        ${context.businessId}, ${item.recipientKey}, ${item.displayName}, ${item.chainId},
        ${item.destinationAddress}, ${item.assetId ?? null}, 'active', now()
      )
      ON CONFLICT (business_id, recipient_key) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        chain_id = EXCLUDED.chain_id,
        destination_address = EXCLUDED.destination_address,
        asset_id = EXCLUDED.asset_id,
        status = 'active',
        verified_at = now(),
        updated_at = now()
      RETURNING id, recipient_key, display_name, chain_id, destination_address, asset_id, status
    `;
    await context.sql`
      INSERT INTO public.treasury_audit_events
        (business_id, actor_user_id, event_type, entity_type, entity_id, details)
      VALUES (
        ${context.businessId}, ${session.user.id}, 'recipient.authorized', 'recipient',
        ${String(rows[0].id)},
        ${JSON.stringify({ recipientKey: item.recipientKey, chainId: item.chainId, destinationAddress: item.destinationAddress })}::jsonb
      )
    `;
    return NextResponse.json({ recipient: rows[0] }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to save recipient." }, { status: 503 });
  }
}
