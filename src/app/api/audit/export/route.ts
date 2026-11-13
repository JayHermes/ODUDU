import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getBusinessContext } from "@/lib/db";

export const runtime = "nodejs";

function csv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

export async function GET() {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const context = await getBusinessContext({ id: session.user.id, name: session.user.name });
    const rows = await context.sql`
      SELECT created_at, amount_minor, currency_code, chain_id,
             destination_address, tx_hash, provider, provider_reference, status
      FROM public.treasury_transactions
      WHERE business_id = ${context.businessId}
      ORDER BY created_at DESC
      LIMIT 5000
    `;
    const header = ["created_at","amount","currency","chain","destination","tx_hash","provider","provider_reference","status"];
    const lines = rows.map(row => [
      row.created_at,
      (Number(row.amount_minor) / 100).toFixed(2),
      row.currency_code,
      row.chain_id,
      row.destination_address,
      row.tx_hash,
      row.provider,
      row.provider_reference,
      row.status,
    ].map(csv).join(","));
    const body = [header.map(csv).join(","), ...lines].join("\r\n");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="odudu-transactions.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to export transactions." }, { status: 503 });
  }
}
