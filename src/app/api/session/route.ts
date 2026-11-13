import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

export async function GET() {
  const { data, error } = await auth.getSession();
  if (error) return NextResponse.json({ error: "Unable to read session." }, { status: 503 });
  return NextResponse.json({ user: data?.user ?? null });
}
