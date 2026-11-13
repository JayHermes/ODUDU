"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Event = { id: string; event_type: string; entity_type: string; entity_id: string | null; details: Record<string, unknown>; created_at: string };
type Transaction = { id: string; provider: string; provider_reference: string; tx_hash: string | null; amount_minor: number | string; currency_code: string; chain_id: string; destination_address: string; status: string; created_at: string; updated_at: string };

export default function AuditPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/audit", { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Sign in to view the audit trail.");
      setEvents(data.events ?? []);
      setTransactions(data.transactions ?? []);
    }).catch(err => setError(err.message));
  }, []);

  return <main className="shell">
    <header className="topbar"><Link className="wordmark" href="/"><span className="mark">O</span> ODUDU</Link><div className="top-meta"><Link href="/" style={{color:"inherit",textDecoration:"none"}}>TREASURY</Link><Link href="/approvals" style={{color:"inherit",textDecoration:"none"}}>APPROVALS</Link><span className="live-dot"/> AUDIT TRAIL</div></header>
    <section className="hero"><div className="eyebrow">BUSINESS RECORDS / AUDIT</div><h1>Every decision<br/><em>leaves a record.</em></h1><p className="hero-copy">Payment requests, owner approvals and settlement outcomes are recorded against your business.</p></section>
    <section className="workspace">
      <div className="section-heading"><div><div className="eyebrow">01 / SETTLEMENT HISTORY</div><h2>Transactions</h2></div><a className="demo-tag" href="/api/audit/export">EXPORT CSV ↗</a></div>
      {error&&<p className="error">{error}</p>}
      <div className="audit-list">{transactions.map(item=><article className="panel audit-item" key={item.id}>
        <div className="panel-label">{item.provider} · {item.chain_id}<span className={"decision "+(item.status==="success"?"approved":item.status==="failed"?"rejected":"needs_approval")}>{item.status}</span></div>
        <strong className="audit-amount">{(Number(item.amount_minor)/100).toFixed(2)} {item.currency_code}</strong>
        <p className="recipient-address">{item.destination_address}</p>
        <p className="form-note">{item.tx_hash || item.provider_reference}</p>
        <p className="form-note">{new Date(item.created_at).toLocaleString()}</p>
      </article>)}</div>
      {!transactions.length&&!error&&<div className="panel"><p className="policy-note">No transactions recorded yet.</p></div>}
      <div className="section-heading" style={{marginTop:38}}><div><div className="eyebrow">02 / CONTROL HISTORY</div><h2>Audit events</h2></div><span className="demo-tag">{events.length} RECORDS</span></div>
      <div className="audit-list">{events.map(item=><article className="panel audit-item" key={item.id}>
        <div className="panel-label">{item.entity_type}<span>{new Date(item.created_at).toLocaleString()}</span></div>
        <strong>{item.event_type}</strong>
        <p className="form-note">{JSON.stringify(item.details)}</p>
      </article>)}</div>
      {!events.length&&!error&&<div className="panel"><p className="policy-note">No audit events recorded yet.</p></div>}
    </section>
    <footer><span>ODUDU · POLICY-CONTROLLED TREASURY</span><span>TESTNET ONLY · NEVER USE REAL FUNDS</span></footer>
  </main>;
}
