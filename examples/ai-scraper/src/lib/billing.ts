/** Stub for the Stripe refund call — replace with real `stripe.refunds.create`. */
export async function refundInvoice(stripeId: string | null): Promise<void> {
  if (!stripeId) throw new Error("invoice has no stripeId");
  // await stripe.refunds.create({ charge: stripeId }) …
}
