#!/usr/bin/env python3
"""Purge all bot-created topics from NodeBB categories (test data cleanup)."""
import requests, time

NODEBB_URL = "http://127.0.0.1:4567"
API_TOKEN = "6cd914fc-6730-4fca-9cf1-66ebb841f093"
HEADERS = {"Authorization": f"Bearer {API_TOKEN}", "Content-Type": "application/json"}
BOT_UID = 2

def get_bot_topics(cid):
    """Fetch all topic IDs created by the bot in a category."""
    tids = []
    page = 1
    while True:
        r = requests.get(f"{NODEBB_URL}/api/category/{cid}?page={page}", headers=HEADERS, timeout=30)
        if r.status_code != 200:
            break
        topics = r.json().get("topics", [])
        if not topics:
            break
        for t in topics:
            if t.get("uid") == BOT_UID:
                tids.append(t["tid"])
        page += 1
        time.sleep(0.1)
    return tids

def delete_topics(tids):
    """Delete topics by ID."""
    for i, tid in enumerate(tids):
        r = requests.delete(
            f"{NODEBB_URL}/api/v3/topics/{tid}",
            json={"_uid": 1}, headers=HEADERS, timeout=30
        )
        if (i + 1) % 50 == 0:
            print(f"  Deleted {i+1}/{len(tids)}")
        time.sleep(0.1)

# Check both categories
for cid, name in [(25, "The IMDb Archives"), (6, "The Cinema")]:
    tids = get_bot_topics(cid)
    print(f"{name} (cid {cid}): {len(tids)} bot topics found")
    if tids:
        delete_topics(tids)
        print(f"  Done — deleted {len(tids)} topics")

print("\nCleanup complete!")
