import { z } from "zod";

/** Deterministic policy engine. An LLM may propose a payment but cannot edit these rules. */
export const paymentRequestSchema = z.object({
  recipient: z.string().trim().min(3).max(128),
  amountUsd: z.number().finite().positive().max(1_000_000),
  category: z.enum(["software", "operations", "payroll", "marketing", "other"]),
  description: z.string().trim().min(3).max(500),
});
export type PaymentRequest = z.infer<typeof paymentRequestSchema>;
export type Decision = "approved" | "needs_approval" | "rejected";
export type TreasuryPolicy = {
  currency: "USD"; maxSinglePaymentUsd: number; dailyBudgetUsd: number; spentTodayUsd: number;
  approvalAboveUsd: number; allowedRecipients: string[]; allowedCategories: PaymentRequest["category"][];
};

// Demo policy only. Production policy must be owner-controlled, persisted, versioned,
// authenticated and enforced in a separate trusted execution boundary.
export const DEMO_POLICY: Readonly<TreasuryPolicy> = Object.freeze({
  currency: "USD", maxSinglePaymentUsd: 1_000, dailyBudgetUsd: 2_500, spentTodayUsd: 450,
  approvalAboveUsd: 300,
  allowedRecipients: ["vendor-acme", "cloud-hosting", "payroll-provider"],
  allowedCategories: ["software", "operations", "payroll", "marketing"],
});
export type PolicyResult = {
  decision: Decision; reasons: string[];
  policySnapshot: Pick<TreasuryPolicy, "maxSinglePaymentUsd" | "dailyBudgetUsd" | "spentTodayUsd" | "approvalAboveUsd">;
};

export function evaluatePayment(request: PaymentRequest, policy: Readonly<TreasuryPolicy> = DEMO_POLICY): PolicyResult {
  const reasons: string[] = [];
  const remainingToday = Math.max(0, policy.dailyBudgetUsd - policy.spentTodayUsd);
  if (!policy.allowedRecipients.includes(request.recipient)) reasons.push("Recipient is not on the approved recipient list.");
  if (!policy.allowedCategories.includes(request.category)) reasons.push("This spending category is not permitted.");
  if (request.amountUsd > policy.maxSinglePaymentUsd) reasons.push(`Amount exceeds the single-payment limit of $${policy.maxSinglePaymentUsd.toFixed(2)}.`);
  if (request.amountUsd > remainingToday) reasons.push(`Amount exceeds the remaining daily budget of $${remainingToday.toFixed(2)}.`);
  const rejected = reasons.length > 0;
  const needsApproval = !rejected && request.amountUsd > policy.approvalAboveUsd;
  return {
    decision: rejected ? "rejected" : needsApproval ? "needs_approval" : "approved",
    reasons: rejected ? reasons : needsApproval
      ? [`Payment is above the automatic approval threshold of $${policy.approvalAboveUsd.toFixed(2)}. Human approval is required.`]
      : ["Payment is within the configured demo policy."],
    policySnapshot: { maxSinglePaymentUsd: policy.maxSinglePaymentUsd, dailyBudgetUsd: policy.dailyBudgetUsd,
      spentTodayUsd: policy.spentTodayUsd, approvalAboveUsd: policy.approvalAboveUsd },
  };
}
