---
description: End-of-session wrap-up: update memory, prune stale entries, update README if needed, commit and push.
---

Run this at the end of every session. Do each step in order.

## Step 1 — Update memory

Read `C:\Users\Colby\.claude\projects\c--Projects-golf-scorer\memory\MEMORY.md` and all memory files it links to.

For each memory file:
- Update facts that changed this session
- Remove facts that are no longer true or no longer useful
- Add new entries for anything non-obvious learned this session (new scoring rules, data shape discoveries, user preferences, architectural decisions)

Do NOT save:
- Things derivable from reading the code
- Completed todos or ephemeral task state
- Git history (already in commits)

## Step 2 — Prune stale memory

Delete any memory file where:
- All content is now obvious from the codebase
- The project/feature it describes is fully shipped and stable with nothing pending
- It duplicates what's in another memory file

Update `MEMORY.md` index to remove pointers to deleted files.

## Step 3 — Check README

Read `C:\Projects\golf-scorer\README.md` (if it exists).

Update it only if a significant user-facing feature was added or changed this session (new page, new game format, new scoring rule, new data source). Skip cosmetic/internal changes.

If no README exists and meaningful features were built, create a minimal one.

## Step 4 — Commit and push

1. Run `git status` to see all modified files.
2. Stage all legitimate changes (skip .env, secrets, large binaries).
3. Write a commit message summarising this session's changes. Conventional Commits format, subject ≤72 chars, body only if the why is non-obvious.
   Always append:
   ```
   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
   ```
4. Commit, then `git push origin main`.
5. Confirm the push succeeded and report the commit hash.
