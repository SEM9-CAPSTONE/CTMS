# CTMS-388 — Review Trip and Host after Trip: UI

## Behavior

Flutter uses the authoritative review context from CTMS-387. Tab order is My trips, Bookings, Trip history. History filters show all completed bookings, needs review, or both Trip/Host reviews submitted. Summary counts are scoped to the caller; returning from the form refreshes them. Booking completion alone does not authorize reviewing.

Trip/Host targets are derived by the backend. Independent forms accept integer ratings 1–5, optional comments of up to 2,000 Unicode code points, and up to five JPEG/PNG/WebP images of at most 5 MB each. Uploaded image ownership is checked; current records and revisions retain image lists. Existing UploadsService handles local or Cloudinary storage. Detached uploads are retained; automatic orphan cleanup is not implemented.

Creation closes exactly 72 hours after booking completion. Each review is editable for 24 hours from initial submission, independently of creation expiry; edits never renew this deadline. Saved reviews open read-only, with explicit Edit and Cancel controls. Dates display in Vietnam time without a timezone suffix. Client deadlines use server time plus elapsed time; backend validation remains authoritative. Saves refresh context before claiming success; errors preserve drafts and stale context disables writing.

Porter reviews, Host review inbox/notifications, moderation and AI analysis are excluded.

## Storage and development data

Additive migration `1793800000000-AddTripReviewImages.ts` adds image snapshots and the uploader registry. Existing review data is preserved.

Only `services/api/src/seeds/main.seed.ts` contains seed changes. `--trip-reviews-only` adds six dedicated demo scenarios: two new-review trips, saved reviews, edit-expired reviews, create-expired/saved reviews and no-show participation. Re-running refreshes only these demo booking completion times and preserves existing review content. Do not run in production. `--trip-review-titles-only` updates demo trip names without changing booking/review data. No fresh/reset seed was run.

## Verified results — 2026-11-04

- API unit regression: 155 suites / 1,769 tests passed, including 68 related unit tests.
- Trip/Host API integration: 26 tests passed against guarded `ctms_test`, including real PNG upload to isolated local storage, image ownership, revision snapshots, summary isolation and independent deadlines. Cloudinary delivery was not tested.
- Flutter full unit/widget scope: 217 passed / 1 failed. The failure is `porter overview renders dashboard UI and opens schedule`, expecting `CA HÔM NAY` at `test/widget_test.dart:492`. It also fails in isolation on both this working tree and a clean archive of baseline `be6661d7`; it is not introduced by CTMS-388. The two review widget tests passed.
- `pnpm run lint:all`: exit 0, 12 warnings in unchanged web files, no errors.
- `pnpm run build:all`: exit 0 for API and web.
- Targeted Flutter analyze, Flutter web build and Android debug APK build passed. Android runtime evidence was not obtained; the user chose web testing.
- Browser smoke verified desktop and 390px layouts. User-provided Flutter Web video shows Trip/Host creation with images, saved state, explicit editing and persisted changes. The video is external PR evidence, not committed source.
- `pnpm run test:all` was interrupted during the quiet web phase after all API tests passed. A direct web run using thread workers is pending; no successful complete wrapper invocation is claimed.
- Remote CI has not run. These results do not establish an all-green repository or merge readiness.

No commit/push performed. Evidence and the pre-existing untracked `artifacts/` directory must be excluded from staging.
