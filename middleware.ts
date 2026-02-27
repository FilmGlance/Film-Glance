CREATE TABLE IF NOT EXISTS anonymous_searches (
  ip_address TEXT NOT NULL,
  search_date DATE NOT NULL DEFAULT CURRENT_DATE,
  search_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ip_address, search_date)
);

CREATE INDEX IF NOT EXISTS idx_anon_searches_date ON anonymous_searches(search_date);

ALTER TABLE anonymous_searches ENABLE ROW LEVEL SECURITY;

ALTER TABLE search_log ALTER COLUMN user_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION check_anonymous_limit(p_ip TEXT, p_limit INTEGER DEFAULT 15)
RETURNS JSON
LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO anonymous_searches (ip_address, search_date, search_count)
  VALUES (p_ip, CURRENT_DATE, 1)
  ON CONFLICT (ip_address, search_date)
  DO UPDATE SET search_count = anonymous_searches.search_count + 1
  RETURNING search_count INTO v_count;

  RETURN json_build_object(
    'allowed', v_count <= p_limit,
    'searches_used', v_count,
    'daily_limit', p_limit
  );
END;
$$;
