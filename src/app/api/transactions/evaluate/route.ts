import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getBusinessContext } from "@/lib/db";
import { evaluatePayment, paymentRequestSchema } from "@/lib/policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in to evaluate a business payment." }, { status: 401 });
    }
    const parsed = paymentRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payment request.", details: parsed.error.flatten() }, { status: 400 });
    }
    const context = await getBusinessContext({ id: session.user.id, name: session.user.name });
    const recipient = context.recipients.find(item => item.recipient_key === parsed.data.recipient);
    const result = evaluatePayment({
      ...parsed.data,
      recipient: recipient ? String(recipient.recipient_key) : parsed.data.recipient,
    }, context.policy);

    if (result.decision !== "needs_approval" || !recipient) {
      return NextResponse.json(result);
    }

    const amountMinor = Math.round(parsed.data.amountUsd * 100);
    const existing = await context.sql`
      SELECT id, status
      FROM public.payment_approvals
      WHERE business_id = ${context.businessId}
        AND recipient_id = ${String(recipient.id)}
        AND amount_minor = ${amountMinor}
        AND category = ${parsed.data.category}
        AND description = ${parsed.data.description}
        AND status IN ('pending', 'approved')
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at DESC
      LIMIT 1
    `;
    let approvalId: string;
    if (existing.length) {
      approvalId = String(existing[0].id);
    } else {
      const created = await context.sql`
        INSERT INTO public.payment_approvals
          (business_id, recipient_id, requested_by, amount_minor, currency_code,
           category, description, destination_address, chain_id, status, expires_at)
        VALUES (
          ${context.businessId}, ${String(recipient.id)}, ${session.user.id},
          ${amountMinor}, 'USD', ${parsed.data.category}, ${parsed.data.description},
          ${String(recipient.destination_address)}, ${String(recipient.chain_id)},
          'pending', now() + interval '24 hours'
        )
        RETURNING id
      `;
      approvalId = String(created[0].id);
      await context.sql`
        INSERT INTO public.treasury_audit_events
          (business_id, actor_user_id, event_type, entity_type, entity_id, details)
        VALUES (
          ${context.businessId}, ${session.user.id}, 'payment.approval_requested',
          'payment_approval', ${approvalId},
          ${JSON.stringify({ amountUsd: parsed.data.amountUsd, recipientKey: parsed.data.recipient, category: parsed.data.category })}::jsonb
        )
      `;
    }
    return NextResponse.json({ ...result, approvalId, approvalStatus: existing[0]?.status ?? "pending" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to evaluate payment.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
