# CTMS-1 — Porter Guide Certificate Verification

## 1. Overview

Story: CTMS-1 (tracked under the Register card at the user's request; extends CTMS-001 registration for Porters)

Epic: EPIC 7. Porter Management

Use Case: Verify Porter guide certificate before the Porter can take trips

Priority: Must Have (requested by the product owner on 2026-10-17)

Goal: A newly registered Porter must upload a guide certificate (PDF or image). An Admin reviews the documents and approves or rejects them manually. Only approved Porters can become available or be requested and assigned to Trips.

Acceptance Criteria:

| Source | Criterion |
| --- | --- |
| PO AC-1 | Porter registration ends with a mandatory guide certificate upload step. |
| PO AC-2 | Accepted files are PDF, JPG, PNG or WEBP, at most 5 MB each and at most 5 files. |
| PO AC-3 | The Porter must submit at least one document before review. |
| PO AC-4 | An Admin can list Porter verifications, open the uploaded documents and approve or reject manually. |
| PO AC-5 | Rejection requires a reason that is shown to the Porter, who can fix the documents and resubmit. |
| PO AC-6 | Until approved, the Porter cannot become available, does not appear in available Porter search and cannot be requested or accept a request. |
| PO AC-7 | Every submit, approve and reject is written to the audit log. |
| PO AC-8 | The UI reuses the shared components; missing generic components are created in `shared/components`. |

## 2. Scope

### In Scope

- Document upload, removal and submission by the Porter.
- Admin list, detail, approve and reject.
- Gating of Porter availability, available Porter search, Porter Request creation and acceptance.
- Web: 4th registration step "Chứng chỉ", Porter verification page, Porter page gate, Admin review page.

### Out of Scope

- Expiry dates of certificates and periodic re-verification.
- Revoking an approved Porter (no endpoint; approval is final in this story).
- Deleting files from Cloudinary when a document record is removed.
- Notifications (email / push) on approve or reject.

## 3. Actors & Authorization

- Porter (`porter` role, `active` account): manages own documents and submits.
- Admin (`admin` role): lists, views, approves and rejects.
- Host: no new permission; only sees approved Porters in available Porter search.

## 4. Preconditions & Dependencies

- CTMS-001 / CTMS-002: registration and OTP verification produce an active Porter account.
- CTMS-043: Porter profile and availability.
- CTMS-044 / CTMS-045 / CTMS-046: available Porter search, Porter Request creation and response.
- Existing `UploadsModule` (`UploadsService`) for storage (Cloudinary, local disk fallback).

## 5. Business Rules

- BR-1: Status values are `pending_documents`, `pending_review`, `approved`, `rejected`. A Porter with no verification row is treated as `pending_documents`.
- BR-2: Documents can be uploaded or removed only in `pending_documents` or `rejected`.
- BR-3: A Porter has at most 5 documents; each file is PDF/JPG/PNG/WEBP and at most 5 MB. A PDF must start with the `%PDF-` signature.
- BR-4: Submit requires at least one document and moves the status to `pending_review`; it clears any previous review and rejection reason.
- BR-5: Only `pending_review` can be approved or rejected. Rejection requires a non-blank reason (max 500 characters).
- BR-6: Only `approved` Porters can switch availability to `available`, appear in available Porter search, be requested by a Host, or accept a Porter Request.
- BR-7: Porters that existed before this story are backfilled as `approved` with `reviewed_by = NULL` (system backfill), so current operations keep working.

## 6. State & Lifecycle

```
(no row) / pending_documents --submit--> pending_review --approve--> approved
                                              |
                                              +--reject(reason)--> rejected --edit + submit--> pending_review
```

## 7. Business Flow

1. Porter registers and verifies the OTP (steps 1–3, unchanged). The stepper shows step 4 "Chứng chỉ"; no extra notice is shown (removed at the user's request).
2. Porter logs in. Any Porter page, including the dashboard for a Porter-only account, redirects to `/porter/verification` until the status is `approved`.
3. Porter uploads documents, then submits and confirms.
4. Admin opens "Duyệt hồ sơ Porter", filters "Chờ duyệt", opens a Porter, views the documents and approves (with confirmation) or rejects with a reason.
5. A rejected Porter sees the reason, replaces documents and resubmits.
6. An approved Porter enters the Porter workspace and can switch to available.

## 8. Data & Invariants

- `porter_verifications` (PK `porter_id` → `users.id` ON DELETE CASCADE): `status`, `submitted_at`, `reviewed_by` (→ `users.id`), `reviewed_at`, `rejection_reason` (varchar 500), `version`, timestamps.
  - `CHECK (status IN ('approved','rejected')) = (reviewed_at IS NOT NULL)`.
  - `CHECK (status = 'rejected') = (rejection_reason IS NOT NULL)`.
- `porter_verification_documents` (FK `porter_id` → `porter_verifications` ON DELETE CASCADE): `file_url`, `file_key`, `original_name`, `mime_type`, `size_bytes > 0`, `uploaded_at`.
- Audit actions: `porter_verification.submitted`, `porter_verification.approved`, `porter_verification.rejected` (target type `porter_verification`).

## 9. API / Integration Contract

| Method | Path | Role | Result |
| --- | --- | --- | --- |
| GET | `/api/porter/verification` | Porter | Status and documents (`version = 0` when no row). |
| POST | `/api/porter/verification/documents` | Porter | multipart `file`; 201 document. |
| DELETE | `/api/porter/verification/documents/:documentId` | Porter | 204. |
| POST | `/api/porter/verification/submit` | Porter | 200 status `pending_review`. |
| GET | `/api/admin/porter-verifications?status&search&page&limit` | Admin | Paginated list (all Porters, missing row = `pending_documents`). |
| GET | `/api/admin/porter-verifications/:porterId` | Admin | Detail with contact, profile experience/certifications and documents. |
| PATCH | `/api/admin/porter-verifications/:porterId/approve` | Admin | 200 detail. |
| PATCH | `/api/admin/porter-verifications/:porterId/reject` | Admin | body `{ reason }`; 200 detail. |

## 10. Error & Edge Cases

- No file / wrong type / fake PDF → 400; file over 5 MB → 413 (Multer limit).
- Upload or delete while `pending_review` / `approved` → 409; sixth document → 409.
- Submit without documents → 422; submit while `pending_review` / `approved` → 409.
- Approve / reject when not `pending_review` → 409; blank reason → 422.
- Non-Porter on Porter endpoints / non-Admin on Admin endpoints → 403; anonymous → 401.
- Switching to available while not approved → 403. Requesting or accepting with an unapproved Porter → 409 "Porter is not eligible for this Trip".
- Web: if the status request fails, the gate fails closed and sends the Porter to the verification page, which shows the error and a retry button.

## 11. Acceptance & Test Matrix

| AC | Evidence |
| --- | --- |
| AC-1 | `PORTER_REGISTER_STEPS` in the registration stepper; screenshot 01. |
| AC-2 | `uploads.service.spec.ts`, integration "validates files and enforces the five-document limit", `FileDropzone.test.tsx`. |
| AC-3 | Unit "requires at least one document to submit", integration 422. |
| AC-4 | Integration full flow, `AdminPorterVerificationsPage.test.tsx`; screenshots 07–08, 12–13. |
| AC-5 | Integration "rejects with a mandatory reason…", page tests; screenshots 09–11. |
| AC-6 | `porter-profiles.service.spec.ts`, `trips.available-porters` "Unverified" candidate, `trips.porter-requests` unverified case, `PorterVerificationGate.test.tsx`. |
| AC-7 | Integration audit assertion (submitted → approved). |
| AC-8 | Reused `Button`, `Card`, `Modal`, `ConfirmModal`, `DataTable`, `Pagination`, `LogoutActions`, `RegisterStepper`; new shared `FileDropzone`, `DocumentPreview`, `StatusBadge`. |

## 12. Decisions (agreed with the user on 2026-10-17)

- D-1: The upload happens right after OTP verification and first login instead of inside the public register form, to avoid an anonymous upload endpoint. Users still experience it as registration step 4.
- D-2: PDF and images are accepted; 1–5 files, 5 MB each.
- D-3: Storage reuses the existing `UploadsModule`; the server uploads the file itself, so clients cannot attach arbitrary URLs.
- D-4: This spec is new; no previous spec covered Porter approval.
- D-5 (implementation judgment): status lives in a new `porter_verifications` table, not in `porter_profiles`, because a profile row is only created when the Porter first saves the profile.
- D-6 (implementation judgment): declining a Porter Request is not gated; only availability, search, request creation and acceptance are.
- D-7 (gap fixed in this story, approved by the user on 2026-10-18): the registration form collected full name, experience, operating areas and certificate code, but the web sent only email, phone, password and role, and `RegisterDto` accepted nothing else. The Admin review therefore always showed "—", and the verification gate also keeps unapproved Porters out of the Porter profile page. Registration now stores `fullName` (all roles) and, for Porters, creates the Porter profile from `experienceYears` and `certifications`.
- D-8 (default chosen, the user may revert): the "Khu vực núi hoạt động chính" field was removed from the Porter registration form because no column stores it. Camper and Host extra form fields (blood type, fitness, emergency contact, province, business licence) are still not sent; they are outside this story.

## 13. Implementation Record

- **Migration** `1787250000000-CreatePorterVerifications`: enum `porter_verification_status`, tables `porter_verifications` and `porter_verification_documents`, indexes, and backfill of existing Porters as `approved` (BR-7).
- **UploadsService.uploadDocument**: accepts JPG/PNG/WEBP/PDF, checks the PDF signature, stores PDFs as Cloudinary `raw` resources with a `.pdf` public id (image-type PDF delivery is often blocked), falls back to local disk with a `doc-` prefix. `uploadImage` is unchanged apart from the shared helpers.
- **Profiles module**: `PorterVerificationsService`, `PorterVerificationController` (`porter/verification`), `AdminPorterVerificationsController` (`admin/porter-verifications`), repositories for both tables; `UploadsModule` imported. Writes run in transactions with row locks; the upload is pre-checked before storage and re-checked under lock.
- **Gates**: `APPROVED_PORTER_VERIFICATION_SQL` added to `AvailablePortersRepository` and `PorterRequestsService.assertPorterEligible` (covers create and accept); `PorterProfilesService.updateMyProfile` returns 403 when switching to `available` without approval.
- **Registration data (D-7)**: `RegisterDto` accepts optional `fullName` (trimmed, 2–50) and, for Porters, `experienceYears` (0–80) and `certifications` (same normalized-array rule as the Porter profile). `AuthService.register` saves `full_name` and, for Porters, inserts `porter_profiles` (`version 1`, `unavailable`) in the same transaction; the `auth.register` audit `after` includes the stored values. Web `buildRegisterPayload` sends the trimmed name, and for Porters the experience and the certificate code as `certifications`; the Porter form is regrouped after removing the operating-area field.
- **Seeds**: `main.seed.ts` marks the demo Porter approved; `db-helper create-account` approves new Porters by default (`porterVerification: "none"` to test the review flow).
- **Web**:
  - Shared: new `FileDropzone`, `DocumentPreview`, `StatusBadge`; `Modal` gains size `xl`.
  - `ConfirmModal` z-index raised from `z-50` to `z-[70]` so a confirmation opened from a `Modal` (`z-[60]`) is clickable. This was found by the Playwright run, where the approve confirmation was hidden behind the detail dialog.
  - Porter: feature `porter-verification` (service, hook, `PorterVerificationPage`, `PorterVerificationGate` with a per-session approval cache), route `/porter/verification`, gate on Porter pages and the Porter-only dashboard, 4-step stepper on registration.
  - Admin: feature `admin-porter-verifications` (filters, table, detail dialog with approve confirmation and reject reason form), route `/admin/porter-verifications`, sidebar item "Duyệt hồ sơ Porter".
- **Pre-existing issues found (not fixed)**:
  - The full `pnpm test:integration` run crashes the Jest process on this Windows machine with exit code `0xC0000409`. The same crash happens on clean `develop` (verified by stashing all changes), so it is environmental. The suite passes when run in shards (`--shard=i/8`); a shard that crashes passes on retry. A crashed run can leave an `e2e-%` user in `ctms_test`, which then fails the cleanup check of `auth.send-otp`; delete it before rerunning.
  - `trip-review-deadline.service.ts` on `develop` still uses `import type { TripsService }`, which breaks the dev server DI; a local patch was used only to run the app and is not part of this change.

## 14. Test Evidence

- API build and ESLint: clean. Biome: clean on changed files.
- API unit (`pnpm test`): 110 suites, 1307 tests passed (includes new `porter-verifications.service.spec.ts`, `uploads.service.spec.ts`, updated `porter-profiles.service.spec.ts`; `auth.service.spec.ts` expects `fullName: null` passed to `createUser`).
- `auth.register.integration-spec.ts`: full name stored, Porter profile created from experience and certificate with audit, invalid Porter details rejected with 422.
- API integration (real Postgres, run in 8 shards with `--shard=i/8 --forceExit` because of the crash below): 40 suites, 406 tests passed, including the new `porter-verifications.integration-spec.ts` (full upload → submit → approve flow, reject and resubmit, file validation and limit, role restrictions) and updated `trips.available-porters`, `trips.porter-requests` and `porter-profile-qualifications` specs.
- Web build and ESLint: clean (2 pre-existing warnings in `HostPorterRequestsPage.tsx`).
- Web vitest (full run): 196 files, 1250 tests passed. New suites: `FileDropzone.test.tsx`, `PorterVerificationPage.test.tsx`, `PorterVerificationGate.test.tsx`, `AdminPorterVerificationsPage.test.tsx`, `AppRoutes.porter-verification.test.tsx`. `AppRoutes.porter-assignments.test.tsx` now mocks an approved verification because Porter pages are gated.
- Manual run on the local app with Playwright (temporary script, not committed): Porter registered through the UI shows name, 7 years and certificate code in the Admin detail (screenshots 16–17); register stepper, forced redirect, upload PDF + PNG, submit, Admin reject with reason, Porter resubmit, Admin approve, approved Porter reaches the dashboard.

## 15. Definition of Done

- [x] Migration, entities, repositories, service and controllers implemented.
- [x] Availability, search, request and accept gated on approval.
- [x] Web registration step, Porter verification page, gate and Admin review page implemented with shared components.
- [x] Unit, integration and web tests added and passing.
- [x] Audit log written for submit, approve and reject.
- [x] Screenshots of the running app captured.
- [x] Jira key confirmed (CTMS-1) and file renamed.

## 16. Extension — Tour-guide card with automatic check (bug-list item #4, Jira CTMS-138)

Decisions with the user (2026-11-01/02 and 2026-11-13): a Porter guides customers in the mountains, so under the Tourism Law 2017 (Art. 58) they need a tour-guide card. CTMS operates in Vietnam (mainly Đà Nẵng), so a **domestic (nội địa)** or **international (quốc tế)** card is required; **site-only (tại điểm)** cards are not accepted. The existing "Mã mời / Thẻ chứng chỉ Porter" registration field is kept. Approval stays with a person: the system reads and checks the card photo, labels findings, auto-rejects only an expired or site-only card, and an Admin approves after checking the official registry.

**Official registry.** huongdanvien.vn (Cục Du lịch Quốc gia Việt Nam) has a public search by card number but no API and no stated terms for automated access, so the system does not query it. The Admin opens it from the review dialog and must tick the confirmation before approving.

**Business rules (in addition to BR-1…BR-7).**
- BR-8: Before submitting, the Porter declares the card: type `noi_dia` / `quoc_te`, number of exactly 9 digits, "valid through" date not before today (Vietnam calendar). Editable only in `pending_documents` / `rejected`.
- BR-9: Each image document (JPG/PNG/WEBP) is read by the AI service at upload; PDFs are not read. A failing or unconfigured AI service never blocks the upload (the reading is stored as unavailable).
- BR-10: On submit the newest readable card photo is compared with the declaration and the account name (diacritics and case ignored). Labels: `CARD_EXPIRED`, `CARD_TYPE_SITE_ONLY`, `CARD_NOT_READ`, `NAME_MISMATCH`, `ACCOUNT_NAME_MISSING`, `NUMBER_MISMATCH`, `TYPE_MISMATCH`, `EXPIRY_MISMATCH`.
- BR-11: `CARD_EXPIRED` or `CARD_TYPE_SITE_ONLY` (as read on the photo) → the system rejects immediately with a reason shown to the Porter (`reviewed_by` NULL, audit `porter_verification.auto_rejected` with no actor). Every other label only informs the Admin.
- BR-12: Approval requires `officialRegistryChecked = true`; the approving Admin and time are stored as `registry_checked_by` / `registry_checked_at`.
- BR-13: An approved Porter whose declared card has expired is treated as not approved for availability, available Porter search, request creation and acceptance (same predicate everywhere). Porters approved before this change have no card on file and stay eligible (transition; see Pending Decision).

**Data.** Migration `1795800000000-AddPorterGuideCard`: `porter_verifications` gains `guide_card_type` (CHECK `noi_dia`/`quoc_te`), `guide_card_number` (CHECK 9 digits), `guide_card_expires_on` (date), `card_check` (jsonb: labels, reading, autoRejected), `card_checked_at`, `registry_checked_by` (FK users, SET NULL), `registry_checked_at` (CHECK both or neither); `porter_verification_documents` gains `extraction` (jsonb). "A submitted verification has a card" is enforced by the service, not a CHECK, so rows already pending review do not block the migration.

**API.**
| Method | Path | Change |
| --- | --- | --- |
| PUT | `/api/porter/verification/card` | New. Body `{ cardType, cardNumber, expiresOn }`; 422 invalid or expired; 409 when locked. Audit `porter_verification.card_updated`. |
| POST | `/api/porter/verification/submit` | 422 when no card or the declared card expired; may return `rejected` (auto-rejection). |
| PATCH | `/api/admin/porter-verifications/:porterId/approve` | Body `{ officialRegistryChecked: true }` required (422 otherwise). |
| GET | Porter / Admin detail | `guideCard`; Admin detail adds `cardCheck`, `cardCheckedAt`, `registryCheckedBy`, `registryCheckedAt`. |

AI service: `POST /guide-card-extraction` (`X-CTMS-AI-Token`), body `{ image_base64, mime_type }` → `{ is_guide_card, full_name, card_number, card_type, expires_on, confidence, model, prompt_version }`. It only transcribes the card; prompt v1, temperature 0, JSON output validated by Pydantic; model `GUIDE_CARD_EXTRACTION_MODEL` or the provider default (Gemini / OpenAI through `build_analysis_client()`).

**Code.** API: `providers/guide-card-extraction.provider.ts` (never throws), `utils/guide-card-check.ts` (pure check, reuses `normalizeVietnameseName`), `PorterVerificationsService` (`updateGuideCard`, reading at upload, check and auto-rejection at submit, registry confirmation at approve), `APPROVED_PORTER_VERIFICATION_SQL` and `isApproved` (expiry). Web: `GuideCardForm` on the Porter verification page (submit disabled until the card is saved; own validation messages), `GuideCardReview` in the Admin dialog (declared vs read table, labels, "Mở huongdanvien.vn", copy number, confirmation checkbox; "Duyệt hồ sơ" disabled until ticked).

**Test evidence.**
- AI service pytest: 101 passed (new `test_guide_card_extraction_service.py`).
- API unit: `guide-card-check.spec.ts`, updated `porter-verifications.service.spec.ts` (card required, auto-rejections, labels, registry confirmation). API jest 213 suites, 2 547 tests passed.
- API integration (real Postgres; the AI reader mocked at its HTTP boundary like Cloudinary): `porter-verifications`, `trips.available-porters`, `trips.porter-requests`, `porter-profile-qualifications`: 4 suites, 44 tests passed, including card validation, approval only with the registry confirmation, expired card losing availability, auto-rejection of expired / site-only photos with a system audit, and mismatch labels.
- Web vitest (porter-verification, admin-porter-verifications, routes): 18 passed. `lint:all` 0 errors, `build:all` passes.
- Screenshots (real UI, mocked API): Porter card form; Admin dialog with labels before the tick; approve enabled after the tick.

**Pending Decision.**
- Porters approved before this change have no card on file and remain eligible. The leader should decide a deadline after which they must declare a card (then BR-13 would also block a missing card).
