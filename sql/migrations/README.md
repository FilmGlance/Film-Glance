# Film Glance — Database Migrations

All database schema changes are tracked here as numbered SQL files.
Run them in order against Supabase SQL Editor when deploying changes.

## How to use

1. Create a new file: `NNN_description.sql` (e.g., `003_add_user_preferences.sql`)
2. Write your SQL migration
3. Run it in Supabase SQL Editor → production database
4. Commit the file to the repo so there's a record

## Migration history

| # | File | Description | Date |
|---|------|-------------|------|
| 001 | `001_initial_schema.sql` | Base schema (profiles, favorites, movie_cache, search_log) | Feb 20, 2026 |
| 002 | `002_add_cached_at.sql` | Add cached_at column to movie_cache | Feb 24, 2026 |

## Rules

- Migrations must be **backward compatible** — never drop columns that live code depends on
- Always use `IF NOT EXISTS` / `IF EXISTS` to make migrations idempotent (safe to re-run)
- Test migrations on staging Supabase project before running on production (when separate DB exists)
