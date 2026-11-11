# CTMS-028 — Manage Trip Images

## 1. Overview

Story: CTMS-028

Epic: EPIC 4. Trip Management

Use Case: Manage Trip Images

Priority: Must Have

Goal: Allow the owning Host to manage Trip images while keeping image ownership, storage metadata, ordering/visibility and Trip authorization consistent.

Backlog story: As a Host, I want to manage Trip images so the Trip can present appropriate visual information to users.

Acceptance Criteria:

| Source  | Criterion                                                                                    |
| ------- | -------------------------------------------------------------------------------------------- |
| PB AC-1 | Authorized Host can add images to the Trip.                                                  |
| PB AC-2 | Authorized Host can remove/manage existing Trip images while modification is permitted.      |
| PB AC-3 | Image records must belong to the correct Trip and Host business scope.                       |
| PB AC-4 | Invalid file/reference/storage operations must not produce inconsistent Trip-image metadata. |
| PB AC-5 | Public exposure of Trip images follows Trip/public visibility rules.                         |

## 2. Scope

### In Scope

- Add Trip image.
- Remove Trip image.
- Store Trip-image relationship.
- Validate image metadata/file constraints required by authoritative contract.
- Maintain approved image ordering/primary-image semantics where defined.
- Protect storage/database consistency.

### Out of Scope

- Generic media library.
- Route images unless separately specified.
- Trip creation.
- Public Trip search logic itself.

## 3. Actors & Authorization

- Host.
- System/storage integration.

Only Host authorized to manage the Trip may mutate its images.

## 4. Preconditions & Dependencies

- Trip exists.
- Host is authorized for Trip.
- Trip state permits the requested image-management operation where lifecycle restrictions apply.
- File/storage service is available for upload operations.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                          |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-079 | The owning Host may add, remove, and reorder trip_media while the Trip is not ongoing or completed. sort_order must be explicitly defined.                                    |
| BR-080 | Each trip_media record must reference a valid trip_id, use a verified/uploaded URL, have a valid media type, and have a non-negative sort_order.                              |
| BR-081 | trip_media must not be updated when Trip status IN (ongoing, completed, cancelled) unless an administrative permission or explicitly specified flow allows it.                |

## 6. State & Lifecycle

No image
→ upload succeeds + metadata commits
→ Trip image exists.

Trip image
→ authorized removal
→ Trip image no longer active/associated according to storage policy.

Exact soft-delete vs physical-delete behavior is Technical Design.

## 7. Business Flow

1. Host opens Trip image management.
2. Backend authorizes Host against Trip.
3. Host uploads/removes image.
4. Validate file/reference.
5. Perform storage operation according to safe integration order.
6. Persist corresponding Trip-image metadata.
7. Return authoritative image collection.
8. Public Trip view receives only images permitted by visibility rules.

## 8. Data & Invariants

- Image belongs to correct Trip.
- Unauthorized Host cannot mutate image.
- Storage and metadata cannot knowingly diverge.
- Removed image cannot remain advertised as active Trip image.
- Public visibility follows Trip visibility.
- Storage secrets/internal paths are not exposed unnecessarily.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                            | Expected Behavior                                      |
| ----------------------------------------------- | ------------------------------------------------------ |
| Unauthorized Host                               | Reject.                                                |
| Invalid file                                    | Reject.                                                |
| Trip missing                                    | Not found.                                             |
| Storage upload fails                            | No successful image metadata state.                    |
| Metadata persistence fails after storage upload | Compensate/clean orphan according to Technical Design. |
| Delete storage fails                            | Do not falsely report completed deletion.              |
| Image belongs to another Trip                   | Reject.                                                |

## 11. Acceptance & Test Matrix

| Source          | Scenario                     | Expected Result                    | Test Type              |
| --------------- | ---------------------------- | ---------------------------------- | ---------------------- |
| PB AC-1, BR-079 | Valid image upload           | Image associated with Trip         | Integration            |
| PB AC-2, BR-080 | Owning Host removes image    | Authorized mutation succeeds       | E2E                    |
| PB AC-3, BR-080 | Unrelated Host mutates image | Rejected                           | Security               |
| PB AC-4, BR-081 | Storage fails                | No false authoritative success     | Integration            |
| PB AC-5         | Public Trip image request    | Only permitted image state exposed | Security / Integration |

