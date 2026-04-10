#!/usr/bin/env python3
"""
FilmBoards → NodeBB Import Script v3
======================================
Each original thread becomes its own NodeBB topic.
Each original post/reply becomes a NodeBB reply.

- Movie boards (with IMDb ID) → "The Cinema" (cid 6)
- Non-movie boards → "The IMDb Archives" (cid 25)
- All posted under "The IMDb Forum Archives" bot (uid 2)
- Original author/date preserved in each post

Resume: tracks completed boards + position within current board.

Usage:
  python3 import_filmboards.py --limit 5     # first 5 boards
  python3 import_filmboards.py               # all boards
"""

import json
import os
import sys
import time
import argparse
import requests
from pathlib import Path

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
    title = thread.get("title") or thread.get("thread_title") or ""
    posts = thread.get("posts") or []

    if not posts:
        state["stats"]["skipped_empty"] += 1
        return "empty"

    # Use thread title, fall back to first post content snippet
    if not title or len(title.strip()) < 2:
        first_content = (posts[0].get("content") or "").strip()
        title = first_content[:100] if first_content else "Untitled Thread"

    # Clean title for NodeBB (min 3 chars, max 255)
    title = title.strip()[:255]
    if len(title) < 3:
        title = f"Thread: {title}" if title else "Untitled Thread"

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

        # Chunk if too long
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

    # Resume support: skip threads already done in this board
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
        thread_title = (thread.get("title") or thread.get("thread_title") or "")[:60]

        result = import_thread(thread, cid, board_title, state)

        state["current_thread_idx"] = i + 1

        # Save state every 10 threads
        if (i + 1) % 10 == 0:
            save_state(state)
            if (i + 1) % 50 == 0:
                log(f"  ... {i+1}/{len(threads)} threads done")

    # Board complete
    state["completed_boards"].append(fname)
    state["current_board"] = None
    state["current_thread_idx"] = 0
    state["stats"]["boards_done"] += 1
    save_state(state)
    log(f"  ✓ Board done — {len(threads)} threads imported")
    return "ok"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Only import first N boards")
    parser.add_argument("--start", type=int, default=0, help="Skip first N files")
    args = parser.parse_args()

    if not API_TOKEN or len(API_TOKEN) < 20:
        print("ERROR: API_TOKEN is missing or invalid.")
        sys.exit(1)

    files = sorted(Path(CRAWL_DIR).glob("*.json"))
    log(f"Found {len(files)} crawled board files")

    if args.start:
        files = files[args.start:]
    if args.limit:
        files = files[:args.limit]

    state = load_state()
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
                f"{s['errors']} errors | "
                f"~{remaining/3600:.1f}h remaining ---")

    s = state["stats"]
    log("=" * 60)
    log("IMPORT COMPLETE")
    log(f"Boards processed: {s['boards_done']}")
    log(f"Topics created:   {s['topics_created']}")
    log(f"Replies created:  {s['replies_created']}")
    log(f"Skipped empty:    {s['skipped_empty']}")
    log(f"Errors:           {s['errors']}")


if __name__ == "__main__":
    main()
