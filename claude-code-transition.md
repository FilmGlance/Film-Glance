# Film Glance — Claude Code Transition Doc

## What This Document Is

This is the bible entry for the workflow shift from **Claude.ai browser chat → Claude Code in the terminal**. It explains what changes, what stays the same, and the emergency procedures for when things feel wrong.

**Read this alongside `README.md`, `tech-specs.md`, and `conversation-summary.md`.** Those three documents remain the project bible. This doc explains how to use the bible in the new environment.

---

## Why We Moved

The browser-paste workflow was safe-by-slowness: every change forced you to navigate GitHub, click the pencil, paste, commit. That friction protected you, but it also capped development speed and made VPS work painful (Hostinger terminal paste limits).

Claude Code removes that friction by giving Claude direct access to:
- The local repo (reads and edits files in place)
- GitHub (commits and pushes directly via `gh` CLI)
- The VPS (SSH session from inside the terminal)
- Vercel + Supabase (via their CLIs)

The tradeoff: Claude can now *do* things without a human clicking "commit." The safety model shifts from **"friction prevents mistakes"** to **"explicit approval prevents mistakes."** You approve every action at the keystroke level. This works — but requires discipline.

---

## What Changes

| Before (browser) | After (Claude Code) |
|---|---|
| Upload README + tech-specs + conversation-summary + repo zip at session start | Claude Code auto-reads `CLAUDE.md` which tells it to read the bible docs from the repo |
| Claude provides file content; you copy-paste into GitHub web editor | Claude edits the file directly and commits with a message |
| "Here's the file, commit with this message, here's the PR title" | `git commit -m "..."` and `gh pr create` run from inside the terminal |
| VPS changes via Hostinger browser terminal (paste-limited) | VPS changes via SSH session from PowerShell |
| Usage % reported at end of every response | Same rule applies in Claude Code |
| Bible docs updated silently, shared at 10% threshold | Same rule applies — just no "download" step; they're committed to the repo |

## What Stays the Same

- **The bible.** `README.md`, `tech-specs.md`, `conversation-summary.md` remain the source of truth. They now live in the repo root rather than being uploaded per-session.
- **Standing deliverables.** Every session still ends with: updated tech-specs Change Log, updated conversation summary, usage % reported.
- **Staging-first workflow.** All changes still go to `staging` → tested on Vercel preview → PR'd to `main`. Claude Code doesn't change the branching strategy; it just automates the mechanics.
- **Quality bar.** 110% effort, always. The tooling changed — the standards didn't.
- **GitHub as source of truth.** The repo is still authoritative. Local files get synced to GitHub immediately after changes — never sit as uncommitted work overnight.

---

## The New Session Startup Ritual

Every new Claude Code session begins the same way. This replaces "upload the bible + zip":

```
1. Open PowerShell
2. cd ~\film-glance
3. git pull origin staging   (or main, depending on what you're working on)
4. claude                    (launches Claude Code)
```

Claude Code automatically reads `CLAUDE.md` at the repo root. `CLAUDE.md` tells Claude to read `README.md`, `tech-specs.md` (Change Log first), and `conversation-summary.md` before doing anything. This replicates your current onboarding ritual exactly.

**First message to Claude in every new session should be:** *"Read the bible docs and give me current state + next steps."* This is equivalent to what you said in this chat at the start.

---

## Safety Rails — Non-Negotiable

These rules exist because Claude Code is more powerful than browser chat. Every one of them has been costed out in "how much damage if I skip it."

### Rule 1: Approval Mode Stays ON
Claude Code defaults to asking permission for every file edit and every shell command. **Do not disable this.** Do not auto-approve bash commands. When Claude wants to run something, read what it says before typing `y`.

If you don't understand a command Claude wants to run, **ask Claude to explain it first** before approving. You are allowed to say "explain this command" as many times as you need to. There are no dumb questions when production is on the line.

### Rule 2: Never Run a Command on the VPS Without Dry-Running It First
The VPS has:
- NodeBB with 850K+ imported posts and counting
- PostgreSQL holding all forum data
- A running `nohup` import process
- Nginx serving the forum

A wrong `rm -rf`, `systemctl stop`, or `DROP TABLE` could cost days or weeks. Before ANY VPS command, Claude will tell you exactly what it does. **When in doubt, say "walk me through what this does step by step before you run it."**

