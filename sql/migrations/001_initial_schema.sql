-- 001_initial_schema.sql
-- Film Glance initial database schema
-- Originally deployed: Feb 20, 2026
-- This file is a reference snapshot — DO NOT re-run on production.

-- Profiles (auto-created on signup via trigger)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    plan_id TEXT NOT NULL DEFAULT 'free',
    searches_this_month INTEGER NOT NULL DEFAULT 0,
    search_month TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscriptions (Stripe integration)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Favorites
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    year INTEGER,
    genre TEXT,
    poster_url TEXT,
    score_ten NUMERIC,
    score_stars NUMERIC,
    search_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, title, year)
);

-- Search log
CREATE TABLE IF NOT EXISTS public.search_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'api',
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Movie cache
CREATE TABLE IF NOT EXISTS public.movie_cache (
    search_key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    source TEXT NOT NULL DEFAULT 'api',
    hit_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_movie_cache_expires ON public.movie_cache(expires_at);

-- RLS policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_cache ENABLE ROW LEVEL SECURITY;
