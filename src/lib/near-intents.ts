import { z } from "zod";

export const intentsQuoteInputSchema = z.object({
  originAsset: z.string().trim().min(3).max(256),
  destinationAsset: z.string().trim().min(3).max(256),
  amount: z.string().regex(/^[1-9][0-9]{0,77}$/, "Amount must be a positive integer in the token's smallest unit."),
  refundTo: z.string().trim().min(3).max(256),
  recipient: z.string().trim().min(3).max(256),
  slippageTolerance: z.number().int().min(1).max(500).default(100),
});

export type IntentsQuoteInput = z.infer<typeof intentsQuoteInputSchema>;

export function getTidepoolBaseUrl(): string {
  const configured = process.env.NEAR_INTENTS_API_BASE_URL;
  if (!configured) throw new Error("NEAR_INTENTS_API_BASE_URL is not configured.");

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("NEAR_INTENTS_API_BASE_URL must be a valid HTTPS URL.");
  }

  if (url.protocol !== "https:" || !(url.hostname === "usetidepool.tech" || url.hostname.endsWith(".usetidepool.tech"))) {
    throw new Error("Odudu quote previews are restricted to the Tidepool testnet service.");
  }

  return url.toString().replace(/\/$/, "");
}

export function buildDryQuoteRequest(input: IntentsQuoteInput) {
  return {
    dry: true as const,
    swapType: "EXACT_INPUT" as const,
    slippageTolerance: input.slippageTolerance,
    originAsset: input.originAsset,
    depositType: "INTENTS" as const,
    destinationAsset: input.destinationAsset,
    amount: input.amount,
    refundTo: input.refundTo,
    refundType: "INTENTS" as const,
    recipient: input.recipient,
    recipientType: "INTENTS" as const,
    deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}
