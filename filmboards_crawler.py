#!/usr/bin/env python3
"""
FilmBoards.com Crawler for Film Glance (Playwright version)
=============================================================
Uses a real headless browser to bypass anti-bot challenges.

Usage:
    python3 filmboards_crawler.py --test      # Test: crawl 5 boards
    python3 filmboards_crawler.py             # Full crawl
    python3 filmboards_crawler.py --resume    # Resume from checkpoint
"""

import asyncio
import json
import os
import sys
import re
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

# ── Configuration ─────────────────────────────────────────────────────────────

BASE_URL = "https://www.filmboards.com"
CRAWL_DIR = Path("./crawl_data")
BOARDS_DIR = CRAWL_DIR / "boards"
CHECKPOINT_FILE = CRAWL_DIR / "checkpoint.json"
STATS_FILE = CRAWL_DIR / "stats.json"
ERROR_LOG = CRAWL_DIR / "errors.log"

PAGE_DELAY = 1.5          # seconds between page loads (respectful)
PAGE_TIMEOUT = 30000      # 30 seconds max per page load
MAX_RETRIES = 3

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("filmboards")

# ── State Management ──────────────────────────────────────────────────────────

class CrawlState:
    def __init__(self):
        self.discovered_boards = []
        self.completed_boards = set()
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
        if CHECKPOINT_FILE.exists():
            with open(CHECKPOINT_FILE) as f:
                data = json.load(f)
            self.discovered_boards = data.get("discovered_boards", [])
            self.completed_boards = set(data.get("completed_boards", []))
            self.current_board_idx = data.get("current_board_idx", 0)
            log.info(f"Resumed: {len(self.completed_boards)}/{len(self.discovered_boards)} boards completed")
            return True
        return False

# ── Browser Page Fetching ─────────────────────────────────────────────────────

async def fetch_page(page, url, retries=MAX_RETRIES):
    """Navigate to URL with retries, return HTML or None."""
    for attempt in range(retries):
        try:
            await asyncio.sleep(PAGE_DELAY)
            resp = await page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT)
            if resp and resp.status == 200:
                return await page.content()
            elif resp and resp.status == 404:
                return None
            else:
                log.warning(f"HTTP {resp.status if resp else '?'} for {url}")
        except Exception as e:
            log.warning(f"Attempt {attempt+1}/{retries} failed for {url}: {e}")
            if attempt < retries - 1:
                await asyncio.sleep(3 * (attempt + 1))

    log.error(f"Failed after {retries} attempts: {url}")
    with open(ERROR_LOG, "a") as f:
        f.write(f"{datetime.now(timezone.utc).isoformat()} FETCH_FAIL {url}\n")
    return None

# ── Parsing ───────────────────────────────────────────────────────────────────

def extract_imdb_id(soup):
    """Extract IMDb title ID (tt1234567) from page."""
    for link in soup.find_all("a", href=True):
        match = re.search(r"(tt\d{7,})", link["href"])
        if match:
            return match.group(1)
    text = soup.get_text()
    match = re.search(r"(tt\d{7,})", text)
    if match:
        return match.group(1)
    return None


def extract_board_title(soup):
    """Extract movie/board title from page."""
    h1 = soup.find("h1")
    if h1:
        return h1.get_text(strip=True)
    title = soup.find("title")
    if title:
        t = title.get_text(strip=True)
        return re.sub(r"\s*[-–]\s*filmboards\.com.*$", "", t, flags=re.IGNORECASE)
    return "Unknown"


def find_board_links(soup, base_url):
    """Find links to individual movie/show boards."""
    boards = set()
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if not href.startswith("http"):
            href = BASE_URL + href if href.startswith("/") else BASE_URL + "/" + href

        # Match board and thread URL patterns
        if re.match(r"https?://.*filmboards\.com/(board/\d+|t/[^/]+)", href):
            clean = href.split("?")[0].split("#")[0].rstrip("/") + "/"
            boards.add(clean)
    return boards


def find_thread_links(soup):
    """Find links to individual threads on a board page."""
    threads = []
    seen = set()
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if not href.startswith("http"):
            href = BASE_URL + href if href.startswith("/") else BASE_URL + "/" + href

        # Thread URLs contain /board/p/ or specific thread patterns
        if ("/board/p/" in href or "/t/" in href) and href not in seen:
            title = link.get_text(strip=True)
            if title and len(title) > 1 and len(title) < 300:
                seen.add(href)
                threads.append({"url": href, "title": title})
    return threads


