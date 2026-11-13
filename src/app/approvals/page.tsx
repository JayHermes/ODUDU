"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Approval = {
  id: string;
  amount_minor: number | string;
  currency_code: string;
  category: string;
  description: string;
  destination_address: string;
  chain_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  expires_at: string | null;
};

export default function ApprovalsPage() {
  const [items, setItems] = useState<Approval[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const response = await fetch("/api/approvals", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Sign in to review payment approvals.");
    setItems(data.approvals ?? []);
  }

  useEffect(() => { load().catch(err => setError(err.message)); }, []);

  async function decide(approvalId: string, decision: "approved" | "rejected") {
    setBusy(approvalId); setError(""); setNotice("");
    try {
      const response = await fetch("/api/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId, decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update approval.");
      setNotice(decision === "approved" ? "Payment approved. Return to the treasury and re-evaluate the same request before creating a live quote." : "Payment rejected.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update approval.");
    } finally { setBusy(""); }
  }

  return <main className="shell">
    <header className="topbar"><Link className="wordmark" href="/"><span className="mark">O</span> ODUDU</Link><div className="top-meta"><Link href="/" style={{color:"inherit",textDecoration:"none"}}>TREASURY</Link><Link href="/policy" style={{color:"inherit",textDecoration:"none"}}>POLICY</Link><span className="live-dot"/> HUMAN APPROVALS</div></header>
    <section className="hero"><div className="eyebrow">BUSINESS CONTROL / APPROVAL QUEUE</div><h1>Some decisions<br/><em>stay human.</em></h1><p className="hero-copy">Payments above your automatic threshold wait here. Odudu cannot approve its own payment requests.</p></section>
    <section className="workspace">
      <div className="section-heading"><div><div className="eyebrow">01 / REVIEW REQUESTS</div><h2>Payment approvals</h2></div><span className="demo-tag">{items.filter(item=>item.status==="pending").length} PENDING</span></div>
      {error&&<p className="error">{error}</p>}{notice&&<p className="success-note">{notice}</p>}
      <div className="approval-list">{items.map(item=><article className="panel approval-card" key={item.id}>
        <div className="panel-label">{item.chain_id}<span className={"decision "+(item.status==="approved"?"approved":item.status==="rejected"?"rejected":"needs_approval")}>{item.status}</span></div>
        <div className="approval-amount">${(Number(item.amount_minor)/100).toFixed(2)} {item.currency_code}</div>
        <h3>{item.description}</h3><p>{item.category}</p><p className="recipient-address">{item.destination_address}</p>
        <p className="form-note">Requested {new Date(item.created_at).toLocaleString()} · Expires {item.expires_at?new Date(item.expires_at).toLocaleString():"—"}</p>
        {item.status==="pending"&&<div className="field-row"><button className="submit" disabled={busy===item.id} onClick={()=>decide(item.id,"approved")}>APPROVE PAYMENT<span>✓</span></button><button className="submit reject-button" disabled={busy===item.id} onClick={()=>decide(item.id,"rejected")}>REJECT<span>×</span></button></div>}
      </article>)}</div>
      {!items.length&&<div className="panel"><p className="policy-note">No payment approval requests yet.</p></div>}
    </section>
    <footer><span>ODUDU · POLICY-CONTROLLED TREASURY</span><span>TESTNET ONLY · NEVER USE REAL FUNDS</span></footer>
  </main>;
}
