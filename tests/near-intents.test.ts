import { afterEach, describe, expect, it } from "vitest";
import { buildDepositSubmitRequest, buildDryQuoteRequest, buildLiveQuoteRequest, buildStatusPath, getTidepoolBaseUrl, intentsQuoteInputSchema } from "../src/lib/near-intents";

const input = {
  originAsset: "nep141:usdc.near",
  destinationAsset: "nep141:wrap.near",
  amount: "1000000",
  refundTo: "sender.testnet",
  recipient: "recipient.testnet",
};

describe("NEAR Intents quote preview", () => {
  afterEach(() => {
    delete process.env.NEAR_INTENTS_API_BASE_URL;
  });

  it("accepts valid base-unit amounts", () => {
    expect(intentsQuoteInputSchema.safeParse(input).success).toBe(true);
  });

  it("rejects decimal or zero amounts", () => {
    expect(intentsQuoteInputSchema.safeParse({ ...input, amount: "1.5" }).success).toBe(false);
    expect(intentsQuoteInputSchema.safeParse({ ...input, amount: "0" }).success).toBe(false);
  });

  it("always builds a dry quote and never requests a deposit address", () => {
    const request = buildDryQuoteRequest(intentsQuoteInputSchema.parse(input));
    expect(request.dry).toBe(true);
    expect(request.swapType).toBe("EXACT_INPUT");
    expect(request.depositType).toBe("ORIGIN_CHAIN");
    expect(request.refundType).toBe("ORIGIN_CHAIN");
    expect(request.recipientType).toBe("DESTINATION_CHAIN");
  });

  it("builds an explicit live quote without reusing the dry flag", () => {\n    const request = buildLiveQuoteRequest(intentsQuoteInputSchema.parse(input));\n    expect(request.dry).toBe(false);\n    expect(request.depositType).toBe("INTENTS");\n    expect(request.refundType).toBe("INTENTS");\n    expect(request.recipientType).toBe("INTENTS");\n    expect(new Date(request.deadline).getTime()).toBeGreaterThan(Date.now());\n  });\n\n  it("builds deposit submission without dropping optional fields", () => {
    expect(buildDepositSubmitRequest({
      txHash: "abc123",
      depositAddress: "deposit.testnet",
      memo: "42",
      nearSenderAccount: "alice.testnet",
    })).toEqual({
      txHash: "abc123",
      depositAddress: "deposit.testnet",
      memo: "42",
      nearSenderAccount: "alice.testnet",
    });
  });

  it("builds a status path with optional deposit memo", () => {
    expect(buildStatusPath({ depositAddress: "deposit.testnet", depositMemo: "42" }))
      .toBe("/v0/status?depositAddress=deposit.testnet&depositMemo=42");
  });

  it("requires a configured Tidepool HTTPS endpoint", () => {
    expect(() => getTidepoolBaseUrl()).toThrow(/not configured/i);
    process.env.NEAR_INTENTS_API_BASE_URL = "https://1click.chaindefuser.com";
    expect(() => getTidepoolBaseUrl()).toThrow(/restricted to the Tidepool/i);
  });

  it("accepts a Tidepool subdomain over HTTPS", () => {
    process.env.NEAR_INTENTS_API_BASE_URL = "https://api.usetidepool.tech/";
    expect(getTidepoolBaseUrl()).toBe("https://api.usetidepool.tech");
  });
});
