# CLAUDE.md — Film Glance Project Rules

**This file is read automatically by Claude Code at the start of every session. It replaces the "upload bible docs at session start" ritual from the browser workflow.**

---

## Mandatory Session Startup

Before doing anything in this repo, you MUST:

1. **Read `tech-specs.md`** — Start with **Change Log (§10)** at the bottom. The most recent entries describe CURRENT STATE and NEXT STEPS. Read them first, then skim architecture sections for context.
2. **Read `conversation-summary.md`** — Focus on the latest session entry and the "Next Steps (For Next Chat)" block at the bottom.
3. **Read `README.md`** — Workflow rules, standing deliverables, known gotchas, VPS quick reference.
4. **Read `claude-code-transition.md`** — Explains Claude Code-specific workflow, safety rails, emergency procedures.

**If there is a conflict between your training knowledge and what these documents say about Film Glance, the documents are correct.**

After reading, your first message to the user should state: **current project state + last known next steps + readiness to proceed**. This replicates the "onboarding confirmation" from browser sessions.

### Mid-Session Context Refresh

Tool-result contents (file reads, command output) are subject to auto-compaction as the conversation fills. `CLAUDE.md` and memory files auto-re-inject every turn and are always current; **bible-doc reads can get stale**. Before any non-trivial change — code edits touching documented architecture, destructive operations on VPS/DB, version bumps, or any decision that cites a specific doc section — re-read the relevant bible doc section rather than relying on a summary from earlier in the session.

---

## Standing Deliverables — Every Session

After every task or set of tasks:

1. **Update `tech-specs.md` Change Log (§10)** — new row with date, what changed, files affected, spec sections impacted. Update Version History (§9) if a new version is being released.
2. **Append to `conversation-summary.md`** — new entry describing what was done.
3. **Commit both bible doc updates to the repo** — never leave them uncommitted at session end.
4. **Report usage % remaining** — at the end of every response.

**When usage drops to ≤10%, proactively output the three bible docs (README, tech-specs, conversation-summary) regardless of whether asked.** This matches the browser workflow rule.

---

## Hard Rules — Non-Negotiable

### Branching
- **Never push directly to `main`.** All changes → `staging` first → Vercel preview → PR → merge.
- **Never use `git push --force`** without explicit user approval and a clear reason.
- **Never use `git reset --hard`** on a branch that's been pushed to the remote.

### VPS Safety (Hostinger KVM 2, 147.93.113.39)
- **The forum import is RUNNING as of the last session.** Until it completes (3,308/3,308 boards), the VPS is **read-only except for status checks**. No restarts, no config changes, no modifications to `/root/filmboards-crawl/` files.
- Monitoring commands are allowed: `tail`, `cat`, `ps`, `top`, `ls`, `df`, `grep`.
- Write commands (modifications to config, database, import script) require explicit user confirmation.
- Never run destructive SQL (DELETE, DROP, TRUNCATE) without user approval.

### Production App
- **Main app `v5.9.1` is in production and stable.** Don't touch it unless working on a specific production bug.
- Main app changes always go through staging → Vercel preview → PR → merge.

### Anthropic API Credits
- The Feb 27 outage was caused by exhausted API credits. If searches start returning 504, the first check is Anthropic console billing. Enable auto-reload to prevent recurrence.

---

## Workflow Patterns

### Code Changes
1. Verify current branch: `git branch --show-current` (should be `staging`)
2. Pull latest: `git pull origin staging`
3. Edit files directly
4. Show user the diff before committing
5. Commit with message format: `v5.X.Y brief description` or `fix: brief description`
6. Push to `staging`
7. Update bible docs, commit those too
8. When ready for production: `gh pr create --base main --head staging --title "v5.X.Y — summary"` then merge via web (for safety)

### VPS Changes (Post-Import Only)
1. Confirm import is complete: `tail -5 /root/filmboards-crawl/import.log`
2. SSH to VPS: `ssh filmglance@147.93.113.39`
3. For file transfers from GitHub: use the API endpoint (not raw.githubusercontent.com):
   ```
   curl -H "Accept: application/vnd.github.v3.raw" -L -o FILE \
     "https://api.github.com/repos/FilmGlance/Film-Glance/contents/FILE?ref=staging"
   ```
4. For NodeBB restarts: `cd /root/nodebb && ./nodebb stop && ./nodebb build && ./nodebb start`
5. For Nginx config: `nginx -t` (test) before `systemctl reload nginx`

### Commit Message Format
```
v5.9.2 add Discuss link to movie result page
fix: repair stale cache entry for "everything everywhere all at once"
chore: sync staging import_filmboards.py with VPS copy
docs: update tech-specs Change Log
```

### PR Title Format
```
v5.9.2 — Discuss link integration for movie result pages
```

---

## Tech Stack Quick Reference

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 + React 18 |
| AI | Anthropic Claude Haiku 4.5 |
| DB (app) | Supabase PostgreSQL |
| Hosting (app) | Vercel |
| DNS | Cloudflare |
| Forum | NodeBB v3.12.7 |
| DB (forum) | PostgreSQL (local on VPS) |
| Reverse proxy | Nginx |
| SSL | Let's Encrypt (discuss.filmglance.com, expires Jul 5, 2026) |

## Environment Variables

Stored in Vercel (for app) and `.env` on VPS (for forum). Never commit secrets. If a `.env` file needs to be created, add `.env` to `.gitignore` first.

Key env vars (see `tech-specs.md §2.2` for full list):
- `ANTHROPIC_API_KEY`
- `TMDB_API_KEY`, `OMDB_API_KEY`, `TRAKT_CLIENT_ID`, `SIMKL_CLIENT_ID`, `RAPIDAPI_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

---

## Tone / Communication

- Explain unfamiliar commands before running them. The user is new to the terminal.
- When proposing a destructive command (anything that modifies or deletes), describe what it does in plain English first, then wait for approval.
- When writing code, show the diff or the full file first — don't commit blindly.
- Usage % reported at the end of every response, no exceptions.

---

## File Outputs vs. Repo Files

- **Bible docs** (README, tech-specs, conversation-summary, claude-code-transition) live in the repo. Updated by editing directly and committing.
- **Ephemeral outputs** (one-off scripts, test results, analysis dumps) can go in `/tmp` or the user's home directory — do not commit.
- **Transient working files** that shouldn't be committed go in a `scratch/` directory which is in `.gitignore`.

---

*Claude Code reads this file at every session start. Update it when workflow materially changes.*
