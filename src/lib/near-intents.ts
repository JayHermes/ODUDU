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

export function buildLiveQuoteRequest(input: IntentsQuoteInput) {
  return {
    ...buildDryQuoteRequest(input),
    dry: false as const,
    deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}

export function buildDryQuoteRequest(input: IntentsQuoteInput) {
  return {
    dry: true as const,
    swapType: "EXACT_INPUT" as const,
    slippageTolerance: input.slippageTolerance,
    originAsset: input.originAsset,
    depositType: "ORIGIN_CHAIN" as const,
    destinationAsset: input.destinationAsset,
    amount: input.amount,
    refundTo: input.refundTo,
    refundType: "ORIGIN_CHAIN" as const,
    recipient: input.recipient,
    recipientType: "DESTINATION_CHAIN" as const,
    deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}


export const depositSubmitInputSchema = z.object({
  txHash: z.string().trim().min(1).max(256),
  depositAddress: z.string().trim().min(1).max(256),
  memo: z.string().trim().min(1).max(256).optional(),
  nearSenderAccount: z.string().trim().min(1).max(256).optional(),
});

export const statusInputSchema = z.object({
  depositAddress: z.string().trim().min(1).max(256),
  depositMemo: z.string().trim().min(1).max(256).optional(),
});

export type DepositSubmitInput = z.infer<typeof depositSubmitInputSchema>;
export type StatusInput = z.infer<typeof statusInputSchema>;

export function buildDepositSubmitRequest(input: DepositSubmitInput) {
  return {
    txHash: input.txHash,
    depositAddress: input.depositAddress,
    ...(input.memo ? { memo: input.memo } : {}),
    ...(input.nearSenderAccount ? { nearSenderAccount: input.nearSenderAccount } : {}),
  };
}

export function buildStatusPath(input: StatusInput) {
  const params = new URLSearchParams({ depositAddress: input.depositAddress });
  if (input.depositMemo) params.set("depositMemo", input.depositMemo);
  return `/v0/status?${params.toString()}`;
}
