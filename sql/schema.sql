-- ============================================================================
-- FILM GLANCE — SUPABASE/POSTGRESQL SCHEMA
-- Run this in Supabase SQL Editor (supabase.com → project → SQL Editor)
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. PLANS TABLE
--    Static lookup table for billing tiers. Populated via seed data below.
-- ============================================================================
CREATE TABLE public.plans (
    id              TEXT PRIMARY KEY,                    -- 'free', 'pro_monthly', 'pro_annual'
    name            TEXT NOT NULL,                       -- 'Free', 'Pro (Monthly)', 'Pro (Annual)'
    price_cents     INTEGER NOT NULL DEFAULT 0,          -- Price in cents: 0, 500, 3000
    interval        TEXT NOT NULL DEFAULT 'forever',     -- 'forever', 'month', 'year'
    search_limit    INTEGER,                             -- NULL = unlimited, 8 = free tier
    stripe_price_id TEXT,                                -- Stripe Price ID (e.g., 'price_xxx')
    features        JSONB NOT NULL DEFAULT '[]'::JSONB,  -- Feature list for pricing page
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the plans (pricing tiers preserved for future use)
INSERT INTO public.plans (id, name, price_cents, interval, search_limit, features) VALUES
(
    'free',
    'Free',
    0,
    'forever',
    8,
    '["8 searches/month", "All 10 rating sources", "Cast details", "Production & Theatrical Run", "Awards & Accolades", "Watch It Now streaming links"]'::JSONB
),
(
    'unlimited',
    'Unlimited',
    0,
    'forever',
    NULL,
    '["Unlimited searches", "All 10 rating sources", "Cast details", "Production & Theatrical Run", "Awards & Accolades", "Watch It Now streaming links", "Priority refresh", "Export ratings"]'::JSONB
),
(
    'pro_monthly',
    'Pro (Monthly)',
    500,
    'month',
    NULL,
    '["Unlimited searches", "All 10 rating sources", "Cast details", "Production & Theatrical Run", "Awards & Accolades", "Watch It Now streaming links", "Priority refresh", "Export ratings"]'::JSONB
),
(
    'pro_annual',
    'Pro (Annual)',
    3000,
    'year',
    NULL,
    '["Unlimited searches", "All 10 rating sources", "Cast details", "Production & Theatrical Run", "Awards & Accolades", "Watch It Now streaming links", "Priority refresh", "Export ratings", "Save 50% vs monthly"]'::JSONB
);

-- ============================================================================
-- 2. PROFILES TABLE
--    Extends Supabase auth.users with app-specific data.
--    Created automatically when a user signs up via trigger (see below).
-- ============================================================================
CREATE TABLE public.profiles (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email               TEXT NOT NULL,
    display_name        TEXT,
    avatar_url          TEXT,
    plan_id             TEXT NOT NULL DEFAULT 'unlimited' REFERENCES public.plans(id),
    stripe_customer_id  TEXT UNIQUE,                     -- Stripe Customer ID (cus_xxx)
    searches_this_month INTEGER NOT NULL DEFAULT 0,
    search_month        TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM'),  -- '2026-02'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);
CREATE INDEX idx_profiles_plan ON public.profiles(plan_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- ============================================================================
-- 3. SUBSCRIPTIONS TABLE
--    Links users to Stripe subscriptions. Tracks billing lifecycle.
-- ============================================================================
CREATE TABLE public.subscriptions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id                 TEXT NOT NULL REFERENCES public.plans(id),
    stripe_subscription_id  TEXT UNIQUE,                  -- Stripe Subscription ID (sub_xxx)
    stripe_customer_id      TEXT NOT NULL,                 -- Stripe Customer ID (cus_xxx)
    status                  TEXT NOT NULL DEFAULT 'active',-- 'active','canceled','past_due','trialing','incomplete','incomplete_expired','unpaid'
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    cancel_at               TIMESTAMPTZ,                  -- When subscription will cancel
    canceled_at             TIMESTAMPTZ,                  -- When user requested cancellation
    trial_start             TIMESTAMPTZ,
    trial_end               TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe ON public.subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);

-- ============================================================================
-- 4. FAVORITES TABLE
--    Stores user's favorited movies with enough data to render the list.
-- ============================================================================
CREATE TABLE public.favorites (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    year        INTEGER,
    genre       TEXT,
    poster_url  TEXT,
    score_ten   NUMERIC(3,1),                             -- e.g., 8.4
    score_stars NUMERIC(2,1),                             -- e.g., 4.0
    search_key  TEXT NOT NULL,                             -- Lowercase key to re-search
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, title, year)                           -- Prevent duplicate favorites
);

CREATE INDEX idx_favorites_user ON public.favorites(user_id);

-- ============================================================================
-- 5. SEARCH LOG TABLE
--    Tracks every search for analytics and rate-limit enforcement.
-- ============================================================================
CREATE TABLE public.search_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    query       TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'cache',             -- 'cache' or 'api'
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_search_log_user ON public.search_log(user_id);
CREATE INDEX idx_search_log_created ON public.search_log(created_at);

-- ============================================================================
-- 6. MOVIE CACHE TABLE
--    Server-side persistent cache for API results. TTL-based.
-- ============================================================================
CREATE TABLE public.movie_cache (
    search_key  TEXT PRIMARY KEY,                          -- Lowercase search term
    data        JSONB NOT NULL,                            -- Full movie JSON response
    source      TEXT NOT NULL DEFAULT 'api',               -- 'seed' or 'api'
    hit_count   INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX idx_movie_cache_expires ON public.movie_cache(expires_at);

-- ============================================================================
-- 7. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-create profile when user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Reset monthly search counter (call via Supabase CRON or pg_cron)
-- Schedule: 0 0 1 * *  (first of every month at midnight UTC)
CREATE OR REPLACE FUNCTION public.reset_monthly_searches()
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET searches_this_month = 0,
        search_month = TO_CHAR(NOW(), 'YYYY-MM');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment search counter with month rollover
CREATE OR REPLACE FUNCTION public.increment_search(p_user_id UUID)
RETURNS TABLE(searches_used INTEGER, search_limit INTEGER, at_limit BOOLEAN) AS $$
DECLARE
    v_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
    v_searches INTEGER;
    v_limit INTEGER;
BEGIN
    -- Reset if new month
    UPDATE public.profiles
    SET searches_this_month = CASE WHEN search_month != v_month THEN 0 ELSE searches_this_month END,
        search_month = v_month
    WHERE id = p_user_id;

    -- Increment
    UPDATE public.profiles
    SET searches_this_month = searches_this_month + 1
    WHERE id = p_user_id
    RETURNING searches_this_month INTO v_searches;

    -- Get limit from plan
    SELECT p.search_limit INTO v_limit
    FROM public.profiles pr
    JOIN public.plans p ON pr.plan_id = p.id
    WHERE pr.id = p_user_id;

    RETURN QUERY SELECT
        v_searches,
        COALESCE(v_limit, -1),  -- -1 means unlimited
        CASE WHEN v_limit IS NOT NULL AND v_searches > v_limit THEN TRUE ELSE FALSE END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS)
--    Supabase uses RLS to protect data. These policies ensure users
--    can only read/write their own data.
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_cache ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update only their own
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Subscriptions: users can view only their own
CREATE POLICY "Users can view own subscriptions"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Favorites: users can CRUD only their own
CREATE POLICY "Users can view own favorites"
    ON public.favorites FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
    ON public.favorites FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
    ON public.favorites FOR DELETE
    USING (auth.uid() = user_id);

-- Search log: users can view own, system can insert
CREATE POLICY "Users can view own searches"
    ON public.search_log FOR SELECT
    USING (auth.uid() = user_id);

-- Movie cache: readable by all authenticated users
CREATE POLICY "Authenticated users can read cache"
    ON public.movie_cache FOR SELECT
    USING (auth.role() = 'authenticated');

-- Service role can do everything (for API routes and webhooks)
-- This is handled automatically by Supabase service_role key
