#!/usr/bin/env python3
"""
FilmBoards → NodeBB Import Script v5
======================================
Each original thread becomes its own NodeBB topic.
Each original post/reply becomes a NodeBB reply.
Bad titles (relative timestamps, bare numbers) replaced with first post content.

v5 CHANGES:
  - Deduplication: threads with identical titles within a board are handled:
    - Same title + same/similar first post → true duplicate → keep thread with most posts
    - Same title + different first post → unique discussions → keep all, append " (2)", " (3)"
  - --analyze flag: scan all boards and report duplicate stats without importing
  - Dedup stats tracked in import_state.json and progress logs

- Movie boards (with IMDb ID) → "The Cinema" (cid 6)
- Non-movie boards → "The IMDb Archives" (cid 25)
- All posted under "The IMDb Forum Archives" bot (uid 2)
- Original author/date preserved in each post

Resume: tracks completed boards + position within current board.

Usage:
  python3 import_filmboards.py --analyze          # scan duplicates only (no import)
  python3 import_filmboards.py --analyze --limit 5 # scan first 5 boards
  python3 import_filmboards.py --limit 5           # import first 5 boards
  python3 import_filmboards.py                     # import all boards
"""

import json
import os
import sys
import re
import time
import argparse
import requests
from pathlib import Path
from collections import defaultdict

# ───────────────────────────────────────────────────────────────────
# CONFIG
# ───────────────────────────────────────────────────────────────────

CRAWL_DIR        = "/root/filmboards-crawl/crawl_data/boards"
STATE_FILE       = "/root/filmboards-crawl/import_state.json"
LOG_FILE         = "/root/filmboards-crawl/import.log"

NODEBB_URL       = "http://127.0.0.1:4567"
API_TOKEN        = "6cd914fc-6730-4fca-9cf1-66ebb841f093"
BOT_UID          = 2
ADMIN_UID        = 1

CINEMA_CID       = 6
ARCHIVES_CID     = 25

REQUEST_DELAY    = 0.1
MAX_RETRIES      = 3
RETRY_DELAY      = 5

# Similarity threshold for first-post comparison (0-1)
# Posts with similarity >= this are considered true duplicates
CONTENT_SIMILARITY_THRESHOLD = 0.7

# ───────────────────────────────────────────────────────────────────


def log(msg):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)
    return {
        "completed_boards": [],
        "current_board": None,
        "current_thread_idx": 0,
        "stats": {
            "boards_done": 0,
            "topics_created": 0,
            "replies_created": 0,
            "skipped_empty": 0,
            "skipped_duplicate": 0,
            "renamed_same_title": 0,
            "errors": 0
        }
    }


def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def api_post(path, payload):
    url = f"{NODEBB_URL}{path}"
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = dict(payload)
    payload["_uid"] = BOT_UID

    for attempt in range(MAX_RETRIES):
        try:
            r = requests.post(url, json=payload, headers=headers, timeout=30)
            if r.status_code in (200, 201):
                return r.json()
            if r.status_code == 429:
                log(f"  ! Rate limited, waiting...")
                time.sleep(RETRY_DELAY * 3)
                continue
            log(f"  ! HTTP {r.status_code}: {r.text[:200]}")
        except requests.RequestException as e:
            log(f"  ! Request failed: {e}")
        time.sleep(RETRY_DELAY)
    return None


def is_bad_title(t):
    """Detect titles that are relative timestamps, bare numbers, or meaningless."""
    t = t.strip()
    if not t or len(t) < 3:
        return True
    if re.match(r'^\d+$', t):
        return True
    if re.match(r'^\d+\s+(years?|months?|days?|hours?|minutes?|weeks?)\s+ago$', t, re.IGNORECASE):
        return True
    if re.match(r'^(about\s+)?\d+\s+(years?|months?|days?|hours?|minutes?|weeks?)\s+ago$', t, re.IGNORECASE):
        return True
    if re.match(r'^(less than|more than)\s+(a|an|\d+)\s+(year|month|day|hour|minute|week)', t, re.IGNORECASE):
        return True
    if re.match(r'^(yesterday|today|last\s+week|last\s+month|last\s+year)$', t, re.IGNORECASE):
        return True
    if t.lower() in ('post deleted', 'deleted', 'untitled', 'thread', 'no title',
                      'this message has been deleted', 'n/a', 'none', 'null'):
        return True
    if re.match(r'^thread:?\s*\d*$', t, re.IGNORECASE):
        return True
    return False