def parse_posts_from_html(soup):
    """Extract posts from a thread page."""
    posts = []

    # Strategy 1: Look for elements with post/message/reply classes
    containers = soup.find_all(
        ["div", "article", "tr", "li"],
        class_=lambda c: c and any(
            kw in str(c).lower()
            for kw in ["post", "message", "reply", "comment", "entry"]
        ),
    )

    for container in containers:
        post = _extract_post(container)
        if post:
            posts.append(post)

    # Strategy 2: If no structured posts found, look for table rows
    if not posts:
        for row in soup.find_all("tr"):
            tds = row.find_all("td")
            if len(tds) >= 2:
                author_text = tds[0].get_text(strip=True)
                content_text = tds[-1].get_text(strip=True)
                if content_text and len(content_text) > 20:
                    posts.append({
                        "author": author_text[:50] if author_text else "IMDb User",
                        "content": content_text,
                        "timestamp": None,
                    })

    # Strategy 3: Just grab meaningful text blocks
    if not posts:
        for div in soup.find_all("div"):
            text = div.get_text(strip=True)
            if (len(text) > 80
                and not any(skip in text.lower() for skip in [
                    "copyright", "filmboards.com", "sign in", "register",
                    "install the", "chrome", "firefox", "extension"
                ])
                and div.find_parent(class_=lambda c: c and "nav" in str(c).lower()) is None
            ):
                posts.append({
                    "author": "IMDb User",
                    "content": text[:5000],
                    "timestamp": None,
                })

    return posts


def _extract_post(container):
    """Extract a single post from a container element."""
    # Author
    author = "IMDb User"
    author_el = container.find(
        class_=lambda c: c and any(
            kw in str(c).lower()
            for kw in ["author", "user", "poster", "name", "member", "username"]
        )
    )
    if author_el:
        author = author_el.get_text(strip=True)[:50]
    else:
        bold = container.find("b") or container.find("strong")
        if bold:
            text = bold.get_text(strip=True)
            if 0 < len(text) < 40:
                author = text

    # Timestamp
    timestamp = None
    time_el = container.find("time")
    if time_el:
        timestamp = time_el.get("datetime") or time_el.get_text(strip=True)
    else:
        date_el = container.find(
            class_=lambda c: c and any(
                kw in str(c).lower()
                for kw in ["date", "time", "posted", "timestamp", "ago"]
            )
        )
        if date_el:
            timestamp = date_el.get_text(strip=True)

    # Content
    content = None
    content_el = container.find(
        class_=lambda c: c and any(
            kw in str(c).lower()
            for kw in ["content", "body", "text", "message"]
        )
    )
    if content_el:
        content = content_el.get_text(separator="\n", strip=True)
    else:
        paras = container.find_all("p")
        if paras:
            content = "\n".join(p.get_text(strip=True) for p in paras if p.get_text(strip=True))

    if not content or len(content.strip()) < 5:
        return None

    return {
        "author": author,
        "content": content[:5000],
        "timestamp": timestamp,
    }


def find_next_page_link(soup):
    """Find next page link for pagination."""
    for link in soup.find_all("a", href=True):
        text = link.get_text(strip=True).lower()
        aria = link.get("aria-label", "").lower()
        title_attr = link.get("title", "").lower()
        if text in ("next", "next page", "»", "›", ">", "next »", "older") or \
           "next" in aria or "next" in title_attr:
            href = link["href"]
            if not href.startswith("http"):
                href = BASE_URL + href if href.startswith("/") else BASE_URL + "/" + href
            return href
    return None

# ── Board Discovery ───────────────────────────────────────────────────────────

async def discover_boards(page):
    """Find all board URLs from FilmBoards."""
    log.info("Discovering boards...")
    boards = set()

    # Start from main pages
    seeds = [
        f"{BASE_URL}/",
        f"{BASE_URL}/board/147/",
        f"{BASE_URL}/board/144/",
    ]

    for seed in seeds:
        html = await fetch_page(page, seed)
        if not html:
            continue
        soup = BeautifulSoup(html, "lxml")
        found = find_board_links(soup, seed)
        boards.update(found)
        log.info(f"  {seed} → {len(found)} links found")

    # Walk pagination on the main film board
    page_url = f"{BASE_URL}/board/147/"
    for page_num in range(500):
        html = await fetch_page(page, page_url)
        if not html:
            break
        soup = BeautifulSoup(html, "lxml")
        found = find_board_links(soup, page_url)
        boards.update(found)

        next_url = find_next_page_link(soup)
        if not next_url or next_url == page_url:
            break
        page_url = next_url

        if (page_num + 1) % 10 == 0:
            log.info(f"  Discovery page {page_num+1}: {len(boards)} boards total")

    result = sorted(boards)
    log.info(f"Discovered {len(result)} unique boards")
    return result

# ── Thread & Post Crawling ────────────────────────────────────────────────────

