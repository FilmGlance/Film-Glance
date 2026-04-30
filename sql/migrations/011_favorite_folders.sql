-- 011_favorite_folders.sql
--
-- Adds folder organization for the Favourites page (v5.10.30).
-- Two changes:
--
-- 1. New table `favorite_folders` — user-created collections (e.g. "Halloween
--    picks", "Watch tonight"). Each folder is owned by a single user and has
--    a name + display position.
--
-- 2. New columns on `favorites`:
--      folder_id  — nullable FK to favorite_folders.id, ON DELETE SET NULL.
--                   When a folder is deleted its movies fall back to the
--                   "Unsorted" view rather than being lost.
--      runtime    — minutes (int). Stored at insert time so the redesigned
--                   card can render the runtime chip without a TMDB roundtrip.
--      director   — text. Same reasoning.
--      overview   — text. Synopsis, used for the trimmed body line on each
--                   card (mirrors the DYM suggestion card layout).
--
-- All new columns are nullable so existing rows continue to work; the
-- redesigned card renders gracefully without runtime/director/overview when
-- they are absent (older favourites added before v5.10.30).

-- ─── 1. favorite_folders table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.favorite_folders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_favorite_folders_user
    ON public.favorite_folders (user_id, position, created_at);

ALTER TABLE public.favorite_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folders"
    ON public.favorite_folders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folders"
    ON public.favorite_folders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders"
    ON public.favorite_folders FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders"
    ON public.favorite_folders FOR DELETE
    USING (auth.uid() = user_id);

-- ─── 2. New columns on favorites ────────────────────────────────────────────
ALTER TABLE public.favorites
    ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.favorite_folders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS runtime   INTEGER,
    ADD COLUMN IF NOT EXISTS director  TEXT,
    ADD COLUMN IF NOT EXISTS overview  TEXT;

CREATE INDEX IF NOT EXISTS idx_favorites_folder
    ON public.favorites (folder_id) WHERE folder_id IS NOT NULL;
