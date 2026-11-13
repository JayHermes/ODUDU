"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

const categories = ["software", "operations", "payroll", "marketing", "other"] as const;

export default function PolicyPage() {
  const [maxPaymentUsd, setMaxPaymentUsd] = useState("1000");
  const [dailyBudgetUsd, setDailyBudgetUsd] = useState("2500");
  const [approvalAboveUsd, setApprovalAboveUsd] = useState("300");
  const [allowedCategories, setAllowedCategories] = useState<string[]>(["software", "operations", "payroll", "marketing"]);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [spentTodayUsd, setSpentTodayUsd] = useState(0);

  useEffect(() => {
    fetch("/api/policy", { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Sign in to manage your policy.");
      setMaxPaymentUsd(String(data.maxPaymentUsd));
      setDailyBudgetUsd(String(data.dailyBudgetUsd));
      setApprovalAboveUsd(String(data.approvalAboveUsd));
      setAllowedCategories(data.allowedCategories ?? []);
      setEnabled(Boolean(data.enabled));
      setSpentTodayUsd(Number(data.spentTodayUsd ?? 0));
    }).catch(err => setError(err.message));
  }, []);

  function toggleCategory(category: string) {
    setAllowedCategories(current => current.includes(category)
      ? current.filter(item => item !== category)
      : [...current, category]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxPaymentUsd: Number(maxPaymentUsd),
          dailyBudgetUsd: Number(dailyBudgetUsd),
          approvalAboveUsd: Number(approvalAboveUsd),
          allowedCategories,
          enabled,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save policy.");
      setNotice(`Policy saved · version ${data.version}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save policy.");
    } finally { setLoading(false); }
  }

  return <main className="shell">
    <header className="topbar"><Link className="wordmark" href="/"><span className="mark">O</span> ODUDU</Link><div className="top-meta"><Link href="/" style={{color:"inherit",textDecoration:"none"}}>TREASURY</Link><Link href="/recipients" style={{color:"inherit",textDecoration:"none"}}>RECIPIENTS</Link><span className="live-dot"/> POLICY CONTROL</div></header>
    <section className="hero"><div className="eyebrow">BUSINESS SETTINGS / POLICY</div><h1>Set the rules.<br/><em>Keep control.</em></h1><p className="hero-copy">These limits are stored in your business database and enforced by Odudu's server-side policy engine. The AI cannot edit them.</p></section>
    <section className="workspace">
      <div className="section-heading"><div><div className="eyebrow">01 / TREASURY LIMITS</div><h2>Payment authority</h2></div><span className="demo-tag">SPENT TODAY: ${spentTodayUsd.toFixed(2)}</span></div>
      <form className="panel form-panel" onSubmit={submit}>
        <div className="field-row"><label>Maximum single payment (USD)<input type="number" min="0.01" step="0.01" value={maxPaymentUsd} onChange={e=>setMaxPaymentUsd(e.target.value)} required/></label><label>Daily budget (USD)<input type="number" min="0.01" step="0.01" value={dailyBudgetUsd} onChange={e=>setDailyBudgetUsd(e.target.value)} required/></label></div>
        <label>Human approval required above (USD)<input type="number" min="0" step="0.01" value={approvalAboveUsd} onChange={e=>setApprovalAboveUsd(e.target.value)} required/></label>
        <div className="category-options"><div className="panel-label">ALLOWED SPENDING CATEGORIES</div>{categories.map(category=><label className="category-option" key={category}><input type="checkbox" checked={allowedCategories.includes(category)} onChange={()=>toggleCategory(category)}/>{category}</label>)}</div>
        <label className="authorization-check"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Policy enforcement enabled</label>
        {error&&<p className="error">{error}</p>}{notice&&<p className="success-note">{notice}</p>}
        <button className="submit" disabled={loading}>{loading?"SAVING POLICY…":"SAVE TREASURY POLICY"}<span>↗</span></button>
        <p className="form-note">Every update increments the policy version and creates an audit event. Payments above the threshold cannot proceed without human approval.</p>
      </form>
    </section>
    <footer><span>ODUDU · POLICY-CONTROLLED TREASURY</span><span>TESTNET ONLY · NEVER USE REAL FUNDS</span></footer>
  </main>;
}
