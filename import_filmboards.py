#!/usr/bin/env python3
"""
FilmBoards → NodeBB Import Script
==================================
Imports archived FilmBoards crawl data into NodeBB.

Strategy:
  - Each crawled board becomes ONE NodeBB topic.
  - Movie boards (with IMDb ID) → "The Cinema" (cid 6)
  - Non-movie boards → "The IMDb Archives" (cid 25)
  - Each original thread becomes ONE reply in the NodeBB topic,
    with all of its posts formatted inside the reply.
  - All posts created under "The IMDb Forum Archives" bot (uid 2).
  - Original author/date info preserved as formatted text.

Resume:
  - State stored in import_state.json
  - Re-running skips already-imported boards.

Usage:
  python3 import_filmboards.py
  python3 import_filmboards.py --dry-run    # validate without posting
  python3 import_filmboards.py --limit 10   # only import first 10 boards
"""

import json
import os
import sys
import time
import argparse
import requests
from pathlib import Path

# ───────────────────────────────────────────────────────────────────
# CONFIG — edit these if anything changes
# ───────────────────────────────────────────────────────────────────

CRAWL_DIR        = "/root/filmboards-crawl/crawl_data/boards"
STATE_FILE       = "/root/filmboards-crawl/import_state.json"
LOG_FILE         = "/root/filmboards-crawl/import.log"

NODEBB_URL       = "http://127.0.0.1:4567"      # local — bypasses Nginx, faster
API_TOKEN        = "6cd914fc-6730-4fca-9cf1-66ebb841f093"
BOT_UID          = 2                            # The IMDb Forum Archives
ADMIN_UID        = 1                            # fgadmin (token owner)

CINEMA_CID       = 6                            # The Cinema
ARCHIVES_CID     = 25                           # The IMDb Archives

REQUEST_DELAY    = 0.15                         # seconds between API calls
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
    return {"imported": {}, "errors": {}, "stats": {
        "boards_done": 0, "topics_created": 0, "replies_created": 0, "errors": 0
    }}


def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def api_post(path, payload, dry_run=False):
    """POST to NodeBB Write API as the bot user."""
    if dry_run:
        return {"dry_run": True, "payload": payload}

    url = f"{NODEBB_URL}{path}"
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json",
    }
    # _uid in body tells the master token to act as this user
    payload = dict(payload)
    payload["_uid"] = BOT_UID

    for attempt in range(MAX_RETRIES):
        try:
            r = requests.post(url, json=payload, headers=headers, timeout=30)
            if r.status_code in (200, 201):
                return r.json()
            log(f"  ! HTTP {r.status_code}: {r.text[:200]}")
            if r.status_code == 429:  # rate limited
                time.sleep(RETRY_DELAY * 2)
                continue
        except requests.RequestException as e:
            log(f"  ! Request failed: {e}")
        time.sleep(RETRY_DELAY)
    return None


def create_topic(cid, title, content, dry_run=False):
    return api_post("/api/v3/topics", {
        "cid": cid,
        "title": title[:255],   # NodeBB title limit
        "content": content,
    }, dry_run=dry_run)


def create_reply(tid, content, dry_run=False):
    return api_post(f"/api/v3/topics/{tid}", {
        "content": content,
    }, dry_run=dry_run)


def format_post(post):
    """Format a single original post as a quoted block."""
    author = post.get("author") or "Unknown"
    date   = post.get("date") or post.get("timestamp") or ""
    body   = (post.get("content") or "").strip()
    if not body:
        return ""
    header = f"**{author}**" + (f" — *{date}*" if date else "")
    # Indent body as blockquote
    body_lines = "\n".join(f"> {line}" for line in body.split("\n"))
    return f"{header}\n{body_lines}\n"


def format_thread_as_reply(thread):
    """Convert one original FilmBoards thread into a single NodeBB reply."""
    title  = thread.get("title") or thread.get("thread_title") or "Untitled"
    posts  = thread.get("posts") or []
    parts  = [f"### {title}", ""]
    for p in posts:
        f = format_post(p)
        if f:
            parts.append(f)
    parts.append("\n---")
    return "\n".join(parts)


def build_topic_intro(board):
    """First post for each NodeBB topic — board metadata."""
    title    = board.get("board_title") or "Untitled Board"
    imdb_id  = board.get("imdb_id")
    url      = board.get("board_url") or ""
    threads  = board.get("threads") or []
    n_threads = len(threads)
    n_posts  = sum(len(t.get("posts") or []) for t in threads)

    lines = [
        f"# {title}",
        "",
        "*Archived discussions imported from the original IMDb message boards via FilmBoards.com.*",
        "",
        f"- **Original threads:** {n_threads:,}",
        f"- **Original posts:** {n_posts:,}",
    ]
    if imdb_id:
        lines.append(f"- **IMDb ID:** [{imdb_id}](https://www.imdb.com/title/{imdb_id}/)")
    if url:
        lines.append(f"- **Source:** {url}")
    lines += [
        "",
        "---",
        "",
        "_Each reply below contains one archived discussion thread with all of its original posts. Authors and dates are preserved from the original IMDb boards. This category is read-only._",
    ]
    return "\n".join(lines)


