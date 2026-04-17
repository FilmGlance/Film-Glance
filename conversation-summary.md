# Film Glance — Conversation Summary

## Session: April 17, 2026 (continued) — Vercel + Supabase CLI Setup, .gitignore Baseline

### Overview

Completion of deferred Phase 7 work from the earlier Apr 17 transition session. Installed and authenticated Vercel CLI and Supabase CLI, pulled production env vars locally, and created the repo's first-ever `.gitignore`. Verified Claude Opus 4.7 (1M context) as the active model.

### Workstream 1: Vercel CLI

- Installed via `npm install -g vercel` (Vercel CLI 51.6.1, 310 transitive packages, ~48s).
- Logged in via `vercel login` — new unified device-code OAuth flow (the old `--github` flag is deprecated). Device code `KGQF-XSGT` approved in browser.
- Linked folder via `vercel link --yes` — auto-detected project from git remote. Linked to `rs-projects-c0025ef0/film-glance`. Created `.vercel/project.json` (gitignored).
- Pulled env vars via `vercel env pull .env.local` — 13 keys: `ANTHROPIC_API_KEY`, `TMDB_API_KEY`, `OMDB_API_KEY`, `RAPIDAPI_KEY`, `TRAKT_CLIENT_ID`, `SIMKL_CLIENT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `VERCEL_OIDC_TOKEN`, `YOUTUBE_API_KEY`.
- Note: `YOUTUBE_API_KEY` is dead code since v5.6 (Mar 3, 2026) per tech-specs §10. Candidate for deletion from Vercel dashboard — zero impact either way.

### Workstream 2: .gitignore Baseline (First Ever)

Repo had no `.gitignore` in its entire history — browser-only workflow never generated local files, so one was never needed. Became critical once Claude Code started writing `.vercel/`, `.env.local`, and `supabase/.temp/` into the working tree.

Initial file covers:
- Next.js defaults: `node_modules/`, `.next/`, `.env*` variants
- Vercel CLI state: `.vercel`
- TypeScript: `*.tsbuildinfo`, `next-env.d.ts`
- Python: `__pycache__`, `.venv/`, `venv/` (for import scripts)
- Claude Code: `.claude/settings.local.json` only — `settings.json` IS committed (shared project config like plugin enables)
- Supabase CLI: `supabase/.branches`, `supabase/.temp`, `supabase/.env`
- Editor/IDE and OS junk

Vercel CLI auto-appended duplicate `.vercel` and `.env*.local` lines during `vercel link` and `vercel env pull`. Cleaned up — existing entries already covered both.

Committed as `chore: add Next.js .gitignore + Claude Code project settings` (commit e61f641, includes `.claude/settings.json` enabling the `vercel@claude-plugins-official` plugin).

### Workstream 3: Supabase CLI

Supabase explicitly deprecated `npm install -g supabase` in CLI 2.x. Three supported Windows methods: Scoop (requires installing Scoop first), npx (on-demand), npm dev-dependency (per-project).

User chose **npx**. Usage pattern: `npx supabase <command>` for all Supabase CLI work. First-run downloads CLI 2.92.1 (~30s), cached afterward. Trade-off vs. Scoop: must type `npx supabase` instead of `supabase`, but no extra package manager to install.

Generated Supabase Personal Access Token `film-glance-claude-code` with **1-year expiry (April 17, 2027)**. Stored in `.env.local` as `SUPABASE_ACCESS_TOKEN=...`. **Rotation needed before expiry date** or all Supabase CLI commands will fail with "invalid token."

Linking initially failed with "Cannot use automatic login flow inside non-TTY environments" — Supabase CLI requires a TTY for interactive browser login, which Claude Code's Bash tool doesn't provide. Workaround: use PAT + `--project-ref` flag directly. `npx supabase link --project-ref inrwjuwyfaqanyegycwr` succeeded. Verified via `npx supabase projects list` showing green ● LINKED indicator next to FilmGlance.

### Workstream 4: Model Verification

Claude Opus 4.7 (1M context) confirmed active via `/model` slash command. Model ID: `claude-opus-4-7[1m]`. The `[1m]` denotes 1-million-token context window.

### Key Learnings

1. **Vercel CLI's `--github` flag is deprecated** — new unified device-code OAuth flow works for all providers. Don't pass `--github`/`--gitlab`/etc.
2. **`vercel link --yes` auto-detects the project from the git remote** — no manual project name needed when the Vercel project was created from a GitHub import.
3. **Supabase `npm install -g supabase` is explicitly deprecated.** Current supported Windows methods: Scoop, npx, or npm dev-dependency.
4. **Supabase CLI needs a TTY for `supabase login`** — interactive browser flow fails in Claude Code's Bash tool. Use a PAT instead: generate one from dashboard, store in `SUPABASE_ACCESS_TOKEN`, done.
5. **Vercel CLI aggressively auto-edits .gitignore** on both `link` and `env pull` — appends entries even if they're duplicates. Benign, but worth de-duping for cleanliness.
6. **Claude Code's `settings.json` vs `settings.local.json`** — `.claude/settings.json` is shared project config (commit it), `.claude/settings.local.json` is per-machine (gitignore it).
7. **Supabase local folder structure** — `supabase/.temp/`, `supabase/.branches/`, `supabase/.env` are local-only state. `supabase/migrations/`, `supabase/functions/`, `supabase/config.toml` (none exist yet) are project code that SHOULD be committed.

### Files Created This Session

| File | Purpose | Status |
|------|---------|--------|
| `.gitignore` | Next.js + Python + Claude Code + Supabase + OS junk exclusions | Committed to staging (e61f641) |
| `.claude/settings.json` | Enables `vercel@claude-plugins-official` | Committed to staging (e61f641) |
| `.env.local` | 14 env vars (13 Vercel-pulled + 1 Supabase PAT) | Gitignored, never tracked |
| `.vercel/project.json` | Vercel project linkage | Gitignored |
| `supabase/.temp/*` | Supabase CLI local state (project-ref, versions, pooler URL) | Gitignored |

### Next Steps (For Next Chat)

Workflow unchanged from prior Apr 17 entry, but all CLI setup now complete:

1. Monitor forum import progress — `ssh filmglance@147.93.113.39 "sudo tail -5 /root/filmboards-crawl/import.log"`
2. Continue waiting for import completion (~5-8 more days from Apr 17)
3. Post-import queue unchanged: GDPR consent removal, mobile testing, full API health check, Discuss links on movie result pages, staging branch cleanup, mobile app conversion (Capacitor, Phase 2)
4. **Rotate Supabase PAT before April 17, 2027** — set calendar reminder
5. Consider deleting `YOUTUBE_API_KEY` from Vercel env vars — dead since v5.6

---

## Session: April 17, 2026 — Claude Code Transition (Windows / PowerShell)

### Overview

Full migration from Claude.ai browser chat workflow to Claude Code terminal on Windows (PowerShell). User has no prior coding experience and had never used the terminal before; transition executed successfully in a single session via checkpoint-gated installation playbook.

### Workstream 1: Pre-Flight Planning

User wanted aggressive full-setup in one session with immediate cutover. Initial plan was WSL-based (standard Claude Code recommendation). After discussion around user preference for Windows UI and minimizing learning curve, pivoted to PowerShell-native setup. Rewrote installation playbook for Windows 10/11 + PowerShell + Git for Windows.

### Workstream 2: Installation (Phases 1-3)

- Git for Windows installed via official installer (git-scm.com)
- Node.js 20 LTS installed via nodejs.org MSI
- Claude Code 2.1.108 installed via `npm install -g @anthropic-ai/claude-code`
- GitHub CLI 2.89.0 installed via `winget install --id GitHub.cli` (first attempt silently failed due to un-accepted msstore terms; retried successfully after terms accepted)
- Claude Code authenticated via browser flow to Anthropic account

### Workstream 3: Repo Setup (Phase 4)

- Git identity configured: `FilmGlance` / `roddey.harb@gmail.com`
- GitHub CLI authenticated as FilmGlance via HTTPS browser flow
- Desktop folder renamed from `Film Glance Terminal` → `Film-Glance-Terminal` (no spaces — dev folder convention)
- Repo cloned into `Desktop\Film-Glance-Terminal\Film-Glance\` (two-folder structure preserves existing backups alongside live repo)
- Checked out staging branch cleanly — 22 commits ahead of main, 16 commits behind, clean working tree

### Workstream 4: GitHub Push Verification (Phase 5)

Successfully created test commit → pushed to staging → verified on GitHub.com → reverted with second commit. End-to-end write access confirmed. 192 → 193 commits on staging. Vercel preview deploy triggered automatically by staging push (confirms full CI chain intact).

### Workstream 5: VPS SSH Configuration (Phase 6) — The Long One

The hardest phase by far. Several layers of Windows SSH gotchas stacked.

**Initial setup:**
- Generated ed25519 key pair on Windows (`ssh-keygen -t ed25519`)
- Copied public key to VPS `/root/.ssh/authorized_keys`
- SSH test failed with password fallback

**Debug iteration 1:** Windows OpenSSH verbose output showed `Server accepts key` but then fell back to password. Initially suspected mangled paste on VPS — compared both sides byte-by-byte, confirmed identical.

**Debug iteration 2:** Checked Windows private key file ACL via `icacls`. Found `BUILTIN\Administrators:(F)` and `NT AUTHORITY\SYSTEM:(F)` both present — Windows default inheritance. OpenSSH-on-Windows silently refuses keys with overly-open ACLs. Fixed via `icacls /reset` + `/inheritance:r` + `/grant:r "${env:USERNAME}:(R)"`. Verified only user had access.

**Debug iteration 3:** SSH still failed with password prompt after permissions fix. Ran `grep PermitRootLogin /etc/ssh/sshd_config` on VPS — revealed **`PermitRootLogin no`** (Hostinger default). Root SSH fundamentally blocked regardless of keys. Hostinger browser terminal works because it's already running as root.

**Resolution:** Created non-root user `filmglance` on VPS, added to sudo group, copied authorized_keys from `/root/.ssh/` to `/home/filmglance/.ssh/`, set ownership. SSH from PowerShell as `filmglance@147.93.113.39` now works cleanly — no password prompt. Permission-denied on `/root/`-owned files is expected and correct; use `sudo` for privileged commands.

### Workstream 6: Bible Docs Migration

All 5 bible docs copied from Desktop to repo root:
- `README.md`
- `tech-specs.md`
- `conversation-summary.md`
- `CLAUDE.md` (NEW — auto-read by Claude Code every session, replaces "upload bible at session start" ritual)
- `claude-code-transition.md` (NEW — workflow/safety/emergency procedures doc)

Committed to staging branch. `installation-playbook.md` remains at Desktop level as reference-only (not in repo — Windows-specific, one-time-use document).

### Key Learnings

1. **PermitRootLogin defaults to `no` on Hostinger VPS** — root SSH is blocked by default. Always create a non-root sudo user for SSH.
2. **Windows OpenSSH is strict about private key ACLs** — defaults include Administrators + SYSTEM groups, which SSH silently rejects. Must `icacls /inheritance:r` + `/grant:r "user:(R)"` on first setup.
3. **The "Server accepts key" verbose message is misleading** — it only means "your public key matches an entry in authorized_keys," not "authentication succeeded." Signature verification can still fail after this message.
4. **`winget install` silently fails on first use** if msstore terms haven't been accepted. Run `winget list` once to trigger the terms prompt before relying on `winget install`.
5. **PATH updates don't propagate to existing PowerShell windows** — close and reopen after any installer that modifies PATH.
6. **Silent success is normal in terminal workflows** — `git push`, `chmod`, `chown` all return nothing on success. No news = good news. Red = problem.
7. **`git rm` vs `rm` distinction matters** — `git rm` removes from both disk AND git tracking; `rm` only removes from disk. Using `rm` on a git-tracked file leaves an untracked deletion.

### New Project Workflow (Effective Immediately)

**Session startup:**
```
cd ~\Desktop\Film-Glance-Terminal\Film-Glance
git pull origin staging
claude
```

**First message to Claude Code:**
*"Read the bible docs and give me current state + next steps."*

`CLAUDE.md` in the repo root handles the rest — Claude Code reads it automatically.

**VPS access:**
```
ssh filmglance@147.93.113.39 "<command>"
```
Add `sudo` for root-privileged commands. Hostinger browser terminal remains as emergency fallback.

### Active Issues / Known Limitations

- Vercel and Supabase CLI installation deferred (not strictly required for Phase 9 shakedown)
- `installation-playbook.md` is Windows/PowerShell-specific; if user ever rebuilds PC or adds second machine, this is the doc to follow
- Forum import still running on VPS — next session should verify progress first thing

### Next Steps (For Next Chat)

This is the last session in Claude.ai browser chat. All future sessions happen in Claude Code terminal.

1. **Launch Claude Code** from repo folder, ask for bible doc read + current state
2. **Check forum import progress** via `ssh filmglance@147.93.113.39 "sudo tail -5 /root/filmboards-crawl/import.log"`
3. **Continue waiting for import completion** — still estimated ~7-10 days from Apr 16
4. All other next-steps from Apr 16 session still apply (GDPR removal, mobile testing, API health check, Discuss links, staging cleanup, mobile app conversion)

---

## Session: April 10-16, 2026 — Forum Import Dedup Logic + Full Import Launch

### Workstream 1: v5 Import Script — Deduplication Design & Implementation

**Goal:** Before launching the full import, clean up duplicate threads caused by users repeatedly posting the same content on the original FilmBoards site.

**Final dedup strategy (after user refinement):**
- Threads grouped by normalized title (case-insensitive, punctuation-stripped)
- For groups with duplicates, first-post content compared via Jaccard word similarity (70% threshold)
- **TRUE DUPLICATES** (same title + similar content) → keep thread with most posts, remove the rest
- **SAME TITLE, DIFFERENT CONTENT** (unique discussions) → MERGE all posts into ONE thread. Longest thread is the base; other threads' posts appended as additional replies. No renaming with suffixes.
- **Critical constraint:** Dedup logic is import-only. After import completes, NodeBB operates normally — users can create threads with any title, even duplicates. No groupings continue past the initial import.

**Implementation iterations:**
- v5 (first version): Same-title, different-content → append " (2)", " (3)" suffixes
- v5 (refined per user request): Same-title, different-content → MERGE posts into a single combined thread
- All 8 unit tests passed on the final logic

**New features in v5:**
- `--analyze` flag: scans all boards, reports duplicate stats, saves `/root/filmboards-crawl/dedup_analysis.json`, no importing
- Stats tracked in import_state.json: `skipped_duplicate`, `merged_same_title`
- Backward-compatible with v4 state (auto-adds new stats fields)

### Workstream 2: Analyze Results (April 11)

Ran `python3 import_filmboards.py --analyze` on all 3,308 boards:

- **Boards scanned:** 3,308
- **Boards with duplicates:** 2,561 (77.4%)
- **Total threads (before):** 309,201
- **Total threads (after):** 263,021
- **True duplicates removed:** 43,625 (14.1% of all data was copy-paste junk)
- **Same-title merged:** 2,555 (unique discussions folded into parent threads)

Top offenders: Film and Television Discussion (2,379 dupes), Everything Else (2,570 dupes), The Soapbox (2,202 dupes), General Discussion (2,207 dupes).

### Workstream 3: GitHub CDN Cache Workaround

**Problem:** `wget` from `raw.githubusercontent.com` was consistently pulling the old v4 file (11K bytes) even after the v5 script was pushed to staging. GitHub's raw CDN cache can persist for several minutes after a push.

**Solution:** Use the GitHub API endpoint directly to bypass CDN caching:
```
curl -H "Accept: application/vnd.github.v3.raw" -L -o /root/filmboards-crawl/import_filmboards.py "https://api.github.com/repos/FilmGlance/Film-Glance/contents/import_filmboards.py?ref=staging"
```
Confirmed working — pulled the correct 25K v5 file on first try. This pattern should be used for all future VPS file transfers.

### Workstream 4: NodeBB `/discuss` Base Path Discovery

**Critical discovery:** NodeBB's config.json was set to `https://filmglance.com/discuss` during the April 7 session. As a result, all API calls MUST use `http://127.0.0.1:4567/discuss` as the base URL. Calls to `http://127.0.0.1:4567` (without `/discuss`) return a 307 redirect that breaks scripts.

Initial cleanup script and import script both had the wrong URL. Fixed via sed on the VPS:
```
sed -i 's|http://127.0.0.1:4567|http://127.0.0.1:4567/discuss|' /root/filmboards-crawl/cleanup_test_data.py
sed -i 's|http://127.0.0.1:4567"|http://127.0.0.1:4567/discuss"|' /root/filmboards-crawl/import_filmboards.py
```

The v5 import script in `/home/claude/import_filmboards.py` has the correct URL. The staging branch copy may need updating to match.

### Workstream 5: Test Data Cleanup via PostgreSQL

The v4 test run (738 topics, 3,820 replies in The IMDb Archives) needed to be purged before launching the full import. Python cleanup script failed due to paste issues and URL redirects, so cleanup was done directly via PostgreSQL:

```sql
DELETE FROM "legacy_hash" WHERE "_key" LIKE 'post:%' AND "data"->>'tid' IN (SELECT regexp_replace("_key", 'topic:', '') FROM "legacy_hash" WHERE "_key" LIKE 'topic:%' AND "data"->>'cid' = '25');
DELETE FROM "legacy_hash" WHERE "_key" LIKE 'topic:%' AND "data"->>'cid' = '25';
DELETE FROM "legacy_zset" WHERE "_key" LIKE 'cid:25:%';
UPDATE "legacy_hash" SET "data" = jsonb_set(jsonb_set("data", '{topic_count}', '0'), '{post_count}', '0') WHERE "_key" = 'category:25';
```

Results: 0 posts deleted (different key format), 738 topics deleted, 14,283 sorted set entries deleted, category counter reset to 0.

Then rebuilt NodeBB and reset import state:
```
cd /root/nodebb && ./nodebb stop && ./nodebb build && ./nodebb start
rm -f /root/filmboards-crawl/import_state.json
```

### Workstream 6: Full Import Launch + CPU Throttling

**Launch:** Full import kicked off April 11 at 04:03 UTC via `nohup`. Initial settings: `REQUEST_DELAY = 0.1s`.

**First optimization (April 11):** Reduced delay to 0.02s to speed up. Sped up considerably but triggered Hostinger CPU throttling (94% CPU usage). Throttling slows everything to a crawl, nullifying the speed gain.

**Second adjustment (April 12):** Bumped delay to 0.05s. Still caused intermittent CPU throttling.

**Third adjustment (April 16):** Bumped delay to 0.15s. This is the sweet spot — keeps CPU around 50-60%, avoids throttling, and still completes in a reasonable timeframe.

**Import progress (as of April 16, 2026):**
- Boards done: **450 / 3,308** (13.6%)
- Topics created: **99,308**
- Replies created: **852,777**
- Duplicates removed: **24,911**
- Same-title merged: **1,850**
- Errors: **0**

**Estimated completion:** ~7-10 more days at 0.15s delay. The biggest boards (Everything Else, Politics, Soapbox, etc.) are already done. Remaining 2,858 boards are mostly small movie boards (most have < 200 threads), so board count will climb fast from here.

### Workstream 7: Claude Code Discussion

User asked about migrating to Claude Code terminal for future sessions. Recommendation: wait until import finishes, then transition for follow-up work. Major benefits of Claude Code:
- Direct GitHub commits (no browser paste workflow)
- SSH access to VPS directly
- Local `npm run build` verification
- Full codebase grep/search instantly

Potential hiccups:
- Requires Node.js 18+ locally (WSL on Windows)
- Context lives in repo files (CLAUDE.md), not uploaded per-session
- Cost structure differs (API tokens vs flat subscription)

### Files Created/Modified This Session

| File | Purpose | Location |
|------|---------|----------|
| `import_filmboards.py` | v5 with dedup + merge + `--analyze` flag | Staging branch + VPS `/root/filmboards-crawl/` |
| `cleanup_test_data.py` | Small helper script for purging bot-created topics (not used in final cleanup — SQL used instead) | Staging branch (can be deleted) |

### Key Learnings

- **GitHub CDN caching on raw.githubusercontent.com** — always use GitHub API endpoint for VPS file transfers: `https://api.github.com/repos/OWNER/REPO/contents/FILE?ref=BRANCH`
- **NodeBB `/discuss` prefix mandatory** — every API call must include it, or NodeBB returns 307 redirect
- **Master API token attributes posts to UID 1, not BOT_UID** — `_uid` parameter ignored by NodeBB when using master token
- **Hostinger CPU throttling** — sweet spot for import on KVM 2 is REQUEST_DELAY = 0.15s
- **Hostinger browser terminal paste issues** — scripts over ~50 lines freeze the terminal. Always use GitHub staging as intermediary.
- **NodeBB `legacy_hash` column is `_key` not `key`** — constant source of SQL errors
- **CPU cores don't help NodeBB much** — it's single-threaded Node.js. KVM 4/8 upgrades would only shave 2-3 days off import, not worth the cost
- **PostgreSQL queries more reliable than NodeBB API** — for bulk operations like purging test data, go direct to DB

### Next Steps (For Next Chat)

1. **Check import progress** — `tail -5 /root/filmboards-crawl/import.log` and full stats via state file query
2. **Wait for import to complete** (estimated ~7-10 more days from April 16)
3. **Once import completes, handle remaining forum tasks:**
   - Remove GDPR consent checkboxes (disable NodeBB GDPR plugin at admin → Extend → Plugins)
   - Post formatting polish — verify imported content looks clean on mobile, fix any CSS issues
   - Full NodeBB API health check
   - Mobile testing of forum (banner, auth modals, thread browsing, post formatting)
   - Staging branch cleanup — delete orphaned files: `filmboards_crawler.py`, `cleanup_test_data.py`, `app/api/posters/route.ts`
4. **Add "Discuss" links on filmglance.com movie result pages** — link from movie results to corresponding forum threads (match via IMDb ID)
5. **Full Film Glance API health check** — test all search/ratings APIs to ensure nothing has regressed during the months of forum focus
6. **Final UI polish on main site** — any remaining cleanup before mobile app conversion
7. **Mobile app conversion (Phase 2)** — Capacitor wraps existing Next.js app for App Store / Google Play
8. **Consider Claude Code migration** — natural transition point once import is done; provides better tooling for the coding-heavy phases ahead

### Active Issues / Known Limitations

- **Import runs for days at 0.15s delay** — this is intentional to avoid Hostinger CPU throttling. Do not reduce delay without monitoring CPU.
- **Import state stored in JSON** — resume capability proven (survived multiple restarts this session)
- **Some threads may still have bad titles** — regex covers most cases but edge cases exist. Can be cleaned up post-import if needed.

---

## Session: April 10, 2026 — Forum Auth, Banner, Icons, Import Script

### Workstream 1: Crawl Completion Verified

Confirmed crawler finished — 7,652 boards completed, 3,308 JSON files on disk, 1.1 GB total data, 0 errors. Crawler process already terminated. Data quality verified: well-structured JSON with board_title, imdb_id, threads, posts. Breakdown: 1,419 boards with IMDb IDs (movie boards), 1,889 without (general discussion). Total: 309,201 threads, ~2.93 million posts.

### Workstream 2: Category Setup

1. **"The IMDb Archives" parent category created** — read-only (view-only privileges for registered-users and guests, all posting privileges denied). For non-movie crawled content.
2. **Category icons applied** — All 21 categories updated via direct PostgreSQL `UPDATE` on `legacy_hash` table. FontAwesome classes set per the plan from the previous session (fa-star, fa-film, fa-masks-theater, fa-compact-disc, fa-comments, fa-bullhorn, fa-handshake, fa-life-ring, fa-clapperboard, fa-ticket, fa-newspaper, fa-rocket, fa-ghost, fa-heart, fa-video, fa-tv, fa-gem, fa-magnifying-glass, fa-display, fa-mug-hot, fa-box-archive). NodeBB rebuilt to apply.

### Workstream 3: Forum Auth System (COMPLETE)

**Decision: NodeBB built-in auth** instead of Supabase SSO. Standalone registration with email verification — simpler and more robust than fighting NodeBB's native architecture.

**Settings configured:**
- Registration Type: Normal
- Registration Approval: Normal
- Require email address: ON (interstitial after initial registration form)
- Email confirmation: ON (send validation emails when email added)
- Max username length: 32 (increased from 16 for bot account)
- No Google sign-in

**SMTP configured:**
- Host: `smtp.zohocloud.ca` (Canadian region — NOT smtp.zoho.com)
- Port: 465, Encrypted
- Username: `rod@filmglance.com`
- Password: Zoho app-specific password (generated at accounts.zoho.com → Security → App Passwords, named "NodeBB Forum")
- From: `rod@filmglance.com`
- Tested and working — emails delivered successfully

**Branded activation email:**
- Custom HTML template matching Film Glance dark/gold design exactly (replicated from Supabase activation email)
- Playfair Display logo, gold gradient CTA button, dark card, Film Glance footer
- "DISCUSSION FORUM" subtitle in 14px white
- Template applied in NodeBB admin → Email → Edit Email Template → "welcome"

### Workstream 4: Banner + Auth UI (COMPLETE — v4 branding)

Banner + Sign In button + guest features + architecture (three Nginx-injected files). See previous sessions for details.

### Workstream 5: Bot Account + API Token

- **"The IMDb Forum Archives"** account created (UID 2, email support@filmglance.com)
- **API master token** generated at NodeBB admin → Settings → API (UID 1/fgadmin)
- Token embedded directly in import script

### Workstream 6: Import Script (v4 — tested, superseded by v5)

v4 tested on one board ("I Need To Know") — 738 topics, 3,820 replies, 0 errors. Observed duplicate titles in data → led to v5 dedup work in subsequent session.

### Workstream 7: Registration Flow Issues Noted

- Email field on interstitial page after "Register Now" (NodeBB design, not a bug)
- GDPR consent checkboxes on interstitial — to be removed post-import

---

## Session: April 7, 2026 — Forum Infrastructure: Nginx, SSL, Vercel Rewrite, Theme, Categories

### Workstream 1: Crawl Status Check
Confirmed 3,276 board JSON files crawled, crawler still running at this point.

### Workstream 2: Nginx + SSL Setup (COMPLETE)
Nginx 1.24.0 installed, config created, SSL via Let's Encrypt, Cloudflare DNS configured, firewall ports 80/443 opened.

### Workstream 3: NodeBB Path-Based Routing (COMPLETE — PRODUCTION)
Architecture: User → `filmglance.com/discuss` → Vercel rewrite → `discuss.filmglance.com` → Nginx → NodeBB (port 4567). NodeBB config.json URL set to `https://filmglance.com/discuss`. NodeBB rebuilt. Vercel rewrite added. Tested on staging, merged to production.

### Workstream 4: Forum Theming (v4.2 — COMPLETE)
Dark/gold theme via Nginx injection. White sidebar panels fixed.

### Workstream 5: Forum Categories (COMPLETE — 21 categories)
20 original + "The IMDb Archives" = 21 total. All icons applied via PostgreSQL.

---

## Session: April 6, 2026 — Forum Initiative Launch: FilmBoards Crawler + NodeBB Installation

### Strategic Direction Change
Blog plan **archived/deferred**. Forum + IMDb board restoration is now the active project. App store submission (Capacitor) is Phase 2.

### Workstream 1: FilmBoards Crawler (COMPLETE)
Python/Playwright crawler deployed on VPS. 7,652 boards, 3,308 JSON files, ~2.93M posts, 0 errors.

### Workstream 2: NodeBB Installation (COMPLETE)
NodeBB v3.12.7 on Hostinger VPS with PostgreSQL. Admin: fgadmin (UID 1).

---

## Session: March 18, 2026 — v5.9.1 Awards Fix + UI Enhancements + Email Setup + Marketing

### v5.9.1 Awards Fix (PRODUCTION)
Awards section restored. Claude prompt restructured. max_tokens 2500→3500. Bigger hero/search/tagline.

### Zoho Mail (COMPLETE)
rod@, partnerships@, support@filmglance.com all active.

---

## Session: March 12, 2026 — v5.8/5.8.1/5.9 TMDB Fallback + UI Overhaul + Title Gate

### v5.8 TMDB Fallback (PRODUCTION)
### v5.8.1 Letterboxd Direct (PRODUCTION)
### v5.9 UI Overhaul + Title Validation Gate (PRODUCTION)

See tech-specs.md change log for full details.

### Files Modified
| File | Changes | Version |
|------|---------|---------|
| `app/api/search/route.ts` | max_tokens 3500, prompt restructure, title gate | v5.9.1 (production) |
| `app/api/seed/route.ts` | max_tokens 3500, prompt restructure | v5.9.1 (production) |
| `app/api/seed/refresh/route.ts` | max_tokens 3500, prompt restructure | v5.9.1 (production) |
| `components/film-glance.jsx` | Awards above production, year in award cards, bigger hero/search/tagline | v5.9.1 (production) |
| `lib/ratings.ts` | Letterboxd Phase 5 fallback, RT API Phase 4, empty sources builder | v5.8.1 (production) |
