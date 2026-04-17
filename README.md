# Film Glance — Project README

## What This Document Is

This is the **onboarding document** for any new Claude chat session working on Film Glance. Read this first, then follow the instructions below before doing any work.

---

## The Bible — Mandatory Reading (DO THIS FIRST)

**⚠️ STOP. Before making ANY changes, writing ANY code, or responding to ANY request about Film Glance, you MUST read these documents IN ORDER. This is non-negotiable.**

1. **tech-specs.md** — Start with the **Change Log (§10)** at the bottom. Read the **CURRENT STATE** and **NEXT STEPS** entries first — these tell you exactly where things stand and what to do next. Then skim the rest of the spec for architecture context.
2. **conversation-summary.md** — Read the **latest entries** and the **Next Session** section at the bottom. This tells you what happened in recent sessions, what broke, what was learned, and what's pending.
3. **README.md** (this document) — Workflow rules, standing deliverables, known gotchas.
4. **Uploaded Repo** (Film-Glance GitHub codebase) — Read relevant source files before modifying them.

These four documents together are the **bible**. If there is a conflict between your training knowledge and what these documents say about Film Glance, the documents are correct.

**The tech-specs change log and conversation summary are the two most critical documents. They contain the current state of the project, active issues, and exact next steps. Reading them first prevents you from repeating solved problems or missing context.**

**When the repo zip is uploaded, you MUST perform a full codebase analysis before doing any work.** Read all key source files to build first-hand knowledge of how the code actually works. Never assume — verify by reading the code.

---

## Project Overview

**Film Glance** is a platform-neutral movie intelligence tool that answers one question: **"Is this movie worth watching?"** It aggregates scores from 9 major review platforms (RT Critics & Audience, Metacritic & Metacritic User, IMDb, Letterboxd, TMDB, Trakt, Simkl), normalizes them to a common scale, and presents a unified score alongside every individual rating — all on one screen, in under a second.

Unlike existing movie sites that exist in isolation, Film Glance is **platform-neutral** — it doesn't generate its own reviews, doesn't editorialize, and doesn't push algorithmic recommendations. It collects, verifies, and presents what every major platform thinks, and lets the user decide. Every score is fetched from verified APIs, not scraped or estimated.

- **Live site:** https://filmglance.com
- **Discussion forum:** https://filmglance.com/discuss
- **GitHub repo:** https://github.com/FilmGlance/Film-Glance
- **Tech stack:** Next.js 14, React, Anthropic Claude API (Haiku 4.5), TMDB API, RapidAPI (Ratings Ultra + YT Search Basic + RottenTomato Pro), Piped API, Invidious API, Letterboxd Direct, Supabase (auth + DB), Vercel (hosting), Cloudflare (DNS), Zoho Mail (email), NodeBB v3.12.7 (forum), PostgreSQL (forum DB), Nginx (forum reverse proxy)
- **Current version:** Check tech-specs.md §9 for the latest version (v5.9.1 in production)
- **Access model:** Anonymous users get 15 searches/day; free accounts get unlimited access
- **Business email:** rod@filmglance.com (primary), partnerships@filmglance.com (outreach), support@filmglance.com (user support) — all via Zoho Mail, DNS in Cloudflare

---

## Mandatory Rules

### 1. Standing Deliverables — After EVERY Task

After every executed command or code change, you MUST deliver these three things:

1. **Updated tech-specs.md** — Update the Change Log (§10) with what changed, files affected, and spec sections impacted. Update the Version History (§9) if a new version is being released.
2. **Updated conversation-summary.md** — Append a new entry describing what was done in this session.
3. **Remaining usage %** — Report how much of the chat session usage remains.

Never skip these. The user depends on them for continuity between sessions.

**When usage drops to 10% or below, proactively share all three bible docs regardless of whether requested.**

### 2. Change Log Requirements

Every entry in the Change Log (tech-specs.md §10) MUST include:
- **Date and time context** (at minimum the date)
- **What changed** — specific and detailed
- **Files affected** — exact file paths
- **Spec sections updated** — which sections of tech-specs.md were modified
- **Current state** — at the end of each session, document where things stand
- **Next steps** — what the next session should do first

