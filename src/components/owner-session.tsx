"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

type User = { name?: string | null; email?: string | null };

export default function OwnerSession() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) return;
        const data = await response.json();
        setUser(data.user ?? null);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function signOut() {
    await authClient.signOut();
    setUser(null);
    router.refresh();
    router.push("/auth/sign-in");
  }

  if (!loaded) return null;
  if (!user) return <Link href="/auth/sign-in" className="owner-session-link">OWNER SIGN IN</Link>;
  return <span className="owner-session"><span>{user.name || user.email || "OWNER"}</span><button type="button" onClick={signOut}>SIGN OUT</button></span>;
}
