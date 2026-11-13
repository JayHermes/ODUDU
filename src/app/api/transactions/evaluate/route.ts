import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { evaluateBusinessPayment } from "@/lib/db";
import { paymentRequestSchema } from "@/lib/policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in to evaluate a business payment." }, { status: 401 });
    }
    const body: unknown = await request.json();
    const parsed = paymentRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payment request.", details: parsed.error.flatten() }, { status: 400 });
    }
    const result = await evaluateBusinessPayment(
      { id: session.user.id, name: session.user.name },
      parsed.data,
      "key",
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to evaluate payment.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