def import_board(filepath, state, dry_run=False):
    """Import one crawled board JSON file."""
    fname = os.path.basename(filepath)
    if fname in state["imported"]:
        return "skipped"

    try:
        with open(filepath) as f:
            board = json.load(f)
    except Exception as e:
        log(f"  ! Failed to read {fname}: {e}")
        state["errors"][fname] = str(e)
        return "error"

    title    = board.get("board_title") or "Untitled Board"
    imdb_id  = board.get("imdb_id")
    threads  = board.get("threads") or []

    if not threads:
        log(f"  - Skipping {fname} — no threads")
        state["imported"][fname] = {"skipped": "empty"}
        return "empty"

    # Choose category
    cid = CINEMA_CID if imdb_id else ARCHIVES_CID
    cat_name = "The Cinema" if imdb_id else "The IMDb Archives"

    log(f"→ {fname} | {title[:60]} | {len(threads)} threads → {cat_name}")

    # Create the topic with intro post
    intro = build_topic_intro(board)
    topic_resp = create_topic(cid, title, intro, dry_run=dry_run)
    if not topic_resp:
        log(f"  ! Topic creation failed for {fname}")
        state["errors"][fname] = "topic_create_failed"
        state["stats"]["errors"] += 1
        return "error"

    if dry_run:
        tid = "DRY"
    else:
        # NodeBB v3 returns { response: { tid: N, ... } } or { tid: N }
        data = topic_resp.get("response", topic_resp)
        tid = data.get("tid") or data.get("topicData", {}).get("tid")
        if not tid:
            log(f"  ! No tid in response: {topic_resp}")
            state["errors"][fname] = "no_tid"
            return "error"

    state["stats"]["topics_created"] += 1
    time.sleep(REQUEST_DELAY)

    # Post each original thread as a reply
    reply_count = 0
    for i, thread in enumerate(threads):
        content = format_thread_as_reply(thread)
        if len(content) < 20:
            continue

        # NodeBB content limit is 32768 chars by default — chunk if needed
        if len(content) > 30000:
            chunks = [content[j:j+30000] for j in range(0, len(content), 30000)]
            for chunk in chunks:
                resp = create_reply(tid, chunk, dry_run=dry_run)
                if resp:
                    reply_count += 1
                time.sleep(REQUEST_DELAY)
        else:
            resp = create_reply(tid, content, dry_run=dry_run)
            if resp:
                reply_count += 1
            time.sleep(REQUEST_DELAY)

        # Save state every 25 replies for resume safety
        if i > 0 and i % 25 == 0:
            state["stats"]["replies_created"] += reply_count
            save_state(state)
            reply_count = 0

    state["stats"]["replies_created"] += reply_count
    state["imported"][fname] = {"tid": tid, "threads": len(threads)}
    state["stats"]["boards_done"] += 1
    save_state(state)
    log(f"  ✓ Done — tid {tid}, {len(threads)} replies")
    return "ok"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Validate without posting")
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
    log(f"Resuming — already imported: {len(state['imported'])}")

    started = time.time()
    for i, filepath in enumerate(files):
        try:
            import_board(str(filepath), state, dry_run=args.dry_run)
        except KeyboardInterrupt:
            log("Interrupted — saving state and exiting.")
            save_state(state)
            sys.exit(0)
        except Exception as e:
            log(f"  ! Unexpected error on {filepath.name}: {e}")
            state["errors"][filepath.name] = str(e)
            state["stats"]["errors"] += 1
            save_state(state)

        if (i + 1) % 10 == 0:
            elapsed = time.time() - started
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            remaining = (len(files) - i - 1) / rate if rate > 0 else 0
            log(f"--- Progress: {i+1}/{len(files)} | "
                f"{state['stats']['topics_created']} topics, "
                f"{state['stats']['replies_created']} replies | "
                f"~{remaining/3600:.1f}h remaining ---")

    log("=" * 60)
    log("IMPORT COMPLETE")
    log(f"Boards imported: {state['stats']['boards_done']}")
    log(f"Topics created:  {state['stats']['topics_created']}")
    log(f"Replies created: {state['stats']['replies_created']}")
    log(f"Errors:          {state['stats']['errors']}")


if __name__ == "__main__":
    main()
