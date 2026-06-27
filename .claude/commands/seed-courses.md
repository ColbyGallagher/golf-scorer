---
description: Seed next batch of golf courses from GolfCourseAPI into Supabase (run daily)
---

Seed the next batch of golf courses into Supabase.

## Steps

1. Read `next-app/scripts/seed-queue.json` and report current progress:
   - region, total names, processed count, pending count, failed count

2. If pending > 0, run from the `next-app/` directory:
   ```
   node scripts/seed-courses.mjs --limit=40
   ```

3. If pending == 0 (queue complete), ask the user which region to seed next, then run:
   ```
   node scripts/seed-courses.mjs --region="REGION NAME" --limit=40
   ```
   Delete or rename `next-app/scripts/seed-queue.json` first so the script rebuilds the queue for the new region.

4. After the run, report:
   - API calls made
   - Courses saved (new)
   - Already existed (skipped)
   - Failed (not found or no 18-hole tees)
   - Courses still pending

5. Query Supabase to get the actual list of courses added in this batch. Use the `scorecards` table and filter by course names from the queue (processed minus failed). Show as a numbered list sorted alphabetically.

   Use the Supabase MCP tool (`execute_sql` on project `sdaaavfbzlyrzcwtrgmo`):
   ```sql
   SELECT course_name FROM scorecards
   WHERE course_name ILIKE ANY(ARRAY['Course 1','Course 2',...])
   ORDER BY course_name;
   ```

6. Remind the user to run `/seed-courses` again tomorrow for the next batch.
