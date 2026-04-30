# Film Glance — Conversation Summary

## Session: April 30, 2026 (continued, round 6) — v5.12.0 /boxoffice page (architecture pivot mid-impl, BOM-direct scraping)

User picked the Box Office page from the standing queue as the next project. Provided two prompts in `BoxOffice/`: `prompt.txt` (initial requirements) + `prompt2.txt` (added the freshness/automation pillar). Plus `aianalysis.docx` (Gemini + ChatGPT data-source analysis) and 12 reference screenshots from Rotten Tomatoes / IMDB / Box Office Mojo for design inspiration.

Plan went through 3 revisions before approval:
- **v1**: Apify + RapidAPI hybrid, latest-period only.
- **v2**: After user pointed out users need historical browsing too, added one-shot RapidAPI 1984-2024 backfill + period navigator UI + more cinematic visual treatment (hero #1 card with TMDB backdrop, count-up gross, stagger-fade rows). Locked architecture choices: Path B hybrid, "Seasonal" follows BOM convention, Resend email for failure alerts. Accepted "1 out of 4 movies still twitch — manageable" residual on the v5.11.0 cycle and merged that to main earlier in this session arc (PR #51 → production v5.11.0).
- **v3 (during impl)**: Phase 0 verification revealed Apify's `trovevault/movie-box-office-tracker` Actor is a **per-movie career-stats lookup tool, not a chart/ranking source** — its input schema is a list of titles, output is per-film budget/gross/ROI. The docx's claim that it offers "weekend and weekly box office rankings" was based on the Actor's marketing description, not its actual schema. Searched Apify's full store for any other box-office-mojo chart Actor — none exist. Pivoted to **direct BOM cheerio scraping** for both ongoing weekly cron AND full historical backfill. Verified BOM's chart pages are publicly accessible with consistent table structure: `/year/YYYY/`, `/month/{name}/YYYY/`, `/season/{name}/YYYY/`, `/weekly/YYYYWNN/`. User confirmed: "A but also we also need to scrape, and potentially cache BOM's entire domestic historical dataset."

### Final architecture (v5.12.0)

| Layer | What | Why |
|---|---|---|
| Schema | `box_office_metrics` (sql/013) + `cron_failures` (sql/014) | Idempotent upsert keyed on natural composite + generic job-failure log resolved on next success |
| Scraper | `lib/bom-scraper.ts` (cheerio, 4 chart types) | Single source — BOM. URL patterns + table headers verified live |
| Cron | `app/api/cron/box-office/refresh` (Tue 11:00 UTC) | Refresh latest completed week + current month/season/year. ~10-20s total runtime |
| Backfill | `app/api/admin/backfill-bom` (per-`year × period_type`) | Operator shell loop 1984..2024. ~2,760 page fetches, ~100-150 min |
| Read API | `app/api/boxoffice/route.ts` | Joins `fg_score` from `movie_cache` per row; "score pending" for misses |
| UI | `app/boxoffice/page.tsx` + `components/box-office/*` (8 files) | TMDB-backdrop hero, count-up gross, stagger-fade rows, period navigator |
| Alerting | `lib/alert.ts` (Resend REST, no SDK) | `sendAlertEmail` + `logCronFailure` + `markCronFailuresResolved` |
| Hooks | `lib/use-count-up.ts` | rAF-driven number animation |
| Refactor | `sanitizeQuery()` → `lib/sanitize.ts` | Cron + search + backfill all reuse the same key normalization |

### Key engineering moves

1. **Header-driven cheerio parser** — built a tiny `buildColumnMap($)` helper that reads the first `<tr>` `<th>` labels into a `header → index` map, then row parsing pulls cells by name. Resilient to minor BOM column reorders. The same parser handles both periodic (year/month/season — 11 columns) and weekly (10 columns with LW + Average + Weeks) tables; row parsers differ but column-lookup is shared.

2. **`enrichBoxOfficeWithTMDB()` separate from `enrichWithTMDB()`** — the existing search-flow enrichment fetches credits + streaming + trailer + recommendations + video reviews. Way too heavy for cron-time enrichment of 10 films. New helper does only what the box office page needs: `poster_path + backdrop_path + tmdb_id + imdb_id` from search + `/movie/{id}?append_to_response=external_ids`. Two HTTP calls instead of seven.

3. **`ensurePosterAndBackdrop()` cache cascade** — `lib/box-office-upsert.ts` looks for poster/backdrop in this order: prior `box_office_metrics` row (cheapest, since most BOM Top-10s recur across periods), then `movie_cache` (existing search-result data), then live TMDB lookup. Most ingests after the first hit cache instantly.

4. **URL state with `useSearchParams` + `router.replace`** — page is shareable (`/boxoffice?period=monthly&date=2024-03-01` works) and back-button-safe. Avoided installing SWR — single round-trip per filter change, simple `useEffect(fetch)` is enough.

5. **Cinematic register without "AI slop"** — backdrop layer + hero count-up + stagger-fade come from production-grade typography + real movie posters/backdrops, not glow-everywhere chrome. Filter chips reuse the existing `.fg-shiny` pattern from Favourites (familiar, themed). International "Coming Soon" pill surfaces the v2 roadmap visibly so users see a promise rather than a dead button.

### Skills + auto-suggestions

Several auto-suggested skills (workflow, react-best-practices, runtime-cache, swr, json-render, email, routing-middleware, vercel-cli, geistdocs, vercel-api, etc.) all skipped as disproportionate or false-positive matches. Loaded `vercel-functions` and `nextjs` only when genuinely relevant. Auto-suggested "long-running" warnings on `setTimeout` polite-throttle calls were false alarms (~10-20s total runtimes well under 300s budget — Vercel Workflow would be overkill).

### Files touched

| Type | Files | LOC |
|---|---|---|
| New | `app/api/admin/backfill-bom/route.ts`, `app/api/boxoffice/route.ts`, `app/api/cron/box-office/refresh/route.ts`, `app/boxoffice/page.tsx`, `components/box-office/*` (9 files), `lib/alert.ts`, `lib/bom-scraper.ts`, `lib/box-office-upsert.ts`, `lib/sanitize.ts`, `lib/use-count-up.ts`, `sql/migrations/013_box_office_metrics.sql`, `sql/migrations/014_cron_failures.sql` | ~2,000 |
| Modified | `app/api/search/route.ts` (sanitizeQuery import + inline removal), `components/film-glance.jsx` (nav link + FG_VERSION 5.11.0 → 5.12.0 + mobile breakpoint hide), `lib/tmdb.ts` (added `enrichBoxOfficeWithTMDB()`), `vercel.json` (cron entry), `package.json` (cheerio + resend), `tech-specs.md` (Change Log §10 + Version History §9), `conversation-summary.md` (this entry) | ~150 |

### Deferred (user-action, not blocking commit)

- Apply migrations 013 + 014 via Supabase web SQL editor (or MCP after OAuth).
- Set Vercel env vars: `RESEND_API_KEY`, `ALERT_EMAIL_TO` (recipient).
- Verify Resend's DKIM/SPF/TXT records in Cloudflare DNS for `filmglance.com`.
- After staging deploy: `curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/box-office/refresh` to validate ingestion end-to-end.
- After ingestion validates: kick off historical backfill shell loop (1984..2024 × 4 period_types).
- Mobile parity check on Vercel preview at 360 / 480 / 640 / 1380 widths before merging staging → main.
- Optional post-deploy: `/schedule` a watchdog agent for weekly staleness checks.

### Key learnings

1. **API marketing descriptions ≠ API capabilities.** The Apify Actor's marketing literally said "track domestic weekend and weekly box office rankings" — the actual input schema was a list of movie titles for per-film lookup. Always verify against the actual `inputSchema` in the Actor build metadata (the docx and even the seoTitle didn't reveal this gap).
2. **When scraping is upstream of every "vendor" anyway, cut out the middleman.** Apify's box-office Actor scrapes BOM. `boxoffice-api` Python scrapes BOM. RapidAPI's 1984-2024 scrapes BOM. So we just scrape BOM directly: same source, no per-call billing, no broker between us and the upstream.
3. **Header-driven parsing >> column-position-based parsing.** Building a `header → index` map from the first `<tr>` is 5 extra lines of code and means a 1-column BOM reorder doesn't break us at all. With column-position parsing we'd be tracking which BOM page has which column where.
4. **Auto-mode + plan approval = focus.** Pivoting mid-impl from Apify to BOM-direct was a real architectural change (different lib, different data path), but having an approved plan to anchor against meant the pivot was scoped surgically (replace `lib/apify.ts` with `lib/bom-scraper.ts`; everything downstream — schema, cron, UI — was unchanged). The plan acted as a fixed surface; the pivot just changed which module fed it.

### Next session

1. User reviews `/boxoffice` on Vercel preview after committing migrations + env vars.
2. Run cron once via curl, verify rows land.
3. Start historical backfill (~2-3 hours supervised).
4. PR staging → main; mark v5.12.0 in production in next session's bible doc update.
5. Then: v5.11.1 (Claude prompt split — already pre-accepted ~2x cold-cache API cost for −1 to −2s real latency).

---

## Session: April 30, 2026 (continued, round 5) — v5.11.0 merged to main; pivot to next project

User merged PR #51 via the GitHub web UI. Production at v5.11.0 (filmglance.com). Pre-merge clarification: discussed dropping `runtime = "edge"` to avoid long-term 25s-timeout monitoring; user opted to keep edge runtime ("it'll never go past 25 seconds anyway") with no proactive monitoring. PR #51 final scope = edge runtime + waitUntil migration + sidebar active-tracking fix + transition twitch fix. User reported twitching reduced from significant-on-2-of-3 movies to minor-on-1-of-4 — accepted as a manageable residual, not blocking. Bible docs updated to mark v5.11.0 in production.

Pivoting to next project (TBD by user).

---

## Session: April 30, 2026 (continued, round 4) — v5.11.0 staging cycle round 2 — sidebar active-tracking + transition twitch fix

User tested v5.11.0 (round 1: edge runtime + waitUntil migration) on the Vercel preview after PR #51 was opened. Confirmed warm cache-hit returns instantly. Flagged two bugs surfaced during the same testing:

1. **Sidebar active-section mistracking** — sidebar highlight doesn't track the section the user is actually reading; sometimes lags, sometimes goes backwards as user scrolls forward.
2. **Page "twitching" while scrolling** — described as "everything shrinks and inflates, fonts change for a moment, looks like its all about to break."

Neither is caused by v5.11.0 (which was a backend-only edge migration); both are pre-existing frontend bugs surfaced during this testing pass.

### Video evidence

User provided two screen recordings: `Mobile/video.mp4` (phone-recorded, low resolution) and `Mobile/video2.mp4` (1920×1080 60fps Windows screen recording, 123 sec, 3 movie searches). The Read tool can't process binary mp4, but `ffmpeg` is available on the system. Workflow: extracted frames at 0.2 fps for overview, then 2 fps for the heavy-twitch zone (50-85s), saved to `scratch/video-frames/` and `scratch/dense/` (gitignored). Read frames as JPGs.

### Diagnosis #1 — sidebar active-section mistracking

