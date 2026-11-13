"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Evaluation = {
  decision: "approved" | "needs_approval" | "rejected";
  reasons: string[];
  policySnapshot: {
    maxSinglePaymentUsd: number;
    dailyBudgetUsd: number;
    spentTodayUsd: number;
    approvalAboveUsd: number;
  };
};

type Token = { symbol: string; assetId?: string; asset_id?: string; decimals: number; blockchain?: string };
type Quote = {
  quote?: {
    depositAddress?: string;
    amountIn?: string;
    amountInFormatted?: string;
    amountOut?: string;
    amountOutFormatted?: string;
    minAmountOut?: string;
    minAmountOutFormatted?: string;
    fee?: string;
    feeFormatted?: string;
    deadline?: string;
    quoteRequest?: { originAsset?: string; destinationAsset?: string };
  };
  [key: string]: unknown;
};

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export default function Home() {
  const [recipient, setRecipient] = useState("vendor-acme");
  const [amount, setAmount] = useState("180");
  const [category, setCategory] = useState("software");
  const [description, setDescription] = useState("Monthly software subscription");
  const [result, setResult] = useState<Evaluation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [tokens, setTokens] = useState<Token[]>([]);
  const [originAsset, setOriginAsset] = useState("nep141:usdc.tidepool-sandbox.testnet");
  const [destinationAsset, setDestinationAsset] = useState("nep141:wnear.tidepool-sandbox.testnet");
  const [tokenAmount, setTokenAmount] = useState("1000000");
  const [refundTo, setRefundTo] = useState("alice.testnet");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [liveQuote, setLiveQuote] = useState<Quote | null>(null);
  const [txHash, setTxHash] = useState("");
  const [settlementStatus, setSettlementStatus] = useState<unknown>(null);
  const [settlementError, setSettlementError] = useState("");
  const [settlementLoading, setSettlementLoading] = useState(false);

  useEffect(() => {
    fetch("/api/intents/tokens")
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load testnet tokens.");
        setTokens(data.tokens ?? []);
      })
      .catch(err => setQuoteError(err instanceof Error ? err.message : "Unable to load testnet tokens."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/transactions/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient, amountUsd: Number(amount), category, description }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to evaluate payment.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setLoading(false); }
  }

  async function getQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuoteLoading(true); setQuoteError(""); setQuote(null);
    try {
      const response = await fetch("/api/intents/quote?mode=dry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originAsset, destinationAsset, amount: tokenAmount, refundTo, recipient: refundTo, slippageTolerance: 100 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to get Tidepool quote.");
      setQuote(data.quote);
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : "Unable to get quote.");
    } finally { setQuoteLoading(false); }
  }

  async function getLiveQuote() {
    setQuoteLoading(true); setQuoteError(""); setLiveQuote(null);
    try {
      const response = await fetch("/api/intents/quote?mode=live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originAsset, destinationAsset, amount: tokenAmount, refundTo, recipient: refundTo, slippageTolerance: 100 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create live quote.");
      setLiveQuote(data.quote);
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : "Unable to create live quote.");
    } finally { setQuoteLoading(false); }
  }

  async function submitDeposit() {
    const depositAddress = liveQuote?.quote?.depositAddress;
    if (!depositAddress || !txHash.trim()) return;
    setSettlementLoading(true); setSettlementError("");
    try {
      const response = await fetch("/api/intents/deposit/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: txHash.trim(), depositAddress }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to submit deposit.");
      setSettlementStatus(data.status);
      await pollSettlement(depositAddress);
    } catch (err) {
      setSettlementError(err instanceof Error ? err.message : "Unable to submit deposit.");
    } finally { setSettlementLoading(false); }
  }

  async function pollSettlement(depositAddress: string) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await fetch(`/api/intents/status?depositAddress=${encodeURIComponent(depositAddress)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to check settlement status.");
      setSettlementStatus(data.status);
      const current = data.status?.status;
      if (current === "SUCCESS" || current === "REFUNDED" || current === "FAILED") return;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  return <main className="shell">
    <header className="topbar"><a className="wordmark" href="#top"><span className="mark">O</span> ODUDU</a><div className="top-meta"><span className="live-dot"/> POLICY ENGINE <span className="version">PROTOTYPE 0.2</span></div></header>
    <section className="hero" id="top"><div className="eyebrow">AUTONOMOUS FINANCIAL INFRASTRUCTURE</div><h1>Give your AI<br/><em>financial agency.</em></h1><p className="hero-copy">Keep financial authority where it belongs. Odudu checks every proposed payment against rules set by the business owner.</p></section>

    <section className="workspace">
      <div className="section-heading"><div><div className="eyebrow">01 / PAYMENT REQUEST</div><h2>Evaluate a transaction</h2></div><span className="demo-tag">DEMO ENVIRONMENT</span></div>
      <div className="columns">
        <form className="panel form-panel" onSubmit={submit}>
          <label>Recipient<select value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="vendor-acme">Vendor Acme · approved</option><option value="cloud-hosting">Cloud Hosting · approved</option><option value="payroll-provider">Payroll Provider · approved</option><option value="new-vendor">New Vendor · not approved</option></select></label>
          <div className="field-row"><label>Amount (USD)<input type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required/></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="software">Software</option><option value="operations">Operations</option><option value="payroll">Payroll</option><option value="marketing">Marketing</option><option value="other">Other</option></select></label></div>
          <label>Payment description<input value={description} onChange={e=>setDescription(e.target.value)} minLength={3} maxLength={500} required/></label>
          <button className="submit" type="submit" disabled={loading}>{loading?"CHECKING POLICY…":"CHECK PAYMENT POLICY"}<span>↗</span></button>
          <p className="form-note">Policy decision only. This does not move funds.</p>{error&&<p className="error">{error}</p>}
        </form>
        <aside className="panel policy-panel"><div className="panel-label">ACTIVE DEMO POLICY <span className="lock">⌑</span></div>
          <div className="policy-stat"><span>Maximum single payment</span><strong>$1,000</strong></div><div className="policy-stat"><span>Daily budget</span><strong>$2,500</strong></div><div className="policy-stat"><span>Already spent today</span><strong>$450</strong></div><div className="policy-stat"><span>Human approval above</span><strong>$300</strong></div><div className="policy-divider"/><div className="panel-label">APPROVED RECIPIENTS</div><div className="recipient-list"><span>vendor-acme</span><span>cloud-hosting</span><span>payroll-provider</span></div><p className="policy-note">Demo values are fixed in server-side code.</p>
        </aside>
      </div>
      {result&&<section className="result-panel" aria-live="polite"><div className="result-head"><div><div className="eyebrow">02 / POLICY DECISION</div><h2>Evaluation result</h2></div><span className={"decision "+result.decision}>{result.decision.replace("_"," ")}</span></div><ul>{result.reasons.map((reason,index)=><li key={index}>{reason}</li>)}</ul><div className="result-foot"><span>Remaining daily budget</span><strong>{money(Math.max(0,result.policySnapshot.dailyBudgetUsd-result.policySnapshot.spentTodayUsd))}</strong></div></section>}

      <section className="result-panel quote-section">
        <div className="section-heading"><div><div className="eyebrow">03 / NEAR INTENTS</div><h2>Preview a testnet settlement</h2></div><span className="demo-tag">DRY RUN</span></div>
        <form className="form-panel" onSubmit={getQuote}>
          <div className="field-row">
            <label>Origin asset<select value={originAsset} onChange={e=>setOriginAsset(e.target.value)}>{tokens.filter(t=>t.symbol).map(t=><option key={t.assetId??t.asset_id} value={t.assetId??t.asset_id}>{t.symbol} · {t.blockchain??"near"}</option>)}</select></label>
            <label>Destination asset<select value={destinationAsset} onChange={e=>setDestinationAsset(e.target.value)}>{tokens.filter(t=>t.symbol).map(t=><option key={t.assetId??t.asset_id} value={t.assetId??t.asset_id}>{t.symbol} · {t.blockchain??"near"}</option>)}</select></label>
          </div>
          <div className="field-row">
            <label>Amount in base units<input value={tokenAmount} onChange={e=>setTokenAmount(e.target.value)} inputMode="numeric" required/></label>
            <label>Refund / recipient<input value={refundTo} onChange={e=>setRefundTo(e.target.value)} required/></label>
          </div>
          <div className="field-row"><button className="submit" type="submit" disabled={quoteLoading}>{quoteLoading?"REQUESTING QUOTE…":"GET DRY QUOTE"}<span>↗</span></button><button className="submit" type="button" disabled={quoteLoading} onClick={getLiveQuote}>{quoteLoading?"CREATING…":"CREATE LIVE QUOTE"}<span>↗</span></button></div>
          <p className="form-note">Dry quote only prices the swap. Live quote creates a one-time testnet deposit address; no funds move until you deposit.</p>
          {quoteError&&<p className="error">{quoteError}</p>}
        </form>
        {quote&&<div className="quote-card"><div><span>AMOUNT OUT</span><strong>{quote.quote?.amountOutFormatted??quote.quote?.amountOut??"—"}</strong></div><div><span>MINIMUM OUT</span><strong>{quote.quote?.minAmountOutFormatted??quote.quote?.minAmountOut??"—"}</strong></div><div><span>FEE</span><strong>{quote.quote?.feeFormatted??quote.quote?.fee??"—"}</strong></div><div><span>DEADLINE</span><strong>{quote.quote?.deadline??"—"}</strong></div></div>}
        {liveQuote&&<div className="quote-card live-quote"><div><span>DEPOSIT ADDRESS</span><strong>{liveQuote.quote?.depositAddress??"—"}</strong></div><div><span>AMOUNT TO DEPOSIT</span><strong>{liveQuote.quote?.amountInFormatted??liveQuote.quote?.amountIn??"—"}</strong></div><div><span>MINIMUM OUT</span><strong>{liveQuote.quote?.minAmountOutFormatted??liveQuote.quote?.minAmountOut??"—"}</strong></div><div><span>DEADLINE</span><strong>{liveQuote.quote?.deadline??"—"}</strong></div></div>}
        {liveQuote&&<div className="form-panel settlement-panel">
          <div className="eyebrow">04 / TESTNET DEPOSIT</div>
          <label>NEAR transaction hash<input value={txHash} onChange={e=>setTxHash(e.target.value)} placeholder="Paste the testnet transaction hash" /></label>
          <button className="submit" type="button" disabled={settlementLoading || !txHash.trim()} onClick={submitDeposit}>{settlementLoading?"SUBMITTING / POLLING…":"SUBMIT DEPOSIT & TRACK"}<span>↗</span></button>
          <p className="form-note">Send only Tidepool testnet assets to the exact deposit address above. Never use real funds.</p>
          {settlementError&&<p className="error">{settlementError}</p>}
          {settlementStatus !== null && <pre className="status-box">{JSON.stringify(settlementStatus, null, 2)}</pre>}
        </div>}
      </section>
    </section>
    <footer><span>ODUDU / BUILDING FINANCIAL CONTROL FOR AI</span><span>NO FUNDS ARE MOVED IN THIS PROTOTYPE</span></footer>
  </main>;
}
