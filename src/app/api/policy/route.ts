import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { getBusinessContext } from "@/lib/db";

export const runtime = "nodejs";

const policySchema = z.object({
  maxPaymentUsd: z.number().positive().max(1_000_000),
  dailyBudgetUsd: z.number().positive().max(10_000_000),
  approvalAboveUsd: z.number().nonnegative().max(1_000_000),
  allowedCategories: z.array(z.enum(["software", "operations", "payroll", "marketing", "other"])).min(1).max(5),
  enabled: z.boolean(),
}).refine(value => value.approvalAboveUsd <= value.maxPaymentUsd, {
  message: "Approval threshold cannot exceed the single-payment limit.",
  path: ["approvalAboveUsd"],
});

export async function GET() {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const context = await getBusinessContext({ id: session.user.id, name: session.user.name });
    return NextResponse.json({
      maxPaymentUsd: context.policy.maxSinglePaymentUsd,
      dailyBudgetUsd: context.policy.dailyBudgetUsd,
      spentTodayUsd: context.policy.spentTodayUsd,
      approvalAboveUsd: context.policy.approvalAboveUsd,
      allowedCategories: context.policy.allowedCategories,
      enabled: context.policyEnabled,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load treasury policy." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const parsed = policySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid treasury policy.", details: parsed.error.flatten() }, { status: 400 });
    const context = await getBusinessContext({ id: session.user.id, name: session.user.name });
    const value = parsed.data;
    const rows = await context.sql`
      UPDATE public.treasury_policies
      SET max_payment_minor = ${Math.round(value.maxPaymentUsd * 100)},
          daily_budget_minor = ${Math.round(value.dailyBudgetUsd * 100)},
          approval_threshold_minor = ${Math.round(value.approvalAboveUsd * 100)},
          allowed_categories = ${value.allowedCategories},
          enabled = ${value.enabled},
          version = version + 1,
          updated_at = now()
      WHERE business_id = ${context.businessId}
      RETURNING version
    `;
    await context.sql`
      INSERT INTO public.treasury_audit_events
        (business_id, actor_user_id, event_type, entity_type, details)
      VALUES (
        ${context.businessId}, ${session.user.id}, 'policy.updated', 'treasury_policy',
        ${JSON.stringify({ ...value, version: rows[0].version })}::jsonb
      )
    `;
    return NextResponse.json({ saved: true, version: rows[0].version });
  } catch {
    return NextResponse.json({ error: "Unable to save treasury policy." }, { status: 503 });
  }
}
