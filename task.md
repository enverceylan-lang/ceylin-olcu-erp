# Tasks — Emergency Sync Payload Fix

- `[x]` Implement client-side base64 media stripping in `src/lib/syncService.ts`
- `[x]` Add payload size diagnostics logging (before and after strip) in `src/lib/syncService.ts`
- `[x]` Prevent focus-sync loops with 413 error throttling in `src/lib/syncService.ts`
- `[x]` Handle 413 response, set sync status to error, and log user-friendly error in `src/lib/syncService.ts`
- `[x]` Implement server-side media preservation in `src/app/api/sync/customers/route.ts` (merging and upserts)
- `[x]` Integrate `syncNow(true)` manual flags in `src/components/Topbar.tsx`
- `[x]` Integrate `syncNow(true)` manual flags in `src/app/cariler/page.tsx`
- `[x]` Validate type check (`npx tsc --noEmit`) and build (`npm run build`)
- `[x]` Run manual verify script to log payload sizes and check if sync succeeds
- `[x]` Document results in `walkthrough.md`