Frame-by-frame review of dense frames (every 0.5s during search 2's "the shining" result-load + scroll):

| Frame | Time | Visible content | Sidebar highlight | Verdict |
|---|---|---|---|---|
| d14 | 57s | True Rating Score | True Rating Score | ✓ |
| d18 | 59s | Source Breakdown rows | Source Breakdown | ✓ |
| **d19** | **59.5s** | **Source Breakdown rows** | **True Rating Score** | **REVERT** |
| d24 | 62s | Thumbs Up & Down | Source Breakdown | ✗ Lag |
| d28 | 64s | Thumbs Up & Down | Source Breakdown | ✗ Lag |

The d18→d19 *revert* (highlight goes BACKWARDS as scroll continues forward) is diagnostic. Inspecting `components/film-glance.jsx:497-512`:

```js
new IntersectionObserver(
  (entries) => {
    const visible = entries.filter(e => e.isIntersecting);
    if (visible.length === 0) return;     // ← bug A
    const top = visible.sort((a, b) =>
      a.boundingClientRect.top - b.boundingClientRect.top
    )[0];                                  // ← bug B
    setActive(top.target.id);
  },
  { rootMargin: "-120px 0px -55% 0px", threshold: [0, 0.1, 0.5] }
)
```

- **Bug A (early return):** IO callback fires entries whose intersection state CHANGED. When a section leaves the rootMargin zone, that batch may contain only that *leaving* entry (`isIntersecting: false`). The early-return throws away that update, leaving the highlight stuck on the previously-active section.
- **Bug B (wrong sort direction):** The sort picks the smallest (most-negative) `boundingClientRect.top`, i.e. the section furthest *above* the viewport. When two sections are both intersecting the rootMargin zone, the one above the viewport wins. Hence the user-visible "highlight goes backwards as I scroll forward."

### Diagnosis #2 — twitching

No frame in the dense sample shows obvious layout shift between adjacent frames (header stable, fonts stable). Two contributing factors visible:

1. **OBS encoder overloaded:** `f25` shows the OBS Studio control window with "Encoding overloaded — 22.15 / 60.00 FPS" warning. The recording is dropping frames at the encode side, which produces playback judder unrelated to actual page behavior.
2. **Sidebar-pulse hypothesis:** the sidebar items used `transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)"`. Combined with the IO mistrack rapidly flipping `isActive` on/off, every animatable property (background, border-color, color, box-shadow, padding) transitioned simultaneously per spurious flip. `font-weight: 500 ↔ 700` switches instantly (non-transitionable), creating a stuttering visual pulse on the sidebar that may have been perceived as broader page-chrome twitch.

User did report observing twitching directly in browser (separate from recording), so there's still a real signal — just not one I could pin to a specific deterministic cause from the frames alone. Strongest single fix attempt: narrow the `transition: all` to specific properties to prevent simultaneous-property-pulse. If twitching persists after this commit, we'll need a follow-up investigation (layout-shift trace, font-loading event audit, hydration check).

### The two-edit fix (commit `f86fba2`)

Both edits in `components/film-glance.jsx` inside `function ResultSidebar`:

```diff
- useEffect(() => {
-   const observer = new IntersectionObserver(
-     (entries) => {
-       const visible = entries.filter(e => e.isIntersecting);
-       if (visible.length === 0) return;
-       const top = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
-       setActive(top.target.id);
-     },
-     { rootMargin: "-120px 0px -55% 0px", threshold: [0, 0.1, 0.5] }
-   );
-   sections.forEach(s => {
-     const el = document.getElementById(s.id);
-     if (el) observer.observe(el);
-   });
-   return () => observer.disconnect();
- }, [result?.title, sections.length]);

+ useEffect(() => {
+   const triggerY = 140;
+   let rafId = null;
+   const compute = () => {
+     rafId = null;
+     let activeId = sections[0]?.id || "";
+     for (const s of sections) {
+       const el = document.getElementById(s.id);
+       if (!el) continue;
+       if (el.getBoundingClientRect().top <= triggerY) {
+         activeId = s.id;
+       } else {
+         break;
+       }
+     }
+     setActive(prev => prev === activeId ? prev : activeId);
+   };
+   const onScroll = () => {
+     if (rafId) return;
+     rafId = requestAnimationFrame(compute);
+   };
+   compute();
+   window.addEventListener("scroll", onScroll, { passive: true });
+   return () => {
+     window.removeEventListener("scroll", onScroll);
+     if (rafId) cancelAnimationFrame(rafId);
+   };
+ }, [result?.title, sections.length]);

- transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
+ transition: "background 0.25s ease, border-color 0.25s ease, color 0.25s ease, box-shadow 0.3s ease",
```

Why this is robust: walks `sections` in document order (verified at `film-glance.jsx:4212` — array literal is in render order). Picks the LAST section whose top has crossed 140px (just below sticky header). Stops as soon as it finds a section whose top is below the trigger (subsequent sections are even further below). rAF-throttled to ~60 Hz. `setActive` short-circuits when the value hasn't changed, so React re-renders only on actual section changes (typically <10 per page scroll).

### Files touched

| File | Change |
|---|---|
| `components/film-glance.jsx` | IO useEffect → rAF scroll listener; transition narrowed |
| `tech-specs.md` | New ✅ CURRENT STATE row; prior v5.11.0 row demoted to 🚧 SUPERSEDED |
| `conversation-summary.md` | This entry |

### PR scope decision

PR #51 was originally scoped strictly as "v5.11.0 — edge runtime + waitUntil migration". Bug-fix commits land on `staging` and auto-ride PR #51 (since the PR tracks staging→main). Three options were considered:

- A. Commit to staging, expand PR #51 scope, update title/body. Easiest. Single PR ships both. **CHOSEN.**
- B. Cherry-pick the fix to a separate branch off main, open separate PR. Cleanest scope but git contortion.
- C. Wait — merge PR #51 first, then apply fixes. Cleanest sequence, but loses preview-verification of fix until merge.

User picked A. PR title and body to be updated to reflect the expanded staging-cycle scope, matching the precedent set by PR #47 (v5.10.35-37, multiple iteration rounds in one PR).

### FG_VERSION decision

Kept at `5.11.0`. Project pattern would suggest a bump per iteration round (v5.10.35→36→37 each bumped), but: v5.11.1 is reserved for prompt-split, and v5.11.0.1 would introduce a 4-segment scheme not used elsewhere in the project. The change-log row explicitly tags this as "v5.11.0 staging cycle round 2" so the version string stays clean.

### Key learnings

1. **`transition: all` is a footgun anywhere a state can briefly oscillate.** When state flips spuriously (e.g., due to a bug elsewhere in the system), every animatable property pulses simultaneously. Narrow `all` to the specific properties you actually want to animate.
2. **IntersectionObserver active-tracking has subtle correctness traps.** Two specifically: (a) the callback only fires on STATE CHANGES, so if you don't track all entries you'll miss "leaving" events; (b) `boundingClientRect.top` ordering needs care — usually you want the section closest to the trigger line that's NOT past it, not the section with the smallest top. The simpler, more robust pattern is a rAF-throttled scroll listener walking sections in document order. Doc sites like the React docs use this exact approach.
3. **Phone-recorded videos can't be Read by the tool, but `ffmpeg` is available** on this system and frame extraction at strategic intervals (overview 0.2 fps, dense zone 2 fps) is enough to do frame-by-frame visual diagnosis. Save extracted frames to `scratch/` so they don't get committed.

### Next steps

1. User reviews v5.11.0 staging cycle round 2 on Vercel preview (`film-glance-git-staging-rs-projects-c0025ef0.vercel.app`). Specifically: cold-search a movie not yet in cache, scroll through the result page, watch the sidebar highlight track the section being read. Re-test the twitching scenario.
2. If sidebar tracking is correct AND twitching is gone (or substantially reduced), merge PR #51 to main.
3. If twitching persists, follow-up investigation: layout-shift trace via DevTools Performance panel, font-loading event timeline, possible hydration mismatch on edge-rendered routes.
4. After PR #51 merges: queue up **v5.11.1** (Claude prompt split, ~2x API cost on cold cache, user-pre-accepted).

---

## Session: April 30, 2026 (continued, round 3) — v5.11.0 edge runtime + waitUntil migration

User opened the session by asking me to read the bible docs and then "proceed with starting v5.11.0". The previous session (PR #50, v5.10.40) had captured a three-sub-round plan for v5.11.x in `tech-specs.md` §10 and committed it as `1efaa4a docs: capture user-approved v5.11.0 plan for next session`. This session implements sub-round 1.

### What v5.11.0 is (per the previously approved plan)

The user's plan (codified in the Apr 30 v5.10.40 row of tech-specs §10) split the latency-improvement work into three independently-shippable sub-rounds:

- **v5.11.0** (this session): edge runtime + `waitUntil` migration. Mechanical, low risk. Net: −450ms cold start.
- **v5.11.1** (later): Claude prompt split into two parallel calls (core ~1500 tokens / rich ~1000 tokens via Promise.all). Net: −1 to −2s actual latency, accepts ~2x API cost.
- **v5.11.2** (later): streaming JSON over SSE. Net: ~500ms perceived first-paint vs 3-5s today.

This session ships only sub-round 1. The user's stated risk acceptances were unchanged from the planning row.

### Pre-edit audit

Before touching code, audited the search route + lib/* modules for edge compatibility:

| Module | Edge-safe? | Reason |
|---|---|---|
| `@supabase/supabase-js` v2 | ✓ | Fetch-based, no Node imports |
| `lib/tmdb.ts` | ✓ | Pure fetch, no imports at all |
| `lib/ratings.ts` | ✓ | Pure fetch, no imports at all |
| `lib/score.ts` | ✓ | Pure-JS calculation |
| `lib/rate-limit.ts` | ✓ (with caveat) | In-memory `Map` already documented as per-instance scope; on edge becomes per-isolate scope, functionally equivalent |
| `lib/supabase-server.ts` | ✓ | Just calls `createClient` with URL + service-role key + auth options |

Only one risk worth surfacing: edge has a hard 25s timeout (vs Fluid Compute's 300s). The search route uses `AbortSignal.timeout(18000)` for Anthropic plus parallel TMDB + verified-ratings calls — typical 4-10s, but slow tail could push toward 20s. Watch for 504s post-deploy; if any appear the surgical revert is to drop `runtime = "edge"` and keep the `waitUntil` migration on Node serverless (still a pure improvement on its own).

### Plan correction

The change-log row said "8 fireAndForget call sites at lines 122/511/521/597/605/649/771" — that's 7 line numbers but says "8 sites". Actual grep: 7 call sites. The previous session's planning miscounted by one. The 7 sites are at (post-v5.10.40) lines 122, 515, 525, 601, 609, 653, 775 — same set, just shifted slightly by intervening commits.

### Implementation choice — helper rename vs literal call-site replacement

The plan literally said "replace 8 `fireAndForget(...)` call sites with `waitUntil(...)`". The most literal interpretation produces 7 verbose blocks like `waitUntil((async () => { ... })().catch(err => console.error("[label]", err)))`. The cleaner alternative is to keep the helper but rename it (`fireAndForget` → `runInBackground` since it's no longer truly fire-and-forget) and update only its 1-line body to call `waitUntil`. Same end behavior, much more readable.

I went with the helper-rename approach. Documented this deviation in the onboarding message before making any edits, so it's reviewable. The user can request a different shape on review.

### Files touched

| File | Change | Lines |
|---|---|---|
| `package.json` | Added `@vercel/functions: ^3.4.6` to dependencies | +1 |
| `package-lock.json` | Lockfile update for `@vercel/functions@3.4.6` + transitive `@vercel/oidc@3.3.1` | +30 |
| `app/api/search/route.ts` | `import { waitUntil }`, `export const runtime = "edge"`, helper rename + body migration, 7 call-site renames | +13 / −7 |
| `components/film-glance.jsx` | `FG_VERSION` 5.10.40 → 5.11.0 | +1 / −1 |

Helper before/after:

```diff
- function fireAndForget(fn: () => Promise<any>, label: string) {
-   fn().catch((err) => console.error(`[${label}]`, err));
- }
+ function runInBackground(fn: () => Promise<any>, label: string) {
+   waitUntil(fn().catch((err) => console.error(`[${label}]`, err)));
+ }
```

### Build verification

- `npx tsc --noEmit` — clean, zero errors.
- `npx next build` — edge bundle for `/api/search` produced (`.next/server/edge-runtime-webpack.js` exists; compiled `route.js` contains 6 `waitUntil` / `edge` literal occurrences confirming the runtime export was honored).
- Same `next build` *also* produces prerender errors on `/`, `/preview-landing`, `/_not-found`, `/404`, `/500`. **These are pre-existing and unrelated to v5.11.0** — caused by Windows path-casing inconsistency (CWD reported as `film-glance-terminal` lowercase vs Windows-resolved `Film-Glance-Terminal` TitleCase, which makes webpack treat React as two different modules → `useContext` returns null during static generation). Absent on Vercel's Linux build because Linux is case-sensitive. Production at v5.10.40 already builds fine on Vercel; this is purely a local-shell quirk.

### Key learnings

1. **Plan + audit before code, even on a "mechanical" change.** The plan said "8 call sites"; reality was 7. Five minutes of grep confirmed the discrepancy before any edit, avoiding a confused diff later. Even mechanical changes benefit from a quick first-hand verification pass.
2. **`waitUntil` is a pure improvement over fire-and-forget regardless of runtime.** The semantic guarantee (background work completes after response) holds on Node serverless and edge. The reason to bundle it with the edge migration is that they share a deploy + risk window; either one alone would still help.
3. **Skill loading: be selective.** This session received auto-suggestions for `bootstrap`, `runtime-cache`, and `react-best-practices` — none of which were proportionate to the work. Loaded `vercel-functions` and `nextjs` because those genuinely covered `waitUntil` semantics + edge constraints (25s timeout, V8 isolate API surface). The cost of loading an unrelated skill is real (token budget + cognitive distraction), so match the skill to the task.

### Next steps

1. **User reviews diff on Vercel preview** at `film-glance-git-staging-rs-projects-c0025ef0.vercel.app` (the staging-branch preview URL pattern from prior sessions). Cold-search a movie that has no cache entry to test the edge cold-start path. Cold-search a movie that DOES have a cache entry to test the warm cache-hit + `waitUntil` background path.
2. **PR `staging → main`** if preview looks clean. Watch first day's runtime logs for any 504s that suggest edge timeout — if so, drop `runtime = "edge"` (keep waitUntil) as the surgical fix.
3. **Then v5.11.1**: Claude prompt split into two parallel calls. Different shape of risk — splits one giant prompt into two more-focused ones, doubles per-search API cost on cold cache (already accepted by user).
4. **Then v5.11.2**: streaming JSON over SSE. Highest-effort sub-round; needs partial-JSON state handling on the client without flicker.

Standing-queue items unchanged from prior session: VPS forum import (post-import cleanup queue), 6 Dependabot vulns, Supabase PAT rotation before Apr 17, 2027, dead `YOUTUBE_API_KEY` in Vercel env, missing `003_anonymous_searches.sql`, optional Stripe teardown, `2026-05-12 13:00 UTC` scheduled cleanup agent.

---

## Session: April 30, 2026 (continued, round 2) — Phase 3 mobile pass — ticker + film-strip animation visibility (v5.10.38)

PR #47 (Phase 1) + PR #48 (Phase 2) merged. User asked to start Phase 3.

### What Phase 3 is

Phase 3 came out of the v5.10.34 mobile audit suspicion: the landing-page `tickerScroll` (Review Sites Included) + `filmScroll` (What You'll Find strip) infinite animations might appear "frozen" on narrow phones because the user only sees 2 frozen items at a time.

### Diagnosis

Read the existing CSS:
- `.ticker-track`: 44s desktop / 32s at ≤860 (existing v5.10 rule); track width ~12 items × ~150px + 44px gap ≈ 2300px. translateX(-50%) → 1150px / 32s = 36 px/s perceived motion. An item passes through 360px viewport in ~10 seconds.
- `.film-track`: 56s with NO existing mobile rule. 6 features × 244px (or 210 at ≤860) ≈ 1500px track. translateX(-50%) → 750px / 56s = 13 px/s. An item passes through 360px viewport in ~28 seconds — basically static.
- Masks: ticker 7%/93% (14% faded), film 5%/95% (10% faded). On 360px → 50px each side faded for ticker, 36px for film.

Verdict: animations are running, just painfully slow on narrow viewports. The film-strip in particular is effectively static.

### Fix — single `@media (max-width: 640px)` block

- `.ticker-track`: 32s → 22s (faster), gap 44→32 (more items in viewport)
- `.ticker-item`: gap 14→10, span font 16→14
- `.ticker-viewport` mask: 7%/93% → 4%/96% (wider visible window)
- `.film-track`: 56s → 28s (twice as fast)
- `.film-frame`: 210 → 170, height 180 → 158, padding 22/20 → 18/16 (so 360 viewport sees 2 frames simultaneously)
- `.film-track-viewport` mask: 5%/95% → 3%/97%
- `.film-title`: 17 → 14 (was 15.5 at ≤860; tighter)
- `.film-body`: 12.5 → 11.5

### Audit precaution: opacity:0 + animation pairs

Per the Phase 2 NEXT STEPS note, grepped the codebase for `opacity: 0` inline paired with `animation: ... softFade|fadeIn`. Only **2 hits**:

- Line 3572 — `.fg-fav-card` (already protected by v5.10.36 reduce-motion `opacity: 1 !important`)
- Line 4847 — `.dym-card` (already protected by v5.10.36 reduce-motion `opacity: 1 !important`)

No other elements match the pattern. The opacity-stuck-at-0 landmine is fully covered.

### What's NOT in Phase 3

- Phase 4 (formal responsive contract in §11) — still queued
- Continuous-animation reduce-motion handling — currently the ticker/film-strip animations DON'T have explicit reduce-motion overrides, meaning they keep running on phones with battery saver. Open question whether that's a problem (vestibular concern) or fine (decorative motion is short and slow). Defer until user feedback.

### Files modified

| File | Lines | Purpose |
|------|-------|---------|
| `components/film-glance.jsx` | +21 / -1 | New @media (max-width: 640px) block speeding up ticker + film-strip; FG_VERSION 5.10.38 |
| `tech-specs.md` | +1 row | Change Log: v5.10.38 entry, prior CURRENT STATE row tagged SUPERSEDED |
| `conversation-summary.md` | NEW SESSION | This entry |

### Key learnings

1. **Animation duration scales with viewport width even when track width doesn't.** A 56s loop is fine on a 1440px desktop (visible motion = good chunk of track per second). On a 360px phone with a fixed-width track, the same 56s feels frozen because the visible window is so much smaller. The fix is to scale duration with viewport, not just adjust other dimensions.
2. **Mask edges look wider than they are at narrow viewports.** A 7% mask on 1440px = 100px each side; on 360px = 25px. The 25px is proportionally bigger relative to the visible content area, so it visually dominates more on mobile. Narrowing the mask percentage on mobile (7% → 4%) makes more sense than scaling the track.
3. **Audit-then-act for known landmine patterns.** The opacity:0+animation grep took 5 seconds and confirmed there's nothing else hiding. Worth doing every time a new pattern is identified — adds the audit to the "find similar problems" pass before declaring a class of bug fixed.

---

## Session: April 30, 2026 (continued) — Phase 2 mobile sweep (v5.10.37)

User confirmed v5.10.36 fixes work on real phone, opened PR #47 (v5.10.35-36 → main), then asked to start Phase 2.

### Phase 2 audit + plan (user-approved)

Walked through every result-page section that didn't yet have a mobile breakpoint. Findings + pattern picks:

| Priority | Section | Pattern | Done? |
|---|---|---|---|
| **HIGH** | Cast | Shrink (96→64 circles); existing even-rows-vs-scroll fallback handles non-divisible counts | ✓ |
| **HIGH** | Box Office (Production & Theatrical Run) | Allow value wrap (drop nowrap) — plain wrapping per user | ✓ |
| MED | Awards | Shrink-and-fit (smaller padding + fonts) | ✓ |
| MED | Thumbs Up / Down | Shrink-and-fit (icon chip 40→32, italic 26→22) | ✓ |
| LOW | Where to Watch | Reduce side padding 26→14 | ✓ |
| LOW | You Might Also Like | Already adapts via `repeat(auto-fit, minmax(118px, 1fr))` — verify only | ✓ (verified) |
| LOW | Video Reviews | Already adapts via `minmax(180px, 1fr)` — verify only | ✓ (verified) |
| UNIV | Accordion content padding | New `.fg-accord-content` shared className: side padding 22-26→14 on mobile | ✓ |

User decisions:
1. Approve audit as-is — proceed
2. Cast: "Shrink and then revert back if it doesn't fit" — shrink circles + trust the existing fallback (non-divisible counts already go to horizontal-scroll mode)
3. Box Office: "plain wrapping" — no special font/color/indent for the rank suffix when it wraps to a second line

### Implementation — single @media block extension

All v5.10.37 rules added inside the existing `@media (max-width: 640px)` block from v5.10.35/36 (so each subsequent edit is one block, not nine). Key targeted classNames added to the JSX:

- `.fg-cast-member`, `.fg-cast-circle`, `.fg-cast-name`, `.fg-cast-char`
- `.fg-boxoffice-row`, `.fg-boxoffice-icon`, `.fg-boxoffice-label`, `.fg-boxoffice-value`
- `.fg-awards-row`, `.fg-awards-chip`, `.fg-awards-name`, `.fg-awards-detail`
- `.fg-thumbs-icon`, `.fg-thumbs-title`, `.fg-thumbs-caption`, `.fg-thumbs-wrap`
- `.fg-watch-wrap`
- `.fg-accord-content` (universal padding rule applied to 7 accordion content wrappers — Source Breakdown, Video Reviews, Cast both modes, Awards, BoxOffice, Recommendations)

### Why this is one PR, not two

Phase 1 (v5.10.35) and Phase 2 (v5.10.37) ship behind PR #47 together. The PR's scope grew from 2 commits to 4 (35, 36, doc-prep, 37) but the change is cohesive — "comprehensive mobile pass" — and the user's preference is to verify everything on real phone in one go before merging to production. Splitting into separate PRs would mean two re-screenshot rounds for arguably one feature.

### Files modified

| File | Lines | Purpose |
|------|-------|---------|
| `components/film-glance.jsx` | +84 / -28 | Phase 2 className hooks + @media rules; FG_VERSION 5.10.37 |
| `tech-specs.md` | +1 row | Change Log: v5.10.37 entry, prior CURRENT STATE row tagged SUPERSEDED |
| `conversation-summary.md` | NEW SESSION | This entry |

### Key learnings

1. **Audit first, code second.** Phase 2 took ~10 minutes to audit and ~25 minutes to code because the audit nailed down the exact pattern per section. The audit doc gets thrown away after; the value is forcing you to think before edits.
2. **Universal `.fg-accord-content` rule beats per-section rules where the change is identical.** For "side padding 26→14" applied across 7 accordion wrappers, one selector with one rule wins over seven duplicated targeted rules. Targeted classNames are still needed for per-section font/icon-size adjustments — but the padding case is universal.
3. **Pattern picks don't have to be exotic.** "Shrink-and-fit" handled 4 of 5 sections. The only section that needed a different pattern was Cast (which already has the right pattern — even-rows-vs-scroll). Mobile UX work is mostly turning down knobs, not redesigning.

---

## Session: April 30, 2026 — Mobile pass round 2 (v5.10.36) — reduced-motion bug + source-row hardening + score centering + FAB safe-area

User re-screenshot-tested v5.10.35 on mobile (5 new screenshots in `/mobile/`). Reported 4 issues. The screenshot URLs revealed an important detail — most were on `filmglance.com` and `film-glance.vercel.app`, both of which are **production** (v5.10.34, no v5.10.35 fixes). The staging preview lives at `film-glance-git-staging-rs-projects-c0025ef0.vercel.app`. This was a clue but not a complete explanation — the user *did* see the v5.10.35 FAB on at least one screen, so they reached staging at some point. Either way, the four reported issues each had a real root cause worth fixing.

### Issue 1 — DYM and Favs pages don't show movies

**Root cause: prefers-reduced-motion opacity stuck at 0.** Both `.dym-card` and `.fg-fav-card` are rendered with inline `opacity: 0` plus an `animation: softFade ... both` that transitions opacity 0 → 1 over 0.55s. The two existing `@media (prefers-reduced-motion: reduce)` blocks (one near `.dym-card`, one near `.fg-fav-card`) kill the animation with `animation: none !important;` to respect user preference — but they don't restore `opacity: 1`. Result: the cards stay at opacity 0 forever and are invisible.

**Why phones hit this and desktop doesn't:** modern Android (Samsung OneUI default), iOS low-power mode, and most battery-saver settings auto-set `prefers-reduced-motion: reduce`. Desktop machines rarely have it on. So the bug only manifests on phones with battery saver — which the user almost certainly had on, and which is the realistic mobile testing environment.

**Fix:** added `.dym-card { opacity: 1 !important }` and `.fg-fav-card { opacity: 1 !important }` inside both reduced-motion blocks. Now when animations are disabled, the cards fall back to fully visible.

This is the single biggest fix in v5.10.36 — explains both the favourites blank-page complaint AND the "Did you mean..." page with no suggestion cards.

### Issue 2 — Source Breakdown text still overlapping

User screenshot showed "Metacritic User" wrapping onto two lines with "9.3/10" overlapping the "User" line. My v5.10.35 @media was at ≤640px and used `white-space: nowrap` without `!important`. Two possible reasons it wasn't applying: (a) the user's phone is 481-700 logical width and v5.10.35 was actually deployed but on a wider phone the breakpoint missed, or (b) the inline style on the name span won out due to specificity.

**Fix:** pulled the source-row rules out of the 640 hero @media into their own `@media (max-width: 700px)`. Added `!important` on every text-related property. Added `min-width: 0` to the name container, name span, and score column to guarantee flex/grid items can shrink. Added `display: block` on the name span so the truncation kicks in even if the parent column tries to give it more room.

### Issue 3 — True Rating Score should be centered

NEW request — desktop layout has score-on-left + description-on-right with flex-wrap; on mobile the items wrapped but stayed left-aligned (default `justify-content`). Added className hooks (`fg-score-row`, `fg-score-num-wrap`, `fg-score-desc-wrap`) and a mobile @media that sets `justify-content: center` on the row + `width: 100%` on both children + `text-align: center` on the description column. Now the score number is centered horizontally within the panel, with the description below also centered.

### Issue 4 — FAB worked once then disappeared

User couldn't reproduce reliably. Most likely cause: mobile Chrome's address bar appearing on scroll-up pushes content down and can hide a FAB at `bottom: 22px`. Some Android browsers measure viewport differently with the chrome visible vs. hidden, and a position:fixed element at a small bottom offset can fall behind the chrome.

**Defensive fixes (all in v5.10.36, no way to reproduce remotely):**
- z-index 210 → 250 (clears the scrollPct>0.8 bottom-fade gradient at z:150 + any future fixed chrome)
- `bottom: 22px` → `bottom: max(28px, env(safe-area-inset-bottom, 28px))` so the FAB clears the iOS home indicator + Android navigation bar safe-area
- Popover `bottom` re-anchored relative to FAB position: `calc(max(28px, env(safe-area-inset-bottom, 28px)) + 64px)`
- Backdrop z-index 205 → 245, popover 215 → 255 (kept the relative ordering: backdrop < FAB < popover)
- `display: inline-flex !important` on the @media show rule, defending against any future cascade override
- Width 50→52 (slight visual upweighting)
- `pointer-events: auto` set explicitly so any ancestor's `pointer-events: none` doesn't bleed through

### Bonus — Header breakpoint bumped 480 → 560

User screenshots showed "Film/Glance" still wrapping onto two lines on their phone, plus "My/Account" still wrapping. The v5.10.35 @media at ≤480px doesn't catch phones in the 481-560 logical-width range (which is most modern phones in portrait). Bumped to ≤560 so the discuss-button-drop + icon-only My Account treatment now applies on most modern phones in portrait.

### What the user should do next

Test on the **staging preview URL**: `film-glance-git-staging-rs-projects-c0025ef0.vercel.app` (NOT `filmglance.com` or `film-glance.vercel.app` — those serve `main`, which is at v5.10.34 until the PR merges). Vercel's GitHub integration adds a "Visit Preview" button on PRs but the staging-branch URL is also stable and accessible without going through a PR.

If the user re-tests on the right URL and the issues are gone, we open the staging→main PR. If anything's still off, another iteration before the PR.

### Files modified

| File | Lines | Purpose |
|------|-------|---------|
| `components/film-glance.jsx` | +75 / -34 | All 4 fixes + breakpoint bumps; FG_VERSION 5.10.36 |
| `tech-specs.md` | +1 row | Change Log: v5.10.36 entry, prior CURRENT STATE row tagged SUPERSEDED |
| `conversation-summary.md` | NEW SESSION | This entry |

### Key learnings

1. **Inline `opacity: 0` + animation = invisible-on-reduced-motion landmine.** Any time you write `opacity: 0` inline and rely on a CSS animation to transition it to 1, you must override that opacity inside any reduced-motion @media block that disables the animation. This is a CSS-architecture footgun, not a one-off bug — should be a checklist item for every fade-in pattern in this codebase. Audit needed: any other inline `opacity: 0` paired with a fade animation.
2. **Test target URL matters more than you'd think.** The user thought `filmglance.com` was their staging URL because that's what they remembered. Always link or quote the exact staging preview URL when asking for verification — and verify ourselves via `gh api` that v5.10.X actually built on the URL we're asking the user to test.
3. **`env(safe-area-inset-bottom)` is the right default for any bottom-anchored FAB.** Mobile Chrome's appearing/disappearing address bar + iOS home indicator + Android nav bar all conspire against a naive `bottom: 22px`. The safe-area-inset env var was made for this; use it everywhere a fixed element sits near the bottom edge.
4. **Bumping a breakpoint by 80px (480→560) is often the right move.** Most "modern phone" widths cluster around 390-430px, but Samsung Z Fold-style or newer iPhone Pro Max can go up to 540. The 480 boundary is a leftover from iPhone-2016 mental models; 560 catches the 2024-2026 device generation.

---

## Session: April 29, 2026 (continued, round 6) — Mobile pass Phase 1 + standing mobile-parity rule (v5.10.35)

PR #46 (v5.10.34) merged to main earlier today. User pulled the live site up on their phone and screenshot-audited the mobile experience. Five critical issues surfaced, four they listed plus the floating menu that was completely hidden on mobile:

1. **Favourites page renders blank** — chip bar shows "All 3 / Unsorted 3" but zero cards display
2. **Heart icon missing on some movies** — visible on Avatar, gone on Pulp Fiction
3. **Hero text + chips overflow horizontally** — title cut off, tagline cut off, director cut off (Pulp Fiction)
4. **Source Breakdown text overlap** — multi-word source names wrap and the score column overlaps the wrapped second line
5. **Floating section sidebar entirely missing on mobile** — desktop has a fixed-left list of jump-to-section buttons; was `display: none !important` at ≤1379px with no mobile equivalent

Plus the user's standing direction: **mobile parity should be a permanent rule going forward**, not a follow-up phase. Codified in CLAUDE.md.

### Root-cause analysis (single common thread)

Every issue traced back to the same pattern: layouts built for desktop assumed flex children had implicit minimum widths. On a 360px viewport:
- Flex children without `min-width: 0` refuse to shrink below their content's intrinsic width → overflow
- `align-items: center` on a flex column prevents children from stretching to full cross-axis → text columns overflow centered with both edges off-screen
- Fixed-width columns (Source Breakdown's 88px score) + `1fr` siblings collide because the math doesn't work below ~480px viewport
- `display: none !important` at narrow viewports hid features (the section sidebar) without offering a mobile equivalent
- Hover-only action clusters (favs card actions at 0.55 opacity until hover) are invisible on touch devices

### Phase 1 fixes shipped in v5.10.35

**A. Favs cards.** New `@media (max-width: 640px)` block on `.fg-fav-card`: 78×117 poster (was 130×195), 12px gap (was 22), 12px padding with 38px bottom for the absolute action cluster (was 22px), score 56→38, score-col minWidth 92→56, action cluster `opacity: 1` (always visible) + `right/bottom: 8` (was 14/12 for desktop's larger card), folder-tag pill 11→9.5px.

**B. Hero overflow.** Changed `.fg-hero-grid` mobile `align-items: center` → `stretch` so the text column actually fills the cross-axis. Added per-element classes + rules:
- `.fg-hero-text-col { width: 100%; min-width: 0 }`
- `.fg-hero-title { word-break: break-word; overflow-wrap: anywhere; font-size: 26px }` + added `min-width: 0` inline
- `.fg-hero-tagline { white-space: normal }` (was nowrap — single biggest cause of Pulp Fiction's overflow)
- `.fg-hero-director { white-space: normal; max-width: 100% }`
- `.fg-hero-meta` chips drop padding 7px 13px → 5px 10px, gap 10 → 6, font 14 → 12
- `.fg-result-card-inner` outer padding 32px 30px 28px → 20px 16px 22px

The heart's "missing" was a symptom of (B) — once the row fits inside the viewport, the heart slot at the right end of the title row becomes visible.

**C. Source Breakdown.** Compressed inline at ≤640px (extends slightly past 600 the user picked, since the breakage starts a bit higher):
- `grid-template-columns: 28px minmax(0,1fr) auto 44px 16px` (was `auto 1fr 88px 1fr 28px`)
- Logo chip 36×36 → 28×28; inner img 22 → 18
- Name `font-size: 18 → 13` with `nowrap + ellipsis` (was wrapping)
- Type label 12 → 9
- Score 19 → 14
- Padding 16px 18px → 10px 12px; gap 14 → 8

**D. Header.** Added `.nav-discuss-btn`, `.nav-account-label`, `.nav-brand` classNames. At ≤480px:
- `.nav-discuss-btn { display: none }` (drop the chat-icon arrow button entirely)
- `.nav-account-label { display: none }` (My Account / Sign In go icon-only)
- `.nav-btn { padding: 7px 9px; gap: 5px }`
- `.nav-brand { font-size: 17; white-space: nowrap }` (stops "Film Glance" from breaking onto two lines)

**E. ResultSidebar floating menu.** Most invasive change — refactored the component:
- Extracted the `<nav>` list into a `navList` variable (rendered twice: once inside the desktop `<aside>`, once inside the mobile popover)
- Added `mobileOpen` useState
- New JSX: `<button className="fg-sidebar-fab">` (gold-gradient circular button, 50×50, bottom-right at right:18, bottom:22) + conditional `<div className="fg-sidebar-fab-backdrop">` and `<div className="fg-sidebar-fab-popover">` when open
- New CSS: FAB hidden by default, shown at `≤1379px` (the same breakpoint where desktop sidebar hides). Popover anchored bottom-right at `right:18, bottom:84` with `width: min(280px, calc(100vw - 36px))`. Backdrop `inset:0` with blur(6px). Animation: `slideUp 0.22s` for popover, `fadeIn 0.18s` for backdrop.
- `scrollTo(id)` now also calls `setMobileOpen(false)` so tapping a section closes the popover
- New `Menu` icon imported from lucide-react

### Standing rule added (CLAUDE.md "Mobile parity is non-negotiable")

This is the more important change long-term. Six guardrails, codified from the audit:
1. Every UI change must work on mobile AND desktop, verified before commit
2. Target widths to verify against: 360, 390, 414, 480, 600, 860, ≥1380
3. Verification: Chrome DevTools device emulation against Vercel preview is baseline; real-device screenshots for high-risk changes
4. Don't ship UI work that hasn't been tested on at least one mobile width
5. Cataloged the common pitfalls so the next session knows what to look for
6. Mobile is one feature with desktop, not a follow-up pass

### What's NOT in this commit

Phase 2 (comprehensive sweep — score panel, cast scroll, awards, production/run, where-to-watch, recommendations, video reviews), Phase 3 (ticker animation visibility audit), and Phase 4 (formal responsive contract in tech-specs §11) are queued for follow-up versions. v5.10.35 is the critical-path fix for the four breakages + missing FAB; the user will re-screenshot on their phone before deciding whether to PR-and-ship or layer on Phase 2.

### Files modified

| File | Lines | Purpose |
|------|-------|---------|
| `components/film-glance.jsx` | +238 / -74 | All five mobile fixes (A–E); FAB component refactor; Menu icon import; FG_VERSION 5.10.35 |
| `CLAUDE.md` | +7 / -2 | New "Mobile parity is non-negotiable" rule under Hard Rules |
| `tech-specs.md` | +1 row | Change Log: v5.10.35 entry, prior CURRENT STATE row tagged SUPERSEDED |
| `conversation-summary.md` | NEW SESSION | This entry |

### Key learnings

1. **Backticks inside CSS comments break inline `<style dangerouslySetInnerHTML={{ __html: \`...\` }} />`.** I lost ~5 minutes to a tsc parse error after writing CSS comments like `align-items: \`center\`` — the backticks terminate the outer template literal mid-stream. From now on, in any inline CSS string literal, document with quotes or em-dashes, never backticks.
2. **`display: none` at narrow viewports is not "mobile responsive" — it's "mobile broken".** The ResultSidebar fix exemplifies this: hiding desktop components without offering a mobile equivalent removes features. Every `display: none` in a media query is a candidate for "what's the mobile alternative?" — bottom sheet, FAB, sticky chip bar, or accordion.
3. **`align-items: center` on a flex-direction:column container is rarely what you want for content blocks.** It centers each child on the cross-axis without stretching, so children with `flex: 1` don't actually fill width. Use `stretch` (default) and let individual children opt into centering via `align-self: center` (which is what the poster needed).
4. **Hover-only affordances are invisible on touch.** The favs card's action cluster at `opacity: 0.55` revealing on hover means a phone user never sees the trash + move buttons. Standing rule: any interactive control must be visible at rest on touch viewports.
5. **Codify the lesson, don't just fix the symptom.** The "Mobile parity is non-negotiable" rule in CLAUDE.md is more durable than this PR — it prevents the entire class of bug from recurring across sessions.

---

## Session: April 29, 2026 (continued, round 5) — Gold scrollbar on favourites view (v5.10.34)

User noticed the custom gold scroll indicator (right-edge track + draggable thumb, turns orange past 85% scroll) was missing on the favourites page after staging v5.10.33. Same indicator that's on the landing and result pages.

### Single-line fix

The render block for the indicator was gated:

```jsx
{!showFavs && ((result && !result.notFound) || (!result && !loading)) && (
```

The `!showFavs` gate is a historical artifact — back when favourites was a small modal-style strip with little scroll length, hiding the indicator made sense. The current full-page favourites view (DYM-style card list, optionally filtered by folder) has plenty of scroll on a full library, so the gate is wrong.

Removed `!showFavs && `. The indicator now renders on landing, result, and favs.

### Why no other wiring was needed

The `scrollPct` state is updated by a window-level `scroll` listener installed in `useEffect` near the top of the component (line ~1317). It computes `scrollY / (scrollHeight - innerHeight)` — view-agnostic. Whatever page renders, the listener tracks scroll position correctly. The drag handler at line ~1329 also uses `window.scrollTo` which works against any scrolling document.

### Files modified

| File | Lines | Purpose |
|------|-------|---------|
| `components/film-glance.jsx` | +6 / -2 | Removed `!showFavs` gate on the gold scroll indicator; updated comment; FG_VERSION 5.10.34 |
| `tech-specs.md` | +1 row | Change Log: v5.10.34 entry, prior CURRENT STATE row tagged SUPERSEDED |
| `conversation-summary.md` | NEW SESSION | This entry |

### Key learning

**Gates outlive their justifications.** The `!showFavs` gate made sense when the favs view was a tiny strip. Two redesigns later (v5.10.30 full DYM-style cards, v5.10.31 folders + chip bar), the favs view scrolls like any other page — but the gate stayed. Worth periodic audit: when a feature changes shape, re-read every conditional that touches it.

---

## Session: April 29, 2026 (continued, round 4) — Modal centering + hover-fill cure + hero static (v5.10.33)

After v5.10.32 went up the user reviewed staging again and gave three more pieces of feedback. Addressed in v5.10.33.

### 1. "Add to Favorites" modal — center all text + bump size under the header

User wanted everything below the "Add to Favorites" italic gold heading centered and one notch larger.

- `<h3>` title — added `textAlign: center` (kept fontSize 32 — header itself wasn't bumped per the user's "everything UNDER the header" wording)
- `<p>` subtitle "Pick or create a folder to save this favorite." — added `textAlign: center`, fontSize 15 → 17, white opacity .72 → .78
- Three list-row buttons (Unsorted, each folder, "New folder…") — `justifyContent: flex-start` → `center` on both the button and the inner `.fg-shiny-label`, base size 13 → 16 via inline `fontSize: 16` on the button (overrides `.fg-shiny`'s 13px default), padding `10px 18px` → `13px 18px`, leading icon size 14 → 16
- Cancel — fontSize 12.5 → 14, padding `10px 18px` → `13px 18px`, added explicit `textAlign: center`

The header at 32px now visually dominates while the rest of the modal sits at the new larger, centered cadence.

### 2. Yellow fill on hover — Unsorted + folder rows in the modal

Root cause: `.fg-shiny:is(:hover, :focus-visible, :focus-within)` widens the conic shine band from `--fg-shiny-pct: 7%` (rest) to `18%`, and a sibling rule sets `.fg-shiny-label::before { opacity: 0.22 }` (the breathing inset bottom-glow). At 18% + 0.22 the bottom edge of the chip reads as a solid gold/yellow fill — exactly what the user flagged.

Fix: a new `.fg-shiny-flat` modifier:

```css
.fg-shiny.fg-shiny-flat:is(:hover, :focus-visible, :focus-within) {
  --fg-shiny-pct: 7%;
  --fg-shiny-shine: var(--shiny-hi);
  color: var(--shiny-fg);
}
.fg-shiny.fg-shiny-flat:is(:hover, :focus-visible, :focus-within) .fg-shiny-label::before { opacity: 0; }
```

Applied to the Unsorted button + each folder row in the picker. The rotating gold conic-gradient border + dotted shimmer + arc gleam still play (those are perimeter, not fill). The "+ New folder…" CTA is unchanged — it uses `.fg-shiny-cta` because it's a primary action.

### 3. Landing hero — remove animations from the title

User asked previously (v5.10.30 era) to remove "boot animations" on the landing. v5.10.32 still had two infinite loops on `.hero-accent` (the "One True Rating Score." second line):

- `goldShimmer 6s ease-in-out infinite` — `background-position` oscillation that creates a moving sheen across the gold gradient
- `haloBreathe 5s ease-in-out infinite` — `text-shadow` pulse (10px → 18px blur, .22 → .32 alpha)

Both removed. Replaced the `haloBreathe` with a static `text-shadow: 0 0 14px rgba(255, 215, 0, 0.26)` — the halo is still there, just frozen at a mid-amplitude value. The gold gradient (background-clip: text) is unchanged because that's brand colour, not animation.

Below-fold sections kept per the user's "I still want the Review Sites Included and What you'll find to have their animation":
- `tickerScroll 44s linear infinite` on `.ticker-track` (Review Sites Included) — kept
- `.newl-how-card` hover lift + glow — kept
- `filmScroll 56s linear infinite` on `.film-track` (What You'll Find strip) — kept
- `.film-frame` hover sheen — kept

### Files modified

| File | Lines | Purpose |
|------|-------|---------|
| `components/film-glance.jsx` | +42 / -18 | `.fg-shiny-flat` modifier; modal centering + sizing; `.hero-accent` static; FG_VERSION 5.10.33 |
| `tech-specs.md` | +1 row | Change Log: v5.10.33 entry, prior CURRENT STATE row tagged SUPERSEDED |
| `conversation-summary.md` | NEW SESSION | This entry |

### Key learnings

1. **Hover state on a "shiny" button is the wrong default for list rows.** The `.fg-shiny` design was built for filter chips and CTAs — interactive elements where a hover "warm-up" reads as feedback. When the same component is reused for list rows in a modal (Unsorted, folders), hover ambiguity reads as a fill. The fix is a modifier (`fg-shiny-flat`) that locks the hover state to the rest-state values — the rotating perimeter still confirms interactivity, but no fill.
2. **Brand-colour gradients ≠ animations.** Removing `goldShimmer` + `haloBreathe` from `.hero-accent` doesn't remove the gold colour or the halo — those become static. Worth distinguishing in feedback: when a user says "no animations on the title", they often want the static visual to remain.
3. **Each modal should set its own button text size.** `.fg-shiny` defaults to 13px which works for filter chips and toolbar CTAs but is too small inside a centered, oversized modal. Inline `fontSize: 16` on the button overrides cleanly without a new CSS rule.

---

## Session: April 29, 2026 (continued, round 3) — Favourites polish round 3 (v5.10.32)

After v5.10.31 went up the user flagged three quick visual issues from the Vercel preview. All addressed in v5.10.32.

### Context note — recovered work, not redo

Prior round 3 attempt hung mid-session — terminal got stuck on a `agent-browser` install while the actual code edits had already landed locally and were sitting uncommitted on staging. This session resumed by re-verifying the diff against the three asks (it matched), running a clean `tsc --noEmit` (exit 0), and pushing as v5.10.32. No new code was written — everything below describes the edits the prior session had already made before the hang.

### 1. Yellow fill on Favourites chips and the heart-click "+ New folder" CTA

User flagged two spots where the active filter chip and the "+ New folder" CTA were reading as a heavy yellow fill instead of the intended shiny perimeter aesthetic. Root was the always-on `span::before` inset bottom-glow (`box-shadow: inset 0 -1.6ex 1.4rem 3px var(--shiny-hi)` at opacity 0.55 on `.active` / 0.42 on `.fg-shiny-cta`) plus a 14% / 10% conic-gradient shine band that, in combination, painted the bottom half of the pill solid gold.

Fix:
- Inset bottom-glow → opacity 0 on both `.fg-shiny.active` and `.fg-shiny.fg-shiny-cta` (it's still alive on hover at a subdued 0.22, so the chip "warms" but never "fills")
- `--fg-shiny-pct` shine band: `.active` 14% → 7%, `.fg-shiny-cta` 10% → 7%
- `--shiny-bg-sub` (inner pad-box tint): `#2a1d04` → `#1f1604` on both
- `::after` gleam streak: width 140% → 130%, opacity 0.42 → 0.18 (idle) / 0.22 (active+CTA), narrower transparent stops (32%/68% → 38%/62%), darker mask threshold (38% → 52%) so the bright streak rotates through a smaller arc
- Hover label::before glow opacity 0.65 → 0.22

Result: rotating gold conic-gradient border + dotted ::before shimmer + slim arc gleam all preserved, but the chip body never reads as filled gold. State is signaled by the perimeter, not by interior fill.

### 2. Heart-click modal — title, subtitle, "+ New folder" pill, sizing

- Title `Save to library` → `Add to Favorites` (32px Playfair italic gold, was 26px; letter-spacing -0.5 → -0.6, line-height 1.1 → 1.08, margin-bottom 6 → 10)
- Subtitle `Choose where {title} should live.` → `Pick or create a folder to save this favorite.` (15px Syne, was 13px; opacity .62 → .72, added line-height 1.5)
- "+ New folder…" yellow fill — already covered by the global `.fg-shiny-cta` fix in §1 above; no extra modal-scoped CSS needed

### 3. True Movie Rating Score — descender clip on the 124px Playfair number

The score wrapper had `padding: 12px 16px` and the score `<span>` had `lineHeight: 0.9`. At fontSize 124 + Playfair Display's tall descenders, the bottom of "3" / "5" / "8" was sitting outside the line box and getting clipped by the parent's effective padding. Fix:

- Score wrapper padding `12px 16px` → `12px 16px 18px`
- Score `<span>`: `lineHeight: 0.9` → `1.05`, added `paddingBottom: 0.12em`

`/ 10` suffix unchanged — only the gradient-clipped score number had the descender problem because its background-clip:text + transparent fill made the clip visible at the pixel level.

### Files modified

| File | Lines | Purpose |
|------|-------|---------|
| `components/film-glance.jsx` | +48 / -31 | Shiny CSS retune (no fill on .active/.fg-shiny-cta), modal copy + sizing, score line-height + padding fix, FG_VERSION 5.10.32 |
| `tech-specs.md` | +1 row | Change Log: v5.10.32 entry, prior CURRENT STATE row tagged SUPERSEDED |
| `conversation-summary.md` | NEW SESSION | This entry |

### Key learnings

1. **A "shiny button" can read as a "filled button" if the always-on inset glow is bright enough.** The aliimam/shiny-button design uses `span::before` as a breathing inset bottom-glow — at low opacity (0.0–0.25) it adds depth without reading as fill. At 0.55+ it crosses the threshold and starts looking like a yellow pill. The fix on `.active` / `.fg-shiny-cta` was to keep the breathing keyframe but leave the rest-state opacity at 0, only lighting up subtly on hover.
2. **`background-clip: text` + Playfair Display + tight line-height = descender clip.** Default Playfair descender extends well below the baseline; `line-height < 1.0` shrinks the line box below the glyph, and the parent's padding does the actual visible clipping. Lesson: at large display sizes, line-height needs to be ≥ 1.05 for serif fonts with prominent descenders, and an explicit `padding-bottom: 0.1em–0.15em` on the span is cheap insurance against clip from any ancestor `overflow: hidden`.
3. **A hung terminal in the previous session doesn't mean the code is hung — verify by reading the diff.** This session would have produced churn (re-doing all three fixes) if it had assumed nothing landed. Always check `git status` + `git diff` before re-implementing.

---

## Session: April 29, 2026 (continued, round 2) — Favourites polish (v5.10.31)

After v5.10.30 hit staging the user reviewed it on the Vercel preview and gave five pieces of feedback. All addressed in v5.10.31.

1. **Diagnostic line removed.** The italic Playfair "Your Favourites" headline now stands alone — the JetBrains Mono `// X films saved · folder name` slug under it was deleted per user "remove the # of films saved line" request.
2. **Score format `8.3/10` inline.** Was a stacked `8.3` + tiny mono `OUT OF 10` underneath. Now baseline-aligned: 56px Playfair gold-gradient `8.3` + 22px Playfair gold `/10` next to it. The `.fg-fav-score-suffix` rule was rewritten from caps-letterspaced mono to a Playfair slug.
3. **Card detail richness via two-tier enrichment.** User flagged that director + plot were missing on existing fav cards (they were saved before yesterday's metadata-columns migration, so all 18 rows had nulls). Two-tier fix:
   - **Migration 012** — one-shot SQL backfill: `UPDATE favorites SET runtime/director/overview FROM movie_cache via search_key match`. 13/18 existing favs immediately enriched.
   - **`/api/enrich-favorites`** — POST endpoint, Bearer-auth-gated, validates each `(title, year)` pair belongs to the authenticated user (defends against using the endpoint as a free Claude oracle), then sends a single batch prompt to **Claude Sonnet 4.6** asking for `{director, runtime_minutes, overview}` per movie. Returns the enriched data + UPDATE-writes the rows. Called silently from `loadUserData` for any rows still missing data after the cache backfill. The remaining 5 of 18 will fill in on the next sign-in.
4. **Shiny-button replacement for all favourites-page chips.** Per the 21st.dev `aliimam/shiny-button` design. Fetched the source registry JSON (`https://21st.dev/r/aliimam/shiny-button.json`) to get the exact CSS primitives:
   - `@property` registered `<angle>` and `<percentage>` and `<color>` for `--gradient-angle`, `--gradient-angle-offset`, `--gradient-percent`, `--gradient-shine`
   - Triple-layered button: `padding-box` solid bg + `border-box` rotating conic-gradient (the shine sweep) + `box-shadow inset` faux double-border
   - `::before` pseudo — radial dot pattern masked to a moving conic arc (the dotted shimmer)
   - `::after` pseudo — linear-gradient streak masked to a radial-bottom fade (the gleam)
   - `span::before` pseudo — inset bottom-glow with `breathe` keyframe (1→1.2 scale at 50%)
   - Three keyframes: `gradient-angle` (rotate), `shimmer` (pseudo rotate), `breathe` (pulse)
   
   Recolored to Film Glance gold: `--shiny-cta-bg: #0a0805`, `--shiny-bg-sub: #1a1308`, `--shiny-hi: #FFD700`, `--shiny-hi-soft: #FFE89A`. Renamed keyframes `fgShinyAngle` / `fgShinyArc` / `fgShinyBreathe` to avoid collision with the existing `shimmer` / `breathe` keyframes elsewhere in the stylesheet. Added a `.fg-shiny-cta` modifier for primary CTAs (+ New folder, save-to-folder confirm) — brighter rest state with the animation always running. Active filter chips (`.fg-shiny.active`) use the same always-running treatment with gold text. Per-folder chips use `<span>` outer + nested `<button>` for the filter click + sibling action `<button>`s for rename/delete (avoids invalid button-in-button HTML).

5. **Heart-click "Save to library" picker.** New centered modal opens when the user clicks the heart on a result page for a movie they haven't favourited yet. Lists Unsorted + each folder + a "New folder…" inline create path. Click any row → instant save with that destination + close. The "+ New folder" path expands to an inline input + Save button; on save it creates the folder, then chains the favourite insert with the new folder id (via a `createFolder` change that now returns the new id on success). The previous `toggleFav` add path inserted directly with `folder_id: null`; that was replaced by `setSaveToFolderTarget(movieResult)` which opens the picker. The actual insert now lives in a new `confirmSaveFav(folderId)` helper. Heart-click on an already-favourited movie still un-favourites instantly (no modal) — matches the user's "lean toward existing behaviour" pick.

### Persistence

User asked for explicit confirmation that favs + folders + folder assignments persist forever per account. Already does — `favorites.user_id` + `favorite_folders.user_id` are FKs to `auth.users.id`, RLS policies are owner-scoped (`auth.uid() = user_id` on every SELECT/INSERT/UPDATE/DELETE), `loadUserData` reloads everything on every fresh sign-in. The only thing that wasn't persisting before this session was the new metadata columns on legacy rows — fixed by migration 012 + Sonnet enrichment.

### Files modified

| File | Purpose |
|------|---------|
| `components/film-glance.jsx` | Diagnostic line removed; score `/10`; shiny-button CSS + applied to chip bar; heart-click picker modal; `confirmSaveFav` + `saveToNewFolder` helpers; `createFolder` returns id; FG_VERSION 5.10.31 |
| `app/api/enrich-favorites/route.ts` | NEW — Sonnet 4.6 batch enrichment, Bearer auth, ownership-gated |
| `sql/migrations/012_backfill_favorites_metadata.sql` | NEW — one-shot UPDATE from movie_cache |
| `tech-specs.md`, `conversation-summary.md` | This entry |

### Key learnings

1. **Defend AI endpoints with ownership checks.** `/api/enrich-favorites` could otherwise be used as a free Claude oracle for arbitrary movie lookups. The endpoint validates that every `(title, year)` pair in the request matches a row in the caller's own favorites table before the Sonnet call fires.
2. **`@property` registered CSS custom properties unlock real animation.** The shiny-button's rotating shine works because `--gradient-angle` is registered as `<angle>`, which makes it animatable across keyframes. Without `@property`, browser would treat it as a string and skip the interpolation.
3. **Avoid keyframe name collisions in long-lived stylesheets.** This stylesheet already had `@keyframes shimmer` (background-position translate for landing) and there's no `breathe` yet but adjacent code might land it. Prefixing the new ones (`fgShinyAngle`, `fgShinyArc`, `fgShinyBreathe`) avoids accidental clobber.
4. **HTML doesn't allow nested `<button>`s** — the per-folder filter chips need `<span>` outer + `<button>` inner so the chip can host both the filter click and the rename/delete action buttons. CSS `:focus-within` on the outer span makes keyboard focus on the inner button still trigger the shiny hover state.

---

## Session: April 29, 2026 (continued) — Favourites Page Redesign (v5.10.30) + Folders System

### Context

Session opened with the Favourites page priority from the prior chat's NEXT STEPS list. The existing favourites surface was a thin pill (44×66 poster, plain title, year, score, trash) — visually disconnected from the rest of the v5.10 brand pass. User asked for a ruthless overhaul: take the **DYM (Did You Mean…) suggestion-card** visual language as the reference, port it to favourites, plus add a folders organizational system with create/rename/delete, and a per-card "move to folder" affordance, plus an aggregated rating on the right and a trash icon bottom-right. No AI slop, max effort, no push-to-staging until 100% satisfied.

### Workstream 1: Folder data model + Supabase migration

New migration `011_favorite_folders.sql` applied to production via Supabase MCP after explicit user approval. Adds:

- **`favorite_folders` table** — id (uuid), user_id (uuid FK profiles ON DELETE CASCADE), name (1-60 chars, unique per user), position (int for display order), created_at. RLS enabled with 4 owner-only policies (SELECT/INSERT/UPDATE/DELETE via `auth.uid() = user_id`).
- **4 nullable columns on `favorites`:** `folder_id` (uuid FK favorite_folders ON DELETE SET NULL — folder deletion re-orphans cards to "Unsorted" rather than losing them), `runtime` (int minutes), `director` (text), `overview` (text). Older rows stay with nulls; the redesigned card renders gracefully without those chips.
- 1 index on `favorite_folders(user_id, position, created_at)`, 1 partial index on `favorites(folder_id) WHERE folder_id IS NOT NULL`.
- Verified post-apply via SQL probe: 4 RLS policies, RLS enabled, 4 new fav columns confirmed.

### Workstream 2: Component-level folder CRUD

Same optimistic-update + revert-on-error pattern as the existing `toggleFav`/`removeFav`:

- `loadUserData` extended to fetch favourites + folders in parallel (`Promise.all`), maps the new fav columns onto local state.
- `toggleFav` — when adding, also writes `runtime` (parsed from "120 min" or "2h 0m" string forms), `director`, `overview` (from `result.description`).
- New helpers: `createFolder`, `renameFolder`, `deleteFolder` (re-orphans cards on success), `moveFavToFolder`. Each performs the optimistic local mutation, the Supabase round-trip, and reverts state if the network/RLS rejects.
- Sign-out resets `folders`, `activeFolderId` alongside `favorites`.

### Workstream 3: Card redesign (DYM-style port)

The existing `.dym-card` CSS rules (cursor-tracking radial spotlight via `--mx`/`--my` CSS vars, animated rotating conic-gradient 1px ring border, lift-on-hover, poster scale 1.04) were **shared with `.fg-fav-card`** by widening each selector — no duplication, no drift. New favourites-only CSS adds:

- **`.fg-fav-score` column** — 56px Playfair gold-gradient number with two-layer drop-shadow glow (24px close); hover bumps to 38+80px glow + scale 1.04. Mirrors the result-page True Movie Rating treatment, scaled down. Falls back to a "no score" mono caption when score is 0/missing.
- **`.fg-fav-actions` cluster** — bottom-right of card. Trash button (red glow on hover) + "move to folder" button (gold glow). Idle dim → bumps to legible when card is hovered.
- **`.fg-fav-folder-tag`** — small mono pill bottom-left of card showing the containing folder name (only rendered when `folderId` is set). Clickable shortcut to filter the chip bar to that folder.
- **`.fg-move-pop`** — popover anchored to the move button, listing folders + "Unsorted" + "+ New folder…", with active-state checkmark, gold scrollbar on overflow, soft fade-in.
- **`.fg-folder-chip` + `.fg-folder-new-pill` + `.fg-folder-input`** — chip-bar UI. Chips have count badge, hover lift, `.active` state with gold gradient bg + inner glow; rename/delete icon-buttons appear on hover via `max-width` transition. New-folder pill switches to an inline input with gold border and brand-coloured caret.
- **`.fg-fav-modal`** — confirm-delete folder dialog. Italic Playfair gold heading "Delete &lsquo;X&rsquo;?", explanatory body in Syne body font ("the N films inside will move to Unsorted"), Cancel + Delete buttons in brand colours.

### Workstream 4: Render block

Replaced the entire `showFavs` JSX (60 lines) with a new IIFE-wrapped block (~330 lines). Order:

1. Top letterbox rail (reused `.dym-rail-top`)
2. Italic Playfair gold "Your Favourites" headline + JetBrains Mono diagnostic "// X films saved · [folder name]"
3. Folder filter chip bar (All / Unsorted / per-folder / + New Folder)
4. Card list (filtered by `activeFolderId`) — DYM-shape with score column, action cluster, folder tag
5. Per-filter empty states (no favs at all → heart + invitation; Unsorted with 0 → "Everything is filed. Nice."; folder with 0 → "Move a favourite here using the &lt;icon&gt; on any card")
6. Bottom letterbox rail
7. Confirm-delete modal (when `deleteFolderTarget` is set)

Document-level `mousedown` listener handles click-outside-to-close for the move popover (root-level fixed backdrop wouldn't work because `.fg-fav-card` has `isolation: isolate` and would render under the backdrop).

### Workstream 5: Pre-existing hydration crash, found and fixed

Local playwright verify caught a "Application error: a client-side exception has occurred" on /#favourites. Root cause: the `<style>{`...`}</style>` JSX text-node escaping bug — server SSR escapes `'` → `&#x27;` and `&` → `&amp;` in CSS text, but client hydration doesn't, so the `@import url('https://fonts.googleapis.com/css2?...')` CSS line breaks (browser sees `&#x27;https://...` as the URL, refuses to load, then the hydration mismatch unmounts the entire React tree, dispatching the "Missing ActionQueueContext" invariant). Fix: switch the inline style block to `<style dangerouslySetInnerHTML={{ __html: `...` }} />` — same fix `preview-landing.jsx` got in PR #37 era. After the fix, both home page and /#favourites render clean with only a stray 404 in console (likely a missing dev asset, not related).

### Workstream 6: Verification artifacts

Wrote `scratch/verify-favourites.mjs` (gitignored, alongside the prior `verify-loading.mjs` from PR #40). Uses temporary `playwright-core@1.55` install. Two screenshots: home idle (full landing with grid bg, hero, ticker, How It Works, film strip) and /#favourites no-auth (auth modal correctly pops). Cards-with-data verification deferred to user's signed-in session (playwright can't fake a Supabase JWT).

### Workstream 7: Windows path-casing diagnostic detour

`next build` repeatedly failed with `Cannot read properties of null (reading 'useContext')` during prerender. Investigated by stashing my changes and rebuilding the baseline — same error occurred. Root cause is Windows case-insensitive FS + this Bash session's lowercase cwd (`film-glance-terminal`) vs. the actual filesystem casing (`Film-Glance-Terminal`); webpack treats them as separate paths and bundles React twice. **Vercel builds on case-sensitive Linux so this artifact never reaches production.** No code change needed.

### Files modified

| File | Lines | Purpose |
|------|-------|---------|
| `components/film-glance.jsx` | +1170 / -84 | Folder state + helpers, redesigned card render block, shared `.dym-card` CSS extension, hydration-mismatch fix |
| `sql/migrations/011_favorite_folders.sql` | NEW | `favorite_folders` table + 4 new fav columns |
| `tech-specs.md` | +2 rows | Change Log: new CURRENT STATE + NEXT STEPS, prior 29 Apr rows tagged SUPERSEDED |
| `conversation-summary.md` | NEW SESSION | This entry |
| `scratch/verify-favourites.mjs` | NEW (gitignored) | Local playwright verification harness |

### Key learnings

1. **Reuse beats reinvention.** Sharing `.dym-card` CSS via selector lists (`.dym-card, .fg-fav-card`) instead of copy-pasting the rules kept ~120 lines of CSS DRY and means the gold spotlight + conic border stays visually identical across the two surfaces.
2. **Optimistic-update + revert-on-error is the right pattern for collection CRUD.** Already proven by `toggleFav`/`removeFav` — extending it to folders meant zero new error UX (every helper writes a `setFolderError(...)` line on failure that the chip-bar reads).
3. **`isolation: isolate` + popover = stacking-context trap.** Initial click-outside backdrop placed at root z-index 40 was hidden behind the popover because the card creates its own stacking context. Document-level listener is the cleaner pattern.
4. **JSX text-node `<style>` content is dangerous.** Any apostrophe, ampersand, or `<` in the CSS becomes an HTML entity on SSR and a literal char on client → guaranteed hydration mismatch. Always use `dangerouslySetInnerHTML` for inline `<style>` blocks. The bible doc from PR #37 era already noted this; the fix wasn't applied to the main film-glance.jsx until now.

### Next session

User signs in to localhost dev, hits `/#favourites`, exercises: create folder, rename, delete with confirm, move card to folder, remove card, hover spotlight on card, click card → loadFav navigates to result page. If satisfied, commit and push to staging → Vercel preview → PR → merge to main. If iterations needed, capture feedback and adjust before push.

---

## Session: April 28-29, 2026 — Movie Result Page Comprehensive Redesign (PRs #43, #44) + DYM Polish

### Context

Multi-day arc completing the **three-pass design series** (landing → DYM → movie result). PR #42 merged the landing redesign. This session opened PR #43 (Did-You-Mean) and PR #44 (movie result page) — both merged. The result-page work alone took **~13 polish iterations** as the user gave round-by-round feedback on every section. 16 commits in PR #44, ~1,000 net insertions, single component file (`components/film-glance.jsx`) plus a one-line `app/api/search/route.ts` prompt change.

### Workstream 1: Did-You-Mean redesign (PR #43)

Replaced the old "No results" panel (orange `AlertCircle`, dark-gray-on-dark unreadable headings) with a state-aware discovery surface:

- **Headline branches** by failure type: `suggestions.length > 0` → "Did you mean…", rate-limit → "Hold on a moment", timeout → "Connection slow", default miss → "We couldn't find that"
- **Suggestion cards** with 130×195 posters, runtime + director chips, 3-line synopsis trimmed to ~200 chars at sentence boundary, gold left accent bar, hover spotlight effect (cursor-following gold radial via CSS vars + animated rotating conic-gradient border)
- **Letterbox rails** top + bottom of the panel (echoes film-strip motif from the landing)
- Italic Playfair gold "Did you mean…" headline, mono `// searched: "query"` diagnostic
- Released-first sort puts unreleased films at the bottom with formatted release date or **"Release Date TBD"**
- Out-of-scope keyword icon picker for hot-take rows was reused later for result page

**Suggestion data architecture rewrite**:
- Two-tier merged lookup: TMDB exact-token search + Postgres pg_trgm fuzzy match against `movie_cache` (5,810+ titles) running in **parallel**, then merged
- "Star Wars problem" fixed — `star wr` was returning Star Wreck/Star Trek from TMDB tokens and never reaching fuzzy. Merge architecture surfaces Star Wars at sim 0.5 #1 via popularity ranking (TMDB blockbusters score 100+, fuzzy uses sim×200)
- TMDB enrichment: parallel `/movie/{id}?append_to_response=credits` per result for runtime + director (search payload alone doesn't include them)
- Backfill pass: any top-5 result missing overview/poster/release_date fires a TMDB title-lookup to fill the gap (older cache rows often have null overview)

**Supabase migrations 005-010** applied to production:
- 005 `pg_trgm` extension + GIN trigram index on `lower(data->>'title')` + `fuzzy_movie_suggestions` RPC
- 006 fix `OPERATOR(extensions.%)` qualification through PostgREST/RPC
- 007 `anonymous_search_whitelist` table + modified `check_anonymous_limit` to skip cap for whitelisted IPs (owner's IP `99.230.83.61` seeded)
- 008 add `overview` to function return
- 009 add `runtime`, `director`, `release_date`
- 010 replace `ROW_NUMBER` dedup with `GROUP BY lower(title)` + `array_agg FILTER (WHERE … IS NOT NULL)` so multiple cache rows per title coalesce into one rich record (fixed "Shrek shows only year" bug)

### Workstream 2: Movie Result Page Comprehensive Redesign (PR #44)

Top-to-bottom rebuild. Each major section iterated until user signed off.

**Hero card**:
- Poster 130×195 → **210×315** desktop / 178×267 mobile, with gold-glow on hover (lift + scale + 100px gold halo)
- Tagline: real curly quotes (`&ldquo;…&rdquo;`), italic dropped, gold-tinted Playfair
- Title in serif gradient text-fill, bigger clamp(26-40px), tighter letter-spacing
- Meta chips dark-at-rest gold-on-hover ("How It Works" landing pattern): year (Calendar), runtime in dual format `120 min · 2h 0m` (Clock), `Directed by NAME`
- **Pulsing Watch Trailer CTA** in the meta row — gold gradient, 16-32px halo pulsing to 28-56px on a 2.6s loop, lifts on hover

**True Movie Rating Score** (most-iterated section):
- Initial circular conic-gradient gauge with score inside — "score not centered" feedback
- Optical-center attempt with absolute positioning + `translate(-50%, calc(-50% + 4px))` — still off
- Speedometer arc with 5 colored bands (Unwatchable → Must Watch in gold) + qualitative label — user rejected ("looks absolutely horrible") and asked for **immediate rollback**
- Settled on **massive 124px Playfair gold-gradient number** with two-layer drop-shadow glow (28px close + 80px wide) replacing the gauge entirely. Right column kept tagline + StarDisplay row. User: "gorgeous"

**Source Breakdown**:
- Site favicons via Google `/s2/favicons` service (extracts domain from `source.url`, no asset hosting needed)
- `cleanSourceType()` strips noise words: Score, Rating, Percentage, Source, Rank, Points, Stars, Votes; maps quirky types to clean labels (Tomatometer → Critics, Audience Score → Audience, Metascore → Critics)
- Bigger rows (16/16/19px), gradient progress bar with glow

**Thumbs Up & Thumbs Down** (formerly "Hot Take"):
- Section-level Roger-Ebert branding ("Thumbs Up & Thumbs Down" accordion title with thumb icon)
- **Per-row icons are contextual** to each statement via `pickHotTakeIcon()` keyword matching with compound-phrase priority: "visual effects" → Wand2 before generic "visual"; "X to watch" → Eye; "middle/first/second act" → Clock not Acting; "philosophical premise" → Lightbulb (premise removed from Plot regex); "hope and friendship" → Heart; etc.
- Sub-headers: "The Good" (green) / "The Bad" (red) in italic Playfair, sub-labels "What works" / "What doesn't work"
- Caught a runtime crash mid-session: `Drama` icon (theater masks) was added to lucide-react in v0.281, this project has v0.263.1, so importing Drama returned undefined. Swapped acting/cast/performance category Drama → Users.

**Cast**: 54×54 → **96×96** headshots, gold ring on hover, lift + scale, name in Syne 13/700 + character in italic Playfair 12.

**Awards**: sorted wins-first via `[...awards].sort()`, gold left bar + ambient glow on Won rows, Trophy icon in pill.

**Production & Theatrical Run**:
- Icon per row by label (DollarSign for Budget, Sparkles for Opening, Globe for International/Worldwide, TrendingUp for ROI, Calendar for Days, Tv for Theater Count, Flame for Domestic, BarChart3 for PTA)
- All rows visually identical (no gold-tinted hero rows for consistency)
- `formatRank()` frontend normalizer wraps bare-number ranks (cached movies returning `1` for openingRank) into `#1 all-time` / `#X widest release` / `#X longest run` form
- Blank slot when no rank available (no "Unranked" placeholder per user)
- Claude prompt rewrite with mandatory rank-format rules: complete phrases only, no bare numbers, brackets like "Top 5%" preferred over null

**Where to Watch**: bigger StreamingBadge pills (13/19 padding), 26px logos, dark at rest with gold-glow on hover.

**You Might Also Like**:
- **FIXED aspect-ratio bug** — was `16/9` cropping most of every poster off; corrected to `2/3` portrait
- TMDB w300 → w342, hover: gold border + 32px gold glow + lifted card; poster scales 1.06; title overlay with bottom gradient
- Auto-fit grid (`minmax(118px, 1fr)`)

**Video Reviews**: auto-fit grid, 48px refined gold-gradient play button with 28% gold halo, title visible (was only channel), hover bumps everything.

**Accordion chrome**: section labels italic Playfair 19px (was Syne 12.5), gold-bordered icon chips that glow on open, soft top-down gradient on open state.

**Floating section sidebar (NEW)**:
- `ResultSidebar` component fixed at `right: calc(50% + 384px)` so it always sits 24px to the left of the centered 720px main column regardless of viewport width
- Auto-height; lists every populated section dynamically (Movie Overview, True Rating Score, Source Breakdown, Thumbs Up & Down, Video Reviews, Cast, Awards, Production & Run, Where to Watch, You Might Also Like)
- Click → smooth scroll with 110px sticky-header offset
- Active section highlighted via IntersectionObserver as user scrolls
- Hover on inactive items: gold border + glow
- Hidden under 1380px viewport, thin gold scrollbar when overflows

**Landing-page boot animations REMOVED**:
- LetterLine per-letter `letterIn` removed — "Every Film." renders fully visible at first paint
- Hero `<h1>` `fadeIn 0.7s` removed
- "One True Rating Score." italic span `softFade 1.2s 0.9s forwards` removed (now opacity:1 from first paint)
- `.bg-spotlight` `spotlightWarm 2.8s` keyframe + animation entirely removed
- Source ticker section boot `softFade 1.2s 2.2s forwards` removed
- Continuous decorative animations preserved (`goldShimmer`, `haloBreathe`, `tickerScroll`, `filmScroll`)
- Italic span line-height bumped to 1.18 + `paddingBottom: 0.08em` to stop the `g` descender clipping

### Workstream 3: VPS Forum Import Status

Checked once mid-session. PID 2644 still running on KVM 4. **~1,487 unique boards complete (~45%)** of 3,308 total as of Apr 29 morning. Currently processing "New York, New York" board. Pace consistent. ETA mid-May. Doubled-line cosmetic logging still present (queued fix).

### Files Modified

| File | PR | Purpose |
|------|----|---------|
| `components/film-glance.jsx` | #43, #44 | DYM redesign + result-page comprehensive overhaul (~1,200 line touched in PR #44) |
| `app/api/suggest/route.ts` | #43 | Two-tier merged TMDB + fuzzy lookup, popularity ranking, enrichment + backfill |
| `app/api/search/route.ts` | #44 | Box office prompt rewrite with mandatory rank-format rules |
| Supabase migrations 005-010 | #43 (data) | pg_trgm + fuzzy function + IP whitelist (production DB) |

### Key Learnings

1. **Iterate visually with the user.** The result-page redesign needed 13+ rounds because design feedback is fundamentally subjective. Quick push-and-iterate is faster than long up-front planning when the user has strong opinions and is engaged.
2. **Verify lucide-react icons against the installed version.** `Drama` was added in v0.281; this project has v0.263.1. Use `node -e "const l = require('./node_modules/lucide-react'); console.log(typeof l.Drama)"` to verify before importing.
3. **Optical centering of text inside circles is hard.** Multiple attempts (flex-baseline, absolute+translate with optical-correction) didn't satisfy the user. The path of least surprise was to abandon the inner-circle text entirely and render the score as a free-standing big number with glow.
4. **Compound-phrase regex priority matters.** "visual effects" needs to match VFX → Wand2 BEFORE generic "visual" → Palette. Order the keyword ladder from most-specific to least-specific.
5. **Roll back fearlessly when a design experiment fails.** The speedometer arc took ~30 minutes to build. User rejected it in one message. `git revert` is the right tool — don't try to defend the work.
6. **`formatRank()` covers cached-data degradation.** When changing an LLM prompt to ask for richer output, existing cache won't have the new fields for the cache TTL window. Frontend normalization wrapped in a helper handles the transition gracefully without forced cache busting.

### Next Steps (For Next Chat)

In priority order per user direction at session end:

1. **Polish the Favourites page** — `showFavs` view in `components/film-glance.jsx` with the FavoriteRow cards. Apply the same brand polish patterns established across the three-pass design series: gold-on-black, glow-on-hover, italic Playfair section headers, Syne body, dark-at-rest pills, gold-tinted accent borders. Likely needs improved card design, empty-state polish, hover spotlight effects, possibly a "Recently watched" / "Highest rated" sort toggle.
2. **Last-minute movie page fixes** — user has flagged additional small fixes from real-world testing of v5.10.29 in production. Details to be captured at start of next session.
3. **VPS forum import status check** — `ssh filmglance@147.93.113.39 "ps -ef | grep import_filmboards | grep -v grep; echo '---'; grep -c '✓ Board done' /root/filmboards-crawl/import.log; tail -5 /root/filmboards-crawl/import.log"`. Remember the doubled-line cosmetic — divide grep -c by 2. ETA still mid-May.
4. **Plan a brand-new Box Office Totals page** — entirely new top-level page. Requirements TBD with user. Likely involves a curated all-time top-N display, sortable/filterable columns (worldwide, domestic, opening, ROI, budget), maybe a year/decade filter, with the same brand chrome as the rest of the app. Will need a new route (e.g. `/box-office`), backend data source decision (cached top-N from Claude prompt? scraped from BoxOfficeMojo? curated dataset?), and design discovery before implementation.

Lower-priority queue (carried forward):
- Post-import cleanup: delete `components/ui/floating-particles.tsx` + drop `three` dep, remove `components/preview-landing.jsx`
- Doubled-log fix on next clean import stop (`run_import.sh` redirect change)
- KVM 4 → KVM 2 downgrade after import completes (~$15/mo savings)
- Post-import forum queue (GDPR removal, mobile audit, API health, Discuss links, staging cleanup, Capacitor mobile app)
- 6 Dependabot vulnerabilities (3 high, 3 moderate)
- Rotate Supabase PAT before Apr 17, 2027
- Delete dead `YOUTUBE_API_KEY` from Vercel
- Reconstruct missing `003_anonymous_searches.sql` migration
- Full Stripe teardown (optional)
- 2026-05-12 13:00 UTC scheduled cleanup agent (`trig_01XgUj4SH6z6d9vSp9Betg8R`) fires
- Restart Claude Code to activate `huashu-design` skill (personal use only)

---

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