### 3. GitHub Workflow — Browser-Based

The user manages the GitHub repo **entirely through the browser** at github.com. When advising on repo updates:

- **State the file name** and the **full GitHub repo directory path** (e.g., `app/api/search/route.ts`)
- **Give step-by-step browser instructions** (navigate to file → pencil icon → edit → commit)
- **Always provide the commit message** to use
- **Always provide the PR title** when merging staging → main
- **Branch workflow:** Changes go to `staging` first → test on Vercel preview → PR to `main` → merge to production
- Never give terminal/CLI commands unless the user specifically asks for them

### 4. Code Changes — Always Provide Files

When making code changes:
- Create the complete file and provide it for download
- The user will copy-paste the contents into GitHub's browser editor
- Always specify exactly which file to edit and where it lives in the repo

### 5. PR Title Format

PR titles should summarize the version and key changes:
```
v5.4.1 — Fix missing video reviews, YouTube quota safeguard, B7 movies
```

### 6. Commit Message Format

Commit messages should be concise and descriptive:
```
v5.4.1 add skipYouTube option to enrichWithTMDB
v5.4.1 cache all TMDB fields in search pipeline
fix: skip enrich call when TMDB data already cached
```

---

## Known Gotchas

These are recurring technical issues discovered through development. Be aware of them:

| Issue | Solution |
|-------|----------|
| Anthropic API credits exhausted | Site returns 504 on all searches. Buy credits at console.anthropic.com. Enable auto-reload to prevent. |
| Supabase auth token expires (~1hr) | Seed script stops. Refresh page, update `startOffset`, re-paste script. |
| Supabase `.then()` fails TypeScript | Wrap with `Promise.resolve(supabaseAdmin.from(...).method()).then(() => {})` |
| Vercel Hobby cron limit | Once per day minimum. Use `0 3 * * *` not `0 */3 * * *` |
| Vercel Hobby function timeout | 60 seconds max. Seed in chunks of 8 movies per API call |
| GitHub browser editor JSON | Can introduce invisible characters. Re-paste clean JSON if build fails with "Invalid vercel.json" |
| TMDB poster missing on first search | Retry with Claude's resolved title + year as fallback |
| Sequel search returns wrong movie | `resolveSequelTitle()` handles this via TMDB dual-search. Check `lib/ratings.ts` |
| Cache stale but user gets instant results | This is by design (SWR). Background refresh runs non-blocking |
| YouTube API quota (10K units/day) | **REMOVED in v5.6.** Replaced by Piped + Invidious (free, unlimited). RapidAPI YT Search (Basic $0) is primary. `YOUTUBE_API_KEY` can be deleted from env vars. |
| Piped/Invidious instances down | Community-run, can go offline. Mitigated by 3 instances per API with auto-failover + 8s timeouts. RapidAPI is primary. |
| TMDB fields missing from cache | v5.3 bug — only merged poster/cast/streaming. Fixed in v5.4.1 — now merges video_reviews, trailer_key, recommendations too. |
| Frontend enrich burning API quota | v5.4.1 fix — `enrichCachedMovie()` now only fires when cached data is missing TMDB fields, not on every search. |
| Coming Soon shows old rated data | If a movie was cached with ratings before v5.7, the old entry must be manually deleted: `DELETE FROM movie_cache WHERE search_key = 'movie name';` — then re-search to trigger the release date gate. |
| **NodeBB API requires `/discuss` prefix** | **Critical (Apr 11):** NodeBB's config.json was set to `https://filmglance.com/discuss` during the April 7 session. All API calls MUST use `http://127.0.0.1:4567/discuss` as the base URL. Without the `/discuss` prefix, NodeBB returns a 307 redirect that breaks scripts. |
| **GitHub raw CDN caching** | `raw.githubusercontent.com` can cache files for several minutes after a push. If `wget` downloads a stale version, use the GitHub API instead: `curl -H "Accept: application/vnd.github.v3.raw" -L -o FILE "https://api.github.com/repos/FilmGlance/Film-Glance/contents/FILE?ref=staging"` |
| **Hostinger CPU throttling** | When CPU hits 85%+, Hostinger activates CPU limitations that cripple performance. The import script's `REQUEST_DELAY` setting controls this — too aggressive and CPU spikes, too conservative and import takes forever. Sweet spot is **0.15s** at KVM 2. Click "Remove limitations" in Hostinger VPS panel after fixing. |
| **Hostinger browser terminal paste issues** | Large pastes freeze the terminal. All script deployments must use GitHub staging as intermediary with `curl`/`wget`. Never paste scripts directly. |

