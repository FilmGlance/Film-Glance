#!/usr/bin/env python3
"""
FilmBoards.com Crawler for Film Glance Forum
=============================================
Crawls archived IMDb message board posts from filmboards.com
and outputs structured JSON files organized by movie (IMDb ID).

Usage:
    python3 filmboards_crawler.py                  # Start from beginning
    python3 filmboards_crawler.py --resume         # Resume from last checkpoint
    python3 filmboards_crawler.py --test           # Test mode: crawl 5 boards only

Output:
    ./crawl_data/boards/           - One JSON file per movie board
    ./crawl_data/checkpoint.json   - Resume state
    ./crawl_data/stats.json        - Running statistics
    ./crawl_data/errors.log        - Failed URLs

Requirements:
    pip3 install aiohttp beautifulsoup4 lxml

Deploy on VPS:
    1. SSH into your Hostinger VPS
    2. mkdir -p /root/filmboards-crawl && cd /root/filmboards-crawl
    3. Upload this file
    4. pip3 install aiohttp beautifulsoup4 lxml
    5. nohup python3 filmboards_crawler.py > crawl.log 2>&1 &
    6. tail -f crawl.log   (to monitor)
"""

import asyncio
import aiohttp
import json
import os
import sys
import time
import re
import logging
from datetime import datetime, timezone
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, parse_qs
from collections import defaultdict

# ── Configuration ─────────────────────────────────────────────────────────────

BASE_URL = "https://www.filmboards.com"
CRAWL_DIR = Path("./crawl_data")
BOARDS_DIR = CRAWL_DIR / "boards"
CHECKPOINT_FILE = CRAWL_DIR / "checkpoint.json"
STATS_FILE = CRAWL_DIR / "stats.json"
ERROR_LOG = CRAWL_DIR / "errors.log"

# Crawl rate: be respectful — 2 requests/sec max
REQUESTS_PER_SECOND = 2.0
REQUEST_DELAY = 1.0 / REQUESTS_PER_SECOND

# Connection settings
TIMEOUT = aiohttp.ClientTimeout(total=30)
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds between retries
CONCURRENT_REQUESTS = 3  # max simultaneous requests (conservative)

# User agent — identify ourselves
USER_AGENT = (
    "FilmGlanceCrawler/1.0 "
    "(https://filmglance.com; archival purposes; "
    "contact: rod@filmglance.com)"
)

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("filmboards")

# ── State Management ──────────────────────────────────────────────────────────

class CrawlState:
    """Tracks crawl progress for checkpointing and resume."""

    def __init__(self):
        self.discovered_boards = []       # list of board URLs to crawl
        self.completed_boards = set()     # board URLs already finished
        self.current_board_idx = 0
        self.stats = {
            "boards_discovered": 0,
            "boards_completed": 0,
            "threads_crawled": 0,
            "posts_extracted": 0,
            "errors": 0,
            "started_at": None,
            "last_update": None,
        }

    def save(self):
        """Persist state to disk for resume."""
        CRAWL_DIR.mkdir(parents=True, exist_ok=True)
        checkpoint = {
            "discovered_boards": self.discovered_boards,
            "completed_boards": list(self.completed_boards),
            "current_board_idx": self.current_board_idx,
        }
        with open(CHECKPOINT_FILE, "w") as f:
            json.dump(checkpoint, f)
        self.stats["last_update"] = datetime.now(timezone.utc).isoformat()
        with open(STATS_FILE, "w") as f:
            json.dump(self.stats, f, indent=2)

    def load(self):
        """Load state from disk."""
        if CHECKPOINT_FILE.exists():
            with open(CHECKPOINT_FILE) as f:
                data = json.load(f)
            self.discovered_boards = data.get("discovered_boards", [])
            self.completed_boards = set(data.get("completed_boards", []))
            self.current_board_idx = data.get("current_board_idx", 0)
            log.info(
                f"Resumed: {len(self.completed_boards)}/{len(self.discovered_boards)} "
                f"boards completed"
            )
            return True
        return False