## 12. Implementation Decisions

- A Trip supports at most five images, including a migrated existing cover. Supported uploads are JPEG, PNG, and WebP, at most 5 MiB each. The backend verifies file signatures and declared media type.
- Hosts can select and preview up to five images directly in the Create Trip form. Submission creates the draft and uploads the selected files sequentially before proceeding to waypoint configuration. No image is uploaded merely by selecting it.
- If an upload fails after draft creation, the form preserves the original submission and saved Trip ID, locks the saved fields, and offers retry from the failed image. Confirmed uploads are not repeated, and retry does not create another Trip. A lost upload response is safe because the backend deduplicates image content.
- The details gallery continues to support adding/removing images. The deprecated `coverImageUrl` create/update input cannot replace the managed thumbnail.
- Upload order is explicit and stable. The first successful upload becomes the thumbnail; later uploads do not replace it. Removing it promotes the earliest remaining image. Removing every image clears the cover.
- The owning Host can mutate images except while the Trip is ongoing, completed, or cancelled. Collection reads use the existing Trip details visibility policy.
- `GET /trips/:tripId/images` returns ordered `{ id, url, sortOrder }` records. `POST` accepts one multipart `file` and returns the authoritative collection. `DELETE /trips/:tripId/images/:imageId` returns `{ images, storageCleanup: "queued" }`.
- Mutations serialize on the Trip row. A unique Trip/content hash prevents duplicate metadata; repeated uploads reuse the existing result without another storage upload, including when the Trip already has five images. Repeated deletion is a no-op. A reference to another Trip's existing image is rejected.
- `trip_images.trip_id` uses `ON DELETE CASCADE`. Deleting an image physically removes its database record. A database trigger updates the cover and durably queues storage deletion in the same transaction, including when the Trip is deleted outside the image API.
- Before upload, a deterministic storage location and independently committed cleanup receipt are reserved. Successful metadata/audit commit removes that receipt atomically. Failed or interrupted uploads retain it for cleanup. The reservation is locked during upload to prevent concurrent cleanup.
- The cleanup worker runs every 30 seconds, processes up to 20 jobs per batch with `SKIP LOCKED`, and retries storage failures after five minutes. Interrupted reservations become eligible after one hour. Storage deletion is idempotent. The API/UI describe storage cleanup as queued rather than completed.
- Existing covers are migrated into the image collection. Cleanup only deletes local files and Cloudinary objects owned by the configured application; third-party external references are removed from the database without attempting to delete their source.
- Storage delivery continues to use the existing application's public upload/CDN URLs. The authenticated collection API enforces Trip visibility, but these URLs are not private delivery links. Private byte delivery requires a separate storage/access-control change.

## 13. Verification

- Backend unit tests cover first/subsequent uploads, duplicate content at the limit, a sixth image, unauthorized/missing/locked Trips, invalid and oversized files, storage errors, metadata errors, deletion, retries, and cleanup failure retention.
- PostgreSQL integration tests cover concurrent uploads and retries, thumbnail promotion, physical cascade deletion, durable cleanup receipts, rollback on audit failure, and isolation between Trips.
- Client tests cover authoritative upload/removal rendering, the five-image boundary, invalid files, storage failures, queued cleanup feedback, and read-only states.

### Task-specific HTTP E2E

`services/api/test/trips.images.e2e-spec.ts` boots the complete Nest application and exercises authenticated HTTP requests with real PostgreSQL and isolated local file storage. It covers upload/list/removal, stable thumbnail selection, concurrent five-image enforcement, duplicate request safety, file cleanup, Trip cascade deletion, invalid uploads, ownership, lifecycle protection, and collection visibility. The cleanup worker is driven explicitly to avoid timer races. Trip deletion itself is exercised through SQL because no Trip deletion HTTP endpoint exists.

Run from the repository root:

```powershell
pnpm --filter @ctms/api test:e2e --runTestsByPath test/trips.images.e2e-spec.ts
```

The suite requires the dedicated PostgreSQL test database configured by `TEST_DATABASE_URL` (default `ctms_test`). It does not require a separately running API or Cloudinary.
