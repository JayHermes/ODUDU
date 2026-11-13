"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await authClient.signUp.email({ name, email, password });
      if (result.error) throw new Error(result.error.message || "Unable to create account.");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-shell"><form className="auth-card" onSubmit={submit}>
    <Link className="wordmark" href="/"><span className="mark">O</span> ODUDU</Link>
    <div className="eyebrow">BUSINESS OWNER SETUP</div><h1>Create your account.</h1>
    <label>Your name<input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} required /></label>
    <label>Email address<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
    <label>Password<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required /></label>
    {error && <p className="error">{error}</p>}
    <button className="submit" disabled={loading}>{loading ? "CREATING ACCOUNT…" : "CREATE ACCOUNT"}<span>↗</span></button>
    <p className="auth-switch">Already registered? <Link href="/auth/sign-in">Sign in</Link></p>
  </form></main>;
}
