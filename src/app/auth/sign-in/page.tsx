"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message || "Unable to sign in.");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-shell"><form className="auth-card" onSubmit={submit}>
    <Link className="wordmark" href="/"><span className="mark">O</span> ODUDU</Link>
    <div className="eyebrow">OWNER ACCESS</div><h1>Welcome back.</h1>
    <label>Email address<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
    <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
    {error && <p className="error">{error}</p>}
    <button className="submit" disabled={loading}>{loading ? "SIGNING IN…" : "SIGN IN"}<span>↗</span></button>
    <p className="auth-switch">New to Odudu? <Link href="/auth/sign-up">Create an account</Link></p>
  </form></main>;
}