---

## Current Cache Maintenance

The cache maintains itself with zero manual intervention:
- **Daily cron (3 AM UTC):** Refreshes 25 most-popular expired entries automatically
- **SWR on user searches:** Stale entries return instantly, background refresh fires silently
- **Organic growth:** Any new movie searched by a user gets cached for 30 days
- **Video review backfill:** Cache hits with empty reviews trigger background fetch via RapidAPI → Piped → Invidious

---

## On the Horizon

### Priority 1: Discussion Forum Import (ACTIVE — v5 Import Running)
- **Platform:** NodeBB v3.12.7 on Hostinger VPS, accessible at `filmglance.com/discuss` (production)
- **Routing:** Vercel rewrite → `discuss.filmglance.com` → Nginx reverse proxy → NodeBB (port 4567). SSL via Let's Encrypt.
- **Theme:** Dark/gold Film Glance aesthetic via Nginx CSS/JS injection. Three files: `filmglance-theme.css`, `filmglance-auth.css`, `filmglance-brand.js` — all in `/var/www/html/` and served via Nginx location blocks.
- **Banner:** Full-width Film Glance Discussion Forum banner (Playfair Display, 60px, white/gold) on every page, links to forum home.
- **Auth:** NodeBB built-in email+password registration. Email verification required (SMTP via Zoho `smtp.zohocloud.ca`). Branded activation email. No Google sign-in.
- **Guest limits:** 100 threads before registration popup. Auth modal on post/reply/topic attempts.
- **Categories:** 21 total (6 parents + 15 subcategories), all with FontAwesome icons set via PostgreSQL. "The IMDb Archives" is read-only.
- **Data source:** FilmBoards crawl COMPLETE — 3,308 files, 309,201 threads, ~2.93M posts, 1.1 GB
- **Import (v5 — RUNNING April 11):** Deduplication merges same-title threads, removes true duplicates. 309,201 → 263,021 threads after dedup (43,625 true dupes removed, 2,555 same-title threads merged into parent threads). Movie boards (1,419 with IMDb ID) → The Cinema. Non-movie (1,889) → The IMDb Archives.
- **Import progress (as of Apr 16):** 450/3,308 boards complete, 99,308 topics, 852,777 replies, 0 errors. Running at 0.15s REQUEST_DELAY to avoid Hostinger CPU throttling. Estimated completion: ~7-10 more days.
- **Remaining post-import work:** Remove GDPR consent checkboxes, post formatting polish, mobile testing, NodeBB API health check, staging branch cleanup.

### Priority 2: Discuss Link Integration (Queued — After Import)
- Add "Discuss" links on filmglance.com movie result pages
- Link from movie search results to corresponding forum threads via IMDb ID
- Requires forum import to be complete first so thread URLs exist

### Priority 3: Film Glance API Health Check (Queued — After Import)
- Comprehensive testing of all search/ratings APIs to ensure nothing has regressed
- Verify all 9 sources still resolving correctly
- Test edge cases: sequels, coming soon, title gate, TMDB fallback
- Check video review pipeline (RapidAPI → Piped → Invidious)

### Priority 4: UI Polish (Queued — After Import)
- Final cleanup of any remaining UI issues
- Mobile responsiveness audit across the main site
- Forum UI polish (banner, auth modals, thread browsing) on mobile

### Priority 5: Mobile App Conversion (Phase 2 — After Forum Launch)
- Convert Film Glance to native mobile app using Capacitor (wraps existing Next.js app)
- Submit to Apple App Store + Google Play
- Forum must be live first — app store reviewers look for community/engagement features