# ── HTTP Fetching ─────────────────────────────────────────────────────────────

class RateLimiter:
    """Simple token bucket rate limiter."""

    def __init__(self, rate: float):
        self.rate = rate
        self.last_request = 0.0

    async def wait(self):
        now = time.monotonic()
        elapsed = now - self.last_request
        if elapsed < self.rate:
            await asyncio.sleep(self.rate - elapsed)
        self.last_request = time.monotonic()


rate_limiter = RateLimiter(REQUEST_DELAY)


async def fetch(session: aiohttp.ClientSession, url: str, retries: int = MAX_RETRIES) -> str | None:
    """Fetch a URL with rate limiting and retries."""
    for attempt in range(retries):
        await rate_limiter.wait()
        try:
            async with session.get(url, headers=HEADERS, timeout=TIMEOUT) as resp:
                if resp.status == 200:
                    return await resp.text()
                elif resp.status == 429:
                    wait = int(resp.headers.get("Retry-After", 30))
                    log.warning(f"Rate limited. Waiting {wait}s...")
                    await asyncio.sleep(wait)
                elif resp.status == 404:
                    return None
                else:
                    log.warning(f"HTTP {resp.status} for {url}")
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            log.warning(f"Attempt {attempt+1}/{retries} failed for {url}: {e}")
            if attempt < retries - 1:
                await asyncio.sleep(RETRY_DELAY * (attempt + 1))

    log.error(f"Failed after {retries} attempts: {url}")
    with open(ERROR_LOG, "a") as f:
        f.write(f"{datetime.now(timezone.utc).isoformat()} FETCH_FAIL {url}\n")
    return None

# ── Parsing ───────────────────────────────────────────────────────────────────

def extract_imdb_id(url: str, soup: BeautifulSoup) -> str | None:
    """Try to extract IMDb title ID (tt1234567) from a board page."""
    # Check for IMDb links on the page
    for link in soup.find_all("a", href=True):
        href = link["href"]
        match = re.search(r"(tt\d{7,})", href)
        if match:
            return match.group(1)
    # Check meta tags or page content
    text = soup.get_text()
    match = re.search(r"(tt\d{7,})", text)
    if match:
        return match.group(1)
    return None


def extract_board_title(soup: BeautifulSoup) -> str:
    """Extract the movie/board title from the page."""
    # Look for the board title in h1 or specific elements
    h1 = soup.find("h1")
    if h1:
        return h1.get_text(strip=True)
    title_tag = soup.find("title")
    if title_tag:
        t = title_tag.get_text(strip=True)
        # Strip " - filmboards.com" suffix
        return re.sub(r"\s*[-–]\s*filmboards\.com.*$", "", t, flags=re.IGNORECASE)
    return "Unknown"


def parse_thread_list(soup: BeautifulSoup, board_url: str) -> list[dict]:
    """Parse a board page to extract thread links and metadata."""
    threads = []
    # FilmBoards uses table rows or div-based thread listings
    # Look for links that go to individual threads
    for link in soup.find_all("a", href=True):
        href = link["href"]
        full_url = urljoin(board_url, href)
        # Thread URLs typically contain /board/p/ or /t/
        if "/board/p/" in full_url or "/t/" in full_url:
            title = link.get_text(strip=True)
            if title and len(title) > 1:
                threads.append({
                    "url": full_url,
                    "title": title,
                })
    # Deduplicate by URL
    seen = set()
    unique = []
    for t in threads:
        if t["url"] not in seen:
            seen.add(t["url"])
            unique.append(t)
    return unique


