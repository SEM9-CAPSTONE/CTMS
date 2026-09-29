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

## 12. Open Decisions

Exact image-size/type limits, maximum image count, ordering mechanism, primary-cover-image behavior and physical-vs-soft deletion must come from the approved media/Data Dictionary contract.