### Priority 6: Marketing & Visitor Acquisition (Queued)
- **YouTube sponsorship outreach:** 30-channel outreach list compiled with contact info. Use partnerships@filmglance.com. Ad copy drafted.
- **Social group posting:** Manual first, then explore agent-based mass posting.

### Priority 7: Monthly Blog (`/blog`) (Archived/Deferred)
- Will revisit after forum, mobile app, and marketing are complete.

---

## VPS Quick Reference (Hostinger KVM 2 — 147.93.113.39)

**SSH access:** As of Apr 17, 2026, VPS SSH uses `filmglance@147.93.113.39` (not root). Root SSH is blocked by Hostinger default (`PermitRootLogin no`). The `filmglance` user has sudo privileges — prefix privileged commands with `sudo`. Hostinger browser terminal is still available as root fallback for emergencies.

**From PowerShell on your PC:**
```
ssh filmglance@147.93.113.39 "<command>"
```

| Service | Location | Port | Status |
|---------|----------|------|--------|
| OpenClaw | — | — | Running |
| FilmBoards Crawler | `/root/filmboards-crawl/` | — | COMPLETE (7,652 boards) |
| NodeBB Forum | `/root/nodebb/` | 4567 | Running |
| PostgreSQL (NodeBB) | localhost | 5432 | Running |
| Nginx | `/etc/nginx/` | 80/443 | Running (reverse proxy + SSL + 3 static files) |
| SSL Certificate | `/etc/letsencrypt/live/discuss.filmglance.com/` | — | Valid until Jul 5, 2026 |
| Import Script v5 | `/root/filmboards-crawl/import_filmboards.py` | — | Running via nohup (450/3308 boards as of Apr 16) |

| Action | Command |
|--------|---------|
| Check import progress | `sudo tail -5 /root/filmboards-crawl/import.log` |
| Check import stats | `cp /root/filmboards-crawl/import_state.json /tmp/s.json && python3 -c "import json; d=json.load(open('/tmp/s.json')); print(d['stats']); print('Boards:',len(d['completed_boards']),'/ 3308')"` |
| Kill import (for restart) | `kill $(pgrep -f import_filmboards)` |
| Restart import | `cd /root/filmboards-crawl && nohup python3 import_filmboards.py > import.log 2>&1 &` |
| Adjust import speed | `sed -i 's/REQUEST_DELAY    = 0.15/REQUEST_DELAY    = 0.10/' /root/filmboards-crawl/import_filmboards.py` (then restart) |
| Check NodeBB status | `cd /root/nodebb && ./nodebb status` |
| Start NodeBB | `./nodebb start` |
| Rebuild NodeBB | `cd /root/nodebb && ./nodebb stop && ./nodebb build && ./nodebb start` |
| NodeBB admin (use this URL) | `https://discuss.filmglance.com/discuss/admin` |
| PostgreSQL access | `sudo -u postgres psql nodebb` |
| Check Nginx | `nginx -t && systemctl status nginx` |
| Restart Nginx | `systemctl restart nginx` |
| Update forum theme CSS | `wget -O /var/www/html/filmglance-theme.css https://raw.githubusercontent.com/FilmGlance/Film-Glance/staging/filmglance-theme.css` |
| Update forum auth CSS | `wget -O /var/www/html/filmglance-auth.css https://raw.githubusercontent.com/FilmGlance/Film-Glance/staging/filmglance-auth-styles.css` |
| Update forum branding JS | `wget -O /var/www/html/filmglance-brand.js https://raw.githubusercontent.com/FilmGlance/Film-Glance/staging/filmglance-brand.js` |
| Update import script (via GitHub API — bypasses CDN cache) | `curl -H "Accept: application/vnd.github.v3.raw" -L -o /root/filmboards-crawl/import_filmboards.py "https://api.github.com/repos/FilmGlance/Film-Glance/contents/import_filmboards.py?ref=staging"` |
| Nginx config | `nano /etc/nginx/sites-available/filmglance-forum` then `nginx -t && systemctl restart nginx` |
| Renew SSL | `certbot renew` (auto-renews via cron) |

### Nginx Architecture (3 static files)

The Nginx config at `/etc/nginx/sites-available/filmglance-forum` serves three static files via separate location blocks and injects them into NodeBB HTML via `sub_filter`:

