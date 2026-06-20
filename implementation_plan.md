# Implementation Plan — Resolve 413 Payload Too Large and Media Storage Architecture

This plan covers the emergency fix for `413 Request Entity Too Large` / `FUNCTION_PAYLOAD_TOO_LARGE` sync failures on Vercel, and outlines the permanent media storage architecture.

---

## Media Storage Design (Architectural Guidelines)

### Problem
Large base64 media strings (photos/videos) are currently embedded directly inside local storage records and synced inside the main JSON payload. This causes the payload size to quickly exceed the Vercel serverless function payload limit (4.5MB).

### Correct Architecture
- **Structured Data**: Customer, user, room, opening, and measurement fields go to Supabase tables.
- **Media Files**: Photos, videos, and document files go directly to **Supabase Storage** buckets.
- **Tables**: Store only media metadata and public/signed URLs or storage paths.
- **Rules**:
  - Media files must be uploaded separately from record sync.
  - Mobile camera photos must be compressed client-side before upload.
  - Raw base64 data URLs must never be stored in main database tables.

### Future Storage Buckets
- `customer-address-photos`
- `measurement-photos`
- `measurement-videos`
- `stock-images`
- `product-images`
- `work-order-media`

### Future Media Record Schema
```json
{
  "id": "uuid",
  "ownerType": "customer | measurement | stock | workOrder",
  "ownerId": "uuid",
  "mediaType": "image | video",
  "storagePath": "bucket/path/to/file",
  "publicUrl": "https://...",
  "thumbnailUrl": "https://...",
  "createdBy": "userId",
  "createdAt": "timestamp",
  "notes": "string"
}
```

---

## Immediate Emergency Fix

1. **Client-side Stripping**: Strip all base64 data URLs and empty the media arrays from the outgoing payload sent to `/api/sync/customers`.
2. **Local Preservation**: Do NOT remove media from local Zustand/localStorage. Local media must remain visible locally.
3. **Server Merge Preservation**: The server must not overwrite existing remote database media with empty arrays when receiving stripped client payloads.
4. **Auto-sync Loop Prevention**: If a 413 error occurs, throttle auto-sync for 60 seconds.

## Proposed Changes

### Client Sync Engine

#### [MODIFY] [syncService.ts](file:///C:/Users/CEYLİN/Desktop/CEYLİNE/olcu-erp-v1.0.1-whatsapp-rapor/src/lib/syncService.ts)
- Add a file-level variable `last413Time = 0`.
- In `syncNow(isManual: boolean = false)`:
  - If `!isManual` and `last413Time` is less than 60s ago, skip auto-sync.
  - Calculate and log the raw payload size.
  - Calculate and log the rough size breakdown (in KB) for:
    - Customers
    - Rooms
    - Openings
    - Measurements
    - Users
    - Pending deletes
  - Clean the outgoing payload using `stripMediaAndDataUrls(obj)` helper, replacing base64 strings starting with `data:image/`, `data:video/`, or `data:application/` with `""`, and making arrays `addressPhotos`, `photos`, and `videos` empty (`[]`).
  - Calculate and log the sanitized payload size.
  - Post the sanitized payload.
  - If status is `413`:
    - Set `last413Time = Date.now()`.
    - Set sync status to `'error'`.
    - Show user-friendly error message: `"Senkronizasyon paketi çok büyük. Fotoğraf/video verileri ayrı aktarılmalı."`.
    - Abort without clearing pending deletes or marking as synced.

### Server API Route

#### [MODIFY] [route.ts](file:///C:/Users/CEYLİN/Desktop/CEYLİNE/olcu-erp-v1.0.1-whatsapp-rapor/src/app/api/sync/customers/route.ts)
- Update local-remote merging logic for `customers`, `rooms`, `openings`, and `measurements`. If the incoming media array from the client is empty/missing, load the existing media array from the database instead of overwriting with `[]`.
- Ensure final upsert operations use safe fallbacks to preserve existing database media:
  - `addressPhotos: (c.addressPhotos && c.addressPhotos.length > 0) ? c.addressPhotos : (dbCustomer?.addressPhotos || [])`
  - `photos: (r.photos && r.photos.length > 0) ? r.photos : (dbRoom?.photos || [])`
  - `videos: (r.videos && r.videos.length > 0) ? r.videos : (dbRoom?.videos || [])`
  - `photos: (o.photos && o.photos.length > 0) ? o.photos : (dbOpening?.photos || [])`
  - `videos: (o.videos && o.videos.length > 0) ? o.videos : (dbOpening?.videos || [])`
  - `photos: (m.photos && m.photos.length > 0) ? m.photos : (dbMeasurement?.photos || [])`
  - `videos: (m.videos && m.videos.length > 0) ? m.videos : (dbMeasurement?.videos || [])`

### Manual Sync Integration

#### [MODIFY] [Topbar.tsx](file:///C:/Users/CEYLİN/Desktop/CEYLİNE/olcu-erp-v1.0.1-whatsapp-rapor/src/components/Topbar.tsx)
- Pass `true` to `syncNow(true)` in manual sync button callback.

#### [MODIFY] [page.tsx](file:///C:/Users/CEYLİN/Desktop/CEYLİNE/olcu-erp-v1.0.1-whatsapp-rapor/src/app/cariler/page.tsx)
- Pass `true` to `syncNow(true)` in page's manual sync callback.

## Verification Plan

### Automated Tests
- `npx tsc --noEmit` and `npm run build`

### Manual Verification
- Output client console logs verifying payload size difference.
- Verify 413 does not occur, and text records sync successfully.
