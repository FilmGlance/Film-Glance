# Forum Management Guide

Last updated: May 6, 2026 (forum end-to-end review session)

This is the runbook for the NodeBB forum at `https://filmglance.com/discuss`. It captures architecture, day-to-day operations, post-import action items, and the canonical access patterns. Read this before touching any forum config.

---

## 1. Canonical access pattern

**Always use** `https://filmglance.com/discuss/admin` for ACP work. Never use `discuss.filmglance.com` for admin operations.

Why: NodeBB's configured `url` is `https://filmglance.com/discuss`. Login cookies and CSRF tokens are scoped to that origin. Loading the ACP at `discuss.filmglance.com` puts you on a different origin → POST submissions for "Save"-type actions silently fail (this was the apparent "ACP is broken" symptom from April).

Bookmark these:
- ACP home: `https://filmglance.com/discuss/admin`
- Manage Categories: `https://filmglance.com/discuss/admin/manage/categories`
- Manage Users: `https://filmglance.com/discuss/admin/manage/users`
- Privileges: `https://filmglance.com/discuss/admin/manage/privileges`
- Settings → Email: `https://filmglance.com/discuss/admin/settings/email`

---

## 2. Architecture (short form)

```
filmglance.com/discuss/*  ──[Vercel rewrite]──>  discuss.filmglance.com/discuss/*
                                                          │
                                                  Cloudflare DNS-only (TODO: enable proxy)
                                                          │
                                                  Hostinger VPS 147.93.113.39:443
                                                          │ Nginx + Let's Encrypt
                                                          │ + sub_filter CSS/JS injection
                                                          ▼
                                                  127.0.0.1:4567  NodeBB v3.12.7
                                                          │
                                                          ▼
                                                  PostgreSQL 16 (db=nodebb, ~6.2 GB)
```

