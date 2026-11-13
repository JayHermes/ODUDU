"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Recipient = {
  recipient_key: string;
  display_name: string;
  chain_id: string;
  destination_address: string;
  asset_id?: string | null;
};

export default function RecipientsPage() {
  const [items, setItems] = useState<Recipient[]>([]);
  const [recipientKey, setRecipientKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [chainId, setChainId] = useState("near:testnet");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [assetId, setAssetId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const response = await fetch("/api/recipients", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? (response.status === 401 ? "Sign in to manage recipients." : "Unable to load recipients."));
    setItems(data.recipients ?? []);
  }

  useEffect(() => { load().catch(err => setError(err.message)); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientKey, displayName, chainId, destinationAddress, assetId: assetId || undefined, confirmOwnership: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to authorize recipient.");
      setNotice("Recipient authorized and saved to your business.");
      setRecipientKey(""); setDisplayName(""); setDestinationAddress(""); setAssetId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to authorize recipient.");
    } finally { setLoading(false); }
  }

  return <main className="shell">
    <header className="topbar"><Link className="wordmark" href="/"><span className="mark">O</span> ODUDU</Link><div className="top-meta"><Link href="/" style={{color:"inherit",textDecoration:"none"}}>TREASURY</Link><span className="live-dot"/> RECIPIENT CONTROL</div></header>
    <section className="hero"><div className="eyebrow">BUSINESS SETTINGS / RECIPIENTS</div><h1>Who can<br/><em>Odudu pay?</em></h1><p className="hero-copy">Only destinations you authorize here can pass the recipient policy check. The AI agent cannot add or change recipients.</p></section>
    <section className="workspace">
      <div className="section-heading"><div><div className="eyebrow">01 / AUTHORIZED DESTINATIONS</div><h2>Your recipient list</h2></div><span className="demo-tag">{items.length} ACTIVE</span></div>
      {items.length ? <div className="recipient-cards">{items.map(item=><article className="panel" key={item.recipient_key}><div className="panel-label">{item.chain_id}<span className="decision approved">ACTIVE</span></div><h3>{item.display_name}</h3><p className="recipient-key">{item.recipient_key}</p><p className="recipient-address">{item.destination_address}</p>{item.asset_id&&<p className="recipient-address">Asset: {item.asset_id}</p>}</article>)}</div> : <div className="panel"><p className="policy-note">No recipients have been authorized for this business yet.</p></div>}
      <div className="section-heading" style={{marginTop:34}}><div><div className="eyebrow">02 / ADD DESTINATION</div><h2>Authorize a recipient</h2></div></div>
      <form className="panel form-panel" onSubmit={submit}>
        <div className="field-row"><label>Recipient key<input value={recipientKey} onChange={e=>setRecipientKey(e.target.value)} placeholder="vendor-acme" required/></label><label>Display name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Acme Supplies" required/></label></div>
        <div className="field-row"><label>Network / chain ID<input value={chainId} onChange={e=>setChainId(e.target.value)} placeholder="near:testnet" required/></label><label>Asset ID (optional)<input value={assetId} onChange={e=>setAssetId(e.target.value)} placeholder="nep141:usdc.tidepool-sandbox.testnet"/></label></div>
        <label>Destination address<input value={destinationAddress} onChange={e=>setDestinationAddress(e.target.value)} placeholder="Recipient's verified wallet address" required/></label>
        <label className="authorization-check"><input type="checkbox" required/> I have independently verified this destination and authorize Odudu to use it for payments.</label>
        {error&&<p className="error">{error}</p>}{notice&&<p className="success-note">{notice}</p>}
        <button className="submit" disabled={loading}>{loading?"SAVING…":"AUTHORIZE RECIPIENT"}<span>↗</span></button>
        <p className="form-note">Authorization is recorded in the audit log. Verify addresses carefully; a typo can direct funds to the wrong wallet.</p>
      </form>
    </section>
    <footer><span>ODUDU · POLICY-CONTROLLED TREASURY</span><span>TESTNET ONLY · NEVER USE REAL FUNDS</span></footer>
  </main>;
}
