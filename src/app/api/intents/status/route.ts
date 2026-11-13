import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { buildStatusPath, getTidepoolBaseUrl, statusInputSchema } from "@/lib/near-intents";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const parsed = statusInputSchema.safeParse({
      depositAddress: params.get("depositAddress"),
      depositMemo: params.get("depositMemo") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status request.", details: parsed.error.flatten() }, { status: 400 });
    }

    const response = await fetch(`${getTidepoolBaseUrl()}${buildStatusPath(parsed.data)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json({ error: "Tidepool could not return settlement status.", providerResponse: data }, { status: response.status === 404 ? 404 : 502 });
    }

    return NextResponse.json({ status: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check settlement status." }, { status: 503 });
  }
}