### Rule 3: `main` Branch Is Sacred
Changes never go directly to `main`. Ever. The workflow is:
1. Checkout `staging`
2. Make changes
3. Commit + push to `staging`
4. Verify on Vercel preview deploy
5. Open PR `staging → main`
6. Merge only after verification

Claude Code should never `git push origin main` directly. If it ever suggests that, the answer is no.

### Rule 4: No `git push --force` Without Explicit User Approval
`--force` can overwrite commits permanently. This is one of the few ways to *truly* lose work. Any time Claude proposes `--force`, stop and ask why. 99% of the time there's a non-destructive alternative.

### Rule 5: The Forum Import Is Mid-Flight — Do Not Touch It
As of the transition, the v5 import is running via `nohup` on the VPS. Any of these will break it:
- Restarting NodeBB while import is running
- Killing Python processes without checking which one
- Modifying `import_filmboards.py` on the VPS
- Clearing `import_state.json`
- Restarting PostgreSQL

**Until the import hits 3,308/3,308 boards, the VPS is read-only except for status checks.** Monitoring commands (`tail`, `cat`, `ps`, `top`) are fine. Write commands are NOT fine.

### Rule 6: Bible Docs Get Committed Every Session
After any substantive change, the updated `tech-specs.md` Change Log entry and `conversation-summary.md` entry get committed to the repo. **Never end a session with uncommitted bible changes.** Next session won't know what happened.

---

## Emergency Procedures — "Oh No" Playbook

### "I think I broke something — how do I undo?"

For local file changes that haven't been committed yet:
```bash
git status               # see what changed
git diff                 # see the actual changes
git checkout -- <file>   # discard changes to a specific file
git restore .            # discard ALL uncommitted changes
```

For commits that were pushed to staging (safe to undo):
```bash
git log --oneline -5     # see last 5 commits
git revert <commit-hash> # creates a NEW commit that undoes the bad one
git push origin staging
```

**Never use `git reset --hard` on a branch that's been pushed. Never use `git push --force` to fix a mistake.** Both of these can destroy work permanently. `git revert` is always safer — it adds a commit that reverses the change, leaving full history.

### "The terminal is hung / Claude Code froze"

- Ctrl+C cancels a running command in the terminal.
- If Claude Code itself is stuck, close the terminal window and reopen it. Your work is saved (files on disk). Conversation history in Claude Code may be lost — this is normal.

### "I ran something I shouldn't have on the VPS"

First: don't panic, don't run more commands trying to fix it.

1. `Ctrl+C` to stop whatever is running.
2. Screenshot the terminal (literally — full scrollback).
3. Paste the screenshot to Claude and describe what you were trying to do.
4. Wait for diagnosis before running anything else.

The worst VPS outcomes come from panicked recovery commands, not from the original mistake.

### "The import stopped"

```bash
# SSH into VPS (from PowerShell)
ssh filmglance@147.93.113.39

# Check if import is still running
ps aux | grep import_filmboards

# Check last log lines
tail -20 /root/filmboards-crawl/import.log

# Check state file
cat /root/filmboards-crawl/import_state.json | python3 -m json.tool | head -30
```

If the import process is gone but not complete, restart it:
```bash
cd /root/filmboards-crawl && nohup python3 import_filmboards.py > import.log 2>&1 &
```

The script has resume capability — it reads `import_state.json` and skips completed boards.

### "Vercel deploy failed"

```bash
vercel logs            # see build output
vercel ls              # list deployments
```

Most build failures are TypeScript errors or env var issues. Fix locally, commit, push — staging branch triggers a new preview deploy automatically.

### "Supabase is misbehaving"

Do NOT run destructive queries on Supabase via CLI without extreme caution. When in doubt, use the Supabase web dashboard's SQL Editor — it requires explicit confirmation for dangerous operations.

---

## Tool-by-Tool Reference

### GitHub (`gh` CLI)

| Task | Command |
|---|---|
| Check which branch you're on | `git branch --show-current` |
| Pull latest | `git pull origin staging` |
| See uncommitted changes | `git status` |
| Stage all changes | `git add .` |
| Commit | `git commit -m "message"` |
| Push | `git push origin staging` |
| Open a PR (staging → main) | `gh pr create --base main --head staging --title "..." --body "..."` |
| Merge a PR | `gh pr merge <number> --squash` (or via web for safety) |
| View repo in browser | `gh repo view --web` |

