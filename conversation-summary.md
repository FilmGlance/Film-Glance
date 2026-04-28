# Film Glance — Conversation Summary

## Session: April 28, 2026 (afternoon) — v5.10.5 Landing Redesign Pass 1: Grid Background + Sticky Header Fix

### Context

First of three planned landing-page redesign passes (landing → did-you-mean → movie result). User initiated the design work after living with v5.10.4 for the day. Two PRs of work merged into one staging branch under v5.10.5: the starfield→grid swap, and a sticky-header fix discovered during scroll-testing the new background. Forum import continues in the background — checked at session start (1,609/3,308 boards, ~91 boards/hr empirical pace, ETA revised to ~May 11).

### Workstream 1: Forum Import Status Check

User asked for current state. Empirical recheck:
- PID 2644 still running on KVM 4
- 1,609 unique boards complete (log doubled-line cosmetic accounted for via `sort -u`)
- Pace ~91 boards/hr over the last ~17h window since current PID started — slower than the ~206/day projection from KVM 4 first hour. Could be normal variance or post-burst settling.
- **Revised ETA: ~May 11, 2026** (~12.5 days at current pace) — slower than the ~May 4-6 estimate from yesterday
- User asked about increasing speed. Investigated: NodeBB at 27% of one CPU core (single-threaded V8 ceiling), Postgres light, server overall 26% CPU / 70% idle. Bottleneck is `REQUEST_DELAY = 0.05s` serial calls in `import_filmboards.py` (~40s of every ~5min board is `time.sleep`). 2-3× speedup theoretically available via asyncio + concurrent in-flight requests, but requires stopping the import + editing the script + restart, and CLAUDE.md is explicit about VPS read-only-during-import. **User decision: leave it alone — don't risk double imports.**

### Workstream 2: v5.10.5 Pass 1 — Starfield → Static Grid Background

**Trigger:** User said the starfield "isn't working as intended and is too bombastic." Asked to install `https://21st.dev/r/ctate/grid-background` via shadcn CLI and theme it for Film Glance dark/gold.

**Discovery:** Project has no Tailwind, no shadcn config, no `components.json` — the lone file in `components/ui/` is the custom Three.js `floating-particles.tsx` which explicitly notes "this codebase is inline-styled, no Tailwind" in its header comment. Running `npx shadcn@latest add ...` would have first forced `shadcn init` which requires standing up Tailwind project-wide (postcss, content array, design tokens in globals.css, the `cn()` helper, ~6 new dev deps). The grid-background component itself is trivial (25 lines fetched from 21st.dev — two divs with inline-style background-image gradients, no JS logic, no registry dependencies). Net call: port the source directly into `components/ui/grid-background.tsx` matching the existing inline-style convention. User approved the deviation.

**Theme decisions** (all approved before commit):
- Field: `#050505` (matches the existing root background) with a soft gold radial centered at `rgba(255, 215, 0, 0.07)`, fading to transparent by 65%
- Grid lines: gold `rgba(255, 215, 0, 0.035)` at 32px spacing — quiet geometric texture, intentionally not flashy
- Existing `.bg-spotlight` (gold ambient overhead lighting), `.bg-vignette`, `.bg-grain` overlays preserved on top

**Surface area** (commit `7cde279`):
- `components/ui/grid-background.tsx` (NEW, 30 lines)
- `components/film-glance.jsx` lines 10, 1314-1326 — swap `<FloatingParticles>` block for `<GridBackground />`
- `components/preview-landing.jsx` lines 28, 674-685 — same swap

No per-device or per-account-type branching needed — there's no such gating today. The pre-existing `isPortrait` state was only used to tweak FloatingParticles' camera params; with a static grid there's nothing to branch on. Left the `isPortrait` state in place (used elsewhere or harmless).