def parse_posts(soup: BeautifulSoup) -> list[dict]:
    """Extract individual posts from a thread page."""
    posts = []

    # Strategy 1: Look for post containers (common patterns)
    # FilmBoards likely uses divs or table cells for posts
    post_containers = soup.find_all(
        ["div", "article", "tr"],
        class_=lambda c: c and any(
            kw in str(c).lower()
            for kw in ["post", "message", "reply", "comment", "entry"]
        ),
    )

    if not post_containers:
        # Strategy 2: Look for any structured content blocks
        post_containers = soup.find_all("div", class_=True)
        post_containers = [
            div for div in post_containers
            if div.find("p") or div.find(class_=lambda c: c and "content" in str(c).lower())
        ]

    for container in post_containers:
        post = extract_single_post(container)
        if post and post.get("content") and len(post["content"].strip()) > 0:
            posts.append(post)

    # If structured parsing didn't work, try a simpler approach
    if not posts:
        posts = extract_posts_fallback(soup)

    return posts


def extract_single_post(container) -> dict | None:
    """Extract author, timestamp, and content from a single post container."""
    post = {}

    # Author: look for username-like elements
    author_el = container.find(
        class_=lambda c: c and any(
            kw in str(c).lower()
            for kw in ["author", "user", "poster", "name", "member"]
        )
    )
    if author_el:
        post["author"] = author_el.get_text(strip=True)
    else:
        # Look for bold text or links that might be usernames
        bold = container.find("b") or container.find("strong")
        if bold:
            text = bold.get_text(strip=True)
            if len(text) < 40:  # usernames are short
                post["author"] = text

    # Timestamp: look for date-like elements
    time_el = container.find("time") or container.find(
        class_=lambda c: c and any(
            kw in str(c).lower()
            for kw in ["date", "time", "posted", "timestamp"]
        )
    )
    if time_el:
        post["timestamp"] = time_el.get("datetime") or time_el.get_text(strip=True)

    # Content: main text body
    content_el = container.find(
        class_=lambda c: c and any(
            kw in str(c).lower()
            for kw in ["content", "body", "text", "message"]
        )
    )
    if content_el:
        post["content"] = content_el.get_text(separator="\n", strip=True)
    else:
        # Get all paragraph text
        paragraphs = container.find_all("p")
        if paragraphs:
            post["content"] = "\n".join(p.get_text(strip=True) for p in paragraphs)

    if not post.get("content"):
        return None

    post.setdefault("author", "IMDb User")
    post.setdefault("timestamp", None)

    return post


def extract_posts_fallback(soup: BeautifulSoup) -> list[dict]:
    """Fallback: extract text blocks that look like forum posts."""
    posts = []
    # Look for any text blocks with sufficient content
    for p in soup.find_all(["p", "div"]):
        text = p.get_text(strip=True)
        if len(text) > 50 and not any(
            skip in text.lower()
            for skip in ["copyright", "filmboards.com", "sign in", "register"]
        ):
            posts.append({
                "author": "IMDb User",
                "content": text,
                "timestamp": None,
            })
    return posts


def find_next_page(soup: BeautifulSoup, current_url: str) -> str | None:
    """Find the 'next page' link for paginated threads or board listings."""
    for link in soup.find_all("a", href=True):
        text = link.get_text(strip=True).lower()
        if text in ("next", "next page", "»", "›", ">"):
            return urljoin(current_url, link["href"])
        # Also check for aria-label or title
        if link.get("aria-label", "").lower() == "next":
            return urljoin(current_url, link["href"])
    return None

# ── Board Discovery ───────────────────────────────────────────────────────────