def clean_title(raw_title, posts):
    """Get a good title from the thread data."""
    t = (raw_title or "").strip()

    if is_bad_title(t):
        # Use first line of first post content as title
        if posts:
            first_content = (posts[0].get("content") or "").strip()
            if first_content:
                # Take first line, up to 120 chars
                first_line = first_content.split('\n')[0].strip()
                if len(first_line) > 3 and not is_bad_title(first_line):
                    return first_line[:120]
                # If first line is also bad, take first 120 chars
                snippet = first_content[:120].replace('\n', ' ').strip()
                if len(snippet) > 3:
                    return snippet
        return "Archived Thread"

    return t[:255]


def normalize_for_dedup(title):
    """Normalize a title for duplicate comparison — lowercase, strip punctuation/whitespace."""
    t = title.lower().strip()
    t = re.sub(r'[^a-z0-9\s]', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def get_first_post_text(thread):
    """Extract the first post's content text for similarity comparison."""
    posts = thread.get("posts") or []
    if not posts:
        return ""
    content = (posts[0].get("content") or "").strip()
    # Normalize: lowercase, collapse whitespace, take first 500 chars for comparison
    content = re.sub(r'\s+', ' ', content.lower().strip())
    return content[:500]


def content_similarity(text_a, text_b):
    """
    Simple word-overlap similarity between two text snippets.
    Returns float 0-1. Good enough for detecting true duplicates.
    """
    if not text_a and not text_b:
        return 1.0
    if not text_a or not text_b:
        return 0.0

    words_a = set(text_a.split())
    words_b = set(text_b.split())

    if not words_a or not words_b:
        return 0.0

    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union)  # Jaccard similarity


def deduplicate_threads(threads, board_title=""):
    """
    Deduplicate threads within a single board.

    Strategy:
    1. Group threads by their normalized cleaned title
    2. For groups with multiple threads:
       a. Compare first post content of each thread in the group
       b. If content is similar (>= threshold) → true duplicate → keep the one with most posts
       c. If content is different → unique discussions → keep all, append " (2)", " (3)" to title
    3. Return (deduped_threads, stats_dict)

    Each returned thread gets a "_deduped_title" field with the final title to use.
    """
    stats = {
        "total_before": len(threads),
        "total_after": 0,
        "true_duplicates_removed": 0,
        "renamed_same_title": 0,
        "groups_with_dupes": 0,
    }

    if not threads:
        return [], stats

    # Step 1: Clean titles and group by normalized version
    grouped = defaultdict(list)
    for i, thread in enumerate(threads):
        posts = thread.get("posts") or []
        title = clean_title(thread.get("title") or thread.get("thread_title") or "", posts)
        norm = normalize_for_dedup(title)
        grouped[norm].append((i, title, thread))

    deduped = []

    for norm_title, group in grouped.items():
        if len(group) == 1:
            # No duplicates — pass through
            idx, title, thread = group[0]
            thread["_deduped_title"] = title
            deduped.append(thread)
            continue

        # Multiple threads with the same normalized title
        stats["groups_with_dupes"] += 1

        # Step 2: Sub-group by content similarity
        # We cluster threads whose first-post content is similar
        clusters = []  # list of lists: each cluster = threads with similar content

        for idx, title, thread in group:
            first_text = get_first_post_text(thread)
            placed = False

            for cluster in clusters:
                # Compare against the first thread in this cluster
                cluster_text = get_first_post_text(cluster[0][2])
                sim = content_similarity(first_text, cluster_text)
                if sim >= CONTENT_SIMILARITY_THRESHOLD:
                    cluster.append((idx, title, thread))
                    placed = True
                    break

            if not placed:
                clusters.append([(idx, title, thread)])

        # Step 3: For each cluster with true duplicates, keep only the thread
        # with the most posts. Replace the cluster contents in-place.
        for ci, cluster in enumerate(clusters):
            if len(cluster) > 1:
                # True duplicates — sort by post count descending, keep the best
                cluster.sort(key=lambda x: len(x[2].get("posts") or []), reverse=True)
                removed_count = len(cluster) - 1
                stats["true_duplicates_removed"] += removed_count
                clusters[ci] = [cluster[0]]  # Replace in the actual list

        # Step 4: Assign titles — if multiple clusters exist, they're unique discussions
        # sharing the same title, so we append suffixes to differentiate.
        keepers = []
        if len(clusters) > 1:
            suffix_num = 0
            for cluster in clusters:
                for idx, title, thread in cluster:
                    suffix_num += 1
                    if suffix_num == 1:
                        thread["_deduped_title"] = title  # first one keeps original
                    else:
                        thread["_deduped_title"] = f"{title} ({suffix_num})"
                        stats["renamed_same_title"] += 1
                    keepers.append(thread)
        else:
            # Single cluster (all were true dupes or just one thread)
            for idx, title, thread in clusters[0]:
                thread["_deduped_title"] = title
                keepers.append(thread)

        deduped.extend(keepers)

    stats["total_after"] = len(deduped)
    return deduped, stats


