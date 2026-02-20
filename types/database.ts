// types/database.ts
// Auto-generate with: npx supabase gen types typescript > types/database.ts
// Below is the manual version matching our schema.sql

export interface Plan {
  id: string;
  name: string;
  price_cents: number;
  interval: "forever" | "month" | "year";
  search_limit: number | null; // null = unlimited
  stripe_price_id: string | null;
  features: string[];
  is_active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  plan_id: string;
  stripe_customer_id: string | null;
  searches_this_month: number;
  search_month: string;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string;
  status:
    | "active"
    | "canceled"
    | "past_due"
    | "trialing"
    | "incomplete"
    | "incomplete_expired"
    | "unpaid";
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  title: string;
  year: number | null;
  genre: string | null;
  poster_url: string | null;
  score_ten: number | null;
  score_stars: number | null;
  search_key: string;
  created_at: string;
}

export interface SearchLog {
  id: string;
  user_id: string | null;
  query: string;
  source: "cache" | "api";
  ip_address: string | null;
  created_at: string;
}

export interface MovieCache {
  search_key: string;
  data: Record<string, unknown>;
  source: "seed" | "api";
  hit_count: number;
  created_at: string;
  expires_at: string;
}
