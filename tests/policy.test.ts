import { describe, expect, it } from "vitest";
import { evaluatePayment, type PaymentRequest } from "../src/lib/policy";
const base: PaymentRequest = { recipient:"vendor-acme", amountUsd:180, category:"software", description:"Monthly software subscription" };
describe("Odudu policy engine",()=>{
  it("approves a payment within policy",()=>expect(evaluatePayment(base).decision).toBe("approved"));
  it("requires human approval above the threshold",()=>expect(evaluatePayment({...base,amountUsd:500}).decision).toBe("needs_approval"));
  it("rejects an unapproved recipient",()=>expect(evaluatePayment({...base,recipient:"unknown-vendor"}).decision).toBe("rejected"));
  it("rejects a payment above the single-payment cap",()=>expect(evaluatePayment({...base,amountUsd:1200}).decision).toBe("rejected"));
  it("rejects a payment above remaining daily budget",()=>expect(evaluatePayment({...base,amountUsd:2100}).decision).toBe("rejected"));
  it("rejects categories outside the allowlist",()=>expect(evaluatePayment({...base,category:"other"}).decision).toBe("rejected"));
});