**Build pre-flight** failed locally with the well-known Windows path-casing collision (webpack saw both `\Film-Glance-Terminal\` capital-F and `\film-glance-terminal\` lowercase-f as separate modules → React loaded twice → "useContext is null" during prerender). Pre-existing, not caused by this change. Vercel/Linux build (deployment `dpl_EVUXyRkDNBf6AMg8zZ3uvtFmwKuz`) succeeded on first try.

### Workstream 3: v5.10.5 Pass 1 Addendum — Sticky-Header Fix

**Trigger:** After pushing the grid-background swap, user scroll-tested staging and reported the header doesn't stay locked at top.

**Root cause:** Header on both `/` and `/preview-landing` already has `position: sticky; top: 0; zIndex: 50` set correctly. The bug was in `app/layout.tsx` lines 36-37: both `<html>` and `<body>` had `overflow-x: hidden`. When overflow on an ancestor is anything other than `visible`, that ancestor becomes the scroll container, and `position: sticky` on a descendant gets confined to that container's bounds rather than the viewport. The body becomes the scroll element, sticky tries to stick to top of body's scrollable area, which scrolls with content, never appearing to stick.

**Fix** (commit `9cc13da`): swap `overflow-x: hidden` → `overflow-x: clip` on both `<html>` and `<body>`. `overflow: clip` is the modern equivalent specifically designed for this case — it clips horizontal overflow (preserving the original anti-horizontal-scroll intent) but does NOT establish a containing block, so descendant `position: sticky` works against the viewport as intended. Browser support: Chrome 90+, Firefox 81+, Edge 90+, Safari 16+ — pre-Safari-16 (<5% of 2026 traffic) falls back to `visible`, which would only manifest as a horizontal scrollbar IF some child overflowed horizontally. None of the current fixed-position atmosphere layers or content sections do.

User confirmed the staging preview shows the header now stays locked.

### Files Modified / Created

| File | Commit | Purpose |
|------|--------|---------|
| `components/ui/grid-background.tsx` | `7cde279` (NEW) | Themed grid backdrop, ~30 lines, inline-styled |
| `components/film-glance.jsx` | `7cde279` | Swap FloatingParticles → GridBackground on `/` |
| `components/preview-landing.jsx` | `7cde279` | Swap FloatingParticles → GridBackground on `/preview-landing` |
| `app/layout.tsx` | `9cc13da` | `overflow-x: hidden` → `clip` on html + body to unbreak sticky |
| `tech-specs.md` | (this docs commit) | §0 version header, §9 v5.10.5 row, §10 four new rows |
| `conversation-summary.md` | (this docs commit) | This entry |

### Key Learnings

1. **`overflow: clip` is the modern fix for sticky-broken-by-ancestor-overflow.** `overflow: hidden` creates a scroll container; `overflow: clip` clips without one. This pattern is going to come up again — note for future layout debugging.
2. **Verify the registry component before assuming the install path is right.** WebFetch on the 21st.dev URL revealed the component was 25 lines of trivial CSS — adding shadcn + Tailwind to consume that would have been all cost, no benefit. Always inspect what you're installing.
3. **Don't trust the local Windows build for verdicts on Vercel deploys.** This project has a long-standing local-only path-casing collision (`Film-Glance-Terminal` vs `film-glance-terminal`) that breaks `next build` with a "useContext is null" prerender error. Vercel builds on Linux with a single canonical path and is unaffected. Use `npx tsc --noEmit` for local typecheck and let Vercel's build be authoritative.

### Next Steps (For Next Chat / Same Session If Continuing)

1. **Merge v5.10.5 PR (staging → main)** once user signs off on landing visuals.
2. **Pass 2 — Did-You-Mean screen redesign** (next on user's queue).
3. **Pass 3 — Movie result page redesign** (third on queue).
4. **Forum import** — wait for completion ~May 11. No VPS writes until then.
5. **Post-landing-redesign cleanup**: delete `components/ui/floating-particles.tsx` and drop `three` from `package.json` (orphaned after v5.10.5 — kept temporarily for rollback safety until v5.10.5 lands in production).
6. **Other queued work unchanged** — see `tech-specs.md` §10 NEXT STEPS row.

---

## Session: April 27-28, 2026 — VPS Tier Upgrade + v5.10.1→v5.10.4 Search/Loading Sweep

### Context

Multi-day arc resolving forum-import slowdown (Hostinger CPU throttle re-trigger), then a focused Apr 28 session that fixed the loading-screen white line and the search disambiguation issues. Five PRs merged to `main`: **#37 v5.10.1**, **#38 v5.10.2**, **#39 v5.10.3**, **#40 v5.10.4** (note: PR numbering reflects merged-then-resubmitted iterations). Forum import accelerated from ~38 boards/day (throttled) to ~206 boards/day after KVM 4 upgrade.

### Workstream 1: Hostinger KVM 2 → KVM 4 + PostgreSQL Tuning (Apr 27)

Forum import had slowed to 26-38 boards/day (vs 174 boards/day Apr 18-23). Initial diagnosis was Hostinger hypervisor CPU steal (~47% measured via `iostat -xz`), which would have suggested no client-side fix. **Real cause discovered when user shared hPanel screenshot:** Hostinger's per-VPS CPU limitation had been activated (same throttle from Apr 11-16). The 47% "steal" reading was Hostinger's tier-level throttle enforcing the cap, not other-tenant contention.

**Resolution sequence:**
1. Removed limitations via hPanel "Remove limitations" (1×/week allowance per Hostinger).
2. Upgraded KVM 2 → KVM 4 ($15.73 net, $34.49/mo gross with Hostinger balance applied). KVM 4 = 4 vCPU, 16 GB RAM, 200 GB NVMe (vs 2/8/96 on KVM 2).
3. Hostinger forced auto-reboot during resize. PostgreSQL came back via systemd; NodeBB and import process did NOT auto-restart.
4. Bootstrap NOPASSWD for `filmglance` via Hostinger root browser terminal (one-line drop-in to `/etc/sudoers.d/filmglance-temp`), revoked after maintenance window.
5. Backed up `/etc/postgresql/16/main/postgresql.conf` to `.bak-20260427-213951`.
6. **Postgres tuning block appended** (Tier 2):
   - `shared_buffers = 4GB` (default 128 MB)
   - `effective_cache_size = 12GB` (default 4 GB)
   - `work_mem = 32MB`, `maintenance_work_mem = 512MB`
   - `wal_buffers = 32MB`, `max_wal_size = 4GB`, `checkpoint_timeout = 15min`
   - `random_page_cost = 1.1` (NVMe), `effective_io_concurrency = 200`
   - `max_worker_processes = 4`, `max_parallel_workers = 4`, `max_parallel_workers_per_gather = 2`
7. **Tier 1 bundled with Tier 2:** `REQUEST_DELAY` in `import_filmboards.py` 0.15s → 0.05s (backup at `.bak-20260427-214144`). KVM 4's expanded credit budget makes the conservative 0.15s no longer needed.
8. Restarted PostgreSQL cleanly; verified config via `SHOW shared_buffers` etc.
9. Started NodeBB manually (`cd /root/nodebb && sudo ./nodebb start`); verified token auth via `/api/self` returning `uid: 1, isAdmin: true`.
10. Relaunched import via `/root/filmboards-crawl/run_import.sh` (PID 2644).

**Performance results (verified post-restart):**
- CPU steal: 47% → 0–5% in fresh `iostat` samples
- Per-thread time consistent at ~5.2s (vs 30s+ timeouts under throttle)
- Pace: **~206 boards/day** projected
- Errors: stable at 40 (pre-existing throttle-era 30s timeouts; no new ones)

### Workstream 2: PR #37 — v5.10.1 Search + Loading Sweep (8 commits)

Bundled fixes from prior staging review:

**Search fixes (`app/api/search/route.ts`):**
- **Trailing-year parser:** query `michael 2026` extracts `userYearHint=2026` and `searchTitle=michael`. Original `query` kept as cache key.
- **Title-gate exact-match year hint:** when normalized query == TMDB `officialTitle`, redirect uses TMDB title + year so Claude isn't sent an ambiguous bare title.
- **TMDB+verified fallback in `runFullPipeline`:** when Claude returns `not_a_movie`/empty sources AND `releaseInfo` exists, build complete response from `fetchComingSoonDetails` + TMDB enrichment + `applyVerifiedRatings([], verified)`. Sets `no_scores: true` if verified data also empty.
- **Year-mismatch guard at title gate:** reject TMDB results >1 year off from `userYearHint`, return 404 → Did-You-Mean suggestions.

**Loading screen (`components/film-glance.jsx`, `public/loading-screen.mp4`):**
- Added user-supplied 1.2 MB `loading-screen.mp4` (gold film-reel)
- Iterations: mix-blend-mode (failed due to stacking-context trap from `slideUp` animation) → `mask-image` radial → global fixed overlay (z-40, then z-60) → solid `#000` bg → removed scanning text + search-area borderBottom during loading

### Workstream 3: PR #38 — v5.10.2 Rate-Limit Masquerade Fix

After PR #37 deployed, user reported `michael 2026` still returning "no results" on production. **Vercel runtime logs revealed every recent `/api/search` returned 429 (Too Many Requests), not 404.** Two compounding issues:

1. **`SEARCH_LIMIT` was 10/min** — burst-testing exhausted it
2. **Frontend masked 429 as "no results"** — `fetchMovieAPI`'s 429 handler only recognized `DAILY_LIMIT_REACHED`. Per-minute throttle 429 fell through to `return null`, which `doSearch` rendered as `setResult({notFound: true})` with message "Could not find this movie."

**Fixes:**
- `SEARCH_LIMIT` 10/min → 30/min in `lib/rate-limit.ts`
- Frontend: 429 without `DAILY_LIMIT_REACHED` returns `{rateLimited: true, retryAfter}` parsed from `Retry-After` header. `doSearch` surfaces "Searching too fast — try again in N seconds."

### Workstream 4: PR #39 — v5.10.3 Pass Year to Claude (the real disambiguation fix)

User pushed back: `michael 2026` and `super mario galaxy movie 2026` STILL returned wrong films even after PR #38. Tested TMDB API directly with production key:
- `michael` + `primary_release_year=2026` → **Michael (2026-04-22, MJ biopic)**, popularity 271, top result
- `super mario galaxy movie` + `primary_release_year=2026` → **The Super Mario Galaxy Movie (2026-04-01)**, only result

So TMDB was NOT the bug. Found the actual root cause: **`claudeUserPrompt(title)` takes only title, never year.** Even though `runFullPipeline` receives `yearHint`, it's used only for TMDB enrichment and verified ratings — **never passed to Claude**. Claude received `Movie: "Michael"` with no year, returned the most famous Michael in its training data (1996 Nora Ephron film), and the pipeline returned Claude's wrong-film data. The TMDB+verified fallback never fired because Claude returned valid-shaped data — just for the wrong film.

**Fixes:**
- `claudeUserPrompt(title, year?)` now appends `(YYYY)` to the title and adds: *"if you don't recognize it, return `not_a_movie` so we can fall back; do NOT substitute a same-titled film from another year."*
- Year sanity check after Claude's response: if `expectedYear` (from `userYearHint` or `releaseInfo.releaseDate`) and `mv.year` differ by >1 year, treat as Claude failure and fall through to TMDB+verified fallback (which has correct film data from `releaseInfo`).

After PR #39 merged, user verified: `michael 2026`, `super mario galaxy movie 2026`, `fargo` all return correct films. Memory saved encouraging me to test external systems with curl before patching the layer in front.

### Workstream 5: PR #40 — v5.10.4 Loading-Screen White Line (verified visually)

User reported persistent thin white horizontal lines on the loading screen across multiple "fix" iterations. Each prior fix was a guess that didn't actually verify.

**Real cause traced** to line 1035 of `film-glance.jsx`:
```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(22px); }
  to   { opacity: 1; transform: translateY(0); }
}
```
The loading overlay had `animation: slideUp 0.4s`. During those 400ms it was simultaneously **partly transparent** (page bg leaked through) AND **translated 22px down** (top 22px of viewport uncovered, exposing header's `borderBottom: 1px rgba(255,255,255,0.04)`). Either alone would produce a transient white line; together it was guaranteed for the first 400ms of every loading state. Screenshots taken during that window caught it.

**Fix:**
- Container: solid `#000` from frame 1, NO animation on container. Always opaque, always at correct position.
- Video element: `animation: fadeIn 0.3s` (opacity-only — bg behind it is solid black, fade only affects the gold logo's appearance, never exposes anything underneath).
- Defensive: `clipPath: inset(2px)` on video for any mp4 edge artifacts. `border: 0; outline: 0;`.

**Visual verification before push** (this time): wrote isolated HTML test page in `scratch/` (gitignored) reproducing production page chrome — header z-50 with borderBottom, search bar, footer watermark — and overlaid the new loading code. Rendered with Chromium via temporary `playwright-core` install (`npm install --no-save playwright-core@1.55`). Screenshot confirmed: solid black field, gold logo centered, **zero white lines anywhere**.

User confirmed: *"I went into incognito to check, and you did actually fix it. Nice job."*

Memory saved encouraging visual verification for UI bugs before pushing.

### Workstream 6: Scheduled Cleanup Agent

One-time scheduled remote agent created for **2026-05-12 13:00 UTC** (9am ET, 2 weeks from Apr 28):
- Routine ID: `trig_01XgUj4SH6z6d9vSp9Betg8R`
- Tasks: verify PR #40 merged + stable, remove temporary `playwright-core` from `node_modules` via `npm ci`, verify `scratch/` still gitignored with only Apr 28 artifacts, comment summary on PR #40
- Manage at: https://claude.ai/code/routines/trig_01XgUj4SH6z6d9vSp9Betg8R

### Workstream 7: Huashu-Design Skill Installed (Personal Use Only)

User asked to install `alchaincyf/huashu-design` — HTML-native design skill for Claude Code (high-fidelity prototypes, slide decks, motion design with MP4/GIF export, design philosophy advisor, expert critique). Installed via `npx skills add alchaincyf/huashu-design -y -g` to `~/.agents/skills/huashu-design`. Universal install (Cursor, Codex, Cline + others), symlinked into Claude Code.

**LICENSE caveat:** Personal use ALLOWED for free (learning, personal creative work, derivatives with attribution, non-commercial sharing). Commercial use REQUIRES prior written authorization (companies/teams, paid client deliverables, B2B SaaS, paid templates, profit-driven training). **Don't use this skill for Film Glance commercial output without first emailing the author** (花叔 / 花生).

### Files Modified / Created

| File | PR(s) | Purpose |
|------|-------|---------|
| `app/api/search/route.ts` | #37, #39 | Year parser, exact-match branch, TMDB+verified fallback, year sanity check on Claude response, prompt updated to take year |
| `lib/rate-limit.ts` | #38 | `SEARCH_LIMIT` 10→30/min |
| `components/film-glance.jsx` | #37, #38, #40 | Loading overlay rewrites (final form), frontend rate-limit handling, year-aware error messages |
| `public/loading-screen.mp4` | #37 (NEW) | 1.2 MB user-supplied gold film-reel |
| VPS `/etc/postgresql/16/main/postgresql.conf` | — | KVM 4 tuning block appended (reversible — remove block + restart postgresql) |
| VPS `/root/filmboards-crawl/import_filmboards.py` | — | REQUEST_DELAY 0.15→0.05 |
| `scratch/*.{mjs,html,png,mp4}` | — (gitignored) | Apr 28 visual verification artifacts; cleanup scheduled May 12 |
| `node_modules/playwright-core` | — (no-save install) | Cleanup scheduled May 12 via `npm ci` |

### Key Learnings

1. **The actual bottleneck wasn't where I thought.** Three iterations on title-gate logic and TMDB year filters didn't help because Claude was the disambiguation point — and we were never sending it the year. Test the external system (TMDB curl) before patching the layer in front of it.
2. **Visual UI bugs need visual verification.** I made 4 attempts at the white line before actually rendering an isolated reproduction and screenshotting. The `slideUp` animation hypothesis only became diagnosable once I could SEE the transient state.
3. **Vercel runtime logs are diagnostic gold.** PR #38's 429-as-404 issue was invisible without checking actual response codes via `mcp__plugin_vercel_vercel__get_runtime_logs`.
4. **Rate limits should be informative, not silent.** A 429 surfaced as "no results" cost ~30 minutes of wasted debugging.
5. **Hostinger CPU "steal" can be a tier-level throttle, not host contention.** The hPanel "CPU limitation activated" banner is the authoritative signal; iostat steal numbers are just a symptom.
6. **`npm install --no-save`** leaves cruft in `node_modules` that diverges from `package-lock.json`. Plan a cleanup or use `npx -p` for ephemeral usage.

### VPS / Forum Import Status (Apr 28 end of session)

PID 2644 running on KVM 4 since Apr 27 22:00 EDT (replaced PID 54968 after Hostinger-forced reboot).
- Boards: ~1,961+ / 3,308 (advancing rapidly)
- Pace: ~206 boards/day verified empirically over 5 minutes after restart
- Errors: 40 stable (all pre-existing throttle-era timeouts)
- **Updated ETA: May 4-6, 2026** (~6-8 days from Apr 27)

### Next Steps (For Next Chat)

1. **Forum import is the gate.** Don't touch the VPS until completion (~May 4-6). Monitor: `ssh filmglance@147.93.113.39 "tail -5 /root/filmboards-crawl/import.log"`.
2. **After import completes:** downgrade KVM 4 → KVM 2 to recoup ~$15/mo. Postgres tuning block can stay (4 GB shared_buffers fits in KVM 2's 8 GB RAM) or be reverted.
3. **Fix doubled-log cosmetic** at next clean import stop — `run_import.sh` redirect `>> import.log 2>&1` → `> /dev/null 2>> import.err.log`.
4. **Post-import work queue** (unchanged):
   - GDPR consent removal (NodeBB plugin)
   - Mobile responsiveness audit
   - Full Film Glance API health check across rating sources
   - Discuss links on movie result pages (IMDb ID match)
   - Staging cleanup (`filmboards_crawler.py`, etc.)
   - Capacitor mobile app conversion (Phase 2)
5. **6 Dependabot vulnerabilities on main** (3 high, 3 moderate as of Apr 28). Worth a dedicated security session.
6. **May 12 cleanup agent fires automatically.** Verify it commented on PR #40 with cleanup summary.
7. **Rotate Supabase PAT before April 17, 2027.**
8. **Delete dead `YOUTUBE_API_KEY`** from Vercel env vars (unused since v5.6).
9. **Reconstruct missing `003_anonymous_searches.sql`** to close repo-vs-prod schema drift.
10. **Full Stripe teardown** (optional, low priority).
11. **Consider deleting `components/preview-landing.jsx`** if unreferenced (`/preview-landing` route may still use it — check first).
12. **Huashu-design skill is at `~/.agents/skills/huashu-design`** — restart Claude Code session to activate. **Personal use only. Email author for any Film Glance commercial use.**

---

## Session: April 19-24, 2026 — v5.10 Release + Mobile Particle Odyssey + Vercel Pro

### Context

Multi-day arc spanning the v5.10 release to production, a Vercel Pro upgrade, and several days of mobile particle debugging. PRs #32–#36 all merged to `main` over this period. Session picks up from the Apr 18 preview-landing handoff; user's computer restart on Apr 23 dropped in-context memory, so the early part of this session was a reconstruction from git log + bible docs.

### Workstream 1: v5.10 Released to Production (PR #32)

Staging → main merge shipping the new landing to `/` along with 15+ commits of pre-release work (Apr 19-20 sprint):

- `/preview-landing` promoted to `/` (commit `f5a3975`) — ready on staging since Apr 18
- Unified header across `/` and `/preview-landing`
- Gold scroll indicator extended from main site to landing
- TDZ crash fix on `/?q=` (search deep-link) + favourites deep-link restoration
- Real search + auth wiring into preview landing
- Source-count copy scrub across SEO metadata + unreleased-movie message
- Mobile particle scaling + reduce-motion fix (the heuristic was hiding particles on Android Battery Saver / Samsung OneUI)
- `/api/suggest` force-dynamic annotation to silence build warning
- New `MobileParticles` bespoke WebGL component (450 particles, single gold color, orbital camera tuned for portrait) — **later abandoned** in PR #33

Version bumped from v5.9.1 → **5.10**. FG_VERSION constant updated. Vercel auto-deployed to production on merge.

### Workstream 2: Vercel Pro Upgrade (Apr 23)

Vercel emailed "approaching your limits" warning when team `rs-projects-c0025ef0` hit 100% of free-tier Edge Requests (1M/month cap). Upgraded to Pro. The 1M requests in <1 month was attributed to the new landing + Three.js client-side work + possible bot traffic. Pro has higher included quota + pay-on-demand billing.

Memory saved: `project_vercel_pro_upgrade.md`. Project tier is Pro going forward — don't propose cost-cutting perf work as if still on Free tier.

### Workstream 3: The Mobile Particle Odyssey (Apr 23-24, PRs #33-#36)

Painful four-PR debugging cycle. User reported that mobile particles didn't match desktop's starfield feel. Iterations:

**Iteration 1 (PR #33, merged):** Deleted `MobileParticles`, unified on `FloatingParticles` with same params on both viewports. Fixed the "isolated orbs covering screen" look, but exposed a new issue — orbital mode's antigravity upward motion read as a dominant vertical stream on portrait (horizontal span didn't dilute it like on landscape).

**Iteration 2 (PR #34, merged):** Built new `StarfieldFlythrough` component — a different motion paradigm where the camera moves forward through a static starfield tube. Matched desktop's visual palette (dual gold, additive blending, fog, radial sprite). Version 1 respawned particles at fog far plane, so they were invisible for most of cycle.

**Iteration 3 (PR #35, merged):** Bug fixes. Identified the **zombie points bug** — the shared-indexing pattern between two color geometries (`if i%2===0 write to geoA; else write to geoB`) left half of each geometry's slots uninitialized, rendering 1,750+ "phantom" points at world origin per color. Those fogged out as camera moved away, producing the "particles disappear after 30-60 seconds" symptom. Fixed with per-color tightly-packed buffers, tighter fog range (200-2000), wider FOV (65→75°).

**Iteration 4 (PR #36, merged — FINAL):** User reported particles STILL disappearing (now in ~3 seconds) + horizontal overflow on mobile + "huge blurry orbs" instead of starfield. Rather than debug the flythrough further, **abandoned the bespoke component entirely**. Switched portrait to use the desktop `FloatingParticles` component with `distributed={true}` — a prop that had been built into `FloatingParticles` from day one specifically for portrait viewports (documented on line 18 of the component's JSDoc). Also added `overflowX: hidden` + `maxWidth: 100vw` on `<html>` and `<body>` in `app/layout.tsx` to kill horizontal overflow at the document level. Net change: **+16 / −245 lines**. User confirmed: "that did the trick. looks great!"

### Diagnostics — Import slowdown root cause (Apr 23)

While waiting on user's mobile particle decisions, ran read-only VPS diagnostics to understand why the forum import had slowed (174 boards/day now vs 200+/day earlier). Ruled out: PostgreSQL bloat, memory pressure, disk I/O saturation. **Identified root cause: Hostinger hypervisor CPU steal.** `iostat` measured `%steal` at 53-74% during active samples (healthy <5%). The VPS is on a shared host where the hypervisor is giving CPU cycles to other tenants. A reboot would NOT help (steal is set by host contention, not VPS state). Recommendation: wait it out.

### Key Learnings

1. **Reuse proven code before building bespoke.** `FloatingParticles` had `distributed={true}` mode documented as "Recommended for mobile portrait viewports." I built two bespoke sibling components before discovering this — cost 70k tokens and multiple failed deploys. Memory saved: `feedback_reuse_proven_code.md`. Grep for existing components and read their prop APIs before writing new ones.
2. **PointsMaterial + `sizeAttenuation=true`**: a size-14 point at distance 50 renders as 300+ pixels on screen. The flythrough's "huge blurry orbs" was this. Desktop avoids the issue by keeping particles at fixed ~1000-unit camera distance.
3. **Portrait vs landscape particle physics**: the same particle effect can feel atmospheric on 16:9 landscape and feel like a cohort stream on 9:19.5 portrait. The horizontal span on landscape dilutes vertical motion; portrait does not. Fix: randomize spawn distribution (`distributed={true}`).
4. **Horizontal overflow root causes**: `position: fixed` elements don't cause document overflow even at `width: 150vw`, but ticker `white-space: nowrap`, film-strip `translateX`, and other in-flow wide elements do. Page-level `overflowX: hidden` on html+body is the belt-and-braces fix.
5. **Hostinger CPU steal is the real throttle**, not NodeBB or PostgreSQL internals. `iostat` `%steal` reveals it. Reboots and KVM upgrades have limited effect.

### VPS / Forum Import Status (Apr 24 end of session)

PID 54968 still running (uptime 7+ days on rotated token). Last snapshot:
- Boards: 1,844 / 3,308 (55.7%)
- Topics: 171,854
- Replies: 1,276,057
- Errors: 0
- Currently processing `board_96.json` at thread 1,400/1,439

Pace since Apr 18: ~8,817 topics/day, ~174 boards/day. Projected completion: **May 3, 2026 (±2 days)**.

### Workstream 4: Custom Loading Animation (INCOMPLETE — priority for next session)

User provided `loading-screen.mp4` (1.2 MB, gold film-reel animation on black background) to replace the skeleton+spinner loading state during movie searches. Requirements: muted, looping, tasteful (not full screen), works on mobile + desktop, both signed-in and signed-out users.

**Iterations attempted (all on staging, NOT merged to main):**

1. **Commit `e00ede0`** — Copied mp4 to `/public/loading-screen.mp4`. Replaced Skeleton component in loading JSX with a muted autoplay-loop video. Width `min(280px, 65vw)`. User reported: black square around logo didn't blend with page background, wanted it bigger.

2. **Commit `623cd08`** — Bumped width to `min(440px, 80vw)`. Added `mixBlendMode: "screen"` hoping black pixels would composite as transparent on the dark page bg. User reported: black square still visible. Root cause: the `slideUp` animation on the wrapper uses `transform`, which creates a new stacking context — `mix-blend-mode` on the video was trapped inside that context and blended against the (transparent) wrapper instead of the page.

3. **Commit `46c4d08`** — Replaced mix-blend-mode with a radial `mask-image` (`radial-gradient(ellipse at center, black 42%, transparent 78%)`). Masks are not subject to stacking context trapping. User confirmed: black frame successfully faded, gold logo looks clean on page.

4. **Commit `3e27b8c`** — User reported animation "does not appear when logged in." Hypothesis: inline block was inside the `showFavs ? favs : main` ternary in the main view branch. Refactored to a fixed-position global overlay at the top level of the JSX tree (end of component return, sibling to everything else). `zIndex: 40` (below sticky header z-50), `pointerEvents: none`. Video renders whenever `loading=true` regardless of view state, auth state, route, or hash.

**Status after commit `3e27b8c`:** User reports it STILL doesn't work. End of session — user signed off.

**Possible root causes to investigate next session (ordered):**

1. **Browser caching** — the page is cached; a hard refresh (Ctrl+Shift+R / Cmd+Shift+R) may be needed to pick up the global overlay change. Easiest to rule out first.
2. **Video autoplay blocked** — some browsers block autoplay without user interaction. Video has `muted` + `autoPlay` which should be sufficient in modern Chrome/Safari, but older or corporate-managed browsers may require user gesture. Check console for "NotAllowedError" or "play() failed".
3. **A different code path when signed in** — maybe a cached server response returns in <100ms and `loading` is only true for a frame, so the video technically shows but is too brief to perceive. Possible fixes: minimum loading duration (e.g., `setLoading(false)` after `Math.max(actual_duration, 800ms)`) or use a `requestAnimationFrame` to hold for at least one frame.
4. **zIndex conflict** — the overlay at z-40 might be behind some element I didn't catalog. A `position: relative` + `z-index` on a parent container could be occluding.
5. **User testing on a stale build** — if user is on the production URL (merged to main), none of the Apr 24 loading work has reached main yet. User has been testing on staging preview URLs, but worth confirming.

**Current state of code (commit `3e27b8c` on staging, NOT on main):**
- Video at `/public/loading-screen.mp4`
- Loading overlay JSX at bottom of `components/film-glance.jsx` (search "Global loading overlay")
- Width `min(440px, 80vw)`, mask-image for edge fade
- Sibling to outer wrapper div, `position: fixed`, `zIndex: 40`, `pointerEvents: none`
- Renders only when `loading=true`

### Files Created / Modified / Deleted

| File | Status | Purpose |
|------|--------|---------|
| `components/film-glance.jsx` | MODIFIED repeatedly | Mobile particle branching logic; FG_VERSION bump to 5.10 |
| `components/ui/floating-particles.tsx` | UNCHANGED | Desktop particle component (proven — reused on mobile via `distributed={true}`) |
| `components/ui/mobile-particles.tsx` | NEW then DELETED (PR #33) | Bespoke mobile component — abandoned |
| `components/ui/starfield-flythrough.tsx` | NEW then DELETED (PR #36) | Flythrough attempt — abandoned |
| `app/layout.tsx` | MODIFIED (PR #36) | `overflowX: hidden` + `maxWidth: 100vw` on html/body |
| `app/api/suggest/route.ts` | MODIFIED | `force-dynamic` annotation |
| `components/preview-landing.jsx` | (stale, but not removed) | Original preview component — promoted to `/` via `f5a3975` |

### Next Steps (For Next Chat)

0. **🎯 PRIORITY: Finish the custom loading animation.** Current state is on staging at commit `3e27b8c` but user reports it doesn't appear when signed in. Investigate in this order: (a) hard refresh to rule out browser cache, (b) browser console for autoplay errors, (c) check if there's a different loading code path for signed-in users that bypasses `loading` state (e.g., cached-result return path), (d) verify zIndex 40 isn't being occluded. See "Workstream 4: Custom Loading Animation (INCOMPLETE)" above for full context. **Do not open a PR to main until this works for both signed-in and signed-out users on mobile + desktop.**
1. **Forum import ETA May 3, 2026.** Monitor daily: `ssh filmglance@147.93.113.39 "tail -5 /root/filmboards-crawl/import.log"`. Don't touch the VPS (import, NodeBB, Postgres) until complete.
2. **Fix doubled-log cosmetic issue** on next clean import stop — swap `run_import.sh` redirect from `>> import.log 2>&1` to `> /dev/null 2>> import.err.log`.
3. **Post-import queue (unchanged from prior handoffs):**
   - Remove GDPR consent checkboxes (disable NodeBB GDPR plugin)
   - Full mobile responsiveness audit now that portrait particles work
   - Full Film Glance API health check across all rating sources
   - Add Discuss links on movie result pages (IMDb ID match → forum thread)
   - Staging cleanup: delete orphaned `filmboards_crawler.py`, any residual dead files
   - Mobile app conversion via Capacitor (Phase 2)
4. **5 Dependabot vulnerabilities on main** (3 high, 3 moderate as of Apr 24 push) — dedicated security-patch session.
5. **Rotate Supabase PAT before April 17, 2027** (token `film-glance-claude-code` expires then).
6. **Delete dead `YOUTUBE_API_KEY`** from Vercel env vars — unused since v5.6 (Mar 3).
7. **Reconstruct missing `003_anonymous_searches.sql` migration** from prod schema to close repo-vs-prod drift.
8. **Full Stripe teardown** (optional, low priority) — `subscriptions` table, orphaned `plan_id` columns, dead stored functions, `lib/stripe.ts`, `@stripe/*` deps, Stripe env vars.
9. **Clean up unused `preview-landing.jsx` component?** It was the source for the now-promoted `/` landing; the route `/preview-landing` may still reference it. Check before deleting.

---

## Session: April 18, 2026 — Preview Landing Build + Source-Count Scrub

### Context

Built a full redesigned landing page iteratively on a `/preview-landing` route on staging (with `noindex` metadata so Google can't index it and SEO is unaffected) while the live `/` page remains untouched at v5.9.1. Work was entirely screenshot-driven: user ran local dev (`npm run dev`), sent annotated screenshots + targeted feedback, I iterated, repeat. ~15 meaningful iteration passes across the session.

### Aesthetic direction

User picked **Direction B — Cinema Spotlight** (atmospheric, theatrical, moody) with **Direction A's editorial authority tone** infused. Anchored to the existing Film Glance palette (`#FFD700` / `#E8A000` / `#050505`, Playfair Display + Syne + JetBrains Mono) per `tech-specs.md §4.4`.

### Final landing structure (top to bottom)

1. Sticky header (logo + **Discussion Forum** button + Sign In; condenses on scroll)
2. Hero (Playfair Display h1 "Every Film." + italic gold gradient "One True Rating Score." + search bar with 5-layer conic-gradient aura). Minimalist — no eyebrow, no subtitle, no micro-badge.
3. ◆ Ornament
4. Ticker ("Review Sites Included" Playfair italic 22 px label + 7 auto-scrolling source glyphs at 40×40 / 44×30)
5. ◆ Ornament
6. How It Works (3-card centered grid: Search · Glance · Discuss, icon + title + gold hairline + Playfair roman 17 px body)
7. ◆ Ornament
8. What You'll Find (35mm film strip: sprocket holes top + bottom, 9 feature frames auto-scrolling 56 s with hover-pause)
9. ◆ Ornament
10. Footer (4 icon-linked items, `support@filmglance.com` for contact)

### Debugging narrative — two CSS rendering bugs resolved

1. **Gradient text rendering failures (2 root causes fixed in sequence)**:
   - First blur: `haloBreathe` animation applied `filter: drop-shadow` to an element with `background-clip: text`. In Chromium, `filter` on a gradient-clipped element collapses the fill. **Fixed** by swapping to `text-shadow` (composites outside the fill pipeline).
   - Persistent blur: Per-letter `<span>`s with inline animations inside a `.hero-accent` parent still broke gradient rendering because child compositing contexts don't inherit parent's text-clip gradient. **Fixed** by collapsing the accent line to a single `<span>` with whole-line opacity fade (no per-letter split).

2. **React hydration error** on `<style>{css}</style>` — server HTML-escapes `'` → `&#x27;`, `<` → `&lt;`, `&` → `&amp;` in text nodes, but client reconciliation expects raw. CSS content with apostrophes (`'Playfair Display'`), ampersands (Google Fonts `&family=`), and SVG data-URL angle brackets triggered byte-mismatch. **Fixed** by switching to `<style dangerouslySetInnerHTML={{ __html: css }} />` which bypasses escaping on both sides.

### Typography progression

Body text iterated: Syne (original, user called "dull and boring") → Playfair italic (user rejected — "don't like the italics") → **Playfair roman** (approved). Landed on Playfair Display roman 17 px / weight 400 / warm cream `rgba(255, 242, 220, 0.88)` / line-height 1.7 / letter-spacing 0.1. Gold hairline divider added between title and body, gradient flipped to symmetric (fade-in → peak → fade-out) when cards were centered.

### Three.js integration

Added `FloatingParticles` component (user supplied source via `prompt2.txt`). Adapted from the original:
- Tailwind `w-full h-full` → inline `width/height: 100%` (this codebase is inline-styled, no Tailwind)
- Default colors flipped to brand gold (`#FFD700` + `#FFE4A0`) instead of yellow/mint
- `prefers-reduced-motion` early-return guard — skips WebGL context creation entirely if user has "reduce motion" set
- `window.innerWidth/Height` fallbacks when `container.clientWidth/Height` return 0 at mount
- Integrated as full-viewport fixed backdrop (z-index 3, under vignette/grain/content)
- `npm install three` wasn't enough — production build failed on TypeScript at `import * as THREE from "three"` because Three.js ships runtime but no TS types. Had to add `@types/three` as a dev dep.

### Source-count scrub (tiered)

User's rule: count references ("9 sources", "nine sources", etc.) OK in technical internal docs, NOT in external communication. Scrubbed across:
- `app/layout.tsx` — 3 SEO / OG / Twitter description variants
- `components/film-glance.jsx` — unreleased-movie placeholder message (production code)
- `components/preview-landing.jsx` — FEATURES copy, HOW copy, tagline, frame numbers (01–09 labels removed since they implicitly revealed count)

Retained:
- `README.md`, `tech-specs.md` — internal bible docs
- `lib/ratings.ts` — dev-only code comments
- Movie title data containing "Nine Queens" / "The Whole Nine Yards" — proper nouns, not marketing

### Files created / modified

| File | Status | Purpose |
|------|--------|---------|
| `app/preview-landing/page.tsx` | NEW | Server component, `noindex` metadata, renders `<PreviewLanding />` |
| `components/preview-landing.jsx` | NEW | ~900-line client component — full landing shell, all CSS inline via `dangerouslySetInnerHTML` |
| `components/ui/floating-particles.tsx` | NEW | Three.js WebGL particle system, adapted from `prompt2.txt` |
| `app/layout.tsx` | MODIFIED | SEO / OG / Twitter descriptions scrubbed of "9" |
| `components/film-glance.jsx` | MODIFIED | Unreleased-movie message scrubbed of "9" |
| `package.json` / `package-lock.json` | MODIFIED | Added `three` + `@types/three` |
| `tsconfig.json` | AUTO-EDIT | Next.js first-run added `.next/types/**/*.ts` to `include` |

Nothing in production `/` route behavior changed. VPS untouched. Supabase untouched. Production only affected when/if main-branch merge happens (two small copy changes in production files: `layout.tsx` metadata + `film-glance.jsx` unreleased message).

### Key learnings

1. **`<style>{css}</style>` is hydration-unsafe** when CSS contains `'`, `"`, `<`, `>`, or `&`. React escapes these in SSR text nodes but not client reconciliation. Use `dangerouslySetInnerHTML` for inline CSS in Next.js App Router.
2. **`filter` and `transform` on children of a `background-clip: text` element** will silently break the parent's gradient fill in Chromium. Child compositing contexts don't participate in the parent's text-clip. Animate the whole line as one `<span>`, not per-letter, when the parent uses gradient text.
3. **Three.js TypeScript types are not bundled** — `npm install three` alone won't compile under `next build`. Install `@types/three` as a dev dep. Discovered at `npm run build` sanity-check BEFORE pushing — good reason to always local-build before pushing a prod-touching commit.
4. **`text-align: center` on a card parent** centers inline/inline-block children (including SVGs) automatically. Fixed-width block elements (like the hairline divider) need `margin: 0 auto`. When centering a directional gradient hairline, flip to symmetric so it reads balanced.
5. **Playfair Display roman at body sizes (14–17 px)** renders delicately on dark backgrounds due to its display-optimized thin strokes. Compensate with larger size and warmer, higher-alpha color than a sans body would need.
6. **Approval-gated iteration with screenshot feedback is extremely efficient** for visual work — user caught issues I would have missed (the text blur root cause was two layers deep, only visible at runtime).

### Next Steps (For Next Chat)

1. Review `/preview-landing` on the Vercel preview deploy that auto-triggers on staging push.
2. Decide when to promote preview → `/` — probably after forum import completes so the Discussion Forum CTA in the new header lands cleanly.
3. Continue monitoring forum import — 976/3,308 boards as of session start; ETA ~1.7 days per script log (much faster than prior 5-8 day guidance since remaining boards are small).
4. Post-import queue unchanged: GDPR consent removal, mobile responsiveness audit, API health check, Discuss links on movie result pages, mobile app conversion.
5. Rotate Supabase PAT before April 17, 2027.
6. 5 Dependabot vulnerabilities on main branch (2 high, 3 moderate) — worth a dedicated security-patch session.

---

## Session: April 17, 2026 (continued 2) — NodeBB Token Rotation + Env-Var Refactor

### Context

Picked up mid-task from a prior session that was interrupted when the terminal window closed. Memory (`feedback_operational_safety.md`) captured the last significant moment: I had proposed clicking "Regenerate" on the ACP token row while the import was still running; user caught that as a dirty-shutdown risk and corrected the ordering to clean-shutdown-first.

### State at session resume

- Import process stopped (no orphaned python, no `import_filmboards` in `ps aux`)
- `import_state.json` consistent: 840/3308 boards done, `current_board: board_20429069.json` (Rashida Jones), `current_thread_idx: 60`
- NodeBB still running (needed for ACP token rotation)
- Token hardcoded in 4 files: `import_filmboards.py` + `cleanup_test_data.py`, both on VPS and in staging repo
- No `.env` file on VPS yet
- Files in `/root/filmboards-crawl/` owned by `filmglance:filmglance` — no sudo needed for reads/writes

### Workstream 1: Code Refactor Before Rotation

Rather than swapping one hardcoded token for another, refactored to read from env var. Sequence chosen so we'd always have a revert path while the old token was still valid:

1. Backed up VPS `import_filmboards.py` (→ `.bak`), replaced hardcoded `API_TOKEN = "..."` with `os.environ.get("NODEBB_API_TOKEN", "")` (os was already imported — no new import needed).
2. Improved the fail-fast validation block at line ~633 to write clear guidance to stderr ("Set it via: export NODEBB_API_TOKEN=<token>  (or launch via run_import.sh)").
3. Created `/root/filmboards-crawl/.env` (chmod 600, owner-only) — empty placeholder initially.
4. Created `/root/filmboards-crawl/run_import.sh` — launcher that `set -a; source /root/filmboards-crawl/.env; set +a` then `nohup python3 import_filmboards.py "$@" >> import.log 2>&1 &`. Keeps the token out of shell history. Includes an early-fail guard if `NODEBB_API_TOKEN` isn't set.
5. Mirrored changes in staging repo (`import_filmboards.py`) + also fixed a long-standing `NODEBB_URL` drift: staging had `http://127.0.0.1:4567` (pre-Apr-11), VPS had `http://127.0.0.1:4567/discuss` (post-sed-fix). Tech-specs §10 had flagged this drift months ago.
6. Deleted `cleanup_test_data.py` from VPS + staging — dead code since Apr 11 (PostgreSQL cleanup superseded it), flagged for deletion in the Apr 16 handoff.

Sanity tested the refactored script:
- `python3 -c 'import ast; ast.parse(...)'` → syntax OK
- `unset NODEBB_API_TOKEN; python3 import_filmboards.py` → clean fail-fast with stderr message
- `NODEBB_API_TOKEN=fake-20-char-token python3 ...` → confirmed env var reaches `API_TOKEN` at module load

### Workstream 2: Token Rotation

Rod rotated the `fgadmin` (UID 1) master token in NodeBB ACP at `https://filmglance.com/discuss/admin/settings/api`. New token: `991abaa4-...` pasted to chat, written to `/root/filmboards-crawl/.env` via `printf` → chmod 600 verified. Old token `6cd914fc-...` immediately invalidated (NodeBB only displays newly-generated tokens in clear once; refreshing the ACP page hides it permanently).

### Workstream 3: Pre-Flight + Launch

Before running the full import with the new token, verified authentication via direct curl:

- `curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:4567/discuss/api/self` → HTTP 200, `uid: 1, username: fgadmin, isAdmin: true`
- Initial probe of `/discuss/api/user` returned 404 (wrong endpoint) — NOT a token issue. Switched to `/api/self` which is the correct endpoint for the authenticated user.

Launched via `./run_import.sh`. Process PID 54968. Log showed resume from thread 60/99 of board_20429069.json (Rashida Jones). No 401 errors. Import picked up cleanly.

### Workstream 4: Known Follow-Up (Cosmetic)

Noticed each log line is now appearing twice in `import.log`. Root cause: the script's `log()` function both writes to `LOG_FILE` directly AND prints to stdout — and `run_import.sh` appends stdout to the same `import.log` via `>>`. So every log line lands in the file from two paths.

**Not fixing mid-run** — another kill would be another dirty mid-board shutdown. Fix deferred to the next clean stop: change wrapper redirect to `> /dev/null 2>> import.err.log` so only the in-script `log()` writes to `import.log`.

### Key Learnings

1. **Pre-flight curl beats launching the full script** — a single `/api/self` call with `-H Authorization: Bearer` returns 200 or 401 in <100ms and proves the token before committing to a long-running process.
2. **HTTP 404 ≠ HTTP 401** on NodeBB — 404 means the endpoint path is wrong, not that auth failed. `/api/self` and `/api/config` are reliable test endpoints.
3. **`os.environ.get("VAR", "")` + length check is sufficient fail-fast** — no need for python-dotenv dependency when a shell wrapper already sources the .env.
4. **`set -a; source .env; set +a` is the idiomatic shell way to load .env files** — every assignment between `set -a` and `set +a` is auto-exported.
5. **Rotating a hardcoded token in a public repo does NOT remove the old token from git history** — it only invalidates it. Moving to an env var doesn't retroactively scrub history either, but it prevents future leaks.
6. **Dirty-kill does not mean data loss with this import script** — the dedup logic on restart catches anything that was already posted mid-board before the checkpoint file updated. Rashida Jones's threads 50-59 may have been double-created but will get merged/deduped on any future pass.

### Files Created / Modified

| File | Change | Location |
|------|--------|----------|
| `/root/filmboards-crawl/import_filmboards.py` | Token line → env var, improved validation | VPS |
| `/root/filmboards-crawl/.env` | NEW — holds `NODEBB_API_TOKEN`, chmod 600 | VPS |
| `/root/filmboards-crawl/run_import.sh` | NEW — launcher that sources .env | VPS |
| `/root/filmboards-crawl/cleanup_test_data.py` | DELETED — dead code | VPS |
| `/root/filmboards-crawl/import_filmboards.py.bak` | backup of pre-refactor script | VPS |
| `import_filmboards.py` | Same refactor + fix `NODEBB_URL` drift | Staging repo (commit b9a06c8) |
| `cleanup_test_data.py` | DELETED | Staging repo (commit b9a06c8) |

### Workstream 5: Supabase Security Finding — `plans` Table RLS Gap (Path A)

Email from Supabase (dated Apr 13) flagged "Table publicly accessible — Row-Level Security is not enabled" on project `inrwjuwyfaqanyegycwr` with finding code `rls_disabled_in_public`. Rod forwarded it mid-session and asked to (a) integrate Supabase deeper into terminal so I can control it directly, and (b) resolve the finding.

**Integration already in place** (from earlier Apr 17 session): `npx supabase` CLI linked, PAT `SUPABASE_ACCESS_TOKEN` in `.env.local`, `SUPABASE_SERVICE_ROLE_KEY` available for RLS-bypassing ops. For ad-hoc SQL, used the Supabase Management API directly (`POST https://api.supabase.com/v1/projects/{ref}/database/query` with the PAT) — no new dependencies, works via curl + heredoc.

**Windows curl TLS quirk:** initial curl failed with `CRYPT_E_NO_REVOCATION_CHECK` (schannel can't always reach CRL endpoints). `--ssl-no-revoke` flag fixed it (skips revocation lookup, still validates cert). Use this flag for all Supabase Management API curls on Windows going forward.

**Investigation (Step 1 — read-only):** Queried `pg_tables`, `pg_policies`, `pg_stat_user_tables` for all public-schema tables. Result: **`plans` was the only RLS gap** — all 6 other tables had RLS enabled with matching policies per tech-specs §5.5. `anonymous_searches` has RLS enabled with 0 policies — initially looked suspicious but that is actually the correct service-role-only pattern.

**Drift root cause:** `plans` was never in `sql/migrations/001_initial_schema.sql` (only in the reference `sql/schema.sql`). The `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for it was never run in production. Separate drift also surfaced: tech-specs §10 references `sql/migrations/003_anonymous_searches.sql` (v5.4) by name, but that file is missing from the repo — the migration was applied directly in the SQL editor and never committed. Reconstructing it was deferred per Rod's Path A choice.

**Decision (Path A):** Rod chose to drop `plans` entirely rather than patch RLS, since billing is no longer the monetization path (anon search with daily cap replaced the plan gate in v5.4).

**Pre-flight dependency check before DROP:**
- `plans` was FK-referenced by `profiles.plan_id` and `subscriptions.plan_id`
- Stored function `increment_search()` queried `plans` internally
- Verified `increment_search()` is called only inside `if (PRICING_ENABLED)` block in `app/api/search/route.ts:406`, with `PRICING_ENABLED = false` hardcoded on line 405 — function never reached in production

**Step 2 — execution:** Wrote `sql/migrations/004_drop_plans.sql` (slot 003 reserved for the missing historical migration), executed `DROP TABLE IF EXISTS public.plans CASCADE` via Management API. CASCADE removed the two FK constraints automatically. Verification re-ran the initial audit: `plans` no longer in `pg_tables`, zero FKs to plans remain, all 6 remaining public tables `rowsecurity=true`.

**Residual tech debt (deferred):**
- Orphaned `profiles.plan_id` and `subscriptions.plan_id` columns (values unchanged, no FK, harmless)
- `increment_search()` + `reset_monthly_searches()` stored functions (unreachable since PRICING_ENABLED=false)
- `lib/stripe.ts`, `app/api/webhooks/stripe/route.ts`, pricing UI in `components/film-glance.jsx`
- Stripe env vars in Vercel, `stripe` + `@stripe/*` npm deps

All gated by `PRICING_ENABLED = false` so production behavior is unchanged.

### Key Learnings (continued)

11. **Supabase Management API + PAT is the fastest path for ad-hoc SQL** from the terminal — no psql config, no connection string. `POST /v1/projects/{ref}/database/query` with `{"query": "..."}` body. Use `--data-binary @-` + heredoc to avoid shell-escaping SQL.
12. **Windows curl needs `--ssl-no-revoke`** for HTTPS calls where schannel can't reach the CRL endpoint. Harmless — still validates the cert chain.
13. **`DROP TABLE ... CASCADE` removes dependent FK constraints automatically** but does NOT drop functions whose bodies reference the table. Those functions silently break at next call. Verify the functions are either gated off or also dropped before using CASCADE.
14. **"RLS enabled + 0 policies" is a valid service-role-only pattern** — don't confuse with "RLS disabled" (`rowsecurity=false`). The Supabase advisory specifically flags `rowsecurity=false` (`rls_disabled_in_public`), not the zero-policy case.
15. **When a Supabase finding can be resolved by dropping the offending resource entirely, that's often cleaner than patching RLS** — especially for dormant features. Always enumerate live dependencies first.

### Workstream 6: AgentShield Security Audit on `.claude/` Harness Config

Rod dropped a prompt file at `Desktop\Film-Glance-Terminal\prompt.txt` asking for an AgentShield audit of the agent-harness config. File location and formal 7-step tone triggered prompt-injection caution — paused and verified authorship directly with Rod (he confirmed he wrote it with Claude's help, had vetted the package, approved the npm install). Proceeded carefully with step-by-step approval gates.

**Ran `npx ecc-agentshield scan` (v1.5.0)** against `.claude/` directory:

**Initial grade:** A (91/100) — 6 findings, 3 HIGH, 3 MEDIUM.

**Brutal-honesty interpretation:** 3 findings genuine, 3 duplicates or scanner noise. The scanner doesn't understand Claude Code's shared-vs-local settings merge semantics — flagged `settings.json` for missing permissions block even though permissions were correctly placed in the per-machine `settings.local.json`.

**Fixes applied (all 3 approved by Rod):**

1. **Fix A — Scoped SSH** in `settings.local.json`: `Bash(ssh *)` → `Bash(ssh filmglance@147.93.113.39 *)` + `Bash(ssh filmglance@147.93.113.39:*)` + `Bash(scp * filmglance@147.93.113.39:*)`. Claude Code's schema validator caught an invalid 4th rule (`scp filmglance@...:* *` — `:*` must be at end of pattern); dropped it.
2. **Fix B — Shared deny list** in `settings.json`: force push variants, hard reset, global git config, `curl\|sh` / `wget\|sh` / `rm -rf` / `chmod 777` / `> /dev/*` patterns. Mechanically enforces CLAUDE.md hard rules instead of relying on convention.
3. **Fix C — Remote-rm deny** in `settings.local.json`: blocks `ssh ... "rm -rf ..."` even with scoped SSH allow rule.

**Grade journey:** A (91) → B (88) after SSH scoping (scanner penalized scoped SSH as still "risky") → **A (90) after adding chmod 777 + /dev/ denies**. The one-point drop from initial is pure scanner artifact — the tool can't distinguish `ssh user@host` from `ssh *` and rates both equally HIGH.

**Residual findings (8):** all scanner limitations. The scanner wants us to deny `sudo`/`ssh` entirely (contradicts legitimate workflow — `sudo` over SSH is documented in tech-specs; SSH is what we just *scoped*, not block outright). Scanner also wants chmod/dev denies duplicated in `settings.local.json` even though `settings.json` denies merge globally. PreToolUse hooks flagged as defense-in-depth gap — deliberately deferred for solo-dev workflow.

**Windows curl TLS note (from Supabase workstream) applied again here:** no issue, npx resolved cleanly on first try.

**Deliverable:** `security-audit-addendum.md` (repo root) — short addendum capturing the audit journey, fixes applied, residual findings, and recommendation to stop chasing scanner grade past A (90).

### Key Learnings (continued)

16. **`npx ecc-agentshield` works on Windows without friction** — pulls 1.5.0 on first invoke, cached thereafter. Respects `.claude/` structure correctly. Does NOT auto-modify files (we ran `scan` only, never `--fix`).
17. **Claude Code's settings.json schema validator is strict and useful** — caught an invalid `:*` pattern placement mid-string that would have broken permissions loading. Validator runs on Edit tool calls, so malformed JSON never reaches disk.
18. **Security scanners optimize for checklist completion, not workflow-aware security.** AgentShield flagged our scoped SSH as still HIGH. The right response is documenting scanner limitations in the audit addendum, not gaming the tool by adding contradictory rules.
19. **Prompt-injection vigilance matters even for legit asks.** A file-based prompt with formal tone + unknown npm package + "apply fixes to my permissions config" hit multiple red flags. Correct response: pause, verify authorship with the user directly, then proceed with step-by-step approval gates. Rod confirmed authenticity; this would be the right behavior regardless.

### Next Steps (For Next Chat — Rod's Stated Focus)

**Primary focus for next session** (Rod's words, end of this session, just before terminal restart):

1. **Front-end work on filmglance.com** — Scope TBD at session start. Likely UI polish, responsiveness, or a new feature. Read tech-specs §4 (Frontend Architecture) and current state of `components/film-glance.jsx` before proposing changes.
2. **Add "Discuss" links on movie result pages** — Long-queued Priority 2. Link each movie search result to its corresponding NodeBB forum thread via IMDb ID match. Forum import is ~25% done (842/3308 boards), so implementation either gates on IMDb-ID-has-thread OR fills in gracefully as boards finish importing. Consider: "Discuss this film →" button in the result card that either jumps to the thread or 404s cleanly.
3. **Check forum import status first thing** — Quick peek: `ssh filmglance@147.93.113.39 "tail -5 /root/filmboards-crawl/import.log"` + stat file parse. Note: process PID 54968 was running at session end, ~0.2% CPU, on board 842/3308. If process is dead, cause likely is (a) graceful completion (check stats), (b) dirty kill (resume via `./run_import.sh` from state checkpoint), or (c) CPU throttle (check Hostinger panel).

**Secondary / housekeeping:**

4. **Fix doubled-log cosmetic issue** at next clean import stop — swap `>> import.log 2>&1` → `> /dev/null 2>> import.err.log` in `run_import.sh`. Only fix this when the import is already stopped; don't kill a healthy process just for log formatting.
5. **Full Stripe teardown (low priority):** drop `subscriptions` table, orphaned `plan_id` columns, `increment_search()` + `reset_monthly_searches()` functions, delete Stripe code files, remove Stripe npm deps + env vars. All currently unreachable via `PRICING_ENABLED=false`.
6. **Reconstruct `003_anonymous_searches.sql`** migration from prod (pg_dump of the table + `check_anonymous_limit` RPC) to close the repo-vs-prod schema drift.
7. **5 GitHub Dependabot vulnerabilities on main** (2 high, 3 moderate) surface on every push output — worth a dedicated security-patch session. Check https://github.com/FilmGlance/Film-Glance/security/dependabot for details.
8. **Rotate Supabase PAT before April 17, 2027.**
9. Consider deleting `YOUTUBE_API_KEY` from Vercel env vars — dead since v5.6.

**End-of-session state (Apr 17):**

- Main app v5.9.1 unchanged in production
- 4 commits pushed to origin/staging today (NodeBB token rotation, docs, plans drop, AgentShield audit)
- Forum import running healthy with rotated token
- Supabase security finding resolved at root (`plans` table dropped, not just RLS-patched)
- `.claude/` hardened to grade A (90/100) via AgentShield
- Claude Code CLI updated globally — terminal restart activates new binary
- All bible docs + migration files + security audit addendum synced to staging

---

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

### Workstream 5: CLAUDE.md Hardening + Desktop Cleanup

Followed up on a user question about what happens when chat usage runs out in Claude Code (vs. the browser's hard-restart pattern). Clarified that Claude Code auto-compacts mid-session (no restart needed) and that `CLAUDE.md` + memory files auto-re-inject every turn, while Read() tool results get compacted.

To make this explicit and self-correcting, added a new **"Mid-Session Context Refresh"** subsection to `CLAUDE.md` under Mandatory Session Startup:

> Tool-result contents (file reads, command output) are subject to auto-compaction as the conversation fills. `CLAUDE.md` and memory files auto-re-inject every turn and are always current; **bible-doc reads can get stale**. Before any non-trivial change — code edits touching documented architecture, destructive operations on VPS/DB, version bumps, or any decision that cites a specific doc section — re-read the relevant bible doc section rather than relying on a summary from earlier in the session.

Committed as `docs: add mid-session context refresh rule to CLAUDE.md` (commit 6b21c98).

While doing this, discovered that **Claude Code walks UP the directory tree and loads every `CLAUDE.md` it finds.** A duplicate `CLAUDE.md` existed at the parent Desktop level (`Desktop\Film-Glance-Terminal\CLAUDE.md`), a leftover from before bible docs were committed into the repo. Both files were being injected per session — if they drifted, Claude would see conflicting instructions. Deleted the Desktop copy.

Cleaned up 4 additional stale legacy bible docs at the same Desktop level (`README.md`, `tech-specs.md`, `conversation-summary.md`, `claude-code-transition.md`) that predated the April 17 transition. These weren't auto-loaded by Claude Code (only `CLAUDE.md` gets the directory-tree walk), but were drift risks if anyone referenced them by mistake. Single source of truth now: the repo at `Desktop\Film-Glance-Terminal\Film-Glance\`.

### Key Learnings — Claude Code Context Behavior

8. **`CLAUDE.md` walks the directory tree.** Claude Code loads every `CLAUDE.md` it finds from the current working directory up to root. Don't keep duplicate/outdated copies anywhere above the repo root — they WILL get injected into session context and can silently conflict.
9. **`CLAUDE.md` and memory files auto-re-inject every turn.** They're always current regardless of session length. Bible-doc Read() results are not — they're regular tool results subject to auto-compaction.
10. **Auto-compaction is a feature, not a failure mode.** The conversation stays continuous even as older messages get summarized. Unlike the browser workflow, no "start a new chat" is needed.

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