async def discover_boards(session: aiohttp.ClientSession) -> list[str]:
    """Discover all movie/TV board URLs from FilmBoards."""
    log.info("Discovering boards from FilmBoards.com...")
    boards = set()

    # Start from the main Film and Television board listing
    seed_urls = [
        f"{BASE_URL}/",
        f"{BASE_URL}/board/147/",   # Film and Television Discussion
        f"{BASE_URL}/board/144/",   # General Discussion
    ]

    for seed_url in seed_urls:
        html = await fetch(session, seed_url)
        if not html:
            continue

        soup = BeautifulSoup(html, "lxml")

        # Find all links to individual movie/show boards
        for link in soup.find_all("a", href=True):
            href = link["href"]
            full_url = urljoin(seed_url, href)
            # Board URLs: /board/NNNN/ or /t/Movie-Name/
            if re.match(r"https?://.*filmboards\.com/(board/\d+|t/[^/]+)", full_url):
                boards.add(full_url.rstrip("/") + "/")

    # Also try to crawl sitemap or board index pages
    # Walk pagination if the board listing has multiple pages
    page_url = f"{BASE_URL}/board/147/"
    max_pages = 500  # safety limit
    for page_num in range(max_pages):
        html = await fetch(session, page_url)
        if not html:
            break

        soup = BeautifulSoup(html, "lxml")
        for link in soup.find_all("a", href=True):
            href = link["href"]
            full_url = urljoin(page_url, href)
            if re.match(r"https?://.*filmboards\.com/(board/\d+|t/[^/]+)", full_url):
                boards.add(full_url.rstrip("/") + "/")

        next_page = find_next_page(soup, page_url)
        if not next_page or next_page == page_url:
            break
        page_url = next_page
        log.info(f"Board discovery page {page_num+1}: {len(boards)} boards found so far")

    board_list = sorted(boards)
    log.info(f"Discovered {len(board_list)} unique boards")
    return board_list

# ── Board Crawling ────────────────────────────────────────────────────────────

async def crawl_board(session: aiohttp.ClientSession, board_url: str) -> dict | None:
    """Crawl a single board: get all threads and their posts."""
    html = await fetch(session, board_url)
    if not html:
        return None

    soup = BeautifulSoup(html, "lxml")
    board_title = extract_board_title(soup)
    imdb_id = extract_imdb_id(board_url, soup)

    board_data = {
        "board_url": board_url,
        "board_title": board_title,
        "imdb_id": imdb_id,
        "crawled_at": datetime.now(timezone.utc).isoformat(),
        "threads": [],
    }

    # Get thread list (may span multiple pages)
    all_thread_urls = []
    page_url = board_url
    max_thread_pages = 100
    for _ in range(max_thread_pages):
        page_html = await fetch(session, page_url)
        if not page_html:
            break
        page_soup = BeautifulSoup(page_html, "lxml")
        threads = parse_thread_list(page_soup, page_url)
        all_thread_urls.extend(threads)

        next_page = find_next_page(page_soup, page_url)
        if not next_page or next_page == page_url:
            break
        page_url = next_page

    # Deduplicate threads
    seen_urls = set()
    unique_threads = []
    for t in all_thread_urls:
        if t["url"] not in seen_urls:
            seen_urls.add(t["url"])
            unique_threads.append(t)

    # Crawl each thread
    for thread_info in unique_threads:
        thread_data = await crawl_thread(session, thread_info)
        if thread_data and thread_data.get("posts"):
            board_data["threads"].append(thread_data)

    return board_data


async def crawl_thread(session: aiohttp.ClientSession, thread_info: dict) -> dict | None:
    """Crawl a single thread: get all posts across all pages."""
    thread_url = thread_info["url"]
    all_posts = []

    page_url = thread_url
    max_post_pages = 50
    for _ in range(max_post_pages):
        html = await fetch(session, page_url)
        if not html:
            break

        soup = BeautifulSoup(html, "lxml")
        posts = parse_posts(soup)
        all_posts.extend(posts)

        next_page = find_next_page(soup, page_url)
        if not next_page or next_page == page_url:
            break
        page_url = next_page

    if not all_posts:
        return None

    return {
        "thread_url": thread_url,
        "thread_title": thread_info.get("title", ""),
        "post_count": len(all_posts),
        "posts": all_posts,
    }

# ── Main Crawl Loop ──────────────────────────────────────────────────────────

