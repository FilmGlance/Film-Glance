import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_placeholder", {
  typescript: true,
});

// Dormant — preserved for future pricing reactivation
export const priceIdToPlan: Record<string, string> = {
  // "price_xxx": "pro_monthly",
  // "price_yyy": "pro_annual",
};