```
location /filmglance-theme.css  → /var/www/html/filmglance-theme.css
location /filmglance-auth.css   → /var/www/html/filmglance-auth.css
location /filmglance-brand.js   → /var/www/html/filmglance-brand.js
```

`sub_filter` in the `location /` block injects all three into `</head>`. To update any file, simply `wget -O` to overwrite — no appending, no editing Nginx config.

---

## Forum Auth Architecture

- **Registration:** NodeBB built-in, email+password, 2-32 char username
- **Email verification:** Required. SMTP via Zoho (`smtp.zohocloud.ca:465`, app-specific password, from `rod@filmglance.com`)
- **Branded activation email:** Custom HTML template matching Film Glance dark/gold design
- **Guest browsing:** 100 thread views tracked via localStorage, then mandatory registration popup
- **Guest action blocking:** Click interception on New Topic / Reply / Quote → Film Glance-styled auth modal
- **Registration notification:** Drop-down notification "Registration Successful! Check Your Inbox To Verify Your Account"
- **Sign In button:** Playfair Display styled, matches filmglance.com exactly. Shows username when logged in.
- **GDPR consent:** Currently shown on registration interstitial — to be removed (NodeBB GDPR plugin)

---

## Forum Import Architecture (v5 — DEDUPLICATION)

- **Script:** `/root/filmboards-crawl/import_filmboards.py` (v5 — April 11, 2026)
- **Data:** 3,308 board JSON files in `/root/filmboards-crawl/crawl_data/boards/`
- **Dedup logic (v5 addition):**
  - Threads grouped by normalized title (case-insensitive, punctuation-stripped)
  - Same title + similar first post content (≥70% Jaccard word overlap) → TRUE DUPLICATE → keep thread with most posts, remove the rest
  - Same title + different first post content → UNIQUE DISCUSSIONS → merge all posts into a single thread (longest thread is the base, all other threads' posts appended as replies)
  - Dedup logic is IMPORT-ONLY. After import completes, NodeBB operates normally — users can create threads with any title they want, even duplicates.
- **Strategy:** Each original thread → individual NodeBB topic. Each original post → NodeBB reply. First post = topic body with archive attribution.
- **Routing:** Movie boards (1,419 with IMDb ID) → The Cinema (cid 6). Non-movie boards (1,889) → The IMDb Archives (cid 25).
- **Bot account:** "The IMDb Forum Archives" (UID 2). All posts currently attributed via the master API token to UID 1 (fgadmin), not UID 2, due to NodeBB master token behavior. Original author/date preserved in post body.
- **API token:** Master token stored in script. Generated at NodeBB admin → Settings → API.
- **API base URL:** `http://127.0.0.1:4567/discuss` — the `/discuss` prefix is mandatory due to NodeBB config.
- **Request delay:** Currently 0.15s between API calls to avoid Hostinger CPU throttling.
- **Resume:** State saved in `import_state.json` — tracks completed boards + position within current board. Re-running skips completed boards.
- **Bad title handling:** Detects relative timestamps, bare numbers, "post deleted" etc. and substitutes first line of first post content.
- **Analyze mode:** `python3 import_filmboards.py --analyze` scans all boards and reports dedup stats without importing. Outputs full report to `/root/filmboards-crawl/dedup_analysis.json`.

### Analyze Results (April 11, 2026)
- **Boards scanned:** 3,308
- **Boards with duplicates:** 2,561 (77.4%)
- **Total threads (before):** 309,201
- **Total threads (after):** 263,021
- **True duplicates removed:** 43,625 (14.1% of data was copy-paste junk)
- **Same-title merged:** 2,555 (unique discussions folded into parent threads)

---

## Session End Checklist

Before the session ends, ensure:
- [ ] tech-specs.md Change Log updated with current state + next steps
- [ ] conversation-summary.md appended with new entry
- [ ] Remaining usage % reported
- [ ] Any unfinished work clearly documented in next steps
- [ ] All deliverable files provided for download

---

*This document is part of the Film Glance project bible. It should be uploaded at the start of every new chat session along with tech-specs.md, conversation-summary.md, and the repo zip.*
