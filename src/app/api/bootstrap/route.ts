import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getBusinessContext } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const context = await getBusinessContext({ id: session.user.id, name: session.user.name });
    return NextResponse.json({
      recipients: context.recipients,
      policy: {
        maxPaymentUsd: context.policy.maxSinglePaymentUsd,
        dailyBudgetUsd: context.policy.dailyBudgetUsd,
        spentTodayUsd: context.policy.spentTodayUsd,
        approvalAboveUsd: context.policy.approvalAboveUsd,
        enabled: context.policyEnabled,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load business workspace." }, { status: 503 });
  }
}
