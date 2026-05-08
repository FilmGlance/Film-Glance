-- Migration 016: denormalize the Film Glance aggregated score (0-10) into
-- `movie_cache.fg_score` so the /discover page can sort/filter 5,702 rows
-- in SQL without recomputing on every request.
--
-- v6.4.0. Idempotent.
--
-- ⚠ SYNC REQUIREMENT: `compute_fg_score()` below is a pure-SQL mirror of
-- `calcScore()` in `lib/score.ts`. If you change the JS algorithm (source
-- normalization, auto-correct rules, rounding), you MUST update this
-- function in lockstep. A divergence will cause the same movie to show
-- different scores on /search (computed live in JS from `data.sources`)
-- vs. /discover (read from this denormalized column). See `lib/score.ts`
-- header comment for the cross-reference.

CREATE OR REPLACE FUNCTION public.compute_fg_score(sources jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  total numeric := 0;
  count_n integer := 0;
  s jsonb;
  score_v numeric;
  max_v numeric;
  pct numeric;
BEGIN
  IF sources IS NULL OR jsonb_typeof(sources) <> 'array' OR jsonb_array_length(sources) = 0 THEN
    RETURN NULL;
  END IF;

  FOR s IN SELECT value FROM jsonb_array_elements(sources)
  LOOP
    BEGIN
      score_v := (s->>'score')::numeric;
      max_v   := (s->>'max')::numeric;
    EXCEPTION WHEN others THEN
      CONTINUE;  -- skip malformed entries
    END;

    IF score_v IS NULL OR max_v IS NULL OR max_v <= 0 OR score_v < 0 THEN
      CONTINUE;
    END IF;

    -- Mirror calcScore: auto-correct mismatched scale (e.g., RT score=92
    -- with max=10 should be treated as max=100).
    IF score_v > max_v THEN
      IF score_v <= 100 AND max_v IN (5, 10) THEN
        max_v := 100;
      ELSE
        score_v := max_v;
      END IF;
    END IF;

    -- Normalize to 0-100 percentage.
    pct := CASE
      WHEN max_v = 100 THEN score_v
      WHEN max_v = 10  THEN score_v * 10
      WHEN max_v = 5   THEN score_v * 20
      ELSE (score_v / max_v) * 100
    END;

    -- Clamp 0-100.
    pct := LEAST(100, GREATEST(0, pct));

    total := total + pct;
    count_n := count_n + 1;
  END LOOP;

  IF count_n = 0 THEN
    RETURN NULL;
  END IF;

  -- Match calcScore: ten = min(10, round(mean/10 * 10) / 10) — i.e.,
  -- mean/10 rounded to 1 decimal, capped at 10.
  RETURN LEAST(10, ROUND(total / count_n / 10, 1));
END;
$$;

-- Add the column. Nullable when sources is missing/empty.
ALTER TABLE public.movie_cache
  ADD COLUMN IF NOT EXISTS fg_score NUMERIC(3, 1);

-- Trigger keeps the column in sync with `data.sources` on every write.
CREATE OR REPLACE FUNCTION public.movie_cache_set_fg_score()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.fg_score := compute_fg_score(NEW.data->'sources');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS movie_cache_fg_score_trg ON public.movie_cache;
CREATE TRIGGER movie_cache_fg_score_trg
  BEFORE INSERT OR UPDATE OF data ON public.movie_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.movie_cache_set_fg_score();

-- Initial backfill for existing rows.
UPDATE public.movie_cache
SET fg_score = compute_fg_score(data->'sources');

-- Indexes for /discover hot path.
CREATE INDEX IF NOT EXISTS idx_movie_cache_fg_score
  ON public.movie_cache (fg_score DESC NULLS LAST)
  WHERE fg_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movie_cache_discover
  ON public.movie_cache (release_window, fg_score DESC NULLS LAST)
  WHERE fg_score IS NOT NULL;
