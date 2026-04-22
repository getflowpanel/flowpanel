/** Stub for YuKassa refund call — replace with real `@yookassa/sdk` usage. */
export async function refundUkassaPayment(ukassaId: string | null): Promise<void> {
  if (!ukassaId) throw new Error("payment has no ukassaId");
  // POST https://api.yookassa.ru/v3/refunds …
}