### VPS (SSH)

| Task | Command |
|---|---|
| Connect | `ssh filmglance@147.93.113.39` |
| Disconnect | `exit` or Ctrl+D |
| Import status | `tail -5 /root/filmboards-crawl/import.log` |
| NodeBB status | `cd /root/nodebb && ./nodebb status` |
| Update theme file | `wget -O /var/www/html/filmglance-theme.css "https://api.github.com/repos/FilmGlance/Film-Glance/contents/filmglance-theme.css?ref=staging" -H "Accept: application/vnd.github.v3.raw"` |
| Nginx reload | `systemctl reload nginx` (after config test: `nginx -t`) |

### Vercel CLI

| Task | Command |
|---|---|
| Link local repo to Vercel project | `vercel link` (once per machine) |
| View recent deploys | `vercel ls` |
| View deploy logs | `vercel logs <deploy-url>` |
| Pull env vars to local `.env.local` | `vercel env pull` |
| Manual deploy (rarely needed) | `vercel --prod` (NEVER use until comfortable) |

### Supabase CLI

| Task | Command |
|---|---|
| Login | `supabase login` (once) |
| Link to project | `supabase link --project-ref <ref>` |
| Run SQL | Use web dashboard or `supabase db execute` (carefully) |
| Pull schema | `supabase db pull` |

**Note:** For any destructive SQL (DELETE, DROP, TRUNCATE, UPDATE without WHERE), use the web dashboard. The extra click provides a sanity check.

---

## Standing Deliverables — Claude Code Version

Every session ends with:

1. **`tech-specs.md` Change Log entry updated** — committed to the repo.
2. **`conversation-summary.md` entry appended** — committed to the repo.
3. **Usage % remaining** — reported in Claude's final message.

When usage drops to ≤10%, Claude shares the three bible docs as file outputs proactively, even if not asked. This matches the browser workflow rule exactly.

---

## The `CLAUDE.md` File

Claude Code reads `CLAUDE.md` at the repo root automatically every session. Think of it as a "system prompt on disk" — it tells Claude how to behave on this specific project without you having to re-explain every session.

The file lives at: `C:\Users\<YourUsername>\film-glance\CLAUDE.md`

See `CLAUDE.md` in the repo for the current contents. Update it any time the workflow changes.

---

## Day 1 Shakedown List

Before using Claude Code for anything real, complete these low-risk exercises to build confidence. Each one has a specific pass condition.

1. **Read-only navigation.** Open Claude Code in the repo. Ask: *"What's in this repo and what's the structure?"* Pass: Claude describes the files correctly without editing anything.
2. **Read a spec section.** Ask: *"Show me Section 3.5 of tech-specs.md."* Pass: Claude reads and quotes it accurately.
3. **Status check, no writes.** Ask: *"What's the current git status?"* Pass: Claude runs `git status` and shows a clean working tree.
4. **Trivial safe edit.** Ask: *"Add a blank line at the end of README.md and commit it to staging."* Pass: Commit appears in GitHub; you understand every step.
5. **VPS read-only.** Ask Claude to SSH into the VPS and show import progress. Pass: You see the same output as `tail -5 /root/filmboards-crawl/import.log`.

Do not skip steps. Do not move to item 5 if item 4 confused you.

---

## When Things Feel Weird

The terminal will feel foreign for the first few days. That's normal. A few things that feel wrong but aren't:

- **Silent success.** `git push` with no output is a successful push. `commit` with one line of output is a successful commit. No news is good news.
- **Claude asking permission for obvious things.** "Is it okay if I read `package.json`?" — yes, this is the safety rail doing its job. As you get comfortable you may grant Claude broader session-level trust, but start restrictive.
- **Error messages that look scary but aren't.** Most terminal errors are recoverable. Copy the full error to Claude and ask — don't start trying fixes blindly.
- **Commands that take a while.** `git clone`, `npm install`, `vercel build` — minutes are normal. Don't Ctrl+C something just because it's slow.

---

*This document is part of the Film Glance project bible. It should be updated whenever the workflow materially changes.*