def format_post_content(post):
    """Format a single post with author and date header."""
    author = post.get("author") or "Unknown"
    date = post.get("date") or post.get("timestamp") or ""
    body = (post.get("content") or "").strip()
    if not body:
        return ""

    header = f"**{author}**" + (f" — *{date}*" if date else "")
    return f"{header}\n\n{body}"


def import_thread(thread, cid, board_title, state):
    """Import one original thread as a NodeBB topic with replies."""
    posts = thread.get("posts") or []

    if not posts:
        state["stats"]["skipped_empty"] += 1
        return "empty"

    # Use deduped title if available, otherwise fall back to clean_title
    title = thread.get("_deduped_title")
    if not title:
        raw_title = thread.get("title") or thread.get("thread_title") or ""
        title = clean_title(raw_title, posts)

    # Ensure minimum length for NodeBB
    if len(title) < 3:
        title = "Archived Thread"

    # First post becomes the topic content
    first_post = posts[0]
    topic_content = format_post_content(first_post)
    if not topic_content or len(topic_content) < 5:
        topic_content = f"*Archived from the IMDb Discussion Forums — {board_title}*"

    # Add archive attribution at the top
    topic_content = (
        f"*Archived from the IMDb Discussion Forums — {board_title}*\n\n---\n\n"
        + topic_content
    )

    # Create the topic
    topic_resp = api_post("/api/v3/topics", {
        "cid": cid,
        "title": title,
        "content": topic_content,
    })

    if not topic_resp:
        state["stats"]["errors"] += 1
        return "error"

    data = topic_resp.get("response", topic_resp)
    tid = data.get("tid") or data.get("topicData", {}).get("tid")
    if not tid:
        state["stats"]["errors"] += 1
        return "error"

    state["stats"]["topics_created"] += 1
    time.sleep(REQUEST_DELAY)

    # Remaining posts become replies
    for post in posts[1:]:
        content = format_post_content(post)
        if not content or len(content) < 3:
            continue

        if len(content) > 30000:
            chunks = [content[j:j+30000] for j in range(0, len(content), 30000)]
            for chunk in chunks:
                api_post(f"/api/v3/topics/{tid}", {"content": chunk})
                state["stats"]["replies_created"] += 1
                time.sleep(REQUEST_DELAY)
        else:
            resp = api_post(f"/api/v3/topics/{tid}", {"content": content})
            if resp:
                state["stats"]["replies_created"] += 1
            time.sleep(REQUEST_DELAY)

    return "ok"


