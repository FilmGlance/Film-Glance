-- 014_cron_failures.sql
--
-- Generic cron-failure log. Keyed by `job` so future scheduled tasks can
-- write here too (not just box-office-refresh). Used by:
--   • inline catch in cron handlers — write a row when something throws
--   • watchdog scheduled agent (post-deploy) — read MAX(retrieved_at) and
--     check whether MAX(occurred_at WHERE resolved_at IS NULL) is escalating
--
-- A successful cron run "resolves" any prior unresolved failures of the same
-- job by setting resolved_at = now(), so a long-lived row with a null
-- resolved_at means the cron is currently broken.

CREATE TABLE IF NOT EXISTS public.cron_failures (
  id BIGSERIAL PRIMARY KEY,
  job text NOT NULL,                    -- e.g. 'box-office-refresh', 'rapidapi-backfill'
  failure_reason text,                  -- short summary; full detail in context.message
  context jsonb,                        -- error message, stack, request URL, period_type, etc.
  occurred_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz               -- backfilled by next successful run of same job
);

-- Watchdog query: "any unresolved failures for this job?"
CREATE INDEX IF NOT EXISTS idx_cron_failures_unresolved
  ON public.cron_failures (job, occurred_at DESC) WHERE resolved_at IS NULL;

ALTER TABLE public.cron_failures ENABLE ROW LEVEL SECURITY;
-- No SELECT policy → service_role only
