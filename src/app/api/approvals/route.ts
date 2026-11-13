import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { getBusinessContext } from "@/lib/db";

export const runtime = "nodejs";

const decisionSchema = z.object({
  approvalId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

export async function GET() {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const context = await getBusinessContext({ id: session.user.id, name: session.user.name });
    const approvals = await context.sql`
      SELECT id, amount_minor, currency_code, category, description,
             destination_address, chain_id, status, created_at, expires_at
      FROM public.payment_approvals
      WHERE business_id = ${context.businessId}
        AND status IN ('pending', 'approved', 'rejected')
      ORDER BY created_at DESC
      LIMIT 100
    `;
    return NextResponse.json({ approvals });
  } catch {
    return NextResponse.json({ error: "Unable to load payment approvals." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const parsed = decisionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid approval decision." }, { status: 400 });
    const context = await getBusinessContext({ id: session.user.id, name: session.user.name });
    const rows = await context.sql`
      UPDATE public.payment_approvals
      SET status = ${parsed.data.decision},
          decision_by = ${session.user.id},
          decision_at = now(),
          updated_at = now()
      WHERE id = ${parsed.data.approvalId}
        AND business_id = ${context.businessId}
        AND status = 'pending'
        AND (expires_at IS NULL OR expires_at > now())
      RETURNING id, status
    `;
    if (!rows.length) {
      return NextResponse.json({ error: "Approval was not found, is expired, or has already been decided." }, { status: 409 });
    }
    await context.sql`
      INSERT INTO public.treasury_audit_events
        (business_id, actor_user_id, event_type, entity_type, entity_id, details)
      VALUES (
        ${context.businessId}, ${session.user.id},
        ${parsed.data.decision === "approved" ? "payment.approved" : "payment.rejected"},
        'payment_approval', ${parsed.data.approvalId},
        ${JSON.stringify({ decision: parsed.data.decision })}::jsonb
      )
    `;
    return NextResponse.json({ approval: rows[0] });
  } catch {
    return NextResponse.json({ error: "Unable to update payment approval." }, { status: 503 });
  }
}