def import_board(filepath, state):
    """Import all threads from one board file."""
    fname = os.path.basename(filepath)

    if fname in state["completed_boards"]:
        return "skipped"

    try:
        with open(filepath) as f:
            board = json.load(f)
    except Exception as e:
        log(f"  ! Failed to read {fname}: {e}")
        state["stats"]["errors"] += 1
        return "error"

    board_title = board.get("board_title") or "Untitled Board"
    imdb_id = board.get("imdb_id")
    threads = board.get("threads") or []

    if not threads:
        log(f"  - Skipping {fname} — no threads")
        state["completed_boards"].append(fname)
        return "empty"

    cid = CINEMA_CID if imdb_id else ARCHIVES_CID
    cat_name = "The Cinema" if imdb_id else "The IMDb Archives"

    # ── Deduplication (v5) ──────────────────────────────────────────
    threads, dedup_stats = deduplicate_threads(threads, board_title)

    if dedup_stats["true_duplicates_removed"] > 0 or dedup_stats["renamed_same_title"] > 0:
        log(f"  [dedup] {board_title[:50]}: "
            f"{dedup_stats['total_before']} → {dedup_stats['total_after']} threads "
            f"({dedup_stats['true_duplicates_removed']} true dupes removed, "
            f"{dedup_stats['renamed_same_title']} renamed)")

    state["stats"]["skipped_duplicate"] += dedup_stats["true_duplicates_removed"]
    state["stats"]["renamed_same_title"] += dedup_stats["renamed_same_title"]
    # ────────────────────────────────────────────────────────────────

    # Resume support
    start_idx = 0
    if state["current_board"] == fname:
        start_idx = state["current_thread_idx"]
        log(f"↻ Resuming {fname} from thread {start_idx}/{len(threads)}")
    else:
        state["current_board"] = fname
        state["current_thread_idx"] = 0
        save_state(state)

    total_posts = sum(len(t.get("posts") or []) for t in threads)
    log(f"→ {fname} | {board_title[:50]} | {len(threads)} threads, {total_posts} posts → {cat_name}")

    for i in range(start_idx, len(threads)):
        thread = threads[i]
        import_thread(thread, cid, board_title, state)

        state["current_thread_idx"] = i + 1

        if (i + 1) % 10 == 0:
            save_state(state)
            if (i + 1) % 50 == 0:
                log(f"  ... {i+1}/{len(threads)} threads done")

    state["completed_boards"].append(fname)
    state["current_board"] = None
    state["current_thread_idx"] = 0
    state["stats"]["boards_done"] += 1
    save_state(state)
    log(f"  ✓ Board done — {len(threads)} threads imported")
    return "ok"


# ───────────────────────────────────────────────────────────────────
# ANALYZE MODE — scan all boards and report duplicates (no import)
# ───────────────────────────────────────────────────────────────────

def analyze_duplicates(files):
    """Scan all board files and report duplicate thread statistics."""
    total_stats = {
        "boards_scanned": 0,
        "boards_with_dupes": 0,
        "total_threads_before": 0,
        "total_threads_after": 0,
        "total_true_dupes_removed": 0,
        "total_renamed": 0,
        "worst_boards": [],  # (board_title, filename, dupes_removed, renamed)
    }

    print("=" * 70)
    print("DUPLICATE ANALYSIS — Scanning all board files")
    print("=" * 70)
    print()

    for i, filepath in enumerate(files):
        fname = os.path.basename(filepath)
        try:
            with open(filepath) as f:
                board = json.load(f)
        except Exception as e:
            print(f"  ! Failed to read {fname}: {e}")
            continue

        board_title = board.get("board_title") or "Untitled Board"
        threads = board.get("threads") or []

        if not threads:
            continue

        total_stats["boards_scanned"] += 1
        total_stats["total_threads_before"] += len(threads)

        _, dedup_stats = deduplicate_threads(threads, board_title)

        total_stats["total_threads_after"] += dedup_stats["total_after"]
        total_stats["total_true_dupes_removed"] += dedup_stats["true_duplicates_removed"]
        total_stats["total_renamed"] += dedup_stats["renamed_same_title"]

        has_dupes = dedup_stats["true_duplicates_removed"] > 0 or dedup_stats["renamed_same_title"] > 0
        if has_dupes:
            total_stats["boards_with_dupes"] += 1
            total_stats["worst_boards"].append((
                board_title, fname,
                dedup_stats["true_duplicates_removed"],
                dedup_stats["renamed_same_title"],
                dedup_stats["total_before"],
                dedup_stats["total_after"]
            ))

        if (i + 1) % 200 == 0:
            print(f"  ... scanned {i+1}/{len(files)} boards", flush=True)

    # Sort worst boards by total dupes removed
    total_stats["worst_boards"].sort(key=lambda x: x[2] + x[3], reverse=True)

    # Print report
    print()
    print("=" * 70)
    print("ANALYSIS RESULTS")
    print("=" * 70)
    print()
    print(f"  Boards scanned:           {total_stats['boards_scanned']:,}")
    print(f"  Boards with duplicates:   {total_stats['boards_with_dupes']:,}")
    print()
    print(f"  Total threads (before):   {total_stats['total_threads_before']:,}")
    print(f"  Total threads (after):    {total_stats['total_threads_after']:,}")
    print(f"  True duplicates removed:  {total_stats['total_true_dupes_removed']:,}")
    print(f"  Same-title renamed:       {total_stats['total_renamed']:,}")
    print()

    if total_stats["worst_boards"]:
        print("  Top 30 boards by duplicate count:")
        print("  " + "-" * 66)
        print(f"  {'Board Title':<35} {'Before':>7} {'After':>7} {'Dupes':>6} {'Renamed':>8}")
        print("  " + "-" * 66)
        for title, fname, dupes, renamed, before, after in total_stats["worst_boards"][:30]:
            print(f"  {title[:35]:<35} {before:>7} {after:>7} {dupes:>6} {renamed:>8}")
        print()

    # Write analysis to file
    report_path = "/root/filmboards-crawl/dedup_analysis.json"
    try:
        report = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "summary": {
                "boards_scanned": total_stats["boards_scanned"],
                "boards_with_dupes": total_stats["boards_with_dupes"],
                "total_threads_before": total_stats["total_threads_before"],
                "total_threads_after": total_stats["total_threads_after"],
                "true_duplicates_removed": total_stats["total_true_dupes_removed"],
                "same_title_renamed": total_stats["total_renamed"],
            },
            "boards_with_duplicates": [
                {
                    "board_title": title,
                    "filename": fname,
                    "threads_before": before,
                    "threads_after": after,
                    "true_duplicates_removed": dupes,
                    "same_title_renamed": renamed,
                }
                for title, fname, dupes, renamed, before, after in total_stats["worst_boards"]
            ]
        }
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)
        print(f"  Full report saved to: {report_path}")
    except Exception as e:
        print(f"  ! Could not save report: {e}")

    print()
    return total_stats


