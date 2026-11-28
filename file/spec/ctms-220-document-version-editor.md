# CTMS-220 — Document Version Editor

This contract names the existing editor already described in CTMS-050, and incorporates the approved pre-publication lifecycle amendment. It does not introduce another editor or ingestion service. Existing rules BR-227, BR-482–BR-484, BR-534–BR-545, BR-172 and BR-191 remain applicable; no new BR numbers are allocated.

## Functional requirements

- Start from the exact current publication and expected document revision. Keep published bytes and historical versions immutable.
- Reuse the existing explicit KEEP, REPLACE, REMOVE, RESTORE, INSERT and REORDER operations, instruction interpretation, preview, revision checks and request replay receipts.
- Resolve historical content only from an eligible exact version of the same document. Preserve section source version, checksum, pages, item references, warning context and ordering.
- Confirm the resulting ordered content and a review basis before generating a new PDF. Reject an unchanged document even if section provenance identifiers differ.
- Require current adaptation grants for the base and all retained historical sources. Composed medical PDFs require specialist approval for the generated checksum before preparation or publication.
- Commit creates a new increasing DRAFT version. Eligible drafts use the existing full-document extraction/chunking pipeline and exact-input historical embedding cache. READY does not publish.
- Explicit publication validates the expected draft and document revisions and atomically activates the prepared knowledge with the new current version.
- Full PDF restoration is exposed through the same document workspace: preview an eligible SUPERSEDED version, record a reason and create a new DRAFT. Never republish the historical row directly or inherit its approval.

## Acceptance scenarios

| Scenario | Expected behavior |
| --- | --- |
| V1 ABCD, V2 ABED, V3 ABEF; restore C over E | New V4 ABCF preserves F and C's source provenance. V1–V3 are unchanged. |
| Restore all of V1 while V2 is current | New V3 contains V1's PDF and records the restoration source and reason. V2 stays current until V3 preparation and explicit publication. |
| Historical checksum equals a SUPERSEDED version of this document | Explicit restoration is allowed, subject to current permissions and current-content no-op protection. |
| Duplicate belongs to another document, an archived record, another draft or the current publication | Ordinary duplicate protection remains effective. |
| Source adaptation grant is removed or generated medical content lacks specialist approval | Preparation/publication is rejected; the current eligible publication remains active. |
| Draft changes after confirmation or preparation | Require current confirmation and preparation inputs; stale results cannot authorize publication. |
| Preparation or publication fails | Preserve the draft for review and the previous eligible publication for retrieval. |

See [the implementation, lifecycle diagrams, APIs and verification matrix](../../docs/features/Document-Version-Knowledge-Lifecycle.md) and [CTMS-050](ctms-50-manage-survival-documents.md) for the shared management workflow.
