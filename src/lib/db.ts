import { neon } from "@neondatabase/serverless";
import { evaluatePayment, type PaymentRequest, type TreasuryPolicy } from "@/lib/policy";

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured.");
  return neon(url);
}

export async function getBusinessContext(user: { id: string; name?: string | null }) {
  const sql = database();
  let businesses = await sql`SELECT id FROM public.businesses WHERE owner_user_id = ${user.id} LIMIT 1`;
  if (!businesses.length) {
    businesses = await sql`
      INSERT INTO public.businesses (owner_user_id, name)
      VALUES (${user.id}, ${user.name?.trim() || "My business"})
      RETURNING id
    `;
  }
  const businessId = String(businesses[0].id);
  await sql`
    INSERT INTO public.treasury_policies
      (business_id, allowed_categories)
    VALUES (
      ${businessId},
      ARRAY['software','operations','payroll','marketing']::text[]
    )
    ON CONFLICT (business_id) DO NOTHING
  `;
  const policies = await sql`
    SELECT currency_code, max_payment_minor, daily_budget_minor,
           approval_threshold_minor, allowed_categories, enabled
    FROM public.treasury_policies
    WHERE business_id = ${businessId}
    LIMIT 1
  `;
  const recipients = await sql`
    SELECT recipient_key, display_name, chain_id, destination_address, asset_id
    FROM public.approved_recipients
    WHERE business_id = ${businessId} AND status = 'active'
    ORDER BY display_name
  `;
  const spentRows = await sql`
    SELECT COALESCE(SUM(amount_minor), 0)::bigint AS spent
    FROM public.treasury_transactions
    WHERE business_id = ${businessId}
      AND currency_code = 'USD'
      AND status = 'success'
      AND created_at >= date_trunc('day', now())
  `;
  const row = policies[0];
  const policy: TreasuryPolicy = {
    currency: "USD",
    maxSinglePaymentUsd: Number(row.max_payment_minor) / 100,
    dailyBudgetUsd: Number(row.daily_budget_minor) / 100,
    spentTodayUsd: Number(spentRows[0]?.spent ?? 0) / 100,
    approvalAboveUsd: Number(row.approval_threshold_minor) / 100,
    allowedRecipients: recipients.map((item) => String(item.recipient_key)),
    allowedCategories: row.allowed_categories as PaymentRequest["category"][],
  };
  return { sql, businessId, policy, recipients, policyEnabled: Boolean(row.enabled) };
}

export async function evaluateBusinessPayment(
  user: { id: string; name?: string | null },
  payment: PaymentRequest,
  recipientLookup: "key" | "address" = "key",
) {
  const context = await getBusinessContext(user);
  const matched = context.recipients.find((item) =>
    recipientLookup === "key"
      ? item.recipient_key === payment.recipient
      : item.destination_address === payment.recipient,
  );
  const request = {
    ...payment,
    recipient: matched ? String(matched.recipient_key) : payment.recipient,
  };
  if (!context.policyEnabled) {
    return {
      decision: "rejected" as const,
      reasons: ["Treasury policy is disabled by the business owner."],
      policySnapshot: {
        maxSinglePaymentUsd: context.policy.maxSinglePaymentUsd,
        dailyBudgetUsd: context.policy.dailyBudgetUsd,
        spentTodayUsd: context.policy.spentTodayUsd,
        approvalAboveUsd: context.policy.approvalAboveUsd,
      },
    };
  }
  return evaluatePayment(request, context.policy);
}