# ───────────────────────────────────────────────────────────────────
# MAIN
# ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Only process first N boards")
    parser.add_argument("--start", type=int, default=0, help="Skip first N files")
    parser.add_argument("--analyze", action="store_true", help="Scan for duplicates only — no import")
    args = parser.parse_args()

    files = sorted(Path(CRAWL_DIR).glob("*.json"))

    if not files:
        print(f"ERROR: No JSON files found in {CRAWL_DIR}")
        sys.exit(1)

    if args.start:
        files = files[args.start:]
    if args.limit:
        files = files[:args.limit]

    # ── Analyze mode ──────────────────────────────────────────
    if args.analyze:
        print(f"Found {len(files)} board files to analyze")
        analyze_duplicates(files)
        return

    # ── Import mode ───────────────────────────────────────────
    if not API_TOKEN or len(API_TOKEN) < 20:
        print("ERROR: API_TOKEN is missing or invalid.")
        sys.exit(1)

    log(f"Found {len(files)} crawled board files")

    state = load_state()

    # Ensure v5 stats fields exist (upgrade from v4 state)
    if "skipped_duplicate" not in state["stats"]:
        state["stats"]["skipped_duplicate"] = 0
    if "renamed_same_title" not in state["stats"]:
        state["stats"]["renamed_same_title"] = 0

    log(f"Resuming — completed boards: {len(state['completed_boards'])}")

    started = time.time()
    for i, filepath in enumerate(files):
        try:
            import_board(str(filepath), state)
        except KeyboardInterrupt:
            log("Interrupted — saving state and exiting.")
            save_state(state)
            sys.exit(0)
        except Exception as e:
            log(f"  ! Unexpected error on {filepath.name}: {e}")
            state["stats"]["errors"] += 1
            save_state(state)

        if (i + 1) % 5 == 0:
            elapsed = time.time() - started
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            remaining = (len(files) - i - 1) / rate if rate > 0 else 0
            s = state["stats"]
            log(f"--- Progress: {i+1}/{len(files)} boards | "
                f"{s['topics_created']} topics, "
                f"{s['replies_created']} replies, "
                f"{s['skipped_duplicate']} dupes removed, "
                f"{s['renamed_same_title']} renamed, "
                f"{s['errors']} errors | "
                f"~{remaining/3600:.1f}h remaining ---")

    s = state["stats"]
    log("=" * 60)
    log("IMPORT COMPLETE")
    log(f"Boards processed:     {s['boards_done']}")
    log(f"Topics created:       {s['topics_created']}")
    log(f"Replies created:      {s['replies_created']}")
    log(f"Skipped empty:        {s['skipped_empty']}")
    log(f"Duplicates removed:   {s['skipped_duplicate']}")
    log(f"Same-title renamed:   {s['renamed_same_title']}")
    log(f"Errors:               {s['errors']}")


if __name__ == "__main__":
    main()