- **VPS**: Hostinger KVM 4 (4 vCPU / 16 GB RAM / 200 GB NVMe)
- **Theme**: `nodebb-theme-harmony` (NodeBB's flagship modern theme)
- **Branding**: NOT a custom theme — three injected assets at `/var/www/html/`:
  - `filmglance-theme.css` (Bootstrap variable overrides + Syne/Playfair + gold accents)
  - `filmglance-auth.css`
  - `filmglance-brand.js` ← **synced from this repo** via `scripts/deploy-forum-assets.ps1`
- **API token** for fgadmin (uid 1): `991abaa4-…` stored in `/root/filmboards-crawl/.env` (chmod 600). Used only by the import script.

---

## 3. Standing rules

- **Never** access ACP via `discuss.filmglance.com` — see §1.
- **Never** edit `filmglance-brand.js` directly on the VPS. Edit in this repo, commit, then run `.\scripts\deploy-forum-assets.ps1` from a PowerShell terminal in the repo root. The repo is the source of truth.
- **Brand CSS files** (`filmglance-theme.css`, `filmglance-auth.css`) live ONLY on the VPS today. Editing them is a manual `nano` over SSH until they get pulled into the repo (TODO).
- **Database backups** run nightly at 03:00 UTC via `/root/backups/run-backup.sh` → `/root/backups/postgres/{daily,weekly}/`. Logs at `/var/log/nodebb-backup.log`.

---

## 4. Day-to-day operations

| Task | Where |
|---|---|
| Lock / delete a thread | Topic page → top-right menu |
| Ban a user | ACP → Manage → Users → row menu → "Ban" |
| Add or rename a category | ACP → Manage → Categories |
| Set per-category icon / image | ACP → Manage → Categories → row → edit icon (now functional after the May 6 Nginx upload-limit fix) |
| Change registration policy (require email, manual approval) | ACP → Settings → User → Registration |
| Enable / disable plugins | ACP → Extend → Plugins |
| Configure SMTP | ACP → Settings → Email — see §5 below |
| View server logs | ACP → Advanced → Logs OR SSH `tail -f /root/nodebb/logs/output.log` |

### Promoting a moderator

| Scope | Path |
|---|---|
| Per-category mod | ACP → Manage → Categories → click category → "Moderators" tab → Add |
| Global Moderator | ACP → Manage → Users → search → row toggle "Mod" |
| Administrator (rare) | ACP → Manage → Users → search → row "Make Admin" |

---

## 5. Post-import action list (queued, May 6, 2026)

These items can't be applied while the forum import is running because they require restarting NodeBB or the user's own credentials. Run **after the import completes** (~ May 7 evening UTC). Order matters — top to bottom.

### 5.1 Bind NodeBB to localhost only

Currently NodeBB listens on `0.0.0.0:4567` — port 4567 is publicly reachable, bypassing Nginx and SSL. Lock it down:

```bash
ssh filmglance@147.93.113.39
sudo nano /root/nodebb/config.json
```

Find the JSON object's top-level keys and add `"bind_address": "127.0.0.1"` (or change the existing port to `"127.0.0.1:4567"`). Save, then:

```bash
cd /root/nodebb
sudo ./nodebb stop
sudo ./nodebb start
```

Verify with `ss -tlnp | grep 4567` — should now show `127.0.0.1:4567`, not `0.0.0.0:4567`.

### 5.2 Configure SMTP via Zoho

In the ACP at https://filmglance.com/discuss/admin/settings/email — fill in:

| Field | Value |
|---|---|
| Email Address | `noreply@filmglance.com` (or `rod@filmglance.com`) |
| From Name | `Film Glance` |
| Custom SMTP Host | `smtp.zoho.com` |
| Port | `465` |
| Use SSL/TLS | enabled |
| Username | (your Zoho email) |
| Password | (Zoho app-specific password — generate in Zoho → Profile → App Passwords; do NOT use your account password) |

Click **Save Settings**, then click **Send Test Email**. If it lands, you're done.

### 5.3 Enable Cloudflare proxy on `discuss.filmglance.com`

In Cloudflare dashboard → Film Glance zone → DNS:
1. Find the `A` record for `discuss` (currently DNS-only / grey cloud)
2. Toggle to **Proxied** (orange cloud)
3. Wait ~30 seconds for propagation

Then SSL/TLS → Overview → set encryption mode to **Full (strict)** (not Flexible — Flexible breaks Let's Encrypt).

Verify by visiting `https://discuss.filmglance.com` and confirming the page loads with Cloudflare in the response headers (`server: cloudflare`).

### 5.4 (Optional) Cloudflare Transform Rule for canonical URL

After 5.3, add a Rules → Transform Rules → URL Rewrite rule:
- Match: `(http.host eq "discuss.filmglance.com")` AND `(http.request.headers["x-vercel-id"] eq "")` (i.e., not coming from the Vercel rewrite)
- Action: 301 redirect to `https://filmglance.com/discuss${http.request.uri.path}${query_string}`

This makes `discuss.filmglance.com` permanently bounce browsers to the canonical URL while letting the Vercel rewrite continue working server-side.

### 5.5 Install useful plugins

Once you can safely restart NodeBB:

```bash
ssh filmglance@147.93.113.39
cd /root/nodebb
sudo ./nodebb stop
sudo npm install nodebb-plugin-write-api
sudo npm install nodebb-plugin-iframely     # rich link previews
sudo ./nodebb build
sudo ./nodebb start
```

Then activate them in ACP → Extend → Plugins → search → click activate.

### 5.6 Upload category icons

Now that the Nginx 1 MB upload bug is fixed, ACP icon uploads work. ACP → Manage → Categories → click each category → upload icon. Recommended source: simpleicons.org or Lucide (PNG export at 96x96 or 128x128).

---

## 6. Backup recovery

Backups are at `/root/backups/postgres/`:
- `daily/` — last 7 nights, gzipped pg_dump output + .md5
- `weekly/` — last 4 Sundays

To restore:

```bash
# DESTRUCTIVE — wipes current nodebb DB
ssh filmglance@147.93.113.39
sudo ./nodebb stop  # in /root/nodebb
sudo -u postgres dropdb nodebb
sudo -u postgres createdb nodebb -O nodebb
gunzip -c /root/backups/postgres/daily/nodebb_<TIMESTAMP>.sql.gz | sudo -u postgres psql nodebb
sudo ./nodebb start
```

**TODO**: offsite copy. Right now backups live on the same disk as the database — survives accidental data loss but not VPS-level failure. Two options to set up post-import:
1. **Hostinger Object Storage** (S3-compatible, separate subscription) — install `rclone`, configure bucket, add weekly upload step to `/root/backups/run-backup.sh`.
2. **Hostinger snapshot feature** (if your KVM 4 plan includes it) — schedule via hPanel.

---

## 7. SSH break-glass (rare)

Anything not listed in §4 should be doable via the web. SSH is for:

- Restart NodeBB: `cd /root/nodebb && sudo ./nodebb stop && sudo ./nodebb start`
- View live process log: `tail -f /root/nodebb/logs/output.log`
- Trigger backup manually: `sudo /root/backups/run-backup.sh`
- Restore from backup: §6
- Edit Nginx config: `sudo nano /etc/nginx/sites-available/filmglance-forum && sudo nginx -t && sudo systemctl reload nginx`
- Edit brand CSS files (until they're moved into the repo): `sudo nano /var/www/html/filmglance-theme.css`

---

## 8. Hygiene reminders

- **Token rotation**: rotate the master API token quarterly. ACP → Settings → API → Regenerate on the fgadmin row → copy → update `/root/filmboards-crawl/.env` → restart import (only if currently running) via `./run_import.sh`.
- **NodeBB updates**: `cd /root/nodebb && sudo git fetch && sudo git checkout <new-tag> && sudo ./nodebb upgrade`. Always backup first via §6.
- **SSL renewal**: certbot auto-renews. Verify with `sudo certbot renew --dry-run` once a quarter.
- **Disk usage**: monitor `df -h /` monthly. The DB is 6.2 GB and growing; with the 200 GB disk we have years of runway, but periodic `pg_dump --schema-only` audits never hurt.