async def crawl_board(page, board_url):
    """Crawl all threads and posts from one board."""
    html = await fetch_page(page, board_url)
    if not html:
        return None

    soup = BeautifulSoup(html, "lxml")
    board_title = extract_board_title(soup)
    imdb_id = extract_imdb_id(soup)

    board_data = {
        "board_url": board_url,
        "board_title": board_title,
        "imdb_id": imdb_id,
        "crawled_at": datetime.now(timezone.utc).isoformat(),
        "threads": [],
    }

    # Collect thread links across all pages of this board
    all_threads = []
    current_url = board_url
    for _ in range(100):
        page_html = await fetch_page(page, current_url)
        if not page_html:
            break
        page_soup = BeautifulSoup(page_html, "lxml")
        threads = find_thread_links(page_soup)
        all_threads.extend(threads)

        next_url = find_next_page_link(page_soup)
        if not next_url or next_url == current_url:
            break
        current_url = next_url

    # Deduplicate
    seen = set()
    unique_threads = []
    for t in all_threads:
        if t["url"] not in seen:
            seen.add(t["url"])
            unique_threads.append(t)

    # Crawl each thread
    for thread in unique_threads:
        thread_data = await crawl_thread(page, thread)
        if thread_data and thread_data.get("posts"):
            board_data["threads"].append(thread_data)

    return board_data


async def crawl_thread(page, thread_info):
    """Crawl all posts from one thread (all pages)."""
    all_posts = []
    current_url = thread_info["url"]

    for _ in range(50):
        html = await fetch_page(page, current_url)
        if not html:
            break
        soup = BeautifulSoup(html, "lxml")
        posts = parse_posts_from_html(soup)
        all_posts.extend(posts)

        next_url = find_next_page_link(soup)
        if not next_url or next_url == current_url:
            break
        current_url = next_url

    if not all_posts:
        return None

    return {
        "thread_url": thread_info["url"],
        "thread_title": thread_info.get("title", ""),
        "post_count": len(all_posts),
        "posts": all_posts,
    }

# ── Main Crawl ────────────────────────────────────────────────────────────────

async def run_crawl(test_mode=False, resume=False):
    CRAWL_DIR.mkdir(parents=True, exist_ok=True)
    BOARDS_DIR.mkdir(parents=True, exist_ok=True)

    state = CrawlState()
    if resume and state.load():
        log.info("Resuming previous crawl...")
    else:
        state.stats["started_at"] = datetime.now(timezone.utc).isoformat()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 720},
        )
        page = await context.new_page()

        # Phase 1: Discover boards
        if not state.discovered_boards:
            state.discovered_boards = await discover_boards(page)
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

            log.info(f"[{idx+1}/{total}] Crawling: {board_url}")

            try:
                board_data = await crawl_board(page, board_url)

                if board_data and board_data.get("threads"):
                    safe_name = re.sub(r"[^\w\-]", "_", board_url.split("/")[-2] or str(idx))
                    if board_data.get("imdb_id"):
                        filename = f"{board_data['imdb_id']}_{safe_name}.json"
                    else:
                        filename = f"board_{safe_name}.json"

                    with open(BOARDS_DIR / filename, "w", encoding="utf-8") as f:
                        json.dump(board_data, f, ensure_ascii=False, indent=2)

                    tc = len(board_data["threads"])
                    pc = sum(len(t.get("posts", [])) for t in board_data["threads"])
                    state.stats["threads_crawled"] += tc
                    state.stats["posts_extracted"] += pc

                    log.info(
                        f"  ✓ {board_data['board_title']}: {tc} threads, {pc} posts"
                        f"{' (IMDb: ' + board_data['imdb_id'] + ')' if board_data.get('imdb_id') else ''}"
                    )
                else:
                    log.info("  – Empty or inaccessible board")

            except Exception as e:
                log.error(f"  ✗ Error: {e}")
                state.stats["errors"] += 1
                with open(ERROR_LOG, "a") as f:
                    f.write(f"{datetime.now(timezone.utc).isoformat()} ERROR {board_url} {e}\n")

            state.completed_boards.add(board_url)
            state.stats["boards_completed"] = len(state.completed_boards)
            state.current_board_idx = idx + 1

            if (idx + 1) % 10 == 0:
                state.save()
                log.info(
                    f"  📊 {state.stats['boards_completed']}/{total} boards, "
                    f"{state.stats['threads_crawled']} threads, "
                    f"{state.stats['posts_extracted']} posts"
                )

        state.save()
        await browser.close()

        log.info("=" * 60)
        log.info("CRAWL COMPLETE")
        log.info(f"  Boards: {state.stats['boards_completed']}")
        log.info(f"  Threads: {state.stats['threads_crawled']}")
        log.info(f"  Posts: {state.stats['posts_extracted']}")
        log.info(f"  Errors: {state.stats['errors']}")
        log.info(f"  Data: {BOARDS_DIR}")
        log.info("=" * 60)


if __name__ == "__main__":
    test_mode = "--test" in sys.argv
    resume_mode = "--resume" in sys.argv

    log.info("FilmBoards Crawler for Film Glance (Playwright)")
    log.info(f"Mode: {'TEST' if test_mode else 'RESUME' if resume_mode else 'FULL'}")
    log.info(f"Output: {CRAWL_DIR.absolute()}")

    try:
        asyncio.run(run_crawl(test_mode=test_mode, resume=resume_mode))
    except KeyboardInterrupt:
        log.info("\nCrawl interrupted. Use --resume to continue.")
