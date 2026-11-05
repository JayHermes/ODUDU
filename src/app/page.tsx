"use client";
import { FormEvent, useState } from "react";
type Evaluation = { decision: "approved" | "needs_approval" | "rejected"; reasons: string[]; policySnapshot: { maxSinglePaymentUsd: number; dailyBudgetUsd: number; spentTodayUsd: number; approvalAboveUsd: number } };
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
export default function Home() {
  const [recipient, setRecipient] = useState("vendor-acme"); const [amount, setAmount] = useState("180");
  const [category, setCategory] = useState("software"); const [description, setDescription] = useState("Monthly software subscription");
  const [result, setResult] = useState<Evaluation | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/transactions/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient, amountUsd: Number(amount), category, description }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unable to evaluate payment."); setResult(data);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setLoading(false); }
  }
  return <main className="shell">
    <header className="topbar"><a className="wordmark" href="#top"><span className="mark">O</span> ODUDU</a><div className="top-meta"><span className="live-dot"/> POLICY ENGINE <span className="version">PROTOTYPE 0.1</span></div></header>
    <section className="hero" id="top"><div className="eyebrow">AUTONOMOUS FINANCIAL INFRASTRUCTURE</div><h1>Give your AI<br/><em>financial agency.</em></h1><p className="hero-copy">Keep financial authority where it belongs. Odudu checks every proposed payment against rules set by the business owner.</p></section>
    <section className="workspace"><div className="section-heading"><div><div className="eyebrow">01 / PAYMENT REQUEST</div><h2>Evaluate a transaction</h2></div><span className="demo-tag">DEMO ENVIRONMENT</span></div>
      <div className="columns"><form className="panel form-panel" onSubmit={submit}>
        <label>Recipient<select value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="vendor-acme">Vendor Acme · approved</option><option value="cloud-hosting">Cloud Hosting · approved</option><option value="payroll-provider">Payroll Provider · approved</option><option value="new-vendor">New Vendor · not approved</option></select></label>
        <div className="field-row"><label>Amount (USD)<input type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required/></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="software">Software</option><option value="operations">Operations</option><option value="payroll">Payroll</option><option value="marketing">Marketing</option><option value="other">Other</option></select></label></div>
        <label>Payment description<input value={description} onChange={e=>setDescription(e.target.value)} minLength={3} maxLength={500} required/></label>
        <button className="submit" type="submit" disabled={loading}>{loading?"CHECKING POLICY…":"CHECK PAYMENT POLICY"}<span>↗</span></button><p className="form-note">This checks policy only. It does not move funds or create a blockchain transaction.</p>{error&&<p className="error">{error}</p>}
      </form><aside className="panel policy-panel"><div className="panel-label">ACTIVE DEMO POLICY <span className="lock">⌑</span></div>
        <div className="policy-stat"><span>Maximum single payment</span><strong>$1,000</strong></div><div className="policy-stat"><span>Daily budget</span><strong>$2,500</strong></div><div className="policy-stat"><span>Already spent today</span><strong>$450</strong></div><div className="policy-stat"><span>Human approval above</span><strong>$300</strong></div><div className="policy-divider"/><div className="panel-label">APPROVED RECIPIENTS</div><div className="recipient-list"><span>vendor-acme</span><span>cloud-hosting</span><span>payroll-provider</span></div><p className="policy-note">Demo values are fixed in server-side code. There is no policy-editing endpoint.</p>
      </aside></div>
      {result&&<section className="result-panel" aria-live="polite"><div className="result-head"><div><div className="eyebrow">02 / POLICY DECISION</div><h2>Evaluation result</h2></div><span className={`decision ${result.decision}`}>{result.decision.replace("_"," ")}</span></div><ul>{result.reasons.map((reason,index)=><li key={index}>{reason}</li>)}</ul><div className="result-foot"><span>Remaining daily budget</span><strong>{money(Math.max(0,result.policySnapshot.dailyBudgetUsd-result.policySnapshot.spentTodayUsd))}</strong></div></section>}
    </section><footer><span>ODUDU / BUILDING FINANCIAL CONTROL FOR AI</span><span>NO FUNDS ARE MOVED IN THIS PROTOTYPE</span></footer>
  </main>;
}
