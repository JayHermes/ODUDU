import { NextResponse } from "next/server";
import { evaluatePayment, paymentRequestSchema } from "@/lib/policy";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = paymentRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payment request.", details: parsed.error.flatten() }, { status: 400 });
    }
    return NextResponse.json(evaluatePayment(parsed.data));
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
}