async def run_crawl(test_mode: bool = False, resume: bool = False):
    """Main crawl orchestrator."""
    CRAWL_DIR.mkdir(parents=True, exist_ok=True)
    BOARDS_DIR.mkdir(parents=True, exist_ok=True)

    state = CrawlState()

    if resume and state.load():
        log.info("Resuming previous crawl...")
    else:
        state.stats["started_at"] = datetime.now(timezone.utc).isoformat()

    connector = aiohttp.TCPConnector(limit=CONCURRENT_REQUESTS, ttl_dns_cache=300)
    async with aiohttp.ClientSession(connector=connector) as session:
        # Phase 1: Discover boards (or use cached list)
        if not state.discovered_boards:
            state.discovered_boards = await discover_boards(session)
            state.stats["boards_discovered"] = len(state.discovered_boards)
            state.save()

        if test_mode:
            state.discovered_boards = state.discovered_boards[:5]
            log.info(f"TEST MODE: crawling only {len(state.discovered_boards)} boards")

        total = len(state.discovered_boards)
        log.info(f"Starting crawl of {total} boards...")

        # Phase 2: Crawl each board
        for idx in range(state.current_board_idx, total):
            board_url = state.discovered_boards[idx]

            if board_url in state.completed_boards:
                continue

            log.info(
                f"[{idx+1}/{total}] Crawling: {board_url}"
            )

            try:
                board_data = await crawl_board(session, board_url)

                if board_data and board_data.get("threads"):
                    # Save to disk
                    safe_name = re.sub(r"[^\w\-]", "_", board_url.split("/")[-2] or str(idx))
                    if board_data.get("imdb_id"):
                        filename = f"{board_data['imdb_id']}_{safe_name}.json"
                    else:
                        filename = f"board_{safe_name}.json"

                    filepath = BOARDS_DIR / filename
                    with open(filepath, "w", encoding="utf-8") as f:
                        json.dump(board_data, f, ensure_ascii=False, indent=2)

                    thread_count = len(board_data["threads"])
                    post_count = sum(
                        len(t.get("posts", []))
                        for t in board_data["threads"]
                    )
                    state.stats["threads_crawled"] += thread_count
                    state.stats["posts_extracted"] += post_count

                    log.info(
                        f"  ✓ {board_data['board_title']}: "
                        f"{thread_count} threads, {post_count} posts"
                        f"{' (IMDb: ' + board_data['imdb_id'] + ')' if board_data.get('imdb_id') else ''}"
                    )
                else:
                    log.info(f"  – Empty board, skipping")

            except Exception as e:
                log.error(f"  ✗ Error crawling {board_url}: {e}")
                state.stats["errors"] += 1
                with open(ERROR_LOG, "a") as f:
                    f.write(
                        f"{datetime.now(timezone.utc).isoformat()} "
                        f"CRAWL_ERROR {board_url} {str(e)}\n"
                    )

            state.completed_boards.add(board_url)
            state.stats["boards_completed"] = len(state.completed_boards)
            state.current_board_idx = idx + 1

            # Save checkpoint every 10 boards
            if (idx + 1) % 10 == 0:
                state.save()
                log.info(
                    f"  📊 Progress: {state.stats['boards_completed']}/{total} boards, "
                    f"{state.stats['threads_crawled']} threads, "
                    f"{state.stats['posts_extracted']} posts"
                )

        # Final save
        state.save()
        log.info("=" * 60)
        log.info("CRAWL COMPLETE")
        log.info(f"  Boards: {state.stats['boards_completed']}")
        log.info(f"  Threads: {state.stats['threads_crawled']}")
        log.info(f"  Posts: {state.stats['posts_extracted']}")
        log.info(f"  Errors: {state.stats['errors']}")
        log.info(f"  Data: {BOARDS_DIR}")
        log.info("=" * 60)

# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_mode = "--test" in sys.argv
    resume_mode = "--resume" in sys.argv

    log.info("FilmBoards Crawler for Film Glance")
    log.info(f"Mode: {'TEST' if test_mode else 'RESUME' if resume_mode else 'FULL'}")
    log.info(f"Output: {CRAWL_DIR.absolute()}")
    log.info(f"Rate: {REQUESTS_PER_SECOND} req/sec")

    try:
        asyncio.run(run_crawl(test_mode=test_mode, resume=resume_mode))
    except KeyboardInterrupt:
        log.info("\nCrawl interrupted. Use --resume to continue.")
